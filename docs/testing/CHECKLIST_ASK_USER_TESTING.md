# ✅ Checklist Détaillé : Test ask_user en QGIS 4.0

> Guide pas-à-pas pour validation complète. Coches chaque case au fil du test.  
> **Durée estimée** : 1-2 heures (4 scenarios)

---

## 🔧 PRÉ-TEST : Préparation Environnement

### Compilation & Build

- [ ] `cd c:\Users\camil\Desktop\Micro Entreprise\04_PROJETS_EN_COURS\Projet\QGISIA`
- [ ] `git status` → propre (pas de modifs)
- [ ] `git branch` → sur `main`
- [ ] `npm run build` → ✓ "built in X.Xs"
- [ ] `python -m pytest tests/test_ask_user.py -q` → ✓ 7 passed
- [ ] `npm run test` → ✓ 93 passed (vitest)
- [ ] `python -m py_compile QGISIA2/geoai_assistant.py` → ✓ OK

### QGIS 4.0 Préparation

- [ ] QGIS 4.0+ ouvert et stable
- [ ] Pas de plugin QGISIA+ précédent installé (ou désinstallé proprement)
- [ ] **Installer plugin** :
  - [ ] Help → Show Plugin Manager
  - [ ] Search "QGISAI" ou "GeoSylva"
  - [ ] Install latest version
  - [ ] Redémarrer QGIS
- [ ] Ou : installer en dev (symlink QGISIA2 vers plugins QGIS)
  ```bash
  # Path QGIS plugins: C:\Users\<user>\AppData\Roaming\QGIS\QGIS3\profiles\default\python\plugins
  mklink /D QGISIA2 c:\Users\camil\Desktop\...\QGISIA\QGISIA2
  ```
- [ ] Plugin visible dans menu Plugins → QGISAI+
- [ ] Dock auto-visible au démarrage OU clic Plugins → QGISAI+ affiche le dock

### Browser Console & DevTools

- [ ] Ouvrir DevTools : F12
- [ ] **Network tab** : visible et prêt
- [ ] **Console tab** : prêt (chercher erreurs JS)
- [ ] **Storage tab** : localStorage accessible (pour session_id)

### Logs Backend

- [ ] Ouvrir View → Panels → Log Messages (QGIS)
- [ ] Chercher messages "[QGISAI+]" ou "[ask_user]"
- [ ] Logs Python console (si lancé depuis console QGIS)

---

## 🎯 SCENARIO 1 : Basic QCM (Simple Dialog)

**Objectif** : Modal apparition, sélection, réponse simple.  
**Durée** : 5-10 min

### Étape 1.1 : Setup Conversation

- [ ] Dock QGISAI+ visible
- [ ] Chat ouvert (vierge ou nouvelle discussion)
- [ ] Input chat prêt (curseur dedans)

### Étape 1.2 : Trigger ask_user

**Saisis dans le chat** :
```
Je dois charger les données satellites.
Dois-je utiliser Sentinel-2 ou Landsat-8 ? Demande-moi.
```

- [ ] Appuie Entrée (envoie le message)
- [ ] Observe la typing indicator "Assistant réfléchit..."
- [ ] Chat affiche "Analysant..." ou "Planification..."

### Étape 1.3 : Modal Apparition

**Observe** (dans les 2-3 secondes) :

- [ ] **Modal QCM apparaît** (overlay semi-transparent)
- [ ] Modal a un **titre** (ex: "Quelle source satellites ?")
- [ ] Modal affiche **2+ options** (Sentinel-2, Landsat-8, Landsat-9, etc.)
- [ ] Modal a un **bouton "Valider"** (désactivé = grisé)
- [ ] **Fermeture** : X en haut-droit visible (optionnel mais bon UX)

**DevTools Check** :
- [ ] Network tab : POST à `/api/llm/agent/ask_user` (200 OK)
- [ ] Console : pas d'erreur JS (rouge)
- [ ] Storage → localStorage : clé `question_modal_data` présente

### Étape 1.4 : Sélection Option

- [ ] Clique sur **"Sentinel-2"** (radio button ou clickable option)
- [ ] Observe : option se **highlight** (couleur accent)
- [ ] Bouton "Valider" devient **actif** (couleur, curseur change)
- [ ] Clique sur "Sentinel-2" à nouveau → déselection (toggle)
- [ ] Re-clique → sélectionné

### Étape 1.5 : Soumission

- [ ] Clique **"Valider"**
- [ ] Observe (instantané) :
  - [ ] Modal **ferme**
  - [ ] Chat affiche : "Vous avez choisi : **Sentinel-2**"
  - [ ] Typing "Agent réfléchit..." réapparaît
  - [ ] Après ~2s : agent répond (ex: "Chargement Sentinel-2 pour votre zone...")

**DevTools Check** :
- [ ] Network tab : POST à `/api/llm/agent/respond` (200 OK)
- [ ] Body du POST contient : `{session_id: "...", selected_option: "Sentinel-2"}`
- [ ] Console : pas d'erreur
- [ ] Logs QGIS : "[ask_user] user responded: Sentinel-2" visible

### Étape 1.6 : Continuation Agent

- [ ] Agent continue (outil 3+) sans erreur
- [ ] Chat affiche résultats finaux (ex: "Bandes chargées : B02, B03, B04, B08...")
- [ ] **✅ SCENARIO 1 PASS**

**Si FAIL** :
- Modal n'apparaît pas → chercher erreur JS en console (F12)
- Bouton Valider toujours grisé → vérifier onClick (possibly prevent default?)
- Agent ne reprend pas → vérifier /api/llm/agent/respond en Network (erreur 500?)

---

## 🎯 SCENARIO 2 : Tool-Calling Loop avec Pause

**Objectif** : Agent exécute 2+ outils avant ask_user, vérifie reprises correcte.  
**Durée** : 10-15 min

### Étape 2.1 : Setup Projet QGIS

- [ ] Charge un projet QGIS avec **2-3 couches** (ex: 1 raster ortho + 1 vector forêt)
- [ ] Couches visibles et nommées clairement (ex: "ortho_2024", "forets_ign")
- [ ] Zoom sur une zone intéressante (ex: 1000x1000 m)

### Étape 2.2 : Prompt avec Clarification Nécessaire

**Saisis** :
```
Analyse la couche forêt. Dois-je calculer NDVI ou dNBR pour détecter la sévérité incendie?
Aide-moi à décider en affichant les deux indices, puis ask_user.
```

- [ ] Envoie (Entrée)

### Étape 2.3 : Observations Tool-Calling (Avant Pause)

**Dans les 3-5 secondes** :

- [ ] Chat affiche : "Exécution des outils..."
- [ ] Logs QGIS : "[ask_user] tool_loop iteration 1/4" visible
- [ ] Observe **outil 1 : getLayersList**
  - [ ] Résultat affiché (liste couches)
  - [ ] Pas de pause
- [ ] Observe **outil 2 : getLayerDiagnostics**
  - [ ] Stats couche (feature count, geom type, etc.)
  - [ ] Pas de pause
- [ ] Observe **outil 3 : computeSpectralIndex (NDVI)**
  - [ ] Progress bar ou message "Computing..."
  - [ ] Raster généré (ou simulation)
  - [ ] Pas de pause

### Étape 2.4 : Pause & Modal ask_user

- [ ] Agent reconnaît besoin de choix → **Modal apparaît**
  - [ ] Titre : "Quelle sévérité cherchez-vous ?"
  - [ ] Options : "NDVI (santé vég)", "dNBR (incendies)", "Tous les deux"
- [ ] Logs QGIS : "[ask_user] paused at iteration 3/4"

**DevTools Check** :
- [ ] Network tab : outil computeSpectralIndex réussi (200)
- [ ] Avant POST /respond : aucune requête suivante (bien en pause)

### Étape 2.5 : Choix & Reprise

- [ ] Sélectionne **"dNBR (incendies)"**
- [ ] Clique "Valider"
- [ ] Modal ferme

**Reprise Immédiate** :
- [ ] Chat : "Vous avez choisi : dNBR"
- [ ] Tool-loop **reprend** (iteration 4/4)
- [ ] Logs QGIS : "[ask_user] resume_tool_loop: reinjecting result {selected_option: 'dNBR'}"
- [ ] Observe **outil 4 : computeSpectralIndex (dNBR)**
  - [ ] Raster dNBR généré
  - [ ] Pas de nouvelle pause
- [ ] Observations : séquence continue jusqu'à réponse finale

### Étape 2.6 : Résultat Final

- [ ] Chat affiche résumé (ex: "dNBR calculé. Sévérité détectée : zones modérées à hautes.")
- [ ] Aucun artefact (doublon, erreur de state, etc.)
- [ ] **✅ SCENARIO 2 PASS**

**Si FAIL** :
- Loop ne reprend pas → vérifier POST /api/llm/agent/respond (erreur 500?)
- Mauvaise option injectée → vérifier session_id matching (localStorage?)
- Outil 4 ne s'exécute pas → vérifier resume_tool_loop en backend (logs)

---

## 🎯 SCENARIO 3 : Timeout & Annulation

**Objectif** : Robustesse (fermer modal, timeout >120s).  
**Durée** : 5-10 min

### Étape 3.1 : Annulation (Fermer Modal)

- [ ] Lance ask_user (comme Scenario 1)
- [ ] Modal apparaît
- [ ] **Clique le X** (coin haut-droit) OU **Appuie Escape**
- [ ] Observe :
  - [ ] Modal ferme proprement
  - [ ] Chat affiche (après ~1s) : "Pas de réponse reçue. Opération annulée."
  - [ ] Aucune erreur JS en console
  - [ ] Agent s'arrête gracieusement

**Logs QGIS** :
- [ ] "[ask_user] user cancel or timeout after 300s"
- [ ] Pas de stack trace

### Étape 3.2 : Timeout Serveur (120s)

**Setup** :
- [ ] Ouvre DevTools → Network tab
- [ ] Throttle : slow 3G (simulator réseau lent, optionnel)

**Trigger ask_user** :
- [ ] Modal apparaît
- [ ] Observe timeout configuration : ENV `QGIS_BRIDGE_TIMEOUT=120` (default)
- [ ] **Attends 125 secondes** (ou simule avec throttle extreme)

**Observe** (après ~120s) :
- [ ] Network tab : POST /respond avec status **504 Gateway Timeout**
- [ ] Chat affiche : "Timeout serveur (>120s). Requête annulée."
- [ ] Modal **ferme** (graceful, pas de gel)
- [ ] Aucune crash QGIS

**Logs** :
- [ ] Backend logs : "request timeout after 120s"

### Étape 3.3 : Double-Click Validation (Edge Case)

- [ ] Lance ask_user
- [ ] Modal apparaît
- [ ] Sélectionne option
- [ ] **Double-clique Valider** (rapid-fire)
- [ ] Observe :
  - [ ] Premier clic : requête POST envoyée
  - [ ] Deuxième clic : ignoré (bouton disable après premier clic, OU debounce)
  - [ ] Une seule réponse injectée (pas de doublon)

**✅ SCENARIO 3 PASS** si aucun erreur, graceful handling

---

## 🎯 SCENARIO 4 : Parallel Sessions (2+ Chats)

**Objectif** : Session isolation, chaque chat a son session_id unique.  
**Durée** : 10-15 min

### Étape 4.1 : Crée 2 Conversations

- [ ] Dans le dock chat, clique **"+ Nouvelle discussion"**
- [ ] Crée conversation **A** (actuellement active)
- [ ] Crée conversation **B** (dans dropdown conversation liste)
- [ ] Switch à **A** (bouton/menu)

### Étape 4.2 : Trigger ask_user dans A

**Saisis** :
```
Charger Sentinel-2 ou Landsat?
```

- [ ] Envoie
- [ ] Modal **A** apparaît (ex: "Quelle source satellites?")
- [ ] DevTools : inspect Storage → localStorage → note `session_id_A` (ex: "uuid-1234-abcd")

### Étape 4.3 : Switch à B, Trigger ask_user Parallèle

**Sans fermer modal A** :

- [ ] Clique **conversation B** (dropdown ou tab)
- [ ] Chat **B** affiché, vierge
- [ ] Saisis :
  ```
  Dois-je analyser NDVI ou dNBR?
  ```
- [ ] Envoie

### Étape 4.4 : Deux Modals Simultanées

**Observe** (après ~2s) :

- [ ] Modal **A** toujours visible (question satellites)
- [ ] Modal **B** apparaît **par-dessus** (question indices)
- [ ] Ou : modal **A** masquée, **B** affichée (Z-order, c'est OK)
- [ ] DevTools → localStorage : 2 keys
  - [ ] `session_id_A` (uuid-1234-abcd)
  - [ ] `session_id_B` (uuid-5678-efgh) — **DIFFÉRENT de A**

### Étape 4.5 : Répondre dans B D'abord

- [ ] Sélectionne option dans Modal B (ex: "NDVI")
- [ ] Clique "Valider"
- [ ] Modal B ferme
- [ ] Chat B affiche : "Vous avez choisi : NDVI"
- [ ] Tool-loop B continue

### Étape 4.6 : Puis Répondre dans A

**Switch back à A** (ou si A toujours visible) :

- [ ] Modal A toujours présente (ou réapparaît)
- [ ] Sélectionne option (ex: "Sentinel-2")
- [ ] Clique "Valider"
- [ ] Modal A ferme
- [ ] Chat A affiche : "Vous avez choisi : Sentinel-2"
- [ ] Tool-loop A reprend indépendamment

### Étape 4.7 : Vérifier Isolation

**Check** :
- [ ] Conversation A : résultats Sentinel-2 (pas NDVI contaminé)
- [ ] Conversation B : résultats NDVI (pas Sentinel-2)
- [ ] Logs QGIS : deux sessions différentes loggées
  ```
  [ask_user] session_id=uuid-1234-abcd: user responded: Sentinel-2
  [ask_user] session_id=uuid-5678-efgh: user responded: NDVI
  ```

**✅ SCENARIO 4 PASS** si chaque session isolée, pas de cross-talk

---

## 🔍 Vérifications Finales (Post-Tests)

### Logs & Diagnostics

- [ ] QGIS Log Messages : aucune erreur critique (rouge)
- [ ] Browser console (F12) : 0 erreur JS (rouge) — OK warnings (jaune)
- [ ] Network tab : aucun 5xx (erreur serveur)
- [ ] Backend logs : aucun stack trace

### Performance

- [ ] Modal apparition : **< 500 ms** ✓
- [ ] Réponse injection : **< 100 ms** ✓
- [ ] Tool-loop reprise : **< 2 s** ✓
- [ ] QGIS pas figé pendant ask_user : **✓**

### Accessibilité & UX

- [ ] Modal **accessible clavier** :
  - [ ] Tab → sélectionne option suivante
  - [ ] Shift+Tab → option précédente
  - [ ] Entrée/Espace → sélectionne/valide
  - [ ] Escape → ferme modal
- [ ] Modal **readable** :
  - [ ] Texte contraste OK (WCAG AA)
  - [ ] Options clairement distinguables
  - [ ] Bouton "Valider" obvious
- [ ] **Responsive** : redimensionner window → modal adapte

### Browser Compatibility

- [ ] Testé sur :
  - [ ] Chrome 130+
  - [ ] Firefox 130+
  - [ ] Edge 130+
  - [ ] Safari (si Mac disponible)

---

## 📊 Résumé Test Final

```
Date : ____________________
Testeur : ____________________
QGIS Version : ____________________
Plugin Commit : ____________________

SCENARIOS :
  ☐ Scenario 1 (Basic QCM) : PASS / FAIL
  ☐ Scenario 2 (Tool-Loop) : PASS / FAIL
  ☐ Scenario 3 (Timeout/Cancel) : PASS / FAIL
  ☐ Scenario 4 (Parallel Sessions) : PASS / FAIL

ALL PASS? 
  ☐ ✅ OUI → Ready for production
  ☐ ❌ NON → Blockers below

BLOCKERS (si FAIL) :
  1. ____________________
  2. ____________________
  3. ____________________

NOTES / OBSERVATIONS :
  - ____________________
  - ____________________
```

---

## 🚀 Si ALL PASS ✅

**Congratulations!** ask_user est validé en QGIS 4.0 réel.

**Next Steps** :
1. Merger test results dans issue ou PR
2. Lancer Kimi → **PROMPT 11** (PSG blueprint)
3. Pack Foresterie : intégrer ask_user dans workflows

---

## 🐛 Si FAIL ❌

**Triage** :
1. Note le scenario + erreur exacte
2. Reproduis en dev mode (npm run dev)
3. Ouvre issue avec :
   - [ ] Scenario qui fail
   - [ ] Screenshot/video
   - [ ] Console error (F12)
   - [ ] Network tab screenshot
   - [ ] QGIS log excerpt

