# 🤖 Fédération d'Agents NVIDIA NIM - QGISIA+

## Architecture Multi-Agents

Avec **150+ modèles NVIDIA NIM**, QGISIA+ dispose d'une **fédération d'agents spécialisés** qui collaborent pour résoudre des tâches complexes.

### 🎯 Principe

```
Requête Utilisateur
       ↓
┌─────────────────┐
│  Intent Router  │  ← Nemotron Mini 4B (rapide)
│  (Routing)      │
└─────────────────┘
       ↓
┌─────────────────┐
│ Agent Spécialisé │  ← Meilleur modèle pour la tâche
│   (Exécution)   │
└─────────────────┘
       ↓
┌─────────────────┐
│  Safety Guard   │  ← Nemoguard 8B (vérification)
│  (Validation)   │
└─────────────────┘
       ↓
   Réponse
```

---

## 📋 Agents Disponibles

### 1. 🎛️ Intent Router
- **Modèle**: `nvidia/nemotron-mini-4b-instruct`
- **Temp**: 0.0 (déterministe)
- **Rôle**: Analyse la requête et route vers le bon agent
- **Fallback**: Llama 3.1 8B

### 2. 💻 PyQGIS Code Generator
- **Modèle**: `qwen/qwen2.5-coder-32b-instruct`
- **Temp**: 0.1 (précis)
- **Rôle**: Génère du code Python pour QGIS/GDAL
- **Fallbacks**: Codestral 22B, DeepSeek Coder, CodeLlama 70B
- **Cas d'usage**:
  - Scripts de traitement raster
  - Analyses vectorielles
  - Plugins QGIS
  - GDAL bindings

### 3. 👁️ Vision Cartographique
- **Modèle**: `meta/llama-3.2-90b-vision-instruct`
- **Temp**: 0.2
- **Rôle**: Analyse d'images géospatiales
- **Fallback**: Llama 3.2 11B Vision
- **Cas d'usage**:
  - Lecture de cartes IGN
  - Analyse d'orthophotos
  - Extraction de légendes
  - Détection de changements
  - Interprétation de plans

### 4. 🧠 Spatial Reasoning Expert
- **Modèle**: `nvidia/llama-3.1-nemotron-ultra-253b-v1`
- **Temp**: 0.2
- **Rôle**: Raisonnement spatial avancé
- **Fallbacks**: Nemotron 4 340B, Llama 3.1 405B, DeepSeek v4 Pro
- **Cas d'usage**:
  - Analyses de proximité
  - Optimisation de localisation
  - Analyses de réseaux
  - Requêtes spatiales complexes
  - Analyses multicritères

### 5. 📝 Content Synthesizer
- **Modèle**: `nvidia/llama-3.3-nemotron-super-49b-v1.5`
- **Temp**: 0.3
- **Rôle**: Synthèse et reformulation
- **Cas d'usage**:
  - Résumés de rapports
  - Documentation simplifiée
  - Points clés

### 6. 🌍 Multilingual Translator
- **Modèle**: `nvidia/riva-translate-4b-instruct-v1.1`
- **Temp**: 0.0
- **Rôle**: Traduction FR↔EN technique
- **Cas d'usage**:
  - Traduction de documentation SIG
  - Terminologie technique

### 7. 🛡️ Content Safety Guard
- **Modèle**: `nvidia/llama-3.1-nemoguard-8b-content-safety`
- **Temp**: 0.0
- **Rôle**: Vérification de sécurité
- **Cas d'usage**:
  - Validation du code généré
  - Détection de contenu sensible

### 8. 🔍 Structured Data Extractor
- **Modèle**: `mistralai/mistral-large-3-675b-instruct-2512`
- **Temp**: 0.1
- **Rôle**: Extraction JSON structurée
- **Cas d'usage**:
  - Extraction de coordonnées
  - Parsing de métadonnées
  - Structuration de données

### 9. 🗺️ QGIS Native Expert
- **Modèle**: `meta/llama-3.3-70b-instruct`
- **Temp**: 0.2
- **Rôle**: Expertise QGIS native
- **Cas d'usage**:
  - Questions sur l'interface
  - Processing framework
  - Expressions et calculateur
  - Styles et symbologie

---

## 🔄 Workflows Multi-Agents

### Workflow 1: Génération de Code (Simple)
```python
Description → Extracteur → Code Generator → Safety Guard
```

**Exemple**: *"Crée un buffer de 500m autour des écoles"*
1. Extraction des paramètres (distance: 500m, entité: écoles)
2. Génération du code PyQGIS
3. Vérification sécurité

### Workflow 2: Analyse de Carte (Complexe)
```python
Image → Vision Analyzer → Extracteur → Raisonnement → Code Generator
```

**Exemple**: *"Analyse cette carte IGN et identifie les zones constructibles"*
1. Analyse visuelle de la carte
2. Extraction des entités (zones, légende, échelle)
3. Raisonnement spatial sur les contraintes
4. Génération du script d'analyse

### Workflow 3: Raisonnement Spatial
```python
Requête → Reasoning → Synthétiseur → Code Generator
```

**Exemple**: *"Quelle est la meilleure localisation pour une nouvelle école?"*
1. Analyse multicritère (proximité, densité, accessibilité)
2. Synthèse du plan d'action
3. Code d'optimisation spatiale

### Workflow 4: Extraction & Traitement
```python
Texte → Extracteur → Validation → Code Import
```

**Exemple**: *"Extrait les coordonnées GPS de ce rapport et crée une couche"*
1. Extraction JSON des coordonnées
2. Validation du format
3. Code d'import

### Workflow 5: Traduction & Code
```python
EN → Translator → Code Generator (FR comments)
```

**Exemple**: *"Translate this GDAL command to PyQGIS with French comments"*

### Workflow 6: Analyse Multi-Agents (Parallèle)
```python
        ┌→ Technical Analysis (QGIS Expert)
        │
Requête ├→ Spatial Analysis (Reasoning)
        │
        └→ Synthesis (Summarizer)
```

**Exemple**: *"Analyse cette requête sous tous les angles"*

### Workflow 7: Code Vérifié
```python
Code Generator → Safety Guard → [Correction si UNSAFE]
```

---

## 💡 Cas d'Usage Avancés

### 1. Agent Router Intelligent
```python
# Le router analyse la complexité et choisit:
- "Buffer simple" → Code Generator direct
- "Analyse de carte complexe" → Workflow MAP_ANALYSIS
- "Question sur QGIS" → QGIS Expert
```

### 2. Fallback Automatique
Si un modèle échoue (timeout, rate limit), l'agent bascule automatiquement vers les modèles de fallback.

### 3. Parallélisation
Pour les analyses complexes, plusieurs agents travaillent en parallèle:
- Vision + Code pour images
- Reasoning + QGIS Expert pour analyses

### 4. Mémoire de Contexte
Les workflows maintiennent le contexte entre les étapes:
```python
Étape 1: Extraction → context["entities"] = {...}
Étape 2: Reasoning → utilise context["entities"]
Étape 3: Code → utilise context["spatial_analysis"]
```

---

## 🛠️ Utilisation dans le Code

### Exécution Simple
```python
from agent_federation import AgentFederation

federation = AgentFederation(api_keys={"nvidia_nim": "xxx"})

# Router automatique
result = federation.process("Crée un buffer de 500m")

# Agent spécifique
result = federation.execute_agent(
    AgentType.CODE_GENERATOR,
    "Génère un script de buffer"
)
```

### Exécution Workflow
```python
from agent_workflows import WorkflowEngine, WorkflowType

engine = WorkflowEngine(federation)

# Workflow complet
result = engine.execute(
    WorkflowType.MAP_ANALYSIS,
    "Analyse cette carte IGN"
)

# Parallèle
result = engine.execute_parallel(
    [AgentType.VISION_ANALYZER, AgentType.CODE_GENERATOR],
    "Analyse et code"
)
```

### Bridge QGIS
```python
from agent_bridge import get_agent_bridge

bridge = get_agent_bridge()
bridge.setup(api_keys)

# Appel depuis QWebChannel
result = bridge.smartProcess(query, context_json)
```

---

## 📊 Performance par Modèle

| Modèle | Latence | Usage | Priorité |
|--------|---------|-------|----------|
| Nemotron Mini 4B | ~700ms | Router, tâches simples | Haute |
| Llama 3.1 8B | ~400ms | Fast inference | Haute |
| Llama 3.1 70B | ~500ms | Généraliste | Haute |
| Llama 3.2 Vision 11B | ~600ms | Vision rapide | Haute |
| Mixtral 8x22B | ~500ms | Qualité/coût | Haute |
| Qwen Coder 32B | ~800ms | Code | Haute |
| DeepSeek v4 Pro | ~2000ms | Reasoning | Moyenne |
| Llama 3.2 Vision 90B | ~3000ms | Vision haute qualité | Moyenne |
| Nemotron Ultra 253B | ~5000ms | Raisonnement complexe | Basse |
| Llama 3.1 405B | ~3000ms | Maximum puissance | Basse |

---

## 🎓 Exemples de Prompts

### Pour le Router
```
Requête: "Crée un buffer de 500m autour des écoles"
→ Réponse: "CODE"

Requête: "Qu'est-ce que je vois sur cette carte IGN?"
→ Réponse: "VISION"

Requête: "Analyse la meilleure localisation..."
→ Réponse: "REASONING"
```

### Pour le Code Generator
```
Génère du code PyQGIS qui:
1. Charge une couche vectorielle
2. Crée un buffer de 500m
3. Calcule l'intersection avec une autre couche
4. Exporte le résultat en GeoJSON

Avec gestion d'erreurs et commentaires.
```

### Pour le Vision Analyzer
```
Analyse cette carte IGN:
- Identifie la zone géographique
- Lis l'échelle et la légende
- Détecte les routes, bâtiments, zones vertes
- Extrais les coordonnées approximatives
```

### Pour le Reasoning
```
Analyse spatiale:
Objectif: Localiser une nouvelle école
Contraintes:
- Proche des zones résidentielles (< 1km)
- Loin des zones bruyantes (> 500m des routes)
- Accessible (transport en commun < 500m)
- Terrain disponible (> 5000m²)

Donne le raisonnement étape par étape.
```

---

## 🔮 Roadmap Agents

### Sprint 2 (En cours)
- ✅ Fédération d'agents de base
- ✅ Workflows multi-agents
- ✅ Routing intelligent
- ✅ Safety guards

### Sprint 3 (Planifié)
- 🔄 Mémoire persistante (Mem0)
- 🔄 RAG PyQGIS (Qdrant + Embeddings)
- 🔄 Agent conversationnel avec mémoire
- 🔄 Personnalisation des agents

### Sprint 4 (Futur)
- 🔮 Agents autonomes (AutoGPT-style)
- 🔮 Planification de tâches complexes
- 🔮 Apprentissage des préférences utilisateur
- 🔮 Multi-modal (texte + image + audio)

---

## 📚 Ressources

- [NVIDIA NIM Models](https://build.nvidia.com/explore/models)
- [LiteLLM Documentation](https://docs.litellm.ai)
- [QGIS Python API](https://qgis.org/pyqgis/)
