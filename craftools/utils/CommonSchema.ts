/**
 * CommonSchema — shared DRY section fragments.
 *
 * Import and spread these in any tool's getPropertySchema() to avoid
 * duplicating common sections. Each function returns a fresh Section object
 * so tools can safely override individual fields if needed.
 *
 * Usage:
 *   import { borderSection, zIndexSection } from '@utils/CommonSchema';
 *
 *   static getPropertySchema(element: HTMLElement): PropertySchema {
 *     return [
 *       { section: 'Typography', fields: [...] },
 *       borderSection(),
 *       radiusSection(),
 *       zIndexSection(),
 *     ];
 *   }
 */

import type { Section } from '../types/PropertySchema';

// ── Shape ─────────────────────────────────────────────────────────────────────

export const borderSection = (): Section => ({
  section: 'Border',
  i18nKey: 'common.border',
  icon: 'border_style',
  collapsible: true,
  defaultOpen: false,
  fields: [
    {
      type: 'number',
      key: 'borderWidth',
      label: 'Width',
      i18nKey: 'common.borderWidth',
      min: 0,
      max: 50,
      unit: 'px',
    },
    {
      type: 'color',
      key: 'borderColor',
      label: 'Color',
      i18nKey: 'common.borderColor',
    },
    {
      type: 'select',
      key: 'borderStyle',
      label: 'Style',
      i18nKey: 'common.borderStyle',
      options: [
        { value: 'solid',  label: 'Solid' },
        { value: 'dashed', label: 'Dashed' },
        { value: 'dotted', label: 'Dotted' },
        { value: 'none',   label: 'None' },
      ],
    },
  ],
});

export const radiusSection = (): Section => ({
  section: 'Radius',
  i18nKey: 'common.radius',
  icon: 'rounded_corner',
  collapsible: true,
  defaultOpen: false,
  fields: [
    {
      type: 'slider',
      key: 'borderRadius',
      label: 'Radius',
      i18nKey: 'common.borderRadius',
      min: 0,
      max: 200,
      step: 1,
    },
  ],
});

export const paddingSection = (): Section => ({
  section: 'Padding',
  i18nKey: 'common.padding',
  icon: 'padding',
  collapsible: true,
  defaultOpen: false,
  fields: [
    { type: 'number', key: 'paddingTop',    label: 'Top',    min: 0, max: 200, unit: 'px' },
    { type: 'number', key: 'paddingRight',  label: 'Right',  min: 0, max: 200, unit: 'px' },
    { type: 'number', key: 'paddingBottom', label: 'Bottom', min: 0, max: 200, unit: 'px' },
    { type: 'number', key: 'paddingLeft',   label: 'Left',   min: 0, max: 200, unit: 'px' },
  ],
});

// ── Layer & visibility ────────────────────────────────────────────────────────

export const zIndexSection = (): Section => ({
  section: 'Layer',
  // 'common.layer' doesn't exist as a translation key. The legacy panel
  // (CommonProperties.js's _appendTamanho) used 'common.zindex' (lowercase)
  // for this exact concept -- "Camada (Z-Index)" in pt-br -- reusing it here
  // gives this section a real translation instead of falling back to English.
  i18nKey: 'common.zindex',
  icon: 'layers',
  collapsible: true,
  defaultOpen: false,
  fields: [
    {
      type: 'number',
      key: 'zIndex',
      label: 'Z-Index',
      // No separate 'common.zIndex' (camelCase) translation exists -- the
      // legacy panel never translated this inline field label either (only
      // the section-level "Camada (Z-Index)" sub-label was translated), so
      // 'Z-Index' is left as a literal, language-agnostic technical term.
      min: 0,
      max: 9999,
      step: 1,
    },
  ],
});

export const opacitySection = (): Section => ({
  section: 'Opacity',
  i18nKey: 'common.opacity',
  icon: 'opacity',
  collapsible: true,
  defaultOpen: false,
  fields: [
    {
      type: 'slider',
      key: 'opacity',
      label: 'Opacity',
      i18nKey: 'common.opacity',
      min: 0,
      max: 1,
      step: 0.01,
    },
  ],
});

// ── Shadow ────────────────────────────────────────────────────────────────────

export const shadowSection = (): Section => ({
  section: 'Shadow',
  i18nKey: 'common.shadow',
  icon: 'shadow',
  collapsible: true,
  defaultOpen: false,
  fields: [
    { type: 'toggle', key: 'shadowEnabled', label: 'Enable shadow', i18nKey: 'common.shadowEnabled' },
    { type: 'number', key: 'shadowX',       label: 'X',    unit: 'px' },
    { type: 'number', key: 'shadowY',       label: 'Y',    unit: 'px' },
    { type: 'number', key: 'shadowBlur',    label: 'Blur', unit: 'px', min: 0 },
    { type: 'color',  key: 'shadowColor',   label: 'Color', i18nKey: 'common.shadowColor' },
  ],
});

// ── Text alignment ────────────────────────────────────────────────────────────

export const alignSection = (): Section => ({
  section: 'Alignment',
  i18nKey: 'common.alignment',
  icon: 'format_align_left',
  collapsible: true,
  defaultOpen: false,
  fields: [
    {
      type: 'align',
      key: 'textAlign',
      label: 'Align',
      i18nKey: 'common.textAlign',
    },
  ],
});

// ── Convenience combos (most tools need these together) ───────────────────────

/** Border + Radius — the most common shape combo. */
export const shapeSection = (): Section[] => [borderSection(), radiusSection()];

/** Border + Radius + Shadow. */
export const fullShapeSection = (): Section[] => [borderSection(), radiusSection(), shadowSection()];
