#!/bin/bash
# ONLYOFFICE Plugin Packager Script
set -e

# Change directory to plugin folder and zip all contents cleanly from root
echo "📦 Packaging ONLYOFFICE Groq AI Copilot plugin..."
if [ -d "plugin" ]; then
    cd plugin
    # Create zip archive in root folder and rename to .plugin
    zip -r ../super-docx.plugin ./*
    cd ..
    echo "🎉 Successfully built packaged plugin: super-docx.plugin"
    echo "👉 You can now load this file directly in ONLYOFFICE Desktop Editors using:"
    echo "   Plugins Tab -> Plugin Manager -> My plugins -> Install plugin manually -> Select 'super-docx.plugin'"
else
    echo "Error: plugin directory not found. Make sure you are running this from the repository root."
    exit 1
fi
