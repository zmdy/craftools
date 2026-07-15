/**
 * TextoCurvoTool.ts — TextoCurvoTool already stores state in dataset.ctState,
 * so _syncFromDOM is a no-op. _applyProperty just persists and dispatches regenerate.
 */
import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import type { PropertySchema } from '../../types/PropertySchema';

export class TextoCurvoTool extends BaseTool {

  // _syncFromDOM: no-op — dataset.ctState already populated by JS createElement()

  static getPropertySchema(element: HTMLElement): PropertySchema {
    const state = PropertyRenderer._readState(element);
    const isGradient = Boolean(state.useGradient);

    return [
      {
        section: 'Text',
        defaultOpen: true,
        fields: [
          { type: 'text',       key: 'text',          label: 'Text' },
          { type: 'font-select',key: 'fontFamily',     label: 'Font' },
          { type: 'number',     key: 'fontSize',       label: 'Size', min: 6, max: 100, unit: 'pt' },
          { type: 'number',     key: 'letterSpacing',  label: 'Spacing', min: -10, max: 30, step: 0.5 },
          { type: 'toggle',     key: 'bold',           label: 'Bold' },
          { type: 'toggle',     key: 'italic',         label: 'Italic' },
        ],
      },
      {
        section: 'Arc',
        fields: [
          {
            type: 'select', key: 'mode', label: 'Mode',
            options: [
              { value: 'arc-top',     label: 'Arc top' },
              { value: 'arc-bottom',  label: 'Arc bottom' },
              { value: 'full-circle', label: 'Full circle' },
            ],
          },
          { type: 'slider', key: 'radius',      label: 'Radius',      min: 20, max: 200 },
          { type: 'slider', key: 'startOffset', label: 'Start offset', min: 0,  max: 100,
            hidden: state.mode !== 'full-circle' },
        ],
      },
      {
        section: 'Color',
        fields: [
          { type: 'toggle',         key: 'useGradient', label: 'Use gradient' },
          { type: 'color',          key: 'color',       label: 'Color',    hidden: isGradient },
          { type: 'color-gradient', key: 'gradient',    label: 'Gradient', hidden: !isGradient },
        ],
      },
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    // Also write to _ctState for backward compat with JS renderer
    const e = element as HTMLElement & { _ctState?: Record<string, unknown> };
    if (e._ctState) {
      if (key === 'gradient') {
        const g = value as { from: string; to: string; angle: number };
        e._ctState.gradFrom  = g.from;
        e._ctState.gradTo    = g.to;
        e._ctState.gradAngle = g.angle;
      } else {
        e._ctState[key] = value;
      }
    }
    element.dispatchEvent(new CustomEvent('craftools-textocurvo-regenerate', { bubbles: false }));
  }
}

TextoCurvoTool.registeredKeys = ['textocurvo'];
ToolRegistry.register({ key: 'textocurvo', label: 'editor.curvedText', icon: 'text_rotation_none', tool: TextoCurvoTool, draggable: true, showInFooterNav: false, category: 'text' });
