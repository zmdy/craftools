# CrafTools — Test Battery

Complete manual test checklist. Run top to bottom on a fresh browser session (no localStorage) and again after a session restore. Check each box as you go.

---

## 1. Boot & PWA

| # | Test | Expected |
|---|------|----------|
| 1.1 | Open the app cold (no prior session) | Editor loads; empty canvas with one page |
| 1.2 | Open in Chrome → Install as PWA | Install prompt appears; standalone window opens correctly |
| 1.3 | With service worker cached, disable network and reload | App still loads from cache |
| 1.4 | Open on mobile (iOS Safari / Android Chrome) | Layout switches to mobile view; top toolbar collapses; hamburger menu appears |
| 1.5 | Open with an explicit `?mediaKey=album` config | Album mode activates; correct size config loads |

---

## 2. Session & Auto-save

| # | Test | Expected |
|---|------|----------|
| 2.1 | Add a text element, wait 30 s (autosave interval) | No visible flicker; session saved silently to `localStorage` |
| 2.2 | Add elements, close tab, reopen app | Recovery dialog or auto-restore loads the previous session |
| 2.3 | Add elements, close tab without waiting for autosave | Browser shows "unsaved changes" `beforeunload` warning |
| 2.4 | Start fresh session (clear `craftools-session` key in DevTools) | Canvas starts empty; no recovery prompt |
| 2.5 | Open two tabs simultaneously | Each tab maintains its own state; no cross-contamination |

---

## 3. Canvas & Zoom

| # | Test | Expected |
|---|------|----------|
| 3.1 | Click **Zoom In** (+) repeatedly | Canvas scales up in 10 % increments; label updates |
| 3.2 | Click **Zoom Out** (−) | Canvas scales down; stops at minimum (e.g. 10 %) |
| 3.3 | Click **Fit** button | Canvas resets to 100 % or fits viewport |
| 3.4 | Pinch-zoom on mobile | Canvas zoom follows gesture |
| 3.5 | Drag canvas background (no element selected) | Canvas pans; elements maintain relative positions |

---

## 4. Undo / Redo (HistoryManager)

| # | Test | Expected |
|---|------|----------|
| 4.1 | Add an element → click Undo | Element disappears; indicator shows `0/10` |
| 4.2 | Undo after adding 10+ actions | Stack saturates at 10; oldest state is silently dropped |
| 4.3 | Undo several steps → make a new action | Redo branch is cleared; counter resets forward history |
| 4.4 | Click Redo | Reverts undo; indicator increments |
| 4.5 | Undo/Redo with keyboard shortcut (Ctrl+Z / Ctrl+Y) | Same behavior as buttons |
| 4.6 | Undo when stack is empty | Button is disabled; no error thrown |

---

## 5. Page Tool

| # | Test | Expected |
|---|------|----------|
| 5.1 | Click **Add Page** | New page appended; canvas scrolls to it |
| 5.2 | Reorder pages by drag | Page order updates immediately |
| 5.3 | Clone a page | Duplicate appears with identical content |
| 5.4 | Delete a page | Page removed; adjacent page becomes active |
| 5.5 | Delete last remaining page | Action blocked or new blank page auto-created |
| 5.6 | Change paper size (A4, Letter, custom) | Canvas dimensions update; grid recalculates |
| 5.7 | Change background color | Page background updates in real time |
| 5.8 | Change background image (upload) | Image fills page; transform controls appear |
| 5.9 | Toggle grid | Grid lines appear/disappear on canvas |
| 5.10 | Smooth-scroll navigation between pages | No jump; animation is smooth |

---

## 6. Text Tool (Title / Paragraph)

| # | Test | Expected |
|---|------|----------|
| 6.1 | Double-click a text element to enter edit mode | Cursor appears; toolbar changes to text mode |
| 6.2 | Type text; click outside to confirm | Text saved; element resizes if auto-fit is on |
| 6.3 | Change font family (local + Google Fonts) | Font preview visible in dropdown; element updates |
| 6.4 | Upload a custom `.ttf`/`.otf` font | Font loads; appears in picker; element uses it |
| 6.5 | Change font size | Element updates in real time |
| 6.6 | Toggle Bold / Italic / Underline | Style applies immediately |
| 6.7 | Switch color mode → Solid | Color picker appears; element color changes |
| 6.8 | Switch color mode → Gradient | Angle input and two color pickers appear; gradient renders on text |
| 6.9 | Change text alignment (left / center / right / justify) | Text realigns inside element |
| 6.10 | Auto-fit enabled: type very long text | Font shrinks to fit element bounds |
| 6.11 | Auto-fit disabled: type long text | Text overflows or truncates; no auto-resize |

---

## 7. Image Tool

| # | Test | Expected |
|---|------|----------|
| 7.1 | Add image via file upload | Image renders in element; Source accordion shows filename |
| 7.2 | Add image via URL paste | Image loads from URL |
| 7.3 | Change mask shape (circle, rounded, custom SVG) | Image clips to selected mask |
| 7.4 | Adjust position within mask (drag or X/Y inputs) | Image repositions inside mask boundary |
| 7.5 | Apply brightness / contrast / saturation filter | Canvas updates in real time |
| 7.6 | Apply blur / grayscale / sepia | Effect visible on element |
| 7.7 | Flip horizontal / vertical | Transform applies; accordion shows correct state |
| 7.8 | Rotate image within element | Image rotates inside mask |
| 7.9 | Link two image elements (Business Card mode) | Changing photo on one propagates to linked sibling |
| 7.10 | Upload large image (>5 MB) | No freeze; loading indicator shown; image renders |

---

## 8. Icon Tool

| # | Test | Expected |
|---|------|----------|
| 8.1 | Open icon picker | Material Symbols pack loads; icons render in grid |
| 8.2 | Search by keyword | Results filter in real time |
| 8.3 | Filter by category | Only relevant icons shown |
| 8.4 | Select an icon | Element created on canvas with selected icon |
| 8.5 | Change icon color (fill) | Element color updates |
| 8.6 | Change icon via "Change icon" button in properties | Picker reopens; new selection replaces current |
| 8.7 | Scale icon element | SVG scales without pixelation |

---

## 9. Shape Tool

| # | Test | Expected |
|---|------|----------|
| 9.1 | Add a rectangle | Shape renders with default style |
| 9.2 | Add a circle, triangle, star, etc. | Each shape renders correctly |
| 9.3 | Change fill color | Shape fill updates |
| 9.4 | Change stroke color and width | Border updates in real time |
| 9.5 | Change corner radius (rectangle) | Corners round smoothly |

---

## 10. QR Code Tool

| # | Test | Expected |
|---|------|----------|
| 10.1 | Enter a plain URL | QR code renders |
| 10.2 | Enter `spotify:track:<id>` URI | Parsed correctly; QR encodes Spotify deep-link |
| 10.3 | Change foreground / background color | QR colors update |
| 10.4 | Change error correction level | QR regenerates |
| 10.5 | Enter empty string | Graceful fallback; no crash |

---

## 11. Barcode Tool

| # | Test | Expected |
|---|------|----------|
| 11.1 | Generate EAN-13 barcode | Valid barcode renders |
| 11.2 | Generate Code128 | Renders correctly |
| 11.3 | Enter invalid barcode value | Error message shown; no crash |
| 11.4 | Change bar color | Updates in real time |

---

## 12. Calendar Tool

| # | Test | Expected |
|---|------|----------|
| 12.1 | Add calendar for current month | Full month grid renders with correct weekdays |
| 12.2 | Change month / year | Grid updates |
| 12.3 | Brazilian public holidays visible | Holidays marked on correct dates |
| 12.4 | Moon phases display | Phase icons on correct days |

---

## 13. Mini Calendar Tool

| # | Test | Expected |
|---|------|----------|
| 13.1 | Mode: Days table only | Compact grid without header |
| 13.2 | Mode: Full calendar | Header (month + year) + grid |
| 13.3 | Mode: Header only | Only month/year text renders |
| 13.4 | Mode: Holidays box | Only holiday list shown |
| 13.5 | Mode: Moon phases box | Only moon phase list shown |
| 13.6 | Mode: Calendar with holidays | Grid + holiday box combined |
| 13.7 | Mode: Full calendar with moon phases | Grid + moon phases combined |

---

## 14. Curved Text Tool (TextoCurvo)

| # | Test | Expected |
|---|------|----------|
| 14.1 | Add curved text element | SVG arc renders with default text |
| 14.2 | Edit text content | Arc text updates |
| 14.3 | Change arc radius | Curve tightens or loosens |
| 14.4 | Change font and color | Updates propagate to SVG |
| 14.5 | Flip to bottom arc | Text curves below the line |

---

## 15. Stamp / Seal Tool (Carimbo)

| # | Test | Expected |
|---|------|----------|
| 15.1 | Add a stamp element | Circular SVG stamp renders |
| 15.2 | Edit outer text (circle path) | Text follows circular path |
| 15.3 | Edit center text / icon | Updates in center area |
| 15.4 | Change colors | Stroke, fill, text colors update |
| 15.5 | Scale element | SVG scales without degradation |

---

## 16. Emoji Tool

| # | Test | Expected |
|---|------|----------|
| 16.1 | Open emoji picker | Native or custom emoji grid appears |
| 16.2 | Select an emoji | Element added to canvas |
| 16.3 | Emoji renders with Noto Color Emoji font | Color emoji visible on all platforms |
| 16.4 | Resize emoji element | No pixelation (text-based render) |

---

## 17. Emoji Kitchen Tool

| # | Test | Expected |
|---|------|----------|
| 17.1 | Select two emoji | Combined "kitchen" emoji image fetched from API |
| 17.2 | No API connection | Graceful error; no crash |
| 17.3 | Change tier filter | Only tier-appropriate combos shown |

---

## 18. Variable Content Tool

| # | Test | Expected |
|---|------|----------|
| 18.1 | Add variable content element | Placeholder text shown |
| 18.2 | Configure a variable (name, value) | Element renders the variable value |
| 18.3 | Change variable value via panel | Element updates in real time |
| 18.4 | Export with variable content | Variable values baked into export |

---

## 19. Album Tool

| # | Test | Expected |
|---|------|----------|
| 19.1 | Enter album mode | Grid layout renders; cell panels visible |
| 19.2 | Upload photos into cells | Photos fill cells with correct cropping |
| 19.3 | Reorder cells | Drag to swap; layout updates |
| 19.4 | Open API Picker | Modal opens; assets from API load in grid |
| 19.5 | Select asset from API Picker | Photo placed into active cell |
| 19.6 | Change cell background color | Cell background updates |

---

## 20. Image Slicer Tool

| # | Test | Expected |
|---|------|----------|
| 20.1 | Upload an image | Preview appears |
| 20.2 | Define slice grid (e.g. 3×3) | Grid overlay rendered on preview |
| 20.3 | Export slices | Individual image files downloaded |
| 20.4 | Change slice count | Grid updates in real time |

---

## 21. Agenda Export Tool

| # | Test | Expected |
|---|------|----------|
| 21.1 | Configure events | Event list populates |
| 21.2 | Export to PDF | PDF with agenda layout generated |
| 21.3 | Export to image | PNG/JPEG downloaded |

---

## 22. Element Interactions (Element.js)

| # | Test | Expected |
|---|------|----------|
| 22.1 | Drag element | Moves with cursor; snaps to grid/guides if SnapEngine active |
| 22.2 | Resize via handles | Element resizes; aspect ratio locked if shift held |
| 22.3 | Rotate via handle | Element rotates; angle shown |
| 22.4 | Select multiple elements (Shift+click or drag select) | All selected; shared properties editable |
| 22.5 | Align selected elements (left, center, right, top, middle, bottom) | Elements align correctly |
| 22.6 | Distribute evenly | Spacing equalized |
| 22.7 | Lock element | Element no longer draggable/resizable; lock icon shown |
| 22.8 | Unlock element | Interaction restored |
| 22.9 | Clone element (Ctrl+D or button) | Duplicate appears offset from original |
| 22.10 | Delete element (Delete key or button) | Element removed; undo restores it |
| 22.11 | Change Z-order (bring forward / send backward) | Layer order updates on canvas |
| 22.12 | In Business Card mode: delete linked element | Sibling deleted automatically |

---

## 23. Snap Engine

| # | Test | Expected |
|---|------|----------|
| 23.1 | Drag element near canvas center | Element snaps to center guide |
| 23.2 | Drag near another element's edge | Element snaps to sibling edge |
| 23.3 | Drag near page margin | Element snaps to margin |
| 23.4 | Snap guides visible | Red/blue guide lines appear during drag |
| 23.5 | Disable snap | Drag is free; no guides |

---

## 24. Export — Image (ImageExport)

| # | Test | Expected |
|---|------|----------|
| 24.1 | Export as PNG | Dialog opens; download starts; file opens correctly |
| 24.2 | Export as JPEG | JPEG file downloads; quality setting applied |
| 24.3 | Export at 2× resolution | File dimensions are double the canvas size |
| 24.4 | Export multi-page canvas | Each page exported as separate file (or combined) |
| 24.5 | Export with transparent background (PNG) | Background is transparent in downloaded file |

---

## 25. Export — PDF (PdfExport)

| # | Test | Expected |
|---|------|----------|
| 25.1 | Export single page as PDF | PDF downloads; content matches canvas |
| 25.2 | Export multi-page document | Each page becomes a PDF page |
| 25.3 | PDF includes custom fonts | Text renders with correct typeface |
| 25.4 | PDF includes images | Images embedded; not broken links |

---

## 26. i18n (Translations)

| # | Test | Expected |
|---|------|----------|
| 26.1 | Switch language to **English** | All UI labels, panel titles, and buttons change to English |
| 26.2 | Switch language to **Spanish** | All labels switch to Spanish |
| 26.3 | Switch back to **Portuguese (PT-BR)** | Reverts correctly |
| 26.4 | Open a tool panel and check all accordion labels | No `undefined` or raw i18n key visible anywhere |
| 26.5 | Check Editor toolbar labels (Undo, Redo, Zoom) | Translated in all 3 languages |
| 26.6 | Check export dialog labels | Fully translated |

---

## 27. API Backend (craftools_api)

### Authentication

| # | Test | Expected |
|---|------|----------|
| 27.1 | POST `/v1/phrases` without token | `401 Unauthorized` |
| 27.2 | POST with invalid token | `403 Forbidden` |
| 27.3 | POST with valid free-tier token | `200` with free-tier data only |
| 27.4 | POST with premium token | `200` with full data set |

### Phrases

| # | Test | Expected |
|---|------|----------|
| 27.5 | `GET /v1/phrases` | Returns paginated phrase list in JSON |
| 27.6 | Filter by collection | Returns only phrases in that collection |
| 27.7 | Filter by tier | Free token cannot see plus/premium phrases |

### Assets / Photos

| # | Test | Expected |
|---|------|----------|
| 27.8 | Upload a photo via `upload.php` | File saved; record created in DB |
| 27.9 | Upload link via `upload_link_photo.php` | URL saved; accessible via API |
| 27.10 | Delete an asset | Record removed; file deleted from disk |
| 27.11 | Asset visibility: free asset with free token | Returns asset |
| 27.12 | Asset visibility: premium asset with free token | Asset excluded from results |

### Emoji Kitchen

| # | Test | Expected |
|---|------|----------|
| 27.13 | `GET /v1/emoji-kitchen?left=1f600&right=1f4a5` | Returns matching combo or 404 |
| 27.14 | Import bulk emoji kitchen data | Records inserted; no duplicates |

### Admin Panel

| # | Test | Expected |
|---|------|----------|
| 27.15 | Login with wrong password | Redirect to login; session not created |
| 27.16 | Login with correct credentials | Dashboard loads |
| 27.17 | Dashboard stat cards load | Total users, tokens, phrases shown |
| 27.18 | API Logs tab loads | Stat cards (total, today, errors) and request table shown |
| 27.19 | Filter API logs by resource | Table filters correctly |
| 27.20 | Filter by date range | Only logs in range shown |
| 27.21 | Pagination in logs | Previous / Next work; page counter correct |
| 27.22 | Create a new API token | Token appears in list; copy button works |
| 27.23 | Revoke token | Token marked inactive; API rejects it immediately |

---

## 28. Security & Edge Cases

| # | Test | Expected |
|---|------|----------|
| 28.1 | Paste `<script>alert(1)</script>` into a text element | Script not executed; escaped in DOM |
| 28.2 | Upload a file with `.php` extension | Rejected by upload handler |
| 28.3 | Upload a 50 MB image | Size limit enforced; error message shown |
| 28.4 | CSRF: submit admin form from another origin | Token mismatch; request rejected |
| 28.5 | SQLite: submit `'; DROP TABLE phrases; --` in a filter | Prepared statement prevents injection |
| 28.6 | API: send malformed JSON body | `400 Bad Request`; server does not crash |

---

## 29. Performance Benchmarks (manual)

| # | Test | Expected |
|---|------|----------|
| 29.1 | Canvas with 50 elements | No noticeable lag when selecting/dragging |
| 29.2 | 10-page document | Page navigation stays smooth |
| 29.3 | Undo/redo with 10 deep history | Restore is instant (<100 ms) |
| 29.4 | Export 10-page PDF | Completes in <15 s |
| 29.5 | Open icon picker with full Material Symbols pack | Picker renders in <2 s |
| 29.6 | Load 100 phrases from API | Response time <500 ms |

---

## 30. Cross-browser

| # | Test | Expected |
|---|------|----------|
| 30.1 | Chrome (latest) | Full pass |
| 30.2 | Firefox (latest) | Full pass; Web Components polyfill not needed |
| 30.3 | Safari 16+ | Full pass; check `-webkit-background-clip: text` for gradients |
| 30.4 | Edge (latest) | Full pass |
| 30.5 | Mobile Safari (iOS 16+) | Layout correct; touch events work |
| 30.6 | Chrome for Android | Layout correct; touch events work |

---

_Last updated: 2026-07-14_
