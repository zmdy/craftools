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
import type { PropertySchema } from '../../types/PropertySchema';

// Filter keys that map to CSS filter functions
const FILTER_KEYS = [
  'brightness', 'contrast', 'saturate', 'hue-rotate',
  'blur', 'grayscale', 'sepia', 'invert', 'opacity',
] as const;

type FilterKey = typeof FILTER_KEYS[number];

interface ImageMeta {
  src:         string;
  objectFit:   string;
  /**
   * "h-v" string (e.g. "center-center"), same shape as every other
   * content-align.field.ts value -- painted as native CSS object-position
   * on the `<img>` (see _applyProperty()'s 'contentAlign' case). Only
   * visible when objectFit === 'contain' (the only fit mode that doesn't
   * already fill the box edge-to-edge); harmless no-op under 'cover'/'fill'.
   */
  contentAlign: string;
  zoom:        number;
  posX:        number;
  posY:        number;
  rotation:    number;
  /** Mirrors the image horizontally (scaleX(-1)) -- composed into ImageTransform.applyTransform()'s single `transform` string. */
  flipH:       boolean;
  /** Mirrors the image vertically (scaleY(-1)) -- same composition as flipH. */
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
    src: '', objectFit: 'cover', contentAlign: 'center-center', zoom: 1, posX: 0, posY: 0, rotation: 0,
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
      img.style.borderRadius  = `${sMeta.borderRadius || 0}px`;
    }
    ImageTransform.applyTransform(sibling as unknown as Parameters<typeof ImageTransform.applyTransform>[0]);
    ImageFilters.applyFilters(sibling as unknown as Parameters<typeof ImageFilters.applyFilters>[0]);
    ImageTool._applyBgBlur(sibling);
  }

  /** Propagates the current meta to all linked sibling elements (Business Card mode). */
  private static _propagateToSiblings(element: HTMLElement, meta: ImageMeta): void {
    ImageTool._getLinkedSiblings(element).forEach(sibling => ImageTool._pushMetaToSibling(sibling, meta));
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
        icon: 'photo_camera',
        fields: [
          { type: 'image-upload', key: 'src', label: 'Switch photo' },
        ],
      },
      {
        section: 'Transform',
        icon: 'tune',
        defaultOpen: true,
        fields: [
          {
            type: 'select', key: 'objectFit', label: 'Fit mode',
            options: [
              { value: 'cover',   label: 'Cover' },
              { value: 'contain', label: 'Contain' },
              { value: 'fill',    label: 'Fill' },
            ],
          },
          { type: 'slider', key: 'zoom',     label: 'Zoom',     min: 0.1, max: 5,    step: 0.05 },
          { type: 'slider', key: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1 },
          { type: 'number', key: 'posX',     label: 'X',        unit: 'px' },
          { type: 'number', key: 'posY',     label: 'Y',        unit: 'px' },
          { type: 'toggle', key: 'flipH',    label: 'Flip horizontal', i18nKey: 'imageTool.flipHorizontal' },
          { type: 'toggle', key: 'flipV',    label: 'Flip vertical',   i18nKey: 'imageTool.flipVertical' },
        ],
      },
      // Only visibly moves the photo within its box when Fit mode is
      // 'contain' (the only mode that doesn't already fill edge-to-edge) --
      // see ImageMeta's contentAlign doc comment.
      contentAlignSection(),
      {
        section: 'Filters',
        icon: 'photo_filter',
        fields: [
          { type: 'slider', key: 'filter_brightness', label: 'Brightness', min: 0,   max: 2,   step: 0.01 },
          { type: 'slider', key: 'filter_contrast',   label: 'Contrast',   min: 0,   max: 3,   step: 0.01 },
          { type: 'slider', key: 'filter_saturate',   label: 'Saturate',   min: 0,   max: 3,   step: 0.01 },
          { type: 'slider', key: 'filter_hue_rotate', label: 'Hue',        min: 0,   max: 360, step: 1    },
          { type: 'slider', key: 'filter_blur',       label: 'Blur',       min: 0,   max: 20,  step: 0.1  },
          { type: 'slider', key: 'filter_grayscale',  label: 'Grayscale',  min: 0,   max: 1,   step: 0.01 },
          { type: 'slider', key: 'filter_sepia',      label: 'Sepia',      min: 0,   max: 1,   step: 0.01 },
          { type: 'slider', key: 'filter_invert',     label: 'Invert',     min: 0,   max: 1,   step: 0.01 },
          { type: 'slider', key: 'filter_opacity',    label: 'Opacity',    min: 0,   max: 1,   step: 0.01 },
        ],
      },
      {
        section: 'Background',
        icon: 'gradient',
        fields: [
          { type: 'slider', key: 'bgBlur', label: 'Background blur', min: 0, max: 100, step: 1 },
          {
            type: 'select', key: 'blendMode', label: 'Blend mode',
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
    const meta = el._craftoolsMeta;
    if (!meta) return;

    // Map schema key → meta key
    if (key === 'src') {
      meta.src = String(value);
      const img = (el.contentArea ?? element).querySelector<HTMLImageElement>('img');
      if (img) img.src = meta.src;
      const blurBg = element.querySelector<HTMLElement>('.craftools-element-blur-bg');
      if (blurBg) blurBg.style.backgroundImage = `url(${meta.src})`;
      ImageTool._propagateToSiblings(element, meta);
    } else if (key.startsWith('filter_')) {
      const filterKey = key.replace('filter_', '').replace('_', '-') as FilterKey;
      if (meta.filters) meta.filters[filterKey] = value as number;
      element.dispatchEvent(new CustomEvent('craftools-image-filters-apply', { bubbles: false }));
    } else if (['zoom', 'posX', 'posY', 'rotation', 'flipH', 'flipV'].includes(key)) {
      (meta as unknown as Record<string, unknown>)[key] = value;
      element.dispatchEvent(new CustomEvent('craftools-image-transform-apply', { bubbles: false }));
      // Was missing entirely: only a photo *swap* (the 'src' branch above)
      // propagated to linked siblings (Business Card mode) -- adjusting
      // pan/zoom/rotation through the panel's own sliders left every other
      // cell in the set exactly where it was, same gap as the direct wheel/
      // drag interactions ImageTransform.ts owns (now fixed there too).
      ImageTool._propagateToSiblings(element, meta);
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
  }
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
