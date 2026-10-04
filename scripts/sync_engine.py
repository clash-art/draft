"""Three-way sync for one local draft replica and one remote replica.

Each device keeps a private base (the hashes it last agreed on). A file is
pushed when only the local side moved, pulled when only the remote side moved,
and left untouched when both moved. Diverged files stay on both sides until
someone explicitly keeps one of them. The base is never uploaded.
"""
import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

KEY_RE = re.compile(r"^(credentials\.json|workspace/[A-Za-z0-9._/-]+)$")
MAX_OBJECT_BYTES = 12 * 1024 * 1024
BLOCKED_FILES = {
    "workspace/.workspace.lock",
    "workspace/mcp-status.json",
    "workspace/app-host.json",
    "workspace/.sync-base.json",
}


def valid_sync_key(key, include_secrets=True):
    if not isinstance(key, str) or not KEY_RE.fullmatch(key):
        return False
    parts = key.split("/")
    if any(part in ("", ".", "..") for part in parts):
        return False
    if key == "credentials.json":
        return bool(include_secrets)
    if key in BLOCKED_FILES:
        return False
    if key.startswith("workspace/xiaohongshu-profile/") or key.startswith("workspace/sync-conflicts/"):
        return False
    return True


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


@dataclass(frozen=True)
class Action:
    kind: str
    key: str
    local_hash: str | None = None
    remote_hash: str | None = None


def plan(local, base, remote):
    """Return actions that move the two replicas toward each other.

    local, base and remote map a sync key to a sha256 hex digest. A missing
    key means the file is absent. Identical local and remote hashes produce
    no action, even when the base is stale.
    """
    actions = []
    for key in sorted(set(local) | set(base) | set(remote)):
        local_hash = local.get(key)
        base_hash = base.get(key)
        remote_hash = remote.get(key)
        if local_hash == remote_hash:
            if local_hash != base_hash:
                actions.append(Action("advance", key, local_hash, remote_hash))
            continue
        if local_hash == base_hash:
            kind = "delete_local" if remote_hash is None else "pull"
        elif remote_hash == base_hash:
            kind = "delete_remote" if local_hash is None else "push"
        else:
            kind = "conflict"
        actions.append(Action(kind, key, local_hash, remote_hash))
    return actions


class DirectoryReplica:
    """Files under the state directory. sync-base.json is the private cursor."""

    def __init__(self, root, include_secrets=True):
        self.root = Path(root)
        self.include_secrets = include_secrets
        self.root.mkdir(parents=True, exist_ok=True)
        self.base_path = self.root / "sync-base.json"
        self.conflict_root = self.root / "sync-conflicts"

    def hashes(self):
        found = {}
        for path in sorted(self.root.rglob("*")):
            if not path.is_file():
                continue
            key = path.relative_to(self.root).as_posix()
            if not valid_sync_key(key, self.include_secrets):
                continue
            size = path.stat().st_size
            if size > MAX_OBJECT_BYTES:
                raise ValueError(f"{key} 超过 12 MB，不能同步")
            found[key] = sha256_bytes(path.read_bytes())
        return found

    def read(self, key):
        self._check(key)
        return self._path(key).read_bytes()

    def write(self, key, data):
        self._check(key)
        if len(data) > MAX_OBJECT_BYTES:
            raise ValueError(f"{key} 超过 12 MB，不能同步")
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def remove(self, key):
        self._check(key)
        path = self._path(key)
        if path.is_file():
            path.unlink()

    def read_base(self):
        if not self.base_path.is_file():
            return {}
        import json
        value = json.loads(self.base_path.read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            raise ValueError("同步游标损坏，请删除 sync-base.json 后重新同步")
        return {key: digest for key, digest in value.items() if isinstance(key, str) and isinstance(digest, str)}

    def write_base(self, base):
        import json
        text = json.dumps(base, ensure_ascii=False, sort_keys=True, indent=2)
        temporary = self.base_path.with_suffix(".json.tmp")
        temporary.write_text(text, encoding="utf-8")
        temporary.replace(self.base_path)

    def save_conflict(self, key, data):
        digest = sha256_bytes(data)[:12]
        safe = key.replace("/", "__")
        path = self.conflict_root / f"{safe}.{digest}"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return path

    def _check(self, key):
        if not valid_sync_key(key, True):
            raise ValueError("同步路径无效")

    def _path(self, key):
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root.resolve()):
            raise ValueError("同步路径无效")
        return path


def apply_actions(replica, store, actions, base):
    """Apply a plan. Conflicts are copied aside and do not move the base."""
    current = dict(base)
    applied = []
    conflicts = []
    for action in actions:
        if action.kind == "advance":
            if action.local_hash is None:
                current.pop(action.key, None)
            else:
                current[action.key] = action.local_hash
        elif action.kind == "conflict":
            saved = None
            if action.remote_hash is not None:
                saved = str(replica.save_conflict(action.key, store.get(action.key)))
            conflicts.append({"key": action.key, "local": action.local_hash, "remote": action.remote_hash, "saved": saved})
            continue
        elif action.kind == "pull":
            replica.write(action.key, store.get(action.key))
            current[action.key] = action.remote_hash
        elif action.kind == "push":
            store.put(action.key, replica.read(action.key))
            current[action.key] = action.local_hash
        elif action.kind == "delete_local":
            replica.remove(action.key)
            current.pop(action.key, None)
        elif action.kind == "delete_remote":
            store.delete(action.key)
            current.pop(action.key, None)
        else:
            raise ValueError("未知同步动作")
        applied.append({"kind": action.kind, "key": action.key})
        replica.write_base(current)
    return {"applied": applied, "conflicts": conflicts, "base": current}


def resolve_conflict(replica, store, key, keep):
    if keep not in ("local", "remote"):
        raise ValueError("请选择保留本机或云端版本")
    if not valid_sync_key(key, True):
        raise ValueError("同步路径无效")
    include = replica.include_secrets
    local = replica.hashes()
    remote = {name: digest for name, digest in store.manifest().items() if valid_sync_key(name, include)}
    base = replica.read_base()
    visible_base = {name: digest for name, digest in base.items() if valid_sync_key(name, include)}
    matched = [item for item in plan(local, visible_base, remote) if item.kind == "conflict" and item.key == key]
    if not matched:
        raise ValueError("这个文件没有待处理的冲突")
    if keep == "local":
        if key in local:
            store.put(key, replica.read(key))
            base[key] = local[key]
        else:
            store.delete(key)
            base.pop(key, None)
    elif key in remote:
        replica.write(key, store.get(key))
        base[key] = remote[key]
    else:
        replica.remove(key)
        base.pop(key, None)
    replica.write_base(base)
    return {"key": key, "kept": keep, "sha256": base.get(key)}
