/**
 * LetteringTool.ts — artistic per-letter/per-word text tool.
 *
 * State lives in element._craftoolsMeta (LetteringMeta), same convention as
 * ShapeTool.ts/PaperTool.ts: _syncFromDOM() mirrors it into dataset.ctState
 * (flat keys only -- nested bits like `background` and `colorPalette` get
 * their own flat-key translation tables, same pattern as ShapeTool.ts's
 * FILL_PAPER_KEYS) so PropertyRenderer can read/diff scalar values, and
 * _applyProperty() writes back into the real meta object and re-renders via
 * LetteringGenerator.buildMarkup().
 */

import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { sizePositionSection, zIndexSection } from '../../utils/CommonSchema';
import {
  LetteringGenerator, defaultLetteringMeta, defaultLetteringBackground,
  type LetteringMeta, type LetteringBackground,
} from '../../utils/LetteringGenerator';
import { renderLetteringFontPoolField } from '../../utils/LetteringFontPoolField';
import { I18n } from '../../settings/Translations.js';
import './LetteringTool_Translations.js';
import type { PropertySchema } from '../../types/PropertySchema';

const s = (key: string): string => I18n.t('letteringTool.' + key);

/** Flat panel key -> real LetteringBackground path, same small-scale pattern as ShapeTool.ts's FILL_PAPER_KEYS. */
const BG_KEYS: Record<string, keyof LetteringBackground> = {
  bgMode:         'mode',
  bgColor:        'color',
  bgBorderRadius: 'borderRadius',
  bgPadding:      'padding',
  bgBlobSeed:     'blobSeed',
};

type MetaElement = HTMLElement & { _craftoolsMeta?: LetteringMeta };

const getMeta = (element: HTMLElement): LetteringMeta =>
  (element as MetaElement)._craftoolsMeta ?? defaultLetteringMeta();

const setMeta = (element: HTMLElement, patch: Partial<LetteringMeta>): LetteringMeta => {
  const el = element as MetaElement;
  el._craftoolsMeta = { ...getMeta(element), ...patch };
  return el._craftoolsMeta;
};

// NOT `:scope > .ct-lettering-content` -- Element.ts's connectedCallback()
// (Craftools_Element._build()) moves every child present at insertion time
// into its own internal `._content` wrapper div the moment the element is
// attached to the page, so `.ct-lettering-content` stops being a direct
// child right after creation. The very first paint (at createElement(),
// before the element is inserted) still finds it either way, which is why
// this bug was invisible until the FIRST later edit -- every _applyProperty
// afterwards silently found nothing and repainted nothing. Same reason
// TextTool.ts's getTextEl()/ShapeTool.ts's svg lookup search all
// descendants instead of scoping to direct children.
const getContent = (element: HTMLElement): HTMLElement | null =>
  element.querySelector<HTMLElement>('.ct-lettering-content');

export class LetteringTool extends BaseTool {

  // ── Creation ────────────────────────────────────────────────────────────

  static createElement(_type?: string, _editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as MetaElement;
    el.setAttribute('x', '50');
    el.setAttribute('y', '50');
    el.setAttribute('w', '360');
    el.setAttribute('h', '140');
    el.setAttribute('data-craftool', 'lettering');
    el._craftoolsMeta = defaultLetteringMeta();

    const content = document.createElement('div');
    content.className = 'ct-lettering-content';
    content.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center;user-select:none;';
    el.appendChild(content);

    LetteringTool._paint(el);
    return el;
  }

  // ── Painting ────────────────────────────────────────────────────────────

  /** Rebuilds the token markup from the current meta and rebinds click-to-reroll on every token span. */
  private static _paint(element: HTMLElement): void {
    const meta = getMeta(element);
    const content = getContent(element);
    if (!content) return;

    content.innerHTML = LetteringGenerator.buildMarkup(meta);

    content.querySelectorAll<HTMLElement>('[data-ct-token]').forEach(span => {
      span.style.cursor = 'pointer';
      span.title = s('rerollLetterHint');
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(span.dataset.ctToken);
        if (!Number.isFinite(idx)) return;
        const current = getMeta(element);
        const overrides = { ...current.overrides, [idx]: { seed: LetteringGenerator.randomSeed() } };
        setMeta(element, { overrides });
        LetteringTool._paint(element);
        LetteringTool._triggerChange(element);
      });
    });
  }

  private static _regenerate(element: HTMLElement): void {
    LetteringTool._paint(element);
    LetteringTool._triggerChange(element);
  }

  private static _triggerChange(element: HTMLElement): void {
    element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
  }

  // ── State sync (meta -> dataset.ctState) ───────────────────────────────

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};

    const keys: (keyof LetteringMeta)[] = [
      'text', 'splitMode', 'arrangement', 'fontSize', 'letterSpacing', 'lineSpacing', 'textAlign',
      'bounceIntensity', 'rotationIntensity', 'skewIntensity', 'sizeIntensity', 'opacityIntensity',
      'fontMode', 'font', 'fontPool', 'color', 'colorRandom',
      'curveRadius', 'curveSpread',
      'repeatCount', 'repeatSpacing', 'repeatVariation',
    ];
    keys.forEach(k => { if (!(k in existing) && meta[k] !== undefined) patch[k] = meta[k] as unknown; });

    const bg = { ...defaultLetteringBackground(), ...(meta.background ?? {}) };
    if (!('bgEnabled' in existing)) patch.bgEnabled = bg.enabled;
    for (const [flatKey, path] of Object.entries(BG_KEYS)) {
      if (!(flatKey in existing)) patch[flatKey] = bg[path];
    }

    const palette = meta.colorPalette ?? defaultLetteringMeta().colorPalette;
    [0, 1, 2, 3].forEach(i => {
      const k = `colorPalette${i}`;
      if (!(k in existing)) patch[k] = palette[i] ?? '#888888';
    });

    if (Object.keys(patch).length) {
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
    }
  }

  // ── Schema ──────────────────────────────────────────────────────────────

  static getPropertySchema(element: HTMLElement): PropertySchema {
    const state = PropertyRenderer._readState(element);
    const arrangement = String(state.arrangement ?? 'flow');
    const isCurveLike = arrangement === 'curve' || arrangement === 'circular';
    const isRepeat = arrangement === 'repeatLines' || arrangement === 'repeatColumns';
    const fontMode = state.fontMode === 'random' ? 'random' : 'single';
    const colorRandom = state.colorRandom === true;
    const bgEnabled = state.bgEnabled === true;
    const bgMode = state.bgMode === 'blob' ? 'blob' : 'solid';

    return [
      {
        section: 'Text',
        i18nKey: 'letteringTool.sectionText',
        icon: 'text_fields',
        defaultOpen: true,
        fields: [
          { type: 'textarea', key: 'text', label: s('fieldText'), i18nKey: 'letteringTool.fieldText', rows: 2 },
          {
            type: 'custom', key: 'splitMode', label: s('splitMode'), i18nKey: 'letteringTool.splitMode',
            render: (el, onChange) => LetteringTool._renderPillGroup(
              () => (PropertyRenderer._readState(el).splitMode === 'word' ? 'word' : 'letter'),
              onChange,
              [
                { value: 'letter', label: s('splitLetter'), icon: 'text_fields' },
                { value: 'word',   label: s('splitWord'),   icon: 'splitscreen' },
              ],
            ),
          },
          {
            type: 'select', key: 'arrangement', label: s('arrangement'), i18nKey: 'letteringTool.arrangement',
            options: [
              { value: 'flow',          label: 'Flow',           i18nKey: 'letteringTool.arrangementFlow' },
              { value: 'curve',         label: 'Curve',          i18nKey: 'letteringTool.arrangementCurve' },
              { value: 'circular',      label: 'Circular',       i18nKey: 'letteringTool.arrangementCircular' },
              { value: 'repeatLines',   label: 'Repeat (lines)', i18nKey: 'letteringTool.arrangementRepeatLines' },
              { value: 'repeatColumns', label: 'Repeat (cols)',  i18nKey: 'letteringTool.arrangementRepeatColumns' },
            ],
          },
          { type: 'slider', key: 'fontSize',      label: s('fontSize'),      i18nKey: 'letteringTool.fontSize',      min: 10, max: 400, step: 1 },
          { type: 'slider', key: 'letterSpacing',  label: s('letterSpacing'), i18nKey: 'letteringTool.letterSpacing', min: -20, max: 60, step: 1 },
          { type: 'slider', key: 'lineSpacing',    label: s('lineSpacing'),   i18nKey: 'letteringTool.lineSpacing',   min: 0.8, max: 3, step: 0.05 },
          { type: 'align',  key: 'textAlign' },
        ],
      },
      {
        section: 'Per-letter style',
        i18nKey: 'letteringTool.sectionPerLetterStyle',
        icon: 'auto_awesome',
        defaultOpen: true,
        fields: [
          { type: 'slider', key: 'bounceIntensity',   label: s('bounceIntensity'),   i18nKey: 'letteringTool.bounceIntensity',   min: 0, max: 1, step: 0.05 },
          { type: 'slider', key: 'rotationIntensity', label: s('rotationIntensity'), i18nKey: 'letteringTool.rotationIntensity', min: 0, max: 1, step: 0.05 },
          { type: 'slider', key: 'skewIntensity',     label: s('skewIntensity'),     i18nKey: 'letteringTool.skewIntensity',     min: 0, max: 1, step: 0.05 },
          { type: 'slider', key: 'sizeIntensity',     label: s('sizeIntensity'),     i18nKey: 'letteringTool.sizeIntensity',     min: 0, max: 1, step: 0.05 },
          { type: 'slider', key: 'opacityIntensity',  label: s('opacityIntensity'),  i18nKey: 'letteringTool.opacityIntensity',  min: 0, max: 1, step: 0.05 },
          {
            type: 'custom', key: 'fontMode', label: s('fontMode'), i18nKey: 'letteringTool.fontMode',
            render: (el, onChange) => LetteringTool._renderPillGroup(
              () => (PropertyRenderer._readState(el).fontMode === 'random' ? 'random' : 'single'),
              onChange,
              [
                { value: 'single', label: s('fontModeSingle'), icon: 'font_download' },
                { value: 'random', label: s('fontModeRandom'), icon: 'casino' },
              ],
            ),
          },
          { type: 'font-select', key: 'font', label: s('font'), i18nKey: 'letteringTool.font', hidden: fontMode !== 'single' },
          { type: 'color-picker', key: 'color', label: s('color'), i18nKey: 'letteringTool.color', hidden: colorRandom },
          { type: 'toggle', key: 'colorRandom', label: s('colorRandom'), i18nKey: 'letteringTool.colorRandom' },
          { type: 'color-picker', key: 'colorPalette0', label: `${s('colorPalette')} 1`, hidden: !colorRandom },
          { type: 'color-picker', key: 'colorPalette1', label: `${s('colorPalette')} 2`, hidden: !colorRandom },
          { type: 'color-picker', key: 'colorPalette2', label: `${s('colorPalette')} 3`, hidden: !colorRandom },
          { type: 'color-picker', key: 'colorPalette3', label: `${s('colorPalette')} 4`, hidden: !colorRandom },
          {
            type: 'custom', key: 'rerollSeed', label: s('newRandomValues'),
            render: (_el, onChange) => LetteringTool._renderActionButton(s('newRandomValues'), 'shuffle', () => onChange(true)),
          },
        ],
      },
      ...(fontMode === 'random' ? [{
        section: 'Fonts',
        i18nKey: 'letteringTool.sectionFonts',
        icon: 'font_download',
        defaultOpen: false,
        fields: [
          {
            type: 'custom' as const, key: 'fontPool', label: s('fontPool'), i18nKey: 'letteringTool.fontPool',
            render: (el: HTMLElement, onChange: (v: unknown) => void) => renderLetteringFontPoolField(
              () => { const v = PropertyRenderer._readState(el).fontPool; return Array.isArray(v) ? v as string[] : []; },
              onChange as (v: string[]) => void,
              { selectAll: s('fontPoolSelectAll'), clearAll: s('fontPoolClearAll'), hint: s('fontPoolHint') },
            ),
          },
        ],
      }] : []),
      ...(isCurveLike ? [{
        section: 'Curve',
        i18nKey: 'letteringTool.sectionCurve',
        icon: 'gesture',
        defaultOpen: true,
        fields: [
          { type: 'slider' as const, key: 'curveRadius', label: s('curveRadius'), i18nKey: 'letteringTool.curveRadius', min: 0, max: 200, step: 1 },
          { type: 'slider' as const, key: 'curveSpread',  label: s('curveSpread'), i18nKey: 'letteringTool.curveSpread', min: 10, max: 360, step: 5 },
        ],
      }] : []),
      ...(isRepeat ? [{
        section: 'Repeat',
        i18nKey: 'letteringTool.sectionRepeat',
        icon: 'repeat',
        defaultOpen: true,
        fields: [
          { type: 'slider' as const, key: 'repeatCount',   label: s('repeatCount'),   i18nKey: 'letteringTool.repeatCount',   min: 1, max: 20, step: 1 },
          { type: 'slider' as const, key: 'repeatSpacing', label: s('repeatSpacing'), i18nKey: 'letteringTool.repeatSpacing', min: 0, max: 60, step: 1 },
          {
            type: 'custom' as const, key: 'repeatVariation', label: s('repeatVariation'), i18nKey: 'letteringTool.repeatVariation',
            render: (el: HTMLElement, onChange: (v: unknown) => void) => LetteringTool._renderPillGroup(
              () => (PropertyRenderer._readState(el).repeatVariation === 'independent' ? 'independent' : 'shared'),
              onChange,
              [
                { value: 'shared',      label: s('repeatVariationShared'),      icon: 'content_copy' },
                { value: 'independent', label: s('repeatVariationIndependent'), icon: 'shuffle' },
              ],
            ),
          },
        ],
      }] : []),
      {
        section: 'Background',
        i18nKey: 'letteringTool.sectionBackground',
        icon: 'format_color_fill',
        defaultOpen: false,
        fields: [
          { type: 'toggle', key: 'bgEnabled', label: s('bgEnabled'), i18nKey: 'letteringTool.bgEnabled' },
          {
            type: 'custom', key: 'bgMode', label: s('bgMode'), i18nKey: 'letteringTool.bgMode', hidden: !bgEnabled,
            render: (el, onChange) => LetteringTool._renderPillGroup(
              () => (PropertyRenderer._readState(el).bgMode === 'blob' ? 'blob' : 'solid'),
              onChange,
              [
                { value: 'solid', label: s('bgModeSolid'), icon: 'square' },
                { value: 'blob',  label: s('bgModeBlob'),  icon: 'blur_on' },
              ],
            ),
          },
          { type: 'color-picker', key: 'bgColor', label: s('bgColor'), i18nKey: 'letteringTool.bgColor', hidden: !bgEnabled },
          { type: 'slider', key: 'bgBorderRadius', label: s('bgBorderRadius'), i18nKey: 'letteringTool.bgBorderRadius', min: 0, max: 60, step: 1, hidden: !bgEnabled || bgMode !== 'solid' },
          { type: 'slider', key: 'bgPadding', label: s('bgPadding'), i18nKey: 'letteringTool.bgPadding', min: 0, max: 40, step: 1, hidden: !bgEnabled },
          {
            type: 'custom', key: 'bgReroll', label: s('bgReroll'), hidden: !bgEnabled || bgMode !== 'blob',
            render: (_el, onChange) => LetteringTool._renderActionButton(s('bgReroll'), 'refresh', () => onChange(LetteringGenerator.randomSeed())),
          },
        ],
      },
      sizePositionSection(),
      zIndexSection(),
    ] as PropertySchema;
  }

  // ── Small reusable custom-field renderers ──────────────────────────────

  private static _renderPillGroup(
    readValue: () => string,
    onChange: (value: unknown) => void,
    options: Array<{ value: string; label: string; icon?: string }>,
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'ct-field-row';
    wrap.style.gap = '6px';
    wrap.style.marginBottom = '4px';

    const paint = (): void => {
      const current = readValue();
      wrap.innerHTML = options.map(o => `
        <button type="button" class="craftools-pill${o.value === current ? ' active' : ''}" data-val="${o.value}" style="flex:1;justify-content:center;gap:5px;padding:7px 10px;">
          ${o.icon ? `<span class="material-symbols-outlined" style="font-size:14px;">${o.icon}</span>` : ''}
          ${o.label}
        </button>`).join('');
      wrap.querySelectorAll<HTMLButtonElement>('button[data-val]').forEach(btn => {
        btn.addEventListener('click', () => { onChange(btn.dataset.val); paint(); });
      });
    };

    paint();
    return wrap;
  }

  private static _renderActionButton(label: string, icon: string, onClick: () => void): HTMLElement {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button type="button" class="craftools-pill" style="width:100%;justify-content:center;gap:6px;padding:8px 10px;">
        <span class="material-symbols-outlined" style="font-size:15px;">${icon}</span>
        ${label}
      </button>`;
    wrap.querySelector('button')!.addEventListener('click', onClick);
    return wrap;
  }

  // ── Context bar ─────────────────────────────────────────────────────────

  static getCtxOptions(element?: HTMLElement): any[] {
    if (!element) return [];
    return [
      {
        icon: 'shuffle',
        label: s('newRandomValues'),
        command: (el: HTMLElement) => LetteringTool._applyProperty(el, 'rerollSeed', true),
      },
    ];
  }

  // ── Apply ───────────────────────────────────────────────────────────────

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);

    if (key === 'zIndex') { element.style.zIndex = String(value); return; }
    if (key === 'width')  { element.style.width  = `${value}px`; return; }
    if (key === 'height') { element.style.height = `${value}px`; return; }
    if (key === 'x')      { element.style.left = `${value}px`; element.setAttribute('x', String(value)); return; }
    if (key === 'y')      { element.style.top  = `${value}px`; element.setAttribute('y', String(value)); return; }

    if (key === 'rerollSeed') {
      setMeta(element, { seed: LetteringGenerator.randomSeed() });
      LetteringTool._regenerate(element);
      return;
    }

    if (key === 'bgReroll') {
      const meta = getMeta(element);
      const background = { ...defaultLetteringBackground(), ...(meta.background ?? {}), blobSeed: Number(value) };
      setMeta(element, { background });
      LetteringTool._regenerate(element);
      return;
    }

    if (key === 'bgEnabled') {
      const meta = getMeta(element);
      const background = { ...defaultLetteringBackground(), ...(meta.background ?? {}), enabled: Boolean(value) };
      setMeta(element, { background });
      LetteringTool._regenerate(element);
      return;
    }

    if (key in BG_KEYS) {
      const meta = getMeta(element);
      const background = { ...defaultLetteringBackground(), ...(meta.background ?? {}), [BG_KEYS[key]]: value };
      setMeta(element, { background });
      LetteringTool._regenerate(element);
      return;
    }

    if (key.startsWith('colorPalette')) {
      const i = Number(key.replace('colorPalette', ''));
      const meta = getMeta(element);
      const palette = [...(meta.colorPalette ?? defaultLetteringMeta().colorPalette)];
      palette[i] = String(value);
      setMeta(element, { colorPalette: palette });
      LetteringTool._regenerate(element);
      return;
    }

    setMeta(element, { [key]: value } as Partial<LetteringMeta>);
    LetteringTool._regenerate(element);
  }
}

// ── Self-registration ─────────────────────────────────────────────────────────

LetteringTool.registeredKeys = ['lettering'];

ToolRegistry.register({
  key:             'lettering',
  label:           'letteringTool.panelTitle',
  icon:            'auto_awesome',
  tool:            LetteringTool,
  draggable:       true,
  showInFooterNav: false,
  category:        'text',
});
