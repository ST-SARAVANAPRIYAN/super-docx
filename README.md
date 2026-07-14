# OneScript — ONLYOFFICE Plugin

Lightweight ONLYOFFICE plugin for advanced document serialization and styling.

This repository contains the source for the `OneScript` ONLYOFFICE plugin and a packaging script to produce a distributable `.plugin` file.

## Quick overview

- Purpose: provide document serialization, layout inspection, and automated styling helper utilities for ONLYOFFICE.
- Main plugin files: `plugin/index.html`, `plugin/plugin.js`, `plugin/config.json`.
- Build: `package.sh` (Linux/macOS) or `package.bat` (Windows) produces `releases/onescript.plugin`.

## Repository structure

```text
.
├── plugin/                # ONLYOFFICE plugin source files
│   ├── config.json        # ONLYOFFICE plugin metadata and permissions
│   ├── index.html         # Sidebar UI and styles
│   ├── plugin.js          # Plugin runtime: initialization and handlers
│   └── resources/         # Icons and static assets
│       └── img/
├── package.sh             # Script to generate the .plugin archive (Linux/macOS)
├── package.bat            # Script to generate the .plugin archive (Windows)
├── releases/              # (generated) directory containing built plugin packages
│   └── onescript.plugin   # packaged plugin for installation
└── README.md
```

## Installation & Development

To develop and test local changes:

1. **Clean up old plugin directory structures:**
   * **On Linux/macOS:**
     ```bash
     rm -rf ~/.local/share/onlyoffice/desktopeditors/sdkjs-plugins/{6298516B-E753-435E-A2E4-2C76A28C73B2}
     rm -rf ~/.local/share/onlyoffice/desktopeditors/sdkjs-plugins/asc.{6298516B-E753-435E-A2E4-2C76A28C73B2}
     rm -rf ~/.local/share/onlyoffice/desktopeditors/editors/sdkjs-plugins/{6298516B-E753-435E-A2E4-2C76A28C73B2}
     ```
   * **On Windows (PowerShell):**
     ```powershell
     Remove-Item -Path "$env:LOCALAPPDATA\ONLYOFFICE\DesktopEditors\data\sdkjs-plugins\asc.{6298516B-E753-435E-A2E4-2C76A28C73B2}" -Recurse -Force -ErrorAction SilentlyContinue
     Remove-Item -Path "$env:LOCALAPPDATA\ONLYOFFICE\DesktopEditors\data\sdkjs-plugins\{6298516B-E753-435E-A2E4-2C76A28C73B2}" -Recurse -Force -ErrorAction SilentlyContinue
     ```

2. **Run the Hot-Sync File Watcher:**
   We provide a premium Node.js hot-sync script. It copies all plugin files on startup (full sync) and recursively watches the local `plugin/` folder, copying any modifications immediately:
   ```bash
   node dev-watch.js
   ```

3. **Start ONLYOFFICE Desktop Editors in Debug Mode:**
   To bypass caching and view changes, you must run ONLYOFFICE in debug mode:
   * **On Windows (PowerShell):**
     ```powershell
     & "C:\Program Files\ONLYOFFICE\DesktopEditors\DesktopEditors.exe" --ascdesktop-support-debug-info
     ```
   * **On Linux:**
     ```bash
     onlyoffice-desktopeditors --ascdesktop-support-debug-info
     ```
   * **On macOS:**
     ```bash
     /Applications/ONLYOFFICE.app/Contents/MacOS/ONLYOFFICE --ascdesktop-support-debug-info
     ```

4. **Iterate:**
   Any change you make to `plugin/index.html` or `plugin/plugin.js` will instantly sync. Simply right-click on the plugin's sidebar within ONLYOFFICE and choose **Reload** to view updates!

5. **Troubleshooting Caching:**
   If ONLYOFFICE is still not showing your changes, it is using a cached version of the plugin. To clear the Chromium Embedded Framework (CEF) cache:
   * Run the watcher with the `--clear-cache` flag (ensure ONLYOFFICE is fully closed first):
     ```bash
     node dev-watch.js --clear-cache
     ```
   * Or manually delete the cache folder:
     * **Windows:** `%LOCALAPPDATA%\ONLYOFFICE\DesktopEditors\data\cache`
     * **Linux:** `~/.config/onlyoffice/DesktopEditors/cache`

## Packaged Production Mode

To bundle the plugin into a distributable file for others:

**On Linux/macOS:**
```bash
./package.sh
```

**On Windows:**
```cmd
package.bat
```

This produces `releases/onescript.plugin`.

Then, install it in ONLYOFFICE via **Plugin Manager** → **Add** (or **Install from File**) and select `releases/onescript.plugin`.

## Features & Usage

The `OneScript` plugin automatically serializes document structures dynamically.

- **Dynamic Range Mode:** Removes the need to manually choose between "Selection Only" or "Entire Doc". If text is highlighted, the plugin automatically parses the selection (mapping the elements back to their absolute indices). If nothing is selected, it falls back to parsing the entire document.
- **Instant JSON Updates:** The structural JSON parses and compiles in real-time as the cursor or selection moves across the document.
- **Summarization & AI Commands:** Leverage AI assistance powered by Groq. Configure your API key and model in the Settings tab.


