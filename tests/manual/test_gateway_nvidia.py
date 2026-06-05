"""
Test du Gateway LLM avec NVIDIA NIM - Simule un vrai appel via le gateway.
Usage: python test_gateway_nvidia.py <CLE_API_NVIDIA>
"""
import sys
import os

# Ajouter vendor au path (comme le fait le plugin)
PLUGIN_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VENDOR_DIR = os.path.join(PLUGIN_DIR, "QGISIA2", "vendor")
if os.path.exists(VENDOR_DIR) and VENDOR_DIR not in sys.path:
    sys.path.insert(0, VENDOR_DIR)

# Ajouter aussi QGISIA2 pour importer le gateway
QGISIA2_DIR = os.path.join(PLUGIN_DIR, "QGISIA2")
if QGISIA2_DIR not in sys.path:
    sys.path.insert(0, QGISIA2_DIR)


def test_via_gateway(api_key: str):
    """Test via le llm_gateway.py (comme le fait le plugin)."""
    print("=" * 60)
    print("TEST via Gateway LLM (llm_gateway.py)")
    print("=" * 60)
    
    try:
        from llm_gateway import chat, is_vendor_ready
    except ImportError as e:
        print(f"✗ Impossible d'importer le gateway: {e}")
        return False
    
    # Vérifier vendor
    if not is_vendor_ready():
        print("✗ Vendor non prêt - lancez d'abord l'installation")
        print("   python -c \"from llm_installer import install_if_needed; install_if_needed()\"")
        return False
    
    print("✓ Vendor prêt")
    
    # Test avec l'alias NVIDIA NIM
    model = "nvidia_nim/nvidia/llama-3.1-nemotron-70b-instruct"
    api_keys = {
        "nvidia_nim": api_key,  # C'est comme ça que le frontend l'envoie
    }
    
    messages = [
        {"role": "system", "content": "Tu es un assistant concis."},
        {"role": "user", "content": "Dis 'Hello NVIDIA NIM' en français, très brièvement."}
    ]
    
    print(f"\n📡 Modèle: {model}")
    print(f"🔑 Clé API: {api_key[:8]}...{api_key[-4:]}")
    print(f"\n⏳ Appel via gateway (timeout: 60s)...")
    
    import time
    start = time.time()
    
    try:
        # Appel via le gateway (non-streaming d'abord)
        response = chat(
            model=model,
            messages=messages,
            api_keys=api_keys,
            stream=False,
            temperature=0.7,
            max_tokens=50,
        )
        
        elapsed = time.time() - start
        content = response["choices"][0]["message"]["content"]
        
        print(f"✓ Réponse en {elapsed:.2f}s:")
        print(f"   '{content}'")
        print("\n🎉 Gateway + NVIDIA NIM fonctionnent!")
        return True
        
    except Exception as e:
        elapsed = time.time() - start
        print(f"\n✗ Erreur après {elapsed:.2f}s:")
        print(f"   {type(e).__name__}: {e}")
        
        # Aide au diagnostic
        error_str = str(e).lower()
        if "401" in error_str:
            print("\n💡 Clé API invalide - vérifiez sur https://build.nvidia.com")
        elif "nvidia" in error_str and "api" in error_str:
            print("\n💡 Problème de connexion à l'API NVIDIA")
        
        return False


def test_streaming_via_gateway(api_key: str):
    """Test streaming via le gateway."""
    print("\n" + "=" * 60)
    print("TEST Streaming via Gateway LLM")
    print("=" * 60)
    
    try:
        from llm_gateway import chat, is_vendor_ready
    except ImportError:
        print("✗ Gateway non disponible")
        return False
    
    if not is_vendor_ready():
        print("✗ Vendor non prêt")
        return False
    
    model = "nvidia_nim/meta/llama-3.1-8b-instruct"  # Modèle plus rapide
    api_keys = {"nvidia_nim": api_key}
    
    messages = [
        {"role": "user", "content": "Compte jusqu'à 3."}
    ]
    
    print(f"\n📡 Modèle rapide: {model}")
    print("⏳ Streaming... (appuyez sur Ctrl+C pour annuler)")
    
    import time
    start = time.time()
    full = ""
    chunk_count = 0
    
    try:
        stream = chat(
            model=model,
            messages=messages,
            api_keys=api_keys,
            stream=True,
            max_tokens=30,
        )
        
        print("\nRéponse: '")
        for chunk in stream:
            chunk_count += 1
            delta = chunk["choices"][0]["delta"].get("content", "")
            if delta:
                full += delta
                print(delta, end="", flush=True)
        
        print("'\n")
        elapsed = time.time() - start
        
        print(f"✓ Stream terminé en {elapsed:.2f}s")
        print(f"   Chunks: {chunk_count}, Chars: {len(full)}")
        return True
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrompu par l'utilisateur")
        return False
    except Exception as e:
        elapsed = time.time() - start
        print(f"\n✗ Erreur après {elapsed:.2f}s: {e}")
        return False


def main():
    # Récupérer la clé
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
    else:
        api_key = os.environ.get("NVIDIA_API_KEY")
        if not api_key:
            print("Usage: python test_gateway_nvidia.py <NVIDIA_API_KEY>")
            print("   ou: $env:NVIDIA_API_KEY='votre_cle' ; python test_gateway_nvidia.py")
            sys.exit(1)
    
    print("\n🧪 Test Gateway + NVIDIA NIM")
    print("   " + "=" * 50)
    
    results = []
    
    # Test 1: Non-streaming
    results.append(("Non-streaming", test_via_gateway(api_key)))
    
    # Test 2: Streaming
    results.append(("Streaming", test_streaming_via_gateway(api_key)))
    
    # Résumé
    print("\n" + "=" * 60)
    print("RÉSUMÉ")
    print("=" * 60)
    for name, ok in results:
        status = "✓" if ok else "✗"
        print(f"   {status} {name}")
    
    if all(r[1] for r in results):
        print("\n🎉 Tous les tests passent!")
        print("   Le plugin peut utiliser NVIDIA NIM.")
        return 0
    else:
        print("\n⚠️ Certains tests échouent.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
