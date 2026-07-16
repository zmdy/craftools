/**
 * CtFontSelect.ts — Custom font picker that renders each font name in its own typeface.
 *
 * Replaces native <select> for font pickers because iOS/Android don't apply
 * option.style.fontFamily in native selects.
 *
 * API is compatible with a native <select>:
 *  - .value getter/setter
 *  - .options  → querySelectorAll('option') on the light DOM
 *  - .innerHTML = '' and .appendChild(option) work on the light DOM
 *  - Dispatches 'change' event (bubbles: true) when the user picks a font
 *  - Supports data-part / data-field / class / style attributes on the element
 *
 * Usage:
 *   <ct-font-select class="craftools-select" data-part="x" data-field="font">
 *     <option value="DM Sans">DM Sans</option>
 *     ...
 *   </ct-font-select>
 */

const STYLE = `
  :host {
    display: block;
    position: relative;
    width: 100%;
    box-sizing: border-box;
  }

  .trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 9px;
    border-radius: 6px;
    background: var(--bg-input, #f4f4f5);
    border: 1px solid var(--border, #e4e4e7);
    color: var(--text-primary, #18181b);
    font-size: 13px;
    font-family: inherit;
    outline: none;
    cursor: pointer;
    box-sizing: border-box;
    text-align: left;
    min-height: 32px;
    transition: border-color 0.15s;
  }
  .trigger:focus, .trigger:hover {
    border-color: var(--border-focus, var(--accent, #f97316));
  }

  .trigger-text {
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 13px;
  }

  .trigger-arrow {
    flex-shrink: 0;
    margin-left: 6px;
    opacity: 0.55;
    font-size: 10px;
    transition: transform 0.15s;
  }
  :host([open]) .trigger-arrow {
    transform: rotate(180deg);
  }

  .dropdown {
    position: fixed;
    z-index: 99999;
    background: var(--bg-surface, #ffffff);
    border: 1px solid var(--border, #e4e4e7);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.14);
    max-height: 240px;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0;
    scrollbar-width: thin;
    scrollbar-color: var(--border, #e4e4e7) transparent;
    min-width: 160px;
  }
  .dropdown::-webkit-scrollbar { width: 5px; }
  .dropdown::-webkit-scrollbar-thumb { background: var(--border, #e4e4e7); border-radius: 4px; }

  .font-item {
    padding: 7px 12px;
    font-size: 14px;
    cursor: pointer;
    color: var(--text-primary, #18181b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background 0.1s;
    user-select: none;
  }
  .font-item:hover {
    background: var(--bg-hover, #f4f4f5);
  }
  .font-item.selected {
    background: var(--accent-soft, rgba(249,115,22,0.1));
    color: var(--accent, #f97316);
    font-weight: 600;
  }
`;

class CtFontSelect extends HTMLElement {
  private _value: string = '';
  private _isOpen: boolean = false;
  private _dropdown: HTMLDivElement | null = null;
  private _outsideHandler: ((e: PointerEvent) => void) | null = null;
  private _mo: MutationObserver | null = null;
  private readonly _trigger: HTMLButtonElement;
  private readonly _triggerText: HTMLSpanElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.shadowRoot!.innerHTML = `<style>${STYLE}</style>
<button class="trigger" type="button" part="trigger">
  <span class="trigger-text" part="trigger-text"></span>
  <span class="trigger-arrow">▾</span>
</button>`;

    this._trigger     = this.shadowRoot!.querySelector('.trigger')      as HTMLButtonElement;
    this._triggerText = this.shadowRoot!.querySelector('.trigger-text') as HTMLSpanElement;

    this._trigger.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      this._isOpen ? this._close() : this._open();
    });
  }

  connectedCallback(): void {
    // Watch light-DOM <option> children for changes
    this._mo = new MutationObserver(() => this._syncFromOptions());
    this._mo.observe(this, { childList: true });
    this._syncFromOptions();
  }

  disconnectedCallback(): void {
    this._mo?.disconnect();
    this._close();
  }

  // ── Public API (mirrors native <select>) ─────────────────────────────

  get value(): string { return this._value; }

  set value(v: string) {
    this._value = String(v ?? '');
    for (const opt of this.querySelectorAll('option')) {
      (opt as HTMLOptionElement).selected = (opt.value === this._value);
    }
    this._updateTrigger();
    if (this._dropdown) this._updateSelectedInDropdown();
  }

  get options(): NodeListOf<HTMLOptionElement> {
    return this.querySelectorAll('option');
  }

  // ── Internal ─────────────────────────────────────────────────────────

  private _syncFromOptions(): void {
    const opts = [...this.querySelectorAll<HTMLOptionElement>('option')];
    const current = opts.find(o => o.value === this._value)
      || opts.find(o => o.selected)
      || opts[0];
    if (current) this._value = current.value;
    this._updateTrigger();
    if (this._isOpen && this._dropdown) this._buildDropdownItems();
  }

  private _updateTrigger(): void {
    this._triggerText.textContent = this._value || '—';
    this._triggerText.style.fontFamily = this._value ? `'${this._value}', sans-serif` : '';
  }

  private _open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.setAttribute('open', '');

    this._dropdown = document.createElement('div');
    this._dropdown.className = 'ct-font-select-dropdown';

    Object.assign(this._dropdown.style, {
      position:      'fixed',
      zIndex:        '99999',
      background:    'var(--bg-surface, #fff)',
      border:        '1px solid var(--border, #e4e4e7)',
      borderRadius:  '8px',
      boxShadow:     '0 8px 24px rgba(0,0,0,0.14)',
      maxHeight:     '240px',
      overflowY:     'auto',
      overflowX:     'hidden',
      padding:       '4px 0',
      minWidth:      '160px',
      scrollbarWidth:'thin',
    });

    this._buildDropdownItems();
    document.body.appendChild(this._dropdown);
    this._positionDropdown();

    this._outsideHandler = (e: PointerEvent) => {
      if (
        !this._dropdown?.contains(e.target as Node) &&
        !this.contains(e.target as Node) &&
        !e.composedPath().includes(this)
      ) {
        this._close();
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', this._outsideHandler!, true), 0);

    requestAnimationFrame(() => {
      const sel = this._dropdown?.querySelector<HTMLElement>('.ct-font-item.selected');
      sel?.scrollIntoView({ block: 'nearest' });
    });
  }

  private _close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.removeAttribute('open');
    if (this._outsideHandler) {
      document.removeEventListener('pointerdown', this._outsideHandler, true);
      this._outsideHandler = null;
    }
    this._dropdown?.remove();
    this._dropdown = null;
  }

  private _buildDropdownItems(): void {
    if (!this._dropdown) return;
    this._dropdown.innerHTML = '';
    for (const opt of this.querySelectorAll<HTMLOptionElement>('option')) {
      const item = document.createElement('div');
      item.className = 'ct-font-item';
      item.textContent = opt.textContent || opt.value;
      item.dataset['value'] = opt.value;
      item.style.cssText = [
        `padding: 7px 12px`,
        `font-size: 14px`,
        `cursor: pointer`,
        `color: var(--text-primary, #18181b)`,
        `white-space: nowrap`,
        `overflow: hidden`,
        `text-overflow: ellipsis`,
        `transition: background 0.1s`,
        `user-select: none`,
        `font-family: '${opt.value}', sans-serif`,
      ].join(';');

      if (opt.value === this._value) {
        item.style.background  = 'var(--accent-soft, rgba(249,115,22,0.1))';
        item.style.color       = 'var(--accent, #f97316)';
        item.style.fontWeight  = '600';
        item.classList.add('selected');
      }

      item.addEventListener('pointerover', () => {
        if (!item.classList.contains('selected'))
          item.style.background = 'var(--bg-hover, #f4f4f5)';
      });
      item.addEventListener('pointerout', () => {
        if (!item.classList.contains('selected'))
          item.style.background = '';
      });
      item.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this._select(opt.value);
      });
      this._dropdown.appendChild(item);
    }
  }

  private _updateSelectedInDropdown(): void {
    if (!this._dropdown) return;
    for (const item of this._dropdown.querySelectorAll<HTMLElement>('.ct-font-item')) {
      const isSelected = item.dataset['value'] === this._value;
      item.classList.toggle('selected', isSelected);
      item.style.background  = isSelected ? 'var(--accent-soft, rgba(249,115,22,0.1))' : '';
      item.style.color       = isSelected ? 'var(--accent, #f97316)' : 'var(--text-primary, #18181b)';
      item.style.fontWeight  = isSelected ? '600' : '';
    }
  }

  private _positionDropdown(): void {
    if (!this._dropdown) return;
    const rect    = this.getBoundingClientRect();
    const vh      = window.innerHeight;
    const dropH   = Math.min(240, this._dropdown.scrollHeight || 240);
    const spaceBelow = vh - rect.bottom;

    if (spaceBelow >= dropH || spaceBelow >= 120) {
      this._dropdown.style.top = (rect.bottom + 2) + 'px';
    } else {
      this._dropdown.style.top = Math.max(4, rect.top - dropH - 2) + 'px';
    }
    this._dropdown.style.left  = rect.left + 'px';
    this._dropdown.style.width = Math.max(rect.width, 180) + 'px';
  }

  private _select(v: string): void {
    this._value = v;
    for (const opt of this.querySelectorAll<HTMLOptionElement>('option')) {
      opt.selected = (opt.value === v);
    }
    this._updateTrigger();
    this._close();
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// Register only once
if (!customElements.get('ct-font-select')) {
  customElements.define('ct-font-select', CtFontSelect);
}

export { CtFontSelect };
