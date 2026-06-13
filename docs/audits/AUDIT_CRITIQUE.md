# AUDIT CRITIQUE — QGISIA+

**Analyse exhaustive du codebase (React 19, TypeScript, Python/PyQGIS, Vite)**  
**Date :** 2026-06-08 | **Confiance :** 95% analyse statique | **Sans complaisance**

---

## 🔴 Section 1 — Bugs confirmés

### Bug 1.1 — Fuite mémoire `setTimeout` sans cleanup dans Chat.tsx
**Fichier :** `src/components/Chat.tsx` ~ligne 195  
**Sévérité :** Critique (accumulation progressive)

```typescript
// PROBLÈME : setTimeout sans cleanup → accumulation à chaque changement isLoading
useEffect(() => {
  if (prevIsLoadingRef.current && !isLoading) {
    setTimeout(() => {   // ❌ pas de clearTimeout au démontage
      useSmartSuggestionsStore.getState().completeProcessing();
    }, 500);
  }
  prevIsLoadingRef.current = isLoading;
}, [isLoading]);

// FIX :
useEffect(() => {
  if (prevIsLoadingRef.current && !isLoading) {
    const id = setTimeout(() => {
      useSmartSuggestionsStore.getState().completeProcessing();
    }, 500);
    return () => clearTimeout(id);  // ✅
  }
  prevIsLoadingRef.current = isLoading;
}, [isLoading]);
```

---

### Bug 1.2 — Memory leak listeners `window` dans InlineMap.tsx
**Fichier :** `src/components/InlineMap.tsx` ~ligne 119  
**Sévérité :** Haute (listeners orphelins si démontage pendant drag)

```typescript
// PROBLÈME : listeners window jamais nettoyés si composant démonté pendant drag
window.addEventListener("mousemove", onMouseMove);
window.addEventListener("mouseup", onMouseUp);
// ❌ Aucun cleanup si le composant disparaît

// FIX : wrapper dans useEffect avec return cleanup
useEffect(() => {
  if (!isDragging) return;
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  return () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };
}, [isDragging, onMouseMove, onMouseUp]);
```

---

### Bug 1.3 — Race condition `createNew()` dans useConversationStore
**Fichier :** `src/stores/useConversationStore.ts` ~ligne 85  
**Sévérité :** Haute (conversations dupliquées sur double-clic)

```typescript
// PROBLÈME : pas d'idempotence, double-clic → 2 conversations créées
createNew: (firstMessage) => {
  const conv = createConversation(firstMessage);
  set((state) => ({
    conversations: [conv, ...state.conversations],  // ❌ peut s'exécuter 2x
    activeConversationId: conv.id,
  }));
},

// FIX : guard isCreating
createNew: (firstMessage) => {
  const { isCreating } = get();
  if (isCreating) return;
  set({ isCreating: true });
  const conv = createConversation(firstMessage);
  set((state) => ({
    conversations: [conv, ...state.conversations],
    activeConversationId: conv.id,
    isCreating: false,
  }));
},
```

---

### Bug 1.4 — `exec()` Python sans validation AST (CRITIQUE sécurité)
**Fichier :** `QGISIA2/geoai_assistant.py` ~ligne 3028  
**Sévérité :** CRITIQUE (Remote Code Execution possible)

Le script PyQGIS généré par l'IA est exécuté directement via `exec()` avec `__builtins__` complet. Une hallucination ou prompt injection → exécution arbitraire.

**Fix :** Validation AST + liste noire de modules dangereux. Un `ScriptValidator` devrait rejeter tout `import os`, `import subprocess`, `os.system`, `eval`, etc. avant d'appeler `exec()`. La liste noire est déjà partiellement présente dans `ScriptWorker.BLOCKED_FUNCTIONS` — elle doit être systématiquement appliquée AVANT exec.

---

### Bug 1.5 — Clés API en clair dans `localStorage`
**Fichier :** `src/lib/settings.ts` ~ligne 1270  
**Sévérité :** CRITIQUE (vol via DevTools ou XSS)

```typescript
localStorage.getItem(storageKey);  // ❌ clé API lisible en clair dans DevTools
```

**Fix :** Pour un outil desktop local (Electron/QGIS plugin), ce risque est acceptable à court terme. Pour une app web publique, chiffrer avec `crypto.subtle.encrypt` (AES-GCM avec clé dérivée de device fingerprint) ou utiliser un backend proxy.

---

### Bug 1.6 — Erreurs de parsing `<map-data>` silencieuses
**Fichier :** `src/hooks/useMapData.ts` ligne 74  
**Sévérité :** Basse (débogage impossible)

```typescript
} catch {
  return null;  // ❌ pas de log, l'utilisateur ne sait pas pourquoi la carte n'apparaît pas
}
// FIX : console.warn en développement
} catch (err) {
  if (import.meta.env.DEV) console.warn("[useMapData] JSON invalide :", err);
  return null;
}
```

---

## 🟠 Section 2 — Risques et fragilités

### Risque 2.1 — Pas de timeout sur les appels `window.qgis` directs
**Fichier :** `src/lib/qgis.ts`  
Le bridge HTTP a maintenant un timeout (60s). Mais les appels via `window.qgis?.getLayersList?.()` n'ont aucun timeout. Si QGIS freeze, le callback n'est jamais appelé → l'UI reste bloquée indéfiniment.

### Risque 2.2 — Pas de validation des retours du bridge QGIS
**Fichier :** `src/lib/qgis.ts` — interface `RawQgisBridge`  
Les callbacks retournent `string | string[] | void` sans validation du type réel. Si QGIS retourne un format inattendu (ex: erreur JSON au lieu d'un tableau), le code peut crasher en aval.

### Risque 2.3 — `diagnosticsByLayerId` non réinitialisé au changement de projet
**Fichier :** `src/components/Chat.tsx` ~ligne 126  
L'état local des diagnostics persiste quand l'utilisateur charge un nouveau projet QGIS. Les couches de l'ancien projet affichent leurs anciens diagnostics.

### Risque 2.4 — Pas de guard contre les messages vides dans `MessageBubble`
**Fichier :** `src/components/MessageBubble.tsx`  
Si `message.content` est `undefined` ou `""`, le composant tente quand même de parser le markdown et les `<map-data>` — peut déclencher des erreurs silencieuses.

---

## 🟡 Section 3 — Dette technique

| Fichier | Lignes | Problème |
|---------|--------|---------|
| `src/App.tsx` | ~1232 | Gère 13 responsabilités différentes — intenable |
| `src/components/Chat.tsx` | ~713 | Mélange logique/rendu/diagnostics/modales |
| `src/lib/openrouter.ts` | ~1358 | 29 occurrences de `any`, 3 responsabilités |
| `QGISIA2/geoai_assistant.py` | ~3500+ | Monolithe Python — serait un module par domaine |

**Duplications identifiées :**
- Validation des settings répétée dans `settings.ts`, `llm.ts`, `openrouter.ts`
- Logique de "appel bridge QGIS avec callback" dupliquée 40+ fois dans `qgis.ts`
- Patterns d'animation identiques (initial/animate/transition) copiés dans 12 composants

---

## 🔵 Section 4 — Performance

### Perf 4.1 — Re-renders non bloquants mais à surveiller
`useMemo` et `useCallback` sont bien utilisés dans Chat.tsx. Les dépendances paraissent correctes. Pas de re-render catastrophique identifié.

### Perf 4.2 — Leaflet lazy-loadé ✅ mais resize sans debounce
**Fichier :** `src/components/InlineMap.tsx`  
Le resize handle déclenche setState à chaque pixel de déplacement. Sur 60fps → 60 re-renders/seconde pendant le drag.

```typescript
// FIX : throttle à 16ms (1 frame)
const throttledSetHeight = useCallback(
  throttle((h: number) => setHeight(h), 16),
  []
);
```

### Perf 4.3 — Pas de virtualisation pour les listes de couches
**Fichier :** `src/components/WorkspaceSidebar.tsx`  
100+ couches QGIS = 100+ `motion.div` dans le DOM. Avec `react-window` + virtualisation, seules les couches visibles seraient rendues.

### Perf 4.4 — `prefers-reduced-motion` présent dans CSS mais ignoré en JS
**Fichier :** `src/index.css` a `@media (prefers-reduced-motion: reduce)` mais les `motion.div` dans les composants ne l'honorent pas.

```typescript
// Ajouter dans un hook global :
const { reducedMotion } = useReducedMotion();
const transition = reducedMotion ? { duration: 0 } : { duration: 0.3, ease: [...] };
```

---

## 🔒 Section 5 — Sécurité

| Vecteur | Sévérité | Fichier | Mitigation |
|---------|----------|---------|-----------|
| `exec()` PyQGIS sans AST validation | 🔴 CRITIQUE | `geoai_assistant.py:3028` | `ast.parse()` + blocklist avant exec |
| Clés API en clair localStorage | 🔴 CRITIQUE | `settings.ts:1270` | Acceptable si outil local (QGIS plugin) |
| XSS via markdown (react-markdown) | 🟡 Basse | `MessageBubble.tsx` | react-markdown échappe HTML par défaut ✅ |
| Injection QGIS via `buildZoomScript()` | 🟡 Basse | `InlineMap.tsx` | Les params sont des nombres — risque faible |
| Rate limiting absent | 🟡 Basse | Partout | Ajouter throttle sur les envois de messages |

**Note sur les clés API :** Ce projet est un plugin QGIS desktop. Les clés ne sont jamais envoyées à un serveur tiers contrôlé par nous — elles vont directement aux fournisseurs LLM. Le stockage localStorage est acceptable dans ce contexte mais devrait être documenté clairement.

---

## 🎨 Section 6 — UX / Accessibilité

### A11y 6.1 — Boutons sans `aria-label`
`InlineMap.tsx` : boutons satellite/OSM, resize, "Centrer dans QGIS" sans aria-label.  
`Chat.tsx` : boutons icônes (envoyer, joindre fichier, effacer) sans label accessible.

### A11y 6.2 — Pas de focus trap dans les modales
`SettingsModal.tsx` : la modale n'emprisonne pas le focus. Tab navigue hors de la modale.

### A11y 6.3 — Contraste
`text-white/40` (opacity 40%) sur fond sombre → ratio < 3:1. Non conforme WCAG AA.

### UX 6.4 — Messages d'erreur techniques exposés
Les tracebacks Python sont affichés dans le chat quand un script échoue. Pour un utilisateur non-développeur, c'est illisible. Proposer un message simple + bouton "Voir les détails".

### UX 6.5 — Sidebar fermée : pas d'indicateur de contenu
Quand la sidebar est fermée en mode icon-only, aucun badge ne montre le nombre de couches chargées ou d'alertes. L'utilisateur peut manquer des informations importantes.

---

## ✅ Section 7 — Ce qui est bien fait

1. **Lazy loading systématique** — Leaflet, SettingsModal, InlineMap, tous les composants lourds sont lazy-loadés
2. **Stores Zustand bien séparés** — chaque domaine a son store, pas de god-store
3. **Bridge HTTP + QWebChannel** — architecture découplée qui permet de tester le frontend sans QGIS
4. **Tokens CSS sémantiques** — index.css avec primitifs → sémantiques → utilities, bien structuré
5. **Animations cohérentes** — motion/react utilisé de façon homogène, pas de mix CSS/JS
6. **`useMapData` bien conçu** — parsing défensif, useMemo stable, types stricts
7. **`captureMapSnapshot` optionnelle** — si elle échoue, le message s'affiche quand même
8. **`InlineMap` avec BboxFitter** — gestion correcte de la bbox via `useMap` hook Leaflet
9. **Tests unitaires existants** — `chat-history.test.ts`, `reasoning-parser.test.ts`
10. **`prefers-reduced-motion`** dans `index.css` — présent, même si pas encore honoré côté JS

---

## 📊 Section 8 — Priorités de correction

| Priorité | Problème | Impact | Effort | Fichier |
|----------|----------|--------|--------|---------|
| **P0** | `exec()` Python sans validation AST | RCE possible | 3j | `geoai_assistant.py:3028` |
| **P0** | Clés API localStorage non chiffrées | Vol de clés | 2j | `settings.ts:1270` |
| **P1** | `setTimeout` leak Chat.tsx | Perf progressive | 30min | `Chat.tsx:~195` |
| **P1** | `window` listeners leak InlineMap | Perf + crash | 1h | `InlineMap.tsx:~119` |
| **P1** | Race condition `createNew()` | Données corrompues | 1h | `useConversationStore.ts:~85` |
| **P1** | Sidebar icon-only sans badge compteur | UX dégradée | 2h | `WorkspaceSidebar.tsx` |
| **P2** | App.tsx 1232 lignes | Maintenabilité | 3j | `App.tsx` |
| **P2** | `prefers-reduced-motion` ignoré JS | A11y | 4h | Partout |
| **P2** | Boutons sans `aria-label` | A11y | 4h | Multiple |
| **P3** | Resize sans throttle InlineMap | 60 re-renders/s | 30min | `InlineMap.tsx` |
| **P3** | Erreurs `<map-data>` silencieuses | Debug | 15min | `useMapData.ts:74` |
| **P3** | `diagnosticsByLayerId` stale | Données obsolètes | 1h | `Chat.tsx:~126` |

---

## 🎯 Verdict final

**Le projet est fonctionnel et bien structuré dans l'ensemble.** L'architecture (stores, bridge, lazy loading) est solide. Les animations sont cohérentes et de qualité.

**Mais :**
- Les 3 bugs P1 (leaks mémoire + race condition) sont faciles à fixer et doivent l'être immédiatement
- La dette technique s'accumule rapidement avec App.tsx, Chat.tsx et openrouter.ts qui grossissent à chaque feature
- L'exécution Python via `exec()` sans validation AST systématique est le risque le plus sérieux

**Recommandation immédiate :** Fixer P1 avant la prochaine session de dev (< 2h de travail). Planifier le refactoring de App.tsx + Chat.tsx comme prochain sprint dédié.
