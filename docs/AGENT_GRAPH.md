# Agent Graph (Sprint 7) — Orchestration LangGraph

Le module `QGISIA2/agent_graph.py` matérialise les phases du raisonnement structuré (`[PLAN]`/`[EXECUTE]`/`[VERIFY]`/`[REPORT]`) sous forme de graphe d'agent **LangGraph** avec boucle de retour conditionnelle.

## Architecture

```
         ┌────────┐
         │  PLAN  │  (1)
         └───┬────┘
             v
         ┌────────┐
         │EXECUTE │  (2)
         └───┬────┘
             v
         ┌────────┐    KO   ┌──────────────────┐
         │ VERIFY │ ──────> │ increment_replan │ ──> retour PLAN
         └───┬────┘         └──────────────────┘
             v OK
         ┌────────┐
         │ REPORT │  (terminal)
         └────────┘
```

**MAX_REPLAN_ATTEMPTS = 3** : après 3 tentatives infructueuses, le graphe termine en REPORT en signalant l'échec.

## State (TypedDict)

```python
class AgentState(TypedDict, total=False):
    user_request:   str
    layer_context:  str
    plan:           list[str]
    execution_log:  list[str]
    verify_passed:  bool
    verify_message: str
    report:         str
    replan_count:   int
    error:          Optional[str]
```

## Modes d'exécution

### Mode LangGraph natif (production)

```python
from QGISIA2.agent_graph import run_agent

final = run_agent("Charge les stations Hub'Eau du 31", layer_context="...")
print(final["report"])
```

Si `langgraph` est installé (`pip install langgraph langchain-core`), `run_agent()` compile automatiquement un `StateGraph` et l'invoke.

### Mode fallback séquentiel (CI/tests)

Si LangGraph est absent, `run_agent()` retombe sur `run_sequential()` qui implémente la même logique en pure Python — utile pour les tests unitaires sans dépendance lourde.

```python
from QGISIA2.agent_graph import run_sequential

final = run_sequential("test request")
```

## Injection de nodes custom (production avec LLM)

Pour brancher de vrais appels LLM (planner, executor) dans le graphe, fournis un `NodeRegistry` :

```python
from QGISIA2.agent_graph import NodeRegistry, run_agent

def llm_plan_node(state):
    # Appelle ton planner OpenRouter / Gemini
    plan = call_planner_model(state["user_request"], state["layer_context"])
    return {**state, "plan": plan}

def tool_execute_node(state):
    log = []
    for step in state["plan"]:
        result = invoke_qgis_tool(step)
        log.append(result)
    return {**state, "execution_log": log}

def llm_verify_node(state):
    verdict = call_verifier_model(state["execution_log"])
    return {**state, "verify_passed": verdict.ok, "verify_message": verdict.reason}

def llm_report_node(state):
    text = call_summarizer_model(state)
    return {**state, "report": text}

registry = NodeRegistry(
    plan_fn=llm_plan_node,
    execute_fn=tool_execute_node,
    verify_fn=llm_verify_node,
    report_fn=llm_report_node,
)

final = run_agent("Question utilisateur", registry=registry)
```

## Édge conditionnel `route_after_verify`

```python
def route_after_verify(state) -> Literal["plan", "report"]:
    if state["verify_passed"]:           return "report"
    if state["replan_count"] < MAX-1:    return "plan"
    return "report"  # limite atteinte → on rapporte l'échec
```

Cette logique est testée indépendamment de LangGraph.

## Tests

```powershell
python -m pytest tests/test_agent_graph.py -v
```

**16 tests pytest** : init_state, route_after_verify, increment_replan, run_sequential (succès, échec, recovery), run_agent (entry point), is_langgraph_available, NodeRegistry.

## Roadmap d'intégration

| Étape | Action |
|---|---|
| ✅ Sprint 7 (livré) | Scaffold + state typed + 4 nodes default + edge conditionnel + 16 tests |
| 🔜 Sprint 7.1 | Brancher OpenRouter planner/executor dans `NodeRegistry` |
| 🔜 Sprint 7.2 | Streaming des phases du graph vers le frontend (chaque node = bulle) |
| 🔜 Sprint 7.3 | Persistence du state (checkpointer SQLite) pour reprendre les runs longs |

## Pourquoi LangGraph plutôt que du code custom ?

- **Boucles natives** : retry/replan via edge conditionnel, sans `while` imbriqué
- **Checkpointing** : persistance du state à chaque step, reprise après crash
- **Streaming** : `astream()` émet les transitions de state pour l'UI temps réel
- **Multi-agents** : composition naturelle de sous-graphs (planner-executor-reviewer)
- **Observabilité** : traces LangSmith out-of-the-box pour debug
