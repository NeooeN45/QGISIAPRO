"""
Test RAPIDE en conditions reelles - Modeles verifies avec la cle API.
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


def test_model_simple(api_key, model, prompt, max_tokens=100):
    """Test simple d'un modele."""
    try:
        from llm_gateway import chat
        
        response = chat(
            model=f"nvidia_nim/{model}",
            messages=[{"role": "user", "content": prompt}],
            api_keys={"nvidia_nim": api_key},
            stream=False,
            max_tokens=max_tokens,
        )
        
        content = response["choices"][0]["message"]["content"]
        return True, content
    except Exception as e:
        return False, str(e)


def main():
    print("=" * 70)
    print("TEST RAPIDE - MODELES VERIFIES NVIDIA NIM")
    print("=" * 70)
    
    api_key = "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"
    
    # Modeles qui ont fonctionne lors du test precedent
    working_models = [
        "meta/llama-3.1-70b-instruct",
        "meta/llama-3.1-405b-instruct", 
        "meta/llama-3.3-70b-instruct",
        "nvidia/nemotron-mini-4b-instruct",
        "mistralai/mixtral-8x22b-instruct-v0.1",
        "meta/llama-3.2-11b-vision-instruct",
        "meta/llama-3.2-90b-vision-instruct",
    ]
    
    print(f"\nCle API: {api_key[:8]}...{api_key[-4:]}")
    print(f"Modeles a tester: {len(working_models)}")
    print("-" * 70)
    
    results = []
    
    for i, model in enumerate(working_models, 1):
        print(f"\n[{i}/{len(working_models)}] Test de {model}...")
        
        prompt = "Dis 'OK NVIDIA' brièvement."
        start = time.time()
        success, content = test_model_simple(api_key, model, prompt, max_tokens=20)
        elapsed = time.time() - start
        
        if success:
            print(f"  ✅ OK en {elapsed:.1f}s: '{content[:50]}...'")
            results.append((model, True, elapsed))
        else:
            print(f"  ❌ ERREUR en {elapsed:.1f}s: {content[:50]}")
            results.append((model, False, elapsed))
    
    # Resume
    print("\n" + "=" * 70)
    print("RESUME")
    print("=" * 70)
    
    ok_count = sum(1 for _, ok, _ in results if ok)
    print(f"\nModeles fonctionnels: {ok_count}/{len(working_models)}")
    
    for model, ok, latency in results:
        status = "✅" if ok else "❌"
        print(f"{status} {model} ({latency:.1f}s)")
    
    if ok_count == len(working_models):
        print("\n🎉 Tous les modeles verifies fonctionnent!")
        print("   La federation d'agents est prete.")
    
    # Test agent federation structure
    print("\n" + "=" * 70)
    print("VERIFICATION STRUCTURE AGENTS")
    print("=" * 70)
    
    try:
        from agent_federation import AGENT_REGISTRY, AgentType
        print(f"\n✅ {len(AGENT_REGISTRY)} agents configures:")
        for agent_type, config in AGENT_REGISTRY.items():
            print(f"  • {agent_type.value}: {config.name}")
            print(f"    Modele: {config.model.split('/')[-1]}")
            print(f"    Fallbacks: {len(config.fallback_models)}")
    except Exception as e:
        print(f"\n❌ Erreur: {e}")
    
    return 0 if ok_count > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
