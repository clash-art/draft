import hashlib, json, os, stat, subprocess, sys, tempfile, threading, unittest
from unittest import mock
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import sync_client
import sync_engine
from r2_store import authorization


class MemoryStore:
    def __init__(self):
        self.files = {}

    def manifest(self):
        return {key: hashlib.sha256(value).hexdigest() for key, value in self.files.items()}

    def get(self, key):
        return self.files[key]

    def put(self, key, data):
        self.files[key] = data

    def delete(self, key):
        self.files.pop(key, None)


class SyncPlanTests(unittest.TestCase):
    def test_three_way_cases(self):
        cases = [
            ({"a": "1"}, {}, {}, ["push"]),
            ({}, {}, {"a": "1"}, ["pull"]),
            ({"a": "1"}, {"a": "1"}, {"a": "2"}, ["pull"]),
            ({"a": "2"}, {"a": "1"}, {"a": "1"}, ["push"]),
            ({"a": "2"}, {"a": "1"}, {"a": "3"}, ["conflict"]),
            ({}, {"a": "1"}, {"a": "1"}, ["delete_remote"]),
            ({"a": "1"}, {"a": "1"}, {}, ["delete_local"]),
            ({}, {"a": "1"}, {"a": "2"}, ["conflict"]),
            ({"a": "2"}, {"a": "1"}, {}, ["conflict"]),
            ({"a": "9"}, {}, {"a": "9"}, ["advance"]),
            ({"a": "1"}, {"a": "1"}, {"a": "1"}, []),
        ]
        for local, base, remote, kinds in cases:
            with self.subTest(kinds=kinds):
                self.assertEqual([item.kind for item in sync_engine.plan(local, base, remote)], kinds)

    def test_conflict_keeps_both_until_resolved(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "workspace").mkdir()
            (root / "workspace" / "editor.json").write_text('{"title":"local"}', encoding="utf-8")
            replica = sync_engine.DirectoryReplica(root)
            store = MemoryStore()
            store.put("workspace/editor.json", b'{"title":"cloud"}')
            report = sync_engine.apply_actions(replica, store, sync_engine.plan(replica.hashes(), {}, store.manifest()), {})
            self.assertEqual(report["conflicts"][0]["key"], "workspace/editor.json")
            self.assertIn("local", (root / "workspace" / "editor.json").read_text(encoding="utf-8"))
            self.assertTrue(any(path.is_file() for path in (root / "sync-conflicts").iterdir()))
            self.assertEqual(json.loads((root / "workspace" / "editor.json").read_text(encoding="utf-8"))["title"], "local")
            resolved = sync_engine.resolve_conflict(replica, store, "workspace/editor.json", "remote")
            self.assertEqual(resolved["kept"], "remote")
            self.assertIn("cloud", (root / "workspace" / "editor.json").read_text(encoding="utf-8"))
            self.assertEqual(sync_engine.plan(replica.hashes(), replica.read_base(), store.manifest()), [])

    def test_private_files_stay_on_the_device(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            profile = root / "workspace" / "xiaohongshu-profile"
            profile.mkdir(parents=True)
            (profile / "Cookies").write_text("secret", encoding="utf-8")
            (root / "sync-base.json").write_text("{}", encoding="utf-8")
            (root / "credentials.json").write_text("{}", encoding="utf-8")
            replica = sync_engine.DirectoryReplica(root, include_secrets=False)
            self.assertEqual(replica.hashes(), {})
            self.assertTrue(sync_engine.valid_sync_key("credentials.json"))
            self.assertFalse(sync_engine.valid_sync_key("workspace/xiaohongshu-profile/Cookies"))

    def test_push_then_pull_between_two_directories(self):
        with tempfile.TemporaryDirectory() as tmp:
            left = Path(tmp) / "left"
            right = Path(tmp) / "right"
            left.mkdir()
            (left / "workspace").mkdir()
            (left / "workspace" / "editor.json").write_bytes(b'{"title":"one"}')
            store = MemoryStore()
            first = sync_engine.DirectoryReplica(left)
            sync_engine.apply_actions(first, store, sync_engine.plan(first.hashes(), {}, store.manifest()), {})
            second = sync_engine.DirectoryReplica(right)
            sync_engine.apply_actions(second, store, sync_engine.plan(second.hashes(), {}, store.manifest()), {})
            self.assertEqual((right / "workspace" / "editor.json").read_bytes(), b'{"title":"one"}')


class SyncClientTests(unittest.TestCase):
    def test_unconfigured_exits_cleanly_without_network(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            for key in list(env):
                if key.startswith("DRAFT_") or key.startswith("R2_") or key == "WECHAT_CONFIG_PATH":
                    env.pop(key, None)
            env["DRAFT_HOSTED_ENV"] = str(Path(tmp) / "missing.env")
            result = subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1] / "scripts" / "sync_client.py"), "status", "--json"], env=env, text=True, capture_output=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertFalse(json.loads(result.stdout)["configured"])

    def test_world_readable_env_file_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "hosted.env"
            path.write_text("DRAFT_SYNC_URL=http://127.0.0.1:9\nDRAFT_ACCESS_TOKEN=" + ("a" * 32) + "\n", encoding="utf-8")
            path.chmod(0o644)
            with self.assertRaises(PermissionError):
                sync_client.read_env_file(path)
            path.chmod(stat.S_IRUSR | stat.S_IWUSR)
            self.assertEqual(sync_client.read_env_file(path)["DRAFT_SYNC_URL"], "http://127.0.0.1:9")

    def test_http_round_trip(self):
        objects = {}

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_args):
                return

            def _auth(self):
                if self.headers.get("Authorization") != "Bearer " + ("b" * 32):
                    self._send(401, {"error": "需要访问令牌。"})
                    return False
                return True

            def _send(self, status, payload, extra=None):
                body = json.dumps(payload).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                for name, value in (extra or {}).items():
                    self.send_header(name, value)
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):
                if not self._auth():
                    return
                path = urlsplit(self.path).path
                if path == "/sync/manifest":
                    files = [{"key": key, "sha256": hashlib.sha256(value).hexdigest(), "size": len(value)} for key, value in objects.items()]
                    return self._send(200, {"files": files})
                key = parse_qs(urlsplit(self.path).query).get("key", [""])[0]
                if key not in objects:
                    return self._send(404, {"error": "missing"})
                body = objects[key]
                self.send_response(200)
                self.send_header("X-Content-Sha256", hashlib.sha256(body).hexdigest())
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_PUT(self):
                if not self._auth():
                    return
                key = parse_qs(urlsplit(self.path).query).get("key", [""])[0]
                length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(length)
                objects[key] = body
                self._send(200, {"key": key})

            def do_DELETE(self):
                if not self._auth():
                    return
                key = parse_qs(urlsplit(self.path).query).get("key", [""])[0]
                objects.pop(key, None)
                self._send(200, {"deleted": True})

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                (root / "workspace").mkdir()
                (root / "workspace" / "editor.json").write_text("{}", encoding="utf-8")
                env = {
                    "DRAFT_SYNC_URL": f"http://127.0.0.1:{server.server_port}",
                    "DRAFT_ACCESS_TOKEN": "b" * 32,
                    "DRAFT_HOSTED_ENV": str(root / "none"),
                }
                with mock.patch.dict(os.environ, env, clear=False):
                    report = sync_client.synchronize(root, sync_client.build_store(sync_client.merged_env())[0], True)
                self.assertEqual(len(report["applied"]), 1)
                self.assertIn("workspace/editor.json", objects)
        finally:
            server.shutdown()
            server.server_close()


class SignatureTests(unittest.TestCase):
    def test_aws_sigv4_get_example(self):
        header, _headers, query = authorization(
            "AKIAIOSFODNN7EXAMPLE",
            "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "GET",
            "/test.txt",
            [],
            {"host": "examplebucket.s3.amazonaws.com", "range": "bytes=0-9"},
            b"",
            datetime(2013, 5, 24, tzinfo=timezone.utc),
            region="us-east-1",
        )
        self.assertEqual(query, "")
        self.assertIn(
            "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
            header,
        )


if __name__ == "__main__":
    unittest.main()
