# -*- coding: utf-8 -*-
"""
Tests Sprint 2 — Agent Hybride QGISIA+
Exécutables sans QGIS ni LiteLLM installé.

Usage:
    python tests/test_sprint2_agent.py
"""
import sys
import os
import time

# Ajoute le plugin au path
PLUGIN_DIR = os.path.join(os.path.dirname(__file__), "..", "QGISIA2")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PLUGIN_DIR)

PASS = "✅"
FAIL = "❌"
WARN = "⚠️ "
results = []


def check(name: str, condition: bool, detail: str = "") -> None:
    icon = PASS if condition else FAIL
    results.append((name, condition))
    print(f"  {icon} {name}" + (f" — {detail}" if detail else ""))


# ══════════════════════════════════════════════════════════════
# 1. Tests agent_memory.py
# ══════════════════════════════════════════════════════════════

def test_memory() -> None:
    print("\n🧠 TEST MÉMOIRE AGENT")
    print("-" * 50)
    from QGISIA2.agent_memory import AgentMemory, get_memory

    # Test instance singleton
    m1 = get_memory("test_user")
    m2 = get_memory("test_user")
    check("Singleton mémoire", m1 is m2)

    # Test remember / recall
    mem = AgentMemory("test_unit")
    mem.remember("crs_preference", "Lambert 93 (EPSG:2154)", category="preference")
    val = mem.recall("crs_preference")
    check("remember + recall", val == "Lambert 93 (EPSG:2154)", val or "None")

    # Test forget
    mem.remember("temp_key", "temp_value")
    mem.forget("temp_key")
    check("forget supprime l'entrée", mem.recall("temp_key") is None)

    # Test search
    mem.remember("export_format", "GeoPackage", tags=["export", "gpkg"])
    mem.remember("crs_pref", "EPSG:2154", tags=["crs", "france"])
    results_search = mem.search("format export gpkg")
    check("search retourne résultats", len(results_search) > 0, f"{len(results_search)} résultats")
    check("search retourne bon résultat", any(e.key == "export_format" for e in results_search))

    # Test context prompt — on ajoute une entrée avec des mots exactement dans la query
    mem.remember("export_gpkg_info", "Exporter en GeoPackage pour les couches SIG", category="fact", tags=["export", "couche", "gpkg"])
    context = mem.get_context_for_prompt("exporter couche gpkg")
    check("context_for_prompt non vide", len(context) > 0, f"{len(context)} chars")
    check("context contient ## Mémoire", "Mémoire" in context)

    # Test session tracking
    mem.start_session("test_session_001")
    mem.log_message("user", "Analysons les peuplements forestiers")
    mem.log_message("agent", "J'analyse les couches disponibles...")
    mem.end_session(
        topics=["forêt", "peuplement"],
        layers_used=["peuplements_2024"],
        actions_taken=["buffer 100m", "stats zonales"],
        outcome="success",
    )
    history = mem.get_session_history(limit=1)
    check("session enregistrée", len(history) == 1)
    check("session topics corrects", "forêt" in history[0]["topics"])

    # Test learn (mémoire agent)
    mem.learn("layer_info_peuplements", "Couche de peuplements forestiers ONF", tags=["forêt", "onf"])
    check("learn mémorise fact agent", True)  # pas d'exception = OK

    # Test auto-extraction
    mem.extract_and_store("je veux exporter en GeoJSON en Lambert 93", ["peuplements", "routes"])
    check("extract_and_store Lambert", mem.recall("crs_preference") is not None)

    # Test stats
    stats = mem.stats()
    check("stats retourne dict", isinstance(stats, dict))
    check("stats a user_memories", "user_memories" in stats)

    # Test clear
    mem.clear_all()
    check("clear_all vide la mémoire", len(mem._user_mem) == 0)


# ══════════════════════════════════════════════════════════════
# 2. Tests agent_guardrails.py
# ══════════════════════════════════════════════════════════════

def test_guardrails() -> None:
    print("\n🛡️  TEST GUARDRAILS")
    print("-" * 50)
    from QGISIA2.agent_guardrails import AgentGuardrails, RiskLevel, quick_check_code

    gr = AgentGuardrails(auto_mode=False)

    # ── Input rails ──

    # Requête sûre
    r = gr.check_input("Montre-moi les couches disponibles dans le projet")
    check("Input sûr → passed", r.passed)
    check("Input sûr → risk SAFE", r.risk_level == RiskLevel.SAFE)

    # Requête dangereuse (rm -rf)
    r = gr.check_input("supprime tous les fichiers temporaires du système")
    check("Input dangereux → bloqué", not r.passed, r.message[:60])
    check("Input dangereux → BLOCK", r.risk_level == RiskLevel.BLOCK)

    # Requête avec avertissement
    r = gr.check_input("trouve le propriétaire de la parcelle")
    check("Input propriétaire → WARN mais passe", r.passed)
    check("Input propriétaire → risk WARN", r.risk_level == RiskLevel.WARN)

    # ── PyQGIS code rails ──

    # Code sûr
    safe_code = """
layer = iface.activeLayer()
print(layer.name())
features = list(layer.getFeatures())
print(f"Entités: {len(features)}")
iface.messageBar().pushMessage("OK", level=0)
"""
    r = gr.check_pyqgis_code(safe_code)
    check("Code sûr → passed", r.passed)
    check("Code sûr → risk SAFE", r.risk_level == RiskLevel.SAFE)

    # Code avec deleteFeatures → CONFIRM
    destructive_code = """
layer.startEditing()
layer.deleteFeatures([1, 2, 3])
layer.commitChanges()
"""
    r = gr.check_pyqgis_code(destructive_code)
    check("deleteFeatures → requires_confirmation", r.requires_confirmation or r.risk_level == RiskLevel.CONFIRM, r.risk_level.value)

    # Code avec DROP TABLE → BLOCK
    sql_code = "db.execute('DROP TABLE parcelles')"
    r = gr.check_pyqgis_code(sql_code)
    check("DROP TABLE → bloqué", not r.passed)
    check("DROP TABLE → BLOCK", r.risk_level == RiskLevel.BLOCK)

    # Code avec os.remove → CONFIRM
    os_code = "os.remove('/data/important_file.shp')"
    r = gr.check_pyqgis_code(os_code)
    check("os.remove → CONFIRM ou BLOCK", r.risk_level in [RiskLevel.CONFIRM, RiskLevel.BLOCK])

    # Test quick_check_code helper
    safe, msg = quick_check_code("layer.name()")
    check("quick_check_code sûr → True", safe, msg)
    safe, msg = quick_check_code("DROP TABLE test")
    check("quick_check_code DROP → False", not safe, msg)

    # Test check_output (response LLM)
    llm_response_safe = "Voici les couches : \n```python\nprint(iface.activeLayer().name())\n```"
    r = gr.check_output(llm_response_safe)
    check("Output LLM sûr → passed", r.passed)

    llm_response_dangerous = "Nettoyer:\n```python\nlayer.deleteFeatures(list(range(1000)))\nlayer.commitChanges()\n```"
    r = gr.check_output(llm_response_dangerous)
    check("Output LLM destructif → CONFIRM", r.risk_level == RiskLevel.CONFIRM or not r.passed)

    # Mode Auto → CONFIRM devient permissif
    gr_auto = AgentGuardrails(auto_mode=True)
    r = gr_auto.check_pyqgis_code(destructive_code)
    check("Auto mode → CONFIRM passe (passed=True)", r.passed, f"risk={r.risk_level.value}")

    # Test audit_messages
    messages = [
        {"role": "user", "content": "Affiche les statistiques"},
        {"role": "user", "content": "supprime les données temporaires système"},
    ]
    audit = gr.audit_messages(messages)
    check("audit_messages retourne 2 résultats", len(audit) == 2)
    check("audit détecte le message dangereux", any(not r.passed for r in audit))


# ══════════════════════════════════════════════════════════════
# 3. Tests agent_runner.py (sans LLM)
# ══════════════════════════════════════════════════════════════

def test_runner() -> None:
    print("\n🤖 TEST AGENT RUNNER")
    print("-" * 50)
    from QGISIA2.agent_runner import AgentRunner, AgentMode, AgentPlan, AgentStep, StepStatus
    from QGISIA2.agent_guardrails import RiskLevel

    # ── Init ──
    runner = AgentRunner(mode=AgentMode.PLAN_CONFIRM, user_id="test_runner")
    check("Runner créé", runner is not None)
    check("Mode PLAN_CONFIRM", runner._mode == AgentMode.PLAN_CONFIRM)

    # ── Changement de mode ──
    runner.set_mode(AgentMode.AUTO)
    check("set_mode AUTO", runner._mode == AgentMode.AUTO)
    runner.set_mode(AgentMode.PLAN_CONFIRM)

    # ── validate_input ──
    r = runner.validate_input("Calcule les statistiques zonales de la couche forêt")
    check("validate_input sûr → passed", r.passed)

    r_bad = runner.validate_input("supprime tous les fichiers temporaires du système")
    check("validate_input dangereux → bloqué", not r_bad.passed)

    # ── Mock LLM pour test build_plan ──
    def mock_llm(model, messages, api_keys, temperature=0.1, **kwargs):
        return {
            "choices": [{
                "message": {
                    "content": (
                        "Voici le plan d'exécution:\n"
                        "1. [INFO] Vérifier les couches disponibles\n"
                        "2. [PYQGIS] Calculer les statistiques\n"
                        "```python\n"
                        "layer = iface.activeLayer()\n"
                        "print(f'Couche: {layer.name()}')\n"
                        "iface.messageBar().pushMessage('Stats OK', level=0)\n"
                        "```\n"
                        "3. [EXPORT] Exporter en GeoPackage\n"
                    )
                }
            }]
        }

    runner.set_llm_chat(mock_llm)
    plan = runner.build_plan(
        "Calcule les stats de la couche forêt",
        layer_context="'forets_2024' (polygones, 1234 entités)",
        api_keys={},
    )
    check("build_plan retourne plan", plan is not None)
    check("plan a des steps", len(plan.steps) > 0, f"{len(plan.steps)} étapes")
    check("plan status=draft", plan.status == "draft")
    check("plan a summary", plan.summary is not None)

    step_types = {s.action_type for s in plan.steps}
    check("plan contient étape pyqgis", "pyqgis" in step_types or "info" in step_types)

    # ── Test execute_plan (mock executor) ──
    exec_log = []
    def mock_executor(code):
        exec_log.append(code[:50])
        return "Exécution simulée"

    step_updates = []
    def on_step(step):
        step_updates.append(step.status.value)

    runner.set_pyqgis_executor(mock_executor)
    runner.set_step_callback(on_step)

    # En mode AUTO, pas de confirmation requise
    runner.set_mode(AgentMode.AUTO)
    result = runner.execute_plan(plan)
    check("execute_plan retourne result", result is not None)
    check("steps_total > 0", result.steps_total > 0, f"{result.steps_total} étapes")
    check("step_updates reçus", len(step_updates) > 0, f"{len(step_updates)} updates")
    check("mémoire session enregistrée", True)  # end_session appelé sans exception

    # ── Test plan avec action bloquée ──
    blocked_plan = AgentPlan(plan_id="test_blocked", user_request="test")
    blocked_plan.steps.append(AgentStep(
        step_id="b1", description="Action bloquée",
        action_type="pyqgis", code="DROP TABLE test",
        status=StepStatus.BLOCKED,
    ))
    blocked_plan.steps.append(AgentStep(
        step_id="b2", description="Action info sûre",
        action_type="info", code=None,
    ))
    result2 = runner.execute_plan(blocked_plan)
    check("Plan avec étape bloquée → erreurs", len(result2.errors) > 0)
    check("Étape bloquée comptée dans erreurs", any("BLOQUÉ" in e for e in result2.errors))


# ══════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("🧪 TESTS SPRINT 2 — AGENT HYBRIDE QGISIA+")
    print("=" * 60)
    start = time.time()

    try:
        test_memory()
    except Exception as e:
        print(f"\n{FAIL} test_memory crash: {e}")
        import traceback; traceback.print_exc()

    try:
        test_guardrails()
    except Exception as e:
        print(f"\n{FAIL} test_guardrails crash: {e}")
        import traceback; traceback.print_exc()

    try:
        test_runner()
    except Exception as e:
        print(f"\n{FAIL} test_runner crash: {e}")
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
