#!/usr/bin/env python3
"""Static dev server for local preview (GitHub Pages equivalent)."""
import os

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from http.server import HTTPServer, SimpleHTTPRequestHandler  # noqa: E402

HTTPServer(("127.0.0.1", 8734), SimpleHTTPRequestHandler).serve_forever()
