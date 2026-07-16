import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { borderSection, radiusSection } from '../../utils/CommonSchema';
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
    if (Object.keys(patch).length)
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
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
              { value: 'code39', label: 'Code 39 (text/numbers)' },
              { value: 'ean13',  label: 'EAN-13 (product, 12-13 digits)' },
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
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    const e = element as HTMLElement & { _craftoolsMeta?: Record<string, unknown> };
    if (e._craftoolsMeta) e._craftoolsMeta[key] = value;
    element.dispatchEvent(new CustomEvent('craftools-barcode-regenerate', { bubbles: false }));
  }
}

BarcodeTool.registeredKeys = ['barcode'];
ToolRegistry.register({ key: 'barcode', label: 'editor.barcode', icon: 'barcode', tool: BarcodeTool, draggable: true, showInFooterNav: false, category: 'elements' });
