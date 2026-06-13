# 🌲 PROMPT 11 — PSG Blueprint (Plans Simples de Gestion CNPF)

> **Copier/coller ce prompt dans Devin (Kimi 2.6)**  
> Durée estimée : 4-6 jours  
> Dépendances : ✅ ask_user, ✅ llm_gateway

---

## CONTEXTE PROJET COMPLET

Plugin QGIS "GeoSylva AI" — architecture stable :
- Backend : `QGISIA2/geoai_assistant.py` (5400+ lignes, bridge HTTP + agent federation)
- Frontend : `src/` (React 19 + Vite + Zustand, streaming SSE)
- LLM agents : 8 spécialisés (CODE_GENERATOR, VISION_ANALYZER, REASONING, etc.)
- Tool-calling : `QGISIA2/agent_tools.py` avec pause/reprise ask_user ✅ LIVRÉ
- MCP : `QGISIA2/mcp_server.py` expose 70+ tools (QGIS bridge + native)

**Pack Foresterie** = 4 modules purs Python (< 400 lignes chacun, zéro import qgis/PyQt) :
1. **PSG blueprint** (plans simples gestion CNPF)
2. burned_area (dNBR → polygones sévérité)
3. forest_classes (NDVI+NDMI → 6 classes IGN)
4. path_classifier (OSM + MNT → praticabilité)

**Spec complète** : `../product/VISION_METIERS.md` (section 1.1 PSG Blueprint)

---

## TÂCHE

Créer `QGISIA2/psg_blueprint.py` : **générateur PSG conforme CNPF 2024**

Génère un **Plan Simple de Gestion** (PS ou PSG) = document forestier réglementaire FR.  
Spécifications : CNPF (Centre National de la Propriété Forestière), 2024 standard.

**Complexité API** : 3 niveaux de profondeur (simplifié 2ans → standard 5ans → complet 10ans)

---

## API ATTENDUE

```python
# QGISIA2/psg_blueprint.py

def build_psg_blueprint(
    project_bbox: List[float],  # [x_min, y_min, x_max, y_max] Lambert 93
    depth: str,                  # "simplifie" | "standard" | "complet"
    forest_type: str,            # "feuillus" | "resineux" | "mixte"
    owner_name: Optional[str] = None,
    contact_email: Optional[str] = None,
) -> dict:
    """
    Génère un PSG structuré conforme CNPF.
    
    Args:
        project_bbox: Emprise Lambert 93 (4 floats)
        depth: 
            - "simplifie" → 2 ans, 3-5 opérations, entretien basique
            - "standard" → 5 ans, 8-15 opérations, gestion équilibrée
            - "complet" → 10 ans, 20-40 opérations, gestion intensive
        forest_type: composition dominante
        owner_name: optionnel, ex "SARL Forestière du Limousin"
        contact_email: optionnel, ex "contact@foret-limousin.fr"
    
    Returns: dict {
        "metadata": {
            "title": str,              # "Plan Simple de Gestion — [Commune]"
            "version": str,            # "CNPF 2024"
            "date_generated": ISO8601,
            "bbox": [x_min, y_min, x_max, y_max],
            "surface_hectares": float,
            "forest_type": str,
            "owner_name": str,
            "contact_email": str,
            "projection": "EPSG:2154",  # Lambert 93
        },
        "parcellaire": [  # Divisions foncières
            {
                "id": str,                   # "P001", "P002", ...
                "name": str,                 # "Parcelle Chêne Sud"
                "geometry": str,             # WKT Polygon (si possible)
                "surface_hectares": float,
                "crs": "EPSG:2154",
            }
        ],
        "peuplements": [  # Groupes d'arbres homogènes
            {
                "id": str,                      # "PEP001"
                "parcelle_id": str,             # ref à parcellaire[].id
                "essence_principale": str,      # "Chêne sessile", "Épicéa commun", ...
                "essence_pct": {                # composition %
                    "Chêne sessile": 70.0,
                    "Hêtre": 20.0,
                    "Pin sylvestre": 10.0,
                },
                "age_moyen_ans": int,           # 45
                "hauteur_moyenne_m": float,    # 25.5
                "densite_tiges_ha": int,       # 200
                "etat": str,                   # "sain" | "dépérissant" | "mixte"
                "descriptif": str,             # "Peuplement pur de hêtre, bien structuré"
            }
        ],
        "operations": [  # Coupes, travaux, entretien
            {
                "id": str,                              # "OP001"
                "year": int,                            # 2026
                "type": str,                            # "coupe_rase" | "eclaircie" | "coupe_sanitaire" | "travaux"
                "peuplements_ids": List[str],           # ["PEP001", "PEP002"]
                "volume_m3": float,                     # 150.5
                "rendement_net_eur": float,             # 4500 (valeur estimée)
                "cout_intervention_eur": float,         # 800 (débroussaillement, etc)
                "justification": str,                   # "Éclaircie de régulation, densité trop élevée"
                "cout_net_eur": float,                  # 3700 (= rendement - cout)
            }
        ],
        "restrictions": [  # Protections, contraintes
            {
                "type": str,  # "site_natura2000" | "foret_protection" | "site_archeologique" | "cours_eau"
                "peuplements_ids": List[str],
                "description": str,  # "Cours d'eau : zone 10m non-travaux"
            }
        ],
        "recommandations": [  # Conseil expert
            {
                "theme": str,  # "essences" | "densite" | "risques" | "biodiversite"
                "actions": List[str],
                "priorite": int,  # 1-3 (1=urgent, 3=opportun)
                "details": str,
            }
        ],
        "summary": {
            "duree_ans": int,           # 2, 5 ou 10
            "total_operations": int,
            "total_volume_m3": float,
            "total_rendement_eur": float,
            "total_cost_eur": float,
            "profit_eur": float,        # = rendement - cost
        }
    }


def validate_psg(psg: dict) -> dict:
    """
    Valide la structure PSG.
    
    Returns: {
        "valid": bool,
        "errors": List[str],     # Erreurs critiques (invalid si >0)
        "warnings": List[str],   # Avertissements (valide mais à vérifier)
    }
    
    Validations :
        - Tous peuplements ont parcelle_id existant
        - Années opérations cohérentes (croissance, not retroactif)
        - Densités raisonnables (30-500 tiges/ha)
        - Volume total plausible (5-50 m³/ha selon essence)
        - Superficie peuplements = bbox surface (variance < 5%)
    """
```

---

## DÉTAILS IMPLÉMENTATION

### 1. Données Métier (Hardcodées ou Lookup)

**Essences usuelles** (avec volumes/rendements indicatifs) :

```python
ESSENCES = {
    "Chêne sessile": {"volume_m3_ha": 8, "prix_m3_eur": 90},
    "Chêne pédonculé": {"volume_m3_ha": 7, "prix_m3_eur": 85},
    "Hêtre": {"volume_m3_ha": 9, "prix_m3_eur": 70},
    "Épicéa commun": {"volume_m3_ha": 12, "prix_m3_eur": 50},
    "Pin maritime": {"volume_m3_ha": 11, "prix_m3_eur": 55},
    "Pin sylvestre": {"volume_m3_ha": 10, "prix_m3_eur": 52},
    "Mélèze": {"volume_m3_ha": 11, "prix_m3_eur": 65},
    "Sapin blanc": {"volume_m3_ha": 10, "prix_m3_eur": 75},
}

TYPES_OPERATIONS = {
    "coupe_rase": {"cout_ha_eur": 800, "duree_ans": 2},
    "eclaircie": {"cout_ha_eur": 400, "duree_ans": 5},
    "coupe_sanitaire": {"cout_ha_eur": 600, "duree_ans": 3},
    "travaux": {"cout_ha_eur": 300, "duree_ans": 1},
}
```

**Âges typiques** par essence (pour peuplements générés) :
- Résineux plantation : 30-50 ans
- Feuillus mixtes : 45-80 ans
- Jeunes futaies : 15-30 ans

### 2. Niveaux Profondeur

**Simplifié (2 ans)** :
- 1-2 parcelles
- 2-3 peuplements
- 3-5 opérations (entretien basique)
- 0-1 restriction
- 2 recommandations

**Standard (5 ans)** :
- 3-5 parcelles
- 6-10 peuplements
- 8-15 opérations (mix entretien + coupes légères)
- 1-2 restrictions
- 4 recommandations

**Complet (10 ans)** :
- 5-8 parcelles
- 10-15 peuplements
- 20-40 opérations (coupes rase, éclaircies intensives, travaux)
- 2-4 restrictions
- 6+ recommandations

### 3. Génération Deterministe

**Pour reproductibilité** :
- Seed RNG basé sur `hash(bbox + forest_type + depth)`
- IDs déterministes (P001, PEP001, OP001, etc.)
- Volumes = essence lookup × surface × growth factor

### 4. Récommandations Expertise

Basées sur `forest_type` + `depth` + `age_moyen` :

```python
RECOMMENDATIONS_TEMPLATES = {
    "feuillus": {
        "essences": "Préférer les essences locales (chêne, hêtre) pour résilience climatique.",
        "densite": "Densité actuelle plausible. Éclaircie recommandée si >300 tiges/ha.",
        "risques": "Surveiller les maladies du chêne (maladie des truffes). Pas de traitement chimique.",
        "biodiversite": "Maintenir îlots de sénescence (2-5% de la surface).",
    },
    "resineux": {
        "essences": "Envisager mélange (épicéa + mélèze) pour robustesse.",
        "densite": "Régulation densité tous les 5-10 ans.",
        "risques": "Surveiller tordeuse du mélèze. Dépérissement si stress hydrique.",
        "biodiversite": "Éclaircie favorise flore herbacée.",
    },
}
```

### 5. Intégration ask_user

**Ask_user hooks** (optionnels, pour futur agent) :

```python
# Dans run_tool_loop, avant de générer PSG :
ask_user(
    question="Quel type de gestion préférez-vous?",
    options=["Simplifié (2 ans, entretien)", "Standard (5 ans)", "Complet (10 ans, intense)"],
)
# → response retourne depth sélectionné

ask_user(
    question="Quelle essence dominante?",
    options=["Feuillus (chêne, hêtre)", "Résineux (épicéa, pin)", "Mixte"],
)
# → response retourne forest_type
```

---

## TESTS REQUIS

**File** : `tests/test_psg_blueprint.py`

**Minimum 10 tests** :

```python
def test_build_psg_blueprint_simplifie():
    """Depth simplifié : 2 ans, 3-5 opérations."""
    psg = build_psg_blueprint(
        project_bbox=[700000, 6400000, 700500, 6400500],
        depth="simplifie",
        forest_type="feuillus",
    )
    assert psg["summary"]["duree_ans"] == 2
    assert 3 <= len(psg["operations"]) <= 5

def test_build_psg_blueprint_complet():
    """Depth complet : 10 ans, 20-40 opérations."""
    psg = build_psg_blueprint(
        project_bbox=[700000, 6400000, 701000, 6401000],
        depth="complet",
        forest_type="resineux",
    )
    assert psg["summary"]["duree_ans"] == 10
    assert 20 <= len(psg["operations"]) <= 40

def test_psg_forest_types():
    """Tester les 3 types forestiers."""
    for ftype in ["feuillus", "resineux", "mixte"]:
        psg = build_psg_blueprint([700000, 6400000, 700500, 6400500], "standard", ftype)
        assert psg["metadata"]["forest_type"] == ftype

def test_validate_psg_valid():
    """PSG générée est valide."""
    psg = build_psg_blueprint([700000, 6400000, 700500, 6400500], "standard", "feuillus")
    result = validate_psg(psg)
    assert result["valid"] is True
    assert len(result["errors"]) == 0

def test_validate_psg_invalid_peuplements():
    """Détection parcelle_id manquante."""
    psg = {...}  # PSG invalide avec peuplements.parcelle_id = "GHOST"
    result = validate_psg(psg)
    assert result["valid"] is False
    assert any("parcelle" in err.lower() for err in result["errors"])

def test_psg_deterministic():
    """Même bbox + depth + forest_type → même IDs."""
    bbox = [700000, 6400000, 700500, 6400500]
    psg1 = build_psg_blueprint(bbox, "standard", "feuillus")
    psg2 = build_psg_blueprint(bbox, "standard", "feuillus")
    assert psg1["parcellaire"][0]["id"] == psg2["parcellaire"][0]["id"]

def test_psg_volume_plausible():
    """Volume total plausible (5-50 m³/ha selon essence)."""
    psg = build_psg_blueprint([700000, 6400000, 700500, 6400500], "standard", "feuillus")
    surface_ha = psg["metadata"]["surface_hectares"]
    volume_m3_ha = psg["summary"]["total_volume_m3"] / surface_ha if surface_ha > 0 else 0
    assert 5 <= volume_m3_ha <= 50

def test_psg_rendement_positif():
    """Rendement net positif (profit > 0 sauf coupe rase jeune)."""
    psg = build_psg_blueprint([700000, 6400000, 701000, 6401000], "complet", "feuillus")
    # Complet = plusieurs années, rendement cumulé doit être > cout
    # Laisser négatif pour jeunes peuplements, OK

def test_psg_with_owner():
    """Owner name et email optionnels, stockés."""
    psg = build_psg_blueprint(
        [700000, 6400000, 700500, 6400500],
        "standard",
        "feuillus",
        owner_name="EARL Montagne",
        contact_email="earl@montagne.fr",
    )
    assert psg["metadata"]["owner_name"] == "EARL Montagne"
    assert psg["metadata"]["contact_email"] == "earl@montagne.fr"

def test_psg_restrictions():
    """PSG contient restrictions (Natura 2000, cours eau, etc)."""
    psg = build_psg_blueprint(
        [700000, 6400000, 700500, 6400500],
        "complet",
        "feuillus",
    )
    # Complet doit avoir ≥ 1 restriction (simulation realiste)
    if len(psg["restrictions"]) > 0:
        assert "type" in psg["restrictions"][0]
        assert "peuplements_ids" in psg["restrictions"][0]
```

---

## SYMBOLOGIES QML

**File** : `QGISIA2/symbologies/foresterie/peuplements_essence.qml`

Créer style QGIS catégorisé par essence principale :

```xml
<qgis>
  <!-- Catégories par essence_principale -->
  <category label="Chêne sessile" value="Chêne sessile">
    <symbol type="fill">
      <layer enabled="1" type="SimpleFill">
        <prop k="color" v="76,110,63,255"/>  <!-- Vert foncé -->
      </layer>
    </symbol>
  </category>
  <category label="Hêtre" value="Hêtre">
    <symbol type="fill">
      <layer enabled="1" type="SimpleFill">
        <prop k="color" v="107,142,35,255"/>  <!-- Vert moyen -->
      </layer>
    </symbol>
  </category>
  <category label="Épicéa commun" value="Épicéa commun">
    <symbol type="fill">
      <layer enabled="1" type="SimpleFill">
        <prop k="color" v="25,25,112,255"/>  <!-- Bleu nuit -->
      </layer>
    </symbol>
  </category>
  <!-- ... plus essences ... -->
</qgis>
```

---

## LIVRAISON

### Fichiers à Créer

1. **`QGISIA2/psg_blueprint.py`** (< 400 lignes)
   - Fonctions `build_psg_blueprint`, `validate_psg`
   - Données métier (ESSENCES, TYPES_OPERATIONS)
   - Recommandations templates

2. **`tests/test_psg_blueprint.py`** (>= 10 tests)
   - pytest `-q` doit afficher "10 passed"

3. **`QGISIA2/symbologies/foresterie/peuplements_essence.qml`**
   - Catégorisé par essence, couleurs IGN standard

### Fichiers à Modifier

- Optionnel : ajouter import dans `QGISIA2/__init__.py`
  ```python
  from .psg_blueprint import build_psg_blueprint, validate_psg
  ```

### Branche & Gate

- **Branche** : `kimi/psg-blueprint`
- **Tests** :
  ```bash
  python -m pytest tests/test_psg_blueprint.py -q
  # Expected: 10 passed
  ```
- **Linting** :
  ```bash
  python -m py_compile QGISIA2/psg_blueprint.py
  ```
- **No imports** : vérifier zéro `import qgis`, zéro `import PyQt*`

### Commit Message

```
feat(psg-blueprint): Plans Simples de Gestion CNPF 2024

- build_psg_blueprint() : 3 niveaux profondeur (simplifié/standard/complet)
- validate_psg() : validation structure + contraintes métier
- 10 tests : forest_types, depths, determinism, volume plausibility
- symbologies QML : essence → couleur IGN
- ask_user hooks ready (pour agent foresterie futur)

Tests: 10/10 passed
Imports: ✓ zero qgis/PyQt (pure Python module)

Co-Authored-By: Kimi 2.6 (Devin Agent) <kimi@anthropic.com>
```

---

## RÉFÉRENCES EXTERNES

- **CNPF** : http://www.cnpf.gouv.fr (PSG standard officiel)
- **IGN Essences** : https://www.ign.fr (nomenclature forestière)
- **DSFi** (Décision Support Forestier) : volumes/rendements par essence

---

## QUESTIONS FRÉQUENTES

**Q: PSG doit être connecté à ask_user maintenant?**  
A: Non, `build_psg_blueprint()` standalone pour now. Ask_user integration dans agent_runner futur (PROMPT 15).

**Q: Données métier (volumes, prix) basées sur quoi?**  
A: Lookup tables hardcodées (ESSENCES, TYPES_OPERATIONS). Idéal = DB externe, mais hors scope module pur.

**Q: Geometry WKT obligatoire dans peuplements?**  
A: Non, optionnel. Parcellaire peut être simple {id, surface_ha} sans géom.

**Q: Validation superficie : comment vérifier contre bbox?**  
A: Somme(peuplements.surface_ha) ≈ bbox_area ± 5% (variance terrain).

---

**Bon courage!** 🌲

