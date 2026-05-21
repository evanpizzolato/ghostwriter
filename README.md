# Ghostwriter

## Overview
Ghostwriter is a privacy-focused, always-on-top notes overlay for macOS. It supports transparency, a collapsible sidebar, and a floating formatting toolbar. Notes auto-save, can be exported or imported, and can be hidden from screenshots when privacy mode is enabled.

Current version: **0.40.0**

## What You Can Do
- Capture notes in a lightweight overlay that stays above other apps.
- Toggle privacy mode to prevent content from appearing in screenshots.
- Adjust window transparency and use quick presets from the menu or tray.
- Use click-through mode to let mouse events pass to apps behind the window.
- Manage multiple notes from the collapsible sidebar with timestamps.
- Format selected text with a floating toolbar and a heading style dropdown.
- Import and export notes as Markdown or full backups.

## Editor Experience
- The editor uses a contenteditable layout with auto-save as you type.
- New text defaults to Heading 1, and pressing Enter in Heading 1 switches to Body.
- Bold is blocked on heading styles to keep headings consistent.
- The floating toolbar appears when text is selected or on double-click.
- A header edit icon creates a new note and sits to the left of the Privacy mode label.
- The new note button is disabled when the editor has no visible characters.

## Sidebar and Notes
- Notes are sorted by most recently updated.
- Each note shows a title derived from its first non-empty line.
- A guide note is injected on first launch to help onboard new users.

## Privacy and Click-Through
- Privacy mode uses OS-level content protection to hide notes from screenshots.
- Click-through mode disables editing and allows interaction with apps behind the window.
- Click-through state is tracked centrally — menu, tray, and `Cmd+Shift+T` shortcut stay in sync.

## Shortcuts
- `Cmd+Shift+N` — show/hide window
- `Cmd+Shift+O` — cycle opacity presets
- `Cmd+Shift+T` — toggle click-through
- `Cmd+Shift+Plus` / `Cmd+Shift+-` — font size
- `Opt+Cmd+S` — toggle sidebar
- `Cmd+B / I / U / L / D` — bold, italic, underline, bullet list, numbered list

## Data and Persistence
- Notes, active note, privacy state, and sidebar state are saved to disk automatically.
- Notes without any non-whitespace content are not persisted.
- State lives in the Electron `userData` directory as `notes.json`.

## Security Posture
- Renderer runs with `contextIsolation: true`, `nodeIntegration: false`, and a strict CSP.
- IPC surface is limited to a small allowlist exposed via `preload.js`.
- macOS hardened runtime is enabled; the app is signed with a Developer ID certificate and notarized for Gatekeeper.

## Building & Packaging

```bash
npm install
npm run dist-mac    # produces signed .dmg for arm64 and x64 in ./dist
./notarize.sh       # submits both DMGs to Apple notarization and staples the result
```

Prereqs for signing/notarization (one-time):
- Developer ID Application certificate in your login keychain.
- `xcrun notarytool store-credentials "ghostwriter-notarize" --apple-id <you@example.com> --team-id 463BF86Y8P --password <app-specific-password>`

The `identity` in `package.json > build.mac` controls codesigning; electron-builder runs it automatically. `notarize.sh` only handles the notarize + staple steps after the DMGs exist.

## Acknowledgments
Parts of the UI polish and color system in this project were built with the help of two Claude Code plugins by [Jakub Krehel](https://github.com/jakubkrehel) ([@jakubkrehel](https://x.com/jakubkrehel)):

- **[make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better)** — design-engineering principles for press feedback, hit-area expansion, tabular numerics, and transition discipline. Applied during the interaction polish pass; see `docs/design-system.md` §5.
- **[oklch-skill](https://github.com/jakubkrehel/oklch-skill)** — guidance for migrating the color palette to OKLCH (perceptually uniform color), unifying the blue ramp on a single hue, and introducing a neutral gray scale. Applied to `style.css` `:root` tokens; see `docs/design-system.md` §2.
