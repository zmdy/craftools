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
 */

import { FILTERS_CONFIG, ImageFilters } from '../tools/image/ImageFilters.js';
import { ImageTransform } from '../tools/image/ImageTransform.js';
import { I18n } from '../settings/Translations.js';
import { Notify } from './Notify.js';
import './MobileToolbar_Translations.js';

// ── Local types ───────────────────────────────────────────────────────────────

interface FooterItem {
  icon: string;
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

// ── Module-level helpers (replace CommonProperties.* calls) ──────────────────

function _triggerChange(el: HTMLElement): void {
  el.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element: el } }));
}

function _rgbToHex(rgb: string): string {
  if (!rgb) return '#000000';
  if (rgb === 'white') return '#ffffff';
  if (rgb === 'black') return '#000000';
  if (rgb === 'transparent') return '#ffffff';
  if (!rgb.startsWith('rgb')) return rgb;
  const parts = rgb.match(/\d+/g);
  if (!parts) return rgb;
  const hex = (x: string) => ('0' + parseInt(x).toString(16)).slice(-2);
  return '#' + hex(parts[0]) + hex(parts[1]) + hex(parts[2]);
}

function _resolveTarget(el: CraftoolsEl, selector: string): HTMLElement | null {
  return el.contentArea?.querySelector<HTMLElement>(selector)
      ?? el.querySelector<HTMLElement>(selector)
      ?? null;
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

    const items: FooterItem[] = [
      { icon: 'title',           label: I18n.t('mobileToolbar.toolTitle'),   action: () => this._triggerTool('titulo') },
      { icon: 'notes',           label: I18n.t('mobileToolbar.toolText'),    action: () => this._triggerTool('paragrafo') },
      { icon: 'image',           label: I18n.t('mobileToolbar.toolImage'),   action: () => this._triggerTool('imagem') },
      { icon: 'photo_library',   label: I18n.t('mobileToolbar.toolAlbum'),   action: () => this._triggerTool('album') },
      { icon: 'qr_code_2',       label: I18n.t('mobileToolbar.toolQrCode'),  action: () => this._triggerTool('qrcode') },
      { icon: 'note_add',        label: I18n.t('mobileToolbar.toolNewPage'), action: () => this._triggerAction('newpage') },
      { icon: 'picture_as_pdf',  label: I18n.t('mobileToolbar.toolPdf'),     action: () => this._triggerAction('export') },
      { icon: 'layers',          label: I18n.t('mobileToolbar.toolPapers'),  action: () => this._triggerAction('papeis') },
    ];
    this._renderFooterItems(items);
  }

  static showElementMode(element: HTMLElement, type: string): void {
    if (!this._footer) return;
    this._activeElement = element as CraftoolsEl;
    this._activeType    = type;
    this.closeMiniPanel();

    const el = element as CraftoolsEl;
    let items: FooterItem[] = [];

    if      (type === 'imagem')                               items = this._getImageItems(el);
    else if (type === 'titulo' || type === 'paragrafo')       items = this._getTextItems(el);
    else if (type === 'conteudovariavel')                     items = this._getVariableContentItems(el);
    else if (type === 'qrcode')                               items = this._getQrItems(el);
    else if (type === 'barcode')                              items = this._getBarcodeItems(el);

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

  // ─── Item builders per element type ─────────────────────────────────────────

  private static _getImageItems(el: CraftoolsEl): FooterItem[] {
    return [
      { icon: 'photo_camera',   label: I18n.t('mobileToolbar.photoLabel'),
        action: () => this.openMiniPanel(I18n.t('imageTool.switchPhoto'), c => this._renderImagePhoto(c, el)) },
      { icon: 'tune',           label: I18n.t('mobileToolbar.adjustLabel'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.adjustPanelTitle'), c => this._renderImageTransform(c, el)) },
      { icon: 'photo_filter',   label: I18n.t('mobileToolbar.filtersLabel'),
        action: () => this.openMiniPanel(I18n.t('imageTool.cssFilters'), c => this._renderImageFilters(c, el)) },
      { icon: 'fit_screen',     label: I18n.t('mobileToolbar.fitLabel'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.fitPanelTitle'), c => this._renderImageFit(c, el)) },
      { icon: 'border_style',   label: I18n.t('common.border'),
        action: () => this.openMiniPanel(I18n.t('common.border'), c => {
          const t = _resolveTarget(el, 'img'); if (t) this._renderBorderSection(c, t, el);
        }) },
      { icon: 'rounded_corner', label: I18n.t('mobileToolbar.radiusLabel'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.radiusPanelTitle'), c => {
          const t = _resolveTarget(el, 'img'); if (t) this._renderBorderRadiusSection(c, t, el);
        }) },
      { icon: 'layers',         label: I18n.t('mobileToolbar.layerLabel'),
        action: () => this.openMiniPanel(I18n.t('common.zindex'), c => this._renderZIndexSection(c, el)) },
      { icon: 'content_copy',   label: I18n.t('common.copy'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.copyPastePanelTitle'), c => this._renderCopyPaste(c, el, 'img')) },
    ];
  }

  private static _getTextItems(el: CraftoolsEl): FooterItem[] {
    const textEl = el.contentArea?.querySelector<HTMLElement>('[contenteditable]') ?? null;
    return [
      { icon: 'font_download',     label: I18n.t('textTool.font'),
        action: () => this.openMiniPanel(I18n.t('textTool.font'), c => this._renderTextFont(c, el, textEl)) },
      { icon: 'format_size',       label: I18n.t('textTool.size'),
        action: () => this.openMiniPanel(I18n.t('textTool.size'), c => this._renderTextSize(c, el, textEl)) },
      { icon: 'palette',           label: I18n.t('mobileToolbar.colorLabel'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.textColorPanelTitle'), c => this._renderTextColor(c, el, textEl)) },
      { icon: 'format_align_left', label: I18n.t('mobileToolbar.alignLabel'),
        action: () => this.openMiniPanel(I18n.t('textTool.align'), c => this._renderTextAlign(c, el, textEl)) },
      { icon: 'border_style',      label: I18n.t('common.border'),
        action: () => this.openMiniPanel(I18n.t('common.border'), c => {
          const t = _resolveTarget(el, '[contenteditable]'); if (t) this._renderBorderSection(c, t, el);
        }) },
      { icon: 'padding',           label: I18n.t('mobileToolbar.paddingLabel'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.paddingPanelTitle'), c => {
          const t = _resolveTarget(el, '[contenteditable]'); if (t) this._renderPaddingSection(c, t, el);
        }) },
      { icon: 'layers',            label: I18n.t('mobileToolbar.layerLabel'),
        action: () => this.openMiniPanel(I18n.t('common.zindex'), c => this._renderZIndexSection(c, el)) },
      { icon: 'content_copy',      label: I18n.t('common.copy'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.copyPastePanelTitle'), c => this._renderCopyPaste(c, el, '[contenteditable]')) },
    ];
  }

  private static _getVariableContentItems(el: CraftoolsEl): FooterItem[] {
    const textEl = el.contentArea?.querySelector<HTMLElement>('[contenteditable]') ?? null;
    return [
      { icon: 'data_object',       label: I18n.t('variablePanel.title'),
        action: () => this.openMiniPanel(I18n.t('variablePanel.title'), c => this._renderTextVariable(c, el, textEl)) },
      { icon: 'font_download',     label: I18n.t('textTool.font'),
        action: () => this.openMiniPanel(I18n.t('textTool.font'), c => this._renderTextFont(c, el, textEl)) },
      { icon: 'format_size',       label: I18n.t('textTool.size'),
        action: () => this.openMiniPanel(I18n.t('textTool.size'), c => this._renderTextSize(c, el, textEl)) },
      { icon: 'palette',           label: I18n.t('mobileToolbar.colorLabel'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.textColorPanelTitle'), c => this._renderTextColor(c, el, textEl)) },
      { icon: 'format_align_left', label: I18n.t('mobileToolbar.alignLabel'),
        action: () => this.openMiniPanel(I18n.t('textTool.align'), c => this._renderTextAlign(c, el, textEl)) },
      { icon: 'border_style',      label: I18n.t('common.border'),
        action: () => this.openMiniPanel(I18n.t('common.border'), c => {
          const t = _resolveTarget(el, '[contenteditable]'); if (t) this._renderBorderSection(c, t, el);
        }) },
      { icon: 'padding',           label: I18n.t('mobileToolbar.paddingLabel'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.paddingPanelTitle'), c => {
          const t = _resolveTarget(el, '[contenteditable]'); if (t) this._renderPaddingSection(c, t, el);
        }) },
      { icon: 'layers',            label: I18n.t('mobileToolbar.layerLabel'),
        action: () => this.openMiniPanel(I18n.t('common.zindex'), c => this._renderZIndexSection(c, el)) },
      { icon: 'content_copy',      label: I18n.t('common.copy'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.copyPastePanelTitle'), c => this._renderCopyPaste(c, el, '[contenteditable]')) },
    ];
  }

  private static _getQrItems(el: CraftoolsEl): FooterItem[] {
    return [
      { icon: 'edit_note',      label: I18n.t('mobileToolbar.qrContentLabel'),
        action: () => this.openMiniPanel(I18n.t('qrTool.contentType'), c => this._renderQrContent(c, el)) },
      { icon: 'palette',        label: I18n.t('mobileToolbar.qrColorsLabel'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.qrColorsPanelTitle'), c => this._renderQrColors(c, el)) },
      { icon: 'shield',         label: I18n.t('mobileToolbar.qrEcLabel'),
        action: () => this.openMiniPanel(I18n.t('qrTool.ecLevel'), c => this._renderQrEcLevel(c, el)) },
      { icon: 'border_style',   label: I18n.t('common.border'),
        action: () => this.openMiniPanel(I18n.t('common.border'), c => {
          const t = _resolveTarget(el, 'svg'); if (t) this._renderBorderSection(c, t, el);
        }) },
      { icon: 'rounded_corner', label: I18n.t('mobileToolbar.radiusLabel'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.radiusPanelTitle'), c => {
          const t = _resolveTarget(el, 'svg'); if (t) this._renderBorderRadiusSection(c, t, el);
        }) },
      { icon: 'layers',         label: I18n.t('mobileToolbar.layerLabel'),
        action: () => this.openMiniPanel(I18n.t('common.zindex'), c => this._renderZIndexSection(c, el)) },
      { icon: 'data_object',    label: I18n.t('variablePanel.title'),
        action: () => this.openMiniPanel(I18n.t('variablePanel.title'), c => this._renderQrVariable(c, el)) },
      { icon: 'content_copy',   label: I18n.t('common.copy'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.copyPastePanelTitle'), c => this._renderCopyPaste(c, el, 'svg')) },
    ];
  }

  private static _getBarcodeItems(el: CraftoolsEl): FooterItem[] {
    return [
      { icon: 'edit_note',      label: I18n.t('mobileToolbar.qrContentLabel'),
        action: () => this.openMiniPanel(I18n.t('barcodeTool.content'), c => this._renderBarcodeContent(c, el)) },
      { icon: 'palette',        label: I18n.t('mobileToolbar.qrColorsLabel'),
        action: () => this.openMiniPanel(I18n.t('barcodeTool.appearance'), c => this._renderBarcodeColors(c, el)) },
      { icon: 'border_style',   label: I18n.t('common.border'),
        action: () => this.openMiniPanel(I18n.t('common.border'), c => {
          const t = _resolveTarget(el, 'svg'); if (t) this._renderBorderSection(c, t, el);
        }) },
      { icon: 'rounded_corner', label: I18n.t('mobileToolbar.radiusLabel'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.radiusPanelTitle'), c => {
          const t = _resolveTarget(el, 'svg'); if (t) this._renderBorderRadiusSection(c, t, el);
        }) },
      { icon: 'layers',         label: I18n.t('mobileToolbar.layerLabel'),
        action: () => this.openMiniPanel(I18n.t('common.zindex'), c => this._renderZIndexSection(c, el)) },
      { icon: 'data_object',    label: I18n.t('variablePanel.title'),
        action: () => this.openMiniPanel(I18n.t('variablePanel.title'), c => this._renderBarcodeVariable(c, el)) },
      { icon: 'content_copy',   label: I18n.t('common.copy'),
        action: () => this.openMiniPanel(I18n.t('mobileToolbar.copyPastePanelTitle'), c => this._renderCopyPaste(c, el, 'svg')) },
    ];
  }

  // ─── Footer rendering ────────────────────────────────────────────────────────

  private static _renderFooterItems(items: FooterItem[]): void {
    if (!this._footer) return;
    this._footer.innerHTML = '';
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'mobile-toolbar-item';
      li.innerHTML = `
        <button class="mobile-toolbar-btn" title="${item.label}">
          <span class="material-symbols-outlined">${item.icon}</span>
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

  // ─── Image panels ────────────────────────────────────────────────────────────

  private static _renderImagePhoto(container: HTMLElement, el: CraftoolsEl): void {
    container.innerHTML = `
      <div class="mmp-section">
        <button class="mmp-full-btn" id="mmp-img-switch">
          <span class="material-symbols-outlined">photo_camera</span>
          ${I18n.t('imageTool.switchPhoto')}
        </button>
        <input type="file" id="mmp-img-file" style="display:none;" accept="image/*">
      </div>
    `;
    const fileInput = container.querySelector<HTMLInputElement>('#mmp-img-file')!;
    container.querySelector<HTMLElement>('#mmp-img-switch')!.onclick = () => fileInput.click();
    fileInput.addEventListener('change', e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = evt => {
        const src = (evt.target as FileReader).result as string;
        if (el._craftoolsMeta) el._craftoolsMeta['src'] = src;
        const img = el.contentArea?.querySelector<HTMLImageElement>('img');
        if (img) img.src = src;
      };
      reader.readAsDataURL(file);
      this.closeMiniPanel();
    });
  }

  private static _renderImageTransform(container: HTMLElement, el: CraftoolsEl): void {
    const meta: Record<string, unknown> = el._craftoolsMeta ?? {};
    if (!el._craftoolsMeta) el._craftoolsMeta = meta;

    const zoom     = (meta['zoom']     as number | undefined) ?? 1;
    const rotation = (meta['rotation'] as number | undefined) ?? 0;
    const bgBlur   = (meta['bgBlur']   as number | undefined) ?? 0;
    const posX     = (meta['posX']     as number | undefined) ?? 0;
    const posY     = (meta['posY']     as number | undefined) ?? 0;

    container.innerHTML = `
      <div class="mmp-section">
        <div class="mmp-field">
          <label>${I18n.t('mobileToolbar.zoomLabel')} <span class="mmp-val" id="mmp-zoom-val">${Math.round(zoom * 100)}%</span></label>
          <input type="range" id="mmp-zoom" min="0.1" max="5" step="0.05" value="${zoom}">
        </div>
        <div class="mmp-field">
          <label>${I18n.t('mobileToolbar.rotationLabel')} <span class="mmp-val" id="mmp-rot-val">${rotation}°</span></label>
          <input type="range" id="mmp-rot" min="-180" max="180" step="1" value="${rotation}">
        </div>
        <div class="mmp-field">
          <label>${I18n.t('mobileToolbar.bgBlurLabel')} <span class="mmp-val" id="mmp-blur-val">${bgBlur}px</span></label>
          <input type="range" id="mmp-blur" min="0" max="100" step="1" value="${bgBlur}">
        </div>
        <div class="mmp-field mmp-grid2">
          <div>
            <label>${I18n.t('mobileToolbar.posXLabel')}</label>
            <input type="number" id="mmp-posx" class="mmp-input" value="${Math.round(posX)}">
          </div>
          <div>
            <label>${I18n.t('mobileToolbar.posYLabel')}</label>
            <input type="number" id="mmp-posy" class="mmp-input" value="${Math.round(posY)}">
          </div>
        </div>
      </div>
    `;

    const applyTransform = () => ImageTransform.applyTransform(el);

    const zoomInput = container.querySelector<HTMLInputElement>('#mmp-zoom')!;
    const zoomVal   = container.querySelector<HTMLElement>('#mmp-zoom-val')!;
    zoomInput.oninput = () => {
      meta['zoom'] = parseFloat(zoomInput.value);
      zoomVal.textContent = Math.round((meta['zoom'] as number) * 100) + '%';
      applyTransform();
    };

    const rotInput = container.querySelector<HTMLInputElement>('#mmp-rot')!;
    const rotVal   = container.querySelector<HTMLElement>('#mmp-rot-val')!;
    rotInput.oninput = () => {
      meta['rotation'] = parseFloat(rotInput.value);
      rotVal.textContent = meta['rotation'] + '°';
      applyTransform();
    };

    const blurInput = container.querySelector<HTMLInputElement>('#mmp-blur')!;
    const blurVal   = container.querySelector<HTMLElement>('#mmp-blur-val')!;
    blurInput.oninput = () => {
      meta['bgBlur'] = parseFloat(blurInput.value);
      blurVal.textContent = meta['bgBlur'] + 'px';
      this._applyBgBlur(el);
    };

    container.querySelector<HTMLInputElement>('#mmp-posx')!.oninput = e => {
      meta['posX'] = parseFloat((e.target as HTMLInputElement).value) || 0; applyTransform();
    };
    container.querySelector<HTMLInputElement>('#mmp-posy')!.oninput = e => {
      meta['posY'] = parseFloat((e.target as HTMLInputElement).value) || 0; applyTransform();
    };
  }

  private static _applyBgBlur(el: CraftoolsEl): void {
    const meta = el._craftoolsMeta;
    if (!meta) return;
    const ca = el.contentArea;
    if (!ca) return;
    let bg = ca.querySelector<HTMLElement>('.craftools-bg-blur');
    const bgBlur = (meta['bgBlur'] as number | undefined) ?? 0;
    if (!bgBlur) { bg?.remove(); return; }
    if (!bg) {
      bg = document.createElement('div');
      bg.className = 'craftools-bg-blur';
      bg.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;background-size:cover;background-position:center;';
      ca.insertBefore(bg, ca.firstChild);
    }
    const img = ca.querySelector<HTMLImageElement>('img');
    if (img?.src) bg.style.backgroundImage = `url(${img.src})`;
    bg.style.filter    = `blur(${bgBlur}px)`;
    bg.style.transform = 'scale(1.1)';
  }

  private static _renderImageFilters(container: HTMLElement, el: CraftoolsEl): void {
    const meta: Record<string, unknown> = el._craftoolsMeta ?? {};
    if (!el._craftoolsMeta) el._craftoolsMeta = meta;
    if (!meta['filters']) meta['filters'] = {};
    const filters = meta['filters'] as Record<string, number>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    container.innerHTML = `<div class="mmp-section">${(FILTERS_CONFIG as any[]).map((f: any) => {
      const val = filters[f.key] !== undefined ? filters[f.key] : f.def;
      return `
        <div class="mmp-field">
          <label>${I18n.t('imageTool.' + f.label) || f.label} <span class="mmp-val" id="mmp-fval-${f.key}">${val}</span></label>
          <input type="range" class="mmp-filter-slider" data-key="${f.key}"
                 min="${f.min}" max="${f.max}" step="${f.step}" value="${val}">
        </div>
      `;
    }).join('')}</div>`;

    container.querySelectorAll<HTMLInputElement>('.mmp-filter-slider').forEach(slider => {
      slider.oninput = () => {
        const key = slider.dataset.key!;
        filters[key] = parseFloat(slider.value);
        container.querySelector(`#mmp-fval-${key}`)!.textContent = slider.value;
        ImageFilters.applyFilters(el);
      };
    });
  }

  private static _renderImageFit(container: HTMLElement, el: CraftoolsEl): void {
    const meta: Record<string, unknown> = el._craftoolsMeta ?? {};
    if (!el._craftoolsMeta) el._craftoolsMeta = meta;
    const objectFit = meta['objectFit'] as string | undefined;

    container.innerHTML = `
      <div class="mmp-section">
        <div class="mmp-pill-group">
          ${['contain', 'cover', 'fill'].map(fit => `
            <button class="mmp-pill ${objectFit === fit ? 'active' : ''}" data-fit="${fit}">${fit}</button>
          `).join('')}
        </div>
      </div>
    `;
    container.querySelectorAll<HTMLElement>('.mmp-pill[data-fit]').forEach(btn => {
      btn.onclick = () => {
        meta['objectFit'] = btn.dataset.fit;
        ImageFilters.applyFilters(el);
        container.querySelectorAll('.mmp-pill[data-fit]').forEach(b => b.classList.toggle('active', b === btn));
      };
    });
  }

  // ─── Text panels ─────────────────────────────────────────────────────────────

  private static _renderTextFont(container: HTMLElement, el: CraftoolsEl, textEl: HTMLElement | null): void {
    if (!textEl) return;
    const fonts = ['DM Sans','DM Serif Display','DM Mono','Open Sans','Pacifico','Lobster','Georgia','Arial','Times New Roman','Courier New','Impact','Parisienne','Dancing Script','Quicksand'];
    let savedLocalFonts: string[] = [];
    try {
      const stored = localStorage.getItem('craftools-local-fonts');
      if (stored) savedLocalFonts = JSON.parse(stored) as string[];
    } catch (_) {}
    if (Array.isArray(savedLocalFonts)) savedLocalFonts.forEach(f => { if (!fonts.includes(f)) fonts.push(f); });
    const current = (textEl.style.fontFamily || 'DM Sans').replace(/['"]/g, '').split(',')[0].trim();
    if (current && !fonts.includes(current)) fonts.push(current);

    container.innerHTML = `
      <div class="mmp-section">
        <select class="mmp-select" id="mmp-font" style="margin-bottom:12px;">
          ${fonts.map(f => `<option value="${f}" ${f === current ? 'selected' : ''} style="font-family:'${f}',sans-serif">${f}</option>`).join('')}
        </select>
        <label style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:-4px;">${I18n.t('mobileToolbar.addCustomFont')}</label>
        <div style="display:flex;gap:8px;">
          <input type="text" id="mmp-custom-font" class="mmp-input" placeholder="${I18n.t('mobileToolbar.customFontPlaceholder')}" value="">
          <button class="mmp-full-btn" id="mmp-add-font" style="width:auto;padding:8px 16px;">${I18n.t('mobileToolbar.loadFontBtn')}</button>
        </div>
      </div>
    `;

    const fontSelect  = container.querySelector<HTMLSelectElement>('#mmp-font')!;
    const customInput = container.querySelector<HTMLInputElement>('#mmp-custom-font')!;

    fontSelect.onchange = e => {
      textEl.style.fontFamily = `'${(e.target as HTMLSelectElement).value}', sans-serif`;
      _triggerChange(el);
      customInput.value = '';
    };
    container.querySelector<HTMLElement>('#mmp-add-font')!.onclick = () => {
      const val = customInput.value.trim();
      if (!val) return;
      textEl.style.fontFamily = `'${val}', sans-serif`;
      _triggerChange(el);
      if (!fonts.includes(val)) {
        savedLocalFonts.push(val);
        localStorage.setItem('craftools-local-fonts', JSON.stringify(savedLocalFonts));
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = val; opt.selected = true;
        fontSelect.appendChild(opt);
        fonts.push(val);
      } else {
        fontSelect.value = val;
      }
    };
  }

  private static _renderTextSize(container: HTMLElement, el: CraftoolsEl, textEl: HTMLElement | null): void {
    if (!textEl) return;
    const size = parseFloat(textEl.style.fontSize) || 16;
    container.innerHTML = `
      <div class="mmp-section">
        <div class="mmp-field">
          <label>${I18n.t('textTool.size')} <span class="mmp-val" id="mmp-size-val">${size}px</span></label>
          <input type="range" id="mmp-size-range" min="8" max="200" step="1" value="${size}">
        </div>
        <input type="number" id="mmp-size-num" class="mmp-input" value="${size}" style="width:80px;text-align:center;margin:0 auto;display:block;">
      </div>
    `;
    const range   = container.querySelector<HTMLInputElement>('#mmp-size-range')!;
    const num     = container.querySelector<HTMLInputElement>('#mmp-size-num')!;
    const sizeVal = container.querySelector<HTMLElement>('#mmp-size-val')!;
    const apply = (v: string) => { textEl.style.fontSize = v + 'px'; sizeVal.textContent = v + 'px'; _triggerChange(el); };
    range.oninput = () => { num.value   = range.value; apply(range.value); };
    num.oninput   = () => { range.value = num.value;   apply(num.value); };
  }

  private static _renderTextColor(container: HTMLElement, el: CraftoolsEl, textEl: HTMLElement | null): void {
    if (!textEl) return;
    const col = textEl.style.color || '#1a1a1a';
    container.innerHTML = `
      <div class="mmp-section mmp-center">
        <input type="color" class="mmp-color-big" id="mmp-txt-color" value="${_rgbToHex(col) || col}">
        <label style="margin-top:8px;font-size:13px;">${I18n.t('mobileToolbar.textColorPanelTitle')}</label>
      </div>
    `;
    container.querySelector<HTMLInputElement>('#mmp-txt-color')!.oninput = e => {
      textEl.style.color = (e.target as HTMLInputElement).value;
      _triggerChange(el);
    };
  }

  private static _renderTextAlign(container: HTMLElement, el: CraftoolsEl, textEl: HTMLElement | null): void {
    if (!textEl) return;
    const alignments: [string, string][] = [
      ['left','format_align_left'], ['center','format_align_center'],
      ['right','format_align_right'], ['justify','format_align_justify'],
    ];
    container.innerHTML = `
      <div class="mmp-section">
        <div class="mmp-pill-group">
          ${alignments.map(([a, icon]) => `
            <button class="mmp-pill ${textEl.style.textAlign === a ? 'active' : ''}" data-align="${a}">
              <span class="material-symbols-outlined" style="font-size:18px;">${icon}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    container.querySelectorAll<HTMLElement>('.mmp-pill[data-align]').forEach(btn => {
      btn.onclick = () => {
        textEl.style.textAlign = btn.dataset.align!;
        container.querySelectorAll('.mmp-pill[data-align]').forEach(b => b.classList.toggle('active', b === btn));
        _triggerChange(el);
      };
    });
  }

  // ─── QR Code panels ──────────────────────────────────────────────────────────

  private static _renderQrContent(container: HTMLElement, el: CraftoolsEl): void {
    import('../tools/qrcode/QRCodeTool.js').then(({ QRCodeTool }) => {
      const meta: Record<string, unknown> = el._craftoolsMeta ?? QRCodeTool.getDefaultMeta();
      if (!el._craftoolsMeta) el._craftoolsMeta = meta;

      container.innerHTML = `
        <div class="mmp-section">
          <select class="mmp-select" id="mmp-qr-type" style="margin-bottom:12px;">
            <option value="texto"    ${meta['payloadType'] === 'texto'    ? 'selected' : ''}>${I18n.t('qrTool.typeText')}</option>
            <option value="wifi"     ${meta['payloadType'] === 'wifi'     ? 'selected' : ''}>${I18n.t('qrTool.typeWifi')}</option>
            <option value="telefone" ${meta['payloadType'] === 'telefone' ? 'selected' : ''}>${I18n.t('qrTool.typePhone')}</option>
            <option value="email"    ${meta['payloadType'] === 'email'    ? 'selected' : ''}>${I18n.t('qrTool.typeEmail')}</option>
            <option value="sms"      ${meta['payloadType'] === 'sms'      ? 'selected' : ''}>${I18n.t('qrTool.typeSms')}</option>
          </select>
          <div id="mmp-qr-fields"></div>
        </div>
      `;
      const fieldsContainer = container.querySelector<HTMLElement>('#mmp-qr-fields')!;
      const renderFields = () => {
        fieldsContainer.innerHTML = QRCodeTool._renderTypeFields(meta);
        QRCodeTool._bindTypeFields(fieldsContainer, el, meta);
      };
      renderFields();
      container.querySelector<HTMLSelectElement>('#mmp-qr-type')!.onchange = e => {
        meta['payloadType'] = (e.target as HTMLSelectElement).value;
        renderFields();
        QRCodeTool._regenerate(el);
      };
    });
  }

  private static _renderQrColors(container: HTMLElement, el: CraftoolsEl): void {
    import('../tools/qrcode/QRCodeTool.js').then(({ QRCodeTool }) => {
      const meta: Record<string, unknown> = el._craftoolsMeta ?? QRCodeTool.getDefaultMeta();
      if (!el._craftoolsMeta) el._craftoolsMeta = meta;
      const darkColor  = meta['darkColor']  as string;
      const lightColor = meta['lightColor'] as string;
      const isTransp   = lightColor === 'transparent';

      container.innerHTML = `
        <div class="mmp-section">
          <div class="mmp-field mmp-grid2">
            <div><label>${I18n.t('qrTool.colorDark')}</label><input type="color" id="mmp-qr-dark" class="mmp-color-big" value="${darkColor}"></div>
            <div><label>${I18n.t('qrTool.colorLight')}</label><input type="color" id="mmp-qr-light" class="mmp-color-big" value="${isTransp ? '#ffffff' : lightColor}" ${isTransp ? 'disabled' : ''}></div>
          </div>
          <label style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:13px;">
            <input type="checkbox" id="mmp-qr-transparent" ${isTransp ? 'checked' : ''}> ${I18n.t('qrTool.transparentBg')}
          </label>
        </div>
      `;
      const darkInput   = container.querySelector<HTMLInputElement>('#mmp-qr-dark')!;
      const lightInput  = container.querySelector<HTMLInputElement>('#mmp-qr-light')!;
      const transpInput = container.querySelector<HTMLInputElement>('#mmp-qr-transparent')!;
      darkInput.oninput    = () => { meta['darkColor']  = darkInput.value;  QRCodeTool._regenerate(el); };
      lightInput.oninput   = () => { meta['lightColor'] = lightInput.value; QRCodeTool._regenerate(el); };
      transpInput.onchange = () => {
        if (transpInput.checked) { meta['lightColor'] = 'transparent'; lightInput.disabled = true; }
        else                     { meta['lightColor'] = lightInput.value || '#ffffff'; lightInput.disabled = false; }
        QRCodeTool._regenerate(el);
      };
    });
  }

  private static _renderQrEcLevel(container: HTMLElement, el: CraftoolsEl): void {
    import('../tools/qrcode/QRCodeTool.js').then(({ QRCodeTool }) => {
      const meta: Record<string, unknown> = el._craftoolsMeta ?? QRCodeTool.getDefaultMeta();
      if (!el._craftoolsMeta) el._craftoolsMeta = meta;
      container.innerHTML = `
        <div class="mmp-section">
          <div class="mmp-pill-group" style="flex-wrap:wrap;">
            ${['L','M','Q','H'].map(lvl => `
              <button class="mmp-pill ${meta['ecLevel'] === lvl ? 'active' : ''}" data-ec="${lvl}">${lvl}</button>
            `).join('')}
          </div>
          <p style="font-size:11px;color:var(--text-secondary);margin-top:8px;">${I18n.t('qrTool.ecLevelHelp')}</p>
        </div>
      `;
      container.querySelectorAll<HTMLElement>('.mmp-pill[data-ec]').forEach(btn => {
        btn.onclick = () => {
          meta['ecLevel'] = btn.dataset.ec;
          container.querySelectorAll('.mmp-pill[data-ec]').forEach(b => b.classList.toggle('active', b === btn));
          QRCodeTool._regenerate(el);
        };
      });
    });
  }

  // ─── Barcode panels ──────────────────────────────────────────────────────────

  private static _renderBarcodeContent(container: HTMLElement, el: CraftoolsEl): void {
    Promise.all([import('../tools/barcode/BarcodeTool.js'), import('../utils/BarcodeGenerator.js')])
      .then(([{ BarcodeTool }, { BarcodeGenerator }]) => {
        const meta: Record<string, unknown> = el._craftoolsMeta ?? BarcodeTool.getDefaultMeta();
        if (!el._craftoolsMeta) el._craftoolsMeta = meta;

        const renderInner = () => {
          const isEan = meta['format'] === 'ean13';
          const valid = isEan
            ? BarcodeGenerator.isValidEan13Text(meta['text'])
            : BarcodeGenerator.isValidCode39Text(meta['text']);

          container.innerHTML = `
            <div class="mmp-section">
              <select class="mmp-select" id="mmp-bc-format" style="margin-bottom:12px;">
                <option value="code39" ${!isEan ? 'selected' : ''}>${I18n.t('barcodeTool.formatCode39')}</option>
                <option value="ean13"  ${isEan  ? 'selected' : ''}>${I18n.t('barcodeTool.formatEan13')}</option>
              </select>
              <div class="mmp-field">
                <label>${isEan ? I18n.t('barcodeTool.textLabelEan13') : I18n.t('barcodeTool.textLabelCode39')}</label>
                <input type="text" id="mmp-bc-text" class="mmp-input" style="width:100%;"
                  placeholder="${isEan ? I18n.t('barcodeTool.textPlaceholderEan13') : I18n.t('barcodeTool.textPlaceholderCode39')}"
                  value="${BarcodeTool._esc(meta['text'] as string)}">
                <span style="font-size:11px;color:var(--text-secondary);display:block;margin-top:4px;">
                  ${isEan ? I18n.t('barcodeTool.textHelpEan13') : I18n.t('barcodeTool.textHelpCode39')}
                </span>
              </div>
              <div id="mmp-bc-invalid-warning" style="display:${(!valid && meta['text']) ? 'flex' : 'none'};gap:6px;align-items:flex-start;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:8px;font-size:11px;color:#ef4444;margin-top:8px;">
                <span class="material-symbols-outlined" style="font-size:14px;">warning</span>
                <span>${isEan ? I18n.t('barcodeTool.invalidEan13') : I18n.t('barcodeTool.invalidCode39')}</span>
              </div>
            </div>
          `;
          container.querySelector<HTMLSelectElement>('#mmp-bc-format')!.onchange = e => {
            meta['format'] = (e.target as HTMLSelectElement).value;
            renderInner(); BarcodeTool._regenerate(el);
          };
          container.querySelector<HTMLInputElement>('#mmp-bc-text')!.oninput = e => {
            meta['text'] = (e.target as HTMLInputElement).value;
            const w = container.querySelector<HTMLElement>('#mmp-bc-invalid-warning');
            if (w) {
              const ok = meta['format'] === 'ean13'
                ? BarcodeGenerator.isValidEan13Text(meta['text'])
                : BarcodeGenerator.isValidCode39Text(meta['text']);
              w.style.display = (!ok && meta['text']) ? 'flex' : 'none';
            }
            BarcodeTool._regenerate(el);
          };
        };
        renderInner();
      });
  }

  private static _renderBarcodeColors(container: HTMLElement, el: CraftoolsEl): void {
    import('../tools/barcode/BarcodeTool.js').then(({ BarcodeTool }) => {
      const meta: Record<string, unknown> = el._craftoolsMeta ?? BarcodeTool.getDefaultMeta();
      if (!el._craftoolsMeta) el._craftoolsMeta = meta;
      const color      = meta['color']      as string;
      const background = meta['background'] as string;
      const isBgTransp = background === 'transparent';

      container.innerHTML = `
        <div class="mmp-section">
          <div class="mmp-field mmp-grid2">
            <div><label>${I18n.t('barcodeTool.colorBar')}</label><input type="color" id="mmp-bc-bar" class="mmp-color-big" value="${color}"></div>
            <div><label>${I18n.t('barcodeTool.colorBackground')}</label><input type="color" id="mmp-bc-bg" class="mmp-color-big" value="${isBgTransp ? '#ffffff' : background}" ${isBgTransp ? 'disabled' : ''}></div>
          </div>
          <label style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:13px;">
            <input type="checkbox" id="mmp-bc-transparent" ${isBgTransp ? 'checked' : ''}> ${I18n.t('barcodeTool.transparentBg')}
          </label>
          <label style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:13px;">
            <input type="checkbox" id="mmp-bc-showtext" ${meta['showText'] ? 'checked' : ''}> ${I18n.t('barcodeTool.showText')}
          </label>
        </div>
      `;
      const barInput      = container.querySelector<HTMLInputElement>('#mmp-bc-bar')!;
      const bgInput       = container.querySelector<HTMLInputElement>('#mmp-bc-bg')!;
      const transpInput   = container.querySelector<HTMLInputElement>('#mmp-bc-transparent')!;
      const showTextInput = container.querySelector<HTMLInputElement>('#mmp-bc-showtext')!;
      barInput.oninput     = () => { meta['color']      = barInput.value; BarcodeTool._regenerate(el); };
      bgInput.oninput      = () => { meta['background'] = bgInput.value;  BarcodeTool._regenerate(el); };
      transpInput.onchange = () => {
        if (transpInput.checked) { meta['background'] = 'transparent'; bgInput.disabled = true; }
        else                     { meta['background'] = bgInput.value || '#ffffff'; bgInput.disabled = false; }
        BarcodeTool._regenerate(el);
      };
      showTextInput.onchange = () => { meta['showText'] = showTextInput.checked; BarcodeTool._regenerate(el); };
    });
  }

  // ─── Variable content panels ─────────────────────────────────────────────────

  private static _renderTextVariable(container: HTMLElement, el: CraftoolsEl, textEl: HTMLElement | null): void {
    Promise.all([import('./VariablePanel.js'), import('../tools/variablecontent/VariableContentTool.js')])
      .then(([{ VariablePanel }, { VariableContentTool }]) => {
        container.innerHTML = VariablePanel.renderAccordionBody(el._craftoolsVariable, el);
        VariablePanel.bind(container, el._craftoolsVariable, (binding: unknown) => {
          el._craftoolsVariable = binding;
          VariableContentTool._applyVariablePreview(el, textEl, binding);
        }, el);
      });
  }

  private static _renderQrVariable(container: HTMLElement, el: CraftoolsEl): void {
    Promise.all([import('./VariablePanel.js'), import('../tools/qrcode/QRCodeTool.js')])
      .then(([{ VariablePanel }, { QRCodeTool }]) => {
        const meta: Record<string, unknown> = el._craftoolsMeta ?? QRCodeTool.getDefaultMeta();
        if (!el._craftoolsMeta) el._craftoolsMeta = meta;
        container.innerHTML = VariablePanel.renderAccordionBody(meta['variableBinding'], el);
        VariablePanel.bind(container, meta['variableBinding'], (binding: unknown) => {
          meta['variableBinding'] = binding; QRCodeTool._regenerate(el);
        }, el);
      });
  }

  private static _renderBarcodeVariable(container: HTMLElement, el: CraftoolsEl): void {
    Promise.all([import('./VariablePanel.js'), import('../tools/barcode/BarcodeTool.js')])
      .then(([{ VariablePanel }, { BarcodeTool }]) => {
        const meta: Record<string, unknown> = el._craftoolsMeta ?? BarcodeTool.getDefaultMeta();
        if (!el._craftoolsMeta) el._craftoolsMeta = meta;
        container.innerHTML = VariablePanel.renderAccordionBody(meta['variableBinding'], el);
        VariablePanel.bind(container, meta['variableBinding'], (binding: unknown) => {
          meta['variableBinding'] = binding; BarcodeTool._regenerate(el);
        }, el);
      });
  }

  // ─── Copy / Paste styles panel ───────────────────────────────────────────────

  private static _renderCopyPaste(container: HTMLElement, el: CraftoolsEl, targetSelector: string): void {
    const target = _resolveTarget(el, targetSelector) ?? el;
    container.innerHTML = `
      <div class="mmp-section">
        <button class="mmp-full-btn" id="mmp-copy-style">
          <span class="material-symbols-outlined">content_copy</span> ${I18n.t('common.copyStyles')}
        </button>
        <button class="mmp-full-btn mmp-secondary" id="mmp-paste-style">
          <span class="material-symbols-outlined">content_paste</span> ${I18n.t('common.pasteStyles')}
        </button>
      </div>
    `;
    const btnCopy  = container.querySelector<HTMLElement>('#mmp-copy-style')!;
    const btnPaste = container.querySelector<HTMLElement>('#mmp-paste-style')!;

    btnCopy.onclick = () => {
      window.__craftoolsClipboardStyle = {
        type:    el.getAttribute('data-craftool'),
        cssText: target.style.cssText,
        zIndex:  el.style.zIndex,
        meta:    el._craftoolsMeta ? JSON.parse(JSON.stringify(el._craftoolsMeta)) as Record<string, unknown> : null,
      };
      const orig = btnCopy.innerHTML;
      btnCopy.innerHTML = `<span class="material-symbols-outlined" style="color:var(--accent)">check</span> ${I18n.t('common.copied')}`;
      setTimeout(() => { btnCopy.innerHTML = orig; }, 1500);
    };

    btnPaste.onclick = () => {
      const clip = window.__craftoolsClipboardStyle;
      if (!clip)                                          { Notify.toast(I18n.t('common.noStyleCopied'), 'error');          return; }
      if (clip.type !== el.getAttribute('data-craftool')) { Notify.toast(I18n.t('common.incompatibleStyleTypes'), 'error'); return; }
      if (clip.cssText) target.style.cssText = clip.cssText;
      if (clip.zIndex)  el.style.zIndex      = clip.zIndex;
      if (clip.meta && el._craftoolsMeta) {
        const m = { ...clip.meta };
        if (el._craftoolsMeta['src']) m['src'] = el._craftoolsMeta['src'];
        Object.assign(el._craftoolsMeta, m);
      }
      _triggerChange(el);
      this.closeMiniPanel();
    };
  }

  // ─── Border / Radius / Padding / Z-Index panels (replace CommonProperties) ───

  private static _renderBorderSection(container: HTMLElement, target: HTMLElement, el: CraftoolsEl): void {
    const bWidth = parseFloat(target.style.borderWidth) || 0;
    const bStyle = target.style.borderStyle || 'none';
    const bColor = _rgbToHex(target.style.borderColor) || '#000000';

    container.innerHTML = `
      <div class="mmp-section">
        <div class="mmp-field">
          <label>${I18n.t('common.border') || 'Borda'}</label>
          <div style="display:flex;gap:8px;align-items:center;margin-top:6px;">
            <input type="number" id="mt-border-w" class="mmp-input" value="${bWidth}" min="0" max="40" style="width:70px;">
            <select id="mt-border-style" class="mmp-select" style="flex:1;">
              <option value="none"   ${bStyle === 'none'   ? 'selected' : ''}>— ${I18n.t('common.borderNone')   || 'Nenhuma'}</option>
              <option value="solid"  ${bStyle === 'solid'  ? 'selected' : ''}>${I18n.t('common.borderSolid')  || 'Sólida'}</option>
              <option value="dashed" ${bStyle === 'dashed' ? 'selected' : ''}>${I18n.t('common.borderDashed') || 'Tracejada'}</option>
              <option value="dotted" ${bStyle === 'dotted' ? 'selected' : ''}>${I18n.t('common.borderDotted') || 'Pontilhada'}</option>
            </select>
            <input type="color" id="mt-border-color" value="${bColor}" style="width:40px;height:36px;border:none;cursor:pointer;border-radius:6px;">
          </div>
        </div>
      </div>
    `;
    const apply = () => {
      target.style.borderWidth = (container.querySelector<HTMLInputElement>('#mt-border-w')?.value  ?? '0') + 'px';
      target.style.borderStyle =  container.querySelector<HTMLSelectElement>('#mt-border-style')?.value ?? 'solid';
      target.style.borderColor =  container.querySelector<HTMLInputElement>('#mt-border-color')?.value ?? '#000000';
      _triggerChange(el);
    };
    container.querySelector('#mt-border-w')?.addEventListener('input',  apply);
    container.querySelector('#mt-border-style')?.addEventListener('change', apply);
    container.querySelector('#mt-border-color')?.addEventListener('input',  apply);
  }

  private static _renderBorderRadiusSection(container: HTMLElement, target: HTMLElement, el: CraftoolsEl): void {
    const p = (target.style.borderRadius || '0px').split(' ');
    const [rtl, rtr, rbr, rbl] = [
      parseFloat(p[0]) || 0, parseFloat(p[1] ?? p[0]) || 0,
      parseFloat(p[2] ?? p[0]) || 0, parseFloat(p[3] ?? p[1] ?? p[0]) || 0,
    ];
    container.innerHTML = `
      <div class="mmp-section">
        <div class="mmp-field">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><label style="font-size:11px;">↖</label><input type="number" id="mt-rad-tl" class="mmp-input" value="${rtl}" min="0" style="text-align:center;"></div>
            <div><label style="font-size:11px;">↗</label><input type="number" id="mt-rad-tr" class="mmp-input" value="${rtr}" min="0" style="text-align:center;"></div>
            <div><label style="font-size:11px;">↙</label><input type="number" id="mt-rad-bl" class="mmp-input" value="${rbl}" min="0" style="text-align:center;"></div>
            <div><label style="font-size:11px;">↘</label><input type="number" id="mt-rad-br" class="mmp-input" value="${rbr}" min="0" style="text-align:center;"></div>
          </div>
        </div>
      </div>
    `;
    const apply = () => {
      const tl = container.querySelector<HTMLInputElement>('#mt-rad-tl')?.value ?? '0';
      const tr = container.querySelector<HTMLInputElement>('#mt-rad-tr')?.value ?? '0';
      const bl = container.querySelector<HTMLInputElement>('#mt-rad-bl')?.value ?? '0';
      const br = container.querySelector<HTMLInputElement>('#mt-rad-br')?.value ?? '0';
      target.style.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
      _triggerChange(el);
    };
    container.querySelectorAll('#mt-rad-tl,#mt-rad-tr,#mt-rad-bl,#mt-rad-br').forEach(i => i.addEventListener('input', apply));
  }

  private static _renderPaddingSection(container: HTMLElement, target: HTMLElement, el: CraftoolsEl): void {
    const p = (target.style.padding || '0px').split(' ');
    const [pt, pr, pb, pl] = [
      parseFloat(p[0]) || 0, parseFloat(p[1] ?? p[0]) || 0,
      parseFloat(p[2] ?? p[0]) || 0, parseFloat(p[3] ?? p[1] ?? p[0]) || 0,
    ];
    const lbl = (k: string) => I18n.t(k) || k;
    container.innerHTML = `
      <div class="mmp-section">
        <div class="mmp-field">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><label style="font-size:11px;">${lbl('common.top')}</label><input type="number" id="mt-pad-t" class="mmp-input" value="${pt}" min="0" style="text-align:center;"></div>
            <div><label style="font-size:11px;">${lbl('common.right')}</label><input type="number" id="mt-pad-r" class="mmp-input" value="${pr}" min="0" style="text-align:center;"></div>
            <div><label style="font-size:11px;">${lbl('common.bottom')}</label><input type="number" id="mt-pad-b" class="mmp-input" value="${pb}" min="0" style="text-align:center;"></div>
            <div><label style="font-size:11px;">${lbl('common.left')}</label><input type="number" id="mt-pad-l" class="mmp-input" value="${pl}" min="0" style="text-align:center;"></div>
          </div>
        </div>
      </div>
    `;
    const apply = () => {
      const t = container.querySelector<HTMLInputElement>('#mt-pad-t')?.value ?? '0';
      const r = container.querySelector<HTMLInputElement>('#mt-pad-r')?.value ?? '0';
      const b = container.querySelector<HTMLInputElement>('#mt-pad-b')?.value ?? '0';
      const l = container.querySelector<HTMLInputElement>('#mt-pad-l')?.value ?? '0';
      target.style.padding = `${t}px ${r}px ${b}px ${l}px`;
      _triggerChange(el);
    };
    container.querySelectorAll('#mt-pad-t,#mt-pad-r,#mt-pad-b,#mt-pad-l').forEach(i => i.addEventListener('input', apply));
  }

  private static _renderZIndexSection(container: HTMLElement, el: CraftoolsEl): void {
    const currentZ = parseInt(el.style.zIndex) || 2;
    container.innerHTML = `
      <div class="mmp-section">
        <div class="mmp-field">
          <label>${I18n.t('common.zindex') || 'Camada (Z)'}</label>
          <div style="display:flex;gap:8px;align-items:center;margin-top:6px;">
            <button class="mmp-full-btn" id="mt-z-down" style="width:44px;padding:8px;"><span class="material-symbols-outlined">keyboard_arrow_down</span></button>
            <input type="number" id="mt-zindex" class="mmp-input" value="${currentZ}" min="1" style="flex:1;text-align:center;">
            <button class="mmp-full-btn" id="mt-z-up"   style="width:44px;padding:8px;"><span class="material-symbols-outlined">keyboard_arrow_up</span></button>
          </div>
        </div>
      </div>
    `;
    const zInput = container.querySelector<HTMLInputElement>('#mt-zindex')!;
    zInput.addEventListener('input', () => { el.style.zIndex = zInput.value; _triggerChange(el); });
    container.querySelector('#mt-z-up')?.addEventListener('click', () => {
      zInput.value = String(parseInt(zInput.value) + 1); zInput.dispatchEvent(new Event('input'));
    });
    container.querySelector('#mt-z-down')?.addEventListener('click', () => {
      zInput.value = String(Math.max(1, parseInt(zInput.value) - 1)); zInput.dispatchEvent(new Event('input'));
    });
  }

  // ─── Tool actions ─────────────────────────────────────────────────────────────

  private static _triggerTool(type: string): void {
    const mainPage = this._editor?.querySelector<HTMLElement>('.craftools-page');
    if (!mainPage) return;

    if (type === 'album') { this._openAlbumModal(); return; }

    const rect = mainPage.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    if (type === 'imagem') {
      import('../tools/image/ImageTool.js').then(({ ImageTool }) => {
        const e = ImageTool.createElement(type, this._editor);
        e.setAttribute('x', String(cx - 100)); e.setAttribute('y', String(cy - 100));
        mainPage.appendChild(e);
      });
    } else if (type === 'qrcode') {
      import('../tools/qrcode/QRCodeTool.js').then(({ QRCodeTool }) => {
        const e = QRCodeTool.createElement(type, this._editor);
        e.setAttribute('x', String(cx - 90)); e.setAttribute('y', String(cy - 90));
        mainPage.appendChild(e);
      });
    } else {
      import('../tools/text/TextTool.js').then(({ TextTool }) => {
        const e = TextTool.createElement(type, this._editor);
        e.setAttribute('x', String(cx - 100)); e.setAttribute('y', String(cy - 30));
        mainPage.appendChild(e);
      });
    }
  }

  private static _triggerAction(action: string): void {
    const map: Record<string, string> = {
      newpage: '#pwa-sidebar-newpage',
      export:  '#pwa-sidebar-export',
      papeis:  '#pwa-sidebar-papeis',
    };
    document.querySelector<HTMLElement>(map[action])?.click();
  }

  private static _openAlbumModal(): void {
    import('../tools/album/AlbumWizard').then(({ AlbumTool }) => {
      const mainPage = this._editor?.querySelector<HTMLElement>('.craftools-page');
      if (mainPage) AlbumTool.setup(this._editor!, mainPage);
    });
  }
}
