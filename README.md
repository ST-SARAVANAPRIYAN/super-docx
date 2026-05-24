# ⚡ Groq AI Copilot v2 for ONLYOFFICE

An elite, glassmorphic, and fully autonomous AI document layout and typesetting assistant for **ONLYOFFICE Desktop Editors**. Infused with the raw power of Groq's high-speed inference engine (`llama-3.3-70b-versatile`), this extension allows you to autonomously edit, typeset, and style documents live with smooth animations and deep context awareness.

---

## 🚀 Features

*   **100% Autonomous Styling & Rewriting:** The AI can read, rewrite, format, and style paragraph blocks (fonts, half-point sizes, text alignment, spacing, and HEX colors) live inside the active document.
*   **Deep Context Serialization:** Extracts actual character font styles, sizes, and **RGB HEX values** directly from ONLYOFFICE's text runs, ensuring the AI model has perfect semantic understanding of your existing document layout.
*   **Robust JSON Command Orchestration:** Designed with a zero-friction JSON schema, structured and parsed natively to prevent AI hallucination or parsing drops.
*   **Glassmorphic Custom UI:** A state-of-the-art UI featuring tabs, suggestions chips, secure API key lockers (with visibility toggles), and model select capabilities.
*   **Live Interactive Log Console:** An animated, real-time developer terminal showing every scanner operation, Groq request latency, and C++ command execution inside ONLYOFFICE.

---

## 📂 Repository Structure

This repository is organized as a structured **Plugin Development Kit (PDK)**:

```text
├── plugin/                # The complete ONLYOFFICE plugin extension files
│   ├── config.json        # ONLYOFFICE configuration and permissions mapping
│   ├── index.html         # Elegant glassmorphic sidebar layout & styles
│   ├── plugin.js          # Core plugin initialization, context scanner, and range execution
│   └── resources/         # Premium design icon assets
│       └── img/
│           ├── icon.png
│           └── icon@2x.png
├── package.sh             # Compiles the plugin into a portable .plugin file
└── README.md              # Advanced developer guide & documentation
```

---

## 🛠️ How to Add and Install the Plugin

There are two elite methods for installing and developing this extension plugin.

### Method 1: Developer Symlink Mode (Recommended for Development)

This connects your active development folder directly to ONLYOFFICE so that any changes to your files are **live-reflected instantly** inside ONLYOFFICE without copying files around!

Open your terminal and run:

```bash
# 1. Create the plugins directory if it doesn't exist
mkdir -p ~/.local/share/onlyoffice/desktopeditors/sdkjs-plugins/

# 2. Create a symbolic link pointing to the plugin folder
ln -s "/home/saravana/projects/super-docx/plugin" "~/.local/share/onlyoffice/desktopeditors/sdkjs-plugins/{6298516B-E753-435E-A2E4-2C76A28C73B2}"
```

**To use:** Simply close ONLYOFFICE and re-open it. Go to the **Plugins** tab, and your new **Groq AI Copilot** will be ready in the toolbar!

---

### Method 2: Packaged Plugin Mode (For Sharing and Distribution)

If you want to package your plugin into a portable file to share with others or install cleanly using ONLYOFFICE's built-in GUI:

1.  **Build the portable archive:**
    Run the compiler script inside the repository root:
    ```bash
    ./package.sh
    ```
    This generates a portable file named `super-docx.plugin` in your repository root.

2.  **Install manually in ONLYOFFICE:**
    *   Open **ONLYOFFICE Desktop Editors**.
    *   Go to the **Plugins** tab.
    *   Click on **Plugin Manager**.
    *   Select the **My plugins** tab.
    *   Click **Install plugin manually**.
    *   Select your compiled `super-docx.plugin` file and click Open!

The plugin will be permanently installed directly inside the editor!

---

## ⚡ Development and Contributing

1.  **Modify UI / Scripting:** Edit `plugin/index.html` or `plugin/plugin.js`.
2.  **Live Debugging:** You can debug ONLYOFFICE live and view JS error logs by launching the client from terminal with debug support enabled:
    ```bash
    onlyoffice-desktopeditors --ascdesktop-support-debug-info
    ```
    Right-click anywhere inside the sidebar and click **Inspect Element** to open Chrome DevTools!
3.  **Git Updates:**
    ```bash
    git add .
    git commit -m "feat: implement advanced serialization and packaged shell script"
    git push origin main
    ```
