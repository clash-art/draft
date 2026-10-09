"""Optional Cloudflare fallback engine. The local plugin does not run this.

Bind a shared token, serve the same workbench API, and sync to R2 when the
fallback container has R2 credentials. Without those credentials the process
still serves its own disk and does not call the network.
"""
import json
import mimetypes
import os
from pathlib import Path

import anyio
import uvicorn
from starlette.applications import Starlette
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

from config_ui import load_config, save_config
from sync_client import include_secrets, synchronize
from sync_engine import DirectoryReplica

MAX_BODY = 12 * 1024 * 1024
CONFIG_PATHS = {"/api/config", "/api/test", "/api/network/diagnose"}
GENERIC = "操作未完成：请检查 AppID、AppSecret、IP 白名单和网络；更换 AppID 时须填写对应密钥。"
TOKEN_GATE = (Path(__file__).resolve().parents[1] / "cloudflare" / "token-gate.js").read_text(encoding="utf-8")
SECURITY = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; img-src 'self' data: https://mmbiz.qpic.cn https://mmbiz.qlogo.cn; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
}


class JSON(JSONResponse):
    def render(self, content):
        return json.dumps(content, ensure_ascii=False).encode("utf-8")

    def init_headers(self, headers=None):
        merged = dict(SECURITY)
        if headers:
            merged.update(dict(headers))
        super().init_headers(merged)


def presented_token(headers):
    authorization = headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return headers.get("x-config-token", "").strip()


def authorized(headers, token, trust_proxy):
    import secrets
    got = presented_token(headers)
    if len(got) != len(token) or not secrets.compare_digest(got, token):
        return JSON({"error": "需要访问令牌。"}, status_code=401)
    origin = headers.get("origin")
    if not origin:
        return None
    if trust_proxy and headers.get("x-forwarded-host"):
        proto = headers.get("x-forwarded-proto") or "https"
        expected = f"{proto}://{headers.get('x-forwarded-host')}"
    else:
        host = headers.get("host", "")
        expected = None
        if origin in (f"http://{host}", f"https://{host}"):
            return None
    if expected and origin == expected:
        return None
    return JSON({"error": "页面来源不被接受。"}, status_code=403)


def _r2_store():
    names = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
    values = {name: os.environ.get(name, "") for name in names}
    if not all(values.values()):
        return None
    from r2_store import R2Store
    return R2Store(values["R2_ACCOUNT_ID"], values["R2_ACCESS_KEY_ID"], values["R2_SECRET_ACCESS_KEY"], values["R2_BUCKET"])


def create_app(state_dir, token, trust_proxy=False):
    if not isinstance(token, str) or len(token) < 32:
        raise ValueError("DRAFT_ACCESS_TOKEN 至少 32 个字符")
    state_dir = Path(state_dir)
    state_dir.mkdir(parents=True, exist_ok=True)
    credentials = state_dir / "credentials.json"
    os.environ["WECHAT_CONFIG_PATH"] = str(credentials)
    import mcp_server
    from mcp.server.transport_security import TransportSecuritySettings
    from workspace import Workspace

    def client_factory():
        from wechat import Client
        saved = load_config(credentials)
        if not saved.get("app_id") or not saved.get("app_secret"):
            raise ValueError("请先到账号设置填写 AppID 和 AppSecret")
        return Client.from_credentials(saved["app_id"], saved["app_secret"])

    workspace = Workspace(state_dir / "workspace", client_factory, lambda: load_config(credentials).get("app_id", ""))
    mcp_server.root = workspace.root
    mcp_server.ws = workspace
    mcp_server.mcp.settings.stateless_http = True
    mcp_server.mcp.settings.json_response = True
    mcp_server.mcp.settings.max_request_body_size = MAX_BODY
    mcp_server.mcp.settings.transport_security = TransportSecuritySettings(enable_dns_rebinding_protection=False)
    store = _r2_store()
    replica = DirectoryReplica(state_dir, include_secrets=include_secrets(os.environ))
    pushed = {"hashes": None}

    def sync_now():
        if store is None:
            return
        synchronize(state_dir, store, replica.include_secrets)
        pushed["hashes"] = replica.hashes()

    if store is not None:
        sync_now()

    def push_if_dirty():
        if store is None:
            return
        current = replica.hashes()
        if current == pushed["hashes"]:
            return
        sync_now()

    def status():
        saved = load_config(credentials)
        return {"app_id": saved.get("app_id", ""), "has_secret": bool(saved.get("app_secret"))}

    def call(path, data):
        if os.environ.get("DRAFT_XHS_BROWSER") == "disabled" and path == "/api/channels/status":
            return {"status": "disconnected", "message": "云端页面不打开 Chrome。请在装了插件的电脑上连接小红书。"}
        if os.environ.get("DRAFT_XHS_BROWSER") == "disabled" and path in ("/api/channels/login", "/api/channels/prepare"):
            raise ValueError("小红书登录和填表留在你的电脑上。云端只同步笔记内容。")
        if path in CONFIG_PATHS:
            if path == "/api/config":
                save_config(credentials, data.get("app_id", ""), data.get("app_secret", ""))
                return {**status(), "message": "已保存，插件下次调用会自动读取。"}
            from wechat import Client
            saved = load_config(credentials)
            if not saved.get("app_id") or not saved.get("app_secret"):
                raise ValueError("请先保存 AppID 和 AppSecret")
            if path == "/api/network/diagnose":
                from diagnose import diagnose_credentials
                return diagnose_credentials(saved["app_id"], saved["app_secret"])
            Client.from_credentials(saved["app_id"], saved["app_secret"])
            return {"message": "连接成功，已取得调用令牌。具体草稿、素材和数据权限需在使用时验证。"}
        return workspace.dispatch(path, data)

    async def health(_request):
        return Response("ok", media_type="text/plain", headers=SECURITY)

    async def page(request):
        path = request.url.path
        root = (Path(__file__).resolve().parents[1] / "assets" / "ui").resolve()
        if path == "/":
            target = root / "index.html"
        else:
            relative = path[len("/ui/"):]
            target = (root / relative).resolve()
            if not target.is_relative_to(root):
                return JSON({"error": "资源不存在"}, status_code=404)
        if not target.is_file():
            return JSON({"error": "资源不存在"}, status_code=404)
        body = target.read_bytes()
        media = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        if target.name == "index.html":
            snippet = f'<script id="draft-token-gate">{TOKEN_GATE}</script>'.encode("utf-8")
            body = body.replace(b"</body>", snippet + b"</body>", 1)
            media = "text/html; charset=utf-8"
        return Response(body, media_type=media, headers=SECURITY)

    async def api(request):
        denied = authorized(request.headers, token, trust_proxy)
        if denied:
            return denied
        path = request.url.path
        if request.method == "GET" and path == "/api/config":
            try:
                return JSON(status())
            except ValueError as error:
                return JSON({"error": str(error)[:300]}, status_code=400)
        if request.method != "POST":
            return JSON({"error": "不存在的接口"}, status_code=404)
        body = await request.body()
        if not body or len(body) > MAX_BODY:
            return JSON({"error": "请求长度无效"}, status_code=400)
        if request.headers.get("content-type", "").split(";")[0] != "application/json":
            return JSON({"error": "请求格式无效"}, status_code=400)
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            return JSON({"error": "请求格式无效"}, status_code=400)
        if not isinstance(data, dict):
            return JSON({"error": "请求格式无效"}, status_code=400)
        try:
            result = await anyio.to_thread.run_sync(lambda: call(path, data))
        except ValueError as error:
            message = GENERIC if path in CONFIG_PATHS else str(error)[:500]
            return JSON({"error": message}, status_code=400)
        except OSError:
            return JSON({"error": GENERIC}, status_code=400)
        try:
            await anyio.to_thread.run_sync(push_if_dirty)
        except Exception:
            print("cloud push failed", file=__import__("sys").stderr)
        return JSON(result)

    mcp_server.mcp.settings.streamable_http_path = "/mcp"
    app = mcp_server.mcp.streamable_http_app()
    app.router.routes[0:0] = [
        Route("/health", health, methods=["GET"]),
        Route("/", page, methods=["GET"]),
        Route("/ui/{rest:path}", page, methods=["GET"]),
        Route("/api/config", api, methods=["GET", "POST"]),
        Route("/api/{rest:path}", api, methods=["POST"]),
    ]
    app.add_middleware(TokenGate, token=token, trust_proxy=trust_proxy)
    app.state.sync_now = sync_now
    return app


class TokenGate:
    def __init__(self, app, token, trust_proxy):
        self.app = app
        self.token = token
        self.trust_proxy = trust_proxy

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope["path"]
        if path == "/health" or path == "/" or path.startswith("/ui/"):
            return await self.app(scope, receive, send)
        headers = {key.decode("latin1").lower(): value.decode("latin1") for key, value in scope.get("headers") or []}
        denied = authorized(headers, self.token, self.trust_proxy)
        if denied:
            return await denied(scope, receive, send)
        return await self.app(scope, receive, send)


def main():
    token = os.environ.get("DRAFT_ACCESS_TOKEN", "")
    if len(token) < 32:
        print("DRAFT_ACCESS_TOKEN 至少 32 个字符。未启动云端回退引擎。", file=__import__("sys").stderr)
        raise SystemExit(2)
    state = Path(os.environ.get("DRAFT_STATE_DIR", "/data"))
    trust = os.environ.get("DRAFT_TRUST_PROXY") == "1"
    app = create_app(state, token, trust_proxy=trust)
    port = int(os.environ.get("PORT", "8080"))
    print(f"draft fallback listening on :{port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port, access_log=False, log_level="info")


if __name__ == "__main__":
    main()
