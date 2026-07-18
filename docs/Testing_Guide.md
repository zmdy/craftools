# CrafTools PWA — Manual Testing Plan

This document is the complete manual test checklist for validating the CrafTools PWA. Run it top to bottom in a clean browser session (no `localStorage` data) and again after restoring a saved session. Every section maps to a real tool or subsystem in the codebase (`craftools/tools/`, `craftools/components/Editor.ts`, `craftools/utils/`), so the test steps below reference the actual fields, options, and behaviors implemented — not a generic checklist.

Use the `Status` column as `[ ]` / `[✓]` / `[x]` / `[!]` (to do / pass / fail, note the bug).

---

## Table of Contents

1. [Initialization & PWA](#1-initialization--pwa)
2. [Session & Auto-save](#2-session--auto-save)
3. [Canvas & Navigation (Zoom/Pan)](#3-canvas--navigation-zoompan)
4. [History Management (Undo/Redo)](#4-history-management-undoredo)
5. [Page Management](#5-page-management)
6. [Element Selection & Common Panel Behavior](#6-element-selection--common-panel-behavior)
7. [Text Tool](#7-text-tool)
8. [Image Tool & Filters](#8-image-tool--filters)
9. [Shape Tool](#9-shape-tool)
10. [Icon Tool](#10-icon-tool)
11. [Emoji Tool](#11-emoji-tool)
12. [Emoji Kitchen Tool](#12-emoji-kitchen-tool)
13. [QR Code Tool](#13-qr-code-tool)
14. [Barcode Tool](#14-barcode-tool)
15. [Mini Calendar Tool (element)](#15-mini-calendar-tool-element)
16. [Curved Text Tool](#16-curved-text-tool)
17. [Stamp Tool (Carimbo)](#17-stamp-tool-carimbo)
18. [Paper / Background Tool](#18-paper--background-tool)
19. [Variable Content Tool & Variable Engine](#19-variable-content-tool--variable-engine)
20. [Album Wizard (Photo Album / Business Card)](#20-album-wizard-photo-album--business-card)
21. [Calendar Generator (full-page sheets)](#21-calendar-generator-full-page-sheets)
22. [Agenda Export Tool](#22-agenda-export-tool)
23. [Template Generator (Gerador)](#23-template-generator-gerador)
24. [Image Slicer](#24-image-slicer)
25. [Export (PDF / PNG / JPG)](#25-export-pdf--png--jpg)
26. [Mobile-Specific Behavior](#26-mobile-specific-behavior)
27. [Regression Checklist — Previously Fixed Bugs](#27-regression-checklist--previously-fixed-bugs)
28. [General Regression Notes](#28-general-regression-notes)

---

## 1. Initialization & PWA

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 1.1 | Open the app cold (no prior session saved in `localStorage`) | The editor loads cleanly, showing an empty canvas with one initial page. | [✓] |
| 1.2 | Open in Chrome and install as a PWA | The install prompt appears; after installing, the app opens as a standalone window correctly. | [ ] |
| 1.3 | Test offline functionality | With the service worker cached, disable the network and reload. The app should load from cache without an error screen (no dinosaur page). | [ ] |
| 1.4 | Access via mobile device (iOS Safari / Android Chrome) | Layout switches to the mobile view; the top toolbar shrinks and the hamburger menu activates. | [ ] |
| 1.5 | URL parameter `?mediaKey=album` | Opening with the album URL should activate Album mode, loading the appropriate settings and page size immediately. | [ ] |
| 1.6 | Language switcher (`#lang-select`) | Switching between PT-BR / EN-US / ES-ES re-renders the whole editor shell with the new language; the selection persists across the session. | [✓] |
| 1.7 | Theme toggle (`#theme-btn`) | Toggling switches `data-theme` between light and dark; icon updates between `dark_mode`/`light_mode`. | [✓] |

---

## 2. Session & Auto-save

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 2.1 | Auto-save interval | Add an element and wait ~30 seconds. The system should save to `localStorage` silently (no visual flicker). | [✓] |
| 2.2 | Session restore (crash/close) | Add elements, close the tab abruptly, and reopen. The recovery dialog should appear, or the session should restore automatically. | [✓] |
| 2.3 | Unsafe-close warning | Add an element and try to close the tab before auto-save fires. The browser should show the `beforeunload` warning ("unsaved changes"). | [ ] |
| 2.4 | Start fresh after clearing data | Clear the `craftools-session` key in DevTools and refresh. The canvas should load completely empty, with no recovery prompts. | [✓] |
| 2.5 | Simultaneous tabs | Open two CrafTools tabs at once. Each tab should keep its own state without immediate cross-contamination of actions. | [✓] |

---

## 3. Canvas & Navigation (Zoom/Pan)

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 3.1 | Zoom in (`#zoom-in-btn`) | Click '+' repeatedly (0.1 increments, capped at 3.0×); the canvas scales up and the % label updates accordingly. | [✓] |
| 3.2 | Zoom out (`#zoom-out-btn`) | Click '−' repeatedly (0.1 decrements, floored at 0.2×); the canvas scales down. | [✓] |
| 3.3 | Reset zoom (`#zoom-reset-btn`) | Resets the canvas to exactly 100%. | [! There is no reset zoom button] |
| 3.4 | Pinch gesture (mobile/trackpad) | `touchstart`/`touchmove` with 2 fingers scales smoothly between 0.2× and 3.0×, anchored to the starting pinch distance. | [ ] |
| 3.5 | Pan (drag background) | Click on empty canvas background (no element selected) and drag; the canvas should move with elements keeping their relative positions. | [ ] |

---

## 4. History Management (Undo/Redo)

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 4.1 | Simple undo | Add an element and click Undo. The element disappears and the history counter steps back one. | [ ] |
| 4.2 | History stack saturation | Perform 15+ additions/edits; the stack should only keep the last N states (default 10) and silently drop the oldest. | [ ] |
| 4.3 | History branching | Undo twice, then create a new element. The old "future" (redo branch) should be discarded and the counter follows the new branch. | [ ] |
| 4.4 | Redo | Clicking Redo restores the previously-undone action; the counter updates accordingly. | [ ] |
| 4.5 | Keyboard shortcuts | Ctrl+Z / Ctrl+Y (or Cmd on Mac, Ctrl+Shift+Z also works for redo) produce the same effect as the Undo/Redo buttons. Shortcuts are ignored while focus is in an `<input>`/`<textarea>`/`contenteditable`. | [ ] |
| 4.6 | Undo/redo re-attaches page events | After an undo/redo that restores a page's full `innerHTML`, clicking elements on that page still works (page-click and element-select listeners are re-attached, not lost). | [ ] |

---

## 5. Page Management

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 5.1 | Add new page (`#new-page-btn` / `#pwa-sidebar-newpage`) | Appends a new page to the end of the document and scrolls to it. | [ ] |
| 5.2 | Reorder pages | Dragging a page thumbnail to reorder physically moves the page in the flow. | [ ] |
| 5.3 | Clone page | Duplicate button produces an exact copy of the target page's full content and properties. | [ ] |
| 5.4 | Delete page | The page is removed from the flow. If it's the only page, deletion is blocked or a blank sheet replaces it. | [ ] |
| 5.5 | Grid/snapping | Enable rulers/grid and drag an object; it should snap to the configured grid axes/dots. | [ ] |
| 5.6 | Click a page generated by Calendar Generator | Clicking a page whose `.craftools-grid-container` has `dataset.gridSource === 'calendario'` reopens the Calendar Generator panel (`CalendarTool.setup(editor)`), not the Album wizard. | [ ] |
| 5.7 | Click a page generated by Album/Gerador (no `gridSource`) | Clicking a page with a plain `.craftools-grid-container` (no `gridSource='calendario'`) opens the Album wizard on that page. | [ ] |

---

## 6. Element Selection & Common Panel Behavior

These checks apply to every canvas-element tool (Text, Image, Shape, Icon, Emoji, Emoji Kitchen, QR Code, Barcode, Mini Calendar, Curved Text, Stamp, Paper, Variable Content).

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 6.1 | Select an element | Right panel opens showing that tool's schema-driven property sections; the context bar (`ctxBar`) shows the tool's context actions (if any). | [ ] |
| 6.2 | Deselect | Clicking empty canvas or another tool's button closes the panel/context bar; a deselected Paper element's z-index resets to `1`. | [ ] |
| 6.3 | Copy / Paste / Lock bar | Every element exposes the shared Copy/Paste/Lock actions from `BaseTool`; locking prevents drag/resize but keeps the element selectable for panel edits. | [ ] |
| 6.4 | z-index section | Every schema-driven tool includes the shared z-index control (front/back layering) via `zIndexSection()`. | [ ] |
| 6.5 | Border/radius sections (Barcode, QR Code, Image, Variable Content) | The shared `borderSection()`/`radiusSection()` controls (width, style, color, radius) apply consistently and render immediately. | [ ] |
| 6.6 | Session restore re-imports tool modules on demand | Restore a session containing an element whose tool module was never loaded this session (e.g. reload mid-session, select a Shape element first). The element should still be selectable and editable — `Editor.ts`'s `craftools-element-select` handler lazily imports the tool module via `LAZY_TOOL_LOADERS` before dispatching. | [ ] |
| 6.7 | Element reconstructed from restored session shows correct panel title/icon | Selecting a restored element (any type) shows the correct panel title and context options, not a blank/generic panel. | [ ] |
| 6.8 | Panel closes when the selected element is deleted | Select any element and delete it (Del key or the ctx-bar/handle's delete button). | The right-panel properties panel closes immediately (reverts to the default sidebar menu) instead of staying open showing controls for the now-deleted element. | [ ] |
| 6.9 | Panel closes on click-outside deselect | Select an element, then click empty canvas (not another element). | The right-panel properties panel closes the same way as 6.8. Selecting a *different* element directly (no intermediate empty-canvas click) opens that element's panel with no visible flicker. | [ ] |
| 6.10 | Panel header spacing | Select any element on both desktop and mobile. | The panel header bar (tool title + close button, `.craftools-panel-head.sidenav-brand-head`) has clear breathing room above/around the title — not glued to the app header above it. | [ ] |
| 6.11 | Only first accordion section open by default | Select an element whose schema has 2+ sections marked `defaultOpen: true` (e.g. Text, Shape). | Only the first section is actually expanded on selection; the others start collapsed but can still be expanded manually, and multiple can be open at once after manual expansion. | [ ] |
| 6.12 | Rotate/delete handle icon centering | Select any element (desktop and mobile) and inspect the circular rotate handle and the red delete (×) handle. | Both icons are visually centered inside their circular buttons — no off-center glyph. | [ ] |
| 6.13 | Ctx-bar appears below the element, Canva-style | Select any element. | The floating quick-actions bar (ctx-bar) appears **below** the element's bounding box, horizontally centered on it; the rotate/delete handles stay **above** the element as before. | [ ] |
| 6.14 | Ctx-bar tracks the element during scroll (desktop) | Select an element, then scroll `#canvas-area` without deselecting. | The ctx-bar (and the selection handles) move together with the element — no lag or fixed-position drift relative to the page. | [ ] |
| 6.15 | Ctx-bar falls back above when there's no room below | Select an element positioned near the bottom edge of the visible canvas area. | The ctx-bar renders **above** the element instead of below when there isn't enough room below (no bar clipped off-screen or hidden behind the footer/toolbar). | [ ] |
| 6.16 | Auto-fit quick-toggle on the ctx-bar (Text) | Select a Text element; click the `arrow_range` ctx-bar button. | Toggles "Auto-fit to text" the same as the Size & Position panel's own toggle; the icon tints orange (`var(--accent)`) while active, and the open properties panel (if showing this element) refreshes to reflect the new state. | [ ] |
| 6.17 | Auto-fit quick-toggle on the ctx-bar (Image) | Select an Image element; click the `arrow_range` ctx-bar button repeatedly. | Cycles the Transform section's "Fit mode" through Cover → Contain → Fill → Cover; icon is orange whenever the mode isn't the default "Cover"; the "Fit mode" select in the panel (if open) updates to match. | [ ] |
| 6.18 | Background fill section (Text, Image, QR Code, Variable Content) | Open the "Background" accordion (a standalone section on Text/QR/Variable Content; merged into Image's existing "Background" blur/blend-mode accordion under a "Fill" sub-header). | A solid-or-gradient color-picker ("Fill") and an independent "Opacity" slider (0–1) are present; changing either repaints a fill layer behind the element's real content (text/image/etc. never fades, only the fill does). Default is transparent/fully-opaque for elements that never had one set. | [ ] |
| 6.19 | Background fill does not appear on Barcode | Open the Barcode panel's Border section area. | No separate "Background (Fill/Opacity)" section is offered — Barcode already has its own "Background" color field (the bars' background color) and intentionally isn't wired to the new generic section to avoid a key collision. | [ ] |
| 6.20 | Border color can be a gradient | Open any tool's Border section and switch the Color field to Gradient mode. | The border renders the gradient (via `border-image`) instead of a solid color; switching back to Solid restores a normal `border-color` border. Requires border width > 0 and style ≠ None to be visible, same as a solid border. | [ ] |
| 6.21 | Border style — full option set | Open any tool's Border section and check the Style dropdown. | All CSS border-style keywords are offered: Solid, Dashed, Dotted, Double, Groove, Ridge, Inset, Outset, None (previously only Solid/Dashed/Dotted/None). | [ ] |
| 6.22 | Border actually renders on QR Code / Barcode / Variable Content | Set a border width/color/style on a QR Code, Barcode, and Variable Content element. | The border is visibly painted on the element in all three cases (previously these fields existed in the panel and were stored, but nothing ever painted them — editing border here used to be a silent no-op). | [ ] |

---

## 7. Text Tool

Applies to both `titulo` (H1, 48px/700 default) and `paragrafo` (P, 16px/400 default).

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 7.1 | Create via drag or tap-to-add | New text element appears with the correct default tag/size/weight for its type; auto-fit starts **off**. | [ ] |
| 7.2 | Enter edit mode | Double-click enters `contenteditable`; context bar shows Bold/Italic/Underline (via `execCommand`). | [ ] |
| 7.3 | Typography section | Change font (Google Fonts list + local/uploaded fonts), size (8–200px), line height (1–4), alignment (left/center/right/justify), Bold/Italic/Underline toggles. All apply live. | [ ] |
| 7.4 | Color mode — Solid | Set Color Mode to "Solid color"; the color field appears and applies directly. | [ ] |
| 7.5 | Color mode — Gradient | Set Color Mode to "Gradient"; the solid color field hides, the gradient field (from/to/angle) appears and clips to text (`background-clip`). | [ ] |
| 7.6 | Auto-fit | Enable Auto-fit and type a long string; font shrinks so the text never overflows the original bounding box (`AutoFitText.applyAutoSize`). | [ ] |
| 7.7 | Shape/margin section (`formaSection`) | Adjust the shared shape/margin controls; box padding updates. | [ ] |
| 7.8 | Size/position + page-align | Resize/move via the panel; use the page-align actions (center horizontally/vertically on page) — this is a fire-and-forget action (no persisted value), delegates to `SnapEngine.align()`. | [ ] |
| 7.9 | Default text color is black | Create a fresh Text element and open its Color section. | The color swatch defaults to near-black (`#18181b`), not white — text is legible immediately against the default white page. | [ ] |
| 7.10 | Emoji renders in color | Type an emoji character (e.g. 😀) into a Text/Título/Parágrafo element. | The emoji renders as a normal color emoji glyph (Noto Color Emoji font fallback), not a black-and-white "tofu" box, both on initial creation and after changing the font family afterward. | [ ] |
| 7.11 | Emoji still renders after changing font | Type an emoji, then change the Font field to a different typeface. | The emoji stays in color after the font change (regression: the font-family fallback stack previously dropped the emoji font when the `font` property changed, even though it was present at element creation). | [ ] |

---

## 8. Image Tool & Filters

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 8.1 | Add via Local Upload and via drag | Placeholder image appears immediately (`data:image/svg+xml` gray icon), then the real image loads. | [ ] |
| 8.2 | Transform — Fit mode | Cover / Contain / Fill options change how the image fills its box. | [ ] |
| 8.3 | Transform — Zoom / Rotation / Position | Zoom (0.1–5×), Rotation (−180°..180°), X/Y offset — all reposition the image within its frame without moving the parent box. | [ ] |
| 8.4 | Filters | All 9 filters apply live: Brightness, Contrast, Saturate, Hue rotate, Blur, Grayscale, Sepia, Invert, Opacity. | [ ] |
| 8.5 | Background blur & blend mode | `bgBlur` slider and the 16-option CSS blend-mode select (`normal`…`luminosity`) both apply immediately. | [ ] |
| 8.6 | Border & radius | Shared border/radius sections apply to the `<img>` element specifically (not just the wrapper). | [ ] |
| 8.7 | Shared meta seeding for linked cells | In an Album "linked" business-card layout, a sibling image cell without its own `_craftoolsMeta` picks up `ImageTool.getDefaultMeta()` correctly (used by `AlbumWizard.ts`). | [ ] |

---

## 9. Shape Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 9.1 | Open picker panel | Grid of 8 draggable shape buttons: Square, Circle, Triangle, Polygon, Star, Heart, Blob, Flower. | [ ] |
| 9.2 | Create via click | Clicking a shape in the picker places a new shape element centered on the page. | [ ] |
| 9.3 | Create via drag-and-drop | Dragging a shape button onto the page creates the shape at the drop position. | [ ] |
| 9.4 | Fill & stroke | Fill color, stroke color, stroke width (0–10) apply live and re-render the SVG. | [ ] |
| 9.5 | Shape-specific fields — Square | "Corner radius" slider (0–50) shown only for Square. | [ ] |
| 9.6 | Shape-specific fields — Polygon | "Sides" slider (3–12) shown only for Polygon. | [ ] |
| 9.7 | Shape-specific fields — Star | "Points" (3–12) and "Inner ratio" (0.15–0.85) shown only for Star. | [ ] |
| 9.8 | Shape-specific fields — Blob | "Points" (5–20) and "Randomness" (0–1) shown only for Blob. | [ ] |
| 9.9 | Shape-specific fields — Flower | "Petals" slider (4–16) shown only for Flower. | [ ] |
| 9.10 | "Change shape" context action | Swapping an existing shape's type via the picker preserves the element (position/size) but regenerates its meta/SVG for the new type. | [ ] |

---

## 10. Icon Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 10.1 | Open picker panel | Shows pack tabs (only if >1 pack registered), category tabs ("All" + per-category), a search box, and an icon grid. | [ ] |
| 10.2 | Material Symbols pack loads | With no other icon packs registered, the picker still shows icons (not "no icons found") — confirms `MaterialSymbolsPack.js`'s side-effect registration with `IconLibrary` is intact. | [ ] |
| 10.3 | Category filter | Selecting a category filters the grid to that category only; search box clears. | [ ] |
| 10.4 | Search | Typing in the search box filters icons across the active pack by label/keywords. | [ ] |
| 10.5 | Create via click / drag | Same pattern as Shape Tool — click places centered, drag places at drop position. | [ ] |
| 10.6 | Style section | Fill color, stroke color, stroke width (0–10) apply live. | [ ] |
| 10.7 | "Change icon" context action | Swapping an existing icon element's icon via the picker updates `_craftoolsMeta` and re-renders in place. | [ ] |

---

## 11. Emoji Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 11.1 | Open picker panel | Category tab bar (emoji groups) + search input + grid, auto-focuses the search box on open. | [ ] |
| 11.2 | Category tabs | Switching categories rebuilds the grid and clears the search query. | [ ] |
| 11.3 | Search | Typing filters the grid live. | [ ] |
| 11.4 | Create via click / drag | Places a new emoji element (same centered-click / drag-drop pattern as Shape/Icon). | [ ] |
| 11.5 | Panel fields | "Emoji character" text field and "Size" slider (16–256px) both apply live. | [ ] |
| 11.6 | Sidebar/footer icon is a real emoji | Look at the Emoji tool's entry in the desktop sidebar and the mobile footer. | Both show an actual emoji glyph (😊), not a generic Material Symbol icon or a raw translation key as the label. | [ ] |

---

## 12. Emoji Kitchen Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 12.1 | Create with no configuration | A placeholder `<img>` appears immediately; a random supported emoji is auto-picked as `leftEmoji` if none is set, then the real combo image resolves asynchronously from the Emoji Kitchen API and swaps in. | [ ] |
| 12.2 | Left emoji field | Changing "Left emoji" triggers `_resolveAndRender()` and re-fetches the combo. | [ ] |
| 12.3 | Right mode — Manual | With Right mode = Manual, the "Right emoji" text field is used directly as the combo partner. | [ ] |
| 12.4 | Right mode — Auto | With Right mode = Auto, the right side is chosen automatically (falls back to `left` emoji itself if no explicit right emoji set). | [ ] |
| 12.5 | Combo fetch failure | If the API call fails/returns no combo, `imageUrl` stays empty and the `<img>` shows a broken/empty image gracefully (no console crash). | [ ] |
| 12.6 | Mobile footer icon matches desktop | Compare the Emoji Kitchen entry's icon in the desktop sidebar vs. the mobile footer. | Both show the same live combo-preview thumbnail image, not a generic Material Symbol (`blender`) on mobile. | [ ] |

---

## 13. QR Code Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 13.1 | Payload — Text / URL | Enter free text or a URL; QR regenerates live. | [ ] |
| 13.2 | Payload — Wi-Fi | Network name, password, security (WPA/WPA2, WEP, or None) — generates a valid `WIFI:` payload. | [ ] |
| 13.3 | Payload — Phone | Phone number field generates a `tel:` payload. | [ ] |
| 13.4 | Payload — E-mail | E-mail, Subject, Body fields generate a `mailto:` payload. | [ ] |
| 13.5 | Payload — SMS | Phone + Message fields generate an `sms:` payload. | [ ] |
| 13.6 | Payload — PIX | PIX key, recipient, city, amount, transaction ID, description generate a valid PIX BR Code payload. | [ ] |
| 13.7 | Payload — Spotify | Spotify URL/URI + background color + **Code color** (Black/White) render as an `<img>` pointed at Spotify's public `scannables.scdn.co` service (not a locally-drawn QR SVG). | [ ] |
| 13.8 | Switching payload type | Only the fields relevant to the selected payload type are shown (others hidden, not just disabled). | [ ] |
| 13.9 | Appearance | QR color, background color, and Error Correction level (L 7% / M 15% / Q 25% / H 30%) all apply and the code remains scannable at each EC level. | [ ] |
| 13.10 | Real-world scan | Scan the rendered QR with a phone camera at each payload type to confirm the payload decodes correctly (not just visually plausible). | [ ] |
| 13.11 | Border / radius | Shared sections apply to the QR container. | [ ] |
| 13.12 | Variable binding | Bind the QR's content to a data-variable field; with a binding active, the manual payload fields are overridden by the resolved variable value in the editor preview (real per-repetition values are resolved separately by Agenda export). | [ ] |
| 13.13 | Edits actually re-render | Changing any field from the desktop panel visibly updates the rendered QR/image immediately (regression: this used to silently no-op). | [ ] |

---

## 14. Barcode Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 14.1 | Format — Code 39 | Alphanumeric content encodes and renders correctly, scans with a barcode reader app. | [ ] |
| 14.2 | Format — EAN-13 | 12–13 digit numeric content encodes correctly (including check digit), scans correctly. Only these two formats are offered (confirms the old bogus `code128`/`ean8`/`upc`/`itf14` options are gone). | [ ] |
| 14.3 | Bar color / Background color | Both apply live via the drawing API. | [ ] |
| 14.4 | Show text toggle | Toggles the human-readable text under/over the bars. | [ ] |
| 14.5 | Border / radius | Shared sections apply to the barcode container. | [ ] |
| 14.6 | Variable binding | Same as QR Code — binding a data field overrides the manual `text` value in the editor preview. | [ ] |

---

## 15. Mini Calendar Tool (element)

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 15.1 | Display mode — all 7 options | Verify each renders the intended subset: **Days table only**, **Calendar** (header+days), **Header only**, **Holidays box only**, **Moon phases box only**, **Calendar with holidays**, **Full calendar with moon phases**. | [ ] |
| 15.2 | Year / Month fields | Changing year (2000–2100) or month (1–12) regenerates the card for that month. | [ ] |
| 15.3 | Theme colors | Header background/text, day background/text, weekend background all apply and re-render the card live. | [ ] |
| 15.4 | Holidays rendering | With a display mode that includes the holidays box, Brazilian holidays for the selected month/year show correctly (via `BrazilianHolidays`). | [ ] |
| 15.5 | Moon phases rendering | With a display mode that includes the moon box, moon phase icons/labels for the month render correctly (via `MoonPhases`). | [ ] |
| 15.6 | Edits re-render immediately | Any panel field change visibly rebuilds the card (regression: this used to silently no-op). | [ ] |

---

## 16. Curved Text Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 16.1 | Mode — Arc top | Text follows an arc above the path, reading left-to-right on the outside of the curve. | [ ] |
| 16.2 | Mode — Arc bottom | Text follows an arc below the path (inside orientation). | [ ] |
| 16.3 | Mode — Full circle | Text wraps a complete circle; "Start offset" slider (0–100%) is only visible in this mode and rotates the starting point. | [ ] |
| 16.4 | Radius | Slider (20–200) changes the arc/circle size. | [ ] |
| 16.5 | Typography | Font, size, letter spacing, Bold, Italic all apply along the curve. | [ ] |
| 16.6 | Color — Solid | Solid color field applies to the curved text. | [ ] |
| 16.7 | Color — Gradient | Gradient (from/to/angle) applies via SVG `linearGradient`, oriented per the angle. | [ ] |
| 16.8 | Edits re-render immediately | Any field change visibly rebuilds the SVG (regression: this used to silently no-op). | [ ] |

---

## 17. Stamp Tool (Carimbo)

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 17.1 | Outer text | Text, font size (4–30), Bold toggle — renders along the outer arc. | [ ] |
| 17.2 | Inner text | "Show inner text" toggle, text, font size (4–20) — renders along the inner arc when enabled. | [ ] |
| 17.3 | Center — Text | Center type = Text: center text (multi-line via `\n`), font size (4–40), Bold — centered in the stamp. | [ ] |
| 17.4 | Center — None | Center type = None: no center content rendered. | [ ] |
| 17.5 | Style — Radius / Rings / Ring width | Radius slider (45–93), Rings select (1/2/3), Ring width (0.5–5) — changes the number/thickness of concentric circles. | [ ] |
| 17.6 | Style — Separator | Star / Dot / Diamond / None glyphs render at the left/right seam between outer and inner text. | [ ] |
| 17.7 | Style — Font / Color | Font-select and color apply to all text in the stamp. | [ ] |
| 17.8 | Edits re-render immediately | Any field change visibly rebuilds the SVG (regression: this used to silently no-op). | [ ] |

---

## 18. Paper / Background Tool

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 18.1 | Sidebar click behavior | Clicking "Paper" finds or creates the single background paper element on the active page and selects it (does not create duplicates on repeated clicks). | [ ] |
| 18.2 | Locked by default | A freshly-created paper element has `data-locked="true"` — it can't be accidentally dragged/resized on top of the page content. | [ ] |
| 18.3 | Paper type — all 18 options | Lined, Vertical lined, Grid, Dot, Millimeter (pink), Grid+lined split, Blank, Music staff, Guitar tab, Ukulele staff tab, Guitar chord/treble, Calligraphy, Cornell, Isometric, Perspective sketch, Hexagonal, Séyes, Storyboard — each renders its distinct pattern. | [ ] |
| 18.4 | Paper size — all 10 presets | A4, A5, A3, B4, B5, Letter, Legal, Tabloid, Executive, Custom — pattern scales/repositions to fit. | [ ] |
| 18.5 | Theme — all 13 presets | Default, Night, Sepia, Vintage, Pastel, Classic, Minimalist, Ocean, Forest, Sunset, Tech, Elegant, Creative — each applies its bg/line color pair. | [ ] |
| 18.6 | Lines section | Line color, style (Solid/Dashed/Dotted), spacing (4–20), width (0.1–5) all apply. | [ ] |
| 18.7 | Margins | Top/Right/Bottom/Left (0–50mm) reposition the pattern's usable area. | [ ] |
| 18.8 | Background | Color and pattern (None/Grid/Dots/Lines/Crosshatch/Graph) apply behind the paper's own lines. | [ ] |
| 18.9 | Extras toggles | Side bar, Watermark, Logo, Page numbers — each toggle enables/disables its respective overlay element. | [ ] |
| 18.10 | Dead field removed | `pageSettings.pageCount` no longer exists on `PaperMeta` — confirm no console error or `undefined` reference anywhere related to paper page count (removed as unused dead code; `showPageNumber` is unaffected and still works). | [ ] |

---

## 19. Variable Content Tool & Variable Engine

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 19.1 | Create with no binding | Placeholder text shows ("Configure a variable...") with a dashed outline. | [ ] |
| 19.2 | Variable binding section (opens first, by default open) | Bind to a data field; the placeholder is replaced with the resolved preview value. | [ ] |
| 19.3 | Binding preview — plain text | Binding to a text/API field shows the resolved string, `pre-wrap` whitespace preserved. | [ ] |
| 19.4 | Binding preview — Emoji Kitchen | Binding to an `emojiKitchen` variable renders the real `<img>` markup (not literal text), whitespace collapses to `normal`. | [ ] |
| 19.5 | Binding preview — Mini Calendar | Binding to a `miniCalendar` variable renders the real calendar-card HTML (not literal text), whitespace collapses to `normal` (prevents the card from being inflated/decentered by literal newlines). | [ ] |
| 19.6 | Typography | Font, size (8–200), alignment, Bold, Italic, Color — all apply to the bound content's container. | [ ] |
| 19.7 | Border / radius | Shared sections apply. | [ ] |
| 19.8 | Context bar formatting | Bold/Italic/Underline apply to the whole element (there is no manual text selection — content is always the resolved variable value). | [ ] |
| 19.9 | Variable Engine preview index | In the testing/preview panel, change the sample index (e.g., "Item 1 of 10"); every bound placeholder across the page updates to the corresponding simulated DB/API row. | [ ] |
| 19.10 | Cross-element linking | Bind an Image element to a "Logo" column in variable mode; changing the sample index updates the image's `src` accordingly. | [ ] |

---

## 20. Album Wizard (Photo Album / Business Card)

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 20.1 | Open from sidebar | Opens on the active page (or first page if none active); size picker defaults to the first available size (project sizes first, then standard fallbacks A4/A5). | [ ] |
| 20.2 | Mode — Album | Multi-photo grid mode: upload multiple photos, pick a template (built-in `GridSizes` or a saved custom template from Gerador), photos populate the grid cells. | [ ] |
| 20.3 | Mode — Business Card | Single-photo mode: upload one photo, repeated across a grid of business-card cells. | [ ] |
| 20.4 | Business Card — Quantity Auto | Auto mode fills the maximum number of cells the selected template/page size supports. | [ ] |
| 20.5 | Business Card — Quantity Manual | Manual mode exposes a quantity field; only that many cells are filled. | [ ] |
| 20.6 | Smart Fit toggle | Enabling Smart Fit auto-rotates images whose aspect ratio mismatches the cell, to minimize letterboxing (only affects cells using `objectFit: 'contain'`). | [ ] |
| 20.7 | Template picker — built-in | All built-in `GridSizes` templates (photo grids, photostrips, promo kits) appear and apply correctly. | [ ] |
| 20.8 | Template picker — user-saved | A template saved via the Gerador tool appears in the same picker, tagged as user-created, and produces the correct grid/promo-kit layout. | [ ] |
| 20.9 | Linked cells (promo-kit slots) | For templates with `slotLines`/`slotColumns` linking, dragging/replacing one linked image updates all linked siblings consistently (shared `_craftoolsMeta` seeding via `ImageTool.getDefaultMeta()`). | [ ] |
| 20.10 | Generated grid marks its source | The generated `.craftools-grid-container` has no `gridSource` attribute (or `gridSource !== 'calendario'`) so clicking the resulting page reopens the Album wizard, not Calendar Generator. | [ ] |
| 20.11 | Mobile tap-to-add | On mobile, tapping the Album sidebar entry opens the wizard directly on the first visible page (bypassing the desktop drag-and-drop flow). | [ ] |

---

## 21. Calendar Generator (full-page sheets)

Panel-only tool (`calendario`) — takes over the entire side panel and previews live on the main page.

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 21.1 | Open from sidebar | Panel opens with 5 accordion tabs: **Model**, **Layout**, **Fill mode / Period**, **Style**, **Generate**. Live preview replaces `#main-page` content immediately, with the floating orange "Preview" badge shown. | [ ] |
| 21.2 | Model — Simple vs Complete | "Simple" hides the moon-phases theme section; "Complete" shows it. | [ ] |
| 21.3 | Layout — all 5 grid presets | 20-slot (4×5, 50×50mm), 8-slot square (2×4, 70×70mm), 8-slot rect (2×4, 100×70mm), 4-slot (2×2, 100×140mm), 2-slot (1×2, 200×140mm) — each preset's slot count matches `cols × rows`. | [ ] |
| 21.4 | Fill mode — Sequential | Start month/year + sheet count (1–60, safety-capped) — months increment sequentially across all sheets/slots. | [ ] |
| 21.5 | Fill mode — Repeat 1 (one month per sheet) | Start/End month+year period — each sheet in the period repeats a single month across all its slots; sheet count capped at 60 (returns `null`/error toast if the period would exceed it). | [ ] |
| 21.6 | Fill mode — Repeat 2 (two months per sheet) | Same period fields — each sheet splits its slots roughly in half between two consecutive months; sheet-count safety cap still enforced. | [ ] |
| 21.7 | Style — per-part theme editor | Title bar (bg/color/font/size), Week header (bg/color/font/size + inner border), Day numbers (color/Sunday color/font/size/row gap + inner border), Holidays (color/font/size), Moon phases (color/font/size, Complete model only) — every field updates the live preview instantly. | [ ] |
| 21.8 | Style — cell border/background | Cell background color, border width/style/color (None/Solid/Dashed/Dotted) apply to every cell. | [ ] |
| 21.9 | Generate summary | The "Generate" tab's sheet-count summary matches the actual plan that will be generated, updating live as Layout/Fill-mode/Period fields change. | [ ] |
| 21.10 | Generate action | Clicking Generate restores the main page (removing the live-preview override) and appends one real page per sheet, each populated with a real `.craftools-grid-container`/`.craftools-grid-cell` grid of static calendar cards; a success toast appears. | [ ] |
| 21.11 | Generate — too many sheets | If the plan would exceed the 60-sheet safety cap, generation is blocked with an error toast (no partial generation). | [ ] |
| 21.12 | Switching away from Calendar Generator | Clicking any other sidebar tool restores `#main-page`'s original content and removes the floating "Preview" badge (via `Editor.ts`'s shared `restoreOriginalCanvas()`). | [ ] |
| 21.13 | Reopening a generated page | Clicking a page generated by this tool (`gridSource === 'calendario'`) reopens the Calendar Generator panel, not the Album wizard. | [ ] |

---

## 22. Agenda Export Tool

Panel-only tool (`agenda`) — 3 accordion tabs: **Pages**, **Preview**, **Actions**.

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 22.1 | Open from sidebar | Panel lists every page in the document with its repeat count control. | [ ] |
| 22.2 | Set repeat count per page | Setting a page's repeat count > 1 marks it via `data-agenda-repeat="N"`, persisting for the editor session. | [ ] |
| 22.3 | Preview tab | Shows how bound variables will differ across repetitions (1st, 2nd, and last) without generating every page — uses `VariableEngine.prefetchApiResources` + `resolve`. | [ ] |
| 22.4 | Preview reflects all bound tool types | Preview correctly summarizes bindings from QR Code, Barcode, Variable Content, and any other tool exposing `variableBinding` in its meta/state. | [ ] |
| 22.5 | Export summary | Actions tab shows a correct total output-page count given each page's repeat count. | [ ] |
| 22.6 | Export action | Triggers the real PDF export (`PdfExport`), iterating each page's repetitions with the correct per-repetition variable values resolved (distinct from the editor's preview-only resolution). | [ ] |
| 22.7 | No pages / no bindings | With nothing to export, an appropriate error/info toast appears instead of a silent no-op or crash. | [ ] |

---

## 23. Template Generator (Gerador)

Panel-only tool (`gerador`) — custom grid-template builder with live SVG preview, persists to `UserTemplates` (`localStorage`).

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 23.1 | Open from sidebar | Saves the current `#main-page` content once (`_savedPageHtml`), then takes over the page as a live SVG preview with the floating "Preview" badge. Panel shows Name, Size, Type, Config, and Saved-templates accordions. | [ ] |
| 23.2 | Name field | Typing a name is required to save (validated on Save click). | [ ] |
| 23.3 | Size picker | Project sizes (if any) plus standard fallbacks (A4, A5, A3, 10×15, 15×21, 20×30, 30×40) are selectable; preview re-renders at the new size. | [ ] |
| 23.4 | Type — Grid | Cell width/height/gap + cell padding (margin group) + page margin (with auto-center toggle) — preview shows a uniform grid. | [ ] |
| 23.5 | Type — Strip | Same as Grid plus "Lines"/"Columns" fields controlling a photostrip-style repeating layout. | [ ] |
| 23.6 | Type — Promo Kit | One or more slots (up to 6), each with width/height/count/gap/rows/columns/padding; "Add slot"/"Remove slot" buttons work; preview shows the composite kit layout. | [ ] |
| 23.7 | Auto-center margins toggle | Enabling it computes symmetric page margins from the content's natural bounds (grid or promo-kit) and greys out the margin inputs (read-only) while active; live-updates the margin values as cell/gap/page-size fields change, without losing focus on the field being edited. | [ ] |
| 23.8 | Save — new template | Saves to `UserTemplates` (`localStorage`), shows a success toast, appears immediately in the Saved-templates list tagged "User", and invalidates the API data cache so the Album wizard picks up the new template right away. | [ ] |
| 23.9 | Save — validation errors | Saving without a name, or without a selected size, shows the correct error toast and does not save. | [ ] |
| 23.10 | Edit a saved template | Clicking Edit on a saved template loads all its fields back correctly (type, size, config, promo slots, `autoCenterMargin` toggle state) and switches the Save button to "Update". | [ ] |
| 23.11 | Update existing template | Saving while editing overwrites the same `_id` instead of creating a duplicate. | [ ] |
| 23.12 | Delete a saved template | Removes it from `UserTemplates` and the list; if it was being edited, resets the form to "new"; shows a success toast; invalidates the API cache. | [ ] |
| 23.13 | New Template button (while editing) | Resets the form back to defaults (Grid type, blank name) without discarding other saved templates. | [ ] |
| 23.14 | Template appears in Album wizard | A template saved here shows up in the Album wizard's template picker and produces a matching layout when used. | [ ] |
| 23.15 | Switching away restores canvas | Clicking any other sidebar tool restores `#main-page`'s original content and removes the floating badge. | [ ] |

---

## 24. Image Slicer

Panel-only tool (`fatiador`) — upload + R×C image slicer with live canvas-overlay preview.

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 24.1 | Open from sidebar | Canvas area shows the full-bleed preview overlay (`#slicer-preview-overlay`) with the floating "Preview" badge (`#slicer-canvas-badge`); empty state shows an upload prompt. | [ ] |
| 24.2 | Upload via click | Clicking the dropzone opens the file picker; selecting one or more images adds them as thumbnails. | [ ] |
| 24.3 | Upload via drag-and-drop | Dragging image files onto the dropzone works identically to the click-to-upload flow. | [ ] |
| 24.4 | Multi-image thumbnails | Selecting a thumbnail switches the active preview image (highlighted border); removing a thumbnail (×) drops it from the list and adjusts the active index if needed. | [ ] |
| 24.5 | Grid — Rows / Cols | Values 1–10 each; preview grid of R×C page mock-ups updates live, each labeled `n/total`. | [ ] |
| 24.6 | Page size | Selecting a size (project sizes + standard fallbacks) rescales the preview mock-up pages. | [ ] |
| 24.7 | Fill mode — Full bleed | Image fills each mock-up page edge-to-edge, no margin. | [ ] |
| 24.8 | Fill mode — Margin | Margin section appears; margin size (0–50) and border width (0–10) apply, with border style (solid/dashed/dotted/double) and color options shown only once border width > 0. | [ ] |
| 24.9 | Multi-image indicator | With 2+ images loaded, the preview shows "Image X of Y" below the grid. | [ ] |
| 24.10 | Generate action | Removes the preview overlay/badge first (`editor._toolCleanup()`), then creates one real page per slice per image (rows × cols × image count), each correctly cropped via the Canvas API (`drawImage` source-rect slicing) and placed full-bleed or with margin/border as configured. | [ ] |
| 24.11 | Generate button state | Disabled while `state.images` is empty; shows a spinning icon + "Generating…" label during generation, restores to normal afterward. | [ ] |
| 24.12 | Switching away before generating | Clicking any other sidebar tool calls `restoreOriginalCanvas()`, which invokes this tool's `_toolCleanup` (removing the overlay + badge) and clears `editor._toolCleanup` — no leftover overlay/badge remains on the canvas. | [ ] |

---

## 25. Export (PDF / PNG / JPG)

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 25.1 | Export to PNG (single page) | Downloaded PNG strictly reflects the page bounds, respects layering (z-index), and has no severe aliasing (good DPI). | [ ] |
| 25.2 | Export to PDF (no variables) | PDF renders every page with exact margins and sheet size matching the configured page size. | [ ] |
| 25.3 | Export to PDF (with variable generation) | If the page has sequential numbering (1–10 via Agenda repeat count or a variable binding), the generated PDF iterates all repetitions with the number/value updated sequentially per page, keeping dimensions consistent. | [ ] |
| 25.4 | Export a document containing panel-generated pages | A document mixing Calendar-generated sheets, Gerador-generated album pages, and Image-Slicer-generated pages all export correctly together in one PDF/PNG pass. | [ ] |

---

## 26. Mobile-Specific Behavior

| Step | Test Action | Expected Result | Status |
|---|---|---|---|
| 26.1 | Tap-to-add (canvas-element tools) | On mobile, tapping a draggable tool button (Text, Image, Album, QR Code, Barcode, Mini Calendar, Emoji Kitchen, Emoji, Shape, Variable Content, Curved Text, Stamp, Icon) places the element centered on the first visible page instead of requiring drag-and-drop. | [ ] |
| 26.2 | Mobile element panel | Selecting an element on mobile shows `MobileToolbar`'s per-element mini-panel instead of the desktop right-panel. | [ ] |
| 26.3 | Mobile menu toggle | Hamburger icon opens/closes the sidebar overlay; icon glyph toggles between `menu`/`close`. | [ ] |
| 26.4 | Panel-only tools on mobile | Confirm current behavior (documented gap): Agenda/Calendar/Gerador/Image Slicer are not specially wired into `MobileToolbar.ts` — note whether opening them on mobile is usable or needs a follow-up fix. | [ ] |
| 26.5 | Mobile footer shows every tool | Open the app on mobile and scroll the bottom footer horizontally. | Every tool registered in `ToolRegistry` appears (Papéis, Título, Texto, Conteúdo Variável, Imagem, Álbum, Fatiador, Texto em Curva, Carimbo, Calendário, Mini Calendário, Emoji Kitchen, QR Code, Código de Barras, Emojis, Forma, Ícones — plus Nova Página/Exportar PDF/Exportar PNG actions), not just a hardcoded subset of ~5. | [ ] |
| 26.6 | Mobile footer icons match the desktop sidebar | Compare every tool's icon in the mobile footer against its entry in the desktop sidebar (`#sidenav-nav-list`). | Icons match exactly for every tool — no mismatched/generic Material Symbol standing in for the real one (previously wrong for Papéis, Gerador, Exportar Agenda, Álbum, Texto em Curva, Carimbo, Mini Calendário, Código de Barras, Ícones). | [ ] |
| 26.7 | Mobile footer labels match the desktop sidebar | Compare every tool's label text in the mobile footer against the desktop sidebar. | Labels show real translated text in every language — no raw i18n key visible as literal text (previously happened for Forma, Ícones, QR Code, Calendário, Papéis, Emojis, since those `ToolRegistry` labels pointed at nonexistent or wrong translation keys). | [ ] |
| 26.8 | Panel-only tool panel titles also fixed | On desktop, open Calendário, Gerador, and Papéis from the sidebar. | Each panel's title bar shows correctly translated text (same underlying `ToolRegistry.label` fix as 26.7 — these tools' titles were affected too, not just the mobile footer). | [ ] |
| 26.9 | Simplified mobile header | Open the app on mobile and inspect the top header bar. | Shows only the favicon (not the full logo), zoom controls, and a "⋮" overflow-menu button — undo/redo/history/theme/language controls are grouped inside the overflow menu instead of cluttering the main header row. | [ ] |
| 26.10 | Mobile header overflow menu | Tap the "⋮" button in the mobile header. | A dropdown opens containing Undo, Redo, History, Theme toggle, and Language select; tapping outside or selecting an item closes it. | [ ] |
| 26.11 | Setup size-picker back button | Open Setup → size selection screen on mobile (or desktop). | The back button has a subtle, well-positioned style (not overlapping/awkwardly placed as before) — left-aligned above the size grid, not absolutely positioned over content. | [ ] |
| 26.12 | Footer switches to per-element tools on tap | On mobile, tap a canvas element to select it. | The bottom footer switches from the tool list to that element's property mini-panel buttons (regression: this previously silently no-op'd because `MobileToolbar.init(this)` was never called after the JS→TS migration). | [ ] |
| 26.13 | Ctx-bar position on mobile | On mobile, select an element. | The ctx-bar appears near the element (below it, same as desktop — see 6.13), not stuck behind/underneath the bottom footer bar. | [ ] |
| 26.14 | Auto-scroll to newly created element | On mobile, tap a draggable tool to create a new element (not select an existing one). | The canvas auto-scrolls/centers on the newly created element, the same way it already does when selecting an existing element. | [ ] |

---

## 27. Regression Checklist — Previously Fixed Bugs

This section re-verifies specific regressions found and fixed in past sessions. Every row should be a **hard pass** — any failure here is a reintroduced bug, not a new one.

| Step | Regression | Test Action | Expected Result | Status |
|---|---|---|---|---|
| 27.1 | `createElement is not a function` (13 tools) | Create one element of each type: Text (title+paragraph), Image, QR Code, Barcode, Shape, Icon, Emoji, Emoji Kitchen, Mini Calendar, Curved Text, Stamp, Paper, Variable Content. | Every single one creates successfully with no console error — this was the original "Purge legacy JS" regression affecting all 13 canvas-element tools. | [ ] |
| 27.2 | Panel-only tools missing `setup()` | Click each of: Agenda, Calendar, Gerador, Image Slicer, Album in the sidebar. | Every panel opens correctly — none throw `Cannot read properties of undefined (reading 'bind')` from `Editor.ts`'s `PANEL_SETUP_MAP`. | [ ] |
| 27.3 | `editor.restoreOriginalCanvas` no-op | Open Calendar Generator or Gerador (which override `#main-page`), then click any other tool. | The original page content is restored — `restoreOriginalCanvas` was previously never assigned on the editor instance, making this call a silent no-op. | [ ] |
| 27.4 | `_toolCleanup` hook not invoked | Open Image Slicer, upload an image (overlay+badge appear), then click any other tool without generating. | The slicer overlay and its floating badge both disappear — previously `_toolCleanup` was set by the tool but never read/invoked by `Editor.ts`. | [ ] |
| 27.5 | `gerador-canvas-badge` not removed on restore | Open Calendar Generator or Gerador (badge appears), switch to another tool. | The floating "Preview" badge disappears — previously only the page content was restored, leaving the badge stuck on screen. | [ ] |
| 27.6 | Silent "regenerate" events (no listener) | Edit any panel field for: Shape, Icon, Mini Calendar, Curved Text, Stamp, QR Code. | The rendered SVG/element updates immediately — these tools previously dispatched unlistened custom events (`craftools-shape-regenerate`, etc.) instead of calling their regenerate function directly. | [ ] |
| 27.7 | Barcode bogus format list | Open the Barcode format dropdown. | Only "Code 39" and "EAN-13" are listed — `code128`/`ean8`/`upc`/`itf14` (which the renderer never implemented) are gone. | [ ] |
| 27.8 | Mini Calendar display-mode mismatch | Open the Mini Calendar display-mode dropdown. | All 7 real modes are listed (`diasSemana`, `calendario`, `header`, `holidaysBox`, `moonBox`, `completo1`, `completo2`) — the old list (`mes`/`semana`/`mini`/`lista`) that silently fell back to `completo1` regardless of selection is gone. | [ ] |
| 27.9 | Missing QR `spotifyBarColor` field | Set QR Code payload type to Spotify. | A "Code color" (Black/White) select is present and controls the scannable's bar color — this field previously existed in the meta type but had no panel control. | [ ] |
| 27.10 | Variable-binding gaps | Open the panel for Barcode, QR Code, and Variable Content. | All three expose a working "Bind to variable" section (`variableBindingSection()`), not just some of them. | [ ] |
| 27.11 | Missing translation keys | Switch language to EN and ES while every tool's panel (including the 4 panel-only tools) is open in turn. | No raw translation keys (e.g. literal text like `agendaExportTool.panelTitle`) are visible anywhere in any panel. | [ ] |
| 27.12 | Dead `PaperMeta.pageCount` field | Inspect a Paper element's `_craftoolsMeta` in DevTools. | `pageSettings` only contains `showPageNumber` — no `pageCount` field remains; `showPageNumber` still toggles correctly. | [ ] |
| 27.13 | Business-card image sync bug | In Album wizard, Business Card mode, replace the photo in one linked cell. | All linked sibling cells sharing that `_craftoolsMeta` update in sync. | [ ] |
| 27.14 | Business-card delete-only-first-slot bug | In Album wizard, Business Card mode with multiple photo slots, delete a photo from a slot other than the first. | Only the targeted slot's photo is removed; other slots are unaffected. | [ ] |
| 27.15 | Auto-fit toggle default-on bug | Create a new Text or Variable Content element. | Auto-fit starts **off** by default (must be explicitly enabled), not on. | [ ] |
| 27.16 | Auto-fit size reverting on drag | Enable Auto-fit on a text element, then drag-resize it. | The manually-set size is respected and does not snap back to the auto-fit computed size mid-drag. | [ ] |
| 27.17 | Mini Calendar gap/centering in Variable Content preview | Bind a Variable Content element to a `miniCalendar` variable. | The calendar card renders without an unwanted top gap, and its title bar height/centering look correct (not inflated by literal whitespace). | [ ] |
| 27.18 | Mobile panel appeared as a broken sliver by default | Open the app fresh on mobile without selecting anything. | No stray/misconfigured `.craftools-panel.sidenav-panel` sliver is visible — legacy bottom-sheet CSS rules that conflicted with the current panel design have been removed. | [ ] |
| 27.19 | ToolRegistry label/icon drift from the desktop sidebar | See 26.6/26.7/26.8 above. | Fixed for: Papéis, Gerador, Exportar Agenda, Álbum, Texto em Curva, Carimbo, Calendário, Mini Calendário, QR Code, Código de Barras, Emojis, Forma, Ícones. | [ ] |
| 27.20 | Emoji Kitchen's own tool icon wrong everywhere | See 12.6/26.6 above. | Fixed — now shows the live combo thumbnail on both desktop and mobile. | [ ] |
| 27.21 | Properties panel stuck open after delete/deselect | See 6.8/6.9 above. | Fixed — the panel now closes correctly in both cases. | [ ] |
| 27.22 | QR Code / Barcode / Variable Content border fields were a silent no-op | See 6.22 above. | Fixed — border width/style/color now actually paint on all three tools (previously stored in state/meta but never applied to any DOM node). | [ ] |
| 27.23 | Text/Variable Content/Curved Text font-change dropped emoji color rendering | See 7.10/7.11 above. | Fixed — `withEmojiFallback()` is now used consistently at element creation *and* on every subsequent font change across all three tools. | [ ] |

---

## 28. General Regression Notes

- Always check that the DevTools Console is clean (no red errors) after heavy navigation between tool panels — especially after switching rapidly between panel-only tools (Agenda/Calendar/Gerador/Image Slicer/Album), since these are the ones that mutate `#main-page` directly.
- During drag/drop/zoom stress testing, memory usage should stay stable; noticeable slowdown after 30+ cloned elements indicates a listener leak.
- When testing panel-only tools, always verify the **live preview** (Calendar Generator, Gerador) or **overlay** (Image Slicer) is fully torn down when leaving the tool — a lingering preview/overlay/badge is the signature symptom of the `restoreOriginalCanvas`/`_toolCleanup` regression class documented in Section 27.
- After any `tsc`/`vite build` pass during development, a clean build does **not** guarantee these manual behaviors are correct — TypeScript catches type errors, not silently-unwired event handlers (see rows 27.3–27.6, all of which compiled cleanly while being fully broken at runtime).
