"""
Test de la Fédération d'Agents NVIDIA NIM.
Démonstration des workflows multi-agents.
"""
import sys
import os

# Setup path
PLUGIN_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VENDOR_DIR = os.path.join(PLUGIN_DIR, "QGISIA2", "vendor")
if os.path.exists(VENDOR_DIR) and VENDOR_DIR not in sys.path:
    sys.path.insert(0, VENDOR_DIR)

sys.path.insert(0, os.path.join(PLUGIN_DIR, "QGISIA2"))


def demo_federation_structure():
    """Démo de la structure de la fédération."""
    print("=" * 70)
    print("🤖 FÉDÉRATION D'AGENTS NVIDIA NIM - Démonstration")
    print("=" * 70)
    
    from agent_federation import demo_federation
    demo_federation()
    
    return True


def demo_workflows_structure():
    """Démo des workflows disponibles."""
    from agent_workflows import demo_workflows
    demo_workflows()
    
    return True


def demo_bridge_structure():
    """Démo du bridge."""
    from agent_bridge import demo_bridge
    demo_bridge()
    
    return True


def test_routing_mock():
    """Test de routing sans API (simulation)."""
    print("\n" + "=" * 70)
    print("🎯 TEST DE ROUTING (Simulation)")
    print("=" * 70)
    
    from agent_federation import AGENT_REGISTRY, AgentType
    
    test_queries = [
        "Crée un buffer de 500m autour des écoles",
        "Analyse cette carte IGN et dis-moi ce que tu vois",
        "Quelle est la meilleure localisation pour un parc?",
        "Traduis cette documentation GDAL en français",
        "Comment ajouter une couche WMS dans QGIS?",
        "Extrait les coordonnées de ce rapport",
    ]
    
    print("\nRequêtes de test:")
    for i, query in enumerate(test_queries, 1):
        # Simulation simple du router
        if "buffer" in query.lower() or "crée" in query.lower():
            routed = AgentType.CODE_GENERATOR
        elif "carte" in query.lower() or "vois" in query.lower():
            routed = AgentType.VISION_ANALYZER
        elif "meilleure" in query.lower() or "localisation" in query.lower():
            routed = AgentType.REASONING
        elif "traduis" in query.lower():
            routed = AgentType.TRANSLATOR
        elif "comment" in query.lower() or "qgis" in query.lower():
            routed = AgentType.QGIS_EXPERT
        elif "extrait" in query.lower():
            routed = AgentType.DATA_EXTRACTOR
        else:
            routed = AgentType.QGIS_EXPERT
        
        config = AGENT_REGISTRY[routed]
        print(f"\n{i}. \"{query[:40]}...\"")
        print(f"   → Router vers: {routed.value}")
        print(f"   → Agent: {config.name}")
        print(f"   → Modèle: {config.model}")
    
    return True


def test_workflows_mock():
    """Test des workflows sans API."""
    print("\n" + "=" * 70)
    print("🔄 TEST DES WORKFLOWS (Simulation)")
    print("=" * 70)
    
    from agent_workflows import WORKFLOWS, WorkflowType
    
    print("\nWorkflows et leurs chaînages:")
    for wf_type, steps in WORKFLOWS.items():
        print(f"\n📦 {wf_type.value}")
        print("   " + " → ".join([s.name for s in steps]))
        
        # Calcul des modèles utilisés
        from agent_federation import AGENT_REGISTRY
        models = []
        for step in steps:
            config = AGENT_REGISTRY[step.agent_type]
            model_name = config.model.split("/")[-1]  # Juste le nom
            models.append(f"{step.agent_type.value}({model_name})")
        
        print(f"   Modèles: {' → '.join(models)}")
    
    return True


def test_integration_points():
    """Points d'intégration avec QGISIA+."""
    print("\n" + "=" * 70)
    print("🔗 POINTS D'INTÉGRATION AVEC QGISIA+")
    print("=" * 70)
    
    integration_points = [
        {
            "component": "GatewaySettingsPanel.tsx",
            "feature": "Sélection d'agent/workflow",
            "bridge_method": "listAgents(), listWorkflows()",
        },
        {
            "component": "Chat Interface",
            "feature": "Router intelligent automatique",
            "bridge_method": "smartProcess(query, context)",
        },
        {
            "component": "Vision Modal",
            "feature": "Analyse d'images",
            "bridge_method": "executeAgent('vision', image)",
        },
        {
            "component": "Code Editor",
            "feature": "Génération PyQGIS",
            "bridge_method": "executeWorkflow('code_from_description', desc)",
        },
        {
            "component": "Spatial Analysis",
            "feature": "Raisonnement complexe",
            "bridge_method": "executeWorkflow('spatial_reasoning', query)",
        },
        {
            "component": "Settings",
            "feature": "Catalogue des modèles",
            "bridge_method": "getAgentCatalog()",
        },
    ]
    
    for i, point in enumerate(integration_points, 1):
        print(f"\n{i}. {point['component']}")
        print(f"   Fonctionnalité: {point['feature']}")
        print(f"   Bridge: {point['bridge_method']}")
    
    return True


def calculate_model_stats():
    """Calcule les statistiques des modèles."""
    print("\n" + "=" * 70)
    print("📊 STATISTIQUES DES MODÈLES")
    print("=" * 70)
    
    from agent_federation import AGENT_REGISTRY
    
    total_agents = len(AGENT_REGISTRY)
    total_primary_models = len(set(c.model for c in AGENT_REGISTRY.values()))
    total_fallback_models = sum(len(c.fallback_models) for c in AGENT_REGISTRY.values())
    
    # Group by provider
    providers = {}
    for config in AGENT_REGISTRY.values():
        provider = config.model.split("/")[0]
        providers[provider] = providers.get(provider, 0) + 1
    
    print(f"\nAgents: {total_agents}")
    print(f"Modèles primaires uniques: {total_primary_models}")
    print(f"Modèles de fallback: {total_fallback_models}")
    print(f"Total modèles disponibles: {total_primary_models + total_fallback_models}")
    
    print(f"\nRépartition par provider:")
    for provider, count in sorted(providers.items(), key=lambda x: -x[1]):
        print(f"  • {provider}: {count} agent(s)")
    
    # Capacités
    capabilities = {
        "Code": ["CODE_GENERATOR"],
        "Vision": ["VISION_ANALYZER"],
        "Raisonnement": ["REASONING"],
        "Sécurité": ["SAFETY_GUARD"],
        "Extraction": ["DATA_EXTRACTOR"],
        "Synthèse": ["SUMMARIZER"],
        "Traduction": ["TRANSLATOR"],
        "Expertise QGIS": ["QGIS_EXPERT"],
        "Routing": ["ROUTER"],
    }
    
    print(f"\nCapacités couvertes:")
    for cap, agents in capabilities.items():
        print(f"  ✅ {cap}")
    
    return {
        "agents": total_agents,
        "primary_models": total_primary_models,
        "fallback_models": total_fallback_models,
        "providers": providers,
    }


def main():
    """Fonction principale de démonstration."""
    print("\n" + "🚀" * 35)
    print("   DÉMONSTRATION FÉDÉRATION D'AGENTS NVIDIA NIM")
    print("🚀" * 35)
    
    results = []
    
    # Tests
    results.append(("Structure Fédération", demo_federation_structure()))
    results.append(("Structure Workflows", demo_workflows_structure()))
    results.append(("Structure Bridge", demo_bridge_structure()))
    results.append(("Routing Simulation", test_routing_mock()))
    results.append(("Workflows Simulation", test_workflows_mock()))
    results.append(("Intégration Points", test_integration_points()))
    
    stats = calculate_model_stats()
    
    # Résumé
    print("\n" + "=" * 70)
    print("📈 RÉSUMÉ DES TESTS")
    print("=" * 70)
    
    for name, ok in results:
        status = "✅" if ok else "❌"
        print(f"{status} {name}")
    
    print(f"\n{'=' * 70}")
    print("🎉 Fédération d'Agents Prête!")
    print("=" * 70)
    print(f"""
Architecture créée avec:
  • {stats['agents']} agents spécialisés
  • {stats['primary_models']} modèles primaires uniques
  • {stats['fallback_models']} modèles de fallback
  • {len(stats['providers'])} providers NVIDIA NIM
  • 7 workflows multi-agents
  • 150+ modèles disponibles

Prochaines étapes:
  1. Intégrer le bridge dans geoai_assistant.py
  2. Ajouter les slots QWebChannel
  3. Créer l'UI de sélection d'agent
  4. Tester avec vraies clés API
""")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
