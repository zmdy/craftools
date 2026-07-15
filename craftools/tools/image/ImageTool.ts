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
import { borderSection, radiusSection, zIndexSection } from '../../utils/CommonSchema';
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
  zoom:        number;
  posX:        number;
  posY:        number;
  rotation:    number;
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
    src: '', objectFit: 'cover', zoom: 1, posX: 0, posY: 0, rotation: 0,
    bgBlur: 0, blendMode: 'normal',
    borderWidth: 0, borderStyle: 'none', borderColor: '#000000', borderRadius: 0,
    filters: { brightness: 1, contrast: 1, saturate: 1, 'hue-rotate': 0, blur: 0, grayscale: 0, sepia: 0, invert: 0, opacity: 1 },
  };

// ── Tool ──────────────────────────────────────────────────────────────────────

export class ImageTool extends BaseTool {

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};

    const topKeys: (keyof ImageMeta)[] = [
      'objectFit', 'zoom', 'posX', 'posY', 'rotation',
      'bgBlur', 'blendMode', 'borderWidth', 'borderStyle', 'borderColor', 'borderRadius',
    ];

    topKeys.forEach(k => {
      if (!(k in existing)) patch[k] = meta[k];
    });

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
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    const BLEND_MODES = ['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity'];

    return [
      {
        section: 'Transform',
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
        ],
      },
      {
        section: 'Filters',
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
        fields: [
          { type: 'slider', key: 'bgBlur', label: 'Background blur', min: 0, max: 100, step: 1 },
          {
            type: 'select', key: 'blendMode', label: 'Blend mode',
            options: BLEND_MODES.map(m => ({ value: m, label: m })),
          },
        ],
      },
      borderSection(),
      radiusSection(),
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);

    const el = element as HTMLElement & { _craftoolsMeta?: ImageMeta };
    const meta = el._craftoolsMeta;
    if (!meta) return;

    // Map schema key → meta key
    if (key.startsWith('filter_')) {
      const filterKey = key.replace('filter_', '').replace('_', '-') as FilterKey;
      if (meta.filters) meta.filters[filterKey] = value as number;
      element.dispatchEvent(new CustomEvent('craftools-image-filters-apply', { bubbles: false }));
    } else if (['zoom', 'posX', 'posY', 'rotation', 'objectFit'].includes(key)) {
      (meta as Record<string, unknown>)[key] = value;
      element.dispatchEvent(new CustomEvent('craftools-image-transform-apply', { bubbles: false }));
    } else if (key === 'bgBlur') {
      meta.bgBlur = value as number;
      element.dispatchEvent(new CustomEvent('craftools-image-bgblur-apply', { bubbles: false }));
    } else if (key === 'blendMode') {
      meta.blendMode = String(value);
      const img = element.querySelector<HTMLElement>('img');
      if (img) img.style.mixBlendMode = String(value);
    } else if (['borderWidth', 'borderStyle', 'borderColor', 'borderRadius'].includes(key)) {
      (meta as Record<string, unknown>)[key] = value;
      const img = element.querySelector<HTMLElement>('img');
      if (img) {
        img.style.borderWidth  = `${meta.borderWidth}px`;
        img.style.borderStyle  = meta.borderStyle;
        img.style.borderColor  = meta.borderColor;
        img.style.borderRadius = `${meta.borderRadius}px`;
      }
    } else if (key === 'zIndex') {
      element.style.zIndex = String(value);
    }
  }
}

// ── Self-registration ─────────────────────────────────────────────────────────

ImageTool.registeredKeys = ['imagem'];

ToolRegistry.register({
  key:             'imagem',
  label:           'editor.image',
  icon:            'image',
  tool:            ImageTool,
  draggable:       true,
  showInFooterNav: true,
  category:        'media',
});
