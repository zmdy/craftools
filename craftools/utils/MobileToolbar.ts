// @ts-nocheck
/**
 * MobileToolbar.ts
 *
 * Gerencia a UX mobile estilo Canva:
 *  - Footer scrollável com ferramentas (modo padrão)
 *  - Footer vira barra de propriedades quando um elemento é selecionado
 *  - Mini-painéis flutuantes para cada seção de propriedade
 *
 * Não interfere com o desktop (window.innerWidth > 768).
 *
 * Schema-driven: usa ToolRegistry + getPropertySchema() para construir os
 * itens do footer e PropertyRenderer.renderSectionFields() para renderizar
 * cada mini-painel — sem nenhum código hard-coded por tipo de ferramenta.
 */

import { I18n } from '../settings/Translations.js';
import { ToolRegistry } from './ToolRegistry';
import { PropertyRenderer } from './PropertyRenderer';
import { tr } from './i18nLabel';
import './MobileToolbar_Translations.js';

// ── Local types ───────────────────────────────────────────────────────────────

interface FooterItem {
  icon: string;
  /** Literal glyph to render instead of `icon` (see ToolDefinition.emojiIcon). */
  emojiIcon?: string;
  label: string;
  action: () => void;
}

/** craftools-element with tool-specific expandos used by MobileToolbar. */
interface CraftoolsEl extends HTMLElement {
  contentArea?: HTMLElement;
  _craftoolsMeta?: Record<string, unknown>;
  _craftoolsVariable?: unknown;
  _craftoolsAutoResize?: boolean;
  deselect?: () => void;
  _syncLockUI?: () => void;
}

interface ClipboardStyle {
  type: string | null;
  cssText: string;
  zIndex: string;
  meta: Record<string, unknown> | null;
}

declare global {
  interface Window {
    __craftoolsClipboardStyle?: ClipboardStyle;
  }
}

// ── Class ─────────────────────────────────────────────────────────────────────

export class MobileToolbar {
  static _footer:        HTMLElement | null  = null;
  static _miniPanel:     HTMLElement | null  = null;
  static _overlay:       HTMLElement | null  = null;
  static _activeElement: CraftoolsEl | null  = null;
  static _activeType:    string      | null  = null;
  static _editor:        HTMLElement | null  = null;

  // ─── Entry point ────────────────────────────────────────────────────────────

  static init(editor: HTMLElement): void {
    if (!this.isMobile()) return;
    this._editor = editor;
    const footerUl = document.querySelector<HTMLElement>('.footer-nav ul');
    if (!footerUl) return;
    this._footer = footerUl;
    this._buildMiniPanel();
    this.showToolMode();
  }

  static isMobile(): boolean {
    return window.innerWidth <= 768;
  }

  // ─── Footer modes ───────────────────────────────────────────────────────────

  static showToolMode(): void {
    if (!this._footer) return;
    this._activeElement = null;
    this._activeType    = null;
    this.closeMiniPanel();
    this._updateScrollReserve();

    // Was a hardcoded 5-tool + 3-action list -- most of the sidebar's tools
    // (barcode, shape, icons, emoji, curved text, stamp, calendars, variable
    // content, paper...) were simply unreachable from mobile. Every tool
    // already has a fully-working `#pwa-sidebar-{key}` link in the desktop
    // sidebar (`#sidenav-nav-list` in index.html) with click handlers in
    // Editor.ts that already do the right thing per tool (direct
    // tap-to-add, open a picker panel, or take over the panel for
    // panel-only tools) -- and those handlers are NOT desktop-gated. So
    // instead of re-implementing tool creation here (the old `_triggerTool`
    // only special-cased 'imagem'/'qrcode'/'album' and silently mis-created
    // a TextTool element for anything else), every tool button just proxy-
    // clicks its real sidebar link. ToolRegistry is the single source of
    // truth for which tools exist, so this list can never drift out of
    // sync with the sidebar again.
    const toolItems: FooterItem[] = ToolRegistry.all().map(def => ({
      icon:      def.icon,
      emojiIcon: def.emojiIcon,
      label:     I18n.t(def.label) || def.label,
      action:    () => document.querySelector<HTMLElement>(`#pwa-sidebar-${def.key}`)?.click(),
    }));

    const actionItems: FooterItem[] = [
      { icon: 'note_add',       label: I18n.t('mobileToolbar.toolNewPage'), action: () => document.getElementById('pwa-sidebar-newpage')?.click() },
      { icon: 'picture_as_pdf', label: I18n.t('mobileToolbar.toolPdf'),     action: () => document.getElementById('pwa-sidebar-export')?.click() },
      { icon: 'image',          label: I18n.t('mobileToolbar.toolPng'),     action: () => document.getElementById('pwa-sidebar-png')?.click() },
    ];

    this._renderFooterItems([...toolItems, ...actionItems]);
  }

  /**
   * Schema-driven element mode.
   *
   * Reads getPropertySchema() from the tool registered for `type` and maps
   * each section that has an `icon` to a footer button. Clicking a button
   * opens the mini-panel with PropertyRenderer.renderSectionFields(), which
   * uses the same field handlers as the desktop panel — no duplication.
   */
  static showElementMode(element: HTMLElement, type: string): void {
    if (!this._footer) return;
    this._activeElement = element as CraftoolsEl;
    this._activeType    = type;
    this.closeMiniPanel();

    const toolDef = ToolRegistry.get(type);
    const ToolClass = toolDef?.tool;

    // Prime dataset.ctState so PropertyRenderer can read initial values.
    // On mobile the desktop panel never renders, so _syncFromDOM hasn't run.
    ToolClass?._syncFromDOM?.(element);

    const schema = ToolClass?.getPropertySchema(element) ?? [];

    const items: FooterItem[] = schema
      .filter(s => s.icon)
      .map(s => {
        const title = tr(s.i18nKey, s.section);
        return {
          icon:  s.icon,
          label: title,
          action: () => {
            this.openMiniPanel(title, (container: HTMLElement) => {
              PropertyRenderer.renderSectionFields(container, s, element, (key, val) => {
                ToolClass?._applyProperty(element, key, val);
              });
            });
          },
        };
      });

    // Back button always first
    items.unshift({
      icon: 'arrow_back',
      label: I18n.t('mobileToolbar.close'),
      action: () => {
        this.showToolMode();
        document.querySelectorAll<CraftoolsEl>('craftools-element').forEach(e => e.deselect?.());
      },
    });

    this._renderFooterItems(items);
    this._keepElementVisible();
  }

  // ─── Footer rendering ────────────────────────────────────────────────────────

  private static _renderFooterItems(items: FooterItem[]): void {
    if (!this._footer) return;
    this._footer.innerHTML = '';
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'mobile-toolbar-item';
      // Emoji tool's icon is a literal glyph (ct-emoji-icon, var(--font-emoji)
      // in index.html), not a Material Symbol -- see ToolDefinition.emojiIcon.
      const iconHtml = item.emojiIcon
        ? `<span class="ct-emoji-icon">${item.emojiIcon}</span>`
        : `<span class="material-symbols-outlined">${item.icon}</span>`;
      li.innerHTML = `
        <button class="mobile-toolbar-btn" title="${item.label}">
          ${iconHtml}
          <span class="mobile-toolbar-label">${item.label}</span>
        </button>
      `;
      li.querySelector('button')!.addEventListener('click', item.action);
      this._footer!.appendChild(li);
    });
  }

  // ─── Mini-panel ─────────────────────────────────────────────────────────────

  private static _buildMiniPanel(): void {
    this._overlay = document.createElement('div');
    this._overlay.id = 'mobile-mini-overlay';
    this._overlay.addEventListener('click', () => this.closeMiniPanel());
    document.body.appendChild(this._overlay);

    this._miniPanel = document.createElement('div');
    this._miniPanel.id = 'mobile-mini-panel';
    this._miniPanel.innerHTML = `
      <div class="mmp-header">
        <span class="mmp-title"></span>
        <button class="mmp-close"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="mmp-body"></div>
    `;
    this._miniPanel.querySelector('.mmp-close')!.addEventListener('click', () => this.closeMiniPanel());
    document.body.appendChild(this._miniPanel);
  }

  static openMiniPanel(title: string, renderFn: (container: HTMLElement) => void): void {
    if (!this._miniPanel) return;
    this._miniPanel.querySelector<HTMLElement>('.mmp-title')!.textContent = title;
    const body = this._miniPanel.querySelector<HTMLElement>('.mmp-body')!;
    body.innerHTML = '';
    renderFn(body);
    this._miniPanel.classList.add('open');
    this._overlay!.classList.add('open');
    this._keepElementVisible();
  }

  static closeMiniPanel(): void {
    this._miniPanel?.classList.remove('open');
    this._overlay?.classList.remove('open');
    this._updateScrollReserve();
  }

  // ─── Canvas visibility (Canva-style) ────────────────────────────────────────

  private static _getCanvasArea(): HTMLElement | null {
    return document.getElementById('canvas-area');
  }

  private static _currentReservePx(): number {
    const footer  = document.querySelector<HTMLElement>('.footer-nav-area');
    let reserve   = footer ? footer.offsetHeight : 0;
    if (this._miniPanel?.classList.contains('open')) reserve += this._miniPanel.offsetHeight;
    return reserve;
  }

  private static _updateScrollReserve(): void {
    const canvasArea = this._getCanvasArea();
    if (!canvasArea) return;
    const reserve = this._activeElement ? this._currentReservePx() + 16 : 0;
    canvasArea.style.scrollPaddingBottom = reserve ? `${reserve}px` : '';
  }

  private static _keepElementVisible(): void {
    if (!this._activeElement) return;
    this._updateScrollReserve();
    requestAnimationFrame(() => {
      this._activeElement?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    });
  }

}
