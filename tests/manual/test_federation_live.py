"""
Test EN CONDITIONS REELLES de la Federation d'Agents NVIDIA NIM.
Utilise de vrais appels API avec votre cle.
"""
import sys
import os
import json
import time

# Setup path
PLUGIN_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VENDOR_DIR = os.path.join(PLUGIN_DIR, "QGISIA2", "vendor")
if os.path.exists(VENDOR_DIR) and VENDOR_DIR not in sys.path:
    sys.path.insert(0, VENDOR_DIR)

sys.path.insert(0, os.path.join(PLUGIN_DIR, "QGISIA2"))


def test_scenario_1_code_generation(api_keys):
    """Scenario 1: Generation de code PyQGIS simple."""
    print("\n" + "=" * 70)
    print("SCENARIO 1: Generation de code PyQGIS")
    print("=" * 70)
    
    from agent_federation import AgentFederation, AgentType
    
    federation = AgentFederation(api_keys)
    
    query = "Cree un script PyQGIS qui charge un shapefile, cree un buffer de 500m, et sauvegarde le resultat"
    
    print(f"\nRequete: {query}")
    print("-" * 70)
    
    logs = []
    def progress(msg):
        logs.append(msg)
        print(f"  [{len(logs)}] {msg}")
    
    start = time.time()
    result = federation.process(query, auto_route=True, progress_callback=progress)
    elapsed = time.time() - start
    
    print(f"\n{'=' * 70}")
    print(f"RESULTAT (en {elapsed:.1f}s):")
    print(f"{'=' * 70}")
    print(f"Routing: {result.get('routing')}")
    
    if result.get('agent_results'):
        agent_result = result['agent_results'][0]
        if agent_result.success:
            print(f"\nModele utilise: {agent_result.model_used}")
            print(f"Latence: {agent_result.latency_ms:.0f}ms")
            print(f"\nCode genere:")
            print("-" * 70)
            code = agent_result.content[:1500]
            print(code + "..." if len(agent_result.content) > 1500 else code)
        else:
            print(f"\nERREUR: {agent_result.error}")
    
    return result.get('agent_results', [{}])[0].success if result.get('agent_results') else False


def test_scenario_2_routing(api_keys):
    """Scenario 2: Test du routing sur differentes requetes."""
    print("\n" + "=" * 70)
    print("SCENARIO 2: Test du Intent Router")
    print("=" * 70)
    
    from agent_federation import AgentFederation, AgentType
    
    federation = AgentFederation(api_keys)
    
    test_queries = [
        "Cree un buffer de 500m autour des ecoles",
        "Analyse cette carte IGN et dis-moi ce que tu vois",
        "Quelle est la meilleure localisation pour un parc?",
        "Traduis cette documentation GDAL en francais",
        "Comment ajouter une couche WMS dans QGIS?",
    ]
    
    print(f"\nTest de {len(test_queries)} requetes:")
    print("-" * 70)
    
    results = []
    for i, query in enumerate(test_queries, 1):
        print(f"\n[{i}/{len(test_queries)}] \"{query[:50]}...\"")
        
        start = time.time()
        agent_type = federation.route_intent(query)
        elapsed = (time.time() - start) * 1000
        
        from agent_federation import AGENT_REGISTRY
        config = AGENT_REGISTRY[agent_type]
        
        print(f"  -> Route vers: {agent_type.value}")
        print(f"  -> Agent: {config.name}")
        print(f"  -> Modele: {config.model.split('/')[-1]}")
        print(f"  -> Latence routing: {elapsed:.0f}ms")
        
        results.append({
            "query": query,
            "routed_to": agent_type.value,
            "model": config.model,
            "latency_ms": elapsed
        })
    
    return True


def test_scenario_3_workflow_simple(api_keys):
    """Scenario 3: Workflow simple avec safety check."""
    print("\n" + "=" * 70)
    print("SCENARIO 3: Workflow avec Safety Guard")
    print("=" * 70)
    
    from agent_workflows import WorkflowEngine, WorkflowType
    from agent_federation import AgentFederation
    
    federation = AgentFederation(api_keys)
    engine = WorkflowEngine(federation)
    
    query = "Cree un script qui charge une couche vecteur et calcule sa surface en hectares"
    
    print(f"\nRequete: {query}")
    print(f"Workflow: {WorkflowType.CODE_FROM_DESCRIPTION.value}")
    print("-" * 70)
    
    logs = []
    def progress(msg):
        logs.append(msg)
        print(f"  [{len(logs)}] {msg}")
    
    start = time.time()
    result = engine.execute(
        WorkflowType.CODE_FROM_DESCRIPTION,
        query,
        progress_callback=progress
    )
    elapsed = time.time() - start
    
    print(f"\n{'=' * 70}")
    print(f"RESULTAT (en {elapsed:.1f}s):")
    print(f"{'=' * 70}")
    print(f"Workflow: {result.get('workflow_type')}")
    print(f"Success: {result.get('success')}")
    print(f"Etapes executees: {len(result.get('steps', []))}")
    
    for step in result.get('steps', []):
        print(f"  - {step.get('name')}: {step.get('agent')} ({step.get('latency_ms', 0):.0f}ms)")
    
    if result.get('context', {}).get('code'):
        print(f"\nCode genere:")
        print("-" * 70)
        code = result['context']['code'][:1000]
        print(code + "..." if len(result['context']['code']) > 1000 else code)
    
    return result.get('success', False)


def test_scenario_4_multi_agent(api_keys):
    """Scenario 4: Execution parallele de plusieurs agents."""
    print("\n" + "=" * 70)
    print("SCENARIO 4: Multi-Agents en Parallele")
    print("=" * 70)
    
    from agent_workflows import WorkflowEngine
    from agent_federation import AgentFederation, AgentType
    
    federation = AgentFederation(api_keys)
    engine = WorkflowEngine(federation)
    
    query = "Analyse les besoins pour un projet SIG simple"
    agents = [AgentType.QGIS_EXPERT, AgentType.REASONING]
    
    print(f"\nRequete: {query}")
    print(f"Agents: {[a.value for a in agents]}")
    print("-" * 70)
    
    start = time.time()
    result = engine.execute_parallel(agents, query)
    elapsed = time.time() - start
    
    print(f"\n{'=' * 70}")
    print(f"RESULTAT (en {elapsed:.1f}s):")
    print(f"{'=' * 70}")
    
    for agent_type, data in result.get('parallel_results', {}).items():
        status = "OK" if data.get('success') else "FAIL"
        print(f"\n[{status}] {agent_type}")
        print(f"  Modele: {data.get('model', 'N/A')}")
        print(f"  Latence: {data.get('latency_ms', 0):.0f}ms")
        print(f"  Preview: {data.get('content', '')[:100]}...")
    
    if result.get('synthesis'):
        print(f"\nSynthese:")
        print("-" * 70)
        print(result['synthesis'][:500])
    
    return result.get('success', False)


def test_catalog_nvidia(api_keys):
    """Test du catalogue de modeles."""
    print("\n" + "=" * 70)
    print("SCENARIO 5: Catalogue NVIDIA NIM")
    print("=" * 70)
    
    try:
        import json
        with open("QGISIA2/config/models.json", "r", encoding="utf-8") as f:
            config = json.load(f)
        
        catalog = config.get("nvidia_nim_catalog", {})
        
        print(f"\nCatalogue charge:")
        print(f"  Total modeles: {catalog.get('total_models', 0)}")
        print(f"  API Endpoint: {catalog.get('base_url')}")
        print(f"  Mise a jour: {catalog.get('updated_at')}")
        
        models = catalog.get("models", {})
        
        print(f"\nCategories:")
        for category, data in models.items():
            if isinstance(data, dict):
                count = sum(len(v) for v in data.values() if isinstance(v, list))
                print(f"  - {category}: {count} modeles")
            elif isinstance(data, list):
                print(f"  - {category}: {len(data)} modeles")
        
        return True
    except Exception as e:
        print(f"Erreur: {e}")
        return False


def main():
    """Fonction principale de test."""
    print("\n" + "🚀" * 35)
    print("   TEST EN CONDITIONS REELLES - FEDERATION D'AGENTS")
    print("🚀" * 35)
    
    # Recuperer la cle API
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
    else:
        api_key = os.environ.get("NVIDIA_API_KEY")
    
    if not api_key:
        print("\nUsage: python test_federation_live.py <NVIDIA_API_KEY>")
        print("   ou: set NVIDIA_API_KEY=votre_cle && python test_federation_live.py")
        print("\nTest avec la derniere cle utilisee: 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")
        api_key = "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"
    
    print(f"\nCle API: {api_key[:8]}...{api_key[-4:]}")
    
    api_keys = {"nvidia_nim": api_key}
    
    # Verifier vendor
    print("\nVerification de l'environnement...")
    try:
        from llm_installer import is_vendor_ready
        if not is_vendor_ready():
            print("  ⚠️  Vendor non pret - certains tests peuvent echouer")
        else:
            print("  ✅ Vendor pret")
    except Exception as e:
        print(f"  ⚠️  Erreur vendor check: {e}")
    
    # Execution des scenarios
    results = []
    
    try:
        results.append(("Catalogue NVIDIA", test_catalog_nvidia(api_keys)))
    except Exception as e:
        print(f"\n❌ Erreur scenario catalogue: {e}")
        results.append(("Catalogue NVIDIA", False))
    
    try:
        results.append(("Routing", test_scenario_2_routing(api_keys)))
    except Exception as e:
        print(f"\n❌ Erreur scenario routing: {e}")
        results.append(("Routing", False))
    
    try:
        results.append(("Code Generation", test_scenario_1_code_generation(api_keys)))
    except Exception as e:
        print(f"\n❌ Erreur scenario code: {e}")
        results.append(("Code Generation", False))
    
    try:
        results.append(("Workflow Safety", test_scenario_3_workflow_simple(api_keys)))
    except Exception as e:
        print(f"\n❌ Erreur scenario workflow: {e}")
        results.append(("Workflow Safety", False))
    
    try:
        results.append(("Multi-Agent", test_scenario_4_multi_agent(api_keys)))
    except Exception as e:
        print(f"\n❌ Erreur scenario multi-agent: {e}")
        results.append(("Multi-Agent", False))
    
    # Resume
    print("\n" + "=" * 70)
    print("RESUME DES TESTS EN CONDITIONS REELLES")
    print("=" * 70)
    
    for name, ok in results:
        status = "✅" if ok else "❌"
        print(f"{status} {name}")
    
    success_count = sum(1 for _, ok in results if ok)
    total_count = len(results)
    
    print(f"\nTotal: {success_count}/{total_count} scenarios reussis")
    
    if success_count == total_count:
        print("\n🎉 Tous les tests ont reussi!")
        print("   La federation d'agents fonctionne en conditions reelles.")
    elif success_count > 0:
        print(f"\n⚠️  {total_count - success_count} scenario(s) ont echoue.")
        print("   Verifiez la connexion internet et la validite de la cle API.")
    else:
        print("\n❌ Tous les tests ont echoue.")
        print("   Problemes possibles:")
        print("   - Cle API invalide ou expiree")
        print("   - Probleme de connexion a l'API NVIDIA")
        print("   - Vendor non installe")
    
    return 0 if success_count > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
