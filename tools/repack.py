#!/usr/bin/env python3
"""Extract / re-inject the page template embedded in the bundled index.html.

The deployed index.html stores the real page markup as a JSON string inside
a <script type="__bundler/template"> tag. Edit the extracted template.html,
then inject it back.

Usage:
  python3 tools/repack.py extract <out-template.html>
  python3 tools/repack.py inject  <in-template.html>
"""
import json
import sys
from pathlib import Path

INDEX = Path(__file__).resolve().parent.parent / "index.html"
MARKER = '<script type="__bundler/template">'


def template_line_index(lines):
    for i, line in enumerate(lines):
        if MARKER in line:
            return i + 1  # JSON string is on the line after the opening tag
    raise SystemExit("template marker not found in index.html")


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("extract", "inject"):
        raise SystemExit(__doc__)
    cmd, path = sys.argv[1], Path(sys.argv[2])
    text = INDEX.read_text()
    lines = text.split("\n")
    idx = template_line_index(lines)
    if cmd == "extract":
        path.write_text(json.loads(lines[idx]))
        print(f"extracted {len(lines[idx])} json chars -> {path}")
    else:
        tpl = path.read_text()
        # "</" must stay escaped or "</script>" inside the template would
        # terminate the carrier <script> tag and break the whole page.
        lines[idx] = json.dumps(tpl, ensure_ascii=False).replace("</", "<\\/")
        INDEX.write_text("\n".join(lines))
        print(f"injected {len(lines[idx])} json chars from {path} -> {INDEX}")


if __name__ == "__main__":
    main()
