# 🧪 Tests de Prompts Utilisateurs - QGISAI+

## ⏱️ Performance Serveur
- **Démarrage**: ~900ms (Vite v6.4.1)
- **Preview**: Instantané après démarrage
- **Hot reload**: ~50-100ms

---

## 📝 Prompts de Test par Catégorie

### 1. **Prompts Forestiers** 🌲

| Prompt | Intention Détectée | Suggestions Attendues | Status |
|--------|-------------------|----------------------|--------|
| "inv foret" | FOREST_INVENTORY | - "Créer un inventaire forestier"<br>- "Placettes d'inventaire"<br>- "Analyse NDVI" | ⏳ À tester |
| "calcul surface bois" | ANALYSIS | - "Calculer la surface forestière"<br>- "Exporter en hectares"<br>- "Stats par essence" | ⏳ À tester |
| "grille 250m placettes" | FOREST_INVENTORY | - Template "Grille d'inventaire forestier"<br>- "Centroïdes des placettes"<br>- "Buffer 15m" | ⏳ À tester |

### 2. **Prompts Cadastre** 🗺️

| Prompt | Intention Détectée | Suggestions Attendues | Status |
|--------|-------------------|----------------------|--------|
| "charg cadastre" | DATA_LOADING | - "Charger le cadastre"<br>- "Chercher une commune"<br>- "Parcelles cadastrales" | ⏳ À tester |
| "sect cadastr" | CADASTRE_ANALYSIS | - "Sélectionner une section"<br>- "Filtrer par section"<br>- "Export cadastre" | ⏳ À tester |
| "parcel proprio" | CADASTRE_ANALYSIS | - "Filtrer par propriétaire"<br>- "Info parcelle"<br>- "Surface par proprio" | ⏳ À tester |

### 3. **Prompts Analyse Spatiale** 📊

| Prompt | Intention Détectée | Suggestions Attendues | Status |
|--------|-------------------|----------------------|--------|
| "buff 100m" | SPATIAL_ANALYSIS | - "Buffer de 100m"<br>- "Buffer autour de la sélection"<br>- "Tampon multi-distance" | ⏳ À tester |
| "intersect 2 couches" | SPATIAL_ANALYSIS | - "Intersection entre couches"<br>- "Union de couches"<br>- "Clip selon emprise" | ⏳ À tester |
| "calcul dist" | SPATIAL_ANALYSIS | - "Calculer une distance"<br>- "Distance entre points"<br>- "Plus court chemin" | ⏳ À tester |
| "reproj L93" | SPATIAL_ANALYSIS | - "Reprojeter en Lambert 93"<br>- "Changer le CRS"<br>- "EPSG:2154" | ⏳ À tester |

### 4. **Prompts Export** 📤

| Prompt | Intention Détectée | Suggestions Attendues | Status |
|--------|-------------------|----------------------|--------|
| "export geojson" | EXPORT | - "Exporter en GeoJSON"<br>- "Export batch"<br>- "Export toutes couches" | ⏳ À tester |
| "save shp" | EXPORT | - "Exporter en Shapefile"<br>- "Sauvegarder sous"<br>- "Format ESRI" | ⏳ À tester |

### 5. **Prompts Visualisation** 🎨

| Prompt | Intention Détectée | Suggestions Attendues | Status |
|--------|-------------------|----------------------|--------|
| "style catégorisé" | VISUALIZATION | - "Style catégorisé"<br>- "Symbologie par champ"<br>- "Couleurs par catégorie" | ⏳ À tester |
| "legend carte" | VISUALIZATION | - "Ajouter une légende"<br>- "Configuration légende"<br>- "Export avec légende" | ⏳ À tester |

---

## 🎯 Tests de Fidélité

### Test 1: Prompt Mal Formulé
**Input**: "calcl surf parcel"

**Comportement Attendu**:
- ✅ Normalisation: "calcul surface parcelle"
- ✅ Suggestions: "Calculer la surface", "Exporter les résultats"
- ✅ Auto-complétion: "calcul surface de [couche]"

### Test 2: Prompt Court/Abréviation
**Input**: "buff"

**Comportement Attendu**:
- ✅ Suggestions contextuelles: "Buffer de 100m", "Buffer de 250m"
- ✅ Auto-complétion: "buffer de 100m autour de [couche]"

### Test 3: Prompt Complexe Multi-Actions
**Input**: "charge cadastre Marseille puis crée buffer 500m autour des parcelles"

**Comportement Attendu**:
- ✅ Détection multi-intentions: LOAD + ANALYSIS
- ✅ Suggestion décomposition en étapes
- ✅ Mémorisation du contexte

---

## 🔧 Tests des Composants UI

### SmartSuggestionsBar
- [ ] S'affiche quand on commence à taper
- [ ] Disparaît quand on envoie le message
- [ ] Clavier navigation (↑↓ Enter) fonctionne
- [ ] Groupes (Action, Layer, Parameter) visibles

### SemanticAutocomplete
- [ ] Apparaît sur les patterns reconnus (buff, calcul, export...)
- [ ] Tab accepte la suggestion
- [ ] Escape la ferme
- [ ] Style grisé (ghost text) visible

### ScriptTemplateModal
- [ ] Bouton 📄 ouvre le modal
- [ ] Catégories cliquables
- [ ] Recherche fonctionne
- [ ] Paramètres éditables
- [ ] Bouton "Exécuter" fonctionne

### FeedbackWidget
- [ ] Apparaît après réponse assistant
- [ ] 3 boutons de rating fonctionnent
- [ ] Formulaire détail s'affiche pour "À améliorer"
- [ ] Envoi fonctionne

---

## 📊 Résultats des Tests

| Test | Status | Commentaire |
|------|--------|-------------|
| Démarrage serveur | ✅ Pass | ~900ms |
| Preview navigateur | ✅ Pass | Instantané |
| Suggestions contextuelles | ⏳ À tester | - |
| Auto-complétion | ⏳ À tester | - |
| Templates scripts | ⏳ À tester | - |
| Feedback | ⏳ À tester | - |

---

## 🚀 Prochaines Étapes

1. **Connecter QGIS** pour tester avec de vraies couches
2. **Tester avec API OpenRouter** pour voir les réponses réelles
3. **Mesurer temps de réponse** LLM
4. **Vérifier mémoire conversation** sur multi-tours

*Généré le: 2026-04-10*
