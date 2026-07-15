/**
 * VariableContentTool.ts — Variable content element (text driven by data variables).
 * State stored in CSS styles (same pattern as TextTool).
 */
import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { borderSection, radiusSection, zIndexSection } from '../../utils/CommonSchema';
import type { PropertySchema } from '../../types/PropertySchema';

const getContent = (el: HTMLElement) =>
  el.querySelector<HTMLElement>('[contenteditable], div:first-child') ?? null;

const rgbToHex = (rgb: string) => {
  const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  return m ? '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('') : rgb;
};

export class VariableContentTool extends BaseTool {

  protected static _syncFromDOM(element: HTMLElement): void {
    const content = getContent(element);
    if (!content) return;
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};
    if (!('font'     in existing)) patch.font     = (content.style.fontFamily || 'DM Sans').replace(/['"]/g,'').split(',')[0].trim();
    if (!('fontSize' in existing)) patch.fontSize = parseFloat(content.style.fontSize) || 16;
    if (!('color'    in existing)) patch.color    = rgbToHex(content.style.color || '#1a1a1a');
    if (!('textAlign' in existing)) patch.textAlign = content.style.textAlign || 'left';
    if (!('bold'     in existing)) patch.bold     = content.style.fontWeight === 'bold' || content.style.fontWeight === '700';
    if (!('italic'   in existing)) patch.italic   = content.style.fontStyle  === 'italic';
    if (Object.keys(patch).length)
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Typography',
        defaultOpen: true,
        fields: [
          { type: 'font-select', key: 'font',      label: 'Font' },
          { type: 'slider',      key: 'fontSize',  label: 'Size', min: 8, max: 200, step: 1 },
          { type: 'align',       key: 'textAlign' },
          { type: 'toggle',      key: 'bold',      label: 'Bold' },
          { type: 'toggle',      key: 'italic',    label: 'Italic' },
          { type: 'color',       key: 'color',     label: 'Color' },
        ],
      },
      borderSection(),
      radiusSection(),
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    const content = getContent(element);
    if (!content) return;
    switch (key) {
      case 'font':      content.style.fontFamily = `'${value}', sans-serif`; break;
      case 'fontSize':  content.style.fontSize   = `${value}px`; break;
      case 'color':     content.style.color       = String(value); break;
      case 'textAlign': content.style.textAlign   = String(value); break;
      case 'bold':      content.style.fontWeight  = value ? 'bold' : 'normal'; break;
      case 'italic':    content.style.fontStyle   = value ? 'italic' : 'normal'; break;
      case 'borderRadius': content.style.borderRadius = `${value}px`; break;
      case 'zIndex':    element.style.zIndex       = String(value); break;
    }
  }
}

VariableContentTool.registeredKeys = ['conteudovariavel'];
ToolRegistry.register({ key: 'conteudovariavel', label: 'editor.variableContent', icon: 'data_object', tool: VariableContentTool, draggable: true, showInFooterNav: false, category: 'data' });
