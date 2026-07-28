import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { borderSection, radiusSection, variableBindingSection } from '../../utils/CommonSchema';
import { parseVariableBinding, stringifyVariableBinding } from '../../utils/fields/variable-binding.field';
import { BarcodeGenerator, type BarcodeOptions } from '../../utils/BarcodeGenerator';
import type { VariableBinding } from '../../utils/VariableEngine';
import type { PropertySchema } from '../../types/PropertySchema';
// Registers the 'barcodeTool.*' i18n keys used by this schema's i18nKey
// entries below (falls back to the literal English labels without it, via
// utils/i18nLabel.ts's tr() -- see QRCodeTool.ts for the same pattern).
import './BarcodeTool_Translations.js';

interface BarcodeMeta {
  format:          string;
  text:            string;
  color:           string;
  background:      string;
  showText:        boolean;
  borderWidth:     number;
  borderStyle:     string;
  borderColor:     string;
  borderRadius:    number;
  variableBinding: VariableBinding | null;
}

const getMeta = (el: HTMLElement): BarcodeMeta =>
  (el as HTMLElement & { _craftoolsMeta?: BarcodeMeta })._craftoolsMeta ?? {
    format: 'code39', text: 'CRAFTOOLS', color: '#000000', background: '#ffffff', showText: true,
    borderWidth: 0, borderStyle: 'none', borderColor: '#000000', borderRadius: 0,
    variableBinding: null,
  };

const setMeta = (el: HTMLElement, patch: Partial<BarcodeMeta>): void => {
  const e = el as HTMLElement & { _craftoolsMeta?: BarcodeMeta };
  e._craftoolsMeta = { ...getMeta(el), ...patch };
};

export class BarcodeTool extends BaseTool {

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element) as unknown as Record<string, unknown>;
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};
    ['format','text','color','background','showText','borderWidth','borderStyle','borderRadius']
      .forEach(k => { if (!(k in existing) && meta[k] !== undefined) patch[k] = meta[k]; });
    // borderColor: meta stores a bare hex (pre-gradient-border); wrap it in
    // the JSON ColorPickerValue shape the color-picker field expects (same
    // as ImageTool.ts/QRCodeTool.ts's matching case).
    if (!('borderColor' in existing)) {
      patch.borderColor = JSON.stringify({ mode: 'solid', solid: (meta.borderColor as string) || '#000000', gradient: { type: 'linear', angle: 90, stops: ['#f97316', '#facc15'] } });
    }
    // variableBinding is stored as a JSON *string* in ctState (see
    // variable-binding.field.ts) -- meta.variableBinding itself stays a
    // real object, unlike the plain keys copied above.
    if (!('variableBinding' in existing)) {
      patch.variableBinding = stringifyVariableBinding(meta.variableBinding as VariableBinding | null);
    }
    if (Object.keys(patch).length)
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
  }

  /**
   * Default meta object for a freshly-created barcode element. Recovered
   * from the pre-migration BarcodeTool.js (deleted by the "Purge legacy
   * JS" commit) -- the schema-driven file kept only a truncated stub
   * missing the border and variableBinding fields.
   */
  public static getDefaultMeta(): BarcodeMeta {
    return {
      format: 'code39',
      text: 'CRAFTOOLS',
      color: '#000000',
      background: '#ffffff',
      showText: true,
      borderWidth: 0,
      borderStyle: 'none',
      borderColor: '#000000',
      borderRadius: 0,
      variableBinding: null,
    };
  }

  public static _esc(val: unknown): string {
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Reconstructs the SVG from the element's current _craftoolsMeta. Called
   * directly after every property edit (desktop schema panel's
   * _applyProperty() below) -- previously this referenced an undefined
   * setMeta helper (ReferenceError at runtime) and dispatched a
   * 'craftools-barcode-regenerate' custom event that nothing listened for,
   * so edits never actually touched the rendered SVG.
   */
  public static _regenerate(element: HTMLElement): void {
    const meta = getMeta(element);
    const binding = meta.variableBinding;
    if (binding && binding.type) {
      import('../../utils/VariableEngine.js').then(({ VariableEngine }) => {
        VariableEngine.resolvePreview(binding).then(value => {
          BarcodeTool._renderContent(element, meta, value);
        });
      });
      return;
    }
    BarcodeTool._renderContent(element, meta, null);
  }

  /**
   * boundValue: when non-null (element bound to a variable), replaces the
   * manual text (meta.text) with the resolved variable value (editor
   * preview only; real per-repetition values for Agenda export are
   * resolved by AgendaExport.ts).
   */
  private static _renderContent(element: HTMLElement, meta: BarcodeMeta, boundValue: string | null): void {
    const text = boundValue !== null ? boundValue : meta.text;
    const svgString = BarcodeGenerator.buildSvgString(text, {
      format: meta.format as BarcodeOptions['format'],
      color: meta.color,
      background: meta.background,
      showText: meta.showText,
    });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = svgString;
    const fresh = wrapper.firstElementChild as SVGElement;

    const svg = element.querySelector<SVGElement>('svg');
    if (svg) {
      svg.setAttribute('viewBox', fresh.getAttribute('viewBox') ?? '');
      svg.innerHTML = fresh.innerHTML;
    } else {
      fresh.style.userSelect = 'none';
      fresh.style.pointerEvents = 'none';
      element.appendChild(fresh);
    }

    BarcodeTool._triggerChange(element);
  }

  private static _triggerChange(element: HTMLElement): void {
    element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
  }

  /**
   * Builds a fresh craftools-element (data-craftool="barcode") with a
   * real barcode SVG inside. Recovered from the pre-migration
   * BarcodeTool.js (deleted by the "Purge legacy JS" commit without this
   * logic being ported) -- the previous file had no createElement() at
   * all, throwing "createElement is not a function" for every barcode
   * element creation.
   */
  public static createElement(_type: string, _editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as HTMLElement & { _craftoolsMeta?: BarcodeMeta };
    el.setAttribute('x', '50');
    el.setAttribute('y', '50');
    el.setAttribute('w', '220');
    el.setAttribute('h', '100');
    el.setAttribute('data-craftool', 'barcode');

    el._craftoolsMeta = BarcodeTool.getDefaultMeta();

    const svg = BarcodeGenerator.buildSvgElement(el._craftoolsMeta.text, {
      format: el._craftoolsMeta.format as BarcodeOptions['format'],
      color: el._craftoolsMeta.color,
      background: el._craftoolsMeta.background,
      showText: el._craftoolsMeta.showText,
    });
    svg.style.userSelect = 'none';
    svg.style.pointerEvents = 'none';

    el.appendChild(svg);

    return el;
  }

  static getPropertySchema(element: HTMLElement): PropertySchema {
    const state = PropertyRenderer._readState(element);
    return [
      {
        section: 'Barcode',
        i18nKey: 'barcodeTool.sectionBarcode',
        icon: 'barcode_scanner',
        defaultOpen: true,
        fields: [
          {
            type: 'select', key: 'format', label: 'Format', i18nKey: 'barcodeTool.format',
            options: [
              { value: 'code39', label: 'Code 39 (text/numbers)',        i18nKey: 'barcodeTool.formatCode39' },
              { value: 'ean13',  label: 'EAN-13 (product, 12-13 digits)', i18nKey: 'barcodeTool.formatEan13' },
            ],
          },
          { type: 'text',         key: 'text',       label: 'Content',    i18nKey: 'barcodeTool.content' },
          { type: 'color-picker', key: 'color',      label: 'Bar color',  i18nKey: 'barcodeTool.colorBar' },
          { type: 'color-picker', key: 'background', label: 'Background', i18nKey: 'barcodeTool.colorBackground' },
          { type: 'toggle',       key: 'showText',   label: 'Show text',  i18nKey: 'barcodeTool.showText' },
        ],
      },
      borderSection(),
      radiusSection(),
      variableBindingSection(),
    ] as PropertySchema;
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    if (key === 'variableBinding') {
      setMeta(element, { variableBinding: parseVariableBinding(value) });
    } else {
      setMeta(element, { [key]: value } as Partial<BarcodeMeta>);
    }

    // Border/radius are purely visual (never rebuild the barcode SVG for
    // them, unlike every other key) -- previously these fields were stored
    // in meta but NEVER actually painted onto any node (no border/radius
    // application code existed anywhere in this file), so changing them in
    // the panel silently did nothing visible. Painted onto `element` itself
    // (the outer host, framing the barcode SVG inside it) since this tool
    // has no separate style target. (This tool's own `background` field --
    // the barcode's SVG fill color -- is unrelated to CommonSchema.ts's new
    // backgroundSection(); the key name collision is why that generic
    // fill/opacity section isn't offered here, unlike Text/Image/QRCode.)
    if (key === 'borderWidth' || key === 'borderStyle' || key === 'borderColor') {
      const meta = getMeta(element);
      this._paintBorder(element, meta.borderWidth, meta.borderStyle, meta.borderColor);
      return;
    }
    if (key === 'borderRadius') {
      element.style.borderRadius = `${value}px`;
      return;
    }

    BarcodeTool._regenerate(element);
  }
}

BarcodeTool.registeredKeys = ['barcode'];
// icon matches the desktop sidebar (index.html #pwa-sidebar-barcode) --
// 'barcode' isn't a real Material Symbol name (renders blank).
ToolRegistry.register({ key: 'barcode', label: 'editor.barcode', icon: 'barcode_reader', tool: BarcodeTool, draggable: true, showInFooterNav: false, category: 'elements' });
