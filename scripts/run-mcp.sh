#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PLUGIN_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
VENV_PY="$PLUGIN_ROOT/.venv/bin/python"
REQ="$PLUGIN_ROOT/requirements.txt"

# Plugins stay on the local MCP server, including offline.
# Set DRAFT_MCP=remote only as an explicit fallback to a hosted endpoint.
if [ "${DRAFT_MCP:-local}" = "remote" ]; then
  exec python3 "$SCRIPT_DIR/mcp_remote.py"
fi

if command -v uv >/dev/null 2>&1; then
  exec uv run --quiet --script "$SCRIPT_DIR/mcp_server.py"
fi

ensure_venv() {
  if [ -x "$VENV_PY" ]; then
    return 0
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    printf '%s\n' 'python3 is required when uv is not installed.' >&2
    return 1
  fi
  printf '%s\n' 'Creating plugin .venv and installing requirements.txt...' >&2
  if ! python3 -m venv "$PLUGIN_ROOT/.venv" 2>/dev/null; then
    printf '%s\n' 'Failed to create .venv. Install python3-venv (e.g. apt install python3-venv) or install uv.' >&2
    return 1
  fi
  if [ ! -f "$REQ" ]; then
    printf '%s\n' "Missing $REQ" >&2
    return 1
  fi
  "$PLUGIN_ROOT/.venv/bin/pip" install -q -r "$REQ"
}

if ensure_venv; then
  exec "$VENV_PY" "$SCRIPT_DIR/mcp_server.py"
fi
printf '%s\n' 'Install uv or fix the plugin .venv (Python 3.10+).' >&2
exit 1
