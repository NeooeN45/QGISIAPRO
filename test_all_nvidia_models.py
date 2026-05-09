"""
Test de TOUS les modèles NVIDIA NIM disponibles un par un.
Usage: python test_all_nvidia_models.py <CLE_API_NVIDIA>
"""
import sys
import os
import time
import json

# Ajouter vendor au path
PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
VENDOR_DIR = os.path.join(PLUGIN_DIR, "QGISIA2", "vendor")
if os.path.exists(VENDOR_DIR) and VENDOR_DIR not in sys.path:
    sys.path.insert(0, VENDOR_DIR)

# Liste complète des modèles NVIDIA NIM
MODELS = {
    "text": [
        "meta/llama-3.1-8b-instruct",
        "meta/llama-3.1-70b-instruct",
        "meta/llama-3.1-405b-instruct",
        "meta/llama-3.3-70b-instruct",
        "nvidia/llama-3.1-nemotron-70b-instruct",
        "nvidia/nemotron-mini-4b-instruct",
        "mistralai/mixtral-8x22b-instruct-v0.1",
        "mistralai/mistral-large-2-instruct",
        "microsoft/phi-3-medium-128k-instruct",
        "google/gemma-2-27b-it",
        "qwen/qwen2-72b-instruct",
    ],
    "vision": [
        "microsoft/phi-3-vision-128k-instruct",
        "nvidia/llava-v1.6-34b",
        "meta/llama-3.2-11b-vision-instruct",
        "meta/llama-3.2-90b-vision-instruct",
    ],
}


def test_model(model_id: str, api_key: str, category: str) -> dict:
    """Test un modèle spécifique."""
    full_model = f"nvidia_nim/{model_id}"
    api_base = "https://integrate.api.nvidia.com/v1"
    
    # Prompt adapté à la catégorie
    if category == "vision":
        messages = [
            {"role": "user", "content": "Décris ce que tu vois sur une carte IGN."}
        ]
        max_tokens = 30
    else:
        messages = [
            {"role": "user", "content": "Dis 'OK' brièvement."}
        ]
        max_tokens = 10
    
    result = {
        "model": model_id,
        "category": category,
        "success": False,
        "error": None,
        "latency_ms": 0,
        "response": "",
    }
    
    try:
        import litellm
        
        start = time.time()
        response = litellm.completion(
            model=full_model,
            messages=messages,
            api_key=api_key,
            api_base=api_base,
            max_tokens=max_tokens,
            timeout=30,
        )
        elapsed = (time.time() - start) * 1000
        
        content = response.choices[0].message.content
        
        result["success"] = True
        result["latency_ms"] = round(elapsed, 1)
        result["response"] = content[:50].replace("\n", " ")
        
    except Exception as e:
        error_str = str(e)
        # Extraire le code d'erreur
        if "401" in error_str:
            result["error"] = "UNAUTHORIZED (clé invalide)"
        elif "404" in error_str:
            result["error"] = "NOT_FOUND (modèle non accessible)"
        elif "429" in error_str:
            result["error"] = "RATE_LIMIT (trop de requêtes)"
        elif "timeout" in error_str.lower():
            result["error"] = "TIMEOUT"
        else:
            result["error"] = error_str[:50]
    
    return result


def print_result(result: dict, index: int, total: int):
    """Affiche le résultat d'un test."""
    status = "✅" if result["success"] else "❌"
    category = result["category"]
    model = result["model"]
    
    print(f"\n[{index}/{total}] {status} {category.upper()} | {model}")
    
    if result["success"]:
        print(f"       Latence: {result['latency_ms']}ms")
        print(f"       Réponse: '{result['response'][:40]}...'")
    else:
        print(f"       Erreur: {result['error']}")


def main():
    # Récupérer la clé API
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
    else:
        api_key = os.environ.get("NVIDIA_API_KEY")
        if not api_key:
            print("Usage: python test_all_nvidia_models.py <NVIDIA_API_KEY>")
            sys.exit(1)
    
    print("=" * 70)
    print("🧪 TEST COMPLET DE TOUS LES MODÈLES NVIDIA NIM")
    print("=" * 70)
    print(f"Clé API: {api_key[:8]}...{api_key[-4:]}")
    print(f"API Endpoint: https://integrate.api.nvidia.com/v1")
    print()
    
    # Vérifier LiteLLM
    try:
        import litellm
        print(f"✓ LiteLLM prêt")
    except ImportError:
        print("✗ LiteLLM non disponible")
        sys.exit(1)
    
    # Collecter tous les modèles à tester
    all_models = []
    for category, models in MODELS.items():
        for model in models:
            all_models.append((category, model))
    
    total = len(all_models)
    print(f"\n📊 {total} modèles à tester")
    print("-" * 70)
    
    # Tester chaque modèle
    results = []
    for i, (category, model_id) in enumerate(all_models, 1):
        result = test_model(model_id, api_key, category)
        results.append(result)
        print_result(result, i, total)
        
        # Petite pause entre les tests pour éviter le rate limit
        if i < total:
            time.sleep(0.5)
    
    # Résumé final
    print("\n" + "=" * 70)
    print("📈 RÉSUMÉ")
    print("=" * 70)
    
    # Compteur par catégorie
    text_ok = sum(1 for r in results if r["category"] == "text" and r["success"])
    text_total = sum(1 for r in results if r["category"] == "text")
    vision_ok = sum(1 for r in results if r["category"] == "vision" and r["success"])
    vision_total = sum(1 for r in results if r["category"] == "vision")
    
    print(f"\nText:    {text_ok}/{text_total} modèles OK")
    print(f"Vision:  {vision_ok}/{vision_total} modèles OK")
    print(f"Total:   {text_ok + vision_ok}/{total} modèles OK")
    
    # Liste des modèles qui fonctionnent
    working = [r["model"] for r in results if r["success"]]
    not_working = [r["model"] for r in results if not r["success"]]
    
    if working:
        print(f"\n✅ MODÈLES FONCTIONNELS ({len(working)}):")
        for m in working:
            print(f"   • {m}")
    
    if not_working:
        print(f"\n❌ MODÈLES NON ACCESSIBLES ({len(not_working)}):")
        for m in not_working:
            r = next(r for r in results if r["model"] == m)
            print(f"   • {m} ({r['error']})")
    
    # Export JSON
    print("\n" + "-" * 70)
    print("Export des résultats...")
    output_file = "nvidia_models_test_results.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "api_key_preview": f"{api_key[:8]}...{api_key[-4:]}",
            "total_models": total,
            "working_models": len(working),
            "failed_models": len(not_working),
            "results": results,
        }, f, indent=2, ensure_ascii=False)
    print(f"✓ Résultats sauvegardés dans: {output_file}")
    
    return 0 if working else 1


if __name__ == "__main__":
    sys.exit(main())
