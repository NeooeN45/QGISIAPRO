@echo off
REM Launcher QGIS LTR avec environnement OSGeo4W complet.
REM Usage: _run_qgis.bat <chemin_script_python>
call "C:\Program Files\QGIS 3.44.8\bin\o4w_env.bat"
set "QGIS=%OSGEO4W_ROOT%\apps\qgis-ltr"
set "PATH=%QGIS%\bin;%PATH%"
set "QGIS_PREFIX_PATH=%QGIS%"
set "QT_PLUGIN_PATH=%QGIS%\qtplugins;%OSGEO4W_ROOT%\apps\Qt5\plugins"
set "PYTHONPATH=%QGIS%\python;%PYTHONPATH%"
set "QGIS_DISABLE_MESSAGE_HOOKS=1"
"%OSGEO4W_ROOT%\bin\qgis-ltr-bin.exe" --nologo --profile qgisia_test --code "%~1"
exit /b %ERRORLEVEL%
