# Arlo Design System — Design Tokens Reference

Native-OS (Apple HIG–style) design system for Arlo Lite. Follow this file exactly when generating UI. Light theme by default; dark theme via `[data-theme="dark"]` on the root element. All values are also available as CSS custom properties (names given per token).

---

## 1. Typography

**Font families**
- UI text & display: `"SF Pro", -apple-system, BlinkMacSystemFont, system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif` → `--font-text` / `--font-display`
- Rounded (optional numerals/badges): `ui-rounded, "Hiragino Maru Gothic ProN", "SF Pro", …` → `--font-rounded`
- Mono (code, keys, token counts): `ui-monospace, Menlo, Monaco, "Courier New", monospace` → `--font-mono`

**Weights:** regular 400 · medium 500 · semibold 600 · bold 700 (`--weight-*`)

**Type scale (size / line-height, px)**

| Style | Size | Line | Weight | Use |
|---|---|---|---|---|
| Large Title | 28 | 34 | 700 | Screen titles (large nav state), tracking −0.4px |
| Title 1 | 24 | 30 | 700 | Page headers, tracking −0.4px |
| Title 2 | 19 | 24 | 700 | Section titles |
| Title 3 | 17 | 22 | 600 | Card titles |
| Headline | 15 | 20 | 600 | Row titles (emphasized), sender names |
| Body | 15 | 20 | 400 | Default text, messages, list rows |
| Callout | 14 | 18 | 400 | Secondary body, button labels (md) |
| Subheadline | 13 | 17 | 400 | Sublines under row titles |
| Footnote | 12 | 16 | 400 | List footers, timestamps, metadata |
| Caption 1 | 11 | 14 | 400 | Badges, fine print |
| Caption 2 | 10 | 12 | 400 | Smallest labels (tab bar) |

Tokens: `--type-{large-title|title1|title2|title3|headline|body|callout|subhead|footnote|caption1|caption2}-size/-line`.

**Tracking:** tight −0.4px (Large Title / Title 1) · normal 0 · wide +0.35px (ALL-CAPS section headers). Buttons use −0.2px.

**Casing:** Title Case for nav titles/section headers; Sentence case for body/footers; ALL-CAPS only for grouped-list section headers (footnote size, `--tracking-wide`, `--text-secondary`).

---

## 2. Color

### System colors (light → dark value)

| Token | Light | Dark |
|---|---|---|
| `--sys-red` | #FF3B30 | #FF453A |
| `--sys-orange` | #FF9500 | #FF9F0A |
| `--sys-yellow` | #FFCC00 | #FFD60A |
| `--sys-green` | #34C759 | #30D158 |
| `--sys-mint` | #00C7BE | #63E6E2 |
| `--sys-teal` | #30B0C7 | #40C8E0 |
| `--sys-cyan` | #32ADE6 | #64D2FF |
| `--sys-blue` | #007AFF | #0A84FF |
| `--sys-indigo` | #5856D6 | #5E5CE6 |
| `--sys-purple` | #AF52DE | #BF5AF2 |
| `--sys-pink` | #FF2D55 | #FF375F |
| `--sys-brown` | #A2845E | #AC8E68 |

### Accent & intent
- **Accent** `--color-accent`: `var(--sys-blue)` #007AFF light / #0A84FF dark. *(Arlo Lite prototype uses indigo — swap by reassigning `--color-accent: var(--sys-indigo)`.)*
- Pressed accent `--color-accent-pressed`: #0060DF light / #409CFF dark
- On-accent text `--color-on-accent`: #FFFFFF
- Destructive: `--sys-red` · Success: `--sys-green` · Warning: `--sys-orange` · Info: `--sys-blue`
- Links `--text-link`: accent color; no underline at rest

### Text (label) colors

| Token | Light | Dark | Use |
|---|---|---|---|
| `--text-primary` | rgba(0,0,0,1) | rgba(255,255,255,1) | Titles, body |
| `--text-secondary` | rgba(60,60,67,0.6) | rgba(235,235,245,0.6) | Sublines, metadata |
| `--text-tertiary` | rgba(60,60,67,0.3) | rgba(235,235,245,0.3) | Placeholders, disabled |
| `--label-quaternary` | rgba(60,60,67,0.18) | rgba(235,235,245,0.16) | Faintest hints |

### Grays

Light: gray-1 #8E8E93 · gray-2 #AEAEB2 · gray-3 #C7C7CC · gray-4 #D1D1D6 · gray-5 #E5E5EA · gray-6 #F2F2F7
Dark: gray-1 #8E8E93 · gray-2 #636366 · gray-3 #48484A · gray-4 #3A3A3C · gray-5 #2C2C2E · gray-6 #1C1C1E

### Backgrounds & surfaces

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg-primary` | #FFFFFF | #000000 | Plain content views |
| `--bg-secondary` | #F2F2F7 | #1C1C1E | App background behind cards |
| `--bg-tertiary` / `--surface-card` | #FFFFFF | #2C2C2E | Cards, sheets |
| `--bg-grouped-primary` | #F2F2F7 | #000000 | Grouped-list page bg |
| `--bg-grouped-secondary` / `--surface-row` | #FFFFFF | #1C1C1E | List row bg |

### Fills (control backings, translucent)
- `--fill-primary` rgba(120,120,128,0.2) / dark 0.36
- `--fill-secondary` rgba(120,120,128,0.16) / dark 0.32
- `--fill-tertiary` rgba(118,118,128,0.12) / dark 0.24 — default control backing (`--surface-control`)
- `--fill-quaternary` rgba(116,116,128,0.08) / dark 0.18 — row press/hover tint

### Separators
- Hairline `--separator`: rgba(60,60,67,0.29) light / rgba(84,84,88,0.6) dark
- Opaque `--separator-opaque`: #C6C6C8 light / #38383A dark
- List row separators are **inset** to align with the leading text (start after the icon tile).

---

## 3. Spacing & Layout

**4pt grid:** `--space-1..10` = 4, 8, 10, 12, 16, 18, 24, 30, 36, 48 px.

**Insets:** screen edge 12px (`--inset-screen`) · list row leading/trailing 12px · grouped-list side margin 14px · macOS gutter 14px.

**Minimum hit target:** 38px (`--hit-target`) — nothing tappable smaller.

**Corner radii:** xs 4 · sm 5 · md 6 (buttons, fields) · lg 8 (grouped list containers) · xl 9 (cards) · 2xl 12 (large cards, sheets) · pill 999 (capsules, switches). Icon tiles: 7px.

**Control heights:** iOS large 40px · iOS small 28px · mac push button 24px.

---

## 4. Buttons

Five variants; all use `--font-text`, letter-spacing −0.2px, `line-height: 1`, no border, nowrap.

**Sizes**

| Size | Height | Padding-x | Font | Weight | Radius | Gap (icon) |
|---|---|---|---|---|---|---|
| sm | 28px | 12px | 13px | 500 | 5px (`--radius-sm`) | 5px |
| md (default) | 34px | 14px | 14px | 600 | 6px (`--radius-md`) | 6px |
| lg | 42px | 18px | 15px | 600 | 8px (`--radius-lg`) | 7px |

**Variants**
- **Filled** (primary): bg `--color-accent`, text `--color-on-accent` (#fff)
- **Tinted** (secondary): bg = accent at 15% (`color-mix(in srgb, var(--color-accent) 15%, transparent)`), text = accent
- **Gray**: bg `--fill-tertiary`, text `--text-primary`
- **Bordered** (mac push): bg `--surface-card`, text `--text-primary`, `box-shadow: inset 0 0 0 0.5px var(--separator-opaque), var(--shadow-1)`
- **Plain** (text button): transparent bg, text = accent, minimal padding

**States**
- Pressed: `transform: scale(0.97)` + `opacity: 0.82`, transition 150ms `--ease-standard`
- Disabled: `opacity: 0.4`, no press response
- Destructive: same variants with accent → `--color-destructive`
- Hover (macOS only): opacity 0.88; never change text color on hover
- Full width: `width: 100%` for stacked primary actions

**Labels:** verb or verb+noun ("Add", "Delete Account", "Continue").

---

## 5. Materials (frosted glass) — chrome only

Use for nav bars, tab bars, sidebars, toolbars, sheets, popovers. **Never** on content.

```css
background: var(--material-chrome);   /* rgba(246,246,246,0.8) light / rgba(30,30,32,0.78) dark */
backdrop-filter: saturate(180%) blur(20px);   /* --material-blur */
```

Other fills: ultra-thin rgba(255,255,255,0.44) · thin 0.6 · regular rgba(248,248,248,0.78) · thick rgba(245,245,245,0.9) (dark equivalents in tokens). Hairline under chrome: `--chrome-border` rgba(0,0,0,0.18) light / rgba(255,255,255,0.12) dark.

---

## 6. Elevation (shadows)

| Level | Value (light) | Use |
|---|---|---|
| `--shadow-1` | 0 0.5px 1px rgba(0,0,0,0.04) | Resting card (near-invisible) |
| `--shadow-2` | 0 1px 4px rgba(0,0,0,0.05) | Raised card |
| `--shadow-3` | 0 3px 10px rgba(0,0,0,0.08) | Popovers, menus |
| `--shadow-4` | 0 6px 20px rgba(0,0,0,0.12) | Sheets, alerts, modals |

Dark mode: same geometry, opacity 0.4–0.6. Shadows are always neutral, never colored. Grouped-list cards get **no** shadow (the gray page bg provides separation).

Focus ring: `0 0 0 4px color-mix(in srgb, var(--color-accent) 35%, transparent)` (`--focus-ring`).

---

## 7. Motion

- Easing: `cubic-bezier(0.32, 0.72, 0, 1)` (`--ease-standard`); ease-out `cubic-bezier(0.16, 1, 0.3, 1)`
- Durations: fast 150ms (press feedback) · base 250ms (screen transitions) · slow 400ms (modal presentation)
- Switches spring on toggle; segmented-control thumb slides. No infinite loops. No color-only animations under 100ms.

---

## 8. Components (key specs)

**List rows (grouped/inset):** container bg `--surface-row`, radius 8px, row height ≥ 44px, 12px horizontal padding, title Body 15/400 `--text-primary`, value/subline `--text-secondary`, chevron `--gray-3` at 14–16px. Press: row bg → `--fill-quaternary`. Section header: 12px ALL-CAPS `--text-secondary` with `--tracking-wide`; footer: Footnote 12px `--text-secondary`, sentence case.

**Icon tiles (in rows):** 29×29px, radius 7px, bg = a `--sys-*` color, glyph white at ~60% of tile.

**Switch:** pill radius; on = `--color-accent` (green `--sys-green` for system-style), off = `--fill-primary`; white knob with `--shadow-2`.

**Nav bar:** translucent (`--material-chrome` + blur), hairline bottom border `--chrome-border`; inline title Headline 15/600 centered; back label = accent.

**Text field (rounded):** bg `--fill-tertiary`, radius 6–10px, height 34–36px, placeholder `--text-placeholder`, no border; focus shows `--focus-ring` only when keyboard-driven.

**Badges:** Caption 1 (11px/600), pill radius, bg `--sys-red` (count) or accent, white text.

**Icons:** Lucide (lucide.dev), 2px stroke, rounded caps — SF Symbols substitute for the web layer. Size via font-size on the element; default UI icon 16–20px, color `--text-secondary` unless active (accent).

---

## 9. Voice & copy rules

- Second person ("your messages"), present tense, active voice.
- Nav titles: one noun. Row titles: 1–3-word noun phrase. Footers: one sentence explaining the effect.
- Alerts: title = action noun + "?", body = consequence, buttons = Confirm/Cancel.
- Destructive actions say "Delete" / "Sign Out", never "Remove".
- No filler words ("just", "simply", "please"). No emoji in system UI.

---

## 10. Hard rules (do / don't)

- DO style exclusively with these tokens; never invent new hex values, radii, or font sizes.
- DO keep tap targets ≥ 38px and list rows ≥ 44px.
- DO flip themes only by toggling `data-theme="dark"` — all semantic tokens adapt.
- DON'T apply blur/vibrancy to content areas — chrome only.
- DON'T use colored shadows, borders on press, or text-color changes on hover.
- DON'T use more than one accent color per screen; tint everything interactive with `--color-accent`.
