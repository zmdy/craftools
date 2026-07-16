// @ts-nocheck
import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { borderSection, radiusSection, variableBindingSection } from '../../utils/CommonSchema';
import { parseVariableBinding, stringifyVariableBinding } from '../../utils/fields/variable-binding.field';
import type { PropertySchema } from '../../types/PropertySchema';

const getMeta = (el: HTMLElement) =>
  (el as HTMLElement & { _craftoolsMeta?: Record<string, unknown> })._craftoolsMeta ?? {};

export class BarcodeTool extends BaseTool {

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};
    ['format','text','color','background','showText','borderWidth','borderStyle','borderColor','borderRadius']
      .forEach(k => { if (!(k in existing) && meta[k] !== undefined) patch[k] = meta[k]; });
    // variableBinding is stored as a JSON *string* in ctState (see
    // variable-binding.field.ts) -- meta.variableBinding itself stays a
    // real object, unlike the plain keys copied above.
    if (!('variableBinding' in existing)) {
      patch.variableBinding = stringifyVariableBinding(meta.variableBinding as any);
    }
    if (Object.keys(patch).length)
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
  }

  // ─── Adapters for MobileToolbar ──────────────────────────────────────────────
  public static getDefaultMeta(): Record<string, unknown> {
    return { format: 'code39', text: '', color: '#000000', background: '#ffffff', showText: true };
  }
  public static _esc(val: unknown): string { return String(val ?? '').replace(/"/g, '&quot;'); }
  public static _regenerate(element: HTMLElement): void {
    setMeta(element, getMeta(element));
    element.dispatchEvent(new CustomEvent('craftools-barcode-regenerate', { bubbles: false }));
  }
  // ───────────────────────────────────────────────────────────────────────────

  static getPropertySchema(element: HTMLElement): PropertySchema {
    const state = PropertyRenderer._readState(element);
    return [
      {
        section: 'Barcode',
        defaultOpen: true,
        fields: [
          {
            // BarcodeGenerator.js's static FORMATS = ['code39', 'ean13'] --
            // those are the only two formats actually implemented. The
            // schema used to also offer code128/ean8/upc/itf14, which
            // silently produced nothing/incorrect output when picked.
            type: 'select', key: 'format', label: 'Format', i18nKey: 'barcodeTool.format',
            options: [
              { value: 'code39', label: 'Code 39 (text/numbers)',       i18nKey: 'barcodeTool.formatCode39' },
              { value: 'ean13',  label: 'EAN-13 (product, 12-13 digits)', i18nKey: 'barcodeTool.formatEan13' },
            ],
          },
          { type: 'text',   key: 'text',       label: 'Content' },
          { type: 'color',  key: 'color',       label: 'Bar color' },
          { type: 'color',  key: 'background',  label: 'Background' },
          { type: 'toggle', key: 'showText',    label: 'Show text' },
        ],
      },
      borderSection(),
      radiusSection(),
      variableBindingSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    const e = element as HTMLElement & { _craftoolsMeta?: Record<string, unknown> };
    if (e._craftoolsMeta) {
      // value arrives as the field's stringified form -- parse it back to a
      // real object (or null) before it lands in _craftoolsMeta, since
      // _regenerate() reads meta.variableBinding.type directly.
      e._craftoolsMeta[key] = key === 'variableBinding' ? parseVariableBinding(value) : value;
    }
    element.dispatchEvent(new CustomEvent('craftools-barcode-regenerate', { bubbles: false }));
  }
}

BarcodeTool.registeredKeys = ['barcode'];
ToolRegistry.register({ key: 'barcode', label: 'editor.barcode', icon: 'barcode', tool: BarcodeTool, draggable: true, showInFooterNav: false, category: 'elements' });
