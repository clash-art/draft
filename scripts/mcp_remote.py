#!/usr/bin/env python3
"""stdio MCP proxy for the optional hosted endpoint.

The plugin stays on the local server unless DRAFT_MCP=remote. This process
only speaks HTTP to that endpoint; it does not open the local workspace.
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

from sync_client import merged_env

SESSION = {"id": None}
PROTOCOL = "2025-03-26"


def endpoint(env):
    base = (env.get("DRAFT_URL") or env.get("DRAFT_SYNC_URL") or "").rstrip("/")
    token = env.get("DRAFT_ACCESS_TOKEN", "")
    if not base or len(token) < 32:
        raise ValueError("DRAFT_MCP=remote 需要 DRAFT_URL 和至少 32 字符的 DRAFT_ACCESS_TOKEN。不设置 DRAFT_MCP 即继续使用本机服务。")
    return base + "/mcp", token


def rewrite(message):
    if message.get("method") != "tools/call":
        return None
    params = message.get("params") or {}
    name = params.get("name")
    args = params.get("arguments") or {}
    if name == "import_image":
        path = Path(str(args.get("path", ""))).expanduser()
        if not path.is_file() or path.stat().st_size > 8 * 1024 * 1024:
            return _error(message.get("id"), "图片不存在或超过 8 MB")
        import base64
        data = {"name": path.name, "data": base64.b64encode(path.read_bytes()).decode("ascii")}
        return _forward_local(message, "/api/upload", data)
    if name == "analyze_csv":
        path = Path(str(args.get("path", ""))).expanduser()
        if not path.is_file() or path.stat().st_size > 4 * 1024 * 1024:
            return _error(message.get("id"), "CSV 不存在或超过 4 MB")
        return _forward_local(message, "/api/csv", {"text": path.read_text(encoding="utf-8-sig"), "mode": args.get("mode", "snapshot")})
    if name == "analyze_export":
        path = Path(str(args.get("path", ""))).expanduser()
        if not path.is_file() or path.stat().st_size > 4 * 1024 * 1024:
            return _error(message.get("id"), "数据文件不存在或超过 4 MB")
        import base64
        data = {"name": path.name, "data": base64.b64encode(path.read_bytes()).decode("ascii"), "mode": args.get("mode", "snapshot")}
        return _forward_local(message, "/api/analytics/import", data)
    return None


def _forward_local(message, path, data):
    cloned = dict(message)
    cloned["params"] = {"name": "content_workbench_local", "arguments": {"path": path, "data": data}}
    return cloned


def _error(request_id, text):
    if request_id is None:
        return {"drop": True}
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32000, "message": text}}


def post(url, token, message):
    body = json.dumps(message, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(url, data=body, method="POST")
    request.add_header("Authorization", "Bearer " + token)
    request.add_header("Content-Type", "application/json")
    request.add_header("Accept", "application/json, text/event-stream")
    request.add_header("MCP-Protocol-Version", PROTOCOL)
    if SESSION["id"]:
        request.add_header("Mcp-Session-Id", SESSION["id"])
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read()
            headers = response.headers
            status = response.status
    except urllib.error.HTTPError as error:
        payload = error.read()
        headers = error.headers
        status = error.code
    session = headers.get("Mcp-Session-Id") or headers.get("mcp-session-id")
    if session:
        SESSION["id"] = session
    if status == 202 or not payload:
        return None
    if status >= 400:
        raise RuntimeError(_remote_error(payload, status))
    content_type = headers.get("Content-Type", "")
    if "text/event-stream" in content_type:
        return _sse(payload)
    return json.loads(payload.decode("utf-8"))


def _sse(payload):
    chosen = None
    for line in payload.decode("utf-8").splitlines():
        if line.startswith("data:"):
            raw = line[5:].strip()
            if raw:
                chosen = json.loads(raw)
    return chosen


def _remote_error(payload, status):
    try:
        value = json.loads(payload.decode("utf-8"))
        if isinstance(value, dict) and value.get("error"):
            return str(value["error"])[:300]
    except (UnicodeDecodeError, json.JSONDecodeError):
        pass
    return f"远程 MCP 失败 {status}"


def _strip_preview(message):
    result = message.get("result") if isinstance(message, dict) else None
    if not isinstance(result, dict):
        return message
    structured = result.get("structuredContent")
    if isinstance(structured, dict):
        structured.pop("preview", None)
    for block in result.get("content") or []:
        if isinstance(block, dict) and block.get("type") == "text":
            try:
                value = json.loads(block.get("text") or "")
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict) and "preview" in value:
                value.pop("preview", None)
                block["text"] = json.dumps(value, ensure_ascii=False)
    return message


def main():
    try:
        env = merged_env()
        url, token = endpoint(env)
    except (PermissionError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 2
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            print("无效的 MCP 消息", file=sys.stderr)
            return 2
        rewritten = rewrite(message)
        if isinstance(rewritten, dict) and "error" in rewritten:
            sys.stdout.write(json.dumps(rewritten, ensure_ascii=False) + "\n")
            sys.stdout.flush()
            continue
        outgoing = rewritten or message
        if isinstance(rewritten, dict) and rewritten.get("drop"):
            continue
        try:
            response = post(url, token, outgoing)
        except urllib.error.URLError:
            print("远程工作台连不上。本机服务没有被改成远程模式之外的状态。", file=sys.stderr)
            return 1
        except RuntimeError as error:
            print(str(error), file=sys.stderr)
            return 1
        if response is None:
            continue
        if isinstance(rewritten, dict):
            response = _strip_preview(response)
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
