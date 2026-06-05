"""
Test LIVE de NVIDIA NIM - Vérifie que l'API fonctionne en vrai.
Usage: python test_nvidia_nim_live.py <VOTRE_CLE_API_NVIDIA>
"""
import sys
import os
import json
import time

# Ajouter vendor au path
PLUGIN_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VENDOR_DIR = os.path.join(PLUGIN_DIR, "QGISIA2", "vendor")
if os.path.exists(VENDOR_DIR) and VENDOR_DIR not in sys.path:
    sys.path.insert(0, VENDOR_DIR)

def test_nvidia_nim_streaming(api_key: str):
    """Test streaming avec NVIDIA NIM via LiteLLM."""
    print("=" * 60)
    print("TEST NVIDIA NIM - Streaming Live")
    print("=" * 60)
    
    # Vérifier vendor
    try:
        import litellm
        version = getattr(litellm, "__version__", "unknown")
        print(f"✓ LiteLLM importé (version: {version})")
    except ImportError as e:
        print(f"✗ LiteLLM non disponible: {e}")
        return False
    
    # Configuration - utiliser un modèle standard accessible à tous
    model = "nvidia_nim/meta/llama-3.1-8b-instruct"
    api_base = "https://integrate.api.nvidia.com/v1"
    
    messages = [
        {"role": "system", "content": "Tu es un assistant SIG spécialisé en QGIS."},
        {"role": "user", "content": "Explique-moi en 2 phrases ce qu'est un shapefile."}
    ]
    
    print(f"\n📡 Connexion à: {api_base}")
    print(f"🤖 Modèle: {model}")
    print(f"🔑 Clé API: {api_key[:8]}...{api_key[-4:]}")
    print("\n⏳ Envoi de la requête (timeout: 60s)...")
    
    start_time = time.time()
    full_response = ""
    chunk_count = 0
    
    try:
        # Appel streaming
        response = litellm.completion(
            model=model,
            messages=messages,
            api_key=api_key,
            api_base=api_base,
            stream=True,
            temperature=0.7,
            max_tokens=100,
            timeout=60,
        )
        
        print("✓ Connexion établie! Réception des chunks...\n")
        print("-" * 40)
        print("RÉPONSE:")
        print("-" * 40)
        
        for chunk in response:
            chunk_count += 1
            delta = chunk.choices[0].delta.content
            if delta:
                full_response += delta
                print(delta, end="", flush=True)
        
        print("\n" + "-" * 40)
        elapsed = time.time() - start_time
        
        print(f"\n✓ Stream terminé!")
        print(f"   Chunks reçus: {chunk_count}")
        print(f"   Temps total: {elapsed:.2f}s")
        print(f"   Caractères: {len(full_response)}")
        print(f"   Vitesse: {len(full_response)/elapsed:.1f} chars/s")
        
        if len(full_response) > 10:
            print("\n🎉 SUCCÈS - NVIDIA NIM fonctionne correctement!")
            return True
        else:
            print("\n⚠️ Réponse trop courte - vérifiez la clé API")
            return False
            
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"\n✗ ERREUR après {elapsed:.2f}s:")
        print(f"   {type(e).__name__}: {e}")
        
        # Messages d'erreur spécifiques
        error_str = str(e).lower()
        if "401" in error_str or "unauthorized" in error_str:
            print("\n💡 La clé API est invalide ou expirée.")
            print("   Obtenez une nouvelle clé sur: https://build.nvidia.com")
        elif "429" in error_str or "rate limit" in error_str:
            print("\n💡 Rate limit atteint - attendez quelques secondes.")
        elif "timeout" in error_str:
            print("\n💡 Timeout - le serveur NVIDIA est lent ou indisponible.")
        elif "connection" in error_str:
            print("\n💡 Problème de connexion - vérifiez votre internet.")
        
        return False


def test_nvidia_nim_non_stream(api_key: str):
    """Test non-streaming avec NVIDIA NIM."""
    print("\n" + "=" * 60)
    print("TEST NVIDIA NIM - Non-Streaming")
    print("=" * 60)
    
    try:
        import litellm
    except ImportError:
        print("✗ LiteLLM non disponible")
        return False
    
    model = "nvidia_nim/meta/llama-3.1-8b-instruct"
    api_base = "https://integrate.api.nvidia.com/v1"
    
    messages = [
        {"role": "user", "content": "Dis 'Hello QGIS' en français."}
    ]
    
    print(f"\n⏳ Requête simple...")
    start_time = time.time()
    
    try:
        response = litellm.completion(
            model=model,
            messages=messages,
            api_key=api_key,
            api_base=api_base,
            stream=False,
            temperature=0.7,
            max_tokens=50,
            timeout=60,
        )
        
        elapsed = time.time() - start_time
        content = response.choices[0].message.content
        
        print(f"✓ Réponse reçue en {elapsed:.2f}s:")
        print(f"   '{content}'")
        print("\n🎉 Non-streaming OK!")
        return True
        
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"✗ Erreur après {elapsed:.2f}s: {e}")
        return False


def main():
    # Récupérer la clé API
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
    else:
        # Essayer depuis l'environnement
        api_key = os.environ.get("NVIDIA_API_KEY") or os.environ.get("NVIDIA_NIM_API_KEY")
        if not api_key:
            print("Usage: python test_nvidia_nim_live.py <API_KEY>")
            print("   ou: set NVIDIA_API_KEY=votre_cle && python test_nvidia_nim_live.py")
            sys.exit(1)
    
    print("\n🔧 Test de NVIDIA NIM avec LiteLLM")
    print(f"   Date: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Tests
    results = []
    
    # Test 1: Streaming
    results.append(("Streaming", test_nvidia_nim_streaming(api_key)))
    
    # Test 2: Non-streaming
    results.append(("Non-Streaming", test_nvidia_nim_non_stream(api_key)))
    
    # Résumé
    print("\n" + "=" * 60)
    print("RÉSUMÉ DES TESTS")
    print("=" * 60)
    for name, success in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"   {status} - {name}")
    
    all_passed = all(r[1] for r in results)
    if all_passed:
        print("\n🎉 Tous les tests ont réussi!")
        print("   NVIDIA NIM est prêt à être utilisé dans QGISIA+.")
        return 0
    else:
        print("\n⚠️ Certains tests ont échoué.")
        print("   Vérifiez votre clé API et la connexion internet.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
