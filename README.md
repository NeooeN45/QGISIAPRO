<div align="center">

# 🌲 GeoSylva AI — Assistant IA pour QGIS

**Un assistant SIG intelligent directement dans QGIS.**  
Parlez à vos données géographiques, générez du code PyQGIS, analysez vos couches — le tout avec l'IA.

**Version courante : 3.4** — source unique de vérité : fichier `VERSION` à la racine.

**Nom produit** : « GeoSylva AI » (marketing) = plugin QGIS « QGISIA2 » (identifiant technique). Aucun renommage de code à ce stade — note de cohérence uniquement.

[![QGIS](https://img.shields.io/badge/QGIS-3.16%2B%20%7C%204.0-green?logo=qgis&logoColor=white)](https://qgis.org)
[![Python](https://img.shields.io/badge/Python-3.9%2B-blue?logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![License](https://img.shields.io/badge/Licence-MIT-orange)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)](https://github.com/NeooeN45/QGISIA2)

</div>

---

## ✨ Fonctionnalités

<table>
<tr>
<td width="50%">

### 🤖 IA Multi-Provider
- **Ollama local** — Gemma 4, Qwen3, Llama 3 (100% offline)
- **Google Gemini** — gemini-2.5-flash
- **OpenRouter** — orchestration multi-agent (GPT-4, Claude, Mistral…)
- **HuggingFace** — accès aux derniers modèles

</td>
<td width="50%">

### 🗺️ Actions QGIS Directes
- Gérer couches (visibilité, opacité, zoom, filtres)
- Exécuter des scripts **PyQGIS** générés par l'IA
- Reprojection, buffers, calculs raster
- Chargement WMS / WFS / XYZ / GeoJSON

</td>
</tr>
<tr>
<td width="50%">

### 📡 Services Officiels Intégrés
- 🇫🇷 IGN / Géoplateforme / cartes.gouv.fr
- 🏛️ API Carto Cadastre & geo.api.gouv.fr
- 🌍 Overpass / OpenStreetMap
- 🛰️ Copernicus Data Space & NASA Earthdata

</td>
<td width="50%">

### 🧠 Orchestration Avancée
- Pipeline multi-agent : **Planner → Reviewer → Executor**
- Reranking embeddings pour un contexte optimal
- Mode `plan d'exécution` avant toute action
- Diagnostic automatique des couches

</td>
</tr>
</table>

---

## 🚀 Installation

### Méthode ZIP (recommandée — 2 minutes)

```
1. Télécharger GeoSylva_AI_QGIS_plugin.zip (bouton vert ci-dessus)
2. QGIS → Extensions → Installer depuis un ZIP
3. Sélectionner le ZIP → Installer
4. Activer "GeoSylva AI" dans la liste des extensions
```

> **Aucun serveur externe requis.** Le plugin lance automatiquement son interface web et se connecte à QGIS via un bridge local.

### Prérequis optionnels

| Besoin | Solution |
|--------|----------|
| IA locale (offline) | [Ollama](https://ollama.com) + `ollama pull gemma4:e4b` |
| Meilleure qualité cloud | Clé API [OpenRouter](https://openrouter.ai) ou [Gemini](https://aistudio.google.com) |

---

## 🤖 Modèles IA Supportés

### Local (Ollama — gratuit, offline)

| Modèle | Taille | Recommandé Pour |
|--------|--------|-----------------|
| `gemma4:e4b` ⭐ | 9.6 GB | **Meilleur compromis — multimodal** |
| `gemma4:e2b` | 7.2 GB | Machines modestes |
| `gemma4:26b` | 18 GB | Qualité supérieure (MoE) |
| `qwen3:4b` | 2.5 GB | Ultra-léger et rapide |

### Cloud (clé API requise)

| Provider | Modèle | Usage |
|----------|--------|-------|
| Google Gemini | `gemini-2.5-flash` | Rapide et gratuit |
| OpenRouter | Multi-agent configurable | Qualité maximale |

---

## 🛠️ Développement

```bash
# Cloner et installer
git clone https://github.com/NeooeN45/QGISIA2.git
cd QGISIA2
npm install

# Développement live
npm run dev        # → http://localhost:5173

# Build pour le plugin
npm run build      # → génère qgis_plugin/web/
```

**Variables d'environnement** (`.env.local`) :
```env
VITE_GEMINI_API_KEY=...
VITE_OPENROUTER_API_KEY=...
```

---

## 🗂️ Ce que l'IA peut faire dans QGIS

```
✅ Lister et analyser les couches du projet
✅ Lire les champs attributaires et diagnostiquer la qualité
✅ Appliquer filtres, styles, visibilité et zoom
✅ Générer et exécuter des scripts PyQGIS
✅ Reprojeter des couches vectorielles
✅ Charger des services WMS / WFS / XYZ
✅ Calculer statistiques, rasters, MNH
✅ Stylage parcellaire et étiquetage automatique
✅ Fusion multi-bandes NDVI / CRswir
✅ Créer grilles d'inventaire et centroides
```

---

## 🏗️ Architecture

```
QGIS Plugin (Python)
    └── Lance un serveur web local (Flask)
        └── Sert l'interface React (Vite + TailwindCSS)
            └── Communique avec le bridge QGIS via WebSocket
                └── Appelle Ollama / Gemini / OpenRouter selon config
```

---

## 🤝 Compatibilité

| Plateforme | Status |
|------------|--------|
| Windows 10/11 | ✅ Supporté |
| Linux (Ubuntu 20.04+) | ✅ Supporté |
| macOS 12+ | ✅ Supporté |
| QGIS 3.16+ | ✅ |
| QGIS 4.0 (Qt6/PyQt6) | ✅ |
| Python 3.9+ | ✅ |

---

<div align="center">

**Fait avec ❤️ pour la communauté SIG francophone**

[⭐ Mettre une étoile](https://github.com/NeooeN45/QGISIA2) · [🐛 Signaler un bug](https://github.com/NeooeN45/QGISIA2/issues) · [💡 Proposer une fonctionnalité](https://github.com/NeooeN45/QGISIA2/issues)

</div>
