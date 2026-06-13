# Guide de Test : Comparer les Versions de Gemma 2

## 🎯 Objectif
Trouver la meilleure version de Gemma 2 pour QGISAI+ en testant la qualité et la performance.

## 📋 Versions à Tester

| Version | Taille | RAM Min | Vitesse | Qualité | Idéal Pour |
|---------|--------|---------|---------|---------|------------|
| **gemma2:2b** | ~1.6GB | 4GB | ⚡⚡ Ultra rapide | ⭐⭐⭐ Bonne | Très légère, réponses instantanées |
| **gemma2:4b** | ~2.5GB | 6GB | ⚡ Très rapide | ⭐⭐⭐⭐ Très bonne | Machines modestes, réponses rapides |
| **gemma2:9b** | ~5.5GB | 12GB | ⚡ Rapide | ⭐⭐⭐⭐⭐ Excellente | Compromis idéal qualité/vitesse |
| **gemma2:27b** | ~17GB | 32GB | 🐢 Lente | ⭐⭐⭐⭐⭐⭐⭐ Maximale | Qualité maximale, stations de travail |

**Note** : Gemma 4 n'est pas encore disponible sur Ollama. Gemma 2 est la dernière version.

## 🧪 Scénarios de Test

### Test 1 : Question Simple QGIS
**Prompt** : "Comment ajouter une couche vectorielle dans QGIS ?"

**Critères d'évaluation** :
- [ ] Réponse correcte et complète
- [ ] Temps de réponse
- [ ] Clarté des explications
- [ ] Précision technique

### Test 2 : Code PyQGIS
**Prompt** : "Écris un script PyQGIS pour créer une couche de points avec 5 entités aléatoires dans l'emprise de la carte"

**Critères d'évaluation** :
- [ ] Code fonctionnel
- [ ] Syntaxe correcte
- [ ] Commentaires explicatifs
- [ ] Bonnes pratiques

### Test 3 : Analyse Complexe
**Prompt** : "Explique-moi la différence entre les systèmes de coordonnées projetées et géographiques, et quand utiliser chacun dans un projet SIG forestier"

**Critères d'évaluation** :
- [ ] Compréhension du contexte
- [ ] Explications claires
- [ ] Exemples pertinents
- [ ] Réponse structurée

### Test 4 : Instructions Multi-étapes
**Prompt** : "Je veux analyser la pente d'un MNT, la classer en 5 catégories, et créer un histogramme de distribution. Donne-moi la procédure complète"

**Critères d'évaluation** :
- [ ] Étapes logiques
- [ ] Outils QGIS corrects
- [ ] Paramètres précis
- [ ] Résultat attendu décrit

### Test 5 : Analyse d'Image (si multimodal activé)
**Prompt** : [Capture d'écran d'une carte QGIS] "Analyse cette carte et suggère des améliorations"

**Critères d'évaluation** :
- [ ] Compréhension visuelle
- [ ] Suggestions pertinentes
- [ ] Explications détaillées

## 📊 Grille d'Évaluation

Pour chaque version et chaque test, note de 1 à 5 :

| Critère | Description | Note |
|---------|-------------|------|
| **Qualité** | Précision et pertinence | 1-5 |
| **Vitesse** | Temps de réponse | 1-5 |
| **Clarté** | Facilité de compréhension | 1-5 |
| **Code** | Qualité du code (si applicable) | 1-5 |

## 🏆 Score Total

Pour chaque version, calcule le score total :
```
Score = (Qualité × 2) + Vitesse + (Clarté × 1.5) + (Code × 2)
```

La version avec le score le plus élevé sera la meilleure pour ton usage.

## 📈 Interprétation des Résultats

### Si gemma2:2b gagne
✅ **Parfait pour** : Très légère, réponses ultra-rapides, machines modestes
⚠️ **Limites** : Qualité acceptable mais pas excellente

### Si gemma2:4b gagne
✅ **Parfait pour** : Ordinateurs portables, réponses rapides, tâches simples
⚠️ **Limites** : Complexité limitée pour les très grosses analyses

### Si gemma2:9b gagne
✅ **Parfait pour** : Compromis idéal, usage quotidien professionnel
⚠️ **Limites** : Très rarement - c'est le "sweet spot"

### Si gemma2:27b gagne
✅ **Parfait pour** : Qualité maximale, stations de travail haut de gamme
⚠️ **Limites** : Très lent, consommateur de ressources, overkill pour la plupart

## 🗑️ Nettoyage Après Test

Une fois le gagnant identifié, supprime les autres versions pour libérer de l'espace :

```powershell
# Dans PowerShell, exécutez :
ollama rm gemma2:2b    # Si 4b, 9b ou 27b gagne
ollama rm gemma2:4b    # Si 9b ou 27b gagne  
ollama rm gemma2:9b    # Si 27b gagne
ollama rm gemma2:27b   # Si 2b, 4b ou 9b gagne

# Supprimer aussi les autres gros modèles si présents
ollama rm mixtral:8x7b       # 47GB
ollama rm llama3.1:70b      # 40GB+
ollama rm qwen2.5:72b       # 40GB+
```

## ⚙️ Configuration Optimale Recommandée

Après avoir choisi la version gagnante, configure-la par défaut dans le plugin :

**Settings → Modèles Locaux → Sélectionner le gagnant**

Paramètres recommandés :
```yaml
temperature: 0.7      # Créatif mais cohérent
topP: 0.95           # Bonne diversité
maxTokens: 8192       # Réponses complètes
repeatPenalty: 1.1    # Évite répétitions
numGpu: -1           # Auto-détection GPU
```

## 📝 Formulaire de Test

Copie ce tableau pour noter tes résultats :

| Test | 2b | 4b | 9b | 27b |
|------|----|----|----|-----|
| 1. Simple QGIS | Q:_, V:_, C:_, Code:_ | ... | ... | ... |
| 2. Code PyQGIS | Q:_, V:_, C:_, Code:_ | ... | ... | ... |
| 3. Analyse Complexe | Q:_, V:_, C:_, Code:_ | ... | ... | ... |
| 4. Multi-étapes | Q:_, V:_, C:_, Code:_ | ... | ... | ... |
| **SCORE TOTAL** | | | | |

**Gagnant** : _______________

---

💡 **Astuce** : La version 9B est généralement le meilleur compromis pour la plupart des utilisateurs.

## 🔄 Alternative : Utiliser le Script PowerShell

Tu peux aussi utiliser les scripts fournis :

### 1. Installer toutes les versions
```powershell
.\install-gemma4-versions.ps1
```

### 2. Nettoyer et garder le gagnant
```powershell
.\cleanup-models.ps1 -KeepModel "gemma2:9b"
```
