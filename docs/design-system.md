# Arlo Design System — Design Tokens Reference

Native-OS (Apple HIG–style) design system for Arlo Lite. Follow this file exactly when generating UI. Light theme by default; dark theme via system appearance setting (React Native: `useColorScheme()`; web: `[data-theme="dark"]`). All values are also available as CSS custom properties for the web prototype layer (token names given per entry).

---

## 1. Typography

**Font families**
- UI text & display: System font (SF Pro on iOS; use default system font in React Native). Web fallback: `-apple-system, BlinkMacSystemFont, system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif` → `--font-text` / `--font-display`
- Rounded (optional numerals/badges): `ui-rounded, "Hiragino Maru Gothic ProN", "SF Pro", …` → `--font-rounded`
- Mono (code, keys, token counts): `Menlo` on iOS (React Native: `Platform.select({ ios: 'Menlo', default: 'monospace' })`). Web fallback: `ui-monospace, Menlo, Monaco, "Courier New", monospace` → `--font-mono`

**Weights:** regular 400 · medium 500 · semibold 600 · bold 700 (`--weight-*`)

**Type scale (size / line-height, pt)**

Values below are iOS Dynamic Type base sizes (in points). These match Apple HIG and the native implementation. The web prototype uses smaller pixel values scaled for screen density — do not copy prototype px values directly into native code.

| Style | Size | Line | Weight | Use |
|---|---|---|---|---|
| Large Title | 34 | 41 | 700 | Screen titles (large nav state) |
| Title 1 | 28 | 34 | 700 | Page headers |
| Title 2 | 22 | 28 | 700 | Section titles |
| Title 3 | 20 | 25 | 600 | Card titles |
| Headline | 17 | 22 | 600 | Row titles (emphasized), sender names |
| Body | 17 | 22 | 400 | Default text, messages, list rows |
| Callout | 16 | 21 | 400 | Secondary body, button labels (md) |
| Subheadline | 15 | 20 | 400 | Sublines under row titles |
| Footnote | 13 | 18 | 400 | List footers, timestamps, metadata |
| Caption 1 | 12 | 16 | 400 | Badges, fine print |
| Caption 2 | 11 | 13 | 400 | Smallest labels (tab bar) |

Tokens: `--type-{large-title|title1|title2|title3|headline|body|callout|subhead|footnote|caption1|caption2}-size/-line`.

**Tracking (letter-spacing)**

iOS system font applies tracking automatically per size. In native code, use the system-provided values (exposed via `UIFontDescriptor` or React Native's default behavior). Do **not** manually override letter-spacing unless using a custom font.

For reference, system-approximate values:
- Large Title / Title 1: +0.36 to +0.37pt (system default — slightly positive, not negative)
- Headline / Body: −0.41pt
- Callout: −0.32pt
- Subheadline: −0.24pt
- Footnote: −0.08pt
- ALL-CAPS section headers: +0.35pt wide tracking

> **Note:** The web prototype uses tight negative tracking (−0.4px) on large titles for a compressed display feel. Native iOS does the opposite — trust system defaults.

**Casing:** Title Case for nav titles/section headers; Sentence case for body/footers; ALL-CAPS only for grouped-list section headers (footnote size, wide tracking, `--text-secondary`).

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
- **Accent** `--color-accent`: Indigo — #5856D6 light / #7B79E8 dark. This is Arlo Lite's brand accent (not system blue).
- Pressed accent `--color-accent-pressed`: #4240B0 light / #9896E6 dark
- On-accent text `--color-on-accent`: #FFFFFF (light) / #1C1C1E (dark)
- Destructive: `--sys-red` · Success: `--sys-green` · Warning: `--sys-orange` · Info: `--sys-blue`
- Links `--text-link`: accent color; no underline at rest

#### Accent states

| State | Light | Dark | Use |
|---|---|---|---|
| Default | #5856D6 | #7B79E8 | Interactive elements, links, active indicators |
| Pressed | #4240B0 | #9896E6 | Tap-down state (+ scale 0.97 + opacity 0.82) |
| Tinted fill (15%) | rgba(88,86,214, 0.15) | rgba(123,121,232, 0.15) | Tinted button bg, selected sidebar row, active list row highlight |
| Disabled | rgba(88,86,214, 0.35) | rgba(123,121,232, 0.35) | Disabled interactive elements (ensure ≥ 3:1 against surface for non-text indicators) |

> **Why #7B79E8 in dark mode?** The system indigo dark value (#5E5CE6) works but has borderline contrast on pure black backgrounds. #7B79E8 provides 6.2:1 contrast on #000000, comfortably exceeding WCAG AA.

### Text (label) colors

| Token | Light | Dark | Contrast (on bg) | Use |
|---|---|---|---|---|
| `--text-primary` | rgba(0,0,0,1) | rgba(255,255,255,1) | 21:1 / 21:1 | Titles, body |
| `--text-secondary` | rgba(60,60,67,0.6) | rgba(235,235,245,0.6) | 5.9:1 / 9.3:1 | Sublines, metadata, timestamps |
| `--text-tertiary` | rgba(60,60,67,0.3) | rgba(235,235,245,0.3) | 3.9:1 / 5.2:1 | See restrictions below |
| `--label-quaternary` | rgba(60,60,67,0.18) | rgba(235,235,245,0.16) | — | Faintest hints (decorative only) |

#### textTertiary usage restrictions

`--text-tertiary` does **not** meet WCAG AA 4.5:1 in light mode (3.9:1). Restrict its use to:
- Disabled control labels (not standalone — always paired with a visible disabled state)
- Decorative/supplementary text that duplicates information available elsewhere
- Placeholder text in input fields (standard iOS behavior; assistive tech reads the label, not the placeholder)

**Do NOT use textTertiary for:** timestamps, metadata, or any text that conveys unique information the user needs to read. Use `--text-secondary` instead for those cases.

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

**Minimum hit target:** 44pt (`--hit-target`) — nothing tappable smaller. This follows Apple HIG's recommendation for touch targets on iOS. Visible elements may be smaller (e.g., a 28pt icon) as long as the tappable area extends to at least 44×44pt.

**Corner radii:**

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 4pt | Subtle rounding (small badges) |
| `--radius-sm` | 5pt | Small buttons |
| `--radius-md` | 6pt | Default buttons, text fields |
| `--radius-lg` | 8pt | Large buttons, standard cards |
| `--radius-xl` | 12pt | Large cards, sheets, settings cards |
| `--radius-2xl` | 16pt | Modals, bottom sheets |
| `--radius-grouped` | 26pt | Grouped list containers (iOS 26 Liquid Glass style) |
| `--radius-pill` | 9999pt | Capsules, switches, send button |
| `--radius-icon-tile` | 7pt | Icon tiles in list rows (29×29pt) |

> **Liquid Glass note:** iOS 26 grouped list containers use a much larger radius (26pt) than previous iOS versions (10–12pt). This creates the distinctive "card floating on glass" aesthetic. Use `--radius-grouped` exclusively for these containers; do not apply it to buttons or inline elements.

**Control heights:** iOS large 44pt · iOS small 28pt · mac push button 24pt.

---

## 4. Buttons

Five variants; all use system font, `line-height: 1`, no border, nowrap.

**Sizes**

| Size | Height | Padding-x | Font | Weight | Radius | Gap (icon) |
|---|---|---|---|---|---|---|
| sm | 28pt | 12pt | 13pt | 500 | 5pt (`--radius-sm`) | 5pt |
| md (default) | 34pt | 14pt | 14pt | 600 | 6pt (`--radius-md`) | 6pt |
| lg | 44pt | 18pt | 15pt | 600 | 8pt (`--radius-lg`) | 7pt |

> **Note:** lg buttons are 44pt to meet the minimum hit target. The sm (28pt) and md (34pt) buttons must have their tappable area extended to 44pt via `hitSlop` or padding in React Native.

**Variants**
- **Filled** (primary): bg `--color-accent`, text `--color-on-accent`
- **Tinted** (secondary): bg = accent at 15% opacity, text = accent
- **Gray**: bg `--fill-tertiary`, text `--text-primary`
- **Bordered** (mac push): bg `--surface-card`, text `--text-primary`, hairline border `--separator-opaque` + `--shadow-1`
- **Plain** (text button): transparent bg, text = accent, minimal padding

**States**
- Pressed: scale to 0.97 + opacity 0.82, duration 150ms with `--ease-standard`
- Disabled: opacity 0.4, no press response, no pointer events
- Destructive: same variants with accent → `--color-destructive` (`--sys-red`)
- Full width: stretches to fill container for stacked primary actions

**React Native press implementation:**
```tsx
// Use Animated.Value or Reanimated shared value
// onPressIn: scale → 0.97, opacity → 0.82 (150ms, ease-standard)
// onPressOut: scale → 1.0, opacity → 1.0 (150ms, ease-standard)
// Wrap with Pressable; use hitSlop={{ top: 8, bottom: 8 }} for sm/md sizes
```

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

| Level | CSS Value (web) | Use |
|---|---|---|
| `--shadow-1` | 0 0.5px 1px rgba(0,0,0,0.04) | Resting card (near-invisible) |
| `--shadow-2` | 0 1px 4px rgba(0,0,0,0.05) | Raised card |
| `--shadow-3` | 0 3px 10px rgba(0,0,0,0.08) | Popovers, menus |
| `--shadow-4` | 0 6px 20px rgba(0,0,0,0.12) | Sheets, alerts, modals |

Dark mode: same geometry, opacity 0.4–0.6. Shadows are always neutral, never colored. Grouped-list cards get **no** shadow (the gray page bg provides separation).

### React Native shadow mapping (iOS)

| Level | shadowOffset | shadowRadius | shadowOpacity | shadowColor |
|---|---|---|---|---|
| 1 | `{width: 0, height: 0.5}` | 1 | 0.04 | `#000` |
| 2 | `{width: 0, height: 1}` | 4 | 0.05 | `#000` |
| 3 | `{width: 0, height: 3}` | 10 | 0.08 | `#000` |
| 4 | `{width: 0, height: 6}` | 20 | 0.12 | `#000` |

Dark mode: multiply `shadowOpacity` by 4–5× (e.g., level 2 → 0.20–0.25). Always use `#000` for `shadowColor` — colored shadows are forbidden.

Focus ring: On web, `0 0 0 4px color-mix(in srgb, var(--color-accent) 35%, transparent)`. On iOS native, rely on the system focus indicator for VoiceOver; for iPad keyboard navigation, add a 4pt accent-tinted border via `accessibilityFocused` state.

---

## 7. Motion

**Easing curves:**
- Standard: `cubic-bezier(0.32, 0.72, 0, 1)` (`--ease-standard`). React Native: use `Easing.bezier(0.32, 0.72, 0, 1)` or spring with `response: 0.35, dampingFraction: 0.75`.
- Ease-out: `cubic-bezier(0.16, 1, 0.3, 1)`. For fade/slide transitions.

**Durations:** fast 150ms (press feedback) · base 250ms (screen transitions) · slow 400ms (modal presentation)

**Rules:** Switches spring on toggle; segmented-control thumb slides. No infinite loops. No color-only animations under 100ms.

### Reduce Motion

When `UIAccessibility.isReduceMotionEnabled` is true (check via React Native's `AccessibilityInfo.isReduceMotionEnabled()` or the `useReducedMotion` hook from `react-native-reanimated`):

| Normal behavior | Reduce Motion behavior |
|---|---|
| Scale + translate transitions (sidebar page-turn, message fade-up) | Crossfade only (opacity 0→1, ≤150ms) |
| Spring animations on controls | Instant state change (duration: 0) |
| Streaming caret blink | Static caret (no blink) |
| Equalizer pulse animation | Static icon |
| Context ring pop (scale 1→1.3→1) | No scale — haptic only |

All `Animated.timing` and `Animated.spring` calls should respect this flag. Wrap animation configs in a helper that returns `duration: 0` when reduced motion is active.

---

## 8. Components (key specs)

**List rows (grouped/inset):** container bg `--surface-row`, radius 8px, row height ≥ 44px, 12px horizontal padding, title Body 15/400 `--text-primary`, value/subline `--text-secondary`, chevron `--gray-3` at 14–16px. Press: row bg → `--fill-quaternary`. Section header: 12px ALL-CAPS `--text-secondary` with `--tracking-wide`; footer: Footnote 12px `--text-secondary`, sentence case.

**Icon tiles (in rows):** 29×29px, radius 7px, bg = a `--sys-*` color, glyph white at ~60% of tile.

**Switch:** pill radius; on = `--color-accent` (green `--sys-green` for system-style), off = `--fill-primary`; white knob with `--shadow-2`.

**Nav bar:** translucent (`--material-chrome` + blur), hairline bottom border `--chrome-border`; inline title Headline 15/600 centered; back label = accent.

**Text field (rounded):** bg `--fill-tertiary`, radius 6–10pt, height 34–36pt, placeholder `--text-tertiary` (acceptable per usage restrictions — assistive tech reads the label), no border. On iOS, focus is indicated by the keyboard appearing and the cursor blinking — do not draw a custom focus ring. On iPad with external keyboard, the system provides focus indicators automatically via `UIFocusSystem`.

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
- DO keep tap targets ≥ 44pt and list rows ≥ 44pt.
- DO support both light and dark themes — on iOS, react to `useColorScheme()` or `Appearance.getColorScheme()`; on web, toggle `data-theme="dark"` on the root element. All semantic tokens adapt automatically.
- DO respect Reduce Motion — check `AccessibilityInfo.isReduceMotionEnabled()` and skip scale/translate animations when enabled.
- DON'T apply blur/vibrancy to content areas — chrome only.
- DON'T use colored shadows, borders on press, or text-color changes on hover.
- DON'T use more than one accent color per screen; tint everything interactive with `--color-accent`.
- DON'T use `textTertiary` for information-carrying text — only for disabled/decorative elements (see §2 Text colors).
