# -*- coding: utf-8 -*-
"""Tests des helpers purs de scripts/validate_nvidia_models.py (sans reseau)."""
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

import validate_nvidia_models as v  # noqa: E402


def test_flatten_dedupes_models():
    cands = {"a": ["m1", "m2"], "b": ["m2", "m3"]}
    pairs = v.flatten_candidates(cands)
    models = [m for _, m in pairs]
    assert models == ["m1", "m2", "m3"]  # m2 garde son premier role, pas de doublon


def test_build_entry_prefixes_provider():
    e = v.build_entry("code", "qwen/x", True, 123.4, None, "OK voila")
    assert e["model"] == "nvidia_nim/qwen/x"
    assert e["ok"] is True
    assert e["latency_ms"] == 123.4
    assert e["response_preview"] == "OK voila"


def test_summarize_counts_and_groups():
    results = [
        v.build_entry("router", "a", True, 10, None),
        v.build_entry("router", "b", False, 0, "TIMEOUT"),
        v.build_entry("code", "c", True, 20, None),
    ]
    s = v.summarize(results)
    assert s == {
        "total": 3,
        "working": 2,
        "failed": 1,
        "working_by_role": {
            "router": ["nvidia_nim/a"],
            "code": ["nvidia_nim/c"],
        },
    }


def test_resolve_api_key_prefers_argv(monkeypatch):
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    assert v.resolve_api_key(["prog", "nvapi-xyz"]) == "nvapi-xyz"


def test_resolve_api_key_falls_back_to_env(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "nvapi-fromenv")
    assert v.resolve_api_key(["prog", "--dry-run"]) == "nvapi-fromenv"


def test_resolve_api_key_none_when_absent(monkeypatch):
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    assert v.resolve_api_key(["prog"]) is None


def test_dry_run_makes_no_network_call(capsys):
    rc = v.main(["prog", "--dry-run"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "DRY-RUN" in out
    assert "nvidia_nim/" in out


def test_main_without_key_exits_nonzero(monkeypatch, capsys):
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    # Isole du .env.local reel (qui peut contenir une vraie cle)
    monkeypatch.setattr(v, "apply_env_files", lambda root: None)
    rc = v.main(["prog"])
    assert rc == 1
    assert "cle API NVIDIA requise" in capsys.readouterr().out


def test_load_env_file_parses_and_ignores_noise(tmp_path):
    f = tmp_path / ".env.local"
    f.write_text(
        "# commentaire\n"
        "\n"
        'NVIDIA_API_KEY="nvapi-abc"\n'
        "GROQ_API_KEY=gsk_x\n"
        "ligne_sans_egal\n",
        encoding="utf-8",
    )
    env = v.load_env_file(f)
    assert env == {"NVIDIA_API_KEY": "nvapi-abc", "GROQ_API_KEY": "gsk_x"}


def test_load_env_file_absent_returns_empty(tmp_path):
    assert v.load_env_file(tmp_path / "absent.env") == {}


def test_resolve_api_key_ignores_placeholder(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "colle_ta_cle_ici")
    assert v.resolve_api_key(["prog"]) is None


def test_apply_env_files_does_not_override_existing(monkeypatch, tmp_path):
    monkeypatch.setenv("NVIDIA_API_KEY", "nvapi-deja-la")
    (tmp_path / ".env.local").write_text("NVIDIA_API_KEY=nvapi-fichier", encoding="utf-8")
    v.apply_env_files(tmp_path)
    assert v.os.environ["NVIDIA_API_KEY"] == "nvapi-deja-la"
