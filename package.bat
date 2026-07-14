@echo off
REM ONLYOFFICE Plugin Packager Script for Windows
echo Packaging ONLYOFFICE OneScript plugin...

IF NOT EXIST "plugin" (
    echo Error: plugin directory not found. Make sure you are running this from the repository root.
    exit /b 1
)

REM Create releases directory if it doesn't exist
if not exist "releases" (
    mkdir "releases"
)

REM Delete old plugin bundle if it exists to avoid Compress-Archive append/update issues
if exist "releases\onescript.plugin" (
    del /f /q "releases\onescript.plugin"
)

echo Bundling plugin files...
powershell -NoProfile -Command "Compress-Archive -Path 'plugin\*' -DestinationPath 'releases\onescript.plugin' -Force"

if %ERRORLEVEL% EQU 0 (
    echo Successfully built packaged plugin: releases\onescript.plugin
    echo You can now load this file directly in ONLYOFFICE Desktop Editors using:
    echo plugins Tab -> Plugin Manager -> My plugins -> Install plugin manually -> Select 'releases\onescript.plugin'
) else (
    echo Error: Packaging failed.
    exit /b 1
)
