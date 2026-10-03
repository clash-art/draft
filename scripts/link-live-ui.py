#!/usr/bin/env python3
"""Opt an installed development plugin into live local UI builds (server stays pinned)."""
import argparse
import json
import shutil
from pathlib import Path


def link_live_ui(source: Path, installed: Path, backup: Path):
    source = source.resolve(strict=True)
    if not (installed / '.codex-plugin/plugin.json').is_file():
        raise ValueError('Installed plugin manifest missing')
    manifest = json.loads((installed / '.codex-plugin/plugin.json').read_text())
    if manifest.get('name') != 'wechat-drafts':
        raise ValueError('Expected wechat-drafts plugin')
    target = installed / 'assets/mcp-app/mcp-app.html'
    if target.is_symlink() and target.resolve() == source:
        return target
    backup.mkdir(parents=True, exist_ok=True)
    saved = backup / (installed.name + '.html')
    if target.exists() and not saved.exists():
        shutil.copy2(target, saved)
    temporary = target.with_suffix('.live-link')
    if temporary.is_symlink():
        temporary.unlink()
    temporary.symlink_to(source)
    temporary.replace(target)
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--installed', type=Path, required=True)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[1] / 'assets/mcp-app/mcp-app.html')
    parser.add_argument('--backup', type=Path, required=True)
    args = parser.parse_args()
    target = link_live_ui(args.source, args.installed, args.backup)
    print(f'Live UI: {target} -> {target.resolve()}')
