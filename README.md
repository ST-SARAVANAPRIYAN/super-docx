# super-docx — ONLYOFFICE Plugin

Lightweight ONLYOFFICE plugin for advanced document serialization and styling.

This repository contains the source for the `super-docx` ONLYOFFICE plugin and a packaging script to produce a distributable `.plugin` file.

## Quick overview

- Purpose: provide document serialization, layout inspection, and automated styling helper utilities for ONLYOFFICE.
- Main plugin files: `plugin/index.html`, `plugin/plugin.js`, `plugin/config.json`.
- Build: `package.sh` produces `super-docx.plugin`.

## Repository structure

```text
.
├── plugin/                # ONLYOFFICE plugin source files
│   ├── config.json        # ONLYOFFICE plugin metadata and permissions
│   ├── index.html         # Sidebar UI and styles
│   ├── plugin.js          # Plugin runtime: initialization and handlers
│   └── resources/         # Icons and static assets
│       └── img/
├── package.sh             # Script to generate the .plugin archive
├── super-docx.plugin      # (generated) packaged plugin for installation
└── README.md
```

## Installation & Development

To develop and test local changes:

1. **Clean up old plugin directory structures:**
   ```bash
   rm -rf ~/.local/share/onlyoffice/desktopeditors/sdkjs-plugins/{6298516B-E753-435E-A2E4-2C76A28C73B2}
   rm -rf ~/.local/share/onlyoffice/desktopeditors/sdkjs-plugins/asc.{6298516B-E753-435E-A2E4-2C76A28C73B2}
   rm -rf /home/saravana/.local/share/onlyoffice/desktopeditors/editors/sdkjs-plugins/{6298516B-E753-435E-A2E4-2C76A28C73B2}
   ```

2. **Run the Hot-Sync File Watcher:**
   Since ONLYOFFICE's internal browser sandbox can have sandboxing or permission-based issues following symbolic links on Linux, we provide a premium Node.js hot-sync script. It recursively watches your local `plugin/` folder and instantly copies any modified files to ONLYOFFICE's physical plugin installation directories:
   ```bash
   node dev-watch.js
   ```

3. **Start ONLYOFFICE Desktop Editors in Debug Mode:**
   ```bash
   onlyoffice-desktopeditors --ascdesktop-support-debug-info
   ```

4. **Iterate:**
   Any change you make to `plugin/index.html` or `plugin/plugin.js` will instantly sync. Simply right-click on the plugin's sidebar within ONLYOFFICE and choose **Reload** to view updates instantly!

## Packaged Production Mode

To bundle the plugin into a distributable file for others:
```bash
./package.sh
# This produces super-docx.plugin in the repo root
```
Then, install it in ONLYOFFICE via **Plugin Manager** → **Add** (or **Install from File**).

## Features & Usage

The `super-docx` plugin automatically serializes document structures dynamically.

- **Dynamic Range Mode:** Removes the need to manually choose between "Selection Only" or "Entire Doc". If text is highlighted, the plugin automatically parses the selection (mapping the elements back to their absolute indices). If nothing is selected, it falls back to parsing the entire document.
- **Instant JSON Updates:** The structural JSON parses and compiles in real-time as the cursor or selection moves across the document.
- **Summarization & AI Commands:** Leverage AI assistance powered by Groq. Configure your API key and model in the Settings tab.


