# Checklist Test Manuel - Sprint 1b (Gateway BYOK)

## Pré-requis
- QGIS 3.28+ installé
- Plugin chargé
- Build frontend fait (`npm run build`)
- Ollama installé (optionnel)

## Étape 1: Build Frontend
```powershell
npm run build
```
✅ Vérifier que `qgis_plugin/web/` contient les fichiers `.js` et `index.html`

## Étape 2: Test Backend
```powershell
python tests/test_gateway.py
```
✅ Les tests passent (serveur QGIS doit être démarré)

## Étape 3: Paramètres Gateway
1. Ouvrir QGIS
2. Démarrer le plugin GeoSylva
3. Aller dans **Paramètres → Gateway IA**

✅ Vérifications:
- Onglet "Gateway IA" présent avec icône ⚡
- Carte de statut affichée
- 9 champs clés API visibles (OpenRouter, Gemini, Groq, NVIDIA, Anthropic, OpenAI, Mistral, Cerebras, HuggingFace)
- URL Ollama par défaut: `http://localhost:11434`
- Toggles "Utiliser le Gateway" et "Mode Auto"

## Étape 4: Installation Gateway
1. Cliquer **"Installer"**
2. Attendre ~30-60s

✅ Vérifications:
- Statut passe à "installing" puis "ready"
- Bouton "Actualiser" fonctionne
- Liste des alias se charge

## Étape 5: Configuration Clés

### Groq (Gratuit)
1. https://console.groq.com/keys
2. Créer clé API
3. Coller dans champ Groq
4. Vérifier masquage avec œil 👁️

### NVIDIA (Optionnel)
1. https://build.nvidia.com/
2. Générer API key
3. Coller dans champ NVIDIA

## Étape 6: Test Chat
1. Sélectionner modèle "fast-local" ou "smart-default"
2. Envoyer: "Dis Gateway OK en français"

✅ Réponse reçue en < 2s (Groq) ou localement (Ollama)

## Résultat Final
- [ ] Build OK
- [ ] Tests backend OK
- [ ] UI Gateway visible
- [ ] Installation réussie
- [ ] Clés configurées
- [ ] Chat fonctionnel
