from app.knowledge.chunking import chunk_markdown


def test_empty_returns_no_chunks():
    assert chunk_markdown("") == []
    assert chunk_markdown("   \n  ") == []


def test_single_short_section_is_one_chunk():
    chunks = chunk_markdown("# Title\n\nA short paragraph of text.")
    assert len(chunks) == 1
    assert chunks[0].index == 0
    assert "short paragraph" in chunks[0].content


def test_splits_on_headings():
    text = "# A\n\nalpha content\n\n# B\n\nbeta content"
    chunks = chunk_markdown(text)
    assert len(chunks) == 2
    assert "alpha" in chunks[0].content
    assert "beta" in chunks[1].content


def test_indices_are_sequential():
    text = "# A\n\n" + " ".join(str(i) for i in range(2000))
    chunks = chunk_markdown(text, window=800, overlap=100)
    assert [c.index for c in chunks] == list(range(len(chunks)))


def test_windowing_overlaps():
    # 2000 words, window 800, overlap 100 -> step 700 -> windows at 0,700,1400 => 3
    words = " ".join(f"w{i}" for i in range(2000))
    chunks = chunk_markdown(f"# H\n\n{words}", window=800, overlap=100)
    assert len(chunks) == 3
    first_words = chunks[0].content.split()
    second_words = chunks[1].content.split()
    # Overlap: last 100 of window 1 equal first 100 of window 2.
    assert first_words[-100:] == second_words[:100]


def test_overlap_must_be_smaller_than_window():
    import pytest

    with pytest.raises(ValueError):
        chunk_markdown("# H\n\nsome text", window=100, overlap=100)
