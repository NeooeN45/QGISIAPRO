# DEVIN_SIGNATURE — Traçabilité des implémentations Devin CLI

> **Superviseur du projet** : Claude Code 4.8 (Camil)
> **Agent d'implémentation** : Devin CLI (Cognition AI) — [@devin-ai-integration](https://github.com/devin-ai-integration)
> **Principe** : Tout code écrit par Devin est identifiable, auditable et réversible.

---

## Pourquoi ce fichier ?

Ce projet QGISIA+ est supervisé par un humain (Camil) assisté de Claude Code 4.8.
Devin CLI est l'**exécutant technique** — il ne décide pas de l'architecture, il
l'**implémente** selon les specs validées. Ce document garantit la traçabilité
complète de chaque contribution Devin.

**Règle d'or** : aucun code Devin ne part en production sans review humaine.

---

## Pastille de signature — décorateur Python

Chaque fonction, classe ou module écrit par Devin porte le décorateur `@devin_authored`
(défini dans `QGISIA2/devin_utils.py`). Il :
1. Ajoute un attribut `__devin_authored__ = True` à la fonction/classe
2. Logue le module et la fonction dans `DEVIN_AUDIT.log` (non commité, dans `.gitignore`)
3. N'altère **pas** le comportement fonctionnel

```python
from QGISIA2.devin_utils import devin_authored

@devin_authored
def ma_fonction():
    ...
```

Les fichiers **entièrement** écrits par Devin portent ce header en haut :

```python
# ═══════════════════════════════════════════════════════════════════════════════
# IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI)
# Superviseur : Claude Code 4.8 — Camil
# Date : YYYY-MM-DD | Branche : <branch>
# Review obligatoire avant merge dans main.
# ═══════════════════════════════════════════════════════════════════════════════
```

---

## Journal des implémentations Devin

| Date | Fichier(s) | Description | Tests | Statut |
|------|-----------|-------------|-------|--------|
| 2026-06-08 | `QGISIA2/devin_utils.py` | Décorateur @devin_authored + SecurityAuditLog | `tests/test_devin_utils.py` | ✅ |
| 2026-06-08 | `QGISIA2/security_layer.py` | Rate limiting + sanitisation HTTP bridge | `tests/test_security_layer.py` | ✅ |
| 2026-06-08 | `QGISIA2/predict_trend_slot.py` | Slot bridge predict_trend → geoai_assistant | `tests/test_predict_trend_slot.py` | ✅ |
| 2026-06-08 | `QGISIA2/voice_pipeline.py` | Pipeline voix→intention→action QGIS | `tests/test_voice_pipeline.py` | ✅ |
| 2026-06-08 | `src/components/DataPanel.tsx` | Panneau Données React (catalogue + Sentinel) | — (vitest) | ✅ |
| 2026-06-08 | `src/components/DiagnosticPanel.tsx` | Panneau Diagnostic satellite React | — (vitest) | ✅ |
| 2026-06-08 | `src/components/DossierPanel.tsx` | Panneau Dossiers 1-clic React | — (vitest) | ✅ |

---

## Règles Devin pour ce projet

1. **Lire avant d'écrire** — tout fichier modifié est relu intégralement avant édition
2. **Tests first** — chaque feature Devin a son test avant l'implémentation
3. **Pas de secrets** — zéro clé API, zéro credential dans le code Devin
4. **Pas de destructif** — jamais de `rm -rf`, `DROP TABLE`, suppression de données
5. **Pas de breaking change** — les signatures publiques existantes sont préservées
6. **Un commit par feature** — commits atomiques, message Conventional Commits
7. **Pastille obligatoire** — tout nouveau fichier Python porte le header Devin

---

## Comment auditer le code Devin

```bash
# Lister tous les fichiers portant la pastille Devin
grep -rl "IMPLÉMENTÉ PAR DEVIN CLI" QGISIA2/ src/ tests/

# Voir le log d'audit runtime
cat DEVIN_AUDIT.log

# Lister les fonctions décorées
python -c "
import ast, pathlib
for p in pathlib.Path('QGISIA2').rglob('*.py'):
    src = p.read_text(encoding='utf-8', errors='ignore')
    if 'devin_authored' in src:
        print(p)
"
```

---

*Document généré par Devin CLI — supervisé par Claude Code 4.8 (Camil)*
*Ne pas supprimer : ce fichier est la source de traçabilité des contributions Devin.*
