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

## Installation

Developer (symlink) mode — for local development and live reload:

```bash
# create the plugins dir if needed
mkdir -p ~/.local/share/onlyoffice/desktopeditors/sdkjs-plugins/

# symlink this repo's plugin folder into ONLYOFFICE's plugins
ln -s "$PWD/plugin" ~/.local/share/onlyoffice/desktopeditors/sdkjs-plugins/super-docx

# restart ONLYOFFICE to load the plugin
```

Packaged mode — create a distributable plugin:

```bash
./package.sh
# This produces super-docx.plugin in the repo root
```

Then install via ONLYOFFICE's Plugin Manager → Install plugin manually.

## Usage

- Open ONLYOFFICE Desktop Editors.
- Open the Plugins sidebar and enable `super-docx`.
- Use the plugin UI to inspect serialization info and apply styling actions.

## Development

- Edit UI and scripts in `plugin/index.html` and `plugin/plugin.js`.
- Check JS console via Developer Tools (right-click → Inspect) while ONLYOFFICE is running with debug info.

Debug launch example:

```bash
onlyoffice-desktopeditors --ascdesktop-support-debug-info
```

## Contributing

- Fork and open a pull request for fixes or improvements.
- Use clear commit messages and include a short description of changes.

