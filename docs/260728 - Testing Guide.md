# Testing Guide — Comprehensive Revision Proposal

**Date:** 2026-07-28
**Status:** Proposal — pending review, intended to supersede `docs/Testing_Guide.md`
**Supersedes:** `docs/Testing_Guide.md`

---

## Why a new guide

The current `docs/Testing_Guide.md` was accurate for its time, but two things have made it stale enough to warrant a full rewrite instead of another patch:

1. **Tool keys/labels drifted.** Several tools were renamed from their original Portuguese identifiers to English (`titulo`→`title`, `paragrafo`→`paragraph`, `conteudovariavel`→`variablecontent`, `minicalendario`→`minicalendar`, `fatiador`→`imageslicer`, `carimbo`→`stamp`, `papeis`→`paper`, `textocurvo`→`curvedtext`, `icone`→`icon`, `imagem`→`image`, `gerador`→`generator`). The old guide still refers to some of these by their retired names, which makes it easy to test the wrong thing or file a bug against a component that no longer exists under that name.
2. **Large swaths of shipped functionality have zero coverage.** Since the last full pass, the app gained: the Table Tool (editable grid element with style templates, typography, merge/unmerge); a global Settings panel; a standardized solid-or-gradient color picker used everywhere; per-day-cell border/radius and section-gap controls for both calendar tools; a Font Awesome icon pack; SVG asset shape packs; content-alignment controls; resize-time snapping; image flip; text-transform; six new Variable Engine date formats (`SPECIAL_DATE`, `MOON_PHASE`, `SEASON`, `ZODIAC`, `WEEK_NUMBER`, `DAY_OF_YEAR`) plus a national/state/municipal holiday scope filter and an independent date-language selector; cross-element variable linking with live follower updates; and SVG export for agendas. None of this is in the old checklist.

This document is a **ground-up rewrite** covering the same scope (a complete manual test checklist for the CrafTools PWA) plus everything listed above. Run it top to bottom in a clean browser session (no `localStorage` data), then again after restoring a saved session. Every section maps to a real tool or subsystem in the codebase (`craftools/tools/`, `craftools/components/Editor.ts`, `craftools/utils/`).

Use the `Status` column as `[ ]` / `[✓]` / `[x]` / `[!]` (to do / pass / fail / note-worthy). All rows below start at `[ ]` — this is a fresh pass, not a carry-forward of the old guide's checkmarks, since the rename and the new-feature list above mean old results can no longer be trusted at face value.

---

## Table of Contents

1. [Initialization & PWA](#1-initialization--pwa)
2. [Session & Auto-save](#2-session--auto-save)
3. [Canvas, Navigation & Snapping](#3-canvas-navigation--snapping)
4. [History Management (Undo/Redo)](#4-history-management-undoredo)
5. [Page Management](#5-page-management)
6. [Settings Panel (Configurações)](#6-settings-panel-configurações)
7. [Element Selection & Common Panel Behavior](#7-element-selection--common-panel-behavior)
8. [Standardized Color/Gradient Picker](#8-standardized-colorgradient-picker)
9. [Text Tool (Title / Paragraph)](#9-text-tool-title--paragraph)
10. [Image Tool & Filters](#10-image-tool--filters)
11. [Shape Tool](#11-shape-tool)
12. [Icon Tool](#12-icon-tool)
13. [Emoji Tool](#13-emoji-tool)
14. [Emoji Kitchen Tool](#14-emoji-kitchen-tool)
15. [QR Code Tool](#15-qr-code-tool)
16. [Barcode Tool](#16-barcode-tool)
17. [Mini Calendar Tool (element)](#17-mini-calendar-tool-element)
18. [Curved Text Tool](#18-curved-text-tool)
19. [Stamp Tool](#19-stamp-tool)
20. [Paper / Background Tool](#20-paper--background-tool)
21. [Table Tool](#21-table-tool)
22. [Variable Content Tool & Variable Engine](#22-variable-content-tool--variable-engine)
23. [Album Wizard (Photo Album / Business Card)](#23-album-wizard-photo-album--business-card)
24. [Calendar Generator (full-page sheets)](#24-calendar-generator-full-page-sheets)
25. [Agenda Export Tool (PDF & SVG)](#25-agenda-export-tool-pdf--svg)
26. [Template Generator](#26-template-generator)
27. [Image Slicer](#27-image-slicer)
28. [Export (PDF / PNG / JPG / SVG)](#28-export-pdf--png--jpg--svg)
29. [Cross-Element Linking & Live Follower Updates](#29-cross-element-linking--live-follower-updates)
30. [Mobile-Specific Behavior](#30-mobile-specific-behavior)
31. [Admin Panel Smoke Checks (craftools_api)](#31-admin-panel-smoke-checks-craftools_api)
32. [Regression Checklist — Previously Fixed Bugs](#32-regression-checklist--previously-fixed-bugs)
33. [General Regression Notes](#33-general-regression-notes)
34. [Appendix: Renamed Tool Key Reference](#34-appendix-renamed-tool-key-reference)

---

## 1. Initialization & PWA

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 1.1 | Open the app cold (no prior session in `localStorage`) | Editor loads cleanly with one empty page. | [ ] |
| 1.2 | Install as a PWA (Chrome) | Install prompt appears; installed app opens as a standalone window. | [ ] |
| 1.3 | Offline load | With the service worker cached, disable the network and reload. App loads from cache, no browser error page. | [ ] |
| 1.4 | Mobile device (iOS Safari / Android Chrome) | Layout switches to the mobile view (shrunk header, hamburger menu). | [ ] |
| 1.5 | URL parameter `?mediaKey=album` | Activates Album mode immediately with the correct settings/page size. | [ ] |
| 1.6 | Language switcher (`#lang-select`) | Switching PT-BR / EN-US / ES-ES re-renders the whole shell in the new language and persists across the session. | [ ] |
| 1.7 | Theme toggle (`#theme-btn`) | Toggles `data-theme` light/dark; icon swaps `dark_mode`/`light_mode`. | [ ] |
| 1.8 | Setup wizard size picker | First-run Setup screen lists page-size presets (A4, A4 landscape, A6, A5, A3, social presets, freeform) grouped by category; picking one starts a new project at that size. | [ ] |

---

## 2. Session & Auto-save

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 2.1 | Auto-save interval | Add an element, wait ~30s; state silently saves to `localStorage`. | [ ] |
| 2.2 | Session restore | Add elements, close the tab, reopen. Session restores (dialog or automatic). | [ ] |
| 2.3 | Unsafe-close warning | Add an element and try closing before auto-save fires; browser shows the unsaved-changes warning. | [ ] |
| 2.4 | Fresh start after clearing data | Clear the session key in DevTools, refresh. Canvas loads empty, no recovery prompt. | [ ] |
| 2.5 | Simultaneous tabs | Two tabs open at once keep independent state without immediate cross-contamination. | [ ] |

---

## 3. Canvas, Navigation & Snapping

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 3.1 | Zoom in/out (`#zoom-in-btn`/`#zoom-out-btn`) | 0.1 steps, capped 0.2×–3.0×; % label updates. | [ ] |
| 3.2 | Pinch gesture (mobile/trackpad) | Two-finger pinch scales smoothly within the same bounds, anchored to the starting distance. | [ ] |
| 3.3 | Pan (drag empty background) | Dragging empty canvas moves the view; elements keep relative positions. | [ ] |
| 3.4 | Drag-time snapping | Enable snap in Settings (see §6) and drag an element near a page edge/center/another element's edge. Element snaps to the guide line; a visual snap indicator shows. | [ ] |
| 3.5 | Resize-time snapping | Resize an element near another element's edge or the page bounds. The resize handle also snaps (not just drag), per `SnapEngine`'s resize-time support. | [ ] |
| 3.6 | Snap alignment setting | In Settings, change the default snap-align mode; new elements/interactions respect the configured default. | [ ] |
| 3.7 | Auto-center on select | With "Auto-center on select" enabled in Settings, selecting an element off-screen scrolls/zooms it into view. | [ ] |
| 3.8 | Desktop click-to-create | Click (not drag) a draggable tool button on desktop for each of: Text, Image, Album, QR Code, Barcode, Mini Calendar, Emoji Kitchen, Emoji, Shape, Icon, Variable Content, Curved Text, Stamp, Table, Generator, Agenda, Image Slicer. Element/panel appears centered on the active page instead of requiring a drag. | [ ] |

---

## 4. History Management (Undo/Redo)

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 4.1 | Simple undo | Add an element, click Undo; element disappears, counter steps back. | [ ] |
| 4.2 | History stack saturation | 15+ edits; stack keeps only the last N (default 10), oldest silently dropped. | [ ] |
| 4.3 | History branching | Undo twice, then make a new edit; the discarded "future" is replaced by the new branch. | [ ] |
| 4.4 | Redo | Redo restores the previously-undone action. | [ ] |
| 4.5 | Keyboard shortcuts | Ctrl+Z / Ctrl+Y (Cmd on Mac; Ctrl+Shift+Z also redoes) work; ignored while focus is in an input/textarea/contenteditable. | [ ] |
| 4.6 | Copy/paste/delete/arrow shortcuts | Ctrl+C / Ctrl+V duplicate the selected element with an offset; Del deletes it; arrow keys nudge position (larger step with Shift). | [ ] |
| 4.7 | Undo/redo re-attaches page events | After an undo/redo restoring a page's full `innerHTML`, elements on that page are still clickable/selectable. | [ ] |

---

## 5. Page Management

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 5.1 | Add new page | Appends a page, scrolls to it. | [ ] |
| 5.2 | Reorder pages | Drag-reorder physically moves the page. | [ ] |
| 5.3 | Clone page | Duplicate reproduces the page's full content/properties. | [ ] |
| 5.4 | Delete page | Page removed; last remaining page can't be deleted (or is replaced by a blank one). | [ ] |
| 5.5 | Click a page generated by Calendar Generator | Reopens the Calendar Generator panel (`dataset.gridSource === 'calendar'`), not Album. | [ ] |
| 5.6 | Click a page generated by Album/Generator (no `gridSource`) | Opens the Album wizard on that page. | [ ] |

---

## 6. Settings Panel (Configurações)

New global-defaults panel (`SettingsTool.ts`, `AppSettings.ts`) — verify every default actually seeds newly-created elements/tools, not just that the panel itself saves.

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 6.1 | Open Settings from the sidebar | Panel opens showing default-font, snapping, and week-start sections. | [ ] |
| 6.2 | Default font family / size / alignment | Change each; create a fresh Text element afterward — it picks up the new defaults. | [ ] |
| 6.3 | Default week start (Sun/Mon) | Toggle; create a fresh Mini Calendar element or open Calendar Generator — the new element/panel defaults to the configured start day. | [ ] |
| 6.4 | Default snap enabled / snap align | Toggle; drag an element on the canvas — snapping behavior matches the new default without needing to touch per-element settings. | [ ] |
| 6.5 | Default auto-center-on-select | Toggle; select an off-screen element — canvas centering follows the new default (see 3.7). | [ ] |
| 6.6 | Default icon pack | Change it; open the Icon Tool picker — the configured pack's tab is active/first by default. | [ ] |
| 6.7 | Settings persist across reload | Change several settings, reload the app. Values are still applied (backed by `localStorage`, independent of the project session). | [ ] |

---

## 7. Element Selection & Common Panel Behavior

Applies to every canvas-element tool (Text, Image, Shape, Icon, Emoji, Emoji Kitchen, QR Code, Barcode, Mini Calendar, Curved Text, Stamp, Paper, Variable Content, Table).

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 7.1 | Select an element | Right panel opens with the tool's schema-driven sections; ctx-bar shows its context actions. | [ ] |
| 7.2 | Deselect | Clicking empty canvas or another tool closes the panel/ctx-bar; a deselected Paper element resets z-index to `1`. | [ ] |
| 7.3 | Copy / Paste / Lock | Shared `BaseTool` actions on every element; locking blocks drag/resize but keeps it selectable for panel edits. | [ ] |
| 7.4 | z-index section | Every schema-driven tool has the shared front/back layering control. | [ ] |
| 7.5 | Border/radius sections | Shared `borderSection()`/`radiusSection()` controls apply consistently and render immediately, including gradient borders (see §8). | [ ] |
| 7.6 | Background fill section | Standalone "Background" accordion (Text, QR, Variable Content, Table) or merged into Image's own Background section: solid-or-gradient "Fill" + independent Opacity slider, painting behind the element's real content. | [ ] |
| 7.7 | Content-align control | Text (title/paragraph) and Variable Content expose the stateful H+V alignment grid (`content-align` field); Image exposes the equivalent via native `object-position`. Changing it repositions content within the box without moving the box itself. Default is centered. | [ ] |
| 7.8 | Session restore lazily loads tool modules | Restore a session containing an element whose tool module wasn't loaded yet this session. Element is still selectable/editable — `Editor.ts` lazily imports via `LAZY_TOOL_LOADERS` before dispatching select. | [ ] |
| 7.9 | Panel closes on delete | Select an element, delete it (Del key or ctx-bar/handle). Right panel closes immediately. | [ ] |
| 7.10 | Panel closes on click-outside deselect | Select, then click empty canvas. Panel closes the same way as 7.9; selecting a *different* element directly shows no flicker. | [ ] |
| 7.11 | Only first accordion section open by default | Select an element with 2+ sections marked `defaultOpen: true`. Only the first is actually expanded; others can still be expanded manually. | [ ] |
| 7.12 | Rotate/delete handle centering | Circular rotate handle and red delete (×) handle both show their glyph visually centered. | [ ] |
| 7.13 | Ctx-bar position | Appears below the element's bounding box (Canva-style), centered; falls back above when there's no room below; tracks the element while scrolling `#canvas-area`. | [ ] |
| 7.14 | Auto-fit quick-toggle (Text/Variable Content) | Ctx-bar `arrow_range` button toggles auto-fit the same as the panel's own toggle; icon tints accent color while active. | [ ] |
| 7.15 | Fit-mode quick-cycle (Image) | Ctx-bar `arrow_range` button cycles Cover → Contain → Fill → Cover; icon tints while non-default; panel select (if open) stays in sync. | [ ] |
| 7.16 | Flip horizontal/vertical (Image) | Transform tab's flip toggles mirror the image on its respective axis without affecting the box's position/size. | [ ] |
| 7.17 | Text-transform control (Text, Variable Content) | Uppercase/lowercase/capitalize/none options visibly transform the rendered text without altering the underlying stored value. | [ ] |
| 7.18 | Editor-only linked-element indicator | Select an element that's the target of another element's `linkedTo` binding. A visual indicator (editor-only, not exported) marks it as linked. | [ ] |
| 7.19 | Alternate-flip toggle (duplicate-page/agenda-alternate) | On a tool exposing it, enabling alternate-flip mirrors the element's position/orientation on alternated/mirrored duplicate pages (e.g. spread layouts). | [ ] |

---

## 8. Standardized Color/Gradient Picker

Shared component (`utils/ColorPickerUI.ts`, `fields/color.field.ts` solid-only / `fields/color-picker.field.ts` gradient-capable) used by every tool's color fields, `PageTool.ts`'s page background, and now the Calendar/Mini Calendar Theme sections.

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 8.1 | Solid mode | Preset swatch palette + a custom `<input type="color">` swatch; picking either applies immediately. | [ ] |
| 8.2 | Gradient mode (where offered) | Cor/Gradiente pills switch modes instantly (no reselect needed); gradient preset palette + live editor (linear/radial, angle, 2+ stops with add/remove). | [ ] |
| 8.3 | Mode-switch reset | Switching Cor→Gradiente or back always resets to that group's first preset and fires the change immediately. | [ ] |
| 8.4 | Solid-only fields (text/border colors) | Fields that shouldn't support gradients (most text colors, most border colors) render the palette only, no mode pills. | [ ] |
| 8.5 | Gradient border rendering | A gradient Border color renders via `border-image` (requires width > 0, style ≠ None); switching back to solid restores a normal `border-color`. | [ ] |
| 8.6 | Default color is near-black, not white | A fresh text/fill color field defaults to `#18181b` (or the field's own override), not white-on-white. | [ ] |
| 8.7 | Page background gradient | `PageTool.ts`'s "Fundo" accordion offers the same solid-or-gradient picker for the page background. | [ ] |
| 8.8 | Calendar/Mini Calendar Theme gradients | Header background, day/card background, and weekend background (Mini Calendar Theme section, Calendar Generator's Style tab, Variable Content's miniCalendar Theme block) accept a gradient and render it correctly on the calendar card. | [ ] |

---

## 9. Text Tool (Title / Paragraph)

Registered as `title` (H1, 48px/700 default) and `paragraph` (P, 16px/400 default) — **not** the retired `titulo`/`paragrafo` keys.

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 9.1 | Create via drag or click | New element with the correct default tag/size/weight; auto-fit starts off. | [ ] |
| 9.2 | Enter edit mode | Double-click enters `contenteditable`; ctx-bar shows Bold/Italic/Underline. | [ ] |
| 9.3 | Typography | Font (Google Fonts + uploaded), size (8–200px), line height (1–4), alignment, Bold/Italic/Underline — all live. | [ ] |
| 9.4 | Color — solid & gradient | Both modes apply per §8; gradient clips to text via `background-clip`. | [ ] |
| 9.5 | Auto-fit | Enabled, a long string shrinks the font so text never overflows the original box. | [ ] |
| 9.6 | Content alignment | See 7.7. | [ ] |
| 9.7 | Text-transform | See 7.17. | [ ] |
| 9.8 | Size/position + page-align | Resize/move via panel; page-align actions (center on page) work as fire-and-forget via `SnapEngine.align()`. | [ ] |
| 9.9 | Default color is black | Fresh element defaults near-black, legible on white. | [ ] |
| 9.10 | Emoji renders in color | Typed emoji shows in color (Noto Color Emoji fallback), including after changing the font family afterward. | [ ] |

---

## 10. Image Tool & Filters

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 10.1 | Add via upload or drag | Placeholder appears immediately, then the real image loads. | [ ] |
| 10.2 | Fit mode | Cover / Contain / Fill each change how the image fills its box. | [ ] |
| 10.3 | Zoom / Rotation / Position | Zoom (0.1–5×), rotation, X/Y offset reposition the image within its frame without moving the box. | [ ] |
| 10.4 | Flip horizontal/vertical | See 7.16. | [ ] |
| 10.5 | Filters | Brightness, Contrast, Saturate, Hue rotate, Blur, Grayscale, Sepia, Invert, Opacity — all live. | [ ] |
| 10.6 | Background blur & blend mode | `bgBlur` slider and 16-option CSS blend-mode select apply immediately. | [ ] |
| 10.7 | Border & radius | Applies to the `<img>` specifically, not just the wrapper. | [ ] |
| 10.8 | Content alignment (object-position) | See 7.7. | [ ] |
| 10.9 | Shared meta seeding for linked cells | A sibling image cell in an Album linked layout without its own meta picks up `ImageTool.getDefaultMeta()` correctly. | [ ] |

---

## 11. Shape Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 11.1 | Picker — Basic tab | Procedural shapes: Square, Circle, Triangle, Polygon, Star, Heart, Blob, Flower, plus connector/line shapes. | [ ] |
| 11.2 | Picker — asset-pack tabs | Additional category tabs appear per registered SVG asset collection (`ShapeAssetLoader.ts`), each showing that pack's shapes. | [ ] |
| 11.3 | Create via click/drag | Click centers it on the page; drag places it at the drop position. | [ ] |
| 11.4 | Fill & stroke (procedural shapes) | Color, stroke color, stroke width (0–10) apply live. | [ ] |
| 11.5 | Fill & stroke (asset shapes) | Asset-pack SVGs also expose Fill/Stroke fields; recoloring re-fetches/recolors the source markup (`recolorAssetSvgMarkup`) rather than failing silently. | [ ] |
| 11.6 | Shape-specific fields | Square (corner radius), Polygon (sides), Star (points, inner ratio), Blob (points, randomness), Flower (petals) — each shown only for its own type. | [ ] |
| 11.7 | Gradient fill/stroke | Both fields support the standardized gradient picker (§8). | [ ] |
| 11.8 | "Change shape" context action | Swapping type via the picker preserves position/size and regenerates the meta/SVG. | [ ] |
| 11.9 | Stroke stays regular on resize | Resizing a shape with a stroke doesn't distort the stroke into an irregular/uneven line. | [ ] |

---

## 12. Icon Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 12.1 | Picker — pack tabs | Shows tabs for every registered pack: Material Symbols and Font Awesome (at minimum); tabs only appear when 2+ packs are registered. | [ ] |
| 12.2 | Material Symbols pack loads standalone | With no other pack registered, the picker still shows icons. | [ ] |
| 12.3 | Font Awesome pack | Selecting the Font Awesome tab shows its own icon set, correctly categorized/searchable, distinct from Material Symbols. | [ ] |
| 12.4 | Category filter / search | Category tabs filter the grid; search filters by label/keywords within the active pack. | [ ] |
| 12.5 | Create via click/drag | Same centered-click / drag-drop pattern as Shape. | [ ] |
| 12.6 | Style — fill/stroke | Color, stroke color, stroke width (0–10), including gradient (§8), all apply live. | [ ] |
| 12.7 | "Change icon" context action | Swapping via the picker updates meta and re-renders in place. | [ ] |
| 12.8 | Default pack respects Settings | See 6.6. | [ ] |

---

## 13. Emoji Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 13.1 | Picker | Category tabs + search + grid, search auto-focused on open. | [ ] |
| 13.2 | Category tabs / search | Switching category rebuilds the grid and clears the search query; typing filters live. | [ ] |
| 13.3 | Create via click/drag | Same centered/drop pattern. | [ ] |
| 13.4 | Panel fields | "Emoji character" text field + Size slider (16–256px) apply live. | [ ] |
| 13.5 | Sidebar/footer icon is a real emoji glyph | Desktop sidebar and mobile footer both show 😊, not a generic icon or a raw key. | [ ] |

---

## 14. Emoji Kitchen Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 14.1 | Create with no configuration | Placeholder `<img>` appears immediately; a random supported emoji is auto-picked as `leftEmoji`, then the real combo resolves asynchronously and swaps in. | [ ] |
| 14.2 | Left emoji field | Changing it re-fetches the combo. | [ ] |
| 14.3 | Right mode — Manual / Auto | Manual uses the typed right-emoji field directly; Auto picks automatically (falling back to the left emoji itself if unset). | [ ] |
| 14.4 | Combo fetch failure | Empty/broken image handled gracefully, no console crash. | [ ] |
| 14.5 | Mobile footer icon matches desktop | Both show the live combo thumbnail, not a generic icon. | [ ] |

---

## 15. QR Code Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 15.1 | Payload — Text / URL | Free text or URL; regenerates live. | [ ] |
| 15.2 | Payload — Wi-Fi | Network name, password, security (WPA/WPA2, WEP, None) → valid `WIFI:` payload. | [ ] |
| 15.3 | Payload — Phone / E-mail / SMS | Generate `tel:` / `mailto:` / `sms:` payloads respectively. | [ ] |
| 15.4 | Payload — PIX | Key, recipient, city, amount, transaction ID, description → valid PIX BR Code payload. | [ ] |
| 15.5 | Payload — Spotify | URL/URI + background + code color render via Spotify's `scannables.scdn.co` service, not a local QR SVG. | [ ] |
| 15.6 | Switching payload type | Only relevant fields shown, others hidden (not just disabled). | [ ] |
| 15.7 | Appearance | Color, background, Error Correction level (L/M/Q/H) all apply; code stays scannable at each EC level. | [ ] |
| 15.8 | Real-world scan | Phone camera decodes the payload correctly for each type. | [ ] |
| 15.9 | Border/radius | Shared sections apply to the container. | [ ] |
| 15.10 | Variable binding | Binding overrides manual fields in the editor preview (Agenda export resolves real per-repetition values separately). | [ ] |

---

## 16. Barcode Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 16.1 | Format — Code 39 | Alphanumeric content encodes/scans correctly. | [ ] |
| 16.2 | Format — EAN-13 | 12–13 digit numeric content encodes correctly (check digit included), scans correctly. Only these two formats are offered. | [ ] |
| 16.3 | Bar / background color | Both apply live, including gradient (§8) where offered. | [ ] |
| 16.4 | Show-text toggle | Toggles human-readable text under/over the bars. | [ ] |
| 16.5 | Border/radius | Shared sections apply. | [ ] |
| 16.6 | Variable binding | Same override behavior as QR Code. | [ ] |

---

## 17. Mini Calendar Tool (element)

Registered as `minicalendar`.

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 17.1 | Display mode — all 7 options | Days table only, Calendar (header+days), Header only, Holidays box only, Moon phases box only, Calendar with holidays, Full calendar with moon phases. | [ ] |
| 17.2 | Year/Month fields | Regenerates the card for the chosen month. | [ ] |
| 17.3 | Week start (Sun/Mon) | Toggling shifts both the leading blank cells and the weekday-letter order correctly. | [ ] |
| 17.4 | Theme — header/day colors | Header background/text and day/card background/text all apply and re-render live, with gradient support on the two background fields (§8). | [ ] |
| 17.5 | Theme — weekend background | A configured color renders behind Saturday/Sunday day-number cells specifically (not other days), layered under the ambient grid border. | [ ] |
| 17.6 | Theme — day-cell border | Width/style/color apply a full border to every day-number cell (including leading blanks). | [ ] |
| 17.7 | Theme — day-cell border radius | Rounds each day cell's corners, independent of whether a border is visible (also rounds a plain weekend background with no border). | [ ] |
| 17.8 | Theme — section spacing | A configured gap visibly separates the title bar, week-day header, and days grid (and holidays/moon boxes) instead of them sitting flush against each other. | [ ] |
| 17.9 | Highlight a day — enabled | Toggle on; the resolved day (Today/Fixed/Linked) shows its own background/text/border, replacing the ambient grid look for that cell only. | [ ] |
| 17.10 | Highlight day source — Today | Always the real current day, recomputed on every regenerate. | [ ] |
| 17.11 | Highlight day source — Fixed | Manually-entered day-of-month field appears only in this mode. | [ ] |
| 17.12 | Highlight day source — Linked | Bindable to another element's `date`-type variable; the highlighted day tracks that leader's day-of-month. | [ ] |
| 17.13 | Holidays rendering | With a display mode that includes the holidays box, Brazilian holidays for the month show correctly. | [ ] |
| 17.14 | Moon phases rendering | With a display mode that includes the moon box, phase icons/labels for the month render correctly. | [ ] |
| 17.15 | Edits re-render immediately | Any panel change visibly rebuilds the card. | [ ] |
| 17.16 | Not locked by default | A freshly-created element is draggable/selectable normally (not locked). | [ ] |

---

## 18. Curved Text Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 18.1 | Mode — Arc top / Arc bottom | Text follows the arc above/below the path with correct reading orientation. | [ ] |
| 18.2 | Mode — Full circle | Text wraps a complete circle; "Start offset" slider (0–100%) only visible in this mode. | [ ] |
| 18.3 | Radius | Slider (20–200) resizes the arc/circle. | [ ] |
| 18.4 | Typography | Font, size, letter spacing, Bold, Italic apply along the curve. | [ ] |
| 18.5 | Color — solid & gradient | Gradient applies via SVG `linearGradient` oriented per the angle. | [ ] |
| 18.6 | Edits re-render immediately | Field changes visibly rebuild the SVG. | [ ] |
| 18.7 | Drag-and-drop creation works | Dragging the tool onto the page creates the element at the drop position (not a no-op). | [ ] |

---

## 19. Stamp Tool

Registered as `stamp` (retired key: `carimbo`).

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 19.1 | Outer text | Text, font size (4–30), Bold — renders along the outer arc. | [ ] |
| 19.2 | Inner text | "Show inner text" toggle, text, font size (4–20) render on the inner arc when enabled. | [ ] |
| 19.3 | Center — Text / None | Multi-line center text (via `\n`) renders centered; None shows nothing. | [ ] |
| 19.4 | Style — radius/rings/ring width | Radius (45–93), Rings (1/2/3), Ring width (0.5–5) change the concentric circles. | [ ] |
| 19.5 | Style — separator | Star/Dot/Diamond/None render at the outer/inner text seam. | [ ] |
| 19.6 | Style — font/color | Applies to all text in the stamp. | [ ] |
| 19.7 | i18n default text | Default placeholder text is localized per active language, not hardcoded Portuguese. | [ ] |
| 19.8 | Edits re-render immediately | Field changes visibly rebuild the SVG. | [ ] |
| 19.9 | Drag-and-drop creation works | Same as 18.7, for Stamp. | [ ] |

---

## 20. Paper / Background Tool

Registered as `paper` (retired key: `papeis`); merged into Page Settings as "Papel personalizado".

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 20.1 | Sidebar click behavior | Finds or creates the single background element on the active page (no duplicates on repeated clicks). | [ ] |
| 20.2 | Locked by default | Freshly-created element has `data-locked="true"`. | [ ] |
| 20.3 | Paper type — all 18 options | Lined, Vertical lined, Grid, Dot, Millimeter, Grid+lined split, Blank, Music staff, Guitar tab, Ukulele staff tab, Guitar chord/treble, Calligraphy, Cornell, Isometric, Perspective sketch, Hexagonal, Séyes, Storyboard — each renders its distinct pattern. | [ ] |
| 20.4 | Paper size — all 10 presets | A4, A5, A3, B4, B5, Letter, Legal, Tabloid, Executive, Custom. | [ ] |
| 20.5 | Theme presets | All 13 presets apply their bg/line color pair. | [ ] |
| 20.6 | Lines section | Color, style, spacing (4–20), width (0.1–5). | [ ] |
| 20.7 | Margins | Top/Right/Bottom/Left (0–50mm) reposition the usable area. | [ ] |
| 20.8 | Background color/pattern (bug fix regression) | Background color actually applies (previously a bug caused it to be ignored). | [ ] |
| 20.9 | Line gradient / per-line-or-per-page mode | A gradient line color renders (previously blank) and can be applied per-line or per-page. | [ ] |
| 20.10 | Extras toggles | Side bar, Watermark, Logo, Page numbers each toggle correctly. | [ ] |
| 20.11 | Custom paper on alternated/mirrored pages | Custom paper shows correctly on alternate/mirrored duplicate pages (previously missing). | [ ] |

---

## 21. Table Tool

New element (`table`) — real `<table>` with editable cells.

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 21.1 | Template picker gallery | 4 style templates shown with live preview swatches: Simple, Colored header, Zebra stripes, Rounded cards. | [ ] |
| 21.2 | Create via click/drag | Places a table at the default size with the picked template. | [ ] |
| 21.3 | Cell text editing | Double-click enters edit mode; typing directly into `<td>` cells persists correctly (via `contentArea.innerHTML` capture, same mechanism as typed text elements). | [ ] |
| 21.4 | Add/remove row | Row-count stepper adds/removes rows; header row (if enabled) stays row 0. | [ ] |
| 21.5 | Add/remove column | Column-count stepper adds/removes columns; removing is blocked if it would cut through an existing merge reaching the last column (shows the correct warning). | [ ] |
| 21.6 | Header-row toggle | Toggling "first row is header" changes styling for row 0 specifically. | [ ] |
| 21.7 | Accent color | Applies to the template's accent-relevant parts (header bg on colored templates, stripes on zebra, etc.). | [ ] |
| 21.8 | Column width resize | Dragging a column-boundary handle resizes that column (`colgroup` percentage widths), active while in inline-edit mode. | [ ] |
| 21.9 | Cell merge | Click to anchor, shift+click to select a rectangle, use the floating toolbar to merge; merges can't clip an already-merged cell. | [ ] |
| 21.10 | Cell unmerge | Floating toolbar unmerges a selected merged cell back to individual cells. | [ ] |
| 21.11 | In-panel style switching | A compact template-swatch strip at the top of the Table section switches style immediately after selecting an existing table (not only via the ctx-bar "Change template" action). | [ ] |
| 21.12 | Ctx-bar "Change template" action | Also switches style, highlighting the currently-active template. | [ ] |
| 21.13 | Header/body typography | Independent font family/size/Bold/Italic/text color for header vs. body, in a dedicated Typography accordion. | [ ] |
| 21.14 | Template switch resets only text color | Switching template resets header/body text color to something legible against the new background, but preserves user-set family/size/Bold/Italic. | [ ] |
| 21.15 | Cell focus highlight | Whichever cell currently has the caret shows a 2px accent outline that doesn't conflict with the template's own cell border. | [ ] |
| 21.16 | Row/col counts always reflect live DOM | Rows/Cols panel fields always match the table's actual current structure, even after merges/unmerges change effective cell counts. | [ ] |

---

## 22. Variable Content Tool & Variable Engine

Registered as `variablecontent` (retired key: `conteudovariavel`). This is the largest surface in the app — test both the panel's live editor-preview resolution and the Agenda Export's real per-repetition resolution, since they're separate code paths.

### 22.1 — Variable Content Tool basics

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 22.1.1 | Create with no binding | Placeholder text with a dashed outline. | [ ] |
| 22.1.2 | Binding section opens first | Bind to a data field; placeholder is replaced with the resolved preview value. | [ ] |
| 22.1.3 | Typography, border, content-align, text-transform | All shared sections (§7–10) apply to the bound content's container. | [ ] |
| 22.1.4 | Context bar formatting | Bold/Italic/Underline apply to the whole element (no manual text selection). | [ ] |
| 22.1.5 | Auto-fit tracks typography changes | With auto-fit on, changing font/size/Bold/Italic resizes the box immediately, not only when the resolved value itself changes. | [ ] |

### 22.2 — Variable types

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 22.2.1 | `date` | Resolves and formats a date per the selected date format (see 22.3). | [ ] |
| 22.2.2 | `sequenceNumber` / `sequenceText` | Resolves a sequential number/text value per repetition. | [ ] |
| 22.2.3 | `pageNumber` | Resolves the current output page number. | [ ] |
| 22.2.4 | `link` | Resolves a value from a linked element (see §29). | [ ] |
| 22.2.5 | `emoji` | Resolves a plain emoji character, rendered with the Noto Color Emoji font stack. | [ ] |
| 22.2.6 | `apiPhrase` | Resolves a phrase from the phrase bank/collections API. | [ ] |
| 22.2.7 | `emojiKitchen` | Resolves a combo image URL; renders the real `<img>` markup, whitespace collapses to normal. | [ ] |
| 22.2.8 | `miniCalendar` | Resolves and renders the real calendar-card HTML (not literal text); whitespace collapses to normal so the card isn't inflated/decentered. | [ ] |

### 22.3 — Date formats

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 22.3.1 | `DD/MM/YYYY`, `DD/MM/YY`, `DD/MM`, `MM/YYYY`, `YYYY-MM-DD` | Each numeric format renders correctly. | [ ] |
| 22.3.2 | `DAY_MONTH_LONG`, `DAY_MONTH_YEAR_LONG` | Localized long-form date (e.g. "28 de julho", "28 de julho de 2026"). | [ ] |
| 22.3.3 | `WEEKDAY`, `WEEKDAY_SHORT`, `WEEKDAY_DATE` | Full/abbreviated weekday name; combined weekday+date. | [ ] |
| 22.3.4 | `DAY_ONLY`, `MONTH_ONLY` | Just the day number / just the month name. | [ ] |
| 22.3.5 | `DAY_OF_YEAR` | Correct 1–366 ordinal day count. | [ ] |
| 22.3.6 | `WEEK_NUMBER` | Correct ISO week number. | [ ] |
| 22.3.7 | `CUSTOM` | Custom-format legend/tokens (including `{estacao}`/`{lua}`/`{feriado}`) render correctly; the format-picker UI is a multi-select pill-button redesign, not a dropdown. | [ ] |
| 22.3.8 | `SPECIAL_DATE` | Resolves from the calendar-dates dataset (holidays/commemorations); "Detalhe" description concatenation option works; item-limit and randomize options work. | [ ] |
| 22.3.9 | `SPECIAL_DATE` — holiday scope filter | National/State/Municipal checkboxes filter results; selecting "Estadual" reveals a UF select (all 27 states); results respect the chosen scope(s). | [ ] |
| 22.3.10 | `MOON_PHASE` | Correct phase name/icon for the date; display mode (icon/emoji/text single-select) works. | [ ] |
| 22.3.11 | `SEASON` | Correct season for the date and configured hemisphere; single-select display mode works. | [ ] |
| 22.3.12 | `ZODIAC` | Correct zodiac sign for the date; single-select display mode works. | [ ] |
| 22.3.13 | `DAYS_BOX` | Colored weekday box renders (not raw HTML text); resizes with the element box on both width and height; respects Bold/Italic toggles; height/border controls work. | [ ] |
| 22.3.14 | Date-language selector | Independent from the UI language — e.g. UI in English, date text in Portuguese — weekday/month names follow the date-language setting. | [ ] |

### 22.4 — miniCalendar variable format

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 22.4.1 | Mode — Fixed / Sequential | Fixed always shows the configured month; Sequential advances 1 month per repetition. | [ ] |
| 22.4.2 | Display mode | All 7 Mini Calendar display modes selectable, matching §17.1. | [ ] |
| 22.4.3 | Week start toggle | Same behavior as 17.3. | [ ] |
| 22.4.4 | Highlight — enabled/day-source | Today/Fixed/Linked day sources work the same as 17.9–17.12, with the "link to date variable" toggle positioned at the top of the config. | [ ] |
| 22.4.5 | Highlight — colors | Background/text/border colors apply (solid-only pickers). | [ ] |
| 22.4.6 | Theme — header/day/weekend colors | Same 5 fields as the standalone tool's Theme section (§17.4–17.5), with gradient support on the background fields. | [ ] |
| 22.4.7 | Theme — day-cell border + radius | Same as 17.6–17.7. | [ ] |
| 22.4.8 | Theme — section spacing | Same as 17.8. | [ ] |
| 22.4.9 | Linked highlight-day live update | If linked to a `date` element, changing that leader's date live-updates the highlighted day (and, when linked, the whole card's shown month/year mirrors the leader's). | [ ] |

### 22.5 — Engine-level behavior

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 22.5.1 | Preview index | In the testing/preview panel, changing the sample index updates every bound placeholder across the page to the corresponding simulated row. | [ ] |
| 22.5.2 | Multi-page repetition index offset | Across an Agenda with repeated pages, sequential/index-based values (sequenceNumber, sequentialMonthly miniCalendar, etc.) advance correctly without an off-by-one at page boundaries. | [ ] |
| 22.5.3 | Pasted Variable Content keeps `linkedTo` candidacy | Copy/paste a Variable Content element; it still appears as a valid `linkedTo` target for other elements afterward. | [ ] |

---

## 23. Album Wizard (Photo Album / Business Card)

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 23.1 | Open from sidebar | Opens on the active (or first) page; size picker defaults sensibly. | [ ] |
| 23.2 | Mode — Album | Multi-photo grid: upload photos, pick a template, photos populate cells. | [ ] |
| 23.3 | Mode — Business Card | Single photo repeated across a grid of cells. | [ ] |
| 23.4 | Business Card — Quantity Auto/Manual | Auto fills the max cells the template supports; Manual exposes a quantity field. | [ ] |
| 23.5 | Smart Fit toggle | Auto-rotates images whose aspect ratio mismatches the cell (contain-fit cells only). | [ ] |
| 23.6 | Template picker — built-in & user-saved | Both built-in `GridSizes` templates and Generator-saved templates appear and apply correctly. | [ ] |
| 23.7 | Linked cells (promo-kit slots) | Replacing one linked image updates all linked siblings consistently. | [ ] |
| 23.8 | Delete-only-targeted-slot | Deleting a photo from a non-first slot only removes that slot's photo. | [ ] |
| 23.9 | Pan/zoom/click on album cell images | Each cell's image supports pan/zoom and click-to-replace correctly. | [ ] |
| 23.10 | Delete clears content on every spanned page | Deleting an Album element clears its content on every page it spans (not just the first). | [ ] |
| 23.11 | Generated grid marks its source correctly | No `gridSource='calendar'` on Album-generated grids, so clicking the page reopens Album, not Calendar Generator. | [ ] |
| 23.12 | Mobile tap-to-add | Tapping the sidebar entry opens the wizard directly on the first visible page. | [ ] |

---

## 24. Calendar Generator (full-page sheets)

Panel-only tool, key `calendar`.

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 24.1 | Open from sidebar | 5 accordion tabs: Model, Layout, Fill mode/Period, Style, Generate. Live preview replaces `#main-page` with the floating "Preview" badge. | [ ] |
| 24.2 | Model — Simple vs Complete | Complete additionally shows the moon-phases theme row. | [ ] |
| 24.3 | Week start toggle | Shifts the leading blanks and weekday-letter order correctly. | [ ] |
| 24.4 | Layout — all 5 grid presets | 20-slot, 8-slot square, 8-slot rect, 4-slot, 2-slot; slot count matches `cols × rows`. | [ ] |
| 24.5 | Fill mode — Sequential / Repeat 1 / Repeat 2 | Sequential increments per slot; Repeat 1 = one month per sheet; Repeat 2 = two months split per sheet; all respect the 60-sheet safety cap. | [ ] |
| 24.6 | Style — per-part theme editor | Title bar, Week header (+ inner border), Day numbers (+ inner border), Holidays, Moon phases (Complete only) — every field updates the live preview instantly. | [ ] |
| 24.7 | Style — day-cell border radius | New border-radius field in the Day numbers inner-border block rounds each day cell's corners on the generated cards. | [ ] |
| 24.8 | Style — section spacing | New "Spacing" panel row adds a gap between title bar / week header / days grid on the generated cards. | [ ] |
| 24.9 | Style — card border/background | Card background color, border width/style/color apply to every cell. | [ ] |
| 24.10 | Generate summary | The Generate tab's sheet-count matches the actual plan, live-updating as Layout/Fill-mode/Period change. | [ ] |
| 24.11 | Generate action | Restores the main page, appends one real page per sheet with static calendar cards; success toast shown. | [ ] |
| 24.12 | Generate — too many sheets | Blocked with an error toast, no partial generation. | [ ] |
| 24.13 | Switching away restores canvas | Original page content restored, floating badge removed. | [ ] |
| 24.14 | Reopening a generated page | Reopens the Calendar Generator panel, not Album. | [ ] |
| 24.15 | Border-removal control | A page-level custom-paper/calendar border can be fully removed (width 0 or style None actually removes it visually). | [ ] |

---

## 25. Agenda Export Tool (PDF & SVG)

Panel-only tool, key `agenda` — 3 accordion tabs: Pages, Preview, Actions.

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 25.1 | Open from sidebar | Lists every page with its repeat-count control. | [ ] |
| 25.2 | Set repeat count per page | Persists via `data-agenda-repeat="N"` for the session. | [ ] |
| 25.3 | Preview tab | Shows how bound variables differ across repetitions (1st/2nd/last) without generating every page. | [ ] |
| 25.4 | Preview reflects all bound tool types | Correctly summarizes QR Code, Barcode, Variable Content (incl. `miniCalendar`/`SPECIAL_DATE`/etc.), and any other tool exposing `variableBinding`. | [ ] |
| 25.5 | Preview mode toggle & page nav | Single toggle switches preview on/off; page navigation stays visible/usable regardless of toggle state. | [ ] |
| 25.6 | Preview badge color matches app standard | Preview badge uses the same accent styling as other panel-only tools' badges. | [ ] |
| 25.7 | Preview doesn't reset element z-index | Toggling preview mode on/off doesn't disturb elements' configured z-index stacking. | [ ] |
| 25.8 | Export summary | Actions tab shows the correct total output-page count given each page's repeat count. | [ ] |
| 25.9 | PDF export action | Real PDF export iterates each page's repetitions with correct per-repetition variable resolution (distinct from the panel's preview-only resolution), including on alternated/mirrored duplicate pages (position/z-index preserved). | [ ] |
| 25.10 | Multi-page index offset | Variables tied to repetition index don't skip/repeat a value at page boundaries across multiple source pages (see 22.5.2). | [ ] |
| 25.11 | SVG export action | "Exportar para SVG" (merged into the Actions tab) produces vectorized SVG output via `AgendaSvgExport`/`html-to-svg`, respecting `buildFlattenedOutputPages()`'s per-repetition flattening. | [ ] |
| 25.12 | SVG export — fonts/kerning | Exported SVG text uses the correct bundled font files and doesn't show the letter-spacing/kerning bug (patched in `html-to-svg`). | [ ] |
| 25.13 | SVG export — progress feedback | A toast shows live percentage progress while exporting (not a single opaque spinner). | [ ] |
| 25.14 | Export merge toggle | The "merge" option (single combined SVG vs. one file per page) behaves as labeled. | [ ] |
| 25.15 | No pages / no bindings | Appropriate error/info toast instead of a silent no-op or crash. | [ ] |

---

## 26. Template Generator

Panel-only tool, key `generator` (retired key: `gerador`) — persists to `UserTemplates` (`localStorage`).

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 26.1 | Open from sidebar | Saves `#main-page` content once, takes over as a live SVG preview with the floating badge. | [ ] |
| 26.2 | Name field required | Save is blocked without a name (validated on click). | [ ] |
| 26.3 | Size picker | Project sizes + standard fallbacks selectable; preview re-renders at the new size. | [ ] |
| 26.4 | Type — Grid | Cell width/height/gap + padding + page margin (with auto-center toggle). | [ ] |
| 26.5 | Type — Strip | Grid fields plus Lines/Columns for a photostrip layout. | [ ] |
| 26.6 | Type — Promo Kit | Up to 6 slots, each independently configurable; Add/Remove slot works; preview shows the composite. | [ ] |
| 26.7 | Auto-center margins toggle | Computes symmetric margins from natural content bounds, greys out margin inputs, live-updates as other fields change without losing focus. | [ ] |
| 26.8 | Save — new template | Saves, success toast, appears in Saved list tagged "User", invalidates the API cache so Album picks it up immediately. | [ ] |
| 26.9 | Save — validation errors | Missing name or size shows the correct error, doesn't save. | [ ] |
| 26.10 | Edit / Update a saved template | Edit loads all fields back correctly and switches Save to "Update"; Update overwrites the same id (no duplicate). | [ ] |
| 26.11 | Delete a saved template | Removes it; resets the form if it was being edited; invalidates the API cache. | [ ] |
| 26.12 | Template appears in Album wizard | Matches the layout used here. | [ ] |
| 26.13 | Switching away restores canvas | Original content + badge removal. | [ ] |

---

## 27. Image Slicer

Panel-only tool, key `imageslicer` (retired key: `fatiador`).

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 27.1 | Open from sidebar | Full-bleed overlay preview with floating badge; empty state shows an upload prompt. | [ ] |
| 27.2 | Upload via click / drag-drop | Both add thumbnails identically. | [ ] |
| 27.3 | Multi-image thumbnails | Selecting switches the active preview; removing (×) drops it and adjusts the active index. | [ ] |
| 27.4 | Grid — Rows/Cols (1–10) | Preview grid of R×C mock-up pages updates live, each labeled `n/total`. | [ ] |
| 27.5 | Page size | Rescales the preview mock-up. | [ ] |
| 27.6 | Fill mode — Full bleed / Margin | Margin mode reveals margin size, border width, and (once width > 0) border style/color. | [ ] |
| 27.7 | Multi-image indicator | Shows "Image X of Y" with 2+ images loaded. | [ ] |
| 27.8 | Generate action | Removes the overlay/badge, creates one real page per slice per image, correctly cropped via Canvas `drawImage`. | [ ] |
| 27.9 | Generate button state | Disabled while empty; shows spinner + "Generating…" during generation. | [ ] |
| 27.10 | Switching away before generating | Overlay/badge fully cleaned up via `_toolCleanup`. | [ ] |

---

## 28. Export (PDF / PNG / JPG / SVG)

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 28.1 | PNG export (single page) | Reflects page bounds, respects z-index layering, no severe aliasing. | [ ] |
| 28.2 | PDF export (no variables) | Every page renders with exact margins/size matching the configured page size. | [ ] |
| 28.3 | PDF export (with variable generation) | Sequential/bound values update correctly per page across all repetitions. | [ ] |
| 28.4 | SVG export (Agenda) | See §25.11–25.14. | [ ] |
| 28.5 | Mixed-source document export | A document mixing Calendar-generated sheets, Generator-generated pages, and Image-Slicer pages all export correctly together in one pass. | [ ] |
| 28.6 | Font loading during export | Exported PDF/SVG uses the correct bundled or API-served fonts (`fonts.css.php`), not a browser-default fallback, whether or not the API is configured. | [ ] |

---

## 29. Cross-Element Linking & Live Follower Updates

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 29.1 | Bind via "Vincular a" (generic link) | Binding one element's `linkedTo` to another same-type element mirrors its resolved value/format. | [ ] |
| 29.2 | Live-update on leader change | Changing the leader element's binding/format live-updates every follower immediately, without needing to reselect them. | [ ] |
| 29.3 | miniCalendar highlight-day link | A miniCalendar's highlight day, linked to a `date`-type element, updates live when that date element's binding changes (see 22.4.9). | [ ] |
| 29.4 | Editor-only visual indicator | See 7.18. | [ ] |
| 29.5 | Copy/paste preserves link candidacy | See 22.5.3; also confirm QR/Barcode paste doesn't share `_craftoolsMeta` by reference with the source (independent objects after paste). | [ ] |

---

## 30. Mobile-Specific Behavior

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 30.1 | Tap-to-add (canvas-element tools) | Tapping a draggable tool places the element centered on the first visible page. | [ ] |
| 30.2 | Mobile element panel | Selecting an element shows `MobileToolbar`'s per-element mini-panel instead of the desktop right-panel. | [ ] |
| 30.3 | Mobile menu toggle | Hamburger opens/closes the sidebar overlay; icon toggles `menu`/`close`. | [ ] |
| 30.4 | Panel-only tools on mobile | Agenda/Calendar/Generator/Image Slicer/Table are usable on mobile (confirm current wiring status; note any gap as a follow-up). | [ ] |
| 30.5 | Mobile footer shows every tool | Scrolling the bottom footer horizontally shows every `ToolRegistry` entry with the correct current (English) key/label, not a hardcoded subset. | [ ] |
| 30.6 | Mobile footer icons/labels match desktop sidebar | No mismatched/generic icon and no raw i18n key visible as literal text, for every tool including the recently-renamed ones. | [ ] |
| 30.7 | Simplified mobile header | Shows only favicon, zoom controls, and a "⋮" overflow menu (undo/redo/history/theme/language grouped inside). | [ ] |
| 30.8 | Ctx-bar position on mobile | Appears near the element (below it), not hidden behind the bottom footer. | [ ] |
| 30.9 | Auto-scroll to newly created element | Canvas auto-scrolls/centers on a newly created element, same as it does on selecting an existing one. | [ ] |
| 30.10 | Font-select list scroll vs. tap | Scrolling a long font list doesn't get misread as a tap-select. | [ ] |

---

## 31. Admin Panel Smoke Checks (craftools_api)

Light coverage of the PHP admin side that backs Variable Engine data — not a full admin test plan, just enough to catch a broken data pipeline before it surfaces as "variables return nothing" in the PWA.

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 31.1 | Datas & Feriados list — pagination & filters | List paginates correctly; category/scope filters (national/state/municipal, commemoration_main/commemoration_misc) narrow results correctly. | [ ] |
| 31.2 | Datas & Feriados — CSV import | CSV import trio (upload/preview/commit) adds rows correctly, visible immediately in the list and via the public API. | [ ] |
| 31.3 | Datas & Feriados — feriados-brasil GitHub importer | Importer fetches and tags output as `commemoration_main` correctly. | [ ] |
| 31.4 | Datas & Feriados — external API example-data importer | Importer runs without error and produces sane rows. | [ ] |
| 31.5 | Banco de Frases list — pagination & filters | Same pagination/filter correctness as 31.1. | [ ] |
| 31.6 | Shapes admin tab | Upload and bulk-import handlers add shape assets correctly; they appear via the public `shapes` API resource and in the Shape Tool's asset-pack picker. | [ ] |
| 31.7 | Public API — `calendar-dates` resource | Returns data matching what's shown in the admin list, respecting scope/category filters passed as query params. | [ ] |
| 31.8 | Public API request logging | Requests to `calendar-dates` (and other resources) are logged the same way as pre-existing resources. | [ ] |
| 31.9 | API unavailable fallback | With the API unreachable/unconfigured, `loadCalendarDate` falls back to the local `BrazilianCommemorativeDates.ts` dataset instead of leaving `SPECIAL_DATE` bindings empty. | [ ] |
| 31.10 | Env-based API base URL | Confirm the app points at the correct API base URL in dev vs. a production build (flagged as in-progress — verify current behavior, not assumed-correct). | [ ] |

---

## 32. Regression Checklist — Previously Fixed Bugs

Every row here should be a **hard pass**. A failure means a previously-fixed bug was reintroduced.

| Step | Regression | Test Action | Expected Result | Status |
|---|---|---|---|---|
| 32.1 | `createElement is not a function` (13+ tools) | Create one element of every canvas-element tool type (Text ×2, Image, QR Code, Barcode, Shape, Icon, Emoji, Emoji Kitchen, Mini Calendar, Curved Text, Stamp, Paper, Variable Content, Table). | Every one creates successfully, no console error. | [ ] |
| 32.2 | Panel-only tools missing `setup()` | Click Agenda, Calendar, Generator, Image Slicer, Album in the sidebar. | Every panel opens; none throw a `.bind()`-on-undefined error. | [ ] |
| 32.3 | `restoreOriginalCanvas` no-op | Open Calendar Generator or Generator, then switch tools. | Original page content is restored. | [ ] |
| 32.4 | `_toolCleanup` hook not invoked | Open Image Slicer, upload (overlay+badge appear), switch tools without generating. | Overlay and badge both disappear. | [ ] |
| 32.5 | Preview badge stuck on screen | Open Calendar Generator or Generator, switch tools. | Floating "Preview" badge disappears. | [ ] |
| 32.6 | Silent "regenerate" events | Edit any panel field for Shape, Icon, Mini Calendar, Curved Text, Stamp, QR Code, Table. | Rendered SVG/element updates immediately, not silently. | [ ] |
| 32.7 | Barcode bogus format list | Open the Barcode format dropdown. | Only "Code 39" and "EAN-13" listed. | [ ] |
| 32.8 | Mini Calendar display-mode mismatch | Open the display-mode dropdown. | All 7 real modes listed with English enum values. | [ ] |
| 32.9 | Mini Calendar theme colors had no effect | Change any Theme-section color/gradient in the standalone tool and in Variable Content's miniCalendar format. | The rendered card visibly updates for every field (header/day/weekend bg, text colors, day-cell border, radius, spacing). | [ ] |
| 32.10 | Missing QR `spotifyBarColor` field | Set QR payload type to Spotify. | "Code color" select present and functional. | [ ] |
| 32.11 | Variable-binding gaps | Open Barcode, QR Code, Variable Content, Table panels. | All expose a working "Bind to variable" section. | [ ] |
| 32.12 | Missing translation keys | Switch language to EN and ES with every tool's panel open in turn, including panel-only tools and Table/Settings. | No raw translation keys visible anywhere. | [ ] |
| 32.13 | Business-card image sync bug | Replace a photo in one linked Business Card cell. | All linked siblings update in sync. | [ ] |
| 32.14 | Auto-fit default-on bug | Create a new Text or Variable Content element. | Auto-fit starts **off**. | [ ] |
| 32.15 | Auto-fit size reverting on drag | Enable auto-fit, drag-resize. | Manual size respected, no snap-back mid-drag. | [ ] |
| 32.16 | Mini Calendar gap/centering in Variable Content preview | Bind a Variable Content element to `miniCalendar`. | No unwanted top gap; title bar height/centering correct. | [ ] |
| 32.17 | ToolRegistry label/icon drift | Compare every tool's icon/label across desktop sidebar, mobile footer, and panel title, for every renamed tool. | All match exactly, correctly translated. | [ ] |
| 32.18 | Properties panel stuck open after delete/deselect | See 7.9/7.10. | Fixed. | [ ] |
| 32.19 | QR/Barcode/Variable Content border fields silent no-op | See 7.5. | Fixed — border actually paints. | [ ] |
| 32.20 | Text/Variable Content/Curved Text emoji color lost on font change | See 9.10. | Fixed, consistently across all three tools. | [ ] |
| 32.21 | z-index controls silently no-op | Use front/back layering controls (any tool). | Actually reorders the element in the DOM/visual stack. | [ ] |
| 32.22 | Blend mode / auto-fit toggle scope bug (Image) | Toggle blend mode and auto-fit together on an Image element. | Each control affects only its own property, no cross-contamination. | [ ] |
| 32.23 | "Change shape"/"Change icon" context action blank tab | Open these ctx-bar actions. | Picker tab renders content, not a blank panel. | [ ] |
| 32.24 | Emoji Kitchen left-emoji creates a stray plain-emoji element | Pick a left emoji from the filtered field. | No extra stray element is created alongside the Emoji Kitchen element. | [ ] |
| 32.25 | Agenda PDF export — variables not resolving per-page | Export a multi-page agenda with bound variables. | Every page's variables resolve to that page's own values, not a stale/shared value. | [ ] |
| 32.26 | DAYS_BOX not resizing / ignoring Bold-Italic | See 22.3.13. | Fixed on both counts. | [ ] |
| 32.27 | Agenda alternate/mirrored pages losing element position on export | Export an agenda with alternate/mirrored duplicate pages. | Element positions and z-index survive export unchanged. | [ ] |
| 32.28 | Table Tool `custom` field type never wired | Open the Table Tool's in-panel template-swatch strip (a `custom`-type field). | Renders and functions correctly (regression check on the underlying `FieldRegistry` escape hatch, not just Table Tool). | [ ] |

---

## 33. General Regression Notes

- Keep DevTools Console clean (no red errors) after heavy navigation between tool panels — especially rapid switching between panel-only tools (Agenda/Calendar/Generator/Image Slicer/Album), since these mutate `#main-page` directly.
- During drag/drop/zoom/snap stress testing, memory should stay stable; noticeable slowdown after 30+ cloned elements indicates a listener leak.
- For panel-only tools, always verify the live preview (Calendar Generator, Generator) or overlay (Image Slicer) is fully torn down when leaving the tool — a lingering preview/overlay/badge is the signature symptom of the `restoreOriginalCanvas`/`_toolCleanup` regression class (§32).
- A clean `tsc`/`vite build` pass does **not** guarantee these manual behaviors are correct — TypeScript catches type errors, not silently-unwired event handlers or DOM-side no-ops (several rows in §32 compiled cleanly while being fully broken at runtime).
- When a color field is involved, always test both solid and (where offered) gradient mode — the standardized picker (§8) is shared code, but individual tools opt into gradient support per-field, and a field silently staying solid-only when it should be gradient-capable (or vice versa) is an easy regression to miss.
- For any Variable Engine date format, test with at least two different `dateLanguage` settings independent of the UI language — several formats (weekday/month names) are localization-sensitive in a way that's easy to accidentally hardcode to one locale.

---

## 34. Appendix: Renamed Tool Key Reference

For cross-referencing older bug reports, commits, or screenshots against the current codebase.

| Current key | Retired key | Tool |
|---|---|---|
| `title` | `titulo` | Text (heading) |
| `paragraph` | `paragrafo` | Text (paragraph) |
| `variablecontent` | `conteudovariavel` | Variable Content |
| `minicalendar` | `minicalendario` | Mini Calendar (element) |
| `imageslicer` | `fatiador` | Image Slicer |
| `calendar` | `calendario` | Calendar Generator |
| `icon` | `icone` | Icon |
| `image` | `imagem` | Image |
| `generator` | `gerador` | Template Generator |
| `curvedtext` | `textocurvo` | Curved Text |
| `stamp` | `carimbo` | Stamp |
| `paper` | `papeis` | Paper / Background |

Also note: Mini Calendar's `displayMode` enum values were renamed to English (e.g. `completo1`→`complete1`); Variable Engine's date-format constants were renamed to English (e.g. `caixaDias`→`DAYS_BOX`); several Portuguese API field/category names were renamed (e.g. `comemoracoes`→`commemorationsMain`/`commemorationsMisc`). If a test step or old bug report references a Portuguese-named constant not listed above, check `VariableEngine.ts` and `CalendarRenderer.ts`'s current enums before assuming it's missing.
