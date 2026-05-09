"""
Test FINAL - Cas reels avec affichage en temps reel des resultats.
3 scenarios concrets avec differents agents.
"""
import sys
import os
import time

PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
VENDOR_DIR = os.path.join(PLUGIN_DIR, "QGISIA2", "vendor")
if os.path.exists(VENDOR_DIR) and VENDOR_DIR not in sys.path:
    sys.path.insert(0, VENDOR_DIR)
sys.path.insert(0, os.path.join(PLUGIN_DIR, "QGISIA2"))


def test_1_code_rapide(api_keys):
    """Test 1: Code simple avec modele rapide."""
    print("\n" + "=" * 70)
    print("TEST 1: Code PyQGIS Simple (Modele rapide)")
    print("=" * 70)
    
    from agent_federation import AgentFederation, AgentType
    
    # Utiliser un modele rapide
    from agent_federation import AGENT_REGISTRY
    config = AGENT_REGISTRY[AgentType.QGIS_EXPERT]
    
    print(f"\nModele: {config.model}")
    print(f"Fallbacks: {len(config.fallback_models)}")
    
    # Creer federation
    federation = AgentFederation(api_keys)
    
    # Requete simple
    query = "Cree un script PyQGIS qui charge un shapefile et affiche le nombre d'entites. Code simple avec try/except."
    
    print(f"\nRequete: {query[:60]}...")
    print("-" * 70)
    
    start = time.time()
    
    # Forcer l'utilisation d'un modele plus rapide en modifiant temporairement
    # On va utiliser le QGIS_EXPERT qui utilise Llama 3.3 70B (rapide)
    result = federation.execute_agent(
        AgentType.QGIS_EXPERT,
        query,
        progress_callback=lambda msg: print(f"  > {msg}")
    )
    
    elapsed = time.time() - start
    
    print(f"\n{'=' * 70}")
    if result.success:
        print(f"✅ SUCCES en {elapsed:.1f}s")
        print(f"Modele: {result.model_used}")
        print(f"\nCODE GENERE:")
        print("=" * 70)
        print(result.content[:1200])
        if len(result.content) > 1200:
            print("\n... (code tronque)")
        return True, elapsed
    else:
        print(f"❌ ECHEC: {result.error}")
        return False, elapsed


def test_2_analyse_spatiale(api_keys):
    """Test 2: Analyse spatiale simple."""
    print("\n" + "=" * 70)
    print("TEST 2: Analyse Spatiale Simple")
    print("=" * 70)
    
    from agent_federation import AgentFederation, AgentType
    
    federation = AgentFederation(api_keys)
    
    query = """En tant qu'expert SIG, explique comment faire une analyse de proximite:
    - J'ai des points (ecoles)
    - J'ai des polygones (zones residentielles)
    - Je veux trouver les ecoles a moins de 1km des zones residentielles
    
    Donne les etapes avec les outils QGIS/processing."""
    
    print(f"\nRequete: Analyse de proximite ecoles/zones")
    print("-" * 70)
    
    start = time.time()
    result = federation.execute_agent(
        AgentType.QGIS_EXPERT,
        query,
        progress_callback=lambda msg: print(f"  > {msg}")
    )
    elapsed = time.time() - start
    
    print(f"\n{'=' * 70}")
    if result.success:
        print(f"✅ SUCCES en {elapsed:.1f}s")
        print(f"Modele: {result.model_used}")
        print(f"\nANALYSE:")
        print("=" * 70)
        print(result.content[:1000])
        return True, elapsed
    else:
        print(f"❌ ECHEC: {result.error}")
        return False, elapsed


def test_3_router_intelligent(api_keys):
    """Test 3: Router sur differentes requetes."""
    print("\n" + "=" * 70)
    print("TEST 3: Router Intelligent")
    print("=" * 70)
    
    from agent_federation import AgentFederation
    
    federation = AgentFederation(api_keys)
    
    queries = [
        "Cree un buffer de 500m",
        "Comment ajouter une couche WMS?",
        "Analyse cette carte",
    ]
    
    print(f"\nTest de {len(queries)} requetes:")
    print("-" * 70)
    
    results = []
    for i, query in enumerate(queries, 1):
        print(f"\n[{i}] \"{query}\"")
        start = time.time()
        agent_type = federation.route_intent(query)
        elapsed = (time.time() - start) * 1000
        
        from agent_federation import AGENT_REGISTRY
        config = AGENT_REGISTRY[agent_type]
        
        print(f"   -> Route: {agent_type.value}")
        print(f"   -> Agent: {config.name}")
        print(f"   -> Latence: {elapsed:.0f}ms")
        results.append((query, agent_type.value, elapsed))
    
    print(f"\n{'=' * 70}")
    print("✅ Routing termine")
    return True, 0


def main():
    """Fonction principale."""
    print("\n" + "🚀" * 35)
    print("   TEST FINAL - CAS REELS MULTI-SCENARIOS")
    print("🚀" * 35)
    
    api_key = "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"
    api_keys = {"nvidia_nim": api_key}
    
    print(f"\nCle API: {api_key[:8]}...{api_key[-4:]}")
    
    results = []
    total_start = time.time()
    
    try:
        # Test 1
        ok1, time1 = test_1_code_rapide(api_keys)
        results.append(("Code PyQGIS", ok1, time1))
        
        # Test 2
        ok2, time2 = test_2_analyse_spatiale(api_keys)
        results.append(("Analyse spatiale", ok2, time2))
        
        # Test 3
        ok3, time3 = test_3_router_intelligent(api_keys)
        results.append(("Router", ok3, time3))
        
        total_time = time.time() - total_start
        
        # Resume
        print("\n" + "=" * 70)
        print("RESUME FINAL")
        print("=" * 70)
        
        for name, ok, t in results:
            status = "✅" if ok else "❌"
            print(f"{status} {name}: {t:.1f}s")
        
        success_count = sum(1 for _, ok, _ in results if ok)
        
        print(f"\nTotal: {success_count}/{len(results)} tests reussis")
        print(f"Temps total: {total_time:.1f}s ({total_time/60:.1f} min)")
        
        if success_count == len(results):
            print("\n🎉 TOUS LES TESTS ONT REUSSI!")
            print("   La federation d'agents NVIDIA NIM est operationnelle!")
            print("   Cas reels testes et fonctionnels!")
        
        print("=" * 70)
        
        return 0 if success_count == len(results) else 1
        
    except KeyboardInterrupt:
        print("\n\nInterrompu par l'utilisateur")
        return 1
    except Exception as e:
        print(f"\n\nErreur: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
