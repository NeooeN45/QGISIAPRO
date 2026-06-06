# -*- coding: utf-8 -*-
"""
Test GRANDEUR NATURE (a executer DANS QGIS via qgis-bin --code).

Simule un utilisateur reel : QGIS tourne avec le plugin (serveur + bridge),
un projet realiste est cree, puis on envoie des requetes en LANGAGE NATUREL a
/api/llm/agent (NVIDIA NIM reel) et on verifie que l'etat de QGIS change vraiment.
Scenarios de complexite croissante.

Env requis :
    QGISIA_TEST_LOG       -> JSON de resultat
    QGISIA_PLUGIN_PARENT  -> racine du repo (parent de QGISIA2)
    NVIDIA_API_KEY        -> cle (sinon lue depuis .env.local)
"""
import json
import os
import sys
import threading
import traceback
import urllib.request
from pathlib import Path

from qgis.PyQt.QtCore import QEventLoop, QTimer
from qgis.PyQt.QtWidgets import QApplication, QMessageBox
from qgis.core import (
    QgsFeature, QgsField, QgsGeometry, QgsProject, QgsVectorLayer,
)
from qgis.PyQt.QtCore import QVariant
from qgis.utils import iface

LOG = os.environ["QGISIA_TEST_LOG"]
PARENT = os.environ["QGISIA_PLUGIN_PARENT"]
RESULTS = {"success": True, "qgis": "", "scenarios": []}


def _load_env_local():
    for name in (".env.local", ".env"):
        p = Path(PARENT) / name
        if p.is_file():
            for line in p.read_text(encoding="utf-8").splitlines():
                s = line.strip()
                if s and not s.startswith("#") and "=" in s:
                    k, _, v = s.partition("=")
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def persist():
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "w", encoding="utf-8") as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=2)


def rec(name, ok, detail="", data=None):
    RESULTS["scenarios"].append({"name": name, "ok": bool(ok), "detail": str(detail)[:400], "data": data})
    if not ok:
        RESULTS["success"] = False
    persist()


def wait(ms):
    loop = QEventLoop(); QTimer.singleShot(ms, loop.quit); loop.exec()


def quit_app():
    QTimer.singleShot(0, QApplication.instance().quit)


def run_in_worker(callback, timeout_ms=120000):
    result, state = {}, {"done": False}

    def target():
        try:
            result["value"] = callback()
        except Exception as exc:  # noqa: BLE001
            result["error"] = str(exc)
            result["tb"] = traceback.format_exc()
        finally:
            state["done"] = True

    threading.Thread(target=target, daemon=True).start()
    elapsed = 0
    while not state["done"] and elapsed < timeout_ms:
        wait(100); elapsed += 100
    if not state["done"]:
        raise TimeoutError(f"timeout {timeout_ms}ms")
    if "error" in result:
        raise RuntimeError(result["tb"])
    return result.get("value")


def post_json(url, payload, timeout=110):
    def cb():
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    return run_in_worker(cb)


def get_json(url, timeout=20):
    def cb():
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    return run_in_worker(cb)


def build_project():
    # Couche foret (polygones) avec type + surface
    foret = QgsVectorLayer("Polygon?crs=EPSG:2154&field=type:string&field=surface:double", "foret", "memory")
    pr = foret.dataProvider()
    rows = [("feuillu", 8000.0), ("resineux", 3000.0), ("mixte", 12000.0)]
    feats = []
    for i, (t, s) in enumerate(rows):
        f = QgsFeature(foret.fields()); f.setAttributes([t, s])
        x = i * 100
        f.setGeometry(QgsGeometry.fromWkt(f"Polygon(({x} 0, {x+50} 0, {x+50} 50, {x} 50, {x} 0))"))
        feats.append(f)
    pr.addFeatures(feats); foret.updateExtents()
    QgsProject.instance().addMapLayer(foret)

    routes = QgsVectorLayer("LineString?crs=EPSG:2154&field=nom:string", "routes", "memory")
    rp = routes.dataProvider()
    rf = QgsFeature(routes.fields()); rf.setAttributes(["D1"])
    rf.setGeometry(QgsGeometry.fromWkt("LineString(0 0, 300 300)"))
    rp.addFeatures([rf]); routes.updateExtents()
    QgsProject.instance().addMapLayer(routes)
    return foret, routes


def tools_of(result):
    return [t.get("tool") for t in (result.get("trace") or [])]


def main():
    plugin = None
    try:
        from qgis.core import Qgis
        RESULTS["qgis"] = Qgis.QGIS_VERSION
        _load_env_local()
        key = os.environ.get("NVIDIA_API_KEY", "")
        if not key or key == "colle_ta_cle_ici":
            rec("setup.key", False, "NVIDIA_API_KEY absente")
            return quit_app()

        # processing importable
        from qgis.core import QgsApplication
        plugins_path = os.path.join(QgsApplication.pkgDataPath(), "python", "plugins")
        if plugins_path not in sys.path:
            sys.path.append(plugins_path)
        import processing  # noqa
        from processing.core.Processing import Processing
        Processing.initialize()

        sys.path.insert(0, PARENT)
        import QGISIA2  # noqa
        plugin = QGISIA2.classFactory(iface)
        plugin.initGui()
        plugin.run()

        base_url = getattr(plugin, "external_ui_url", None)
        if not base_url and hasattr(plugin, "_web_url"):
            try:
                base_url = plugin._web_url("http")
            except Exception:
                base_url = None
        if not base_url and getattr(plugin, "view", None) is not None:
            base_url = plugin.view.url().toString()
        bridge = base_url.split("?", 1)[0].rsplit("/", 1)[0] if base_url else None
        rec("setup.server_url", bool(bridge), base_url or "")
        if not bridge:
            return _finish(plugin)

        # Attendre que le serveur reponde
        for _ in range(20):
            try:
                h = get_json(f"{bridge}/api/qgis/health", timeout=5)
                if h.get("ok"):
                    break
            except Exception:
                wait(500)

        health = get_json(f"{bridge}/api/llm/health", timeout=10)
        rec("setup.llm_health", bool(health.get("vendor_ready")), data=health)
        if not health.get("vendor_ready"):
            return _finish(plugin)

        foret, routes = build_project()
        api_keys = {"nvidia_nim": key}
        agent_url = f"{bridge}/api/llm/agent"

        def ask(query, max_iters=4):
            r = post_json(agent_url, {
                "query": query, "model": "smart-default",
                "auto_mode": True, "max_iters": max_iters, "api_keys": api_keys,
            })
            return r.get("result", {})

        # ── Scenario 1 (simple) : lister les couches ──
        try:
            res = ask("Liste les couches presentes dans le projet QGIS.")
            t = tools_of(res); content = (res.get("content") or "").lower()
            ok = "getLayersList" in t or ("foret" in content and "routes" in content)
            rec("S1.lister_couches", ok, f"tools={t} | {res.get('content','')[:120]}")
        except Exception as exc:
            rec("S1.lister_couches", False, str(exc))

        # ── Scenario 2 (moyen) : opacite + zoom ──
        try:
            res = ask("Regle l'opacite de la couche foret a 40 pour cent puis zoome dessus.")
            t = tools_of(res)
            ok = abs(foret.opacity() - 0.4) < 0.02
            rec("S2.opacite_zoom", ok, f"tools={t} | opacity={foret.opacity():.2f}")
        except Exception as exc:
            rec("S2.opacite_zoom", False, str(exc))

        # ── Scenario 3 (complexe) : filtre attributaire ──
        try:
            res = ask("Sur la couche foret (qui a un champ 'surface'), applique un filtre pour "
                      "ne garder que les entites dont surface depasse 5000.", max_iters=5)
            t = tools_of(res); subset = foret.subsetString()
            ok = "5000" in subset and "surface" in subset.lower()
            rec("S3.filtre_attributaire", ok, f"tools={t} | subset={subset!r}")
            foret.setSubsetString("")
        except Exception as exc:
            rec("S3.filtre_attributaire", False, str(exc))

        # ── Scenario 4 (vision/style) : generer + appliquer un style ──
        try:
            res = ask("Stylise la couche foret par categories sur le champ 'type' : feuillu en vert "
                      "#228B22, resineux en vert fonce #006400, mixte en olive #808000. Utilise "
                      "generate_layer_style puis applyQmlStyle.", max_iters=6)
            t = tools_of(res)
            renderer = foret.renderer()
            rtype = renderer.type() if renderer is not None else ""
            ok = rtype == "categorizedSymbol"
            rec("S4.style_categorise", ok, f"tools={t} | renderer={rtype}")
        except Exception as exc:
            rec("S4.style_categorise", False, str(exc))

        _finish(plugin)
    except Exception:
        rec("fatal", False, traceback.format_exc())
        quit_app()


def _finish(plugin):
    try:
        if plugin is not None:
            plugin.unload()
    except Exception:
        pass
    quit_app()


# QGIS doit finir son init avant le scenario.
QTimer.singleShot(10000, main)
