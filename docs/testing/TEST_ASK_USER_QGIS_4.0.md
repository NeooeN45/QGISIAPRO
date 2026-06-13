# 🧪 Test ask_user en QGIS 4.0 Réel

> Validation complète du QCM agent + pause/reprise tool-calling  
> Gate requis avant : pytest ✓ vitest ✓ npm build ✓

---

## 📋 Checklist Pré-test

- [ ] Plugin compilé : `npm run build` OK
- [ ] Backend Python : `python -m pytest tests/test_ask_user.py -q` (7 tests OK)
- [ ] Frontend React : `npm run test` (93 tests OK)
- [ ] QGIS 4.0+ lancé
- [ ] Plugin QGISIA+ installé et disponible dans Plugins → QGISAI+
- [ ] Dock visible au démarrage (ou clic sur QGISAI+ pour afficher)

---

## 🎯 Scenario 1 : ask_user Simple (Basic QCM)

**Objectif** : Agent pause et demande à l'utilisateur via modal.

### Étapes

1. **Lance QGIS** avec un projet vierge (ou charge une couche simple)
2. **Ouvre le dock QGISAI+** (Plugins → QGISAI+ ou Ctrl+Shift+G)
3. **Dans le chat**, saisis :
   ```
   Dois-je charger les données en Sentinel-2 ou Landsat? Demande-moi.
   ```
4. **Observe** :
   - [ ] Chat reconnaît demande (intent: VISION_ANALYZER)
   - [ ] Agent détecte besoin de clarification → appelle `ask_user`
   - [ ] **Modal QCM apparaît** avec :
     - [ ] Titre : "Quelle source de données préférez-vous?"
     - [ ] Options : "Sentinel-2", "Landsat"
     - [ ] Bouton "Valider" désactivé jusqu'à sélection
5. **Clique sur "Sentinel-2"** → bouton s'active
6. **Clique "Valider"**
7. **Observe** :
   - [ ] Modal ferme
   - [ ] Chat affiche "Vous avez choisi : Sentinel-2"
   - [ ] Agent continue et génère la prochaine étape

---

## 🎯 Scenario 2 : ask_user dans Tool-calling Loop (Advanced)

**Objectif** : Agent exécute plusieurs outils, puis pause pour clarification au milieu.

### Étapes

1. **Charge un projet QGIS** avec 2-3 couches (ex: raster + vector)
2. **Dans le chat** :
   ```
   Analyse la forêt dans la couche principale. Dois-je calculer NDVI ou NDWI?
   ```
3. **Observe** :
   - [ ] Agent lance `run_tool_loop`
   - [ ] Exécute outil 1 : `getLayersList` (sans pause)
   - [ ] Exécute outil 2 : `getLayerDiagnostics` (sans pause)
   - [ ] Agent reconnaît besoin de choix → appelle `ask_user(question, ["NDVI", "NDWI"])`
   - [ ] **Modal apparaît avec les 2 options**
4. **Sélectionne "NDVI"** → Valide
5. **Observe** :
   - [ ] Boucle agent reprend (resume_tool_loop)
   - [ ] Exécute outil 3 : `computeSpectralIndex(layerId, "NDVI")`
   - [ ] Retour au chat avec résultats NDVI
   - [ ] Agent génère rapport final

---

## 🎯 Scenario 3 : ask_user Timeout & Annulation

**Objectif** : Tester robustesse (timeout long, annulation user).

### 3.1 - Annulation (fermer modal sans choisir)

1. **Lance une requête ask_user** (comme Scenario 1)
2. **Attend modal**
3. **Clique en dehors du modal ou appuie Escape**
4. **Observe** :
   - [ ] Modal ferme **sans erreur**
   - [ ] Backend logs : "ask_user session timeout ou user cancel"
   - [ ] Chat affiche : "Aucune réponse reçue. Opération annulée."

### 3.2 - Timeout Serveur (120s configurable)

1. **Ouvre DevTools** (F12) → Network tab
2. **Lance ask_user normal**
3. **Observe POST /api/llm/agent/respond**
4. **Vérifie** :
   - [ ] Request timeout : 120s (ou env var `QGIS_BRIDGE_TIMEOUT`)
   - [ ] Si délai > 120s : HTTP 504 affichage propre

---

## 🎯 Scenario 4 : Multiple Sessions (Parallèle)

**Objectif** : 2+ chats simultanés avec ask_user dans chacun (vérifier session isolation).

### Étapes

1. **Crée 2 conversations** dans le dock (+ Nouvelle discussion)
2. **Conversation A** : lance ask_user (#1)
3. **Conversation B** : lance ask_user (#2) en parallèle
4. **Observe** :
   - [ ] Modal A affiche correctement (session_id correct)
   - [ ] Réponds A
   - [ ] Modal A ferme, reprend A
   - [ ] Modal B toujours visible
   - [ ] Réponds B
   - [ ] Chaque session reprend indépendamment

---

## 🔍 Vérifications Logs

Dans les logs QGIS (Help → View → Panels → Log Messages):

```
[QGISAI+] ask_user called: session_id=<uuid>, question="...", options=[...]
[QGISAI+] ask_user paused tool loop at iteration 2/4
[QGISAI+] user responded: selected_option="Sentinel-2"
[QGISAI+] resume_tool_loop: reinjecting result {selected_option: "Sentinel-2"}
[QGISAI+] tool_loop continuing: 3/4
```

---

## 📊 Métriques de Succès

| Check | Expected | Status |
|-------|----------|--------|
| Modal apparition | <500ms après ask_user call | [ ] |
| Bouton sélection | Actif après 1er clic option | [ ] |
| Réponse injection | <100ms après "Valider" | [ ] |
| Tool-calling reprise | <2s après réponse | [ ] |
| Session isolation | Chaque session a session_id unique | [ ] |
| Timeout handling | >120s → HTTP 504 propre | [ ] |
| Browser refresh | Sessions persistent (localStorage) | [ ] |
| Modal a11y | Tab accessible, ARIA labels OK | [ ] |

---

## 🐛 Bugs Connus / À Monitorer

- [ ] Modal peut pas être trop haute (viewport < 500px) → scroll nécessaire?
- [ ] Rate-limit: si ask_user + rapid answers → 1200 req/min limiter?
- [ ] Session cleanup: vieilles sessions après 1h d'inactivité?

---

## 📝 Résumé Test

**Date** : _________  
**Testeur** : _________  
**QGIS Version** : _________  
**Plugin Version** : _________  

**Résultats Scenarios** :
- [ ] Scenario 1 : **PASS** / **FAIL** (détails: _________)
- [ ] Scenario 2 : **PASS** / **FAIL** (détails: _________)
- [ ] Scenario 3 : **PASS** / **FAIL** (détails: _________)
- [ ] Scenario 4 : **PASS** / **FAIL** (détails: _________)

**Blockers** (si FAIL) :
```
- 
- 
```

**Notes** :
```
- 
- 
```

---

## ✅ Validation Finale

- [ ] Tous scenarios PASS
- [ ] Pas de blockers
- [ ] Ready for **B: Packs Métier** (foresterie, incendie, urbanisme)

