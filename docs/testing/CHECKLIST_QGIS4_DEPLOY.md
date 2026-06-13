# Checklist Validation QGIS 4.0 — QGISIA+ v3.4

Ce document garantit que le plugin est 100% testable apres installation dans QGIS 4.0 (ou 3.16+).

---

## 1. Pre-installation (avant ZIP)

- [ ] **Version alignee** : `metadata.txt` version = `config.py` version = `package.json` version
- [ ] **Vendor/ pret** : dossier `QGISIA2/vendor/` contient `litellm/` + `.installed`
- [ ] **Frontend build** : `QGISIA2/web/` contient `index.html` + assets (resultat de `npm run build`)
- [ ] **Tests unitaires verts** : `python -m pytest tests/ -q` → tous passes (369+ tests)
- [ ] **Tests MCP verts** : `python -m pytest tests/test_mcp_server.py -v` → 17/17 passes
- [ ] **Tests agents verts** : `python -m pytest tests/test_agent_tools.py tests/test_agent_graph.py -v`

---

## 2. Installation ZIP dans QGIS

```
QGIS → Extensions → Installer depuis un ZIP → selectionner QGISIA_Plus_v3.4.zip
→ Activer l'extension "QGISIA2"
```

- [ ] ZIP importe sans erreur
- [ ] Plugin visible dans la liste des extensions
- [ ] Icone QGISIA+ apparait dans la barre d'outils / menu Extensions

---

## 3. Lancement & Serveur HTTP

- [ ] Cliquer sur **"Lancer QGISIA+"** → le navigateur s'ouvre sur `http://localhost:8157`
- [ ] Page de chargement s'affiche (pas d'erreur 404)
- [ ] Appel `GET http://localhost:8157/api/qgis/health` retourne `{"ok": true}`

---

## 4. Smoke Test Automatise (console Python QGIS)

Ouvrir la console Python dans QGIS et coller :

```python
import os
os.environ["QGISIA_PLUGIN_PARENT"] = r"C:/chemin/vers/QGISIA"
exec(open(r"C:/chemin/vers/QGISIA/tests/qgis4_validation_smoke.py").read())
```

- [ ] **Resultat attendu** : Tous les modules s'importent (40+ `import.*` = OK)
- [ ] `llm_installer.is_vendor_ready()` = `True`
- [ ] `mcp_server.list_tool_specs()` retourne 40+ outils
- [ ] `data_catalog.list_sources()` retourne des sources
- [ ] Aucune erreur Python dans la console

---

## 5. Gateway IA — Tests Fonctionnels

Dans l'UI navigateur (Parametres > Gateway IA) :

- [ ] Bouton **"Installer"** → installation des dependances (~30-60s) → statut "Pret"
- [ ] Clee NVIDIA NIM saisie → format OK (badge vert)
- [ ] Toggle **"Utiliser le Gateway"** ON
- [ ] Toggle **"Mode SIG Intelligent"** ON
- [ ] Toggle **"Mode Action"** ON

---

## 6. Chat & Agents — Tests Bout-en-Bout

| Test | Prompt attendu | Resultat attendu |
|------|---------------|------------------|
| [ ] Chat simple | "Bonjour, que sais-tu faire ?" | Reponse streaming, pas d'erreur |
| [ ] Agent tool-calling | "Liste les couches du projet" | Appel de `getLayersList`, resultat affiche |
| [ ] Fédération | "Calcule le NDVI sur cette zone" | Routage vers agent `code` ou `vision` |
| [ ] Mode Action | "Ajoute un fond OSM" | Couche OSM chargee dans QGIS |
| [ ] Guardrails | "Supprime toutes les couches" | Refus de l'agent (action destructive) |

---

## 7. Outils Raster & Analyse

- [ ] **NDVI** : `computeSpectralIndex` sur une image multi-bande → raster resultat
- [ ] **Detection changement** : `computeRasterDifference` (t2 - t1) → raster avec style divergent
- [ ] **Stats zonales** : `zonalStatistics` (NDVI moyen par parcelle) → couche avec nouveaux champs
- [ ] **Buffer** : `bufferLayer` sur une couche points → polygones tampons
- [ ] **Classification** : `classifyRaster` avec scheme `ndvi_vegetation` → style discret

---

## 8. Cartographie & Export

- [ ] **Planche** : `exportPrintLayout` (A4 portrait) → fichier PNG/PDF genere
- [ ] **Atlas** : `exportAtlas` sur une couche de communes → PDF multi-pages
- [ ] **Rapport** : `exportProjectReport` → PDF ou DOCX avec snapshot carte
- [ ] **Symbologie preset** : `applySymbologyPreset` (`onf-peuplements`) → style applique

---

## 9. Donnees & Connecteurs

- [ ] **Catalogue** : liste des sources > 80 items (fonds, satellite, admin, risques...)
- [ ] **Ajout source** : `addDataSource('osm-standard')` → couche chargee
- [ ] **Sentinel-2** : `loadSatelliteBands` avec bbox → bands chargees
- [ ] **COG distant** : `addRemoteRaster` avec URL `/vsicurl/...` → raster visible
- [ ] **Dossier 1-clic** : `runDossier('urbanisme')` → plusieurs couches + symbo charges

---

## 10. MCP Server (Claude Desktop / Cursor)

- [ ] SDK MCP installe : `pip install mcp httpx`
- [ ] Lancement manuel : `python -m QGISIA2.mcp_server` → attend sur stdin
- [ ] Configuration Claude Desktop :
  ```json
  {
    "mcpServers": {
      "qgisia-plus": {
        "command": "python",
        "args": ["-m", "QGISIA2.mcp_server"],
        "env": { "QGISIA_BRIDGE_URL": "http://localhost:8157" }
      }
    }
  }
  ```
- [ ] Redemarrer Claude Desktop → outils QGISIA+ visibles
- [ ] Test outil : "Liste les couches du projet QGIS" → retourne JSON valide

---

## 11. Compatibilite QGIS 4 (PyQt6)

- [ ] Aucun import `PyQt5` ou `PyQt6` en dur dans le code
- [ ] Tous les imports passent par `qgis.PyQt`
- [ ] `QFrame.Shape.Panel` / `QFrame.Shadow.Sunken` utilises (compat Qt6)
- [ ] `metadata.txt` : `qgisMaximumVersion=4.99`
- [ ] Teste sous QGIS 3.44 LTR ET QGIS 4.0 nightly

---

## 12. Securite & Guardrails

- [ ] **runScript** bloque `DROP TABLE`, `rm -rf`, `os.system('del')`
- [ ] **Mode Auto** : actions SAFE executees, actions CONFIRM demandent validation
- [ ] **Cle API** : jamais ecrite en clair dans les logs
- [ ] **Pas de cle hardcodee** dans le repo (verifier via `grep -r "sk-" QGISIA2/`)

---

## 13. Performance

- [ ] Demarrage du plugin < 5 secondes
- [ ] Premier chat < 3 secondes (warm-up gateway)
- [ ] Requete tool-calling < 10 secondes (NVIDIA NIM free tier)
- [ ] Memory usage stable (pas de fuite memoire apres 10 requetes)

---

## 14. Journal de validation

| Date | Testeur | QGIS Version | Python | Resultat | Notes |
|------|---------|--------------|--------|----------|-------|
| | | | | | |

---

## Commandes rapides

```bash
# Tests auto (hors QGIS)
python -m pytest tests/ -q --ignore=tests/manual --ignore=tests/qgis

# Validation smoke dans QGIS
python tests/qgis4_validation_smoke.py

# Build frontend
npm run build

# ZIP plugin
Compress-Archive -Path QGISIA2 -DestinationPath QGISIA_Plus_v3.4.zip
```
