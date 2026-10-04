"""Sync the local draft workspace with Cloudflare. Optional and offline-safe.

With no DRAFT_SYNC_URL and no R2 keys, this command does nothing and exits 0.
The Codex/Cursor plugins do not call it unless you ask them to.
"""
import argparse
import json
import os
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from sync_engine import DirectoryReplica, apply_actions, plan, resolve_conflict, sha256_bytes, valid_sync_key

ENV_KEYS = {
    "DRAFT_SYNC_URL",
    "DRAFT_URL",
    "DRAFT_ACCESS_TOKEN",
    "DRAFT_SYNC_SECRETS",
    "DRAFT_MCP",
    "DRAFT_DEVICE_NAME",
    "DRAFT_HOSTED_ENV",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
}


def env_file_path():
    override = os.environ.get("DRAFT_HOSTED_ENV")
    if override:
        return Path(override)
    return Path.home() / ".config" / "wechat-drafts" / "hosted.env"


def read_env_file(path):
    path = Path(path)
    if not path.is_file():
        return {}
    mode = path.stat().st_mode
    if mode & (stat.S_IRGRP | stat.S_IWGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IWOTH | stat.S_IXOTH):
        raise PermissionError(f"{path} 可以被其他用户读取。请先 chmod 600。")
    values = {}
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"{path}:{line_number} 不是 KEY=VALUE")
        key, value = line.split("=", 1)
        key = key.strip()
        if key not in ENV_KEYS:
            raise ValueError(f"{path}:{line_number} 不认识 {key}")
        values[key] = value.strip().strip('"').strip("'")
    return values


def merged_env():
    found = {}
    path = env_file_path()
    if path.is_file():
        found.update(read_env_file(path))
    for key in ENV_KEYS:
        if os.environ.get(key):
            found[key] = os.environ[key]
    return found


def include_secrets(env):
    return env.get("DRAFT_SYNC_SECRETS", "1") != "0"


def state_dir():
    configured = os.environ.get("WECHAT_CONFIG_PATH")
    if configured:
        return Path(configured).expanduser().resolve().parent
    return Path.home() / ".config" / "wechat-drafts"


class HttpSyncStore:
    def __init__(self, base_url, token):
        self.base = base_url.rstrip("/")
        self.token = token

    def manifest(self):
        payload = self._json("GET", "/sync/manifest")
        files = payload.get("files")
        if not isinstance(files, list):
            raise RuntimeError("云端清单格式无效")
        found = {}
        for item in files:
            key = item.get("key")
            digest = item.get("sha256")
            if not valid_sync_key(key, True) or not isinstance(digest, str):
                raise RuntimeError("云端清单包含无效路径")
            found[key] = digest
        return found

    def get(self, key):
        status, body, headers = self._open("GET", "/sync/object?key=" + _quote(key))
        if status == 404:
            raise FileNotFoundError(key)
        if status != 200:
            raise RuntimeError(_failure(body, status))
        digest = headers.get("X-Content-Sha256") or headers.get("x-content-sha256")
        if digest and digest != sha256_bytes(body):
            raise RuntimeError("云端对象校验不一致")
        return body

    def put(self, key, data):
        digest = sha256_bytes(data)
        status, body, _headers = self._open("PUT", "/sync/object?key=" + _quote(key), data, {"X-Content-Sha256": digest})
        if status != 200:
            raise RuntimeError(_failure(body, status))

    def delete(self, key):
        status, body, _headers = self._open("DELETE", "/sync/object?key=" + _quote(key))
        if status not in (200, 404):
            raise RuntimeError(_failure(body, status))

    def _json(self, method, path):
        status, body, _headers = self._open(method, path)
        if status != 200:
            raise RuntimeError(_failure(body, status))
        return json.loads(body.decode("utf-8"))

    def _open(self, method, path, data=None, extra=None):
        request = urllib.request.Request(self.base + path, data=data, method=method)
        request.add_header("Authorization", "Bearer " + self.token)
        for name, value in (extra or {}).items():
            request.add_header(name, value)
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.status, response.read(), response.headers
        except urllib.error.HTTPError as error:
            return error.code, error.read(), error.headers


def build_store(env):
    token = env.get("DRAFT_ACCESS_TOKEN", "")
    url = env.get("DRAFT_SYNC_URL", "")
    if url:
        if len(token) < 32:
            raise ValueError("DRAFT_ACCESS_TOKEN 至少 32 个字符")
        return HttpSyncStore(url, token), "http"
    if env.get("R2_ACCESS_KEY_ID") and env.get("R2_SECRET_ACCESS_KEY") and env.get("R2_ACCOUNT_ID") and env.get("R2_BUCKET"):
        from r2_store import R2Store
        return R2Store(env["R2_ACCOUNT_ID"], env["R2_ACCESS_KEY_ID"], env["R2_SECRET_ACCESS_KEY"], env["R2_BUCKET"]), "r2"
    return None, "off"


def configuration_error(env):
    """Return a message when cloud settings are present but unusable."""
    try:
        build_store(env)
    except (ValueError, PermissionError) as error:
        return str(error)
    return None


def _visible(mapping, include):
    return {key: value for key, value in mapping.items() if valid_sync_key(key, include)}


def synchronize(root, store, include):
    replica = DirectoryReplica(root, include_secrets=include)
    base = _visible(replica.read_base(), include)
    actions = plan(replica.hashes(), base, _visible(store.manifest(), include))
    result = apply_actions(replica, store, actions, replica.read_base())
    result["configured"] = True
    return result


def status_report(root, store, include):
    replica = DirectoryReplica(root, include_secrets=include)
    actions = plan(replica.hashes(), _visible(replica.read_base(), include), _visible(store.manifest(), include))
    counts = {}
    for action in actions:
        counts[action.kind] = counts.get(action.kind, 0) + 1
    return {"configured": True, "pending": counts, "conflicts": [action.key for action in actions if action.kind == "conflict"]}


def _quote(key):
    return urllib.parse.quote(key, safe="")


def _failure(body, status):
    try:
        payload = json.loads(body.decode("utf-8"))
        if isinstance(payload, dict) and payload.get("error"):
            return str(payload["error"])[:300]
    except (UnicodeDecodeError, json.JSONDecodeError):
        pass
    return f"云同步失败 {status}"


def main(argv=None):
    parser = argparse.ArgumentParser(description="可选的 Cloudflare 草稿同步")
    parser.add_argument("command", choices=("status", "sync", "resolve"))
    parser.add_argument("key", nargs="?")
    parser.add_argument("--keep", choices=("local", "remote"))
    parser.add_argument("--root", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    try:
        env = merged_env()
    except (PermissionError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 2
    problem = configuration_error(env)
    if problem:
        print(problem, file=sys.stderr)
        return 2
    store, mode = build_store(env)
    root = args.root or state_dir()
    include = include_secrets(env)
    if store is None:
        report = {"configured": False, "mode": "off", "message": "云同步未配置。本机工作台和插件可以离线使用。"}
        _emit(report, args.json)
        return 0
    try:
        if args.command == "status":
            report = status_report(root, store, include)
        elif args.command == "sync":
            report = synchronize(root, store, include)
        else:
            if not args.key or not args.keep:
                print("resolve 需要路径和 --keep local|remote", file=sys.stderr)
                return 2
            report = resolve_conflict(DirectoryReplica(root, include_secrets=include), store, args.key, args.keep)
        report["mode"] = mode
    except urllib.error.URLError:
        print("云同步连不上。本机稿件没有改动。", file=sys.stderr)
        return 1
    except (RuntimeError, ValueError, FileNotFoundError, OSError) as error:
        print(str(error)[:500], file=sys.stderr)
        return 1
    _emit(report, args.json)
    if report.get("conflicts"):
        return 3
    return 0


def _emit(report, as_json):
    if as_json:
        print(json.dumps(report, ensure_ascii=False, sort_keys=True))
        return
    if report.get("configured") is False:
        print(report["message"])
        return
    if "pending" in report:
        labels = {"push": "待上传", "pull": "待下载", "delete_local": "待删除本机", "delete_remote": "待删除云端", "conflict": "冲突", "advance": "对齐游标"}
        pending = report["pending"]
        if not pending:
            print("云同步状态：本机和云端一致。")
        else:
            print("云同步状态：" + "，".join(f"{labels.get(name, name)} {count}" for name, count in sorted(pending.items())))
        for key in report.get("conflicts") or []:
            print("冲突未合并：" + key)
        return
    if "applied" in report:
        print(f"已同步 {len(report['applied'])} 项，冲突 {len(report['conflicts'])} 项。")
        for item in report["conflicts"]:
            print("冲突保留两边：" + item["key"])
        return
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    sys.exit(main())
