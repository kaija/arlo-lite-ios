# UI/UX Design Decisions: Arlo Lite

Design-only decisions gathered via user interview, combined with the interactive prototype implementation details from `mockup/`. Scope: visual language and interaction design. Technical architecture lives in [design.md](design.md).

---

## App Positioning

- Primary user: self (power user / developer) testing LLM APIs daily; secondary audience is other power users/developers if shared.
- No onboarding flow — assume users already understand LLM concepts (API keys, context windows, reasoning effort).
- Functionality/provider abstraction is handled separately (see design.md); this document governs UI only.

---

## Visual Tone

- **Base aesthetic**: Minimal, cool-toned (Linear/Raycast-like) — generous whitespace, single accent color, no decorative ornamentation, quality comes from precise spacing/typography, not decoration.
- **Color scheme**: Monochrome, single hue, with lightness/saturation modulated by context usage (not a rainbow of accent colors). See Context Usage Indicator below for the one deliberate exception (warning colors).
- **Accent color**: Indigo `#5856D6` (`--sys-indigo` in the design system). Used as `--acc` throughout the prototype. All interactive elements, links, and highlights derive from this single hue.
- **Light/dark mode**: Follows system setting; light mode is the primary design reference (design first for light, verify dark reads correctly, not the other way around).
- **Anti-monotony strategy**: Variation comes from **motion and transitions**, not from color variety or illustration. Static states stay minimal; movement is where personality lives. The one deliberate "surprise" moment is the session-switcher transition (see below) — everywhere else stays quiet and gets out of the way.

---

## Design System Reference

The prototype is built on a comprehensive Apple Design System located at `mockup/_ds/apple-design-system-*/`. Native implementation should mirror these tokens using SwiftUI equivalents.

### Color Tokens
- **12 system colors**: red, orange, yellow, green, mint, teal, cyan, blue, indigo, purple, pink, brown
- **Semantic aliases**: `--color-accent`, `--color-destructive`, `--color-success`, `--color-warning`, `--color-info`
- **Label opacities**: primary (1.0), secondary (0.6), tertiary (0.3), quaternary (0.18)
- **Surface layers**: primary (white/black), secondary (`#F2F2F7`/`#1C1C1E`), tertiary (white/`#2C2C2E`)
- **Fills**: translucent gray layers for control backings (`--fill-primary` through `--fill-quaternary`)
- **Dark mode**: via `[data-theme="dark"]` — all tokens flip automatically. Map to SwiftUI's `@Environment(\.colorScheme)`.

### Typography
- **Font**: SF Pro (system font on iOS — use `.system()` in SwiftUI)
- **Scale**: Large Title (34px/700) → Caption 2 (11px) matching iOS Dynamic Type
- **Tracking**: Large Title / Title 1 use tight tracking (−0.4px) for compressed display feel
- **Monospace**: `ui-monospace, Menlo` → use `.monospaced()` in SwiftUI

### Spacing
- **Grid**: 4pt base. `--space-1` (4px) through `--space-10` (48px)
- **Screen inset**: 16px (`--inset-screen`) for iOS
- **Hit target**: 44px minimum (`--hit-target`)
- **Row padding**: 12px (`--inset-row`)

### Corner Radii
- **Grouped list containers**: 26px (as in prototype `IOSList`) — note: prototype uses larger radius than standard iOS (12px). Native implementation should use the iOS 26 Liquid Glass radius.
- **Icon tiles**: 7px, 29×29px
- **Capsule/pill buttons**: 999px (`--radius-pill`)
- **Cards/popovers**: 12px (`--radius-lg`)
- **Modals**: 20px (`--radius-2xl`)

### Materials (Vibrancy)
- Frosted glass for **chrome only**: nav bars, tab bars, sidebars, toolbars, sheets, popovers
- Recipe: `backdrop-filter: saturate(180%) blur(20px)` + translucent fill
- **Never** apply blur to content areas — degrades legibility
- Prototype's `IOSGlassPill` component demonstrates the liquid glass effect: blur(12px) + saturate(180%) + inner shine + subtle border

### Shadows
- 4 levels: resting (`--shadow-1`), raised (`--shadow-2`), popover (`--shadow-3`), modal (`--shadow-4`)
- Dark mode: heavier opacity (0.4–0.6)
- Warm-neutral only, never colored

### Animation
- Standard spring: `cubic-bezier(0.32, 0.72, 0, 1)` → use `.spring(response: 0.35, dampingFraction: 0.75)` in SwiftUI
- Duration scale: fast 150ms, base 250ms, slow 400ms
- Press states: scale to 0.97 + opacity 0.82

---

## Layout & Navigation

- **Message list**: No chat bubbles. Full-width flowing text, differentiated by sender via avatar/label only (like ChatGPT/Claude web). Optimizes for reading long markdown/code responses.
- **Session switching**: Left-edge swipe reveals a side panel of conversation history (not a tab bar, not a dropdown). The reveal transition should NOT be a plain slide-over — design a page-turn-like or otherwise delightful/surprising transition animation. This is the one spot in the app allowed to be visually expressive.
- **New/empty conversation**: Pure whitespace, input field auto-focused. No suggested prompts, no illustration, no recent-chat shortcuts.

### Prototype Implementation Details
The prototype (`Arlo Lite.dc.html`) implements the layout as:
- Root container: full device height, relative positioning, overflow hidden
- **Sidebar layer** (z-index: 1): absolute positioned, transform/opacity animated for reveal
- **Chat layer** (z-index: 2): absolute positioned with perspective (1400px), uses `transform-origin`, `border-radius`, and `box-shadow` transitions for the page-turn effect
- **Messages area**: absolute positioned, scrollable, padding 112px top (for nav) and 178px bottom (for input area)

---

## Status Icons (Context Usage, Thinking Effort, etc.)

- Status metadata is shown via a **small ring/gauge icon next to the message input field** — not a full-width top status bar, not per-message icon rows, not hidden behind a long-press.
- Custom single-line icon set (not stock SF Symbols) for these indicators, to keep a consistent, recognizable visual language across all status glyphs.

### Context Usage Ring

- Single-hue ring whose fill level and shade deepen as usage increases.
- Warning thresholds: **50% → shifts to orange**, **75% → shifts to red**.
- A haptic tap fires at each color-change threshold crossing. No modal, no blocking interruption — purely ambient.

### Thinking Effort Indicator

- Not a passive readout — it is an **interactive control**. Tapping/cycling it directly changes the reasoning effort level (low/med/high, matching `ThinkingLevel` in design.md) sent with the next request. Setting and display are the same element; no separate settings screen needed for this.
- Prototype shows this as a glyph that cycles through states on tap.

---

## Error Handling

- API errors (rate limit, timeout, disconnect) render **inline in the message stream**, in the position where the assistant's reply would have appeared — short error text plus a retry button. No blocking modal, no toast banner; the reading flow is never interrupted by a popup.
- Prototype demonstrates: one-line error message, expandable to full error detail, with a retry action.

---

## LLM / Model Settings UI

### Model Switcher

- A lightweight text chip above the message input (e.g. "Claude Opus 4.8"). Tapping it pops up a list to pick a different model/provider — no navigation away from the chat screen.
- Prototype: positioned in the nav/header area of the chat layer.

### Advanced Parameters (temperature, max tokens, system prompt)

- **Not surfaced in the chat screen at all.** These are configured exclusively in the standalone Settings destination. Chat UI stays clean; power users go to Settings when they want to tune these.

### Per-Message Token/Cost Display

- Shown as faint text to the right of the assistant's reply avatar (not hidden behind a tap, not a top-level running total only).
- **While streaming**: shows live tokens/s.
- **After completion**: switches to token count in/out (e.g. "1.2k in / 340 out") and cost (e.g. "$0.02").

### Settings Screen — Provider/Model Management

- Visual style: **card-based grouping**, one card per provider (not a plain grouped list, not a terminal/config-file style).
- Tapping a provider card **pushes to a detail screen** (standard iOS navigation push, not inline accordion expansion) listing its models and the API key field.
- **API key field**: masked by default, showing only the last few characters (e.g. `••••sk-xxxx`) with a reveal (eye) button — not fully hidden behind a generic "configured" badge.
- Reference: the design system provides `ListGroup` and `ListRow` components for settings-style grouped lists with icon tiles, values, and accessories.

### System Prompt Management

- Own independent list in Settings (sibling to provider cards), with add/edit/set-default actions — not surfaced or switchable from the chat screen.

### Settings First-Run (No Providers Configured)

- Minimal empty state: faint one-line hint (e.g. "No providers configured") + an add button. No illustration, no wizard/guided flow — consistent with the no-onboarding stance for power users.

### Model Picker Metadata

- Each model name shows a faint subline with just the context window size (e.g. "200K"). Pricing is intentionally omitted here to keep the popup list scannable — full pricing lives in the provider detail screen.

---

## Message Interactions

- **Action entry point**: Persistent small icon row below each assistant reply (copy, regenerate, edit, delete) — not a long-press context menu, not swipe gestures. Consistent with the bubble-less, flat text-stream layout; nothing needs to be "revealed."
- **Code blocks**: Fixed dark background regardless of app-wide light/dark mode, with syntax highlighting colors drawn from the same single accent hue family (not an unrelated multi-color theme like One Dark). Reads as a deliberate, consistent "code panel," not a jarring insert.
  - Prototype uses CSS custom properties for code colors derived from the accent: `--code-kw` (keywords), `--code-str` (strings), `--code-ty` (types) — all computed via `color-mix(in oklab, var(--acc), white)` at varying percentages.
- **Streaming indicator**: No separate spinner/typing-dots — just the blinking text caret at the end of the growing text (`@keyframes arlo-blink`). Additionally, a small pulse/waveform animation plays at the status-icon area near the input field while generating (`@keyframes arlo-eq` with scaleY oscillation), giving the "thinking" state a bit of life without adding visual noise to the message itself.
- **Thinking state**: While the model reasons, a blinking "thinking" label appears (`@keyframes arlo-thinkblink`). User can expand to read thinking content. Messages appear with a fade-up animation (`@keyframes arlo-fadeup` — translateY(10px) + scale(0.98) → none).

---

## Input Area

- **Send button**: Single circular button that swaps icon/state in place — arrow (ready to send) ⇄ stop-square (generating) — same position and shape throughout, only the glyph changes.
- **Attachments**: Fixed paperclip icon on the left side of the input field; tapping opens a photo/file picker. Always visible, not gated behind a long-press.
- **Multiline growth**: Textarea grows line-by-line with a spring animation up to a cap (~5-6 lines), then switches to internal scrolling rather than growing further.
- **Keyboard**: Prototype references the iOS 26 liquid glass keyboard style (`IOSKeyboard` component) — native implementation uses the system keyboard naturally.

---

## Conversation List (Sidebar)

- **Item density**: Title only, no message preview text or per-item timestamp — but items are grouped under time-section headers (e.g. "Today" / "Yesterday" / "This Week"), similar to ChatGPT's sidebar grouping.
- **Rename/delete gestures**: Swipe-left reveals a delete action; long-press brings up a rename option. Two distinct standard iOS gestures for two distinct actions.
- **New chat button**: Circular button with compose/edit icon in the sidebar header, alongside the "Chats" title.
- **Visual treatment**: Each session row has:
  - Swipeable gesture with translateX for delete reveal (red background with trash icon)
  - Active session highlighted with bold weight and accent background tint
  - Subtle transition on row appearance/disappearance
- **Footer hint**: Small text at bottom — "Swipe left to delete · hold to rename"

---

## Global Items

- **App icon**: Single-color abstract mark/geometric shape echoing the app's accent hue — no gradient, consistent with the overall monochrome-minimal identity.
- **Budget/spend alerts**: Explicitly out of scope. Per-message and per-conversation cost display (already specified above) is sufficient; no global monthly total, no budget cap, no spend notifications.

---

## Prototype Animations Reference

The prototype defines these keyframe animations that should be replicated in SwiftUI:

| Animation | Purpose | Spec |
|-----------|---------|------|
| `arlo-blink` | Streaming text caret | opacity 1→0 at 52%→56% duty cycle |
| `arlo-eq` | Status area "generating" indicator | scaleY 0.3→1→0.3 (equalizer bars) |
| `arlo-ringpop` | Context ring threshold crossing | scale 1→1.3→1 (pairs with haptic) |
| `arlo-fadeup` | New message appearance | translateY(10px) + scale(0.98) → identity |
| `arlo-thinkblink` | Thinking state label | opacity 1→0.35 at 60%→75% |

### Sidebar Reveal Transition
The chat layer transforms with:
- `perspective: 1400px` on the parent
- `transform-origin` shifts for directional page-turn feel
- `border-radius` animates from 0 to rounded (creating a card-lift effect)
- `box-shadow` deepens during transition
- Coordinated with sidebar opacity + translateX

---

## Mockup File Map

For implementation reference, the prototype source files are:

| File | Role |
|------|------|
| `mockup/Arlo Lite.dc.html` | Primary interactive prototype (design-component HTML) |
| `mockup/arlo-standalone.dc.html` | Same prototype, standalone-bundled format |
| `mockup/Arlo Lite.html` | Pre-compiled distributable bundle |
| `mockup/ios-frame.jsx` | iOS 26 device frame components (IOSDevice, IOSStatusBar, IOSNavBar, IOSGlassPill, IOSList, IOSListRow, IOSKeyboard) |
| `mockup/support.js` | dc-runtime for rendering the prototype |
| `mockup/_ds/apple-design-system-*/` | Full design system (tokens, components, UI kits, font) |
| `mockup/_ds/*/_ds_manifest.json` | Component registry and token inventory |
| `mockup/_ds/*/readme.md` | Design system documentation (visual foundations, content fundamentals, guidelines) |
| `mockup/uploads/requirements.md` | Reference copy of project requirements |

---

## Status

Design decisions for this round are complete. No further open questions.
