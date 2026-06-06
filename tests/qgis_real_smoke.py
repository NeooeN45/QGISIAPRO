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

        # Reproduction de carte (A-S6) : generer un QML categorise et l'appliquer
        try:
            from QGISIA2 import map_repro
            legend = [
                {"label": "A", "color": "#228B22", "geometry": "point"},
                {"label": "B", "color": "#1E90FF", "geometry": "point"},
            ]
            qml = map_repro.legend_to_qml(legend, field="name")
            style_msg = bridge.applyQmlStyle("smoke_layer", qml)
            renderer = layer.renderer()
            rtype = renderer.type() if renderer is not None else ""
            rec("bridge.applyQmlStyle", rtype == "categorizedSymbol",
                f"{style_msg} | renderer={rtype}")
        except Exception as exc:
            rec("bridge.applyQmlStyle", False, str(exc))

        # Symbologie institutionnelle FR (B-S1) : appliquer un preset ONF
        try:
            foret = QgsVectorLayer(
                "Polygon?crs=EPSG:2154&field=essence:string", "foret_test", "memory")
            fp = foret.dataProvider()
            for ess in ("chene", "hetre", "sapin"):
                feat = QgsFeature(foret.fields()); feat.setAttributes([ess])
                feat.setGeometry(QgsGeometry.fromWkt("Polygon((0 0,10 0,10 10,0 10,0 0))"))
                fp.addFeatures([feat])
            foret.updateExtents()
            QgsProject.instance().addMapLayer(foret)
            preset_msg = bridge.applySymbologyPreset("foret_test", "onf-peuplements", "")
            r2 = foret.renderer()
            rtype2 = r2.type() if r2 is not None else ""
            attr = r2.classAttribute() if rtype2 == "categorizedSymbol" else ""
            rec("bridge.applySymbologyPreset", rtype2 == "categorizedSymbol" and attr == "essence",
                f"{preset_msg} | renderer={rtype2} attr={attr}")
        except Exception as exc:
            rec("bridge.applySymbologyPreset", False, str(exc))

        # Catalogue mondial (P3-S1) : charger des fonds depuis le catalogue
        try:
            before = len(QgsProject.instance().mapLayers())
            msg_osm = bridge.addDataSource("osm-standard", "")
            msg_esri = bridge.addDataSource("esri-world-imagery", "")
            after = len(QgsProject.instance().mapLayers())
            rec("bridge.addDataSource", after >= before + 2,
                f"{msg_osm} | {msg_esri} | layers {before}->{after}")
        except Exception as exc:
            rec("bridge.addDataSource", False, str(exc))

        # Source inconnue -> message d'erreur propre (pas d'exception)
        try:
            msg_unknown = bridge.addDataSource("source-inexistante", "")
            rec("bridge.addDataSource.unknown", "inconnue" in msg_unknown.lower(), msg_unknown)
        except Exception as exc:
            rec("bridge.addDataSource.unknown", False, str(exc))

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
