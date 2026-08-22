/**
 * ImagePaletteExtractor.ts — "Extrair paleta da imagem": analyzes an <img>'s
 * pixels on an off-screen canvas and returns a short list of dominant colors
 * plus a couple of suggested gradients built from them. Client-side only, no
 * network call -- same off-screen-canvas approach ColorPickerUI.ts's
 * toHexColor() already uses for CSS-keyword resolution, just sampling a
 * whole image instead of a single fillStyle.
 *
 * Also exports renderExtractPalettePanel(), the one shared UI block (button
 * + result grid + "save as new palette" mini-flow) used by BOTH ImageTool.ts
 * (via the 'custom' field escape hatch) and CellPanel.ts's album image mode
 * (via plain DOM appendChild) -- see each call site for how it's wired in.
 * Saving routes into the same UserPalettes.ts store ColorPickerUI.ts's own
 * "Minhas paletas" section reads from, so an extracted palette shows up
 * everywhere a color can be picked, not just back in this panel.
 */

import { tr } from './i18nLabel';
import './ImagePaletteExtractor_Translations.js';
import { hexToRgb, hexToHsl, rgbToHex } from './ColorHarmony.js';
import { UserPalettes, type PaletteItem } from './UserPalettes.js';
import { cssFromGradient, type GradientValue } from './ColorPickerUI.js';

// ── Extraction ────────────────────────────────────────────────────────────────

export interface ExtractedPalette {
  colors: string[];
  gradients: GradientValue[];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Needed to read pixel data back off the canvas for a cross-origin URL
    // (API-picked backgrounds/overlays, etc.) -- only works if that host
    // actually sends CORS headers; same-origin/data:/blob: sources (the
    // common case: uploaded photos) don't need this at all. Set BEFORE
    // `src` -- setting it after assigning src has no effect once the
    // browser has already started the fetch.
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('image-load-failed'));
    img.src = src;
  });
}

const colorDistance = (a: string, b: string): number => {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  return Math.sqrt((ra.r - rb.r) ** 2 + (ra.g - rb.g) ** 2 + (ra.b - rb.b) ** 2);
};

/**
 * Builds up to 2 gradients out of an already-extracted color set: one
 * dark-to-light pairing (sorted by HSL lightness -- reads as a natural
 * shadow-to-highlight ramp) and one high-contrast pairing of the two most
 * saturated colors (reads as the "punchiest" combination available). Skips
 * a gradient entirely if its two stops would end up identical (e.g. a
 * near-monochrome photo where every extracted color has similar saturation).
 */
function buildSuggestedGradients(colors: string[]): GradientValue[] {
  if (colors.length < 2) return [];

  const byLightness = [...colors].sort((a, b) => hexToHsl(a).l - hexToHsl(b).l);
  const lightGradient: GradientValue = {
    type: 'linear', angle: 135,
    stops: [byLightness[0], byLightness[byLightness.length - 1]],
  };

  const bySaturation = [...colors].sort((a, b) => hexToHsl(b).s - hexToHsl(a).s);
  const vividGradient: GradientValue = {
    type: 'linear', angle: 120,
    stops: [bySaturation[0], bySaturation[1]],
  };

  const gradients = [lightGradient];
  if (colorDistance(vividGradient.stops[0], vividGradient.stops[1]) > 20 &&
      (vividGradient.stops[0] !== lightGradient.stops[0] || vividGradient.stops[1] !== lightGradient.stops[1])) {
    gradients.push(vividGradient);
  }
  return gradients;
}

/**
 * Samples `src` on a small off-screen canvas, bins pixels into coarse RGB
 * buckets (a lightweight histogram-based quantization -- accurate enough for
 * "what colors dominate this photo" without pulling in a full k-means/
 * median-cut library for it), then greedily picks up to `maxColors` of the
 * most common bucket-average colors that are still visually distinct from
 * each other (progressively relaxing the distinctness threshold if the
 * photo is too monochrome to find enough distinct ones at the strict
 * threshold).
 */
export async function extractPaletteFromImageSrc(src: string, maxColors = 6): Promise<ExtractedPalette> {
  const img = await loadImage(src);

  const SAMPLE = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SAMPLE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas-unavailable');

  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    // Tainted canvas: cross-origin image without permissive CORS headers.
    throw new Error('canvas-tainted');
  }

  const BUCKET = 24;
  const buckets = new Map<string, { count: number; rSum: number; gSum: number; bSum: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue; // skip transparent pixels
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = `${Math.round(r / BUCKET)},${Math.round(g / BUCKET)},${Math.round(b / BUCKET)}`;
    const entry = buckets.get(key);
    if (entry) { entry.count++; entry.rSum += r; entry.gSum += g; entry.bSum += b; }
    else buckets.set(key, { count: 1, rSum: r, gSum: g, bSum: b });
  }

  const candidates = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .map(e => rgbToHex(e.rSum / e.count, e.gSum / e.count, e.bSum / e.count));

  let picked: string[] = [];
  for (const minDist of [64, 44, 28, 0]) {
    picked = [];
    for (const c of candidates) {
      if (picked.length >= maxColors) break;
      if (picked.every(p => colorDistance(p, c) >= minDist)) picked.push(c);
    }
    if (picked.length >= Math.min(maxColors, 4)) break;
  }
  if (!picked.length) picked = candidates.slice(0, maxColors);

  return { colors: picked, gradients: buildSuggestedGradients(picked) };
}

// ── Shared UI panel ───────────────────────────────────────────────────────────

/**
 * Renders the whole "Extrair paleta da imagem" block: a trigger button,
 * then (once run) a result grid of extracted color/gradient swatches the
 * user can toggle in/out, and a name + "Salvar" row that writes the
 * selected subset into UserPalettes.ts as a brand-new custom palette.
 *
 * `getImgSrc` is a getter, not a plain string, because both call sites
 * (ImageTool.ts, CellPanel.ts's renderImageMode()) can swap which photo is
 * "current" after this panel has already been built (switching photo,
 * picking from the API, uploading a new file) -- reading fresh at click
 * time avoids extracting a stale/previous image.
 */
export function renderExtractPalettePanel(getImgSrc: () => string | null): HTMLElement {
  const root = document.createElement('div');
  root.className = 'ct-field ct-field--block ct-extract-palette';

  // Selection state for the pending "save as new palette" flow -- a Set of
  // stringified PaletteItem so both solid hex strings and gradient objects
  // can be toggled in/out uniformly (see itemKey()).
  let result: ExtractedPalette | null = null;
  let selected = new Set<string>();
  const itemKey = (item: PaletteItem): string =>
    item.type === 'solid' ? `s:${item.color}` : `g:${JSON.stringify(item.gradient)}`;

  const paint = (): void => {
    const items: PaletteItem[] = result
      ? [
          ...result.colors.map((color): PaletteItem => ({ type: 'solid', color })),
          ...result.gradients.map((gradient): PaletteItem => ({ type: 'gradient', gradient })),
        ]
      : [];

    root.innerHTML = `
      <button type="button" class="craftools-pill" data-action="extract" style="align-self:flex-start; display:flex; align-items:center; gap:5px;">
        <span class="material-symbols-outlined" style="font-size:14px;">palette</span>
        ${tr('imagePalette.extractButton', 'Extract palette from image')}
      </button>
      <div id="extract-status" style="font-size:11px; color:var(--text-muted);"></div>
      ${items.length ? `
        <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
          <span class="ct-sublabel">${tr('imagePalette.colorsLabel', 'Extracted colors')} / ${tr('imagePalette.gradientsLabel', 'Suggested gradients')}</span>
          <span style="font-size:10px; color:var(--text-muted);">${tr('imagePalette.selectAllHint', "Tap to include/remove from the palette you'll save")}</span>
          <div class="ct-color-palette">
            ${items.map(item => {
              const key = itemKey(item);
              const active = selected.has(key);
              return item.type === 'solid'
                ? `<button type="button" class="ct-color-swatch-btn${active ? ' active' : ''}" data-action="toggle-item" data-key="${escAttr(key)}" style="background:${item.color};" title="${item.color}"></button>`
                : `<button type="button" class="ct-gradient-swatch-btn${active ? ' active' : ''}" data-action="toggle-item" data-key="${escAttr(key)}" style="background:${cssFromGradient(item.gradient)};"></button>`;
            }).join('')}
          </div>
          <div class="ct-field-row" style="gap:6px; margin-top:4px;">
            <input type="text" class="craftools-input" id="extract-palette-name" placeholder="${tr('imagePalette.namePlaceholder', 'Palette name')}" style="flex:1;">
            <button type="button" class="craftools-pill" data-action="save-extracted">${tr('imagePalette.saveConfirm', 'Save')}</button>
          </div>
        </div>
      ` : ''}
    `;
  };

  // innerHTML-embedded data-key values go through a plain attribute escape
  // (gradient items JSON-stringify their key, which can contain quotes) --
  // small local helper since ColorPickerUI._esc()/VariablePanel._esc() are
  // each private to their own module.
  function escAttr(val: string): string {
    return val.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  paint();

  root.addEventListener('click', async (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const statusEl = root.querySelector<HTMLElement>('#extract-status');

    if (action === 'extract') {
      const src = getImgSrc();
      if (!src) {
        if (statusEl) statusEl.textContent = tr('imagePalette.noImage', 'Select an image first.');
        return;
      }
      (target as HTMLButtonElement).disabled = true;
      if (statusEl) statusEl.textContent = tr('imagePalette.extracting', 'Analyzing image...');
      try {
        result = await extractPaletteFromImageSrc(src);
        selected = new Set([
          ...result.colors.map(color => itemKey({ type: 'solid', color })),
          ...result.gradients.map(gradient => itemKey({ type: 'gradient', gradient })),
        ]);
        paint();
      } catch {
        result = null;
        paint();
        const freshStatus = root.querySelector<HTMLElement>('#extract-status');
        if (freshStatus) freshStatus.textContent = tr('imagePalette.extractError', "Couldn't analyze this image.");
      }
    } else if (action === 'toggle-item') {
      const key = target.dataset.key!;
      if (selected.has(key)) selected.delete(key); else selected.add(key);
      target.classList.toggle('active');
    } else if (action === 'save-extracted') {
      if (!result) return;
      const items: PaletteItem[] = [
        ...result.colors.map((color): PaletteItem => ({ type: 'solid', color })),
        ...result.gradients.map((gradient): PaletteItem => ({ type: 'gradient', gradient })),
      ].filter(item => selected.has(itemKey(item)));
      if (!items.length) return;
      const nameInput = root.querySelector<HTMLInputElement>('#extract-palette-name');
      const name = (nameInput?.value ?? '').trim() || tr('imagePalette.defaultName', 'Image palette');
      UserPalettes.create(name, items);
      result = null;
      selected = new Set();
      paint();
      const freshStatus = root.querySelector<HTMLElement>('#extract-status');
      if (freshStatus) freshStatus.textContent = tr('imagePalette.saved', 'Palette saved!');
    }
  });

  return root;
}
