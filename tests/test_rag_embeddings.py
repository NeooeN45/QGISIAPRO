# -*- coding: utf-8 -*-
"""Tests du backend embeddings NIM + recherche sémantique du RAGStore (sans réseau)."""
import io
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "QGISIA2"))

import nim_embeddings as ne  # noqa: E402
import rag_store as rs  # noqa: E402


# ── nim_embeddings (urllib mocké) ─────────────────────────────────────────────

class _FakeResp:
    def __init__(self, payload):
        self._data = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._data

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_embed_texts_requires_key():
    with pytest.raises(ne.EmbeddingError):
        ne.embed_texts(["x"], api_key="")


def test_embed_texts_parses_and_orders(monkeypatch):
    # Réponse volontairement dans le désordre (index 1 avant 0).
    payload = {"data": [
        {"index": 1, "embedding": [0.0, 1.0]},
        {"index": 0, "embedding": [1.0, 0.0]},
    ]}
    monkeypatch.setattr(ne.urllib.request, "urlopen", lambda *a, **k: _FakeResp(payload))
    vecs = ne.embed_texts(["a", "b"], api_key="nvapi-test")
    assert vecs == [[1.0, 0.0], [0.0, 1.0]]  # réordonné par 'index'


def test_embed_texts_bad_response(monkeypatch):
    monkeypatch.setattr(ne.urllib.request, "urlopen", lambda *a, **k: _FakeResp({"data": []}))
    with pytest.raises(ne.EmbeddingError):
        ne.embed_texts(["a"], api_key="k")


# ── RAGStore : recherche sémantique avec embedder injecté ─────────────────────

_VOCAB = ["buffer", "tampon", "ndvi", "raster", "cadastre"]


def _fake_embed(texts, input_type):
    out = []
    for t in texts:
        tl = t.lower()
        out.append([1.0 if w in tl else 0.0 for w in _VOCAB])
    return out


def _fresh_store(tmp_path):
    s = rs.RAGStore()
    s._index = rs.TFIDFIndex()
    s._embeddings = {}
    s._use_qdrant = False
    s._docs_file = tmp_path / "documents.json"
    s._emb_file = tmp_path / "embeddings.json"
    s._embed_fn = _fake_embed
    return s


def test_semantic_search_ranks_relevant_first(tmp_path):
    s = _fresh_store(tmp_path)
    s.add_document("Créer un buffer de 500m autour des routes", collection="user_notes")
    s.add_document("Calcul du NDVI sur un raster Sentinel", collection="user_notes")

    results = s.search("zone buffer autour d'une couche", top_k=2)
    assert results
    assert "buffer" in results[0].content.lower()
    assert s.stats()["backend"] == "nim-embeddings"
    assert s.stats()["embedded_documents"] == 2


def test_embeddings_persisted(tmp_path):
    s = _fresh_store(tmp_path)
    s.add_document("buffer cadastre", collection="user_notes")
    assert s._emb_file.exists()
    saved = json.loads(s._emb_file.read_text(encoding="utf-8"))
    assert len(saved) == 1


def test_delete_removes_embedding(tmp_path):
    s = _fresh_store(tmp_path)
    ids = s.add_document("buffer ndvi raster", collection="user_notes", auto_chunk=False)
    assert len(s._embeddings) == 1
    assert s.delete_document(ids[0]) is True
    assert len(s._embeddings) == 0


def test_configure_without_key_disables_semantic(tmp_path):
    s = _fresh_store(tmp_path)
    assert s.configure(None) is False
    assert s.semantic_enabled is False
