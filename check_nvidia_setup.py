"""
Vérification de la configuration NVIDIA NIM dans QGISIA+
Usage: python check_nvidia_setup.py [VOTRE_CLE_API]
"""
import sys
import os

PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
VENDOR_DIR = os.path.join(PLUGIN_DIR, "QGISIA2", "vendor")
QGISIA2_DIR = os.path.join(PLUGIN_DIR, "QGISIA2")

if os.path.exists(VENDOR_DIR) and VENDOR_DIR not in sys.path:
    sys.path.insert(0, VENDOR_DIR)
if QGISIA2_DIR not in sys.path:
    sys.path.insert(0, QGISIA2_DIR)


def check_vendor():
    """Vérifie que le vendor est prêt."""
    print("1️⃣  Vérification du vendor...")
    try:
        from llm_installer import is_vendor_ready, VENDOR_DIR
        ready = is_vendor_ready()
        print(f"   Vendor dir: {VENDOR_DIR}")
        print(f"   Status: {'✅ Prêt' if ready else '❌ Non prêt'}")
        return ready
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        return False


def check_gateway_import():
    """Vérifie que le gateway s'importe."""
    print("\n2️⃣  Vérification du Gateway...")
    try:
        import llm_gateway
        print(f"   ✅ Gateway importé")
        print(f"      Version LiteLLM: {llm_gateway.__dict__.get('litellm', 'N/A')}")
        return True
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        return False


def check_nvidia_aliases():
    """Vérifie les alias NVIDIA."""
    print("\n3️⃣  Vérification des alias NVIDIA...")
    try:
        import json
        config_path = os.path.join(QGISIA2_DIR, "config", "models.json")
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        aliases = config.get("aliases", {})
        nvidia_aliases = {k: v for k, v in aliases.items() if "nvidia" in k}
        
        print(f"   ✅ {len(nvidia_aliases)} alias NVIDIA trouvés:")
        for name, info in nvidia_aliases.items():
            primary = info.get("primary", "N/A")
            print(f"      • {name}: {primary}")
        
        return len(nvidia_aliases) > 0
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        return False


def test_nvidia_api_key(api_key: str):
    """Test une vraie clé API NVIDIA."""
    print(f"\n4️⃣  Test LIVE avec clé API...")
    print(f"   Clé: {api_key[:8]}...{api_key[-4:]}")
    
    try:
        import litellm
        
        # Test simple avec modèle rapide
        response = litellm.completion(
            model="nvidia_nim/meta/llama-3.1-8b-instruct",
            messages=[{"role": "user", "content": "Dis 'OK NVIDIA'"}],
            api_key=api_key,
            api_base="https://integrate.api.nvidia.com/v1",
            max_tokens=10,
            timeout=30,
        )
        
        content = response.choices[0].message.content
        print(f"   ✅ Réponse reçue: '{content[:50]}...'")
        return True
        
    except Exception as e:
        print(f"   ❌ Erreur: {type(e).__name__}: {e}")
        error_str = str(e).lower()
        if "401" in error_str or "unauthorized" in error_str:
            print("\n   💡 La clé API est invalide ou expirée.")
            print("      Obtenez une clé gratuite sur: https://build.nvidia.com")
        return False


def main():
    print("=" * 60)
    print("🔍 VÉRIFICATION NVIDIA NIM - QGISIA+")
    print("=" * 60)
    
    checks = []
    
    # Check 1: Vendor
    checks.append(("Vendor prêt", check_vendor()))
    
    # Check 2: Gateway
    checks.append(("Gateway importable", check_gateway_import()))
    
    # Check 3: Aliases
    checks.append(("Alias NVIDIA", check_nvidia_aliases()))
    
    # Check 4: Clé API (si fournie)
    api_key = None
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
    else:
        api_key = os.environ.get("NVIDIA_API_KEY")
    
    if api_key:
        checks.append(("Clé API LIVE", test_nvidia_api_key(api_key)))
    else:
        print("\n4️⃣  Test LIVE: ⏭️  Ignoré (pas de clé API)")
        print("   Pour tester avec une vraie clé:")
        print("   python check_nvidia_setup.py VOTRE_CLE_API")
    
    # Résumé
    print("\n" + "=" * 60)
    print("RÉSUMÉ")
    print("=" * 60)
    for name, ok in checks:
        status = "✅" if ok else "❌"
        print(f"   {status} {name}")
    
    all_ok = all(c[1] for c in checks)
    
    if all_ok:
        print("\n🎉 Tout est configuré correctement!")
        print("   NVIDIA NIM est prêt dans QGISIA+.")
    else:
        print("\n⚠️  Certains checks ont échoué.")
    
    # Instructions
    print("\n" + "-" * 60)
    print("📋 POUR TESTER AVEC UNE VRAIE CLÉ API:")
    print("-" * 60)
    print("1. Obtenez une clé gratuite sur https://build.nvidia.com")
    print("2. Lancez: python check_nvidia_setup.py VOTRE_CLE_API")
    print("3. Ou dans QGISIA+, entrez la clé dans Paramètres > Gateway IA")
    
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
