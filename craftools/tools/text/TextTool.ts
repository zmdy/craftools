/**
 * TextTool.ts — Schema-based TypeScript migration of TextTool.
 *
 * Handles both 'title' (heading) and 'paragraph' (paragraph) element types.
 * The DOM manipulation logic remains in TextTool.js for backward compat with
 * the existing Editor.js. This file adds:
 *   - getPropertySchema()  → declarative field definitions
 *   - _syncFromDOM()       → bridges CSS state → dataset.ctState
 *   - _applyProperty()     → writes state AND updates CSS
 *   - ToolRegistry.register() × 2
 */

import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { formaSection, sizePositionSection, pageAlignSection, contentAlignSection, backgroundSection } from '../../utils/CommonSchema';
import { AutoFitText } from '../../utils/AutoFitText.js';
import { withEmojiFallback } from '../../utils/EmojiFont.js';
import { normalizeValue as normalizeColorValue, type ColorPickerValue } from '../../utils/ColorPickerUI';
import { AppSettings } from '../../utils/AppSettings.js';
import type { PropertySchema } from '../../types/PropertySchema';
import '../../components/CtFontSelect.js';
import { FONTS, loadGoogleFonts, getSavedLocalFonts } from '../../utils/FontList.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the [contenteditable] child of a craftools-element, or null. */
const getTextEl = (element: HTMLElement): HTMLElement | null =>
  element.querySelector<HTMLElement>('[contenteditable]');

/** Converts rgb(r,g,b) → #rrggbb. Returns the input unchanged if not rgb. */
const rgbToHex = (rgb: string): string => {
  const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!m) return rgb;
  return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
};

/**
 * Property keys that can change the text's natural (intrinsic) size --
 * after any of these, re-run AutoFitText.applyAutoSize() so the box keeps
 * tracking the content while auto-fit is on. See _applyProperty()'s tail.
 */
const AUTOFIT_RELEVANT_KEYS = new Set([
  'font', 'fontSize', 'lineHeight', 'bold', 'italic', 'underline',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
]);

// ── Tool class ────────────────────────────────────────────────────────────────

export class TextTool extends BaseTool {

  /**
   * Builds a fresh `<craftools-element data-craftool="title|paragraph">`
   * with a contenteditable heading/paragraph inside. Recovered from the
   * pre-migration TextTool.js (deleted by the "Purge legacy JS" commit
   * without this logic being ported) — the previous `createElement()` here
   * was a broken stub that called itself (`new this().createElement()`,
   * but createElement was never an instance method), throwing
   * "createElement is not a function" for every text element creation.
   */
  static createElement(type: string, _editor?: unknown): HTMLElement {
    let tag = 'p', size = 16, weight = 400, w = 200, h = 40;
    const text = 'Editar texto...';

    if (type === 'title') {
      tag = 'h1'; size = 48; weight = 700; w = 300; h = 70;
    } else if (type === 'paragraph') {
      // Title keeps its own structural 48px default (typographic
      // hierarchy, not a "preference") -- only paragraph's body-text size
      // follows the user's global AppSettings default.
      tag = 'p'; size = AppSettings.get('defaultFontSize'); weight = 400; w = 200; h = 40;
    }
    const defaultFont  = AppSettings.get('defaultFontFamily');
    const defaultAlign = AppSettings.get('defaultTextAlign');

    const el = document.createElement('craftools-element') as HTMLElement & { _craftoolsAutoResize?: boolean };
    el.setAttribute('x', '50');
    el.setAttribute('y', '50');
    el.setAttribute('w', String(w));
    el.setAttribute('h', String(h));
    el.setAttribute('data-craftool', type);
    // Auto-fit starts OFF (see AutoFitText.ts / CommonSchema.ts's
    // sizePositionSection({ autoFit: true })) -- only `true` turns it on.
    el._craftoolsAutoResize = false;

    const content = document.createElement(tag);
    content.setAttribute('contenteditable', 'true');
    content.setAttribute('spellcheck', 'false');
    content.style.cssText = `
      font-size: ${size}px;
      font-weight: ${weight};
      color: #1a1a1a;
      font-family: ${withEmojiFallback(defaultFont)};
      text-align: ${defaultAlign};
      display: flex;
      flex-direction: column;
      justify-content: center;
      width: 100%;
      height: 100%;
      overflow: hidden;
      white-space: pre-wrap;
      word-break: break-word;
      cursor: text;
      line-height: 1.3;
      margin: 0;
      outline: none;
    `;
    content.innerHTML = text;

    el.appendChild(content);

    return el;
  }

  // ── State sync (CSS → dataset.ctState) ──────────────────────────────────────

  protected static _syncFromDOM(element: HTMLElement): void {
    const textEl = getTextEl(element);
    if (!textEl) return;

    // Backfills `overflow: hidden` onto elements created before this was
    // part of createElement()'s baseline style -- without it, once
    // auto-fit is off and the box is manually resized smaller than the
    // text needs, the text visually spills straight past the selection
    // handles instead of clipping to the box (Element.ts's shared
    // `_content` wrapper is deliberately `overflow: visible`, for
    // CurvedText/Stamp's SVGs that legitimately bleed past their box, so
    // clipping has to happen on this tool's own text node instead).
    // Not part of `dataset.ctState` -- always enforced, not a user toggle.
    textEl.style.overflow = 'hidden';

    const existing = PropertyRenderer._readState(element);
    // Only populate keys that aren't already stored
    const patch: Record<string, unknown> = {};

    if (!('font' in existing)) {
      patch.font = (textEl.style.fontFamily || 'DM Sans')
        .replace(/['"]/g, '').split(',')[0].trim();
    }
    if (!('fontSize' in existing)) {
      patch.fontSize = parseFloat(textEl.style.fontSize) || 16;
    }
    if (!('lineHeight' in existing)) {
      patch.lineHeight = parseFloat(textEl.style.lineHeight) || 1.4;
    }
    if (!('textAlign' in existing)) {
      patch.textAlign = textEl.style.textAlign || 'left';
    }
    if (!('bold' in existing)) {
      patch.bold = textEl.style.fontWeight === 'bold' || textEl.style.fontWeight === '700';
    }
    if (!('italic' in existing)) {
      patch.italic = textEl.style.fontStyle === 'italic';
    }
    if (!('textTransform' in existing)) {
      patch.textTransform = textEl.style.textTransform || 'none';
    }
    if (!('underline' in existing)) {
      patch.underline = textEl.style.textDecoration?.includes('underline') ?? false;
    }
    if (!('contentAlign' in existing)) {
      // Reverse-maps whatever's already inline (createElement()'s own
      // default, or a value from before this backfill existed and so is
      // still plain 'block'/no justify-content) back into the "h-v" string
      // -- H has no CSS equivalent to read back (see BaseTool.ts's
      // _applyTextContentAlign(), which never writes it), so it's always
      // 'center' here; only V actually varies.
      const justify = textEl.style.justifyContent;
      const v = justify === 'flex-start' ? 'top' : justify === 'flex-end' ? 'bottom' : 'center';
      patch.contentAlign = `center-${v}`;
    }

    // Color: detect gradient from webkitTextFillColor, migrate into the
    // standardized ColorPickerValue shape (see utils/ColorPickerUI.ts).
    // Only gates on the single 'color' key now -- a session saved before
    // this migration may still have the old flat `color` (bare hex string)
    // plus separate `colorMode`/`gradient` keys sitting in dataset.ctState;
    // those are simply left as harmless orphaned JSON and never read again
    // (normalizeColorValue() below already treats a bare string value as a
    // solid color, so old saved sessions keep rendering correctly either way).
    if (!('color' in existing)) {
      const isGradient = textEl.style.webkitTextFillColor === 'transparent';
      let colorValue: ColorPickerValue;
      if (isGradient) {
        const m = textEl.style.background?.match(
          /linear-gradient\((\d+)deg,\s*(#[\da-fA-F]+),\s*(#[\da-fA-F]+)\)/
        );
        colorValue = normalizeColorValue({
          mode: 'gradient',
          gradient: m
            ? { type: 'linear', angle: Number(m[1]), stops: [m[2], m[3]] }
            : { type: 'linear', angle: 90, stops: ['#f97316', '#ec4899'] },
        });
      } else {
        colorValue = normalizeColorValue({ mode: 'solid', solid: rgbToHex(textEl.style.color || '#1a1a1a') });
      }
      patch.color = JSON.stringify(colorValue);
    }

    if (Object.keys(patch).length) {
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
    }

    // Background fill + border (CommonSchema.ts's backgroundSection()/
    // borderSection(), applied via BaseTool.ts's shared helpers) -- seed
    // border from whatever's already inline on textEl (may be a plain hex
    // from before the gradient-capable color-picker existed; _syncBorderState
    // wraps it in a solid ColorPickerValue, which normalizeValue() also
    // accepts directly for elements saved even before that).
    this._syncBackgroundState(element);
    this._syncBorderState(element, {
      width: parseFloat(textEl.style.borderWidth) || 0,
      color: textEl.style.borderColor || '#000000',
      style: textEl.style.borderStyle || 'none',
    });
  }

  // ── Style bar target ─────────────────────────────────────────────────────────

  // Border/radius/margin styling lives on the [contenteditable] child, not
  // the outer craftools-element (see _applyProperty()'s border*/margin*
  // cases below) -- so the Copy/Paste bar (BaseTool.ts's _renderStyleBar())
  // must read/write cssText there too, or it would copy/paste nothing
  // meaningful from the outer element.
  protected static _getStyleTarget(element: HTMLElement): HTMLElement {
    return getTextEl(element) ?? element;
  }

  // ── Schema ────────────────────────────────────────────────────────────────────

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Typography',
        i18nKey: 'textTool.typography',
        icon: 'text_fields',
        defaultOpen: true,
        fields: [
          { type: 'font-select', key: 'font',       label: 'Font',        i18nKey: 'textTool.font' },
          { type: 'slider',      key: 'fontSize',   label: 'Size',        i18nKey: 'textTool.size',       min: 8, max: 200, step: 1 },
          { type: 'slider',      key: 'lineHeight', label: 'Line height', i18nKey: 'textTool.lineHeight', min: 1, max: 4,   step: 0.05 },
          { type: 'align',       key: 'textAlign' },
          { type: 'toggle',      key: 'bold',       label: 'Bold',        i18nKey: 'textTool.bold' },
          { type: 'toggle',      key: 'italic',     label: 'Italic',      i18nKey: 'textTool.italic' },
          { type: 'toggle',      key: 'underline',  label: 'Underline',   i18nKey: 'textTool.underline' },
          {
            type: 'select', key: 'textTransform', label: 'Text transform', i18nKey: 'textTool.textTransform',
            options: [
              { value: 'none',       label: 'None',       i18nKey: 'textTool.textTransformNone' },
              { value: 'uppercase',  label: 'UPPERCASE',  i18nKey: 'textTool.textTransformUppercase' },
              { value: 'lowercase',  label: 'lowercase',  i18nKey: 'textTool.textTransformLowercase' },
              { value: 'capitalize', label: 'Capitalize', i18nKey: 'textTool.textTransformCapitalize' },
            ],
          },
        ],
      },
      {
        section: 'Color',
        i18nKey: 'textTool.color',
        icon: 'palette',
        defaultOpen: true,
        fields: [
          // Standardized solid-or-gradient picker (see color-picker.field.ts) --
          // owns its own Cor/Gradiente toggle internally, so no separate mode
          // field or hidden-field pair is needed here anymore. No explicit
          // defaultSolid needed: ColorPickerUI.ts's shared default is already
          // near-black (#18181b), matching createElement()'s `color: #1a1a1a`.
          { type: 'color-picker', key: 'color', label: 'Color', i18nKey: 'textTool.color' },
        ],
      },
      backgroundSection(),
      formaSection({ margin: true }),
      sizePositionSection({ autoFit: true }),
      contentAlignSection(),
      pageAlignSection(),
    ];
  }

  // ── Context bar ───────────────────────────────────────────────────────────────

  /**
   * Quick "auto-fit to text" toggle in the floating ctx-bar, mirroring the
   * Size & Position panel's own toggle (sizePositionSection({autoFit:true}))
   * so it can be flipped without opening the panel. Built on BaseTool's
   * shared _autoFitCtxOption() (see its own doc comment) -- reuses
   * _applyProperty's 'autoFit' case directly (persists state + resizes to
   * fit immediately when turning on) rather than duplicating that logic,
   * and gets the panel-resync-if-open behavior for free.
   */
  static getCtxOptions(element?: HTMLElement): any[] {
    if (!element) return [];
    const isOn = (el: HTMLElement) => (el as unknown as { _craftoolsAutoResize?: boolean })._craftoolsAutoResize === true;
    
    const isBold = (el: HTMLElement) => PropertyRenderer._readState(el).bold === true;
    const isItalic = (el: HTMLElement) => PropertyRenderer._readState(el).italic === true;
    const isUnderline = (el: HTMLElement) => PropertyRenderer._readState(el).underline === true;
    
    return [
      {
        render: (el: HTMLElement) => {
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'display:flex; align-items:center; gap:6px; margin:0 4px;';
          
          // Font selector
          const currentFont = PropertyRenderer._readState(el).font || 'Inter';
          const fontSelect = document.createElement('ct-font-select') as any;
          fontSelect.className = 'craftools-select ct-fi';
          // Make the trigger smaller for the ctx bar
          fontSelect.style.width = '120px';
          
          // Build font list
          const allFonts = [...FONTS];
          getSavedLocalFonts().forEach(f => { if (!allFonts.includes(f)) allFonts.push(f); });
          if (currentFont && typeof currentFont === 'string' && !allFonts.includes(currentFont)) allFonts.push(currentFont);
          
          allFonts.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            fontSelect.appendChild(opt);
          });
          loadGoogleFonts(allFonts);
          fontSelect.value = currentFont;
          
          fontSelect.addEventListener('change', (e: Event) => {
            TextTool._applyProperty(el, 'font', (e.target as HTMLSelectElement).value);
          });
          
          // Size selector
          const currentSize = PropertyRenderer._readState(el).fontSize || 24;
          const sizeInput = document.createElement('input');
          sizeInput.type = 'number';
          sizeInput.className = 'craftools-input';
          sizeInput.style.cssText = 'width: 50px; height: 30px; padding: 0 4px; text-align: center; font-size: 13px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-input); color: var(--text-primary); outline: none; margin: 0; box-sizing: border-box;';
          sizeInput.value = String(currentSize);
          sizeInput.min = '8';
          sizeInput.max = '500';
          
          sizeInput.addEventListener('change', (e: Event) => {
            TextTool._applyProperty(el, 'fontSize', parseFloat((e.target as HTMLInputElement).value) || 24);
          });
          sizeInput.addEventListener('input', (e: Event) => {
             const val = parseFloat((e.target as HTMLInputElement).value);
             if (val > 0) TextTool._applyProperty(el, 'fontSize', val);
          });

          wrapper.appendChild(fontSelect);
          wrapper.appendChild(sizeInput);
          return wrapper;
        }
      },
      {
        icon: 'format_bold',
        label: 'Bold',
        // Grouped with Italic/Underline below -- CtxBar.ts keeps same-group
        // options together as one atomic cluster, never split across the
        // ctx-bar's two lines.
        group: 'bius',
        isActive: isBold,
        command: (el: HTMLElement) => TextTool._applyProperty(el, 'bold', !isBold(el))
      },
      {
        icon: 'format_italic',
        label: 'Italic',
        group: 'bius',
        isActive: isItalic,
        command: (el: HTMLElement) => TextTool._applyProperty(el, 'italic', !isItalic(el))
      },
      {
        icon: 'format_underlined',
        label: 'Underline',
        group: 'bius',
        isActive: isUnderline,
        command: (el: HTMLElement) => TextTool._applyProperty(el, 'underline', !isUnderline(el))
      },
      {
        icon: 'format_align_left',
        label: 'Align Left',
        // Grouped with Center/Right below -- see the 'bius' comment above.
        group: 'align',
        isActive: (el: HTMLElement) => PropertyRenderer._readState(el).textAlign === 'left',
        command: (el: HTMLElement) => TextTool._applyProperty(el, 'textAlign', 'left')
      },
      {
        icon: 'format_align_center',
        label: 'Align Center',
        group: 'align',
        isActive: (el: HTMLElement) => {
          const state = PropertyRenderer._readState(el);
          return state.textAlign === 'center' || !state.textAlign;
        },
        command: (el: HTMLElement) => TextTool._applyProperty(el, 'textAlign', 'center')
      },
      {
        icon: 'format_align_right',
        label: 'Align Right',
        group: 'align',
        isActive: (el: HTMLElement) => PropertyRenderer._readState(el).textAlign === 'right',
        command: (el: HTMLElement) => TextTool._applyProperty(el, 'textAlign', 'right')
      },
      this._autoFitCtxOption({
        isActive: isOn,
        toggle:   (el: HTMLElement) => TextTool._applyProperty(el, 'autoFit', !isOn(el)),
        label:    'Auto-fit to text',
      })
    ];
  }

  // ── Apply ─────────────────────────────────────────────────────────────────────

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    // 'pageAlign' (pageAlignSection()) is a fire-and-forget action with no
    // stored value -- delegate to BaseTool's shared SnapEngine.align()
    // wiring and skip the state write below entirely.
    if (key === 'pageAlign') {
      super._applyProperty(element, key, value);
      return;
    }

    // Background fill (backgroundSection()) -- whole-element concept, always
    // handled generically regardless of this tool's own style target.
    if (this._applyBackground(element, key, value)) return;

    const textEl = getTextEl(element);
    if (!textEl) return;

    // Border (borderSection(), now gradient-capable) -- _getStyleTarget()
    // already points at textEl for this tool, so this replaces the
    // hand-rolled borderWidth/borderStyle/borderColor cases below with the
    // shared, gradient-aware implementation.
    if (this._applyBorder(element, key, value)) return;

    // Internal alignment (contentAlignSection()) -- shared with
    // VariableContentTool.ts, see BaseTool.ts's doc comment.
    if (this._applyTextContentAlign(element, key, value)) return;

    // Persist to state store
    PropertyRenderer.applyChange(element, key, value);

    const state = PropertyRenderer._readState(element);

    switch (key) {
      case 'autoFit': {
        (element as unknown as { _craftoolsAutoResize?: boolean })._craftoolsAutoResize = !!value;
        if (value) AutoFitText.applyAutoSize(element, textEl);
        break;
      }

      case 'width':
        element.style.width = `${value}px`;
        if (typeof (element as unknown as { pw?: number }).pw === 'number') {
          (element as unknown as { pw?: number }).pw = parseFloat(String(value)) || 0;
        }
        break;
      case 'height':
        element.style.height = `${value}px`;
        if (typeof (element as unknown as { ph?: number }).ph === 'number') {
          (element as unknown as { ph?: number }).ph = parseFloat(String(value)) || 0;
        }
        break;
      case 'x':
        element.style.left = `${value}px`;
        element.setAttribute('x', String(value));
        break;
      case 'y':
        element.style.top = `${value}px`;
        element.setAttribute('y', String(value));
        break;

      case 'marginTop':
        textEl.style.marginTop = `${value}px`;
        break;
      case 'marginRight':
        textEl.style.marginRight = `${value}px`;
        break;
      case 'marginBottom':
        textEl.style.marginBottom = `${value}px`;
        break;
      case 'marginLeft':
        textEl.style.marginLeft = `${value}px`;
        break;
      case 'font':
        // Was `'${value}', sans-serif` -- dropped the emoji fallback that
        // createElement()'s own font-family stack has, so an emoji typed
        // after changing the font (but not before) silently rendered as
        // tofu/blank instead of falling back to the emoji font.
        textEl.style.fontFamily = withEmojiFallback(String(value));
        break;

      case 'fontSize':
        textEl.style.fontSize = `${value}px`;
        break;

      case 'lineHeight':
        textEl.style.lineHeight = String(value);
        break;

      case 'textAlign':
        textEl.style.textAlign = String(value);
        break;

      case 'bold':
        textEl.style.fontWeight = value ? 'bold' : 'normal';
        break;

      case 'italic':
        textEl.style.fontStyle = value ? 'italic' : 'normal';
        break;

      case 'underline':
        textEl.style.textDecoration = value ? 'underline' : 'none';
        break;

      case 'textTransform':
        textEl.style.textTransform = String(value);
        break;

      case 'color':
        this._paintTextColor(textEl, state.color);
        break;

      case 'borderRadius':
        textEl.style.borderRadius = `${value}px`;
        break;
      case 'zIndex':
        element.style.zIndex = String(value);
        break;
    }

    // Keep the box in sync with the content while auto-fit is on: previously
    // AutoFitText.applyAutoSize() only ran once, at the moment the toggle
    // itself was switched on -- every later panel edit that could change the
    // text's natural size (font, size, line height, weight/style, margin)
    // left the box exactly where it was, so it silently stopped tracking
    // the content the moment you touched anything else. Re-measure after
    // any of those (applyAutoSize() no-ops immediately if auto-fit isn't
    // on, so this is always safe/cheap to call).
    if (AUTOFIT_RELEVANT_KEYS.has(key)) {
      AutoFitText.applyAutoSize(element, textEl);
    }
  }
}

// ── Self-registration ─────────────────────────────────────────────────────────

TextTool.registeredKeys = ['title', 'paragraph'];

ToolRegistry.register({
  key:             'title',
  label:           'editor.toolTitle',
  icon:            'title',
  tool:            TextTool,
  draggable:       true,
  showInFooterNav: true,
  category:        'text',
});

ToolRegistry.register({
  key:             'paragraph',
  label:           'editor.text',
  icon:            'notes',
  tool:            TextTool,
  draggable:       true,
  showInFooterNav: true,
  category:        'text',
});
