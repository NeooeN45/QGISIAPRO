"""
Script de test automatique pour le Gateway LLM.
Teste les endpoints /api/llm/* sans besoin de QGIS.

Usage:
    cd QGISIA2
    python ../tests/test_gateway.py

Ou depuis la racine:
    python tests/test_gateway.py
"""

import json
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# Ajouter le dossier QGISIA2 au path
QGIS_PLUGIN_DIR = Path(__file__).parent.parent / "QGISIA2"
sys.path.insert(0, str(QGIS_PLUGIN_DIR))

BASE_URL = "http://localhost:8157"


def make_request(path, method="GET", data=None, timeout=30):
    """Effectue une requête HTTP et retourne (status, body, error)."""
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    
    try:
        if data:
            data = json.dumps(data).encode('utf-8')
        
        req = urllib.request.Request(
            url, 
            data=data, 
            headers=headers, 
            method=method
        )
        
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode('utf-8')
            return response.status, body, None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8'), str(e)
    except Exception as e:
        return None, None, str(e)


def test_health():
    """Test /api/llm/health"""
    print("\n🔍 Test 1: Health check (/api/llm/health)")
    status, body, error = make_request("/api/llm/health")
    
    if error:
        print(f"   ❌ Erreur: {error}")
        print("   💡 Le serveur QGIS est probablement arrêté. Démarre le plugin d'abord.")
        return False
    
    try:
        data = json.loads(body)
        print(f"   ✅ Status HTTP: {status}")
        print(f"   📦 vendor_ready: {data.get('vendor_ready')}")
        print(f"   📦 config_loaded: {data.get('config_loaded')}")
        print(f"   📦 aliases: {len(data.get('aliases', []))}")
        return data.get('ok') and data.get('config_loaded')
    except Exception as e:
        print(f"   ❌ Erreur parsing JSON: {e}")
        return False


def test_models():
    """Test /api/llm/models"""
    print("\n🔍 Test 2: Liste des modèles (/api/llm/models)")
    status, body, error = make_request("/api/llm/models")
    
    if error:
        print(f"   ❌ Erreur: {error}")
        return False
    
    try:
        data = json.loads(body)
        aliases = data.get('aliases', [])
        print(f"   ✅ {len(aliases)} alias trouvés:")
        for alias in aliases:
            print(f"      - {alias.get('alias')}: {alias.get('description', 'N/A')}")
        # Vérifier présence aliases NVIDIA
        nvidia_aliases = [a for a in aliases if 'nvidia' in a.get('alias', '')]
        if nvidia_aliases:
            print(f"   ✅ {len(nvidia_aliases)} alias NVIDIA Developer Program trouvés!")
        return len(aliases) > 0
    except Exception as e:
        print(f"   ❌ Erreur parsing JSON: {e}")
        return False


def test_install():
    """Test /api/llm/install (déclenche l'installation vendor)"""
    print("\n🔍 Test 3: Installation vendor (/api/llm/install)")
    print("   ⏳ Cela peut prendre 30-60s...")
    
    status, body, error = make_request("/api/llm/install", method="POST")
    
    if error:
        print(f"   ❌ Erreur: {error}")
        return False
    
    try:
        data = json.loads(body)
        if data.get('ok'):
            print(f"   ✅ Installation démarrée: {data.get('status')}")
            print(f"   💡 Polling /api/llm/health pour suivre la progression...")
            return True
        else:
            print(f"   ⚠️ Réponse inattendue: {data}")
            return False
    except Exception as e:
        print(f"   ❌ Erreur parsing JSON: {e}")
        return False


def wait_for_vendor_ready(max_seconds=120):
    """Attend que le vendor soit prêt"""
    print(f"\n⏳ Attente vendor_ready (max {max_seconds}s)...")
    
    start = time.time()
    dots = 0
    while time.time() - start < max_seconds:
        status, body, error = make_request("/api/llm/health")
        if not error:
            try:
                data = json.loads(body)
                if data.get('vendor_ready'):
                    print(f"\n   ✅ Vendor prêt en {int(time.time() - start)}s!")
                    return True
            except:
                pass
        
        dots = (dots + 1) % 4
        print(f"\r   {'⠋⠙⠹⠸'[dots]} En cours... {int(time.time() - start)}s", end='', flush=True)
        time.sleep(2)
    
    print(f"\n   ❌ Timeout après {max_seconds}s")
    return False


def test_chat_simple():
    """Test /api/llm/chat avec un message simple (Ollama local)"""
    print("\n🔍 Test 4: Chat simple (/api/llm/chat)")
    print("   💡 Ce test nécessite Ollama en local avec un modèle chargé")
    
    payload = {
        "model": "fast-local",  # alias vers ollama
        "messages": [
            {"role": "system", "content": "Tu es un assistant géospatial. Réponds en une phrase."},
            {"role": "user", "content": "Dis 'Gateway OK' en français"}
        ],
        "stream": False,
        "temperature": 0.1
    }
    
    print("   ⏳ Envoi requête...")
    status, body, error = make_request("/api/llm/chat", method="POST", data=payload, timeout=60)
    
    if error:
        print(f"   ⚠️ Erreur (Ollama probablement non démarré): {error[:100]}")
        print("   💡 C'est normal si Ollama n'est pas lancé. Passe à la suite.")
        return None  # Ne pas compter comme échec critique
    
    try:
        data = json.loads(body)
        if 'content' in data:
            content = data['content'][:100]
            print(f"   ✅ Réponse reçue: {content}...")
            return True
        elif 'error' in data:
            print(f"   ⚠️ Erreur LLM: {data['error']}")
            return False
        else:
            print(f"   ⚠️ Réponse inattendue: {data}")
            return False
    except Exception as e:
        print(f"   ❌ Erreur parsing JSON: {e}")
        return False


def test_diagnostic():
    """Test endpoint diagnostic."""
    print("\n🔍 Test: Diagnostic système")
    
    status, body, error = make_request("/api/llm/diagnostic")
    
    if status == 200:
        try:
            data = json.loads(body)
            print(f"   ✅ Python: {data.get('python_version', 'N/A')[:30]}...")
            print(f"   ✅ Platform: {data.get('platform', 'N/A')}")
            print(f"   ✅ Vendor exists: {data.get('vendor_exists')}")
            print(f"   ✅ Vendor ready: {data.get('vendor_ready')}")
            print(f"   ✅ pip: {data.get('pip_path', 'Non détecté')[:50]}")
            if data.get('debug_file'):
                print(f"   ✅ Log file: {data.get('debug_file')}")
            return True
        except Exception as e:
            print(f"   ❌ Erreur parsing: {e}")
            return False
    else:
        print(f"   ❌ HTTP {status}: {error}")
        return False


def main():
    """Exécute tous les tests"""
    print("=" * 60)
    print("🧪 TEST DU GATEWAY LLM QGISIA+")
    print("=" * 60)
    print(f"\n📍 URL de test: {BASE_URL}")
    print("📍 Assure-toi que le plugin QGIS est démarré!")
    
    results = []
    
    # Test 1: Health (serveur répond?)
    results.append(("Health", test_health()))
    
    # Test 2: Liste modèles
    if results[-1][1]:  # Seulement si health OK
        results.append(("Models", test_models()))
    else:
        results.append(("Models", None))
        print("\n⚠️ Skipped (health failed)")
    
    # Test 3: Install
    if results[0][1]:  # Si serveur répond
        results.append(("Install", test_install()))
        
        # Attente vendor ready
        if results[-1][1]:
            vendor_ok = wait_for_vendor_ready(max_seconds=120)
            results.append(("Vendor Ready", vendor_ok))
    else:
        results.append(("Install", None))
        results.append(("Vendor Ready", None))
    
    # Test 4: Chat (optionnel, nécessite Ollama)
    results.append(("Chat (optionnel)", test_chat_simple()))
    
    # Test 5: Diagnostic (nouveau endpoint)
    if results[0][1]:  # Si serveur répond
        results.append(("Diagnostic", test_diagnostic()))
    else:
        results.append(("Diagnostic", None))
    
    # Résumé
    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ DES TESTS")
    print("=" * 60)
    
    for name, result in results:
        status = "✅ PASS" if result else ("❌ FAIL" if result is False else "⏭️ SKIP")
        print(f"   {status}: {name}")
    
    passed = sum(1 for _, r in results if r is True)
    failed = sum(1 for _, r in results if r is False)
    skipped = sum(1 for _, r in results if r is None)
    
    print(f"\n   Total: {passed} ✅ | {failed} ❌ | {skipped} ⏭️")
    
    if failed == 0:
        print("\n🎉 Tous les tests critiques passent! Le gateway est prêt.")
    else:
        print("\n⚠️ Certains tests ont échoué. Vérifie les messages ci-dessus.")
    
    return failed == 0


if __name__ == "__main__":
    try:
        ok = main()
        sys.exit(0 if ok else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrompu par l'utilisateur")
        sys.exit(130)
