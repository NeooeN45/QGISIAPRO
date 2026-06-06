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

        # Raster distant COG (P3-S2) : charger un COG public via /vsicurl/
        try:
            cog_url = "https://raw.githubusercontent.com/cogeotiff/rio-tiler/main/tests/fixtures/cog.tif"
            n_before = len(QgsProject.instance().mapLayers())
            msg_cog = bridge.addRemoteRaster(cog_url, "cog_test")
            n_after = len(QgsProject.instance().mapLayers())
            rec("bridge.addRemoteRaster", "charge" in msg_cog.lower() and n_after > n_before,
                f"{msg_cog} | layers {n_before}->{n_after}")
        except Exception as exc:
            rec("bridge.addRemoteRaster", False, str(exc))

        # Dossier territorial 1-clic (P2) : derouler un dossier
        try:
            n0 = len(QgsProject.instance().mapLayers())
            res_dossier = json.loads(bridge.runDossier("foret"))
            n1 = len(QgsProject.instance().mapLayers())
            steps = res_dossier.get("steps", [])
            loaded_ok = any("ajout" in (s.get("message", "").lower())
                            for s in steps if s.get("action") == "addDataSource")
            rec("bridge.runDossier",
                res_dossier.get("ok") is True and len(steps) == 3 and loaded_ok and n1 > n0,
                f"{res_dossier.get('summary')} | layers {n0}->{n1}")
        except Exception as exc:
            rec("bridge.runDossier", False, str(exc))

        # Dossier inconnu -> erreur propre
        try:
            res_unknown = json.loads(bridge.runDossier("dossier-bidon"))
            rec("bridge.runDossier.unknown", res_unknown.get("ok") is False,
                res_unknown.get("error", ""))
        except Exception as exc:
            rec("bridge.runDossier.unknown", False, str(exc))

        # Diagnostic satellite (P1) : 2 rasters mono-bande (RED, NIR) -> NDVI -> style
        try:
            import tempfile
            from osgeo import gdal, osr

            def _make_band(path, value):
                ds = gdal.GetDriverByName("GTiff").Create(path, 4, 4, 1, gdal.GDT_Float32)
                ds.SetGeoTransform([600000, 10, 0, 6200000, 0, -10])
                srs = osr.SpatialReference(); srs.ImportFromEPSG(2154)
                ds.SetProjection(srs.ExportToWkt())
                ds.GetRasterBand(1).Fill(value)
                ds.FlushCache()

            red_tif = os.path.join(tempfile.gettempdir(), "s2_red.tif")
            nir_tif = os.path.join(tempfile.gettempdir(), "s2_nir.tif")
            _make_band(red_tif, 0.2)
            _make_band(nir_tif, 0.6)
            m_red = bridge.addRasterFile(red_tif, "s2_red")
            m_nir = bridge.addRasterFile(nir_tif, "s2_nir")
            red_ok = bool(QgsProject.instance().mapLayersByName("s2_red"))
            nir_ok = bool(QgsProject.instance().mapLayersByName("s2_nir"))

            out_tif = os.path.join(tempfile.gettempdir(), "s2_ndvi.tif")
            band_map = json.dumps({"NIR": "s2_nir", "RED": "s2_red"})
            raw = bridge.computeSpectralIndex("scene", "ndvi", band_map, out_tif)
            payload = json.loads(raw) if raw else {}
            out_name = payload.get("outputLayerName", "")
            created = bool(out_name) and bool(QgsProject.instance().mapLayersByName(out_name))
            rec("bridge.computeSpectralIndex",
                created and payload.get("index") == "ndvi",
                f"red={red_ok}({m_red}) nir={nir_ok}({m_nir}) raw={raw[:150]!r} out={out_name}")
        except Exception as exc:
            rec("bridge.computeSpectralIndex", False, str(exc))

        # Detection de changement (P1) : difference de deux rasters (dNDVI)
        try:
            import tempfile
            from osgeo import gdal, osr

            def _mk(path, val):
                ds = gdal.GetDriverByName("GTiff").Create(path, 4, 4, 1, gdal.GDT_Float32)
                ds.SetGeoTransform([600000, 10, 0, 6200000, 0, -10])
                srs = osr.SpatialReference(); srs.ImportFromEPSG(2154)
                ds.SetProjection(srs.ExportToWkt())
                ds.GetRasterBand(1).Fill(val); ds.FlushCache()

            t1 = os.path.join(tempfile.gettempdir(), "ndvi_t1.tif")
            t2 = os.path.join(tempfile.gettempdir(), "ndvi_t2.tif")
            _mk(t1, 0.2); _mk(t2, 0.6)
            bridge.addRasterFile(t1, "ndvi_t1")
            bridge.addRasterFile(t2, "ndvi_t2")
            outd = os.path.join(tempfile.gettempdir(), "ndvi_diff.tif")
            rawd = bridge.computeRasterDifference("ndvi_t2", "ndvi_t1", outd)
            pd = json.loads(rawd) if rawd else {}
            on = pd.get("outputLayerName", "")
            created = bool(on) and bool(QgsProject.instance().mapLayersByName(on))
            rec("bridge.computeRasterDifference", created,
                f"out={on} expr={pd.get('expression')} style={pd.get('styled_with')}")
        except Exception as exc:
            rec("bridge.computeRasterDifference", False, str(exc))

        # Statistiques zonales (P1) : raster moyen par polygone
        try:
            poly = QgsVectorLayer("Polygon?crs=EPSG:2154", "zone_test", "memory")
            pf = QgsFeature()
            pf.setGeometry(QgsGeometry.fromWkt(
                "Polygon((600000 6199960, 600040 6199960, 600040 6200000, "
                "600000 6200000, 600000 6199960))"))
            poly.dataProvider().addFeatures([pf]); poly.updateExtents()
            QgsProject.instance().addMapLayer(poly)
            raw_zs = bridge.zonalStatistics("s2_red", "zone_test", "zs_")
            pzs = json.loads(raw_zs) if raw_zs else {}
            fields = pzs.get("fields_added", [])
            rec("bridge.zonalStatistics",
                pzs.get("ok") is True and any("mean" in f for f in fields),
                f"fields={fields}")
        except Exception as exc:
            rec("bridge.zonalStatistics", False, str(exc))

        # Analyse de proximite (buffer) : zone tampon autour des entites
        try:
            from qgis.core import QgsWkbTypes as _Wkb
            raw_buf = bridge.bufferLayer("smoke_layer", "5", "smoke_buf")
            pbuf = json.loads(raw_buf) if raw_buf else {}
            blayers = QgsProject.instance().mapLayersByName("smoke_buf")
            is_poly = bool(blayers) and blayers[0].geometryType() == _Wkb.PolygonGeometry
            rec("bridge.bufferLayer",
                pbuf.get("ok") is True and is_poly and pbuf.get("features", 0) >= 1,
                f"features={pbuf.get('features')} poly={is_poly}")
        except Exception as exc:
            rec("bridge.bufferLayer", False, str(exc))

        # Export livrable : sauver une couche en GeoPackage
        try:
            import tempfile
            gpkg = os.path.join(tempfile.gettempdir(), "export_test.gpkg")
            if os.path.exists(gpkg):
                os.remove(gpkg)
            raw_exp = bridge.saveVectorLayer("smoke_buf", gpkg, "GPKG")
            pexp = json.loads(raw_exp) if raw_exp else {}
            rec("bridge.saveVectorLayer",
                pexp.get("ok") is True and os.path.exists(gpkg),
                f"path={pexp.get('path')} exists={os.path.exists(gpkg)}")
        except Exception as exc:
            rec("bridge.saveVectorLayer", False, str(exc))

        # P1-S2 : charger des bandes Sentinel-2 reelles (STAC) sur une emprise
        try:
            raw_sat = bridge.loadSatelliteBands(
                "1.40,43.55,1.50,43.65", "sentinel-2-l2a",
                json.dumps(["RED", "NIR"]), "2024-01-01/2024-12-31")
            psat = json.loads(raw_sat) if raw_sat else {}
            bands = psat.get("bands", {})
            valid = all(QgsProject.instance().mapLayersByName(n) and
                        QgsProject.instance().mapLayersByName(n)[0].isValid()
                        for n in bands.values()) if bands else False
            rec("bridge.loadSatelliteBands",
                psat.get("ok") is True and len(bands) >= 1 and valid,
                f"item={psat.get('item')} bands={list(bands)} err={psat.get('error')} "
                f"raw={raw_sat[:160]!r}")
        except Exception as exc:
            rec("bridge.loadSatelliteBands", False, str(exc))

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
