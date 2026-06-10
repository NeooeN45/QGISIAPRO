# -*- coding: utf-8 -*-
"""
Validation LIVE du catalogue NVIDIA NIM (juin 2026).

Teste chaque modele candidat via le gateway LiteLLM et ecrit le resultat dans
QGISIA2/config/models.validated.json (modeles OK + latences + erreurs).

Securite : la cle API n'est JAMAIS en dur. Elle est lue depuis argv[1] ou la
variable d'environnement NVIDIA_API_KEY. Le script sort en erreur si absente.

Usage :
    python scripts/validate_nvidia_models.py <NVIDIA_API_KEY>
    # ou : $env:NVIDIA_API_KEY='nvapi-...' ; python scripts/validate_nvidia_models.py
    python scripts/validate_nvidia_models.py --dry-run   # liste les candidats, 0 appel reseau
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

# Racine + plugin sur le path (scripts/ est 1 niveau sous la racine)
ROOT = Path(__file__).resolve().parent.parent
PLUGIN_DIR = ROOT / "QGISIA2"
VENDOR_DIR = PLUGIN_DIR / "vendor"
for p in (VENDOR_DIR, PLUGIN_DIR):
    if p.is_dir() and str(p) not in sys.path:
        sys.path.insert(0, str(p))

OUTPUT_PATH = PLUGIN_DIR / "config" / "models.validated.json"

# Candidats issus du benchmark A1 (catalogue gratuit juin 2026), groupes par role.
# Prefixe LiteLLM 'nvidia_nim/<owner>/<model>'.
CANDIDATES: dict[str, list[str]] = {
    "router": [
        "nvidia/nemotron-3-nano-30b-a3b",
        "nvidia/nemotron-mini-4b-instruct",
    ],
    "general": [
        "nvidia/nemotron-3-super-120b-a12b",
        "meta/llama-3.3-70b-instruct",
        "openai/gpt-oss-120b",
    ],
    "reasoning": [
        "nvidia/nemotron-3-ultra-550b-a55b",
        "deepseek-ai/deepseek-v4-flash",
        "z-ai/glm-5.1",
        "meta/llama-3.1-70b-instruct",
    ],
    "code": [
        "qwen/qwen3-coder-480b-a35b-instruct",
        "mistralai/mistral-small-4-119b-2603",
    ],
    "vision_fast": [
        "nvidia/nemotron-nano-12b-v2-vl",
        "meta/llama-3.2-11b-vision-instruct",
    ],
    "vision_deep": [
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        "qwen/qwen3.5-397b-a17b",
        "meta/llama-3.2-90b-vision-instruct",
    ],
    "doc_intel": [
        "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
        "microsoft/phi-4-multimodal-instruct",
    ],
    "extract_json": [
        "mistralai/mistral-large-3-675b-instruct-2512",
    ],
    "safety": [
        "nvidia/nemotron-3.5-content-safety",
        "nvidia/llama-3.1-nemotron-safety-guard-8b-v3",
    ],
    "translate": [
        "nvidia/riva-translate-4b-instruct-v1.1",
    ],
}


def flatten_candidates(candidates: dict[str, list[str]]) -> list[tuple[str, str]]:
    """Aplatit le dict role->[models] en [(role, model)] sans doublon de modele."""
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for role, models in candidates.items():
        for model in models:
            if model not in seen:
                seen.add(model)
                out.append((role, model))
    return out


def build_entry(role: str, model: str, ok: bool, latency_ms: float,
                error: str | None, response: str = "") -> dict:
    """Construit une entree de resultat normalisee."""
    return {
        "role": role,
        "model": f"nvidia_nim/{model}",
        "ok": ok,
        "latency_ms": round(latency_ms, 1),
        "error": error,
        "response_preview": (response or "")[:60],
    }


def summarize(results: list[dict]) -> dict:
    """Resume les resultats (compteurs + modeles OK par role)."""
    ok = [r for r in results if r["ok"]]
    by_role: dict[str, list[str]] = {}
    for r in ok:
        by_role.setdefault(r["role"], []).append(r["model"])
    return {
        "total": len(results),
        "working": len(ok),
        "failed": len(results) - len(ok),
        "working_by_role": by_role,
    }


# Valeurs placeholder a ignorer (fichier .env.local non rempli)
PLACEHOLDERS = {"", "colle_ta_cle_ici", "ta_cle_ici", "ta_nouvelle_cle", "nvapi-xxx"}


def load_env_file(path: Path) -> dict:
    """Parse un .env simple (KEY=VALUE). Ignore commentaires et lignes vides."""
    env: dict[str, str] = {}
    if not path.is_file():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        key, _, val = s.partition("=")
        env[key.strip()] = val.strip().strip('"').strip("'")
    return env


def apply_env_files(root: Path) -> None:
    """Charge .env.local puis .env (sans ecraser les variables deja definies)."""
    for name in (".env.local", ".env"):
        for key, val in load_env_file(root / name).items():
            os.environ.setdefault(key, val)


def resolve_api_key(argv: list[str]) -> str | None:
    """Cle depuis argv (hors flags) sinon NVIDIA_API_KEY. Ignore les placeholders."""
    for arg in argv[1:]:
        if not arg.startswith("-") and arg not in PLACEHOLDERS:
            return arg
    key = os.environ.get("NVIDIA_API_KEY", "")
    return key if key not in PLACEHOLDERS else None


def _probe_model(model: str, api_key: str, timeout: int = 30) -> tuple[bool, float, str | None, str]:
    """Appelle un modele via le gateway. Retourne (ok, latency_ms, error, preview)."""
    from llm_gateway import chat  # import tardif : vendor doit etre pret
    start = time.time()
    try:
        resp = chat(
            model=f"nvidia_nim/{model}",
            messages=[{"role": "user", "content": "Reponds uniquement: OK"}],
            api_keys={"nvidia_nim": api_key},
            stream=False,
            max_tokens=8,
        )
        latency = (time.time() - start) * 1000
        content = resp["choices"][0]["message"]["content"] or ""
        return True, latency, None, content
    except Exception as exc:  # noqa: BLE001
        latency = (time.time() - start) * 1000
        return False, latency, str(exc)[:160], ""


def run(api_key: str) -> dict:
    """Valide tous les candidats en live et ecrit models.validated.json."""
    pairs = flatten_candidates(CANDIDATES)
    results: list[dict] = []
    print(f"Validation de {len(pairs)} modeles candidats via le gateway NVIDIA NIM...\n")
    for role, model in pairs:
        ok, latency, error, preview = _probe_model(model, api_key)
        status = "OK " if ok else "KO "
        print(f"  [{status}] {role:12s} {model:55s} {latency:7.0f}ms"
              + (f"  -> {error}" if error else ""))
        results.append(build_entry(role, model, ok, latency, error, preview))

    summary = summarize(results)
    payload = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "api_key_preview": f"{api_key[:8]}...{api_key[-4:]}",
        "summary": summary,
        "results": results,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nResultat ecrit : {OUTPUT_PATH}")
    print(f"OK {summary['working']}/{summary['total']}  |  KO {summary['failed']}")
    return payload


def main(argv: list[str]) -> int:
    if "--dry-run" in argv:
        pairs = flatten_candidates(CANDIDATES)
        print(f"DRY-RUN : {len(pairs)} modeles candidats (aucun appel reseau)\n")
        for role, model in pairs:
            print(f"  {role:12s} nvidia_nim/{model}")
        return 0

    apply_env_files(ROOT)
    api_key = resolve_api_key(argv)
    if not api_key:
        print("ERREUR: cle API NVIDIA requise.")
        print("  Astuce: mets ta cle dans .env.local (NVIDIA_API_KEY=...) a la racine.")
        print("  Usage: python scripts/validate_nvidia_models.py <NVIDIA_API_KEY>")
        print("     ou: $env:NVIDIA_API_KEY='nvapi-...' ; python scripts/validate_nvidia_models.py")
        return 1

    run(api_key)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
