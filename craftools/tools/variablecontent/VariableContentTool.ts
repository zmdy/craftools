/**
 * VariableContentTool.ts — Variable content element (text driven by data variables).
 * State stored in CSS styles (same pattern as TextTool).
 */
import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { borderSection, radiusSection, zIndexSection, variableBindingSection } from '../../utils/CommonSchema';
import { parseVariableBinding, stringifyVariableBinding } from '../../utils/fields/variable-binding.field';
import { AutoFitText } from '../../utils/AutoFitText.js';
import { I18n } from '../../settings/Translations.js';
import type { VariableBinding } from '../../utils/VariableEngine';
import type { PropertySchema } from '../../types/PropertySchema';
// Registers the 'variableContentTool.*' i18n keys used by I18n.t() calls
// below (placeholder text) -- without this side-effect import the keys are
// never registered and I18n.t() falls back to returning the raw key string.
import './VariableContentTool_Translations.js';

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
    // The binding lives on the element itself (element._craftoolsVariable),
    // not in a _craftoolsMeta object like Barcode/QRCode -- same convention
    // VariablePanel.ts's _getElementBinding() already relies on for
    // cross-element "Vincular a" lookups. Stored here as a JSON *string* in
    // ctState (see variable-binding.field.ts for why).
    if (!('variableBinding' in existing)) {
      const binding = (element as HTMLElement & { _craftoolsVariable?: VariableBinding | null })._craftoolsVariable;
      patch.variableBinding = stringifyVariableBinding(binding);
    }
    if (Object.keys(patch).length)
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
  }

  /** Escapes a value for safe use inside an HTML attribute (emojiKitchen <img src>). */
  private static _escAttr(val: unknown): string {
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ─── Adapters for MobileToolbar ──────────────────────────────────────────────
  /**
   * Resolves and shows the configured variable's value -- an <img> for
   * emojiKitchen/miniCalendar (real markup, via innerHTML), plain text for
   * everything else. With no binding, shows a placeholder inviting the user
   * to configure one. Recovered from the pre-migration VariableContentTool.js
   * (deleted by the "Purge legacy JS" commit) -- the schema-driven file kept
   * only a bare-bones stub that always used innerText, so emojiKitchen combos
   * and mini-calendar cards never actually rendered their real content.
   */
  public static _applyVariablePreview(element: HTMLElement, textEl: HTMLElement | null, binding: VariableBinding | null): void {
    if (!textEl) return;
    if (binding && binding.type) {
      textEl.style.whiteSpace = 'pre-wrap';
      textEl.textContent = I18n.t('variablePanel.previewLoading');
      import('../../utils/VariableEngine.js').then(({ VariableEngine }) => {
        VariableEngine.resolvePreview(binding).then(val => {
          if (binding.type === 'emojiKitchen') {
            // Real markup (not typed text) -- see the miniCalendar note below
            // about why whiteSpace goes back to 'normal' for HTML content.
            textEl.style.whiteSpace = 'normal';
            textEl.innerHTML = val
              ? `<img src="${VariableContentTool._escAttr(val)}" style="max-width:100%; max-height:100%; display:block; margin:0 auto; object-fit:contain;">`
              : '—';
          } else if (binding.type === 'miniCalendar') {
            // The value here is already the card's full HTML (several nested
            // divs, each with line breaks/indentation between tags -- normal
            // for template-literal-generated HTML). 'white-space: pre-wrap'
            // (needed to preserve line breaks for typed text) would make the
            // browser render all that internal whitespace as visible space,
            // inflating/decentering the card -- so real HTML goes back to
            // normal whitespace collapsing here.
            textEl.style.whiteSpace = 'normal';
            textEl.innerHTML = val || '—';
          } else {
            textEl.style.whiteSpace = 'pre-wrap';
            textEl.textContent = (val && String(val).length) ? val : '—';
          }
          AutoFitText.applyAutoSize(element, textEl);
        });
      });
    } else {
      textEl.style.whiteSpace = 'pre-wrap';
      textEl.textContent = I18n.t('variableContentTool.placeholder') || 'Configure uma variável...';
    }
  }
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Toggles bold/italic/underline on the whole element (there's no manual
   * text selection to format -- content is always the resolved variable
   * value, never typed by hand).
   */
  private static _toggleCtxStyle(
    element: HTMLElement,
    cssProp: 'fontWeight' | 'fontStyle' | 'textDecoration',
    onValue: string,
    offValue: string,
  ): void {
    const text = getContent(element);
    if (!text) return;
    text.style[cssProp] = (text.style[cssProp] === onValue) ? offValue : onValue;
    AutoFitText.applyAutoSize(element, text);
    element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
  }

  static getCtxOptions(): Array<{ icon: string; label: string; command: (element: HTMLElement) => void }> {
    return [
      {
        icon: 'format_bold',
        label: I18n.t('textTool.bold'),
        command: (element: HTMLElement) => VariableContentTool._toggleCtxStyle(element, 'fontWeight', 'bold', 'normal'),
      },
      {
        icon: 'format_italic',
        label: I18n.t('textTool.italic'),
        command: (element: HTMLElement) => VariableContentTool._toggleCtxStyle(element, 'fontStyle', 'italic', 'normal'),
      },
      {
        icon: 'format_underlined',
        label: I18n.t('textTool.underline'),
        command: (element: HTMLElement) => VariableContentTool._toggleCtxStyle(element, 'textDecoration', 'underline', 'none'),
      },
    ];
  }

  /**
   * Builds a fresh `<craftools-element data-craftool="conteudovariavel">`
   * showing a placeholder until a variable is configured via the panel.
   * Recovered from the pre-migration VariableContentTool.js (deleted by the
   * "Purge legacy JS" commit without this logic being ported) -- the
   * previous file had no createElement() at all, throwing
   * "createElement is not a function" for every variable-content element
   * creation (this is the exact crash named in the original bug report:
   * "mod.VariableContentTool.createElement is not a function").
   */
  static createElement(_type: string, _editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as HTMLElement & { _craftoolsAutoResize?: boolean };
    el.setAttribute('x', '50');
    el.setAttribute('y', '50');
    el.setAttribute('w', '220');
    el.setAttribute('h', '50');
    el.setAttribute('data-craftool', 'conteudovariavel');
    // Auto-fit starts OFF (see AutoFitText.ts / CommonSchema.ts's
    // sizePositionSection({ autoFit: true })) -- only `true` turns it on.
    el._craftoolsAutoResize = false;

    const content = document.createElement('div');
    content.setAttribute('contenteditable', 'false');
    content.setAttribute('spellcheck', 'false');
    content.style.cssText = `
      font-size: 16px;
      font-weight: 400;
      color: #1a1a1a;
      font-family: 'DM Sans', 'Noto Color Emoji', sans-serif;
      display: block;
      width: 100%;
      height: 100%;
      white-space: pre-wrap;
      word-break: break-word;
      cursor: default;
      line-height: 1.3;
      margin: 0;
      outline: 1px dashed var(--accent, #6366f1);
      outline-offset: 2px;
    `;
    content.textContent = I18n.t('variableContentTool.placeholder') || 'Configure uma variável...';

    el.appendChild(content);

    return el;
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      // First and open by default: unlike Barcode/QRCode (where the variable
      // binding is a secondary option alongside their own content config),
      // this tool's entire purpose IS the bound variable -- matches
      // MobileToolbar.ts's _getVariableContentItems(), which also lists it first.
      variableBindingSection({ defaultOpen: true }),
      {
        section: 'Typography',
        icon: 'text_fields',
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

    if (key === 'variableBinding') {
      const binding = parseVariableBinding(value);
      (element as HTMLElement & { _craftoolsVariable?: VariableBinding | null })._craftoolsVariable = binding;
      const content = getContent(element);
      if (content) VariableContentTool._applyVariablePreview(element, content, binding);
      return;
    }

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
