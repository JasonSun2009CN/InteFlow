"""The shipped `docs/examples/simple-math.ifmd.md` demo stays importable."""

from __future__ import annotations

from pathlib import Path

from app.ifmd.parser import parse

EXAMPLE = Path(__file__).resolve().parents[2] / "docs" / "examples" / "simple-math.ifmd.md"


def test_simple_math_demo_parses() -> None:
    doc = parse(EXAMPLE.read_text(encoding="utf-8"))

    assert doc.meta["ifmd"] == "1"
    assert doc.meta["answers"] == "inline"
    assert len(doc.questions) == 10
    assert all(q.sec == "math" for q in doc.questions)
    assert all(q.answers for q in doc.questions)

    kinds = [q.kind for q in doc.questions]
    assert kinds.count("blank") == 1
    assert kinds[8] == "choice" and doc.questions[8].multi
    assert doc.questions[8].answers == ["A", "C"]
    assert doc.questions[9].answers == ["2", "x=2", "x = 2"]
    assert doc.questions[7].material is not None
