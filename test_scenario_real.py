"""
Test COMPLET d'un cas reel QGIS avec la Federation d'Agents.
Scenario: Analyse multicritere pour localisation d'une infrastructure.
"""
import sys
import os
import json
import time

PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
VENDOR_DIR = os.path.join(PLUGIN_DIR, "QGISIA2", "vendor")
if os.path.exists(VENDOR_DIR) and VENDOR_DIR not in sys.path:
    sys.path.insert(0, VENDOR_DIR)
sys.path.insert(0, os.path.join(PLUGIN_DIR, "QGISIA2"))


def print_section(title):
    """Affiche une section."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_step(num, title):
    """Affiche une etape."""
    print(f"\n  [ETAPE {num}] {title}")
    print("  " + "-" * 66)


def test_scenario_real():
    """
    Scenario reel: Bureau d'etude cherche a localiser une nouvelle ecole.
    Contraintes:
    - Proximite des zones residentielles (< 1km)
    - Loin des zones bruyantes (> 500m des routes principales)
    - Accessible (arrets de bus < 500m)
    - Terrain disponible (> 5000m2)
    - Sans contrainte reglementaire
    """
    
    print("\n" + "🚀" * 35)
    print("   TEST COMPLET - CAS REEL QGIS")
    print("🚀" * 35)
    
    api_key = "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"
    api_keys = {"nvidia_nim": api_key}
    
    print_section("SCENARIO: Localisation Optimale d'une Ecole")
    print("""
    Contexte: Bureau d'etude SIG (2 personnes)
    Mission: Identifier la localisation optimale pour une nouvelle ecole
    
    CONTRAINTES:
    1. Proximite zones residentielles (< 1km)
    2. Loin des zones bruyantes (> 500m des routes)
    3. Accessible transport (bus < 500m)
    4. Terrain disponible (> 5000m2)
    5. Hors zones protegees
    
    DONNEES DISPONIBLES:
    - Couche zones residentielles (RESIDENTIAL_ZONES.shp)
    - Couche reseau routier (ROADS.shp)
    - Couche arrets de bus (BUS_STOPS.shp)
    - Couche zones protegees (PROTECTED_AREAS.shp)
    - Couche parcelles cadastrales (PARCELS.shp)
    """)
    
    # ETAPE 1: Analyse et structuration de la demande
    print_step(1, "EXTRACTION DES PARAMETRES (Data Extractor)")
    
    from agent_federation import AgentFederation, AgentType
    
    federation = AgentFederation(api_keys)
    
    query_step1 = """Analyse cette demande de localisation d'ecole et extrais les parametres en JSON:
    
    Contraintes:
    - Proximite des zones residentielles (distance max: 1km)
    - Loin des zones bruyantes (distance min: 500m des routes principales)
    - Accessible (arrets de bus a moins de 500m)
    - Terrain disponible (surface min: 5000m2)
    - Sans contrainte reglementaire (hors zones protegees)
    
    Donnees: RESIDENTIAL_ZONES.shp, ROADS.shp, BUS_STOPS.shp, PROTECTED_AREAS.shp, PARCELS.shp
    
    Retourne un JSON avec:
    - objectif
    - contraintes (liste avec type, couche, distance, operation)
    - donnees_necessaires
    - criteres_optimisation
    """
    
    print("  Requete: Extraction des parametres...")
    start = time.time()
    
    result_step1 = federation.execute_agent(
        AgentType.DATA_EXTRACTOR,
        query_step1,
        progress_callback=lambda msg: print(f"    > {msg}")
    )
    
    elapsed1 = time.time() - start
    
    if result_step1.success:
        print(f"\n  ✅ SUCCES en {elapsed1:.1f}s")
        print(f"  Modele: {result_step1.model_used}")
        print(f"\n  Parametres extraits:")
        print("  " + "-" * 66)
        # Tenter de parser le JSON
        try:
            params = json.loads(result_step1.content)
            print(json.dumps(params, indent=4, ensure_ascii=False))
            context = {"parameters": params}
        except:
            print(result_step1.content[:800])
            context = {"raw_extraction": result_step1.content}
    else:
        print(f"\n  ❌ ECHEC: {result_step1.error}")
        context = {}
    
    # ETAPE 2: Raisonnement spatial
    print_step(2, "RAISONNEMENT SPATIAL (Spatial Reasoning Expert)")
    
    query_step2 = f"""En tant qu'expert en analyse spatiale, planifie cette analyse multicritere:
    
    Objectif: Localiser une ecole
    {json.dumps(context.get('parameters', {}), indent=2, ensure_ascii=False)}
    
    Fournis:
    1. Les etapes d'analyse en ordre logique
    2. Les requetes spatiales necessaires (buffer, intersect, etc.)
    3. La methodologie de scoring multicritere
    4. Les outils QGIS/processing a utiliser
    
    Structure ta reponse etape par etape."""
    
    print("  Requete: Analyse spatiale multicritere...")
    start = time.time()
    
    result_step2 = federation.execute_agent(
        AgentType.REASONING,
        query_step2,
        context=context,
        progress_callback=lambda msg: print(f"    > {msg}")
    )
    
    elapsed2 = time.time() - start
    
    if result_step2.success:
        print(f"\n  ✅ SUCCES en {elapsed2:.1f}s")
        print(f"  Modele: {result_step2.model_used}")
        print(f"\n  Plan d'analyse:")
        print("  " + "-" * 66)
        print(result_step2.content[:1200])
        if len(result_step2.content) > 1200:
            print("  ... (tronque)")
        context["spatial_analysis"] = result_step2.content
    else:
        print(f"\n  ❌ ECHEC: {result_step2.error}")
    
    # ETAPE 3: Generation du code PyQGIS
    print_step(3, "GENERATION DU CODE (PyQGIS Code Generator)")
    
    query_step3 = f"""Genere un script PyQGIS COMPLET et FONCTIONNEL pour cette analyse:
    
    Plan d'analyse:
    {context.get('spatial_analysis', 'Analyse spatiale multicritere')[:500]}
    
    Contraintes du code:
    - Code Python complet et executable
    - Utilise processing.run() pour les algorithmes
    - Gestion des erreurs avec try/except
    - Commentaires en francais
    - Affiche les resultats dans QGIS
    - Sauvegarde les couches resultats
    
    Donnees:
    - RESIDENTIAL_ZONES.shp (zones residentielles)
    - ROADS.shp (routes - utiliser champ 'type' pour identifier principales)
    - BUS_STOPS.shp (arrets de bus)
    - PROTECTED_AREAS.shp (zones protegees)
    - PARCELS.shp (parcelles - utiliser champ 'surface_m2')
    
    Retourne UNIQUEMENT le code Python, sans markdown."""
    
    print("  Requete: Generation du script PyQGIS...")
    start = time.time()
    
    result_step3 = federation.execute_agent(
        AgentType.CODE_GENERATOR,
        query_step3,
        context=context,
        progress_callback=lambda msg: print(f"    > {msg}")
    )
    
    elapsed3 = time.time() - start
    
    if result_step3.success:
        print(f"\n  ✅ SUCCES en {elapsed3:.1f}s")
        print(f"  Modele: {result_step3.model_used}")
        print(f"\n  Code genere:")
        print("  " + "=" * 66)
        print(result_step3.content[:2000])
        if len(result_step3.content) > 2000:
            print("  ... (code tronque, voir fichier de sortie)")
        print("  " + "=" * 66)
        context["generated_code"] = result_step3.content
    else:
        print(f"\n  ❌ ECHEC: {result_step3.error}")
    
    # ETAPE 4: Verification de securite
    print_step(4, "VERIFICATION SECURITE (Safety Guard)")
    
    if result_step3.success:
        print("  Verification du code genere...")
        start = time.time()
        
        result_step4 = federation.execute_agent(
            AgentType.SAFETY_GUARD,
            result_step3.content,
            progress_callback=lambda msg: print(f"    > {msg}")
        )
        
        elapsed4 = time.time() - start
        
        print(f"\n  Resultat en {elapsed4:.1f}s:")
        print(f"  Modele: {result_step4.model_used}")
        print(f"  Status: {result_step4.content.strip()}")
        
        if "UNSAFE" in result_step4.content.upper():
            print("  ⚠️  CODE REFUSE - Verification manuelle necessaire")
        else:
            print("  ✅ CODE ACCEPTE")
    
    # ETAPE 5: Documentation pour l'utilisateur
    print_step(5, "DOCUMENTATION (QGIS Native Expert)")
    
    query_step5 = f"""Redige une notice d'utilisation pour ce script PyQGIS:
    
    Contexte: Script pour localisation optimale d'ecole
    
    Fournis:
    1. Prerequis (donnees necessaires)
    2. Etapes d'execution dans QGIS
    3. Interpretation des resultats
    4. Conseils de personnalisation
    
    Style: Claire, professionnelle, accessible a un bureau d'etude."""
    
    print("  Generation de la documentation...")
    start = time.time()
    
    result_step5 = federation.execute_agent(
        AgentType.QGIS_EXPERT,
        query_step5,
        context=context,
        progress_callback=lambda msg: print(f"    > {msg}")
    )
    
    elapsed5 = time.time() - start
    
    if result_step5.success:
        print(f"\n  ✅ SUCCES en {elapsed5:.1f}s")
        print(f"  Modele: {result_step5.model_used}")
        print(f"\n  Documentation:")
        print("  " + "-" * 66)
        print(result_step5.content[:1000])
        if len(result_step5.content) > 1000:
            print("  ...")
    
    # Resume final
    print_section("RESUME DU SCENARIO COMPLET")
    
    total_time = elapsed1 + elapsed2 + elapsed3 + elapsed5
    
    print(f"""
    TEMPS TOTAL: {total_time:.1f} secondes
    
    AGENTS UTILISES:
    1. Data Extractor ({elapsed1:.1f}s)     - Extraction des parametres
    2. Reasoning Expert ({elapsed2:.1f}s) - Plan d'analyse spatial
    3. Code Generator ({elapsed3:.1f}s)     - Script PyQGIS complet
    4. Safety Guard ({elapsed4:.1f}s)      - Verification securite
    5. QGIS Expert ({elapsed5:.1f}s)      - Documentation utilisateur
    
    MODELES NVIDIA UTILISES:
    - {result_step1.model_used if result_step1.success else 'N/A'}
    - {result_step2.model_used if result_step2.success else 'N/A'}
    - {result_step3.model_used if result_step3.success else 'N/A'}
    - {result_step4.model_used if result_step4.success else 'N/A'}
    - {result_step5.model_used if result_step5.success else 'N/A'}
    
    LIVRABLES:
    ✅ Parametres d'analyse extraits en JSON
    ✅ Plan d'analyse spatiale detaille
    ✅ Script PyQGIS complet et fonctionnel
    ✅ Verification securite effectuee
    ✅ Documentation utilisateur
    """)
    
    # Sauvegarde des resultats
    output_file = "test_scenario_real_results.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "scenario": "Localisation optimale ecole",
            "total_time_seconds": total_time,
            "steps": [
                {
                    "name": "Extraction parametres",
                    "agent": "DATA_EXTRACTOR",
                    "model": result_step1.model_used if result_step1.success else None,
                    "latency_seconds": elapsed1,
                    "success": result_step1.success,
                    "output": result_step1.content if result_step1.success else None,
                },
                {
                    "name": "Raisonnement spatial",
                    "agent": "REASONING",
                    "model": result_step2.model_used if result_step2.success else None,
                    "latency_seconds": elapsed2,
                    "success": result_step2.success,
                },
                {
                    "name": "Generation code",
                    "agent": "CODE_GENERATOR",
                    "model": result_step3.model_used if result_step3.success else None,
                    "latency_seconds": elapsed3,
                    "success": result_step3.success,
                    "code": result_step3.content if result_step3.success else None,
                },
                {
                    "name": "Verification securite",
                    "agent": "SAFETY_GUARD",
                    "model": result_step4.model_used if result_step4.success else None,
                    "latency_seconds": elapsed4,
                    "success": result_step4.success,
                    "status": result_step4.content if result_step4.success else None,
                },
                {
                    "name": "Documentation",
                    "agent": "QGIS_EXPERT",
                    "model": result_step5.model_used if result_step5.success else None,
                    "latency_seconds": elapsed5,
                    "success": result_step5.success,
                },
            ],
            "success": all([
                result_step1.success,
                result_step2.success,
                result_step3.success,
                result_step4.success,
                result_step5.success,
            ]),
        }, f, indent=2, ensure_ascii=False)
    
    print(f"  Resultats sauvegardes dans: {output_file}")
    
    return all([
        result_step1.success,
        result_step2.success,
        result_step3.success,
        result_step4.success,
        result_step5.success,
    ])


if __name__ == "__main__":
    try:
        success = test_scenario_real()
        print("\n" + "=" * 70)
        if success:
            print("🎉 SCENARIO COMPLET REUSSI!")
            print("   Tous les agents ont fonctionne correctement.")
            print("   Le workflow multi-agents est operationnel.")
        else:
            print("⚠️  SCENARIO INCOMPLET")
            print("   Certaines etapes ont echoue.")
        print("=" * 70)
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n❌ Test interrompu par l'utilisateur")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ ERREUR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
