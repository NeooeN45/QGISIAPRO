# -*- coding: utf-8 -*-
"""
Test REEL du bridge QGIS (a executer DANS QGIS via: qgis-bin --code).
Charge le plugin QGISIA2, cree une couche memoire, et exerce les slots du bridge
que l'agent appelle (getLayersList, setLayerOpacity, zoomToLayer, runScript reel).

Env requis :
    QGISIA_TEST_LOG        -> chemin du JSON de resultat
    QGISIA_PLUGIN_PARENT   -> dossier parent de QGISIA2 (racine du repo)
"""
import json
import os
import sys
import traceback

from qgis.PyQt.QtCore import QEventLoop, QTimer
from qgis.PyQt.QtWidgets import QApplication, QMessageBox
from qgis.core import (
    QgsFeature, QgsGeometry, QgsPointXY, QgsProject, QgsVectorLayer,
)
from qgis.utils import iface

LOG = os.environ["QGISIA_TEST_LOG"]
PARENT = os.environ["QGISIA_PLUGIN_PARENT"]
RESULTS = {"success": True, "qgis": "", "steps": []}


def rec(step, ok, detail="", data=None):
    RESULTS["steps"].append({"step": step, "ok": bool(ok), "detail": str(detail)[:200], "data": data})
    if not ok:
        RESULTS["success"] = False
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "w", encoding="utf-8") as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=2)


def quit_app():
    QTimer.singleShot(0, QApplication.instance().quit)


def build_layer():
    layer = QgsVectorLayer(
        "Point?crs=EPSG:3857&field=value:double&field=name:string", "smoke_layer", "memory")
    prov = layer.dataProvider()
    f1 = QgsFeature(layer.fields()); f1.setAttributes([2.0, "A"]); f1.setGeometry(QgsGeometry.fromPointXY(QgsPointXY(0, 0)))
    f2 = QgsFeature(layer.fields()); f2.setAttributes([8.0, "B"]); f2.setGeometry(QgsGeometry.fromPointXY(QgsPointXY(10, 10)))
    prov.addFeatures([f1, f2]); layer.updateExtents()
    QgsProject.instance().addMapLayer(layer)
    return layer


def main():
    plugin = None
    try:
        from qgis.core import Qgis
        RESULTS["qgis"] = Qgis.QGIS_VERSION
        # Rendre 'processing' (plugin QGIS) importable avant de charger notre plugin.
        from qgis.core import QgsApplication
        plugins_path = os.path.join(QgsApplication.pkgDataPath(), "python", "plugins")
        if plugins_path not in sys.path:
            sys.path.append(plugins_path)
        try:
            import processing  # noqa
            from processing.core.Processing import Processing
            Processing.initialize()
            rec("processing.init", True, plugins_path)
        except Exception as exc:
            rec("processing.init", False, str(exc))

        sys.path.insert(0, PARENT)
        import QGISIA2  # noqa
        rec("plugin.import", True, QGISIA2.__file__)

        plugin = QGISIA2.classFactory(iface)
        plugin.initGui()
        rec("plugin.initGui", getattr(plugin, "action", None) is not None)

        plugin.run()
        bridge = getattr(plugin, "bridge", None)
        rec("plugin.bridge", bridge is not None)
        if bridge is None:
            return _finish(plugin)

        layer = build_layer()

        layers = bridge.getLayersList()
        rec("bridge.getLayersList", "smoke_layer" in layers, data=layers)

        opacity_msg = bridge.setLayerOpacity("smoke_layer", 0.45)
        rec("bridge.setLayerOpacity", abs(layer.opacity() - 0.45) < 0.001, opacity_msg)

        zoom_msg = bridge.zoomToLayer("smoke_layer")
        rec("bridge.zoomToLayer", iface.activeLayer() == layer, zoom_msg)

        # Filtre attributaire reel
        filter_msg = bridge.filterLayer("smoke_layer", '"value" > 5')
        rec("bridge.filterLayer", layer.subsetString() == '"value" > 5', filter_msg)
        bridge.filterLayer("smoke_layer", "")

        # Statistiques zonales reelles
        try:
            stats = json.loads(bridge.getLayerStatistics("smoke_layer", "value"))
            rec("bridge.getLayerStatistics", abs(stats.get("mean", 0) - 5.0) < 0.001, data=stats)
        except Exception as exc:
            rec("bridge.getLayerStatistics", False, str(exc))

        # Reprojection reelle
        try:
            reproj_name = bridge.reprojectLayer("smoke_layer", "EPSG:4326")
            rec("bridge.reprojectLayer",
                bool(QgsProject.instance().mapLayersByName(reproj_name)), data=reproj_name)
        except Exception as exc:
            rec("bridge.reprojectLayer", False, str(exc))

        _finish(plugin)
    except Exception:
        tb = traceback.format_exc()
        last = tb.strip().splitlines()[-1] if tb.strip() else ""
        rec("fatal", False, last, data=tb)
        quit_app()


def _finish(plugin):
    try:
        if plugin is not None:
            plugin.unload()
    except Exception:
        pass
    quit_app()


# QGIS a besoin de temps pour finir son init avant de charger le plugin.
QTimer.singleShot(9000, main)
