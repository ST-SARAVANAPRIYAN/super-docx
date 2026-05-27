#!/bin/bash
# ONLYOFFICE Plugin Packager Script
set -e

# Change directory to plugin folder and zip all contents cleanly from root
echo "Packaging ONLYOFFICE Super Editor plugin..."
if [ -d "plugin" ]; then
    cd plugin
    # Check if zip is installed, fallback to python if not
    if command -v zip >/dev/null 2>&1; then
        zip -r ../super-docx.plugin ./*
    elif command -v python3 >/dev/null 2>&1; then
        python3 -c "import zipfile, os; zipf = zipfile.ZipFile('../super-docx.plugin', 'w', zipfile.ZIP_DEFLATED); [zipf.write(os.path.join(root, f), os.path.relpath(os.path.join(root, f), '.')) for root, d, files in os.walk('.') for f in files]; zipf.close()"
    elif command -v python >/dev/null 2>&1; then
        python -c "import zipfile, os; zipf = zipfile.ZipFile('../super-docx.plugin', 'w', zipfile.ZIP_DEFLATED); [zipf.write(os.path.join(root, f), os.path.relpath(os.path.join(root, f), '.')) for root, d, files in os.walk('.') for f in files]; zipf.close()"
    else
        echo "Error: Neither 'zip' nor 'python' is installed on your system. Unable to archive plugin."
        exit 1
    fi
    cd ..
    echo "Successfully built packaged plugin: super-docx.plugin"
    echo "You can now load this file directly in ONLYOFFICE Desktop Editors using:"
    echo "plugins Tab -> Plugin Manager -> My plugins -> Install plugin manually -> Select 'super-docx.plugin'"
else
    echo "Error: plugin directory not found. Make sure you are running this from the repository root."
    exit 1
fi
