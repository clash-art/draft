import json, os, subprocess, sys, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class RemoteFallbackTests(unittest.TestCase):
    def test_remote_mode_without_a_url_does_not_open_the_local_server(self):
        env = os.environ.copy()
        env["DRAFT_MCP"] = "remote"
        env.pop("DRAFT_URL", None)
        env.pop("DRAFT_SYNC_URL", None)
        env.pop("DRAFT_ACCESS_TOKEN", None)
        env["DRAFT_HOSTED_ENV"] = str(ROOT / "does-not-exist-hosted.env")
        result = subprocess.run([sys.executable, str(ROOT / "scripts" / "mcp_remote.py")], input="", text=True, capture_output=True, env=env, check=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn("本机", result.stderr)

    def test_run_mcp_stays_local_unless_asked(self):
        script = (ROOT / "scripts" / "run-mcp.sh").read_text(encoding="utf-8")
        self.assertIn('DRAFT_MCP:-local', script)
        self.assertLess(script.index("DRAFT_MCP"), script.index("mcp_server.py"))

    def test_bridge_rewrites_a_local_image_path(self):
        sys.path.insert(0, str(ROOT / "scripts"))
        import mcp_remote
        message = {"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": "import_image", "arguments": {"path": "/missing.png"}}}
        rewritten = mcp_remote.rewrite(message)
        self.assertEqual(rewritten["error"]["message"], "图片不存在或超过 8 MB")
        self.assertIsNone(mcp_remote.rewrite({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "read_workspace", "arguments": {}}}))


if __name__ == "__main__":
    unittest.main()
