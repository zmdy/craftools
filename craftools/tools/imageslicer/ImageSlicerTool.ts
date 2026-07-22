/**
 * ImageSlicerTool.ts
 *
 * "Fatiador de Imagem" (Image Slicer) panel — takes over the entire side
 * panel (like CalendarTool / GeradorTool). Lets the user upload one or more
 * images, slice each into an R×C grid, preview the slices live as a page
 * grid overlaid on the canvas area, and generate one real document page per
 * slice (one full-bleed or margin+border page each).
 *
 * Recovered from the pre-migration ImageSlicerTool.js (deleted by the
 * "Purge legacy JS" commit without this logic being ported) -- the previous
 * ImageSlicerTool.ts was a ToolRegistry.register()-only stub with no
 * setup() at all, so clicking the sidebar button threw
 * "Cannot read properties of undefined (reading 'bind')" in Editor.ts's
 * PANEL_SETUP_MAP.
 *
 * Note: this tool assigns `editor._toolCleanup`, a generic cleanup hook that
 * Editor.ts's restoreOriginalCanvas() invokes (and deletes) when the user
 * switches to a different tool -- that wiring was also dropped during the
 * TS migration and has been restored in Editor.ts alongside this file.
 */
import { I18n } from '../../settings/Translations.js';
import { PageTool } from '../page/PageTool.js';
import { ToolRegistry } from '../../utils/ToolRegistry';
import './ImageSlicerTool_Translations.js';

const t = (key: string): string => I18n.t('imageSlicer.' + key);

interface SizeOption {
  name: string;
  size: string;
  sizeUnit: string;
}

/** Standard page sizes offered when no project sizes are active. */
const STANDARD_SIZES: SizeOption[] = [
  { name: 'A4',       size: '210,297', sizeUnit: 'mm' },
  { name: 'A5',       size: '148,210', sizeUnit: 'mm' },
  { name: '10×15 cm', size: '100,150', sizeUnit: 'mm' },
  { name: '15×21 cm', size: '150,210', sizeUnit: 'mm' },
  { name: '20×30 cm', size: '200,300', sizeUnit: 'mm' },
  { name: '30×40 cm', size: '300,400', sizeUnit: 'mm' },
];

/** Physical mm → CSS px conversion factor (96 dpi). */
const MM_PX = 3.7795275591;

type FillMode = 'full' | 'margin';

interface SlicerImage {
  name: string;
  dataUrl: string;
}

interface SlicerState {
  images: SlicerImage[];
  currentImg: number;
  rows: number;
  cols: number;
  fillMode: FillMode;
  margin: number;        // mm
  borderWidth: number;   // mm
  borderColor: string;
  borderStyle: string;
  selectedSize: SizeOption | null;
}

// Ad hoc global set elsewhere in the app (Settings.js / index.html inline
// scripts) -- same pragmatic `window as any` pattern AlbumWizard.ts,
// GeradorTool.ts and Editor.ts already use for craftoolsSize/craftoolsApp.
type CraftoolsWindow = typeof window & {
  craftoolsApp?: { activeMedia?: { sizes?: SizeOption[] } };
};

/** Editor instance shape this tool relies on beyond plain HTMLElement. */
type EditorEl = HTMLElement & {
  _toolCleanup?: () => void;
};

export class ImageSlicerTool {

  public static setup(editor: HTMLElement): void {
    const panelTitle = document.getElementById('panel-title');
    const panelBody  = document.getElementById('panel-body');
    if (panelTitle) panelTitle.textContent = t('panelTitle');
    if (!panelBody) return;

    const ed = editor as EditorEl;

    // ── Tool state ─────────────────────────────────────────────────────
    const state: SlicerState = {
      images:      [],
      currentImg:  0,
      rows:        2,
      cols:        2,
      fillMode:    'full',
      margin:      5,
      borderWidth: 0,
      borderColor: '#000000',
      borderStyle: 'solid',
      selectedSize: null,
    };

    // Build size list: active project sizes first, then standard fallbacks
    const win = window as CraftoolsWindow;
    const activeSizes  = (win.craftoolsApp?.activeMedia?.sizes || []).filter(s => s.size !== '*');
    const existingKeys = new Set(activeSizes.map(s => s.size));
    const allSizes: SizeOption[] = [...activeSizes, ...STANDARD_SIZES.filter(s => !existingKeys.has(s.size))];
    if (allSizes.length) state.selectedSize = allSizes[0];

    // ── Canvas overlay preview ───────────────────────────────────────────
    const canvasArea = document.getElementById('canvas-area');

    /**
     * Cleanup hook called by Editor.ts's restoreOriginalCanvas().
     * Removes the overlay and badge when the user switches tools.
     */
    ed._toolCleanup = () => {
      document.getElementById('slicer-preview-overlay')?.remove();
      document.getElementById('slicer-canvas-badge')?.remove();
    };

    /** Returns (creating if needed) the full-bleed overlay div. */
    const ensureOverlay = (): HTMLElement | null => {
      let ov = document.getElementById('slicer-preview-overlay');
      if (!ov && canvasArea) {
        ov = document.createElement('div');
        ov.id = 'slicer-preview-overlay';
        ov.style.cssText = [
          'position:absolute;inset:0;z-index:50;overflow:auto;',
          'background:var(--bg-subtle,#f4f4f5);',
          'display:flex;flex-wrap:wrap;gap:20px;',
          'justify-content:center;align-content:flex-start;',
          'padding:24px;box-sizing:border-box;',
        ].join('');
        canvasArea.appendChild(ov);
      }
      return ov;
    };

    /** Creates the orange "Preview" badge (same style as GeradorTool). */
    const ensureBadge = (): void => {
      if (document.getElementById('slicer-canvas-badge') || !canvasArea) return;
      const badge = document.createElement('div');
      badge.id = 'slicer-canvas-badge';
      badge.style.cssText = [
        'position:absolute;top:20px;left:20px;',
        'background:#f97316;color:#fff;',
        'font-size:11px;font-weight:700;',
        'padding:6px 14px;border-radius:30px;',
        'z-index:200;pointer-events:none;',
        'box-shadow:0 4px 12px rgba(249,115,22,.3);',
        'display:flex;align-items:center;gap:6px;',
        'text-transform:uppercase;letter-spacing:.5px;',
      ].join('');
      badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:15px;">visibility</span> Preview';
      canvasArea.appendChild(badge);
    };

    // ── Live canvas preview ──────────────────────────────────────────────
    const renderPreview = (): void => {
      const ov = ensureOverlay();
      if (!ov) return;
      ensureBadge();

      // Empty state
      if (!state.images.length) {
        ov.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;
                      justify-content:center;min-height:200px;gap:12px;
                      color:var(--text-muted,#a1a1aa);width:100%;">
            <span class="material-symbols-outlined" style="font-size:52px;opacity:.3;">content_cut</span>
            <span style="font-size:12px;">${t('uploadPrompt')}</span>
          </div>`;
        return;
      }

      const img = state.images[state.currentImg];
      if (!img) return;

      const sizeConf = state.selectedSize || { name: '', size: '210,297', sizeUnit: 'mm' };
      const [docW, docH] = String(sizeConf.size).split(',').map(Number);
      const { rows, cols, fillMode, margin, borderWidth, borderColor, borderStyle } = state;

      // Scale so pages fit neatly — cap height at ~40% of viewport
      const maxH  = Math.min(window.innerHeight * 0.4, 280);
      const scale = maxH / (docH * MM_PX);
      const dW    = Math.round(docW * MM_PX * scale);
      const dH    = Math.round(docH * MM_PX * scale);

      const mPx = margin * MM_PX * scale;
      const bPx = borderWidth * MM_PX * scale;

      ov.innerHTML = '';

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const page = document.createElement('div');
          page.style.cssText = [
            `width:${dW}px;height:${dH}px;`,
            'background:#fff;position:relative;overflow:hidden;',
            'box-shadow:0 4px 16px rgba(0,0,0,.18);',
            'border-radius:2px;flex-shrink:0;',
          ].join('');

          const padX = fillMode === 'margin' ? mPx + bPx : 0;
          const padY = fillMode === 'margin' ? mPx + bPx : 0;
          const innerW = Math.max(1, dW - 2 * padX);
          const innerH = Math.max(1, dH - 2 * padY);

          const posX = cols > 1 ? (c / (cols - 1)) * 100 : 50;
          const posY = rows > 1 ? (r / (rows - 1)) * 100 : 50;

          const imgDiv = document.createElement('div');
          imgDiv.style.cssText = [
            `position:absolute;top:${padY}px;left:${padX}px;`,
            `width:${innerW}px;height:${innerH}px;`,
            `background-image:url(${img.dataUrl});`,
            `background-size:${cols * 100}% ${rows * 100}%;`,
            `background-position:${posX}% ${posY}%;`,
            'background-repeat:no-repeat;',
            borderWidth > 0
              ? `box-sizing:border-box;border:${bPx}px ${borderStyle} ${borderColor};`
              : '',
          ].join('');
          page.appendChild(imgDiv);

          // Slice number badge
          const lbl = document.createElement('div');
          lbl.style.cssText = [
            'position:absolute;bottom:4px;right:5px;',
            'font-size:9px;font-weight:700;',
            'color:rgba(0,0,0,.25);pointer-events:none;',
          ].join('');
          lbl.textContent = `${r * cols + c + 1}/${rows * cols}`;
          page.appendChild(lbl);

          ov.appendChild(page);
        }
      }

      // Multi-image indicator below the grid
      if (state.images.length > 1) {
        const ind = document.createElement('div');
        ind.style.cssText = [
          'width:100%;text-align:center;',
          'font-size:11px;color:var(--text-muted,#a1a1aa);',
          'padding-top:4px;',
        ].join('');
        ind.textContent = `${t('imgOf')} ${state.currentImg + 1} ${t('imgOfTotal')} ${state.images.length}`;
        ov.appendChild(ind);
      }
    };

    // ── Canvas API slice ─────────────────────────────────────────────────
    const sliceImage = (dataUrl: string, r: number, c: number, totalRows: number, totalCols: number): Promise<string> =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const sw     = Math.floor(img.naturalWidth  / totalCols);
          const sh     = Math.floor(img.naturalHeight / totalRows);
          const canvas = document.createElement('canvas');
          canvas.width  = sw;
          canvas.height = sh;
          canvas.getContext('2d')!.drawImage(
            img,
            c * sw, r * sh, sw, sh,  // source rect
            0,      0,      sw, sh, // dest rect
          );
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.src = dataUrl;
      });

    // ── Page generation ──────────────────────────────────────────────────
    const generate = async (): Promise<void> => {
      if (!state.images.length) return;

      const genBtn = panelBody.querySelector<HTMLButtonElement>('#slicer-gen-btn');
      if (genBtn) {
        genBtn.disabled = true;
        genBtn.innerHTML = [
          '<span class="material-symbols-outlined" ',
          'style="font-size:15px;display:inline-block;',
          'animation:spin .8s linear infinite;">progress_activity</span> ',
          t('generating'),
        ].join('');
      }

      try {
        // Remove preview overlay before adding real pages
        ed._toolCleanup?.();
        delete ed._toolCleanup;

        const pagesWrapper = editor.querySelector('#pages-wrapper');
        const sizeConf = state.selectedSize || { name: '', size: '210,297', sizeUnit: 'mm' };
        const [docW, docH] = String(sizeConf.size).split(',').map(Number);
        const unit = sizeConf.sizeUnit || 'mm';
        const { rows, cols, fillMode, margin, borderWidth, borderColor, borderStyle } = state;

        for (const imgData of state.images) {
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const sliceDataUrl = await sliceImage(imgData.dataUrl, r, c, rows, cols);

              PageTool.addNewPage(editor);
              const page = pagesWrapper?.querySelector<HTMLElement>('.craftools-page:last-child');
              if (!page) continue;

              page.style.width     = docW + unit;
              page.style.minHeight = docH + unit;
              page.style.background = '#ffffff';
              page.innerHTML = '';

              if (fillMode === 'full') {
                // Full-bleed: image stretches to fill the entire page
                const img = document.createElement('img');
                img.src = sliceDataUrl;
                img.alt = '';
                img.style.cssText = [
                  'position:absolute;top:0;left:0;',
                  'width:100%;height:100%;',
                  'object-fit:fill;display:block;',
                ].join('');
                page.appendChild(img);
              } else {
                // Margin mode: image with padding and optional border
                const wrapper = document.createElement('div');
                wrapper.style.cssText = [
                  'position:absolute;',
                  `top:${margin}${unit};left:${margin}${unit};`,
                  `width:calc(100% - ${2 * margin}${unit});`,
                  `height:calc(100% - ${2 * margin}${unit});`,
                  'overflow:hidden;',
                  borderWidth > 0
                    ? `box-sizing:border-box;border:${borderWidth}${unit} ${borderStyle} ${borderColor};`
                    : '',
                ].join('');
                const img = document.createElement('img');
                img.src = sliceDataUrl;
                img.alt = '';
                img.style.cssText = 'width:100%;height:100%;object-fit:fill;display:block;';
                wrapper.appendChild(img);
                page.appendChild(wrapper);
              }
            }
          }
        }

        document.dispatchEvent(new CustomEvent('craftools-page-add', { bubbles: true }));

      } finally {
        if (genBtn) {
          genBtn.disabled = false;
          genBtn.innerHTML = [
            '<span class="material-symbols-outlined" style="font-size:15px;">content_cut</span> ',
            t('apply'),
          ].join('');
        }
      }
    };

    // ── Panel render ─────────────────────────────────────────────────────
    const renderPanel = (): void => {
      const sizeOptions = allSizes.map(sz =>
        `<option value="${sz.size}|${sz.sizeUnit || 'mm'}" ${
          state.selectedSize?.size === sz.size ? 'selected' : ''
        }>${sz.name || sz.size}</option>`,
      ).join('');

      const sliceCount = state.rows * state.cols;
      const totalLabel = state.images.length > 1
        ? `${sliceCount} ${t('slices')} × ${state.images.length} ${t('imagesCount')} = ${sliceCount * state.images.length} ${t('pages')}`
        : `${sliceCount} ${t('slices')}`;

      panelBody.innerHTML = `
<div style="padding:12px;display:flex;flex-direction:column;gap:14px;">

    <!-- Upload zone -->
    <div>
        <div class="ct-sublabel">
            <span class="material-symbols-outlined">upload</span>${t('images')}
        </div>
        <div id="slicer-dropzone" style="
            border:2px dashed var(--border,#e4e4e7);border-radius:10px;
            padding:18px 12px;text-align:center;cursor:pointer;
            background:var(--bg-input,#f4f4f5);
            transition:border-color .15s,background .15s;
        ">
            <span class="material-symbols-outlined"
                  style="font-size:28px;color:var(--text-muted,#a1a1aa);display:block;margin-bottom:6px;">
                add_photo_alternate
            </span>
            <div style="font-size:11px;font-weight:600;color:var(--text-muted,#a1a1aa);">${t('dropOrClick')}</div>
            <input type="file" id="slicer-file-input" accept="image/*" multiple style="display:none;">
        </div>

        ${state.images.length > 0 ? `
        <div id="slicer-img-thumbs" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
            ${state.images.map((img, i) => `
                <div style="position:relative;width:42px;height:42px;flex-shrink:0;cursor:pointer;"
                     data-thumb="${i}">
                    <img src="${img.dataUrl}"
                         style="width:100%;height:100%;object-fit:cover;border-radius:5px;
                                border:2px solid ${i === state.currentImg
                                  ? 'var(--accent,#f97316)'
                                  : 'var(--border,#e4e4e7)'};" alt="">
                    <button class="slicer-rm-img" data-rm="${i}" style="
                        position:absolute;top:-4px;right:-4px;
                        width:16px;height:16px;
                        background:#ef4444;border:none;color:#fff;
                        border-radius:50%;font-size:9px;line-height:1;
                        cursor:pointer;padding:0;
                        display:flex;align-items:center;justify-content:center;">×</button>
                </div>
            `).join('')}
        </div>` : ''}
    </div>

    <!-- Grid -->
    <div>
        <div class="ct-sublabel">
            <span class="material-symbols-outlined">grid_4x4</span>${t('grid')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div>
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('rows')}</div>
                <input id="slicer-rows" type="number" class="craftools-input"
                       min="1" max="10" value="${state.rows}">
            </div>
            <div>
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('cols')}</div>
                <input id="slicer-cols" type="number" class="craftools-input"
                       min="1" max="10" value="${state.cols}">
            </div>
        </div>
        <div data-total-label style="font-size:10px;color:var(--text-muted);
             margin-top:5px;text-align:center;">${totalLabel}</div>
    </div>

    <!-- Page size -->
    <div>
        <div class="ct-sublabel">
            <span class="material-symbols-outlined">article</span>${t('pageSize')}
        </div>
        <select id="slicer-size" class="craftools-select">${sizeOptions}</select>
    </div>

    <!-- Fill mode -->
    <div>
        <div class="ct-sublabel">
            <span class="material-symbols-outlined">crop</span>${t('fillMode')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            ${(['full', 'margin'] as FillMode[]).map(mode => {
              const active = state.fillMode === mode;
              const labelKey = 'mode' + mode.charAt(0).toUpperCase() + mode.slice(1);
              return `
              <label id="slicer-mode-${mode}" style="
                  display:flex;align-items:center;gap:5px;cursor:pointer;
                  padding:6px 8px;border-radius:8px;
                  border:2px solid ${active ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)'};
                  background:${active ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)'};
                  transition:border-color .15s,background .15s;
              ">
                  <input type="radio" name="slicer-fill" value="${mode}" ${active ? 'checked' : ''}
                         style="accent-color:var(--accent,#f97316);flex-shrink:0;">
                  <span style="font-size:11px;font-weight:600;">${t(labelKey)}</span>
              </label>`;
            }).join('')}
        </div>
    </div>

    <!-- Margin / border options -->
    <div id="slicer-margin-section" style="${state.fillMode === 'full' ? 'display:none;' : ''}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div>
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('marginSize')}</div>
                <input id="slicer-margin" type="number" class="craftools-input"
                       min="0" max="50" step="0.5" value="${state.margin}">
            </div>
            <div>
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('borderWidth')}</div>
                <input id="slicer-border-w" type="number" class="craftools-input"
                       min="0" max="10" step="0.1" value="${state.borderWidth}">
            </div>
        </div>

        <div id="slicer-border-opts" style="${state.borderWidth > 0 ? '' : 'display:none;'}">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div>
                    <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('borderStyle')}</div>
                    <select id="slicer-border-style" class="craftools-select">
                        ${['solid', 'dashed', 'dotted', 'double'].map(st =>
                          `<option value="${st}" ${state.borderStyle === st ? 'selected' : ''}>${st}</option>`,
                        ).join('')}
                    </select>
                </div>
                <div>
                    <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('borderColor')}</div>
                    <input id="slicer-border-color" type="color" class="craftools-input"
                           value="${state.borderColor}"
                           style="height:34px;padding:2px 4px;cursor:pointer;">
                </div>
            </div>
        </div>
    </div>

    <!-- Apply button -->
    <button id="slicer-gen-btn" style="
        width:100%;padding:10px 14px;border:none;
        background:var(--accent,#f97316);color:#fff;
        border-radius:8px;font-size:13px;font-weight:700;
        cursor:pointer;font-family:inherit;
        display:flex;align-items:center;justify-content:center;gap:6px;
        transition:opacity .15s;
        opacity:${!state.images.length ? '.5' : '1'};
    " ${!state.images.length ? 'disabled' : ''}>
        <span class="material-symbols-outlined" style="font-size:15px;">content_cut</span>
        ${t('apply')}
    </button>

</div>`;

      bindPanelEvents();
    };

    // ── Event binding ────────────────────────────────────────────────────
    const bindPanelEvents = (): void => {
      // Drop zone
      const dropzone  = panelBody.querySelector<HTMLElement>('#slicer-dropzone');
      const fileInput = panelBody.querySelector<HTMLInputElement>('#slicer-file-input');

      if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.style.borderColor = 'var(--accent,#f97316)';
          dropzone.style.background  = 'rgba(249,115,22,.05)';
        });
        dropzone.addEventListener('dragleave', () => {
          dropzone.style.borderColor = '';
          dropzone.style.background  = '';
        });
        dropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.style.borderColor = '';
          dropzone.style.background  = '';
          loadFiles([...(e.dataTransfer?.files ?? [])]);
        });
        fileInput.addEventListener('change', () => loadFiles([...(fileInput.files ?? [])]));
      }

      // Image thumbnails: select active / remove
      panelBody.querySelectorAll<HTMLElement>('[data-thumb]').forEach(thumb => {
        thumb.addEventListener('click', () => {
          state.currentImg = parseInt(thumb.dataset.thumb!, 10);
          renderPanel();
          renderPreview();
        });
      });
      panelBody.querySelectorAll<HTMLElement>('.slicer-rm-img').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          state.images.splice(parseInt(btn.dataset.rm!, 10), 1);
          if (state.currentImg >= state.images.length) {
            state.currentImg = Math.max(0, state.images.length - 1);
          }
          renderPanel();
          renderPreview();
        });
      });

      // Grid inputs
      panelBody.querySelector<HTMLInputElement>('#slicer-rows')?.addEventListener('input', (e) => {
        state.rows = Math.max(1, Math.min(10, parseInt((e.target as HTMLInputElement).value, 10) || 1));
        updateTotalLabel();
        renderPreview();
      });
      panelBody.querySelector<HTMLInputElement>('#slicer-cols')?.addEventListener('input', (e) => {
        state.cols = Math.max(1, Math.min(10, parseInt((e.target as HTMLInputElement).value, 10) || 1));
        updateTotalLabel();
        renderPreview();
      });

      // Page size
      panelBody.querySelector<HTMLSelectElement>('#slicer-size')?.addEventListener('change', (e) => {
        const [sz, su] = (e.target as HTMLSelectElement).value.split('|');
        state.selectedSize = allSizes.find(s => s.size === sz)
          || { name: sz, size: sz, sizeUnit: su || 'mm' };
        renderPreview();
      });

      // Fill mode radio
      panelBody.querySelectorAll<HTMLInputElement>('input[name="slicer-fill"]').forEach(radio => {
        radio.addEventListener('change', () => {
          state.fillMode = radio.value as FillMode;
          const sec = panelBody.querySelector<HTMLElement>('#slicer-margin-section');
          if (sec) sec.style.display = state.fillMode === 'full' ? 'none' : '';
          (['full', 'margin'] as FillMode[]).forEach(m => {
            const lbl = panelBody.querySelector<HTMLElement>(`#slicer-mode-${m}`);
            if (!lbl) return;
            const active = state.fillMode === m;
            lbl.style.borderColor = active ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)';
            lbl.style.background  = active ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)';
          });
          renderPreview();
        });
      });

      // Margin size
      panelBody.querySelector<HTMLInputElement>('#slicer-margin')?.addEventListener('input', (e) => {
        state.margin = parseFloat((e.target as HTMLInputElement).value) || 0;
        renderPreview();
      });

      // Border width — also shows/hides style+color row
      panelBody.querySelector<HTMLInputElement>('#slicer-border-w')?.addEventListener('input', (e) => {
        state.borderWidth = parseFloat((e.target as HTMLInputElement).value) || 0;
        const opts = panelBody.querySelector<HTMLElement>('#slicer-border-opts');
        if (opts) opts.style.display = state.borderWidth > 0 ? '' : 'none';
        renderPreview();
      });
      panelBody.querySelector<HTMLSelectElement>('#slicer-border-style')?.addEventListener('change', (e) => {
        state.borderStyle = (e.target as HTMLSelectElement).value;
        renderPreview();
      });
      panelBody.querySelector<HTMLInputElement>('#slicer-border-color')?.addEventListener('input', (e) => {
        state.borderColor = (e.target as HTMLInputElement).value;
        renderPreview();
      });

      // Generate
      panelBody.querySelector('#slicer-gen-btn')?.addEventListener('click', generate);
    };

    // ── Helpers ──────────────────────────────────────────────────────────
    const updateTotalLabel = (): void => {
      const el = panelBody.querySelector('[data-total-label]');
      if (!el) return;
      const sliceCount = state.rows * state.cols;
      el.textContent = state.images.length > 1
        ? `${sliceCount} ${t('slices')} × ${state.images.length} ${t('imagesCount')} = ${sliceCount * state.images.length} ${t('pages')}`
        : `${sliceCount} ${t('slices')}`;
    };

    const loadFiles = (files: File[]): void => {
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      if (!imageFiles.length) return;

      let pending = imageFiles.length;
      imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          state.images.push({ name: file.name, dataUrl: String(e.target?.result ?? '') });
          if (--pending === 0) {
            state.currentImg = 0;
            renderPanel();
            renderPreview();
          }
        };
        reader.readAsDataURL(file);
      });
    };

    // ── Boot ─────────────────────────────────────────────────────────────
    renderPanel();
    renderPreview();
  }
}

ToolRegistry.register({
  key: 'imageslicer',
  label: 'editor.imageSlicer',
  icon: 'content_cut',
  panelOnly: true,
  showInFooterNav: false,
  category: 'tools',
});
