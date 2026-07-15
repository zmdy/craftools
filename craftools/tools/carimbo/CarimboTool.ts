/**
 * CarimboTool.ts — Stamp tool. Already uses dataset.ctState natively.
 */
import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import type { PropertySchema } from '../../types/PropertySchema';

export class CarimboTool extends BaseTool {

  // _syncFromDOM: no-op — dataset.ctState already populated by JS createElement()

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Outer text',
        defaultOpen: true,
        fields: [
          { type: 'text',   key: 'outerText',     label: 'Text' },
          { type: 'number', key: 'outerFontSize',  label: 'Size', min: 4, max: 30, step: 0.5 },
          { type: 'toggle', key: 'outerBold',      label: 'Bold' },
        ],
      },
      {
        section: 'Inner text',
        fields: [
          { type: 'toggle', key: 'showInnerText',  label: 'Show inner text' },
          { type: 'text',   key: 'innerText',      label: 'Text' },
          { type: 'number', key: 'innerFontSize',  label: 'Size', min: 4, max: 20, step: 0.5 },
        ],
      },
      {
        section: 'Center',
        fields: [
          {
            type: 'select', key: 'centerType', label: 'Center type',
            options: [{ value: 'text', label: 'Text' }, { value: 'none', label: 'None' }],
          },
          { type: 'text',   key: 'centerText',     label: 'Text' },
          { type: 'number', key: 'centerFontSize',  label: 'Size', min: 4, max: 40, step: 0.5 },
          { type: 'toggle', key: 'centerBold',      label: 'Bold' },
        ],
      },
      {
        section: 'Style',
        fields: [
          { type: 'font-select', key: 'fontFamily',  label: 'Font' },
          { type: 'color',       key: 'color',        label: 'Color' },
          { type: 'slider',      key: 'outerRadius',  label: 'Radius',    min: 45, max: 93, step: 1 },
          { type: 'select',      key: 'rings',         label: 'Rings',
            options: [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }] },
          { type: 'slider',      key: 'ringWidth',    label: 'Ring width', min: 0.5, max: 5, step: 0.5 },
          {
            type: 'select', key: 'separator', label: 'Separator',
            options: [
              { value: 'star',    label: 'Star' },
              { value: 'dot',     label: 'Dot' },
              { value: 'diamond', label: 'Diamond' },
              { value: 'none',    label: 'None' },
            ],
          },
        ],
      },
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    const e = element as HTMLElement & { _ctState?: Record<string, unknown> };
    if (e._ctState) e._ctState[key] = value;
    element.dispatchEvent(new CustomEvent('craftools-carimbo-regenerate', { bubbles: false }));
  }
}

CarimboTool.registeredKeys = ['carimbo'];
ToolRegistry.register({ key: 'carimbo', label: 'editor.stamp', icon: 'approval', tool: CarimboTool, draggable: true, showInFooterNav: false, category: 'elements' });
