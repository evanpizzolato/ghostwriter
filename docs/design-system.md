# Ghostwriter — Design System

Last updated: 2026-05-21

This is the source-of-truth reference for typography, color, and iconography used in the Ghostwriter UI. Update this file whenever you change `style.css`, the inline editor presets in `renderer.js`, or swap an icon.

> Portions of this design system were built with the help of two Claude Code plugins by [Jakub Krehel](https://github.com/jakubkrehel) ([@jakubkrehel](https://x.com/jakubkrehel)) — **make-interfaces-feel-better** (interaction polish, §5) and **oklch-skill** (color migration, §2). See `README.md` → Acknowledgments.

---

## 1. Typography

### Font family

A single system font stack is used everywhere — there are no web fonts, `@font-face` rules, or `@import`s. On macOS this resolves to **SF Pro**.

```
-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
```

Declared in three places in `style.css`: `body`, `#notes`, and the floating toolbar.

Font smoothing:
- `-webkit-font-smoothing: antialiased`
- `-moz-osx-font-smoothing: grayscale`

### Chrome / UI sizes (`style.css`)

| Element                              | Size  | Weight | Notes |
|--------------------------------------|------:|-------:|-------|
| `.header h1`                         | 15px  | 600    | Legacy — current header uses `.note-title-display` |
| `.note-title-display`                | 13px  | 400    | Header title (active note name) |
| `.note-item__select`                 | 13px  | 400    | Sidebar note title (inactive row); color `--text-primary`; `line-height: 1` |
| `.note-item--active .note-item__select` | 13px | 600  | Sidebar note title (active row); color `#000`; `line-height: 1` |
| `.note-list-empty`                   | 12px  | 400    | "No notes yet" empty state |
| `.title`                             | 13px  | 500    | Generic title utility class |
| `#save-status`                       | 13px  | 500    | "Saving…" / "Saved" indicator |
| `.privacy-badge` / `.privacy-label`  | 13px  | 500    | Header privacy badge |
| `.click-through-badge`               | 9px   | 600    | Compact badge when click-through is on |
| `.font-size-control label`           | 13px  | 400    | Style-dropdown label |
| `#font-size-select`                  | 13px  | 400    | Style dropdown |
| `.toolbar-toggle`                    | 13px  | 500    | Toolbar show/hide control (currently hidden) |
| `#notes` (editor base)               | 15px  | normal | Overridden per block by `data-font-style` |
| `.control-label`                     | 13px  | 500    | "Opacity" label |
| `#opacity-value`                     | 13px  | 500    | Opacity percentage readout |

### Editor block presets (`renderer.js`, `FONT_STYLES`)

These are applied inline on `div`, `p`, and `li` blocks via the `data-font-style` attribute. The dropdown in the toolbar exposes them.

| Key       | Label     | Size | Line-height | Weight |
|-----------|-----------|-----:|------------:|-------:|
| `body`    | Body      | 13px | 1.5         | 400    |
| `heading4`| Heading 4 | 15px | 1.2         | 500    |
| `heading3`| Heading 3 | 18px | 1.2         | 500    |
| `heading2`| Heading 2 | 20px | 1.2         | 500    |
| `heading1`| Heading 1 | 24px | 1.2         | 600    |

The same values are inlined in `DEFAULT_GUIDE_CONTENT` (the seeded onboarding note) — keep both in sync if you change them.

---

## 2. Color palette

Defined as CSS custom properties on `:root` in `style.css`. **All tokens are authored in OKLCH** — a perceptually uniform color space where `L` (lightness), `C` (chroma), `H` (hue) behave the way the names suggest. Equal `L` steps look equally bright; `H` stays constant across the full lightness range; `C` is colorfulness independent of lightness. This is what lets the blue ramp share one hue and the gray scale be visually uniform.

If you need to convert hex to OKLCH (e.g. from a Figma export), use [oklch.fyi](https://oklch.fyi) or `culori` in a one-off script. Don't hand-author hex into `style.css` anymore — add it to the tokens below first.

### Surfaces (semantic)
| Token              | OKLCH                      | sRGB equivalent | Use |
|--------------------|----------------------------|-----------------|-----|
| `--bg-primary`     | `oklch(1 0 0)`             | `#ffffff`       | Main window background |
| `--bg-secondary`   | `oklch(0.984 0.002 248)`   | `~#f8f9fa`      | Slightly off-white surface |
| `--bg-tertiary`    | `oklch(0.943 0.004 248)`   | `~#e9ecef`      | Light gray, borders / dividers |

### Neutral scale
Use these when `--bg-*` / `--text-*` don't fit semantically (one-off hover states, dividers between toolbar regions, etc.). The numbers follow a 100/200/700/900 scale — gaps left intentionally so we can fill in 400/500/600 later when dark mode lands.

| Token        | OKLCH                  | sRGB equivalent | Where it shows up |
|--------------|------------------------|-----------------|-------------------|
| `--gray-100` | `oklch(0.965 0 0)`     | `~#f6f6f6`      | Active sidebar note row background |
| `--gray-150` | `oklch(0.953 0 0)`     | `~#f3f3f3`      | Toolbar button hover; font-size control divider |
| `--gray-200` | `oklch(0.92 0 0)`      | `~#ebebeb`      | Inactive sidebar note hover; toolbar button `.active` |
| `--gray-300` | `oklch(0.83 0 0)`      | `~#cccccc`      | Privacy switch (off) track |
| `--gray-700` | `oklch(0.36 0 0)`      | `~#4c4c4c`      | Sidebar trash-icon color |
| `--gray-900` | `oklch(0.18 0 0)`      | `~#111111`      | Toolbar labels (font-size control) |

### Blues (accent)
All four blues share **hue 261** so the ramp reads as one color at every L. Previously `--blue-light` and `--blue-border` were on Bootstrap's older cyan-leaning hue (~232), which made them feel like a different blue.

| Token            | OKLCH                    | sRGB equivalent | Use |
|------------------|--------------------------|-----------------|-----|
| `--blue-primary` | `oklch(0.564 0.241 261)` | `~#0066f3`      | Primary action color, opacity slider fill, focus outlines |
| `--blue-hover`   | `oklch(0.495 0.203 261)` | `~#0056b3`      | Hover state for primary blue |
| `--blue-light`   | `oklch(0.952 0.019 261)` | `~#e8eefe`      | Tinted backgrounds (e.g. active sidebar row tint) |
| `--blue-border`  | `oklch(0.815 0.082 261)` | `~#a8c2f3`      | Medium-blue borders |

### Text
| Token              | OKLCH                    | sRGB equivalent | Use |
|--------------------|--------------------------|-----------------|-----|
| `--text-primary`   | `oklch(0.246 0.012 248)` | `~#212529`      | Default text; active sidebar note row title |
| `--text-secondary` | `oklch(0.555 0.013 248)` | `~#6c757d`      | De-emphasized text; placeholder; opacity readout |
| `--text-muted`     | `oklch(0.762 0.011 248)` | `~#adb5bd`      | Very low-emphasis text |

### Status
| Token       | OKLCH                    | sRGB equivalent | Use |
|-------------|--------------------------|-----------------|-----|
| `--success` | `oklch(0.594 0.156 145)` | `~#28a745`      | Success / saved indicators; privacy switch (on) track |
| `--warning` | `oklch(0.832 0.176 84)`  | `~#ffc107`      | Warning states |
| `--error`   | `oklch(0.585 0.222 27)`  | `~#dc3545`      | Error states |

### Privacy / click-through badge
The badge SVGs in `index.html` are hard-coded to `#9A410F` (burnt-orange). This color is **not** in the CSS variables. The matching badge CSS (`.privacy-badge`, `.click-through-badge`) also uses raw hex (`#ddffe4 / #157c2d`, `#FFF3D1 / #9A410F`) — these were deliberately left as literals during the OKLCH migration because we may want to unify them as a `success-soft` / `warning-soft` token pair in a future pass. If you change a badge style, update both the SVG fills and the CSS rules.

### Migration notes (OKLCH conversion, 2026-05-21)

- The sRGB equivalents above are approximate — the OKLCH values are the source of truth. Rendered pixels may differ from the old hex by 1–2 units in any channel because OKLCH was computed from perceived intent, not exact round-trip.
- `--blue-light` and `--blue-border` shifted hue from ~232 → 261 to match `--blue-primary`. Anywhere these tokens are visible, the blue family now reads as one color across the ramp. Expect a slight warming.
- Eight ad-hoc grays (`#EBEBEB`, `#F6F6F6`, `#E6E7E8`, `#f3f3f3`, `#ccc`, `#4C4C4C`, `#111`, `rgb(241,241,241)`) were replaced by `--gray-*` tokens. `#000` (active note title) was replaced with `--text-primary` since pure black was visual overkill given the surrounding `--text-primary` chrome.
- Out of scope for this pass and **left as raw hex/rgba**: opacity-driven whites (`rgba(255,255,255,…)`), shadow blacks (`rgba(0,0,0,…)`), the two badge color pairs above, the click-through pulse animation (`rgba(255,165,0,…)`), and the `#FFFFFF` literals on toolbar/slider backgrounds.

---

## 3. Icons

### Primary set: IBM Carbon Icons (https://carbondesignsystem.com/elements/icons/library/)

We use the standard (filled / non-outline) Carbon glyph set. Source: the `@carbon/icons` npm package — SVG paths come from `node_modules/@carbon/icons/svg/32/<name>.svg`.

All Carbon SVGs in this app use:
- `viewBox="0 0 32 32"` (Carbon's canonical source size)
- `fill="currentColor"` — so the icon picks up the surrounding text color
- A class pair: `carbon carbon-<name>` (`carbon` is a hook for future shared styling; the second class identifies the specific glyph)
- **No `stroke` attributes** — Carbon icons are filled, unlike the previous Feather set

Carbon icons are vector and scale smoothly to any rendered size. The package ships pixel-optimized 16/20/24px variants for *some* icons under `svg/16/`, `svg/20/`, `svg/24/`, but most icons (including everything we use here) only exist at 32px source. Rendered sizes below are the actual `width`/`height` set on each SVG element.

Currently used (with rendered size):

| Class                       | Carbon name        | Size  | Where it appears |
|-----------------------------|--------------------|------:|------------------|
| `carbon-open-panel-left`    | `open-panel--left` | 18px  | Header — sidebar toggle, collapsed state (`index.html`) |
| `carbon-open-panel-filled-left` | `open-panel-filled--left` | 18px | Header — sidebar toggle, expanded state (`index.html`) |
| `carbon-edit`               | `edit`             | 18px  | Header — new-note button (`index.html`) |
| `carbon-text-bold`          | `text--bold`       | 16px  | Floating toolbar (`index.html`) |
| `carbon-text-italic`        | `text--italic`     | 16px  | Floating toolbar (`index.html`) |
| `carbon-text-underline`     | `text--underline`  | 16px  | Floating toolbar (`index.html`) |
| `carbon-list-bulleted`      | `list--bulleted`   | 16px  | Floating toolbar — bullet list (`index.html`) |
| `carbon-list-numbered`      | `list--numbered`   | 16px  | Floating toolbar — numbered list (`index.html`) |
| `carbon-trash-can`          | `trash-can`        | 14px  | Sidebar — delete-note button (inlined in `renderer.js`); hidden by default, revealed on row hover |

### Stateful icons (outline ↔ filled swap)

The sidebar toggle is currently the only icon with a state-driven variant. Both SVGs are inlined in `index.html` inside the same `<button>`; CSS swaps which one is visible:

```css
.header-sidebar-toggle .sidebar-toggle-icon--filled { display: none; }
body:not(.sidebar-collapsed) .header-sidebar-toggle .sidebar-toggle-icon--outline { display: none; }
body:not(.sidebar-collapsed) .header-sidebar-toggle .sidebar-toggle-icon--filled { display: inline-block; }
```

When adding another stateful icon, follow the same pattern: inline both variants, drive visibility off an existing body / element class, and keep both SVGs marked `aria-hidden="true"` since the parent button carries the label.

### Adding a new Carbon icon

1. Find the icon at https://carbondesignsystem.com/elements/icons/library/ and note its kebab-case name (e.g. `chevron--down`).
2. Copy the SVG markup from `node_modules/@carbon/icons/svg/32/<name>.svg` (install the package with `npm install --no-save @carbon/icons` if it isn't there).
3. Inline it in `index.html` (or wherever needed) with these attributes:
   ```html
   <svg class="carbon carbon-<name>" xmlns="http://www.w3.org/2000/svg"
        width="16" height="16" viewBox="0 0 32 32" fill="currentColor">
     <!-- paths -->
   </svg>
   ```
4. Set `width` / `height` to the rendered size you actually want (16 / 18 / 20 / 24…); the viewBox stays `0 0 32 32`.

Note: `@carbon/icons` is **not** added to `package.json` as a runtime dependency. We just copy the inline SVG paths — there's nothing to ship.

### Non-icon decorative SVGs (intentionally not Carbon)

These are bespoke branding glyphs, not part of an icon set. Leave them as-is unless you're redesigning the badge itself.

| Glyph                         | Size    | Location          | Notes |
|-------------------------------|---------|-------------------|-------|
| Click-through badge composite | 10–11px | `index.html` badge | Burnt-orange (`#9A410F`) cursor + house + "T" glyphs that read as "click-through" status |

### App icon

The macOS app icon lives at `build/icon.icns` (with PNG sources in `build/icon.iconset/`) and is rendered as a ghost outline at 1024×1024. It is not a UI icon — it's the dock / Finder icon for the packaged app.

---

## 4. Spacing & shape (quick reference)

These are not strictly typography, but they show up enough to be worth pinning:

- Border radius: window `10px` (`body`), toolbar wrapper `9px`, toolbar buttons `7px` (concentric: outer = inner + 2px button margin), header buttons `6px`, sidebar note delete `5px`
- Header height: `40px`, padded `0 12px`
- Header is `-webkit-app-region: drag` — the entire bar acts as the macOS title-bar drag handle
- Editor padding: `24px 40px` on `#notes`

### Concentric radius rule

When nesting rounded surfaces, the inner radius should equal the outer radius minus the padding/margin between them. The toolbar is the load-bearing example here: `9px` outer wrapper, `2px` button margin, `7px` inner button.

---

## 5. Interaction polish

These are the small details that keep controls feeling tactile. They apply across every interactive surface in the app, not just the ones called out here.

### Press feedback

Every interactive control scales to `0.96` on `:active`. Use a property-specific transition — never `transition: all` — so the scale doesn't drag other animating properties along with it:

```css
.toolbar-btn {
  transition: background-color 0.1s ease, scale 0.12s ease;
}
.toolbar-btn:active {
  scale: 0.96;
}
```

Currently applied to: `.toolbar-btn`, `.header-sidebar-toggle`, `.header-new-note-button`, `.note-item__delete`. Never use a scale below `0.95` — anything tighter reads as exaggerated.

### Hit area expansion

Chrome controls are visually compact (28×28 for the header buttons, 26×26 for toolbar buttons). When a control would otherwise have a sub-40px hit target, expand it with a pseudo-element instead of inflating the visible chrome:

```css
.header-sidebar-toggle::before,
.header-new-note-button::before {
  content: '';
  position: absolute;
  inset: -6px;
}
```

The pseudo-element extends the clickable region by 6px on every side without changing the painted button. The parent must be `position: relative`.

### Tabular numbers

Any dynamically updating number must use `font-variant-numeric: tabular-nums` to prevent layout shift as digits change width. Currently applied to `#opacity-value`. Apply the same rule if you ever add a word count, character count, timer, etc.

### Text wrapping

`#notes` uses `text-wrap: pretty` so the editor avoids orphan words at the end of paragraphs. Headings inside the editor are user-entered, so `balance` isn't applied at the editor level — apply it manually only on fixed chrome headings (none currently in use).

### Transition discipline

- Always name the properties you're transitioning. `transition: all` and bare-duration shorthands like `transition: .3s` (which Browser-expands to `all .3s`) cause unrelated property changes to animate accidentally.
- Reserve keyframes for staged sequences that run once. State changes (hover, active, focus) should be CSS transitions on the element so they can be interrupted mid-animation.

---

## 6. Dark mode — implementation plan (deferred)

We're not shipping dark mode yet, but the OKLCH migration was done with dark mode in mind. When we decide to add it, this is the playbook so we don't have to rediscover it.

### Why OKLCH makes this easy

Because every token is `oklch(L C H)`, dark mode is mostly a matter of **mirroring L around 0.5** while keeping `H` constant and trimming `C` slightly (saturated colors look more aggressive on dark surfaces). Concretely, for most tokens: `dark_L ≈ 1 - light_L`, `dark_H = light_H`, `dark_C ≈ light_C * 0.85`.

### Mechanics

Override the `:root` tokens inside a media query at the top of `style.css`:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: oklch(0.18 0 0);
    --bg-secondary: oklch(0.22 0.004 248);
    --bg-tertiary: oklch(0.28 0.005 248);

    --gray-100: oklch(0.24 0 0);
    --gray-150: oklch(0.27 0 0);
    --gray-200: oklch(0.32 0 0);
    --gray-300: oklch(0.42 0 0);
    --gray-700: oklch(0.72 0 0);
    --gray-900: oklch(0.92 0 0);

    --blue-primary: oklch(0.70 0.18 261);   /* lighter L, slightly less C for dark surfaces */
    --blue-hover:   oklch(0.76 0.16 261);
    --blue-light:   oklch(0.30 0.06 261);   /* tint flips: becomes a dark blue surface */
    --blue-border:  oklch(0.45 0.10 261);

    --text-primary:   oklch(0.96 0.005 248);
    --text-secondary: oklch(0.75 0.010 248);
    --text-muted:     oklch(0.55 0.010 248);

    --success: oklch(0.74 0.16 145);
    --warning: oklch(0.85 0.17 84);
    --error:   oklch(0.70 0.19 27);
  }
}
```

These values are a starting point — verify in-app, don't ship the table blindly.

### Non-trivial work the media-query trick won't cover

These items will need real attention beyond token overrides:

1. **Hard-coded whites in `style.css`** — `rgba(255,255,255,…)` on `body`, `.header`, `.main-column`, `.content`, `.controls`, the toolbar wrapper, and the slider thumb. Replace with `var(--bg-primary)` (then opacity-controlled forms can use `color-mix(in oklch, var(--bg-primary) X%, transparent)` or stay as semantic vars driven by opacity logic).
2. **Hard-coded whites in `renderer.js`** — the opacity slider mutates `rgba(255,255,255,…)` inline at runtime (`renderer.js:900-918`). Refactor to read the current surface token via `getComputedStyle` and apply opacity in OKLCH, or drive opacity via a separate CSS custom property and keep the color in CSS.
3. **Shadow blacks** — `rgba(0,0,0,…)` on toolbar/slider shadows will look wrong on a dark surface. Switch to a `--shadow-color` token that's near-black in light mode and pure-black-with-higher-alpha in dark mode (shadows need more opacity on dark backgrounds to remain visible).
4. **Badge color pairs** — privacy badge (`#ddffe4 / #157c2d`) and click-through badge (`#FFF3D1 / #9A410F`) are still raw hex. Migrate them to `--success-soft / --success-soft-fg` and `--warning-soft / --warning-soft-fg` tokens so dark mode can flip them sensibly (dark mode wants `bg ≈ 0.28 C 0.05` + `fg ≈ 0.85 C 0.13`).
5. **Click-through pulse animation** — `rgba(255,165,0,…)` keyframes are tuned to a white window. The orange glow may need a different L or alpha on a dark backdrop.
6. **App icon / window chrome** — macOS will switch the title-bar tint automatically (since we use `vibrancy`/standard chrome), but verify the drag region and the click-through badge composite still read at the correct contrast.

### Manual override (optional)

If we want a user-controllable toggle (not just `prefers-color-scheme`), the standard pattern is:

```css
:root[data-theme="dark"] { /* same overrides as above */ }
```

…and a tiny piece of `renderer.js` that reads a persisted preference, sets `document.documentElement.dataset.theme`, and ignores `prefers-color-scheme` once the user has chosen explicitly. Don't ship this until the media-query path is stable.

### Contrast verification before shipping

For every token pair that appears together (text on background, badge text on badge bg, focus outline on its parent), run APCA at the candidate dark values. Targets: `|Lc| >= 60` for normal text, `>= 75` for "pass plus". Adjust **L only** — chroma has negligible effect on contrast. The light palette already passes by construction; dark needs re-verification because we're shifting both L and C.

---

## 7. Recent change log

- **2026-05-21** — OKLCH migration (scope 1+2). Converted every `:root` token in `style.css` from hex/rgb to OKLCH. Unified the blue ramp on a single hue (261) — `--blue-light` and `--blue-border` previously sat at hue ~232 (Bootstrap's older cyan-leaning blue), making the ramp look like two colors. Introduced a `--gray-{100,150,200,300,700,900}` neutral scale and replaced eight ad-hoc grays inline in `style.css` (`#EBEBEB`, `#F6F6F6`, `#E6E7E8`, `#f3f3f3`, `#ccc`, `#4C4C4C`, `#111`, `rgb(241,241,241)`) along with `#000` on the active sidebar note title (→ `--text-primary`). Inline `#0066F3` references in focus outlines also moved to `var(--blue-primary)`. Out of scope and left as literals: opacity-driven `rgba(255,255,255,…)`, shadow `rgba(0,0,0,…)`, the two status badge color pairs, the click-through pulse animation, and `#FFFFFF` on toolbar/slider backgrounds. Added §6 "Dark mode — implementation plan" so the conversion pays off later. No visual regressions intended; expect a barely-perceptible warming on `--blue-light` / `--blue-border` since their hue shifted.
- **2026-05-21** — Interaction polish pass. Added `font-variant-numeric: tabular-nums` to `#opacity-value` so the percentage readout doesn't jitter as it counts. Added a `:active { scale: 0.96 }` press response to `.toolbar-btn`, `.header-sidebar-toggle`, `.header-new-note-button`, and `.note-item__delete`, each paired with an explicit `scale 0.12s ease` transition (never `transition: all`). Bumped `.toolbar-btn` border-radius from `6px` → `7px` so the inner radius is concentric with the toolbar wrapper's `9px` outer radius (outer = inner + 2px margin). Extended the hit area of the two header buttons via a `::before` pseudo-element with `inset: -6px` (visible chrome stays 28×28, hit target grows to ~40×40). Replaced the implicit `transition: .3s` on `.privacy-switch .slider` / `:before` with property-specific transitions (`background-color` and `transform` respectively). Added `text-wrap: pretty` to `#notes` to avoid orphan words in body copy.
- **2026-05-21** — Sidebar toggle icon now swaps based on sidebar state. When the sidebar is collapsed the header button shows `open-panel--left` (outline); when the sidebar is open it shows `open-panel-filled--left` (same outer frame + divider, with the left panel filled). Both SVGs live in `index.html`; visibility is driven purely off the existing `body.sidebar-collapsed` class via the CSS rules `.sidebar-toggle-icon--outline` / `.sidebar-toggle-icon--filled` — no JS changes.
- **2026-05-21** — Body text shrunk from 14px → 13px and the "16px tier" (Heading 4, header `h1`, `#notes` editor base) shrunk from 16px → 15px. Applied across `style.css`, `renderer.js` (`FONT_STYLES`), and the `DEFAULT_GUIDE_CONTENT` inline styles. Margins of `16px` and icon dimensions of `14`/`16` were intentionally **not** changed.
- **2026-05-21** — Swapped the entire icon set from Feather Icons (thin stroked outlines, `stroke-width="1.75"`, 24×24 viewBox) to IBM Carbon Icons (filled glyphs, `fill="currentColor"`, 32×32 viewBox). Eight icons updated: sidebar toggle, new-note (edit), bold, italic, underline, bullet list, numbered list, trash. The bespoke underline and numbered-list custom SVGs were retired in favor of Carbon equivalents; the click-through badge composite was preserved (it's branding, not an icon). Class naming changed from `feather feather-*` to `carbon carbon-*`. Carbon icons are visually heavier than Feather — expect the toolbar to feel more solid.
- **2026-05-21** — Redesigned the sidebar active-note state. Active row now uses `#F6F6F6` background with a 3px `--blue-primary` left rule (instead of the previous solid-blue fill with white text); padding is `8px 8px 8px 24px`. All rows carry a 3px transparent left border so active/inactive titles stay horizontally aligned. The per-row trash button is hidden by default (`opacity: 0`) and revealed on row hover or keyboard focus; its glyph was scaled from 12px → 14px. Removed now-stale white-on-blue overrides for the active row's trash button and timestamp.
- **2026-05-21** — Removed the per-row relative timestamp from the sidebar ("just now", "2h ago", etc.) along with its `.note-item__timestamp` CSS rule and the `formatRelativeTimestamp` helper. Sidebar note title font landed at: inactive `13px / 400` (`--text-primary`); active `13px / 600` (`#000`). `line-height: 1` on `.note-item__select` and `min-height: 44px` removed from `.note-item` so the row height is now driven purely by `8px + line-height + 8px ≈ 29px`. Weight history: started at 480 (rendered as 500 — Chromium snaps non-standard weights since SF Pro ships as discrete static files); bumped to 500 explicitly, then to 600 for visible contrast against the inactive 400 row.
- **2026-05-21** — Removed the inter-row `border-bottom: 1px solid var(--bg-tertiary)` divider between sidebar notes. Added a single `border-top: 1px solid rgba(0, 0, 0, 0.05)` to `.note-list` — the same value as the sidebar's right edge — so the note list still has a clean top boundary. *Initially placed on `.note-list .note-item:first-child`, but the alpha-channel border composited over the active row's `#F6F6F6` background (→ ~`#EAEAEA`) instead of the sidebar's white (→ ~`#F2F2F2`), making it visibly darker than the right edge. Moving it onto `.note-list` (no background) puts it on the same backdrop as the right edge so both render identically.*
