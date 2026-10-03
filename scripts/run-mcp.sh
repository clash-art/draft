#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if command -v uv >/dev/null 2>&1; then
  exec uv run --quiet --script "$SCRIPT_DIR/mcp_server.py"
fi
if [ -x "$SCRIPT_DIR/../.venv/bin/python" ]; then
  exec "$SCRIPT_DIR/../.venv/bin/python" "$SCRIPT_DIR/mcp_server.py"
fi
printf '%s\n' 'Install uv or create the plugin .venv using requirements.txt (Python 3.10+).' >&2
exit 1
