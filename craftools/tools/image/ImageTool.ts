/**
 * ImageTool.ts — Schema-based TypeScript migration of ImageTool.
 *
 * State lives in element._craftoolsMeta (set by ImageTool.js).
 * _syncFromDOM() copies it to dataset.ctState for PropertyRenderer.
 * _applyProperty() writes to _craftoolsMeta and dispatches an update event
 * so ImageFilters.js / ImageTransform.js can re-apply the effect.
 */

import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { borderSection, radiusSection, zIndexSection, backgroundSection, contentAlignSection } from '../../utils/CommonSchema';
import { ImageFilters } from './ImageFilters.js';
import { ImageTransform } from './ImageTransform.js';
import { ImageEnhancer } from '../../utils/ImageEnhancer.js';
import { AppSettings } from '../../utils/AppSettings.js';
import * as ImageQuality from '../../utils/ImageQuality.js';
import { renderExtractPalettePanel } from '../../utils/ImagePaletteExtractor.js';
import type { PropertySchema } from '../../types/PropertySchema';

// Filter keys that map to CSS filter functions
const FILTER_KEYS = [
  'brightness', 'contrast', 'saturate', 'hue-rotate',
  'blur', 'grayscale', 'sepia', 'invert', 'opacity',
] as const;

type FilterKey = typeof FILTER_KEYS[number];

interface ImageMeta {
  src:         string;
  originalSrc?: string;
  autoEnhance?: boolean;
  objectFit:   string;
  contentAlign: string;
  zoom:        number;
  posX:        number;
  posY:        number;
  rotation:    number;
  flipH:       boolean;
  flipV:       boolean;
  bgBlur:      number;
  blendMode:   string;
  borderWidth: number;
  borderStyle: string;
  borderColor: string;
  borderRadius: number;
  filters:     Record<FilterKey, number>;
}

const getMeta = (element: HTMLElement): ImageMeta =>
  (element as HTMLElement & { _craftoolsMeta?: ImageMeta })._craftoolsMeta ?? {
    src: '', originalSrc: '', autoEnhance: false, objectFit: 'cover', contentAlign: 'center-center', zoom: 1, posX: 0, posY: 0, rotation: 0,
    flipH: false, flipV: false,
    bgBlur: 0, blendMode: 'normal',
    borderWidth: 0, borderStyle: 'none', borderColor: '#000000', borderRadius: 0,
    filters: { brightness: 1, contrast: 1, saturate: 1, 'hue-rotate': 0, blur: 0, grayscale: 0, sepia: 0, invert: 0, opacity: 1 },
  };

// ── Tool ──────────────────────────────────────────────────────────────────────

export class ImageTool extends BaseTool {

  /**
   * Default meta object for a freshly-created image element. Recovered from
   * pre-migration ImageTool.js — also called directly by AlbumWizard.ts
   * (ImageTool.getDefaultMeta()) when seeding shared meta for linked
   * Business Card cells, so this must exist as a real method, not just be
   * inlined into createElement().
   */
  static getDefaultMeta(): ImageMeta {
    const filters = {} as Record<FilterKey, number>;
    FILTER_KEYS.forEach(fk => {
      filters[fk] = fk === 'brightness' || fk === 'contrast' || fk === 'saturate' || fk === 'opacity' ? 1 : 0;
    });
    return {
      src: '', objectFit: 'cover', contentAlign: 'center-center', zoom: 1, posX: 0, posY: 0, rotation: 0,
      flipH: false, flipV: false,
      bgBlur: 0, blendMode: 'normal',
      borderWidth: 0, borderStyle: 'none', borderColor: '#000000', borderRadius: 0,
      filters,
    };
  }

  /**
   * Builds a fresh `<craftools-element data-craftool="image">` with a
   * placeholder `<img>`. Recovered from the pre-migration ImageTool.js
   * (deleted by the "Purge legacy JS" commit without this logic being
   * ported) — the previous createElement() here was a broken stub that
   * called itself (`new this().createElement()`, but createElement was
   * never an instance method), throwing "createElement is not a function"
   * for every image element creation.
   */
  static createElement(_type: string, _editor?: unknown): HTMLElement {
    const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E";

    const el = document.createElement('craftools-element') as HTMLElement & {
      _craftoolsMeta?: ImageMeta;
      contentArea?: HTMLElement;
    };
    el.setAttribute('x', '50');
    el.setAttribute('y', '50');
    el.setAttribute('w', '200');
    el.setAttribute('h', '200');
    el.setAttribute('data-craftool', 'image');

    el._craftoolsMeta = ImageTool.getDefaultMeta();
    el._craftoolsMeta.src = placeholder;

    const img = document.createElement('img');
    img.src = placeholder;
    img.style.cssText = `display:block;width:100%;height:100%;object-fit:${el._craftoolsMeta.objectFit};object-position:${el._craftoolsMeta.contentAlign.replace('-', ' ')};user-select:none;pointer-events:none;`;

    el.appendChild(img);

    // Wait for the web component to be connected and built before wiring
    // transform/filter interactions (contentArea only exists post-connect).
    const initElement = (): void => {
      if (el.contentArea) {
        ImageTransform.setupInteractions(el as unknown as Parameters<typeof ImageTransform.setupInteractions>[0]);
        ImageTransform.applyTransform(el as unknown as Parameters<typeof ImageTransform.applyTransform>[0]);
        ImageFilters.applyFilters(el as unknown as Parameters<typeof ImageFilters.applyFilters>[0]);
        ImageTool._applyBgBlur(el);
      } else {
        requestAnimationFrame(initElement);
      }
    };
    initElement();

    // _applyProperty() dispatches these instead of calling the apply
    // functions directly, so the element must listen for its own updates.
    el.addEventListener('craftools-image-filters-apply', () => ImageFilters.applyFilters(el as unknown as Parameters<typeof ImageFilters.applyFilters>[0]));
    el.addEventListener('craftools-image-transform-apply', () => ImageTransform.applyTransform(el as unknown as Parameters<typeof ImageTransform.applyTransform>[0]));
    el.addEventListener('craftools-image-bgblur-apply', () => ImageTool._applyBgBlur(el));

    return el;
  }

  /** Renders (or removes) the blurred-background layer behind a transparent/contained image. */
  private static _applyBgBlur(element: HTMLElement & { _craftoolsMeta?: ImageMeta }): void {
    const meta = element._craftoolsMeta;
    if (!meta) return;

    let blurBg = element.querySelector<HTMLElement>('.craftools-element-blur-bg');

    if (meta.bgBlur <= 0) {
      if (blurBg) blurBg.remove();
      element.style.overflow = '';
      return;
    }

    if (!blurBg) {
      element.style.overflow = 'hidden';
      blurBg = document.createElement('div');
      blurBg.className = 'craftools-element-blur-bg';
      blurBg.style.cssText = `
        position: absolute;
        inset: -20px;
        background-size: cover;
        background-position: center;
        opacity: 0.6;
        pointer-events: none;
        z-index: -1;
      `;
      element.insertBefore(blurBg, element.firstChild);
    }

    blurBg.style.backgroundImage = `url(${meta.src})`;
    blurBg.style.filter = `blur(${meta.bgBlur}px)`;
  }

  /**
   * Applies the "Blend mode" select's value to the element.
   *
   * This used to set `mixBlendMode` on the inner `<img>` itself, which
   * visually did nothing for the vast majority of images: `<craftools-
   * element>` is always `position:absolute` with an explicit `z-index`
   * (Element.ts's `_build()`), and per the CSS Compositing spec that
   * combination makes each element its own stacking-context root. A blend
   * mode set on a *descendant* (the `<img>`) can only blend against other
   * content painted earlier *within that same root* (e.g. this element's
   * own `.ct-bg-layer`/`.craftools-element-blur-bg`) -- it can never reach
   * past the element's own boundary to blend with the page background or
   * any other element behind it, which is what "blend mode" means to a
   * user coming from any layer-based design tool. Applying it to the
   * OUTER element instead makes the element's own z-index-bearing box the
   * blending unit, so it correctly blends against whatever is actually
   * stacked behind it on the page.
   *
   * (The element's selection outline/handles are children of this same
   * node too, so they'll pick up a visible tint while actively selected
   * with a non-normal blend mode -- an acceptable trade-off since that UI
   * never appears in the exported/printed output, PdfExport.ts strips
   * `.craftools-ctrlbar` entirely.)
   */
  private static _applyBlendMode(element: HTMLElement, blendMode: unknown): void {
    const mode = String(blendMode || 'normal');
    element.style.mixBlendMode = mode !== 'normal' ? mode : '';
    // Clears any stale value from before this fix (sessions/undo history
    // saved with the old behavior may still have it inline on the <img>).
    const img = (element as HTMLElement & { contentArea?: HTMLElement }).contentArea?.querySelector<HTMLImageElement>('img')
      ?? element.querySelector<HTMLImageElement>('img');
    if (img) img.style.mixBlendMode = '';
  }

  /**
   * Returns sibling image elements linked to this one (Business Card mode) —
   * via the shared `_linkedElements` array (Album wizard multi-upload) or
   * the `data-linked-id` attribute (PageTool.ts's card-cloning logic).
   */
  private static _getLinkedSiblings(element: HTMLElement & { _linkedElements?: HTMLElement[] }): HTMLElement[] {
    if (Array.isArray(element._linkedElements)) {
      return element._linkedElements.filter(el => el !== element);
    }
    const lid = element.getAttribute('data-linked-id');
    if (!lid) return [];
    return [...document.querySelectorAll<HTMLElement>(`craftools-element[data-linked-id="${lid}"]`)]
      .filter(el => el !== element);
  }

  /** Copies the current meta state to a sibling element and re-applies it to the sibling's DOM. */
  private static _pushMetaToSibling(sibling: HTMLElement & { _craftoolsMeta?: ImageMeta; contentArea?: HTMLElement }, meta: ImageMeta): void {
    if (sibling._craftoolsMeta !== meta) {
      if (!sibling._craftoolsMeta) sibling._craftoolsMeta = ImageTool.getDefaultMeta();
      Object.assign(sibling._craftoolsMeta, meta, { filters: { ...meta.filters } });
    }
    const sMeta = sibling._craftoolsMeta;
    const img = sibling.contentArea?.querySelector<HTMLImageElement>('img') ?? sibling.querySelector<HTMLImageElement>('img');
    if (img) {
      if (img.getAttribute('src') !== meta.src) img.src = meta.src;
      ImageTool._applyBlendMode(sibling, sMeta.blendMode);
      this._paintBorder(img, sMeta.borderWidth, sMeta.borderStyle, sMeta.borderColor);
      img.style.borderRadius   = `${sMeta.borderRadius || 0}px`;
      // Was missing -- object-position (the panel's "Alinhamento" grid,
      // only visible under Fit mode 'contain') got copied into sMeta by
      // the Object.assign() above but never actually painted here, so a
      // sibling's photo silently ignored it until something ELSE touched
      // that sibling directly.
      img.style.objectPosition = sMeta.contentAlign.replace('-', ' ');
    }
    ImageTransform.applyTransform(sibling as unknown as Parameters<typeof ImageTransform.applyTransform>[0]);
    ImageFilters.applyFilters(sibling as unknown as Parameters<typeof ImageFilters.applyFilters>[0]);
    ImageTool._applyBgBlur(sibling);
  }

  /**
   * Propagates the current meta -- AND anything else about `element` that
   * isn't part of `ImageMeta` but should still stay identical across a
   * Business Card group, i.e. z-index -- to every linked sibling.
   *
   * Called unconditionally at the end of `_applyProperty()` (see its own
   * comment) so this covers EVERY property this tool has today, and any
   * new one added to `ImageMeta`/the schema later, without each needing
   * its own opt-in call site the way this used to only fire for `src` and
   * pan/zoom/rotate/flip.
   */
  private static _propagateToSiblings(element: HTMLElement, meta: ImageMeta): void {
    ImageTool._getLinkedSiblings(element).forEach(sibling => {
      ImageTool._pushMetaToSibling(sibling, meta);
      sibling.style.zIndex = element.style.zIndex;
    });
  }

  static getCtxOptions(): any[] {
    return [
      {
        icon: 'published_with_changes',
        label: 'Switch photo',
        command: (element: HTMLElement & { _craftoolsMeta?: ImageMeta; contentArea?: HTMLElement }) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = () => {
            const file = input.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (e) => {
                const result = e.target?.result as string;
                if (!element._craftoolsMeta) element._craftoolsMeta = ImageTool.getDefaultMeta();
                element._craftoolsMeta.src = result;
                const img = (element.contentArea ?? element).querySelector<HTMLImageElement>('img');
                if (img) img.src = result;

                const blurBg = element.querySelector<HTMLElement>('.craftools-element-blur-bg');
                if (blurBg) blurBg.style.backgroundImage = `url(${result})`;

                // Propagate to other linked elements (Business Card mode)
                // even when the properties panel was never opened for this element.
                ImageTool._propagateToSiblings(element, element._craftoolsMeta);
              };
              reader.readAsDataURL(file);
            }
          };
          input.click();
        },
      },
      // "Auto-fit" for images means cycling the Fit mode (matches the
      // Transform section's own `objectFit` select) rather than a boolean
      // on/off -- reuses BaseTool's shared _autoFitCtxOption() so it gets
      // the same icon/orange-when-active treatment as TextTool's auto-fit-
      // to-text toggle, and automatically refreshes the "Fit mode" select
      // in the panel if it's open. Active (orange) whenever not on the
      // default 'cover', since that's the common case most images use.
      //
      // Only cycles Cover <-> Contain -- 'fill' (stretch, ignoring aspect
      // ratio) is still selectable from the Transform section's own select,
      // but doesn't belong in this quick-toggle: it's a distortion mode a
      // user would deliberately pick, not something they want to land on by
      // repeatedly tapping a 2-way "which way does it fit" button.
      this._autoFitCtxOption({
        isActive: (el) => getMeta(el).objectFit !== 'cover',
        toggle: (el) => {
          const current = getMeta(el).objectFit;
          const next = current === 'contain' ? 'cover' : 'contain';
          ImageTool._applyProperty(el, 'objectFit', next);
        },
        label: 'Toggle fit mode (Cover / Contain)',
      }),
    ];
  }

  // Border is painted onto the `<img>` itself (matches the pre-existing
  // behavior in _applyProperty()/_pushMetaToSibling() below), not the outer
  // `<craftools-element>` host -- overriding this keeps the Copy/Paste style
  // bar (BaseTool.ts's _renderStyleBar()) reading/writing the same node.
  protected static _getStyleTarget(element: HTMLElement): HTMLElement {
    const el = element as HTMLElement & { contentArea?: HTMLElement };
    return (el.contentArea ?? element).querySelector<HTMLElement>('img') ?? element;
  }

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};

    const topKeys: (keyof ImageMeta)[] = [
      'src', 'objectFit', 'contentAlign', 'zoom', 'posX', 'posY', 'rotation', 'flipH', 'flipV',
      'bgBlur', 'blendMode', 'borderWidth', 'borderStyle', 'borderRadius',
    ];

    topKeys.forEach(k => {
      if (!(k in existing)) patch[k] = meta[k];
    });

    // borderColor: meta stores a bare hex (pre-gradient-border); normalizeValue()
    // (utils/ColorPickerUI.ts) already accepts that directly wherever it's
    // read, but the color-picker field itself expects the JSON
    // ColorPickerValue shape -- wrap it here so the panel's swatch/mode
    // reflects the current color correctly on first render.
    if (!('borderColor' in existing)) {
      patch.borderColor = JSON.stringify({ mode: 'solid', solid: meta.borderColor || '#000000', gradient: { type: 'linear', angle: 90, stops: ['#f97316', '#facc15'] } });
    }

    // Flatten filters into top-level keys for simpler schema access
    if (meta.filters) {
      FILTER_KEYS.forEach(fk => {
        const stateKey = `filter_${fk.replace('-', '_')}`;
        if (!(stateKey in existing)) patch[stateKey] = meta.filters[fk];
      });
    }

    if (Object.keys(patch).length) {
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
    }

    // Background fill (backgroundSection(), merged into this tool's own
    // "Background" section alongside bgBlur/blendMode) -- dataset.ctState-
    // based like every other tool using it, independent of this tool's
    // meta-based border/filter state.
    this._syncBackgroundState(element);
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    const BLEND_MODES = ['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity'];

    return [
      {
        section: 'Photo',
        i18nKey: 'imageTool.sectionPhoto',
        icon: 'photo_camera',
        fields: [
          { type: 'image-upload', key: 'src', label: 'Switch photo', i18nKey: 'imageTool.switchPhoto' },
        ],
      },
      {
        // "Extrair paleta da imagem" -- analyzes the current photo's pixels
        // (ImagePaletteExtractor.ts, client-side canvas sampling, no
        // network call) and lets the user save any subset of the result as
        // a brand-new entry in "Minhas paletas", which then shows up in
        // every color picker in the app (ColorPickerUI.ts's "Paletas"
        // section) -- not just this tool.
        section: 'Paleta da Imagem',
        i18nKey: 'imageTool.sectionPalette',
        icon: 'palette',
        defaultOpen: false,
        fields: [
          {
            type: 'custom',
            key: 'extractPalette',
            label: '',
            render: (element: HTMLElement) =>
              renderExtractPalettePanel(() => getMeta(element).src || null),
          },
        ],
      },
      {
        // Distinct from "Qualidade" (auto-enhance/appearance) below --
        // this one is about print resolution (DPI), not photo appearance.
        section: 'Qualidade de Impressão',
        i18nKey: 'imageTool.sectionPrintQuality',
        icon: 'high_quality',
        defaultOpen: false,
        fields: [
          {
            type: 'custom',
            key: 'printQualityInfo',
            label: '',
            render: (element: HTMLElement) => ImageTool._renderPrintQualityPanel(element),
          },
        ],
      },
      {
        section: 'Qualidade',
        i18nKey: 'imageTool.sectionQuality',
        icon: 'auto_fix_high',
        defaultOpen: false,
        fields: [
          {
            type: 'custom',
            key: 'autoEnhance',
            label: '',
            render: (element: HTMLElement, onChange: (value: unknown) => void) =>
              ImageTool._renderEnhancePanel(element, onChange),
          },
        ],
      },
      {
        section: 'Transform',
        i18nKey: 'imageTool.sectionTransform',
        icon: 'tune',
        defaultOpen: true,
        fields: [
          {
            type: 'select', key: 'objectFit', label: 'Fit mode', i18nKey: 'imageTool.fit',
            options: [
              { value: 'cover',   label: 'Cover' },
              { value: 'contain', label: 'Contain' },
              { value: 'fill',    label: 'Fill' },
            ],
          },
          { type: 'slider', key: 'zoom',     label: 'Zoom',     i18nKey: 'imageTool.zoom',     min: 0.1, max: 5,    step: 0.05 },
          { type: 'slider', key: 'rotation', label: 'Rotation', i18nKey: 'imageTool.rotation', min: -180, max: 180, step: 1 },
          { type: 'number', key: 'posX',     label: 'X',        i18nKey: 'imageTool.posX',     unit: 'px' },
          { type: 'number', key: 'posY',     label: 'Y',        i18nKey: 'imageTool.posY',     unit: 'px' },
          { type: 'toggle', key: 'flipH',    label: 'Flip horizontal', i18nKey: 'imageTool.flipHorizontal' },
          { type: 'toggle', key: 'flipV',    label: 'Flip vertical',   i18nKey: 'imageTool.flipVertical' },
          // Distinct from flipH/flipV above (which flip the photo right
          // now, on THIS page, permanently) -- this one does nothing to the
          // current canvas. It only marks the element so PageTool.ts's
          // "duplicar página" (alternate clone) and AgendaExport.ts's
          // alternate-page export additionally mirror the photo itself
          // (on top of the position mirroring they already do) on the
          // ALTERNATED copy specifically -- see flipAlternateSection()'s
          // doc comment in CommonSchema.ts.
          { type: 'toggle', key: 'flipAlternate', label: 'Flip content on alternate pages', i18nKey: 'common.flipAlternate' },
        ],
      },
      // Only visibly moves the photo within its box when Fit mode is
      // 'contain' (the only mode that doesn't already fill edge-to-edge) --
      // see ImageMeta's contentAlign doc comment.
      contentAlignSection(),
      {
        section: 'Filters',
        i18nKey: 'imageTool.cssFilters',
        icon: 'photo_filter',
        fields: [
          { type: 'slider', key: 'filter_brightness', label: 'Brightness', i18nKey: 'imageTool.brightness', min: 0,   max: 2,   step: 0.01 },
          { type: 'slider', key: 'filter_contrast',   label: 'Contrast',   i18nKey: 'imageTool.contrast',   min: 0,   max: 3,   step: 0.01 },
          { type: 'slider', key: 'filter_saturate',   label: 'Saturate',   i18nKey: 'imageTool.saturate',   min: 0,   max: 3,   step: 0.01 },
          { type: 'slider', key: 'filter_hue_rotate', label: 'Hue',        i18nKey: 'imageTool.hueRotate',  min: 0,   max: 360, step: 1    },
          { type: 'slider', key: 'filter_blur',       label: 'Blur',       i18nKey: 'imageTool.blur',       min: 0,   max: 20,  step: 0.1  },
          { type: 'slider', key: 'filter_grayscale',  label: 'Grayscale',  i18nKey: 'imageTool.grayscale',  min: 0,   max: 1,   step: 0.01 },
          { type: 'slider', key: 'filter_sepia',      label: 'Sepia',      i18nKey: 'imageTool.sepia',      min: 0,   max: 1,   step: 0.01 },
          { type: 'slider', key: 'filter_invert',     label: 'Invert',     i18nKey: 'imageTool.invert',     min: 0,   max: 1,   step: 0.01 },
          { type: 'slider', key: 'filter_opacity',    label: 'Opacity',    i18nKey: 'imageTool.opacity',    min: 0,   max: 1,   step: 0.01 },
        ],
      },
      {
        section: 'Background',
        i18nKey: 'common.background',
        icon: 'gradient',
        fields: [
          { type: 'slider', key: 'bgBlur',    label: 'Background blur', i18nKey: 'imageTool.bgBlur',    min: 0, max: 100, step: 1 },
          {
            type: 'select', key: 'blendMode', label: 'Blend mode', i18nKey: 'imageTool.blendMode',
            options: BLEND_MODES.map(m => ({ value: m, label: m })),
          },
          // backgroundSection()'s fields (Fill + Opacity), merged into this
          // existing "Background" accordion instead of spread as a second
          // top-level section -- this tool already has one titled
          // "Background" for the blur/blend-mode effect, and two
          // same-titled accordions would be confusing.
          { type: 'divider', key: 'div-bg-fill', icon: 'format_color_fill', label: 'Fill', i18nKey: 'common.background' },
          ...backgroundSection().fields,
        ],
      },
      borderSection(),
      radiusSection(),
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    // Background fill (backgroundSection()) -- dataset.ctState-based,
    // independent of this tool's own meta store (see _syncFromDOM()).
    if (this._applyBackground(element, key, value)) return;

    PropertyRenderer.applyChange(element, key, value);

    const el = element as HTMLElement & { _craftoolsMeta?: ImageMeta; contentArea?: HTMLElement };
    // A Business Card clone (PageTool.ts's `cloneNode(true)`) never
    // inherits this JS-only expando -- it used to just bail out here
    // ("if (!meta) return"), which silently no-op'd EVERY property below
    // on a sibling that had never been individually selected yet. That's
    // also exactly what BaseTool._syncLinkedClones() hits: it re-runs this
    // same method directly on every linked sibling after any panel change,
    // so a never-selected sibling's Fit mode/filters/border/etc. change
    // was being swallowed right here instead of applying. Lazily
    // defaulting it instead means this method always has something valid
    // to read and write, on the edited element AND on every sibling this
    // fires on.
    if (!el._craftoolsMeta) el._craftoolsMeta = ImageTool.getDefaultMeta();
    const meta = el._craftoolsMeta;

    // Map schema key → meta key
    if (key === 'src') {
      meta.src = String(value);
      meta.originalSrc = meta.src;
      const img = (el.contentArea ?? element).querySelector<HTMLImageElement>('img');
      if (img) img.src = meta.src;
      const blurBg = element.querySelector<HTMLElement>('.craftools-element-blur-bg');
      if (blurBg) blurBg.style.backgroundImage = `url(${meta.src})`;
      if (meta.autoEnhance) {
        ImageTool._processAutoEnhance(el);
      }
    } else if (key === 'autoEnhance') {
      meta.autoEnhance = Boolean(value);
      ImageTool._processAutoEnhance(el);
    } else if (key.startsWith('filter_')) {
      const filterKey = key.replace('filter_', '').replace('_', '-') as FilterKey;
      if (meta.filters) meta.filters[filterKey] = value as number;
      element.dispatchEvent(new CustomEvent('craftools-image-filters-apply', { bubbles: false }));
    } else if (['zoom', 'posX', 'posY', 'rotation', 'flipH', 'flipV'].includes(key)) {
      (meta as unknown as Record<string, unknown>)[key] = value;
      element.dispatchEvent(new CustomEvent('craftools-image-transform-apply', { bubbles: false }));
    } else if (key === 'objectFit') {
      // Was lumped in with zoom/posX/posY/rotation above, dispatching
      // 'craftools-image-transform-apply' -- but ImageTransform.applyTransform()
      // only ever touches the img's `transform`/`transformOrigin` (translate/
      // scale/rotate), never `object-fit`. Only ImageFilters.applyFilters()
      // sets `img.style.objectFit` (from meta.objectFit), and that's wired to
      // the *filters* event, not the transform one -- so changing Fit mode
      // (from the panel's select OR the ctx-bar's cycle button) updated meta
      // but never touched anything visible. Set it directly instead of
      // routing through either event.
      meta.objectFit = String(value);
      const img = (el.contentArea ?? element).querySelector<HTMLImageElement>('img');
      if (img) img.style.objectFit = meta.objectFit;
    } else if (key === 'contentAlign') {
      // Native CSS object-position -- accepts the same left/center/right +
      // top/center/bottom keywords our "h-v" value already uses, just
      // space- instead of hyphen-separated.
      meta.contentAlign = String(value);
      const img = (el.contentArea ?? element).querySelector<HTMLImageElement>('img');
      if (img) img.style.objectPosition = meta.contentAlign.replace('-', ' ');
    } else if (key === 'bgBlur') {
      meta.bgBlur = value as number;
      element.dispatchEvent(new CustomEvent('craftools-image-bgblur-apply', { bubbles: false }));
    } else if (key === 'blendMode') {
      meta.blendMode = String(value);
      ImageTool._applyBlendMode(element, meta.blendMode);
    } else if (key === 'borderWidth' || key === 'borderStyle' || key === 'borderColor') {
      // borderColor is now the standardized solid-OR-gradient value (a JSON
      // ColorPickerValue string from the color-picker field) -- still just a
      // `string` as far as ImageMeta's type is concerned, _paintBorder()
      // (BaseTool.ts) is what actually interprets it.
      (meta as unknown as Record<string, unknown>)[key] = value;
      const img = element.querySelector<HTMLElement>('img');
      if (img) this._paintBorder(img, meta.borderWidth, meta.borderStyle, meta.borderColor);
    } else if (key === 'borderRadius') {
      meta.borderRadius = value as number;
      const img = element.querySelector<HTMLElement>('img');
      if (img) img.style.borderRadius = `${meta.borderRadius}px`;
    } else if (key === 'zIndex') {
      element.style.zIndex = String(value);
    }

    // Business Card mode: re-broadcast the FULL current state -- not just
    // whichever key changed above -- to every linked sibling, unconditionally,
    // on every single property change (including background fill/opacity,
    // which never touches `meta` at all -- see the `_applyBackground()` early
    // return above; siblings still pick that one up via
    // BaseTool._syncLinkedClones()'s own generic per-key sync). Previously
    // only `src` and the pan/zoom/rotate/flip keys called this, so Fit mode,
    // filters, background blur/blend mode, border and radius silently never
    // propagated -- and the same gap would have reopened for literally any
    // NEW key ever added here unless someone remembered to also wire a call
    // into its own branch above. One unconditional call at the end instead
    // means every key -- current and future -- is covered by construction.
    ImageTool._propagateToSiblings(element, meta);
  }

  /**
   * Non-destructive Canvas enhancement processing helper for an Image element.
   */
  private static async _processAutoEnhance(el: HTMLElement & { _craftoolsMeta?: ImageMeta; contentArea?: HTMLElement }): Promise<void> {
    const meta = el._craftoolsMeta;
    if (!meta) return;
    const img = (el.contentArea ?? el).querySelector<HTMLImageElement>('img');
    if (!img) return;

    if (meta.autoEnhance) {
      if (!meta.originalSrc) {
        meta.originalSrc = meta.src || img.src;
      }
      const profile = AppSettings.get('autoEnhanceProfile');
      try {
        const enhancedUrl = await ImageEnhancer.enhanceImage(meta.originalSrc, profile);
        meta.src = enhancedUrl;
        img.src = enhancedUrl;
      } catch (err) {
        console.error('[ImageTool] Failed auto enhance:', err);
      }
    } else if (meta.originalSrc) {
      meta.src = meta.originalSrc;
      img.src = meta.originalSrc;
    }
  }

  /**
   * Renders the "Qualidade de Impressão" panel: effective DPI of the photo
   * as currently placed on the page (native resolution vs the element's own
   * on-page size, accounting for fit mode + zoom -- see ImageQuality.ts's
   * `computeEffectiveDpi()` doc comment for the math), a good/bad indicator,
   * and the largest this specific photo could be printed at 300/150 DPI
   * (a property of the source image alone, independent of its current size
   * on the page).
   *
   * Purely informational (no onChange) -- repaints itself on the image's
   * own 'load' event since `naturalWidth`/`naturalHeight` aren't available
   * until the browser has decoded it, which for a just-uploaded photo may
   * not have happened yet by the time this panel first renders.
   *
   * Also repaints live as the element is resized (drag handles, typed W/H
   * in Size & Position, snap-to-grid) or its zoom/fit-mode changes (Transform
   * section, ctx-bar, or mouse-wheel zoom on the canvas) -- 'custom' fields
   * only ever call `render()` ONCE at creation (see custom.field.ts's doc
   * comment: PropertyRenderer's value-diffed re-render path is a no-op for
   * this field type since there's no `printQualityInfo` state key to diff
   * against), so without its own listeners this panel would show whatever
   * DPI happened to be true at the moment the accordion was first opened.
   */
  private static _renderPrintQualityPanel(element: HTMLElement): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'ct-field ct-field--block';
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:10px;';

    const paint = (): void => {
      wrap.innerHTML = '';
      const contentEl = (element as HTMLElement & { contentArea?: HTMLElement }).contentArea ?? element;
      const img = contentEl.querySelector<HTMLImageElement>('img');
      const meta = getMeta(element);

      if (!img || !img.src) {
        wrap.innerHTML = `<p style="font-size:11px; color:var(--text-muted); margin:0;">Selecione uma foto para ver a qualidade de impressão.</p>`;
        return;
      }

      if (!img.complete || !img.naturalWidth) {
        wrap.innerHTML = `<p style="font-size:11px; color:var(--text-muted); margin:0;">Carregando informações da imagem...</p>`;
        img.addEventListener('load', paint, { once: true });
        return;
      }

      const { widthIn, heightIn } = ImageQuality.elementSizeToInches(element);
      const fitMode: ImageQuality.FitMode = meta.objectFit === 'contain' ? 'contain' : meta.objectFit === 'fill' ? 'fill' : 'cover';
      const zoom = meta.zoom || 1;
      const dpi = ImageQuality.computeEffectiveDpi(img.naturalWidth, img.naturalHeight, widthIn, heightIn, fitMode, zoom);
      // Read fresh on every paint (rather than once at field-creation time)
      // so a threshold change made in Configurações > Aprimoramento de
      // Imagens is reflected the next time this panel repaints (element
      // resize/state-change) without needing its own extra listener --
      // there's no realistic scenario where both panels are open at once
      // anyway (single #panel-body).
      const thresholds = AppSettings.get('dpiQualityThresholds');
      const level = ImageQuality.classifyDpi(dpi, thresholds);
      const color = ImageQuality.dpiLevelColor(level);

      const LEVEL_LABEL: Record<ImageQuality.DpiLevel, string> = {
        excellent: 'Excelente para impressão',
        good:      'Boa para impressão',
        fair:      'Aceitável (impressão grande / vista à distância)',
        poor:      'Baixa qualidade — pode ficar borrada ou pixelizada',
      };
      const LEVEL_ICON: Record<ImageQuality.DpiLevel, string> = {
        excellent: 'check_circle',
        good:      'check_circle',
        fair:      'warning',
        poor:      'error',
      };

      const maxRecommended = ImageQuality.maxPrintSizeAtDpi(img.naturalWidth, img.naturalHeight, thresholds.excellent);
      const maxAcceptable  = ImageQuality.maxPrintSizeAtDpi(img.naturalWidth, img.naturalHeight, thresholds.fair);

      wrap.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; padding:10px; border-radius:8px; background:${color}1a; border:1px solid ${color}40;">
          <span class="material-symbols-outlined" style="font-size:28px; color:${color};">${LEVEL_ICON[level]}</span>
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:18px; font-weight:600; color:${color};">${Math.round(dpi)} DPI</span>
            <span style="font-size:11px; color:var(--text-muted);">${LEVEL_LABEL[level]}</span>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; font-size:11px; color:var(--text-muted);">
          <div style="display:flex; justify-content:space-between; gap:8px;"><span style="flex:1 1 auto;">Resolução original</span><span style="flex:0 0 auto; text-align:right; white-space:nowrap; color:var(--text, #111);">${img.naturalWidth} × ${img.naturalHeight} px</span></div>
          <div style="display:flex; justify-content:space-between; gap:8px;"><span style="flex:1 1 auto;">Tamanho atual de impressão</span><span style="flex:0 0 auto; text-align:right; white-space:nowrap; color:var(--text, #111);">${ImageQuality.formatCm(widthIn)} × ${ImageQuality.formatCm(heightIn)}</span></div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; padding-top:8px; border-top:1px dashed var(--border, #e4e4e7); font-size:11px; color:var(--text-muted);">
          <div style="display:flex; flex-direction:column; gap:1px;"><span>Tamanho máx. recomendado (${thresholds.excellent} DPI)</span><span style="color:var(--text, #111); font-weight:600;">${ImageQuality.formatCm(maxRecommended.widthIn)} × ${ImageQuality.formatCm(maxRecommended.heightIn)}</span></div>
          <div style="display:flex; flex-direction:column; gap:1px;"><span>Tamanho máx. aceitável (${thresholds.fair} DPI)</span><span style="color:var(--text, #111); font-weight:600;">${ImageQuality.formatCm(maxAcceptable.widthIn)} × ${ImageQuality.formatCm(maxAcceptable.heightIn)}</span></div>
        </div>
      `;
    };

    paint();

    const ro = new ResizeObserver(() => paint());
    ro.observe(element);
    const repaint = (): void => paint();
    element.addEventListener('craftools-element-change', repaint);
    element.addEventListener('craftools-state-change', repaint);

    return wrap;
  }

  /**
   * Renders the custom "Melhorar Qualidade" panel inside the Qualidade section.
   * Shows a toggle; when active, shows 4 group navigation buttons and sliders
   * for the selected group (Ajustes Globais / Sombras / Realces / Tons Médios).
   */
  private static _renderEnhancePanel(element: HTMLElement, _onChange: (v: unknown) => void): HTMLElement {
    const meta = getMeta(element);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; width:100%;';

    const GROUPS = [
      { key: 'global',    label: 'Ajustes Globais' },
      { key: 'shadows',   label: 'Sombras' },
      { key: 'highlights',label: 'Realces' },
      { key: 'midtones',  label: 'Tons Médios' },
    ] as const;

    type GroupKey = typeof GROUPS[number]['key'];
    let activeGroup: GroupKey = 'global';

    // ── Toggle row (styled like standard system .ct-field toggle) ──
    const toggleWrap = document.createElement('div');
    toggleWrap.className = 'ct-field';
    toggleWrap.style.cssText = 'padding: 4px 12px; margin-bottom: 0; min-height: 34px;';
    toggleWrap.innerHTML = `
      <div class="craftools-label" style="min-width:unset; max-width:unset; flex:1; text-transform:none; font-size:11px; font-weight:600; color:var(--text-primary);">Melhorar Qualidade de Imagem</div>
      <label class="ct-toggle-label" style="display:flex; align-items:center; cursor:pointer; gap:6px; margin-left:auto;">
        <input type="checkbox" id="img-enhance-toggle" class="ct-fi" style="display:none;" ${meta.autoEnhance ? 'checked' : ''}>
        <span class="ct-toggle-track" style="
          width:32px; height:18px; border-radius:99px;
          background:${meta.autoEnhance ? 'var(--accent)' : 'var(--border)'}; position:relative; transition:background .15s; flex-shrink:0;">
          <span class="ct-toggle-thumb" style="
            position:absolute; top:2px; left:2px;
            width:14px; height:14px; border-radius:50%;
            background:#fff; transition:transform .15s; box-shadow:0 1px 3px rgba(0,0,0,.2);
            transform:${meta.autoEnhance ? 'translateX(14px)' : 'translateX(0)'};">
          </span>
        </span>
      </label>
    `;
    wrap.appendChild(toggleWrap);

    // ── Content area (shown only when toggle is active) ──
    const content = document.createElement('div');
    content.style.cssText = `padding: 4px 12px 10px; display: ${meta.autoEnhance ? 'flex' : 'none'}; flex-direction: column; gap: 8px;`;
    wrap.appendChild(content);

    const buildContent = (): void => {
      content.innerHTML = '';

      // Read current profile from AppSettings
      const profile = AppSettings.get('autoEnhanceProfile') as import('../../utils/ImageEnhancer.js').EnhanceProfile | undefined;
      const P = profile ?? ImageEnhancer.defaultProfile();

      // ── 4 group navigation buttons ──
      const navWrap = document.createElement('div');
      navWrap.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; margin-bottom:4px;';
      GROUPS.forEach(g => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'craftools-pill' + (g.key === activeGroup ? ' active' : '');
        btn.style.cssText = 'flex:1; min-width:calc(50% - 4px); justify-content:center; font-size:11px; padding:7px 4px;';
        btn.textContent = g.label;
        btn.addEventListener('click', () => {
          activeGroup = g.key;
          buildContent();
        });
        navWrap.appendChild(btn);
      });
      content.appendChild(navWrap);

      // ── Sliders helper (styled like system slider fields) ──
      const addSlider = (label: string, valueGetter: () => number, valueSetter: (v: number) => void, min: number, max: number): void => {
        const row = document.createElement('div');
        row.className = 'ct-field';
        row.style.cssText = 'padding: 0; min-height: unset;';
        const curVal = valueGetter();
        row.innerHTML = `
          <div class="craftools-label" style="min-width:unset; max-width:unset; flex:1; text-transform:none;">${label}</div>
          <div class="ct-field-row" style="flex:1;">
            <input type="range" class="ct-fi craftools-slider" style="flex:1;" min="${min}" max="${max}" step="1" value="${curVal}">
            <span class="ct-val-badge ct-slider-badge">${curVal}</span>
          </div>
        `;
        const badge = row.querySelector<HTMLElement>('.ct-slider-badge')!;
        const input = row.querySelector<HTMLInputElement>('input')!;
        input.addEventListener('input', () => {
          const v = Number(input.value);
          badge.textContent = String(v);
          valueSetter(v);
          const newProfile = AppSettings.get('autoEnhanceProfile') as import('../../utils/ImageEnhancer.js').EnhanceProfile | undefined;
          AppSettings.set({ autoEnhanceProfile: newProfile });
          document.dispatchEvent(new CustomEvent('craftools-auto-enhance-update'));
        });
        content.appendChild(row);
      };

      // ── Sliders for active group ──
      if (activeGroup === 'global') {
        addSlider('Brilho',    () => P.brightness,  v => { P.brightness = v; },  -100, 100);
        addSlider('Contraste', () => P.contrast,    v => { P.contrast = v; },    -100, 100);
        addSlider('Saturação', () => P.saturation,  v => { P.saturation = v; },  -100, 100);
      } else {
        const zone = activeGroup === 'shadows' ? P.shadows : activeGroup === 'highlights' ? P.highlights : P.midtones;
        addSlider('Ciano – Vermelho', () => zone.cyanRed,      v => { zone.cyanRed = v; },      -50, 50);
        addSlider('Magenta – Verde',  () => zone.magentaGreen, v => { zone.magentaGreen = v; }, -50, 50);
        addSlider('Amarelo – Azul',   () => zone.yellowBlue,   v => { zone.yellowBlue = v; },   -50, 50);
      }

      // ── Reset button ──
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'craftools-pill';
      resetBtn.style.cssText = 'width:100%; justify-content:center; margin-top:4px; font-size:11px;';
      resetBtn.textContent = 'Restaurar padrões';
      resetBtn.addEventListener('click', () => {
        AppSettings.set({ autoEnhanceProfile: ImageEnhancer.defaultProfile() });
        document.dispatchEvent(new CustomEvent('craftools-auto-enhance-update'));
        buildContent();
      });
      content.appendChild(resetBtn);
    };

    // ── Toggle handler ──
    const chk = wrap.querySelector<HTMLInputElement>('#img-enhance-toggle')!;
    const track = wrap.querySelector<HTMLElement>('.ct-toggle-track')!;
    const thumb = wrap.querySelector<HTMLElement>('.ct-toggle-thumb')!;

    chk.addEventListener('change', () => {
      type MetaEl = HTMLElement & { _craftoolsMeta?: ImageMeta; contentArea?: HTMLElement };
      const metaEl = element as MetaEl;
      if (!metaEl._craftoolsMeta) metaEl._craftoolsMeta = ImageTool.getDefaultMeta();
      metaEl._craftoolsMeta!.autoEnhance = chk.checked;

      track.style.background = chk.checked ? 'var(--accent)' : 'var(--border)';
      thumb.style.transform  = chk.checked ? 'translateX(14px)' : 'translateX(0)';
      content.style.display  = chk.checked ? 'flex' : 'none';

      if (chk.checked) buildContent();
      ImageTool._processAutoEnhance(metaEl);
    });

    if (meta.autoEnhance) buildContent();
    return wrap;
  }
}

// Global listener to update active auto-enhanced images when settings profile changes
if (typeof document !== 'undefined') {
  document.addEventListener('craftools-auto-enhance-update', () => {
    document.querySelectorAll<HTMLElement>('craftools-element[data-craftool="image"]').forEach(el => {
      const meta = (el as unknown as { _craftoolsMeta?: ImageMeta })._craftoolsMeta;
      if (meta && meta.autoEnhance) {
        (ImageTool as unknown as { _processAutoEnhance(element: HTMLElement): void })._processAutoEnhance(el);
      }
    });
  });
}

// ── Self-registration ─────────────────────────────────────────────────────────

ImageTool.registeredKeys = ['image'];

ToolRegistry.register({
  key:             'image',
  label:           'editor.image',
  icon:            'image',
  tool:            ImageTool,
  draggable:       true,
  showInFooterNav: true,
  category:        'media',
});
