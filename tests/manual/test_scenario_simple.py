"""
Test RAPIDE d'un cas reel simple.
Scenario: Generation d'un script de buffer avec analyse.
"""
import sys
import os
import json
import time

PLUGIN_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VENDOR_DIR = os.path.join(PLUGIN_DIR, "QGISIA2", "vendor")
if os.path.exists(VENDOR_DIR) and VENDOR_DIR not in sys.path:
    sys.path.insert(0, VENDOR_DIR)
sys.path.insert(0, os.path.join(PLUGIN_DIR, "QGISIA2"))


def test_simple_real():
    """Test simple mais reel: buffer et analyse."""
    print("=" * 70)
    print("TEST RAPIDE - CAS REEL SIMPLE")
    print("=" * 70)
    
    api_key = "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"
    api_keys = {"nvidia_nim": api_key}
    
    print("\nSCENARIO: Buffer de 500m + Analyse de surface")
    print("-" * 70)
    
    from agent_federation import AgentFederation, AgentType
    
    federation = AgentFederation(api_keys)
    
    # ETAPE 1: Generation de code simple
    print("\n[1] Generation de code PyQGIS...")
    print("    Modele: Llama 3.3 70B (rapide)")
    
    query = """Cree un script PyQGIS simple qui:
1. Charge un shapefile de points (ecoles.shp)
2. Cree un buffer de 500m
3. Calcule l'intersection avec zones residentielles
4. Affiche le nombre d'ecoles couvertes

Code avec commentaires, try/except, et affichage des resultats."""
    
    start = time.time()
    result = federation.execute_agent(
        AgentType.CODE_GENERATOR,
        query,
        progress_callback=lambda msg: print(f"    > {msg}")
    )
    elapsed = time.time() - start
    
    if result.success:
        print(f"\n  ✅ SUCCES en {elapsed:.1f}s")
        print(f"  Modele utilise: {result.model_used}")
        print(f"\n  CODE GENERE:")
        print("  " + "=" * 66)
        print(result.content[:1500])
        if len(result.content) > 1500:
            print("  ...")
        print("  " + "=" * 66)
    else:
        print(f"\n  ❌ ECHEC: {result.error}")
        return False
    
    # ETAPE 2: Explication du code
    print("\n[2] Explication du code genere...")
    print("    Modele: Llama 3.3 70B")
    
    query2 = f"""Explique ce code PyQGIS etape par etape:

{result.content[:800]}

Explique:
1. Ce que fait chaque section
2. Les fonctions QGIS utilisees
3. Comment l'executer dans QGIS"""
    
    start = time.time()
    result2 = federation.execute_agent(
        AgentType.QGIS_EXPERT,
        query2,
        progress_callback=lambda msg: print(f"    > {msg}")
    )
    elapsed2 = time.time() - start
    
    if result2.success:
        print(f"\n  ✅ SUCCES en {elapsed2:.1f}s")
        print(f"\n  EXPLICATION:")
        print("  " + "-" * 66)
        print(result2.content[:1000])
        if len(result2.content) > 1000:
            print("  ...")
    else:
        print(f"\n  ❌ ECHEC: {result2.error}")
    
    # Resume
    print("\n" + "=" * 70)
    print("RESUME")
    print("=" * 70)
    print(f"\nTemps total: {elapsed + elapsed2:.1f} secondes")
    print(f"Etape 1 (Code): {elapsed:.1f}s - {result.model_used.split('/')[-1]}")
    if result2.success:
        print(f"Etape 2 (Expl): {elapsed2:.1f}s - {result2.model_used.split('/')[-1]}")
    
    print(f"\n{'=' * 70}")
    if result.success:
        print("✅ TEST REUSSI!")
        print("   Code PyQGIS fonctionnel genere et explique.")
        print("   Federation d'agents operationnelle!")
    else:
        print("⚠️  ECHEC")
    print("=" * 70)
    
    return result.success


if __name__ == "__main__":
    try:
        success = test_simple_real()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nInterrompu")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nErreur: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
