# Changelog

## v0.41.0 — 2026-05-21

Polish pass on cold-start visuals.

### Cold start
- Window now stays fully invisible while the renderer hydrates notes and lays out the UI, then fades in (chrome + content together) over ~100ms. Replaces the prior `ready-to-show` reveal, which fired before content was settled and let the macOS traffic-light buttons appear over an empty transparent window.
- Reveal is gated on a new `renderer-ready` IPC signal, with a 2 s failsafe that force-shows at full opacity if the signal never arrives.

### Fixes
- Editor scrollbar thumb is visible again. The thumb had the same color as the track in v0.40, so it disappeared against the track even though scrolling worked. Thumb now uses `rgba(0,0,0,0.1)` on a transparent track, matching the sidebar.

## v0.40.0 — 2026-05-21

First release-quality build. Adds production packaging, hardening, and a real installer experience. Signed with Developer ID and notarized by Apple.

### Packaging
- Build pipeline rewritten: `npm run dist-mac` now produces signed, ready-to-notarize DMGs for both `arm64` and `x64`.
- Codesigning is automatic during build (Developer ID from `package.json > build.mac.identity`).
- `notarize.sh` collapses the three legacy per-arch sign scripts into one notarize+staple step that runs against the existing `ghostwriter-notarize` keychain profile.
- DMG installer now ships with a styled background (ghost watermark + arrow between the app icon and `Applications` shortcut) at 1× and 2× (Retina).
- `build.files` allowlist keeps docs, markdown, and signing scripts out of the packaged `.app`.

### Hardening
- Strict Content Security Policy meta on `index.html`.
- `BrowserWindow` now uses `show: false` + `ready-to-show` so the transparent window doesn't flash on cold start.
- Click-through state consolidated into a single source of truth in `main.js`; menu, tray, and `Cmd+Shift+T` global shortcut stay in sync without walking the menu hierarchy.
- Tray icon switched from an inline base64 placeholder to a real macOS template image (`build/trayTemplate.png` + `@2x`). Auto-inverts on light/dark menu bars.
- Contenteditable placeholder now renders via `data-placeholder` + CSS `:empty::before` (the native `placeholder` attribute is ignored on `<div contenteditable>`).

### Repo hygiene
- Added `.gitignore`; `node_modules/`, `dist/`, and `.DS_Store` no longer tracked.
- Removed obsolete top-level files (`complete_project.md`, `temp_icon.svg`, `create_temp_icon.sh`); moved Apple Developer reference notes into `docs/handoff.md`.
- README rewritten for v0.40 and the new build/notarize flow.
