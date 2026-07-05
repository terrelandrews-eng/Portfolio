"""Markdown-aware chunking (spec §5.4).

Strategy: split on markdown headings first, then pack each section into windows of
~800 tokens with 100-token overlap. Tokens are approximated by whitespace words,
which keeps this a pure, exhaustively testable function with no model dependency.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

HEADING_RE = re.compile(r"^#{1,6}\s")

DEFAULT_WINDOW = 800
DEFAULT_OVERLAP = 100


@dataclass
class Chunk:
    content: str
    index: int


def _split_on_headings(text: str) -> list[str]:
    """Group lines into sections, each starting at a markdown heading."""
    sections: list[list[str]] = []
    current: list[str] = []
    for line in text.splitlines():
        if HEADING_RE.match(line) and current:
            sections.append(current)
            current = [line]
        else:
            current.append(line)
    if current:
        sections.append(current)
    # Drop sections that are only blank lines.
    return ["\n".join(s).strip() for s in sections if "\n".join(s).strip()]


def _window(words: list[str], size: int, overlap: int) -> list[list[str]]:
    if len(words) <= size:
        return [words]
    step = max(1, size - overlap)
    windows: list[list[str]] = []
    start = 0
    while start < len(words):
        windows.append(words[start : start + size])
        if start + size >= len(words):
            break
        start += step
    return windows


def chunk_markdown(
    text: str,
    window: int = DEFAULT_WINDOW,
    overlap: int = DEFAULT_OVERLAP,
) -> list[Chunk]:
    """Chunk a markdown document into overlapping windows, heading-aware."""
    if overlap >= window:
        raise ValueError("overlap must be smaller than window")

    text = (text or "").strip()
    if not text:
        return []

    chunks: list[Chunk] = []
    idx = 0
    for section in _split_on_headings(text):
        words = section.split()
        for w in _window(words, window, overlap):
            chunks.append(Chunk(content=" ".join(w), index=idx))
            idx += 1
    return chunks
