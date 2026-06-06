# -*- coding: utf-8 -*-
"""Test du builder de messages multimodaux (pur, sans reseau)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import llm_gateway as g  # noqa: E402


def test_build_vision_messages():
    msgs = g.build_vision_messages("decris la carte", "QUJD", "image/png")
    assert len(msgs) == 1 and msgs[0]["role"] == "user"
    content = msgs[0]["content"]
    assert content[0] == {"type": "text", "text": "decris la carte"}
    assert content[1]["type"] == "image_url"
    assert content[1]["image_url"]["url"] == "data:image/png;base64,QUJD"
