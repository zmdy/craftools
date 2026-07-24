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

/**
 * `borderColor` is the standardized solid-OR-gradient picker (see
 * utils/fields/color-picker.field.ts / utils/ColorPickerUI.ts) -- same
 * field type PageTool.ts's page background and every tool's `color` field
 * already use. A gradient border renders via CSS `border-image` (there's no
 * native gradient `border-color`); see BaseTool.ts's `_applyBorder()`
 * helper, which any tool spreading this section into its schema should call
 * from `_applyProperty()`/`_syncFromDOM()` to get solid-and-gradient border
 * handling with zero extra per-tool code.
 *
 * `borderStyle` lists every CSS `border-style` keyword (minus `hidden`,
 * which is visually identical to `none` and not worth a second entry) --
 * previously only solid/dashed/dotted/none were offered even though the
 * others are just as valid CSS.
 */
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
      type: 'color-picker',
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
        { value: 'solid',  label: 'Solid',  i18nKey: 'common.borderSolid' },
        { value: 'dashed', label: 'Dashed', i18nKey: 'common.borderDashed' },
        { value: 'dotted', label: 'Dotted', i18nKey: 'common.borderDotted' },
        { value: 'double', label: 'Double', i18nKey: 'common.borderDouble' },
        { value: 'groove', label: 'Groove', i18nKey: 'common.borderGroove' },
        { value: 'ridge',  label: 'Ridge',  i18nKey: 'common.borderRidge' },
        { value: 'inset',  label: 'Inset',  i18nKey: 'common.borderInset' },
        { value: 'outset', label: 'Outset', i18nKey: 'common.borderOutset' },
        { value: 'none',   label: 'None',   i18nKey: 'common.borderNone' },
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

export const marginSection = (): Section => ({
  section: 'Margin',
  i18nKey: 'common.margin',
  icon: 'margin',
  collapsible: true,
  defaultOpen: false,
  fields: [
    { type: 'number', key: 'marginTop',    label: 'Top',    i18nKey: 'common.top',    min: 0, max: 200, unit: 'px' },
    { type: 'number', key: 'marginRight',  label: 'Right',  i18nKey: 'common.right',  min: 0, max: 200, unit: 'px' },
    { type: 'number', key: 'marginBottom', label: 'Bottom', i18nKey: 'common.bottom', min: 0, max: 200, unit: 'px' },
    { type: 'number', key: 'marginLeft',   label: 'Left',   i18nKey: 'common.left',   min: 0, max: 200, unit: 'px' },
  ],
});

/**
 * "Espelhar em páginas alternadas" -- a single per-element toggle
 * (`flipAlternate`, stored in `dataset.ctState` like any other schema
 * field, no special `_applyProperty()` handling needed on the tool's own
 * side) that PageTool.ts's "duplicar página" (alternate clone) and
 * AgendaExport.ts's alternate-page export both read to decide whether to
 * mirror the element's actual CONTENT (an extra `scaleX(-1)` on top of the
 * position/rotation mirroring those two already do) on the alternated
 * copy, not just its position. Off by default -- most elements (text,
 * variable content, etc.) look wrong mirrored; this is opt-in specifically
 * for content where a horizontal flip still reads correctly, e.g. photos
 * (a person looking left instead of right is usually fine) or directional
 * shapes/icons (an arrow, a decorative corner flourish). See
 * PageTool.ts's `_duplicatePage()` and AgendaExport.ts's
 * `_applyAlternateLayout()` for where this is actually consumed.
 */
export const flipAlternateSection = (): Section => ({
  section: 'Alternate Flip',
  i18nKey: 'common.flipAlternateSection',
  icon: 'flip',
  collapsible: true,
  defaultOpen: false,
  fields: [
    {
      type: 'toggle',
      key: 'flipAlternate',
      label: 'Flip content on alternate pages',
      i18nKey: 'common.flipAlternate',
    },
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

/**
 * Size + Position + Z-Index, combined into one accordion -- matches the
 * legacy "Tamanho & Posicionamento" panel (CommonProperties.js's
 * _appendTamanho()), which zIndexSection() alone didn't reproduce (size/
 * position had no schema equivalent at all before this).
 *
 * @param opts.autoFit  When true, adds an "auto-fit to text" toggle above
 *   the W/H fields (legacy: config.autoFitText) that disables manual W/H
 *   editing while the flag is on. The toggle only flips the shared
 *   `element._craftoolsAutoResize` expando (kept in sync by BaseTool.ts's
 *   default _applyProperty(), see the 'autoFit' key there) -- actually
 *   resizing the element to fit its content is the tool's own job (call
 *   `AutoFitText.applyAutoSize(element, textEl)`; see TextTool.ts).
 */
export const sizePositionSection = (opts: { autoFit?: boolean } = {}): Section => {
  const isAutoFitOn = (el: HTMLElement): boolean =>
    (el as unknown as { _craftoolsAutoResize?: boolean })._craftoolsAutoResize === true;

  const fields: Section['fields'] = [
    { type: 'divider', key: 'div-size', icon: 'aspect_ratio', label: 'Size', i18nKey: 'common.size' },
  ];

  if (opts.autoFit) {
    fields.push({
      type: 'toggle',
      key: 'autoFit',
      label: 'Auto-fit to text',
      i18nKey: 'common.autoFitText',
    });
  }

  fields.push(
    { type: 'number', key: 'width',  label: 'W', min: 10, unit: 'px', ...(opts.autoFit ? { disabled: isAutoFitOn } : {}) },
    { type: 'number', key: 'height', label: 'H', min: 10, unit: 'px', ...(opts.autoFit ? { disabled: isAutoFitOn } : {}) },
    { type: 'divider', key: 'div-position', icon: 'open_with', label: 'Position', i18nKey: 'common.position' },
    { type: 'number', key: 'x', label: 'X', unit: 'px' },
    { type: 'number', key: 'y', label: 'Y', unit: 'px' },
    { type: 'divider', key: 'div-zindex', icon: 'layers', label: 'Layer', i18nKey: 'common.zindex' },
    { type: 'number', key: 'zIndex', label: 'Z-Index', min: 1, max: 9999 },
  );

  return {
    section: 'Size & Position',
    i18nKey: 'common.sectionTamanho',
    icon: 'straighten',
    collapsible: true,
    defaultOpen: false,
    fields,
  };
};

// ── Background fill ──────────────────────────────────────────────────────────

/**
 * Solid-or-gradient background fill + an independent opacity slider for
 * JUST that fill (not the whole element -- text/icons/other content drawn
 * on top stay fully opaque). Any tool can spread this into its schema; wire
 * it up by calling BaseTool.ts's `_applyBackground()` helper from
 * `_applyProperty()` for the 'background'/'backgroundOpacity' keys (and
 * `_syncFromDOM()`'s companion helper to prime initial values) -- see
 * TextTool.ts/ImageTool.ts for the reference wiring.
 *
 * Implemented as a dedicated `.ct-bg-layer` div painted behind the
 * element's own content (see BaseTool.ts) rather than setting
 * `background`+`opacity` directly on the style target, specifically so the
 * opacity slider only fades the fill -- setting a bare CSS `opacity` on a
 * node that also contains the tool's real content would fade that content
 * too.
 */
export const backgroundSection = (): Section => ({
  section: 'Background',
  i18nKey: 'common.sectionBackground',
  icon: 'format_color_fill',
  collapsible: true,
  defaultOpen: false,
  fields: [
    {
      type: 'color-picker',
      key: 'background',
      label: 'Fill',
      i18nKey: 'common.background',
      defaultSolid: 'transparent',
    },
    {
      type: 'slider',
      key: 'backgroundOpacity',
      label: 'Opacity',
      i18nKey: 'common.backgroundOpacity',
      min: 0,
      max: 1,
      step: 0.01,
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

// ── Page alignment ────────────────────────────────────────────────────────────

/**
 * 6-button grid ("Alinhar na página") that snaps the element to the page
 * edges/center via SnapEngine.align() -- matches the legacy compact bar
 * from CommonProperties.js's _appendAlinhamento(). Fire-and-forget: there's
 * no persisted value, each click just re-runs the alignment calculation
 * against the element's current size (see BaseTool.ts's default
 * _applyProperty(), which special-cases the 'pageAlign' key).
 */
export const pageAlignSection = (): Section => ({
  section: 'Align on page',
  i18nKey: 'common.align',
  icon: 'align_horizontal_left',
  collapsible: true,
  defaultOpen: false,
  fields: [
    { type: 'page-align', key: 'pageAlign' },
  ],
});

// ── Internal (content) alignment ─────────────────────────────────────────────

/**
 * 6-button grid ("Alinhamento interno") that positions an element's own
 * CONTENT within its box -- same visual layout as pageAlignSection() above
 * (that's the explicit reference pattern), but a real persisted value
 * ("h-v", e.g. "center-center") instead of a fire-and-forget action. Each
 * opting-in tool applies it its own way in _applyProperty() (text-family
 * tools via BaseTool._applyTextContentAlign(); ImageTool via native CSS
 * object-position) since there's no single CSS property that means
 * "content alignment" the same way across every tool's DOM shape -- see
 * content-align.field.ts's own doc comment.
 */
export const contentAlignSection = (): Section => ({
  section: 'Internal alignment',
  i18nKey: 'common.contentAlign',
  icon: 'filter_center_focus',
  collapsible: true,
  defaultOpen: false,
  fields: [
    { type: 'content-align', key: 'contentAlign' },
  ],
});

// ── Variable binding ──────────────────────────────────────────────────────────

/**
 * "Texto Variável" accordion (utils/VariablePanel.js) -- lets the user bind
 * an element's content to a data variable (date, sequential number/text,
 * page number, link, emoji, API phrase, Emoji Kitchen, Mini Calendar), with
 * live preview and cross-element linking. Shared by QRCodeTool, BarcodeTool
 * and VariableContentTool -- matches MobileToolbar.js's mini-panels, which
 * already offer this on mobile for the same three tools.
 *
 * @param opts.defaultOpen  VariableContentTool opens this first and expanded
 *   by default (it IS the tool's whole purpose); QRCodeTool/BarcodeTool treat
 *   it as a secondary, collapsed-by-default option alongside their content
 *   config. Default: false.
 */
export const variableBindingSection = (opts: { defaultOpen?: boolean } = {}): Section => ({
  section: 'Variable',
  i18nKey: 'variablePanel.title',
  icon: 'data_object',
  collapsible: true,
  defaultOpen: opts.defaultOpen ?? false,
  fields: [
    { type: 'variable-binding', key: 'variableBinding' },
  ],
});

// ── Convenience combos (most tools need these together) ───────────────────────

/** Border + Radius — the most common shape combo. */
export const shapeSection = (): Section[] => [borderSection(), radiusSection()];

/** Border + Radius + Shadow. */
export const fullShapeSection = (): Section[] => [borderSection(), radiusSection(), shadowSection()];

/**
 * Border + Radius + Padding + Margin, combined into ONE accordion with
 * icon+label sub-headers between each group -- matches the legacy "Forma"
 * accordion (CommonProperties.js's _appendForma()). Using
 * shapeSection()/paddingSection()/marginSection() separately opens each as
 * its own accordion instead of the single grouped "Forma" panel the legacy
 * UI has; use formaSection() when parity with that layout matters.
 *
 * Each block can be dropped via opts, mirroring _appendForma()'s
 * config.border/radius/padding/margin flags.
 */
export const formaSection = (
  opts: { border?: boolean; radius?: boolean; padding?: boolean; margin?: boolean } = {},
): Section => {
  const { border = true, radius = true, padding = true, margin = true } = opts;
  const fields: Section['fields'] = [];

  if (border) {
    fields.push(
      { type: 'divider', key: 'div-forma-border', icon: 'border_style', label: 'Border', i18nKey: 'common.border' },
      ...borderSection().fields,
    );
  }
  if (radius) {
    fields.push(
      { type: 'divider', key: 'div-forma-radius', icon: 'rounded_corner', label: 'Radius', i18nKey: 'common.radius' },
      ...radiusSection().fields,
    );
  }
  if (padding) {
    fields.push(
      { type: 'divider', key: 'div-forma-padding', icon: 'padding', label: 'Padding', i18nKey: 'common.padding' },
      ...paddingSection().fields,
    );
  }
  if (margin) {
    fields.push(
      { type: 'divider', key: 'div-forma-margin', icon: 'margin', label: 'Margin', i18nKey: 'common.margin' },
      ...marginSection().fields,
    );
  }

  return {
    section: 'Shape',
    i18nKey: 'common.sectionForma',
    icon: 'shapes',
    collapsible: true,
    defaultOpen: false,
    fields,
  };
};
