import json, os, socket, sys, threading, unittest, urllib.error, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import uvicorn

TOKEN = "local-test-token-0123456789abcdef"


def post(url, payload, token=TOKEN, origin=None):
    data = json.dumps(payload).encode()
    request = urllib.request.Request(url, data=data, method="POST")
    request.add_header("Content-Type", "application/json")
    request.add_header("Accept", "application/json, text/event-stream")
    request.add_header("Authorization", "Bearer " + token)
    if origin:
        request.add_header("Origin", origin)
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as error:
        body = error.read().decode()
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = {"raw": body}
        return error.code, parsed


class HostedFallbackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import mcp_server
        cls._old = (mcp_server.ws, mcp_server.root, os.environ.get("WECHAT_CONFIG_PATH"), mcp_server.mcp.settings.stateless_http, mcp_server.mcp.settings.json_response)
        probe = socket.socket()
        probe.bind(("127.0.0.1", 0))
        cls.port = probe.getsockname()[1]
        probe.close()
        cls.tmp = __import__("tempfile").TemporaryDirectory()
        import hosted
        app = hosted.create_app(Path(cls.tmp.name), TOKEN, trust_proxy=False)
        config = uvicorn.Config(app, host="127.0.0.1", port=cls.port, log_level="warning", access_log=False)
        cls.server = uvicorn.Server(config)
        cls.thread = threading.Thread(target=cls.server.run, daemon=True)
        cls.thread.start()
        for _ in range(50):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{cls.port}/health", timeout=0.2) as response:
                    if response.status == 200:
                        break
            except OSError:
                import time
                time.sleep(0.05)
        else:
            raise RuntimeError("fallback engine did not start")

    @classmethod
    def tearDownClass(cls):
        cls.server.should_exit = True
        cls.thread.join(timeout=5)
        import mcp_server
        mcp_server.ws, mcp_server.root = cls._old[0], cls._old[1]
        if cls._old[2] is None:
            os.environ.pop("WECHAT_CONFIG_PATH", None)
        else:
            os.environ["WECHAT_CONFIG_PATH"] = cls._old[2]
        mcp_server.mcp.settings.stateless_http = cls._old[3]
        mcp_server.mcp.settings.json_response = cls._old[4]
        cls.tmp.cleanup()

    def test_api_requires_token_and_keeps_a_draft(self):
        base = f"http://127.0.0.1:{self.port}"
        status, body = post(base + "/api/editor/load", {}, token="nope")
        self.assertEqual(status, 401)
        self.assertNotIn("local-test-token", json.dumps(body))
        status, opened = post(base + "/api/editor/load", {})
        self.assertEqual(status, 200, opened)
        status, saved = post(base + "/api/editor/save", {"title": "云端回退", "body": "hello", "expected_revision": opened.get("revision")})
        self.assertEqual(status, 200, saved)
        self.assertEqual(saved["title"], "云端回退")
        status, again = post(base + "/api/editor/load", {})
        self.assertEqual(again["title"], "云端回退")

    def test_page_is_public_and_asks_for_a_token(self):
        with urllib.request.urlopen(f"http://127.0.0.1:{self.port}/") as response:
            html = response.read().decode()
        self.assertIn("draft-token-gate", html)
        self.assertIn("draft-token-panel", html)
        self.assertIn("/ui/assets/", html)

    def test_foreign_origin_is_rejected(self):
        status, _body = post(f"http://127.0.0.1:{self.port}/api/editor/load", {}, origin="https://evil.example")
        self.assertEqual(status, 403)

    def test_xiaohongshu_browser_stays_on_the_device(self):
        os.environ["DRAFT_XHS_BROWSER"] = "disabled"
        try:
            status, body = post(f"http://127.0.0.1:{self.port}/api/channels/login", {})
        finally:
            os.environ.pop("DRAFT_XHS_BROWSER", None)
        self.assertEqual(status, 400)
        self.assertIn("电脑", body["error"])

    def test_remote_mcp_lists_tools(self):
        status, init = post(f"http://127.0.0.1:{self.port}/mcp", {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "test", "version": "0"}},
        })
        self.assertEqual(status, 200, init)
        self.assertIn("protocolVersion", init.get("result", {}))
        status, tools = post(f"http://127.0.0.1:{self.port}/mcp", {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
        self.assertEqual(status, 200, tools)
        names = [item["name"] for item in tools["result"]["tools"]]
        self.assertIn("read_workspace", names)
        self.assertIn("save_channel_edition", names)
        denied, _body = post(f"http://127.0.0.1:{self.port}/mcp", {"jsonrpc": "2.0", "id": 3, "method": "tools/list"}, token="x" * 32)
        self.assertEqual(denied, 401)


if __name__ == "__main__":
    unittest.main()
