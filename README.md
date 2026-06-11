# Ghostwriter

Privacy-focused notes that stay hidden from screenshots and screen shares.

[![Latest release](https://img.shields.io/github/v/release/evanpizzolato/ghostwriter?label=release)](https://github.com/evanpizzolato/ghostwriter/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/evanpizzolato/ghostwriter/total)](https://github.com/evanpizzolato/ghostwriter/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%2010.15%2B-blue)](https://github.com/evanpizzolato/ghostwriter/releases/latest)
[![License](https://img.shields.io/github/license/evanpizzolato/ghostwriter)](LICENSE)

![Ghostwriter — privacy-focused notes for macOS](docs/og.png)

Ghostwriter is an always-on-top notes overlay for macOS. It supports transparency, a collapsible sidebar, and a floating formatting toolbar. Notes auto-save and can be hidden from screen captures with OS-level content protection. Built with Electron; ships as a signed, notarized universal DMG with in-app auto-updates via electron-updater.

## Install

**[Download Ghostwriter.dmg](https://github.com/evanpizzolato/ghostwriter/releases/latest/download/Ghostwriter.dmg)** — universal (Apple Silicon + Intel), signed and notarized, auto-updates built in.

Or with [Homebrew](https://brew.sh):

```bash
brew install --cask evanpizzolato/tap/ghostwriter
```

More at the [website](https://evanpizzolato.github.io/ghostwriter/).

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

## Development

```bash
npm install
npm start
```

## Releases

```bash
npm run dist-mac    # signed universal DMG + mac zip in ./dist
./notarize.sh       # notarize and staple
```

The full publish workflow — tagging, release notes, asset upload, electron-updater manifest — is documented in `docs/handoff.md`. Latest signed build: [releases/latest](https://github.com/evanpizzolato/ghostwriter/releases/latest).

## Acknowledgments

Parts of the UI polish and color system in this project were built with the help of two Claude Code plugins by [Jakub Krehel](https://github.com/jakubkrehel) ([@jakubkrehel](https://x.com/jakubkrehel)):

- **[make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better)** — design-engineering principles for press feedback, hit-area expansion, tabular numerics, and transition discipline. Applied during the interaction polish pass; see `docs/design-system.md` §5.
- **[oklch-skill](https://github.com/jakubkrehel/oklch-skill)** — guidance for migrating the color palette to OKLCH (perceptually uniform color), unifying the blue ramp on a single hue, and introducing a neutral gray scale. Applied to `style.css` `:root` tokens; see `docs/design-system.md` §2.
