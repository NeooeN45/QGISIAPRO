# Plan d'Optimisation QGIS/PyQGIS — Analyse des Freezes

**Projet QGISIA2 — Diagnostic et solutions pour éliminer les freezes**
**Date :** 2026-06-08 | **Statut :** Prêt pour implémentation

---

## Section 1 — Diagnostic des causes de freeze

### CAUSE 1 🔴 CRITIQUE — `QEventLoop.exec()` bloquant (freeze 30-35s)

**Fichier :** `QGISIA2/geoai_assistant.py` | **Lignes :** ~3048-3083

```python
# PROBLÈME : loop.exec() bloque le thread principal QGIS jusqu'à 35s
loop = QEventLoop()
worker.finished.connect(loop.quit)
safety_timer.start(35000)
loop.exec()  # ← FREEZE CRITIQUE — UI QGIS gelée
```

**Symptômes :** Interface complètement non-réactive, impossible de zoomer/cliquer, timeout HTTP côté client (5s) avant que le serveur finisse.

---

### CAUSE 2 🔴 CRITIQUE — `waitForFinished()` synchrone sur le rendu carte (freeze 2-10s)

**Fichier :** `QGISIA2/geoai_assistant.py` | **Lignes :** 1669, ~2884

```python
# PROBLÈME : attend le rendu carte dans le thread principal
job = QgsMapRendererCustomPainterJob(settings, painter)
job.start()
job.waitForFinished()  # ← FREEZE : bloque pendant tout le rendu
```

---

### CAUSE 3 🟡 MOYEN — `processing.run()` synchrone (freeze 1-5s par op)

**Fichier :** `QGISIA2/geoai_assistant.py` | **Lignes :** 746, 776, 808, 831, 849...

```python
# PROBLÈME : algorithmes QGIS bloquants sans feedback
result = processing.run("gdal:rastercalculator", params)  # bloque
result = processing.run("gdal:merge", params)              # bloque
result = processing.run("native:creategrid", {...})        # bloque
```

---

### CAUSE 4 🟡 MOYEN — Aucune queue de tâches

Plusieurs scripts peuvent s'exécuter simultanément → contention sur les ressources QGIS, modifications concurrentes du projet, comportements imprévisibles.

---

### CAUSE 5 🟡 MOYEN — Pas de feedback de progression

L'utilisateur voit un spinner générique sans information pendant 30+ secondes. Impossible de savoir si l'opération avance ou est bloquée.

---

### CAUSE 6 🟢 LÉGER — Timeout HTTP client trop court

**Fichier :** `src/lib/qgis.ts` | Timeout navigateur par défaut : 5-30s < timeout QGIS (35s). Les requêtes longues échouent côté client avant que le serveur ait fini.

---

## Section 2 — Solutions PyQGIS officielles

### 2.1 QgsTask — Exécution asynchrone sans bloquer l'UI

Doc : https://qgis.org/pyqgis/master/core/QgsTask.html
Doc : https://docs.qgis.org/latest/en/docs/pyqgis_developer_cookbook/tasks.html

```python
from qgis.core import QgsTask, QgsApplication
from qgis.PyQt.QtCore import pyqtSignal

class ScriptTask(QgsTask):
    resultReady = pyqtSignal(str, dict)  # (task_id, result)
    
    def __init__(self, task_id: str, script: str, context: dict):
        super().__init__(f"Script {task_id}", QgsTask.CanCancel)
        self.task_id = task_id
        self.script = script
        self.context = context
        self._result = {"ok": False, "message": "", "traceback": ""}
    
    def run(self) -> bool:
        """WORKER THREAD — ne bloque PAS le thread principal"""
        try:
            self.setProgress(20)
            local_ctx = dict(self.context)
            exec(self.script, local_ctx, local_ctx)
            self.setProgress(100)
            self._result = {"ok": True, "message": "Script exécuté avec succès.", "traceback": ""}
            return True
        except Exception as e:
            import traceback as tb
            self._result = {"ok": False, "message": str(e), "traceback": tb.format_exc()}
            return False
    
    def finished(self, result: bool):
        """Thread principal — émission du signal"""
        self.resultReady.emit(self.task_id, self._result)

# Utilisation
task = ScriptTask(task_id, script, context)
task.resultReady.connect(on_result_callback)
QgsApplication.taskManager().addTask(task)  # Non-bloquant !
```

### 2.2 RenderMapTask — Rendu carte asynchrone

```python
from qgis.core import QgsMapRendererParallelJob, QgsTask
from qgis.PyQt.QtCore import QEventLoop, pyqtSignal

class RenderMapTask(QgsTask):
    renderComplete = pyqtSignal(str, str)  # (output_path, error)
    
    def __init__(self, settings, output_path: str):
        super().__init__("Rendu carte", QgsTask.CanCancel)
        self.settings = settings
        self.output_path = output_path
        self.result_image = None
    
    def run(self) -> bool:
        """Worker thread — loop locale, PAS dans le thread principal"""
        try:
            job = QgsMapRendererParallelJob(self.settings)
            loop = QEventLoop()
            job.finished.connect(loop.quit)
            job.start()
            loop.exec()  # Bloque le WORKER, pas l'UI
            self.result_image = job.renderedImage()
            return not self.result_image.isNull()
        except Exception as e:
            self.exception = e
            return False
    
    def finished(self, result: bool):
        if result and self.result_image:
            self.result_image.save(self.output_path)
            self.renderComplete.emit(self.output_path, "")
        else:
            self.renderComplete.emit("", str(getattr(self, "exception", "Erreur")))
```

### 2.3 QgsProcessingFeedback — Progress sur processing.run()

```python
from qgis.core import QgsProcessingFeedback

class BridgeFeedback(QgsProcessingFeedback):
    def __init__(self, on_progress=None):
        super().__init__()
        self._on_progress = on_progress
        self.progressChanged.connect(self._emit)
    def _emit(self, val):
        if self._on_progress:
            self._on_progress(int(val))

# Utilisation
feedback = BridgeFeedback(on_progress=lambda v: notify_frontend(v))
result = processing.run("gdal:rastercalculator", params, feedback=feedback)
```

### 2.4 TaskQueue — File d'attente séquentielle

```python
import threading
from queue import PriorityQueue
from qgis.core import QgsApplication, QgsTask

class TaskQueue:
    def __init__(self):
        self.queue = PriorityQueue()
        self._results: dict = {}
        self._lock = threading.Lock()
        threading.Thread(target=self._worker, daemon=True).start()
    
    def enqueue(self, task: QgsTask, task_id: str, priority: int = 2):
        with self._lock:
            self.queue.put((priority, task_id, task))
    
    def cancel(self, task_id: str) -> bool:
        # Chercher dans les tâches QGIS actives
        for task in QgsApplication.taskManager().tasks():
            if hasattr(task, 'task_id') and task.task_id == task_id:
                task.cancel()
                return True
        return False
    
    def _worker(self):
        while True:
            priority, task_id, task = self.queue.get()
            QgsApplication.taskManager().addTask(task)
            self.queue.task_done()

# Singleton
_queue = None
def get_queue() -> TaskQueue:
    global _queue
    if _queue is None:
        _queue = TaskQueue()
    return _queue
```

---

## Section 3 — Plan d'implémentation priorisé

### Phase 1 — Quick Wins (1-2 jours)

| Tâche | Fichier | Lignes | Effort | Gain |
|-------|---------|--------|--------|------|
| Timeout HTTP 60s | `src/lib/qgis.ts` | ~293 | 5 min | Moins d'erreurs timeout |
| `waitForFinished()` → RenderMapTask | `geoai_assistant.py` | 1669 | 30 min | Élimine 2-10s freeze rendu |
| `QgsProcessingFeedback` sur processing.run | `geoai_assistant.py` | 746+ | 1h | Feedback % aux scripts |
| Capture base64 exposée via HTTP | `geoai_assistant.py` | nouveau | 30 min | Capture dans le chat |

### Phase 2 — Core Refactor (1 semaine)

| Tâche | Fichier | Effort | Gain |
|-------|---------|--------|------|
| Créer `QGISIA2/script_task.py` (ScriptTask) | Nouveau | 2j | Élimine 35s freeze UI |
| Créer `QGISIA2/task_queue.py` (TaskQueue) | Nouveau | 1j | Séquentialise les tâches |
| Polling résultats côté TS (`waitForScriptResult`) | `src/lib/qgis.ts` | 1j | Récupération async |
| Annulation via `/api/qgis/cancelTask` | `geoai_assistant.py` | 0.5j | UX cancel |

### Phase 3 — Architecture avancée (2 semaines)

| Tâche | Effort | Gain |
|-------|--------|------|
| WebSocket progress reporting | 3j | Feedback <100ms vs 1-5s polling |
| Retry + backoff côté frontend | 1j | Résilience réseau |
| Priorités de tâches (HIGH/NORMAL/LOW) | 1j | Scripts critiques en premier |
| Tests de charge (10 scripts simultanés) | 2j | Validation robustesse |

---

## Section 4 — Gains estimés

| Métrique | Avant | Phase 1 | Phase 2 | Phase 3 |
|----------|-------|---------|---------|---------|
| Freeze script IA | 35s UI gelée | 35s (non-bloquant*) | **0s UI gelée** ✅ | 0s |
| Freeze rendu carte | 2-10s | **0s** ✅ | 0s | 0s |
| Timeout erreurs | Fréquents | Réduits -70% | Rares | Quasi nuls |
| Feedback progression | Aucun | % basique | Temps réel | <100ms WebSocket |
| Annulation | Impossible | Impossible | **Possible** ✅ | Possible |
| Exécutions concurrent. | Non contrôlées | Non contrôlées | **Queue séquentielle** ✅ | Queue + priorités |

*Phase 1 : le script prend toujours 35s mais l'UI QGIS reste réactive

---

## Section 5 — Nouveaux modules à créer

### `QGISIA2/script_task.py`
Module ScriptTask basé sur QgsTask. Remplace `_execute_script_payload()`.

### `QGISIA2/render_task.py`
Module RenderMapTask. Remplace `waitForFinished()` dans `renderMapView()` et `_capture_map_snapshot()`.

### `QGISIA2/task_queue.py`
Module TaskQueue. File d'attente avec priorités et annulation.

---

## Checklist d'implémentation

### Phase 1 ✅ Quick wins
- [ ] `src/lib/qgis.ts` — timeout 60s sur `postJson`
- [ ] `geoai_assistant.py` — `waitForFinished()` → RenderMapTask dans `renderMapView()`
- [ ] `geoai_assistant.py` — `waitForFinished()` → RenderMapTask dans `_capture_map_snapshot()`
- [ ] `geoai_assistant.py` — `QgsProcessingFeedback` sur les 8 appels `processing.run()`
- [ ] `geoai_assistant.py` — exposer `captureMapSnapshot` comme endpoint HTTP base64

### Phase 2 ✅ Core
- [ ] Créer `QGISIA2/script_task.py`
- [ ] Créer `QGISIA2/task_queue.py`
- [ ] Créer `QGISIA2/render_task.py`
- [ ] Modifier `_execute_script_payload` → utiliser ScriptTask
- [ ] Ajouter endpoint `/api/qgis/scriptResult/{task_id}` (polling)
- [ ] Ajouter endpoint `/api/qgis/cancelTask` 
- [ ] `src/lib/qgis.ts` — `waitForScriptResult()` avec backoff exponentiel

### Phase 3 ✅ Architecture
- [ ] `QGISIA2/progress_websocket.py` — WebSocket SSE
- [ ] Frontend — hook `useTaskProgress(taskId)` 
- [ ] Indicateur visuel de progression dans ThinkingIndicator
- [ ] Tests de charge

---

## Ressources

- QgsTask API : https://qgis.org/pyqgis/master/core/QgsTask.html
- PyQGIS Cookbook Tasks : https://docs.qgis.org/latest/en/docs/pyqgis_developer_cookbook/tasks.html
- QgsProcessingFeedback : https://qgis.org/pyqgis/master/core/QgsProcessingFeedback.html
- Qt Signals/Slots : https://doc.qt.io/qt-6/signalsandslots.html
