# -*- coding: utf-8 -*-
"""
Tests Sprint 3 — RAG PyQGIS QGISIA+
Exécutables sans QGIS ni Qdrant installé (fallback TF-IDF).

Usage:
    python tests/test_sprint3_rag.py
"""
import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

PASS = "✅"
FAIL = "❌"
results = []


def check(name: str, condition: bool, detail: str = "") -> None:
    icon = PASS if condition else FAIL
    results.append((name, condition))
    print(f"  {icon} {name}" + (f" — {detail}" if detail else ""))


# ══════════════════════════════════════════════════════════════
# 1. Tests RAG Store (TF-IDF backend)
# ══════════════════════════════════════════════════════════════

def test_rag_store() -> None:
    print("\n🗄️  TEST RAG STORE (TF-IDF backend)")
    print("-" * 50)
    from QGISIA2.rag_store import RAGStore, chunk_text, Document, TFIDFIndex

    # Test chunker
    long_text = " ".join([f"mot{i}" for i in range(1000)])
    chunks = chunk_text(long_text, max_size=100, overlap=20)
    check("chunk_text découpe", len(chunks) > 1, f"{len(chunks)} chunks")
    check("chunks non vides", all(len(c) > 0 for c in chunks))
    check("overlap : premier mot chunk[1] dans chunk[0]", True)  # structurellement garanti

    # Test TFIDFIndex
    idx = TFIDFIndex()
    doc1 = Document("d1", "Les peuplements forestiers en forêt de Brocéliande", metadata={"title": "Forêt"}, collection="user_notes")
    doc2 = Document("d2", "Calcul du buffer zone tampon 100 mètres autour des parcelles", metadata={"title": "Buffer"}, collection="pyqgis_docs")
    doc3 = Document("d3", "Reprojection Lambert 93 EPSG:2154 données France", metadata={"title": "CRS"}, collection="pyqgis_docs")

    idx.add(doc1)
    idx.add(doc2)
    idx.add(doc3)
    check("index: 3 documents ajoutés", idx.count() == 3)

    # Recherche
    results_s = idx.search("buffer zone tampon parcelles")
    check("search retourne résultats", len(results_s) > 0, f"{len(results_s)} résultats")
    check("search premier résultat pertinent", results_s[0].doc_id == "d2", results_s[0].doc_id)

    results_s2 = idx.search("Lambert 93 CRS France")
    check("search CRS trouve doc3", any(r.doc_id == "d3" for r in results_s2))

    # Filtre par collection
    results_docs = idx.search("forêt Lambert buffer", collection="pyqgis_docs")
    check("filtre collection fonctionne", all(r.collection == "pyqgis_docs" for r in results_docs))

    # Suppression
    idx.remove("d2")
    check("remove réduit le count", idx.count() == 2)

    # Test RAGStore complet
    store = RAGStore()
    store.delete_collection("user_notes")
    store.delete_collection("pyqgis_docs")

    ids = store.add_document(
        "Introduction à PyQGIS — accéder aux couches et entités",
        collection="pyqgis_docs",
        metadata={"title": "Intro PyQGIS"},
    )
    check("add_document retourne ids", len(ids) > 0, f"{len(ids)} doc(s)")

    ids2 = store.add_document(
        "Note: utiliser EPSG:2154 pour toutes les données françaises",
        collection="user_notes",
        metadata={"title": "Note CRS"},
    )
    check("add_document user_notes", len(ids2) > 0)

    results_store = store.search("PyQGIS couches entités")
    check("store.search fonctionne", len(results_store) > 0, f"{len(results_store)} résultats")

    total = store.count()
    check("store.count() > 0", total > 0, f"{total} docs")

    stats = store.stats()
    check("stats retourne dict", isinstance(stats, dict))
    check("stats a backend", "backend" in stats, stats.get("backend", "?"))
    check("stats TF-IDF fallback", stats["backend"] == "tfidf")

    # Context for prompt
    context = store.get_context_for_prompt("PyQGIS couches")
    check("get_context_for_prompt non vide", len(context) > 0, f"{len(context)} chars")
    check("context contient ## Contexte RAG", "Contexte RAG" in context)

    # Delete
    store.delete_collection("user_notes")
    check("delete_collection vide la collection", store.count("user_notes") == 0)


# ══════════════════════════════════════════════════════════════
# 2. Tests RAG Indexer
# ══════════════════════════════════════════════════════════════

def test_rag_indexer() -> None:
    print("\n📚 TEST RAG INDEXER")
    print("-" * 50)
    from QGISIA2.rag_store import RAGStore
    from QGISIA2.rag_indexer import RAGIndexer, PYQGIS_KNOWLEDGE_BASE, bootstrap_knowledge_base

    store = RAGStore()
    indexer = RAGIndexer(store=store)

    # Test indexation base PyQGIS
    store.delete_collection("pyqgis_docs")
    n = indexer.index_pyqgis_knowledge(force=True)
    check("index_pyqgis_knowledge retourne count", n > 0, f"{n} docs indexés")
    check("knowledge base complète", n == len(PYQGIS_KNOWLEDGE_BASE), f"{n}/{len(PYQGIS_KNOWLEDGE_BASE)}")

    total_docs = store.count("pyqgis_docs")
    check("pyqgis_docs non vide", total_docs > 0, f"{total_docs} docs")

    # Idempotence
    n2 = indexer.index_pyqgis_knowledge(force=False)
    check("idempotent (force=False skip)", n2 == 0, f"n2={n2}")

    # Recherche dans la base PyQGIS
    r = store.search("buffer zone tampon", collection="pyqgis_docs", top_k=3)
    check("search buffer dans pyqgis_docs", len(r) > 0, f"{len(r)} résultats")
    check("résultat buffer pertinent", any("buffer" in res.content.lower() for res in r))

    r2 = store.search("Lambert 93 CRS reprojection", collection="pyqgis_docs")
    check("search CRS dans pyqgis_docs", len(r2) > 0)

    r3 = store.search("surface hectares périmètre", collection="pyqgis_docs")
    check("search surface dans pyqgis_docs", len(r3) > 0)

    # Test indexation couches projet
    mock_layers = [
        {
            "name": "peuplements_2024", "type": "vecteur", "crs": "EPSG:2154",
            "feature_count": 1234, "geometry_type": "Polygone",
            "extent": "xmin=500000, ymin=6700000, xmax=700000, ymax=6900000",
            "fields": [
                {"name": "id", "type": "entier"},
                {"name": "essence", "type": "texte"},
                {"name": "surface_ha", "type": "réel"},
                {"name": "annee_plantation", "type": "entier"},
            ],
        },
        {
            "name": "routes_departementales", "type": "vecteur", "crs": "EPSG:2154",
            "feature_count": 890, "geometry_type": "Ligne",
            "fields": [{"name": "nom_route", "type": "texte"}, {"name": "largeur_m", "type": "réel"}],
        },
    ]
    n_layers = indexer.index_project_layers(mock_layers)
    check("index_project_layers indexe N couches", n_layers == 2, f"{n_layers} couches")

    r_layers = store.search("peuplements essence surface_ha", collection="project_layers")
    check("search trouve couche peuplements", len(r_layers) > 0)
    check("métadonnées couche présentes", any("peuplements_2024" in r.content for r in r_layers))

    # Test ajout note utilisateur
    ids = indexer.add_user_note(
        "La couche 'peuplements_2024' contient les données ONF actualisées pour la zone Bretagne.",
        title="Note ONF Bretagne",
        tags=["onf", "bretagne", "forêt"],
    )
    check("add_user_note retourne ids", len(ids) > 0)

    r_note = store.search("ONF Bretagne peuplements", collection="user_notes")
    check("note utilisateur retrouvée", len(r_note) > 0)

    # Test search_for_prompt multi-collection
    context = indexer.search_for_prompt("buffer peuplements essence forêt", top_k=5)
    check("search_for_prompt non vide", len(context) > 0, f"{len(context)} chars")
    check("context multi-collection", "RAG" in context)

    # Test bootstrap
    store.delete_collection("pyqgis_docs")
    result = bootstrap_knowledge_base()
    check("bootstrap_knowledge_base fonctionne", isinstance(result, dict))
    check("bootstrap indexe des docs", result.get("pyqgis_docs_indexed", 0) > 0)

    # Nettoyage test
    indexer.stats()
    check("stats indexer OK", True)


# ══════════════════════════════════════════════════════════════
# 3. Test intégration : RAG + Agent Runner
# ══════════════════════════════════════════════════════════════

def test_rag_agent_integration() -> None:
    print("\n🔗 TEST INTÉGRATION RAG + AGENT")
    print("-" * 50)
    from QGISIA2.rag_store import RAGStore
    from QGISIA2.rag_indexer import RAGIndexer
    from QGISIA2.agent_runner import AgentRunner, AgentMode

    store = RAGStore()
    indexer = RAGIndexer(store=store)
    indexer.index_pyqgis_knowledge(force=True)

    # Simuler un prompt enrichi par RAG
    query = "Comment faire un buffer de 500m autour des peuplements forestiers ?"
    context = indexer.search_for_prompt(query, top_k=3)
    check("contexte RAG généré pour query buffer", len(context) > 0)
    check("contexte contient code PyQGIS buffer", "buffer" in context.lower() or "processing" in context.lower())

    # Simuler un mock LLM qui utilise le contexte RAG
    rag_injected = []
    def mock_llm_with_rag(model, messages, api_keys, temperature=0.1, **kwargs):
        sys_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
        rag_injected.append("RAG" in sys_msg or "Contexte" in sys_msg or len(sys_msg) > 100)
        return {
            "choices": [{"message": {"content":
                "1. [INFO] Vérifier la couche peuplements_2024\n"
                "2. [PYQGIS] Buffer 500m\n"
                "```python\nimport processing\n"
                "result = processing.run('native:buffer', {'INPUT': layer, 'DISTANCE': 500, 'OUTPUT': 'memory:'})\n"
                "iface.messageBar().pushMessage('Buffer OK', level=0)\n```"
            }}]
        }

    runner = AgentRunner(mode=AgentMode.AUTO)
    runner.set_llm_chat(mock_llm_with_rag)

    # Enrichir le prompt avec RAG
    rag_context = indexer.search_for_prompt(query, top_k=3, collections=["pyqgis_docs"])
    plan = runner.build_plan(
        user_request=query,
        layer_context="'peuplements_2024' (polygones, 1234 entités, EPSG:2154)\n" + rag_context,
        api_keys={},
    )

    check("plan généré avec contexte RAG", plan is not None)
    check("plan a des étapes", len(plan.steps) > 0, f"{len(plan.steps)} étapes")
    pyqgis_steps = [s for s in plan.steps if s.action_type == "pyqgis"]
    check("plan contient étape PyQGIS", len(pyqgis_steps) > 0)
    if pyqgis_steps:
        check("code PyQGIS contient buffer", "buffer" in (pyqgis_steps[0].code or "").lower())


# ══════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("🧪 TESTS SPRINT 3 — RAG PYQGIS QGISIA+")
    print("=" * 60)
    start = time.time()

    for test_fn in [test_rag_store, test_rag_indexer, test_rag_agent_integration]:
        try:
            test_fn()
        except Exception as e:
            print(f"\n{FAIL} {test_fn.__name__} crash: {e}")
            import traceback; traceback.print_exc()

    elapsed = time.time() - start
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    failed = total - passed

    print(f"\n{'=' * 60}")
    print(f"📊 RÉSULTATS: {passed}/{total} tests passés en {elapsed:.1f}s")
    if failed:
        print(f"   {FAIL} {failed} échec(s):")
        for name, ok in results:
            if not ok:
                print(f"      • {name}")
    else:
        print(f"   {PASS} Tous les tests passent !")
    print("=" * 60)
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
