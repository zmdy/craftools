# PDF Generation Architecture Report

**Date:** 2026-08-04  
**Status:** Analysis Complete — Ready for Implementation

---

## Executive Summary

After researching three possible routes, the **SVG→PDF pipeline is the clear winner** for Craftools.
The system already has a mature, production-ready HTML→SVG pipeline in `AgendaSvgExport.ts`
(using `@tooooools/html-to-svg`). Adding `svg2pdf.js` + `jsPDF` converts that SVG output into a
proper PDF with real vector content — no `window.print()`, no browser dialog, direct `.pdf`
file download.

> **Critical:** The CMYK question is addressed in full in Section 5.
> True DeviceCMYK requires a dedicated conversion phase — this document details exactly what
> is and is not possible in the browser, and the three concrete options available.

---

## 1. The Three Routes Evaluated

### Route A — Raster (html2canvas → jsPDF)

```
craftools-page → html2canvas (screenshot) → JPEG/PNG → jsPDF embed → .pdf
```

**Pros:** Captures every CSS effect pixel-perfectly. Simple to implement.
**Cons:** Text is a bitmap image — not selectable, not scalable. Large file size.
**Verdict:** Good as a secondary fallback mode.

---

### Route B — Element-by-element mapping (@cantoo/pdf-lib)

```
each craftools-element → parse meta → drawText() / drawSvgPath() / drawImage() → @cantoo/pdf-lib → .pdf
```

**Pros:** Real PDF text (selectable). Smallest file. Native CMYK color control per vector element.
**Cons:** Requires implementing 15+ per-type adapters. Cannot replicate many CSS effects. 2–3 weeks of work.
**Verdict:** Best long-term target, but too complex for Phase 1. Suitable for Phase 3+.

---

### Route C — SVG → PDF via svg2pdf.js (RECOMMENDED)

```
craftools-page
    │
    ▼ @tooooools/html-to-svg (ALREADY IN THE PROJECT — v1.17.1)
    │   - Text → <path> outlines via Opentype.js (no font dependency in PDF)
    │   - Images → base64 <image> elements
    │   - Gradients, clips, rotations, borders all handled
    │   - All edge cases already worked around in AgendaSvgExport.ts
    │
    ▼ svg2pdf.js v2.7.0 (yWorks, actively maintained)
    │   - Takes SVGElement → jsPDF vector commands
    │   - Paths, images, gradients, clip-paths, transforms: all supported
    │   - Works perfectly with html-to-svg output (text already paths = no font issues)
    │
    ▼ jsPDF v2.5.1 (actively maintained)
    │   - Custom page sizes in mm
    │   - Multi-page document
    │   - Direct save() to file download
    │
    ▼ .pdf download (no browser dialog)
```

**Pros:**
- Reuses 95% of existing `AgendaSvgExport.ts` infrastructure (preprocessing, font loading, border fix)
- Works for BOTH regular pages AND agenda without duplicating logic
- True vector quality — shapes and text paths are infinitely scalable
- No per-element-type code — works generically via the SVG intermediate
- All known edge cases (emoji, gradient text, external images) already handled

**Cons:**
- Text is NOT selectable (vectorized to path outlines) — same as raster, but at infinite resolution
- Fonts must be WOFF1/TTF/OTF (not WOFF2) — already solved in existing code
- box-shadow and transform:skew not supported by html-to-svg — confirmed not used in Craftools

**Verdict: Best route. Implement this first.**

---

## 2. Library Status

| Library | Version | Maintained | Role |
|---|---|---|---|
| `@tooooools/html-to-svg` | 1.17.1 | ✅ Active, ALREADY INSTALLED | HTML → SVG |
| `svg2pdf.js` | 2.7.0 | ✅ Active (yWorks) | SVG → jsPDF vector |
| `jspdf` | 2.5.1 | ✅ Active | PDF assembly + download |
| `@cantoo/pdf-lib` | 2.7.1 | ✅ Active (Phase 2+) | Page boxes, OutputIntent, crop marks |
| `lcms-wasm` | latest | ✅ Active (Phase 2 CMYK) | ICC-accurate sRGB→CMYK conversion |

---

## 3. What @tooooools/html-to-svg Produces

The library is already deeply integrated for Agenda SVG export. Its output:

- **Text:** Converted to `<path d="...">` outlines via Opentype.js — identical to screen, no PDF font embedding needed
- **Images:** Embedded as `<image href="data:image/png;base64,...">` — works perfectly with svg2pdf.js
- **Backgrounds/shapes:** `<rect>` with fill colors, gradients as SVG `<linearGradient>/<radialGradient>`
- **Borders:** Custom overlay system (`_extractClippedBorders` / `_drawBorderOverlays`) handles the overflow:hidden clipping bug
- **Emoji:** Pre-rasterized to PNG canvas before SVG render (Pass 1)
- **Gradient text:** Pre-rasterized via html2canvas before SVG render (Pass 4)
- **External images:** Pre-inlined as base64 before SVG render (Pass 3)
- **SVG dimensions:** Pixel units derived from page CSS (e.g. 210mm → 793.7px at 96dpi)

The SVG output from html-to-svg is an ideal input to svg2pdf.js — paths, images, and standard shapes, no custom fonts.

---

## 4. How svg2pdf.js Works with the SVG Output

svg2pdf.js (v2.7.0) feature support matrix:

| SVG Feature | Support | Notes |
|---|---|---|
| `<path d="...">` | Full | All SVG path commands: M, L, C, Q, A, Z |
| `<image href="data:...">` | Full | Base64 PNG/JPEG decoded via doc.addImage() |
| `<linearGradient>/<radialGradient>` | Partial | Works; slight artifacts with percentage coords |
| `<clipPath>` | Moderate | Works for simple shapes |
| `<g transform="...">` | Full | matrix, translate, rotate, scale, skewX/Y |
| `<rect>`, `<circle>`, `<ellipse>` | Full | All basic shapes |
| `<text>/<tspan>` | N/A | html-to-svg already converts text to paths |
| SVG filters | None | Not emitted by html-to-svg anyway |

**Critical insight:** Because `@tooooools/html-to-svg` pre-vectorizes ALL text to `<path>` outlines,
`svg2pdf.js` never encounters a font lookup problem. Every element is already a path or a base64 image.

---

## 5. CMYK — The Full Technical Picture

> This section is critical for print production decisions.

### 5.1 The Fundamental Browser Limitation

**The browser operates 100% in sRGB.** This is a platform-level constraint, not a library limitation.
Every web API — Canvas, CSS, WebGL, html2canvas, html-to-svg, svg2pdf.js, jsPDF, and pdf-lib —
produces sRGB colors. There is no native DeviceCMYK pathway in any web API today.

This means: regardless of which PDF generation route is chosen, the base color data in the PDF
will be sRGB unless explicit conversion is applied.

### 5.2 What Each Route Delivers

| Route | Colors in PDF | Is it real CMYK? | Notes |
|---|---|---|---|
| html2canvas → jsPDF | JPEG sRGB embedded | ❌ No | Pixel bitmap, sRGB JPEG XObject |
| html-to-svg → svg2pdf.js → jsPDF | Paths with hex RGB colors | ❌ No | Vector paths, RGB values |
| + OutputIntent (FOGRA39) | RGB + ICC profile declaration | ⚠️ Partial | See Section 5.3 |
| + lcms-wasm ICC conversion | DeviceCMYK in rasterized streams | ✅ Yes (rasterized) | TAC-controlled, ICC-accurate |
| @cantoo/pdf-lib direct cmyk() | DeviceCMYK per vector element | ✅ Yes (simplified) | Mathematical formula, not ICC |

---

### 5.3 The OutputIntent "Trick" — What It Is and What It Is NOT

Adding a `CoatedFOGRA39` OutputIntent to the PDF:

```typescript
// This declares intent — does NOT convert colors
pdfDoc.catalog.set(PDFName.of('OutputIntents'), pdfDoc.context.obj([{
  Type: 'OutputIntent',
  S: 'GTS_PDFX',
  OutputConditionIdentifier: PDFString.of('Coated FOGRA39'),
  DestOutputProfile: iccProfileRef,  // the ICC binary
}]));
```

**What this does:**
- Embeds the ICC profile binary in the PDF
- Declares: "when printing this file, use FOGRA39 to convert colors"
- Makes the PDF compliant with **PDF/X-4**
- Adobe Acrobat shows an output intent in the document properties

**What this does NOT do:**
- It does **not** convert any color values in the file
- The PDF `<path>` elements still contain RGB: `fill="rgb(255, 0, 0)"`
- `Preflight` and `pitstop` in a print shop will still flag the file as **DeviceRGB**
- Does not satisfy **PDF/X-1a**, which mandates native DeviceCMYK throughout

**Accepted by:**
- ✅ Modern digital print shops (Fiery/EFI RIP, HP Indigo, Xerox iGen)
- ✅ Wide-format inkjet print shops
- ✅ Online print platforms (Vistaprint, Printify, Printful)
- ❌ Traditional offset print shops with strict prepress workflows
- ❌ Newspaper/packaging production (PDF/X-1a required)

---

### 5.4 True DeviceCMYK Conversion via lcms-wasm

For real DeviceCMYK output, every color value in the PDF must be converted from sRGB
to CMYK using an ICC profile, respecting **TAC (Total Area Coverage)** limits.

#### Why math formulas are dangerous

The naive formula `K = 1 - max(R,G,B)` produces:
```
pure black (0,0,0) → C=100% M=100% Y=100% K=100% = 400% TAC
```

400% TAC tears paper on offset presses and smears ink. Standard offset limits are 280–330% TAC.
This is why ICC profiles exist — they encode the correct mapping per ink set and paper type.

#### The correct conversion (lcms-wasm)

```typescript
// Web Worker (doesn't block the main thread)
import lcms from 'lcms-wasm';

const instance = await lcms();
const srgbProfile  = instance.cmsOpenProfileFromMem(sRGB_icc_bytes);
const fogra39Profile = instance.cmsOpenProfileFromMem(CoatedFOGRA39_icc_bytes);

const transform = instance.cmsCreateTransform(
  srgbProfile,   instance.TYPE_RGB_8,
  fogra39Profile, instance.TYPE_CMYK_8,
  instance.INTENT_PERCEPTUAL,
  instance.cmsFLAGS_BLACKPOINTCOMPENSATION  // ← critical for correct K channel
);

// Convert an entire rasterized page pixel buffer
const cmykBuffer = new Uint8Array(pixelCount * 4);
instance.cmsDoTransform(transform, rgbBuffer, cmykBuffer, pixelCount);
// cmykBuffer now contains DeviceCMYK values with FOGRA39 TAC compliance built in
```

For **vector paths** (text outlines, shapes): extract the hex color, convert each individual
color point through the same ICC transform (treating it as a 1-pixel buffer), write the resulting
CMYK tuple as a PDF `DeviceCMYK` color operator.

**ICC Profiles needed (free download from eci.org):**
- `sRGB_v4_ICC_preference.icc` — source profile
- `CoatedFOGRA39.icc` — destination (ISO 12647-2:2004, CMYK offset, coated paper)
- `UncoatedFOGRA29.icc` — alternative for uncoated paper
- `ISOcoated_v2_eci.icc` — alternative for ISO Coated v2

---

### 5.5 CMYK for Vector Elements (@cantoo/pdf-lib)

When drawing vector paths natively via `@cantoo/pdf-lib` (Route B / Phase 3), CMYK colors
can be written directly into the PDF stream:

```typescript
import { cmyk, PDFDocument } from '@cantoo/pdf-lib';

page.drawRectangle({
  x: 50, y: 50, width: 200, height: 100,
  color: cmyk(0.0, 1.0, 0.99, 0.0),     // Pantone Red approximation
  borderColor: cmyk(0.0, 0.0, 0.0, 1.0), // Registration Black
});
```

The `cmyk()` helper writes a `DeviceCMYK` PDF color space directly.
However, the C/M/Y/K values must come from a proper ICC conversion, not from a formula.
A simplified conversion function using only math (no ICC) produces inaccurate results for
mid-tone colors, skin tones, and neutrals.

---

### 5.6 The Three Concrete Options

#### Option 1 — sRGB + OutputIntent (Phase 1, quick — ~1 extra day)

```
SVG pipeline → jsPDF → post-process with @cantoo/pdf-lib → inject OutputIntent → .pdf download
```

- Colors remain sRGB in the file
- FOGRA39 ICC profile embedded as OutputIntent
- PDF/X-4 compliant
- Printer's RIP converts at job time using correct ICC math
- **Accepted by: modern digital print shops, online print platforms, HP Indigo, Xerox iGen**
- **Not accepted by: strict prepress offset workflows demanding PDF/X-1a**

#### Option 2 — Full DeviceCMYK via lcms-wasm (Phase 2 — ~1–2 weeks)

```
SVG pipeline → jsPDF → post-process with @cantoo/pdf-lib
    → for rasterized elements: lcms-wasm Web Worker sRGB→CMYK pixel conversion
    → for vector paths: extract hex color → lcms-wasm single-pixel transform → cmyk() values
    → PDF/X-1a compliant
```

- Colors are DeviceCMYK throughout
- TAC capped at 330% by FOGRA39 profile
- Text outlines (from html-to-svg) stored as CMYK vector paths
- Embedded images stored as raw FlateDecode DeviceCMYK streams
- **Accepted by: all print shops including strict offset prepress**

#### Option 3 — Server-side conversion (most reliable — requires backend)

```
Client generates sRGB PDF → upload to server → Ghostscript / callas pdfToolbox → DeviceCMYK PDF → download
```

```bash
# Ghostscript server-side conversion example
gs -dBATCH -dNOPAUSE -sDEVICE=pdfwrite    -sColorConversionStrategy=CMYK    -dProcessColorModel=/DeviceCMYK    -dCompatibilityLevel=1.4    -sOutputFile=output_cmyk.pdf input_srgb.pdf
```

- 100% reliable ICC conversion
- No browser limitations
- Standard in the industry: Canva, Visme, Miro, Adobe Express all do server-side conversion
- **Requires a backend endpoint** (Node.js + Ghostscript, or a microservice)
- **Best for production-grade prepress**

---

### 5.7 Decision Matrix by Target Print Shop

| Print Shop Type | Minimum Requirement | Recommended Option |
|---|---|---|
| Online platform (Vistaprint, Printify) | sRGB PDF accepted | Option 1 (OutputIntent) |
| Digital print shop (HP Indigo, Xerox) | PDF/X-4 or sRGB with OutputIntent | Option 1 (OutputIntent) |
| Wide-format inkjet | sRGB accepted | Option 1 (OutputIntent) |
| Traditional offset (litho) | PDF/X-1a, DeviceCMYK | Option 2 or 3 |
| Newspaper production | PDF/X-1a, DeviceCMYK | Option 3 (server-side) |
| Packaging / label printing | PDF/X-1a, DeviceCMYK | Option 3 (server-side) |

---

## 6. Proposed Architecture

### New Files

**`craftools/utils/SvgPageRenderer.ts`** (shared core)
- Extracts page preprocessing and SVG rendering logic from `AgendaSvgExport.ts`
- Exposes: `renderPageToSvg(pageEl, size, renderer): Promise<SVGSVGElement>`

**`craftools/utils/PdfVectorExport.ts`** (new orchestrator)
- For regular pages: clones + flattens via `PdfExport._flattenElement()`
- For agenda: calls `AgendaExport.buildFlattenedOutputPages()`
- Renders each page via `SvgPageRenderer`
- Converts each SVG to a jsPDF page via svg2pdf.js
- Post-processes with @cantoo/pdf-lib for page boxes + OutputIntent
- Saves as .pdf download

**`craftools/utils/PdfCmykConverter.ts`** (Phase 2 — CMYK)
- Web Worker wrapping lcms-wasm
- Exposes: `convertPixelBuffer(rgb: Uint8Array): Promise<Uint8Array>`
- Exposes: `convertHexColor(hex: string): { c: number, m: number, y: number, k: number }`

**`craftools/utils/PdfExportDialog.ts`** (export dialog UI)
- Mode: Vector (SVG-based) / Raster (high-res image)
- CMYK toggle: sRGB+OutputIntent / DeviceCMYK (Phase 2)
- Crop marks toggle, bleed size input
- Passes selection to `PdfVectorExport`

### Modified Files

**`craftools/utils/AgendaSvgExport.ts`**
- Delegates preprocessing to shared `SvgPageRenderer.ts`
- SVG export path unchanged; PDF path added via `PdfVectorExport`

**`craftools/components/Editor.ts`**
- New export button → `PdfVectorExport.exportPages()`

**`craftools/tools/agenda/AgendaExportTool.ts`**
- New "PDF Vetorial" button → `PdfVectorExport.exportAgenda()`

---

## 7. Packages to Install

### Phase 1 — SVG→PDF pipeline + sRGB OutputIntent

```bash
npm install jspdf svg2pdf.js
npm install @cantoo/pdf-lib     # for OutputIntent injection + page boxes
```

### Phase 2 — Full DeviceCMYK

```bash
npm install lcms-wasm
```

ICC profiles needed (free, from eci.org):
- `CoatedFOGRA39.icc` (~580 KB) — coated paper, ISO 12647-2
- `UncoatedFOGRA29.icc` (~580 KB) — uncoated paper

Store under `public/profiles/` and fetch on demand.

**Bundle impact — all dynamically imported:**

| Package | Size | Import strategy |
|---|---|---|
| `jspdf` | ~300 KB | Dynamic import on export action |
| `svg2pdf.js` | ~150 KB | Dynamic import on export action |
| `@cantoo/pdf-lib` | ~2 MB | Dynamic import on export action |
| `lcms-wasm` (Phase 2) | ~500 KB WASM | Dynamic import in Web Worker only |
| `CoatedFOGRA39.icc` (Phase 2) | ~580 KB | Static asset, fetched and cached |

**Total impact on initial page load: zero** (all lazy-loaded).

---

## 8. Print-Ready Page Geometry

For prepress-compliant PDF files, the page geometry must include:

```
+──────────────────────────────────────────────────+  ← MediaBox (total sheet)
|  Crop marks (hairlines, 0.25pt, Registration Black)
|  +──────────────────────────────────────────+     |
|  |          ← BleedBox (+3 mm bleed)        |     |
|  |  +────────────────────────────────────+  |     |
|  |  |       ← TrimBox (final cut size)   |  |     |
|  |  |  +──────────────────────────────+  |  |     |
|  |  |  |  ← ArtBox (safe content area)|  |  |     |
|  |  |  +──────────────────────────────+  |  |     |
|  |  +────────────────────────────────────+  |     |
|  +──────────────────────────────────────────+     |
+──────────────────────────────────────────────────+
```

```typescript
// @cantoo/pdf-lib post-processing
const mmToPt = (mm: number) => mm * 2.83464567;
const trim = { w: mmToPt(210), h: mmToPt(297) };
const bleed = mmToPt(3);   // 3mm bleed
const marks = mmToPt(10);  // 10mm for crop mark arms

page.setMediaBox(0, 0, trim.w + 2*(bleed+marks), trim.h + 2*(bleed+marks));
page.setBleedBox(marks, marks, trim.w + 2*bleed, trim.h + 2*bleed);
page.setTrimBox(marks+bleed, marks+bleed, trim.w, trim.h);
```

Crop marks: Registration Black = `cmyk(1.0, 1.0, 1.0, 1.0)` — prints on all ink plates.

---

## 9. What Cannot Be Replicated

| CSS Feature | html-to-svg support | Strategy |
|---|---|---|
| `box-shadow` | ❌ Not supported | Confirmed not used in Craftools |
| `text-decoration` | ❌ Not supported | Acceptable gap |
| `transform: skew()` | ❌ Not supported | Not used in Craftools |
| `backdrop-filter` | ❌ Not supported | Not used in Craftools |
| `background-clip: text` (gradient) | ❌ Not rendered | Pre-rasterized via html2canvas (Pass 4, already implemented) |
| Emoji color fonts | ❌ Not supported | Pre-rasterized via Canvas API (Pass 1, already implemented) |

---

## 10. Implementation Phases

### Phase 1 — Vector PDF via SVG pipeline (~1 week)

1. `npm install jspdf svg2pdf.js @cantoo/pdf-lib`
2. Create `SvgPageRenderer.ts` (extract from `AgendaSvgExport.ts`)
3. Create `PdfVectorExport.ts`:
   - Regular pages: flatten → SVG → svg2pdf.js → jsPDF
   - Agenda pages: existing pipeline → svg2pdf.js → jsPDF
4. Post-process with @cantoo/pdf-lib: TrimBox, BleedBox, MediaBox, OutputIntent (FOGRA39)
5. Create `PdfExportDialog.ts` with mode/bleed/crop marks options
6. Wire up in `Editor.ts` and `AgendaExportTool.ts`
7. **Result:** Direct .pdf download, no browser dialog, vector quality, sRGB + OutputIntent

### Phase 2 — Full DeviceCMYK (~1–2 weeks)

1. `npm install lcms-wasm`
2. Download CoatedFOGRA39.icc + UncoatedFOGRA29.icc, place in `public/profiles/`
3. Create `PdfCmykConverter.ts` Web Worker:
   - Load sRGB.icc + target profile via lcms-wasm
   - Convert rasterized pixel buffers (images, emoji, gradient-text PNGs)
   - Convert vector hex colors (path fills, strokes)
4. Re-write converted CMYK data into PDF streams via @cantoo/pdf-lib
5. Set PDF/X-1a metadata
6. Add CMYK toggle to export dialog
7. **Result:** True DeviceCMYK PDF, PDF/X-1a compliant

### Phase 3 — Element-by-element native PDF (~2–3 weeks)

1. Create `PdfElementRenderer.ts` with per-type handlers
2. Title/Paragraph: `page.drawText()` + `@pdf-lib/fontkit` font embedding (selectable text)
3. Image: `embedJpg/embedPng()` + crop/zoom math
4. Shape: `drawSvgPath()` with ShapeGenerator output
5. Icon/QR/Barcode: `drawSvgPath()` / `drawRectangle()` from SVG DOM
6. Complex elements: raster fallback via html2canvas
7. **Result:** Selectable text in PDF, smallest file size

---

## 11. Final Decision Summary

| Topic | Decision |
|---|---|
| Primary PDF route (Phase 1) | html-to-svg → svg2pdf.js → jsPDF |
| Raster fallback mode | html2canvas → jsPDF |
| Agenda support | Same pipeline — reuses AgendaSvgExport preprocessing |
| Regular pages | Flatten via PdfExport._flattenElement() → same SVG pipeline |
| **Color space (Phase 1)** | **sRGB + CoatedFOGRA39 OutputIntent (PDF/X-4)** |
| **Color space (Phase 2)** | **DeviceCMYK via lcms-wasm ICC conversion (PDF/X-1a)** |
| **Color space (Phase 3)** | **Server-side Ghostscript (if backend is added)** |
| CMYK conversion method | lcms-wasm — ICC-accurate, TAC-controlled. NOT math formulas. |
| ICC profiles | CoatedFOGRA39 (coated) + UncoatedFOGRA29 (uncoated) — free from eci.org |
| Text in PDF | Path outlines (not selectable Phase 1–2) → real text Phase 3 |
| Phase 1 packages | `jspdf` + `svg2pdf.js` + `@cantoo/pdf-lib` |
| Phase 2 packages | `lcms-wasm` + ICC profile binaries |
| Phase 1 effort | ~1 week |
| Target print shops Phase 1 | Digital print, HP Indigo, online platforms |
| Target print shops Phase 2 | All including traditional offset prepress |
