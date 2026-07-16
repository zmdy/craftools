/**
 * MobileToolbar.js
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
import { CommonProperties } from './CommonProperties.js';
import { I18n } from '../settings/Translations.js';
import { Notify } from './Notify.js';
import './MobileToolbar_Translations.js';

export class MobileToolbar {
    static _footer = null;       // <ul> do footer
    static _miniPanel = null;    // div do mini-painel flutuante
    static _overlay = null;      // overlay escuro atrás do mini-painel
    static _activeElement = null;
    static _activeType = null;
    static _editor = null;

    // ─── Ponto de entrada ─────────────────────────────────────────────────────

    static init(editor) {
        if (!this.isMobile()) return;
        this._editor = editor;

        const footerUl = document.querySelector('.footer-nav ul');
        if (!footerUl) return;
        this._footer = footerUl;

        this._buildMiniPanel();
        this.showToolMode();
    }

    static isMobile() {
        return window.innerWidth <= 768;
    }

    // ─── Modos do footer ──────────────────────────────────────────────────────

    /** Modo padrão: mostra as ferramentas de criação */
    static showToolMode() {
        if (!this._footer) return;
        this._activeElement = null;
        this._activeType = null;
        this.closeMiniPanel();
        this._updateScrollReserve();

        const items = [
            { icon: 'title',         label: I18n.t('mobileToolbar.toolTitle'),   action: () => this._triggerTool('titulo') },
            { icon: 'notes',         label: I18n.t('mobileToolbar.toolText'),    action: () => this._triggerTool('paragrafo') },
            { icon: 'image',         label: I18n.t('mobileToolbar.toolImage'),   action: () => this._triggerTool('imagem') },
            { icon: 'photo_library', label: I18n.t('mobileToolbar.toolAlbum'),   action: () => this._triggerTool('album') },
            { icon: 'qr_code_2',     label: I18n.t('mobileToolbar.toolQrCode'),  action: () => this._triggerTool('qrcode') },
            { icon: 'note_add',      label: I18n.t('mobileToolbar.toolNewPage'), action: () => this._triggerAction('newpage') },
            { icon: 'picture_as_pdf',label: I18n.t('mobileToolbar.toolPdf'),     action: () => this._triggerAction('export') },
            { icon: 'layers',        label: I18n.t('mobileToolbar.toolPapers'),  action: () => this._triggerAction('papeis') },
        ];

        this._renderFooterItems(items);
    }

    /** Modo elemento: mostra propriedades do elemento selecionado */
    static showElementMode(element, type) {
        if (!this._footer) return;
        this._activeElement = element;
        this._activeType = type;
        this.closeMiniPanel();

        let items = [];

        if (type === 'imagem') {
            items = this._getImageItems(element);
        } else if (type === 'titulo' || type === 'paragrafo') {
            items = this._getTextItems(element);
        } else if (type === 'conteudovariavel') {
            items = this._getVariableContentItems(element);
        } else if (type === 'qrcode') {
            items = this._getQrItems(element);
        } else if (type === 'barcode') {
            items = this._getBarcodeItems(element);
        }

        // Botão "voltar" sempre no início
        items.unshift({
            icon: 'arrow_back',
            label: I18n.t('mobileToolbar.close'),
            action: () => {
                this.showToolMode();
                // Deseleciona o elemento no editor
                document.querySelectorAll('craftools-element').forEach(el => el.deselect?.());
            }
        });

        this._renderFooterItems(items);
        // Mantém o elemento recém-selecionado visível acima do footer, mesmo antes
        // de qualquer mini-painel específico ser aberto (ex.: elemento perto da
        // borda inferior da tela ficaria parcialmente atrás do footer de propriedades).
        this._keepElementVisible();
    }

    // ─── Definição de itens por tipo de elemento ───────────────────────────────

    static _getImageItems(el) {
        return [
            {
                icon: 'photo_camera', label: I18n.t('mobileToolbar.photoLabel'),
                action: () => this.openMiniPanel(I18n.t('imageTool.switchPhoto'), c => this._renderImagePhoto(c, el))
            },
            {
                icon: 'tune', label: I18n.t('mobileToolbar.adjustLabel'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.adjustPanelTitle'), c => this._renderImageTransform(c, el))
            },
            {
                icon: 'photo_filter', label: I18n.t('mobileToolbar.filtersLabel'),
                action: () => this.openMiniPanel(I18n.t('imageTool.cssFilters'), c => this._renderImageFilters(c, el))
            },
            {
                icon: 'fit_screen', label: I18n.t('mobileToolbar.fitLabel'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.fitPanelTitle'), c => this._renderImageFit(c, el))
            },
            {
                icon: 'border_style', label: I18n.t('common.border'),
                action: () => this.openMiniPanel(I18n.t('common.border'), c => CommonProperties.renderBorder(c, el, 'img'))
            },
            {
                icon: 'rounded_corner', label: I18n.t('mobileToolbar.radiusLabel'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.radiusPanelTitle'), c => CommonProperties.renderBorderRadius(c, el, 'img'))
            },
            {
                icon: 'layers', label: I18n.t('mobileToolbar.layerLabel'),
                action: () => this.openMiniPanel(I18n.t('common.zindex'), c => CommonProperties.renderZIndex(c, el))
            },
            {
                icon: 'content_copy', label: I18n.t('common.copy'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.copyPastePanelTitle'), c => this._renderCopyPaste(c, el, 'img'))
            },
        ];
    }

    static _getTextItems(el) {
        const textEl = el.contentArea?.querySelector('[contenteditable]');
        return [
            {
                icon: 'font_download', label: I18n.t('textTool.font'),
                action: () => this.openMiniPanel(I18n.t('textTool.font'), c => this._renderTextFont(c, el, textEl))
            },
            {
                icon: 'format_size', label: I18n.t('textTool.size'),
                action: () => this.openMiniPanel(I18n.t('textTool.size'), c => this._renderTextSize(c, el, textEl))
            },
            {
                icon: 'palette', label: I18n.t('mobileToolbar.colorLabel'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.textColorPanelTitle'), c => this._renderTextColor(c, el, textEl))
            },
            {
                icon: 'format_align_left', label: I18n.t('mobileToolbar.alignLabel'),
                action: () => this.openMiniPanel(I18n.t('textTool.align'), c => this._renderTextAlign(c, el, textEl))
            },
            {
                icon: 'border_style', label: I18n.t('common.border'),
                action: () => this.openMiniPanel(I18n.t('common.border'), c => CommonProperties.renderBorder(c, el, '[contenteditable]'))
            },
            {
                icon: 'padding', label: I18n.t('mobileToolbar.paddingLabel'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.paddingPanelTitle'), c => CommonProperties.renderPadding(c, el, '[contenteditable]'))
            },
            {
                icon: 'layers', label: I18n.t('mobileToolbar.layerLabel'),
                action: () => this.openMiniPanel(I18n.t('common.zindex'), c => CommonProperties.renderZIndex(c, el))
            },
            {
                icon: 'content_copy', label: I18n.t('common.copy'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.copyPastePanelTitle'), c => this._renderCopyPaste(c, el, '[contenteditable]'))
            },
        ];
    }

    static _getVariableContentItems(el) {
        const textEl = el.contentArea?.querySelector('[contenteditable]');
        return [
            {
                icon: 'data_object', label: I18n.t('variablePanel.title'),
                action: () => this.openMiniPanel(I18n.t('variablePanel.title'), c => this._renderTextVariable(c, el, textEl))
            },
            {
                icon: 'font_download', label: I18n.t('textTool.font'),
                action: () => this.openMiniPanel(I18n.t('textTool.font'), c => this._renderTextFont(c, el, textEl))
            },
            {
                icon: 'format_size', label: I18n.t('textTool.size'),
                action: () => this.openMiniPanel(I18n.t('textTool.size'), c => this._renderTextSize(c, el, textEl))
            },
            {
                icon: 'palette', label: I18n.t('mobileToolbar.colorLabel'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.textColorPanelTitle'), c => this._renderTextColor(c, el, textEl))
            },
            {
                icon: 'format_align_left', label: I18n.t('mobileToolbar.alignLabel'),
                action: () => this.openMiniPanel(I18n.t('textTool.align'), c => this._renderTextAlign(c, el, textEl))
            },
            {
                icon: 'border_style', label: I18n.t('common.border'),
                action: () => this.openMiniPanel(I18n.t('common.border'), c => CommonProperties.renderBorder(c, el, '[contenteditable]'))
            },
            {
                icon: 'padding', label: I18n.t('mobileToolbar.paddingLabel'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.paddingPanelTitle'), c => CommonProperties.renderPadding(c, el, '[contenteditable]'))
            },
            {
                icon: 'layers', label: I18n.t('mobileToolbar.layerLabel'),
                action: () => this.openMiniPanel(I18n.t('common.zindex'), c => CommonProperties.renderZIndex(c, el))
            },
            {
                icon: 'content_copy', label: I18n.t('common.copy'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.copyPastePanelTitle'), c => this._renderCopyPaste(c, el, '[contenteditable]'))
            },
        ];
    }

    static _getQrItems(el) {
        return [
            {
                icon: 'edit_note', label: I18n.t('mobileToolbar.qrContentLabel'),
                action: () => this.openMiniPanel(I18n.t('qrTool.contentType'), c => this._renderQrContent(c, el))
            },
            {
                icon: 'palette', label: I18n.t('mobileToolbar.qrColorsLabel'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.qrColorsPanelTitle'), c => this._renderQrColors(c, el))
            },
            {
                icon: 'shield', label: I18n.t('mobileToolbar.qrEcLabel'),
                action: () => this.openMiniPanel(I18n.t('qrTool.ecLevel'), c => this._renderQrEcLevel(c, el))
            },
            {
                icon: 'border_style', label: I18n.t('common.border'),
                action: () => this.openMiniPanel(I18n.t('common.border'), c => CommonProperties.renderBorder(c, el, 'svg'))
            },
            {
                icon: 'rounded_corner', label: I18n.t('mobileToolbar.radiusLabel'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.radiusPanelTitle'), c => CommonProperties.renderBorderRadius(c, el, 'svg'))
            },
            {
                icon: 'layers', label: I18n.t('mobileToolbar.layerLabel'),
                action: () => this.openMiniPanel(I18n.t('common.zindex'), c => CommonProperties.renderZIndex(c, el))
            },
            {
                icon: 'data_object', label: I18n.t('variablePanel.title'),
                action: () => this.openMiniPanel(I18n.t('variablePanel.title'), c => this._renderQrVariable(c, el))
            },
            {
                icon: 'content_copy', label: I18n.t('common.copy'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.copyPastePanelTitle'), c => this._renderCopyPaste(c, el, 'svg'))
            },
        ];
    }

    static _getBarcodeItems(el) {
        return [
            {
                icon: 'edit_note', label: I18n.t('mobileToolbar.qrContentLabel'),
                action: () => this.openMiniPanel(I18n.t('barcodeTool.content'), c => this._renderBarcodeContent(c, el))
            },
            {
                icon: 'palette', label: I18n.t('mobileToolbar.qrColorsLabel'),
                action: () => this.openMiniPanel(I18n.t('barcodeTool.appearance'), c => this._renderBarcodeColors(c, el))
            },
            {
                icon: 'border_style', label: I18n.t('common.border'),
                action: () => this.openMiniPanel(I18n.t('common.border'), c => CommonProperties.renderBorder(c, el, 'svg'))
            },
            {
                icon: 'rounded_corner', label: I18n.t('mobileToolbar.radiusLabel'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.radiusPanelTitle'), c => CommonProperties.renderBorderRadius(c, el, 'svg'))
            },
            {
                icon: 'layers', label: I18n.t('mobileToolbar.layerLabel'),
                action: () => this.openMiniPanel(I18n.t('common.zindex'), c => CommonProperties.renderZIndex(c, el))
            },
            {
                icon: 'data_object', label: I18n.t('variablePanel.title'),
                action: () => this.openMiniPanel(I18n.t('variablePanel.title'), c => this._renderBarcodeVariable(c, el))
            },
            {
                icon: 'content_copy', label: I18n.t('common.copy'),
                action: () => this.openMiniPanel(I18n.t('mobileToolbar.copyPastePanelTitle'), c => this._renderCopyPaste(c, el, 'svg'))
            },
        ];
    }

    // ─── Renderização do footer ────────────────────────────────────────────────

    static _renderFooterItems(items) {
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
            li.querySelector('button').addEventListener('click', item.action);
            this._footer.appendChild(li);
        });
    }

    // ─── Mini-painel flutuante ─────────────────────────────────────────────────

    static _buildMiniPanel() {
        // Overlay
        this._overlay = document.createElement('div');
        this._overlay.id = 'mobile-mini-overlay';
        this._overlay.addEventListener('click', () => this.closeMiniPanel());
        document.body.appendChild(this._overlay);

        // Painel
        this._miniPanel = document.createElement('div');
        this._miniPanel.id = 'mobile-mini-panel';
        this._miniPanel.innerHTML = `
            <div class="mmp-header">
                <span class="mmp-title"></span>
                <button class="mmp-close">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="mmp-body"></div>
        `;
        this._miniPanel.querySelector('.mmp-close').addEventListener('click', () => this.closeMiniPanel());
        document.body.appendChild(this._miniPanel);
    }

    /**
     * Abre o mini-painel com título e conteúdo gerado por renderFn.
     * @param {string} title
     * @param {function(HTMLElement): void} renderFn - recebe o container e renderiza o conteúdo
     */
    static openMiniPanel(title, renderFn) {
        if (!this._miniPanel) return;

        this._miniPanel.querySelector('.mmp-title').textContent = title;
        const body = this._miniPanel.querySelector('.mmp-body');
        body.innerHTML = '';
        renderFn(body);

        this._miniPanel.classList.add('open');
        this._overlay.classList.add('open');
        // O mini-painel agora ocupa mais espaço embaixo (além do footer) — recalcula
        // a reserva e re-centraliza o elemento no espaço que sobrou visível acima dele.
        this._keepElementVisible();
    }

    static closeMiniPanel() {
        this._miniPanel?.classList.remove('open');
        this._overlay?.classList.remove('open');
        this._updateScrollReserve();
    }

    // ─── Manter elemento em foco visível (estilo canvas/Canva) ─────────────────
    // Em vez de escurecer/cobrir a tela com um overlay enquanto uma ferramenta está
    // aberta (o comportamento antigo do #mobile-mini-overlay), o canvas reserva o
    // espaço ocupado pelo footer de propriedades + mini-painel via
    // `scroll-padding-bottom` e centraliza o elemento selecionado dentro do espaço
    // que sobra visível -- assim ele nunca fica escondido atrás da UI, e continua
    // totalmente interativo (dá pra mover/redimensionar normalmente), igual ao
    // comportamento no desktop.

    static _getCanvasArea() {
        return document.getElementById('canvas-area');
    }

    /** Altura (px) que o footer de propriedades + mini-painel (se aberto) ocupam
     *  na parte de baixo da tela agora mesmo. */
    static _currentReservePx() {
        const footer = document.querySelector('.footer-nav-area');
        let reserve = footer ? footer.offsetHeight : 0;
        if (this._miniPanel?.classList.contains('open')) {
            reserve += this._miniPanel.offsetHeight;
        }
        return reserve;
    }

    /** Atualiza o scroll-padding-bottom do canvas para refletir o espaço ocupado
     *  pela UI agora (0 quando nenhum elemento está em foco). */
    static _updateScrollReserve() {
        const canvasArea = this._getCanvasArea();
        if (!canvasArea) return;
        const reserve = this._activeElement ? this._currentReservePx() + 16 : 0;
        canvasArea.style.scrollPaddingBottom = reserve ? `${reserve}px` : '';
    }

    /** Rola o canvas para centralizar o elemento em foco no espaço visível acima
     *  do footer/mini-painel. Chamado ao selecionar um elemento (showElementMode)
     *  e ao abrir cada mini-painel de propriedades (openMiniPanel). */
    static _keepElementVisible() {
        if (!this._activeElement) return;
        this._updateScrollReserve();
        requestAnimationFrame(() => {
            this._activeElement?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        });
    }

    // ─── Section renders: Imagem ───────────────────────────────────────────────

    static _renderImagePhoto(container, el) {
        container.innerHTML = `
            <div class="mmp-section">
                <button class="mmp-full-btn" id="mmp-img-switch">
                    <span class="material-symbols-outlined">photo_camera</span>
                    ${I18n.t('imageTool.switchPhoto')}
                </button>
                <input type="file" id="mmp-img-file" style="display:none;" accept="image/*">
            </div>
        `;
        const fileInput = container.querySelector('#mmp-img-file');
        container.querySelector('#mmp-img-switch').onclick = () => fileInput.click();
        fileInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = evt => {
                const src = evt.target.result;
                if (el._craftoolsMeta) el._craftoolsMeta.src = src;
                const img = el.contentArea?.querySelector('img');
                if (img) img.src = src;
            };
            reader.readAsDataURL(file);
            this.closeMiniPanel();
        });
    }

    static _renderImageTransform(container, el) {
        const meta = el._craftoolsMeta || {};

        container.innerHTML = `
            <div class="mmp-section">
                <div class="mmp-field">
                    <label>${I18n.t('mobileToolbar.zoomLabel')} <span class="mmp-val" id="mmp-zoom-val">${Math.round((meta.zoom||1)*100)}%</span></label>
                    <input type="range" id="mmp-zoom" min="0.1" max="5" step="0.05" value="${meta.zoom||1}">
                </div>
                <div class="mmp-field">
                    <label>${I18n.t('mobileToolbar.rotationLabel')} <span class="mmp-val" id="mmp-rot-val">${meta.rotation||0}°</span></label>
                    <input type="range" id="mmp-rot" min="-180" max="180" step="1" value="${meta.rotation||0}">
                </div>
                <div class="mmp-field">
                    <label>${I18n.t('mobileToolbar.bgBlurLabel')} <span class="mmp-val" id="mmp-blur-val">${meta.bgBlur||0}px</span></label>
                    <input type="range" id="mmp-blur" min="0" max="100" step="1" value="${meta.bgBlur||0}">
                </div>
                <div class="mmp-field mmp-grid2">
                    <div>
                        <label>${I18n.t('mobileToolbar.posXLabel')}</label>
                        <input type="number" id="mmp-posx" class="mmp-input" value="${Math.round(meta.posX||0)}">
                    </div>
                    <div>
                        <label>${I18n.t('mobileToolbar.posYLabel')}</label>
                        <input type="number" id="mmp-posy" class="mmp-input" value="${Math.round(meta.posY||0)}">
                    </div>
                </div>
            </div>
        `;

        const applyTransform = () => ImageTransform.applyTransform(el);

        const zoom = container.querySelector('#mmp-zoom');
        zoom.oninput = () => { meta.zoom = parseFloat(zoom.value); container.querySelector('#mmp-zoom-val').textContent = Math.round(meta.zoom*100)+'%'; applyTransform(); };

        const rot = container.querySelector('#mmp-rot');
        rot.oninput = () => { meta.rotation = parseFloat(rot.value); container.querySelector('#mmp-rot-val').textContent = meta.rotation+'°'; applyTransform(); };

        const blur = container.querySelector('#mmp-blur');
        blur.oninput = () => { meta.bgBlur = parseFloat(blur.value); container.querySelector('#mmp-blur-val').textContent = meta.bgBlur+'px'; this._applyBgBlur(el); };

        container.querySelector('#mmp-posx').oninput = e => { meta.posX = parseFloat(e.target.value)||0; applyTransform(); };
        container.querySelector('#mmp-posy').oninput = e => { meta.posY = parseFloat(e.target.value)||0; applyTransform(); };
    }

    static _applyBgBlur(el) {
        const meta = el._craftoolsMeta;
        if (!meta) return;
        const ca = el.contentArea;
        if (!ca) return;
        let bg = ca.querySelector('.craftools-bg-blur');
        if (!meta.bgBlur || meta.bgBlur === 0) { if (bg) bg.remove(); return; }
        if (!bg) {
            bg = document.createElement('div');
            bg.className = 'craftools-bg-blur';
            bg.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;background-size:cover;background-position:center;';
            ca.insertBefore(bg, ca.firstChild);
        }
        const img = ca.querySelector('img');
        if (img?.src) bg.style.backgroundImage = `url(${img.src})`;
        bg.style.filter = `blur(${meta.bgBlur}px)`;
        bg.style.transform = 'scale(1.1)';
    }

    static _renderImageFilters(container, el) {
        const meta = el._craftoolsMeta || {};
        if (!meta.filters) meta.filters = {};

        container.innerHTML = `<div class="mmp-section">${
            FILTERS_CONFIG.map(f => {
                const val = meta.filters[f.key] !== undefined ? meta.filters[f.key] : f.def;
                return `
                    <div class="mmp-field">
                        <label>${I18n.t('imageTool.'+f.label) || f.label} <span class="mmp-val" id="mmp-fval-${f.key}">${val}</span></label>
                        <input type="range" class="mmp-filter-slider" data-key="${f.key}" data-unit="${f.unit||''}"
                               min="${f.min}" max="${f.max}" step="${f.step}" value="${val}">
                    </div>
                `;
            }).join('')
        }</div>`;

        container.querySelectorAll('.mmp-filter-slider').forEach(slider => {
            slider.oninput = () => {
                const key = slider.dataset.key;
                meta.filters[key] = parseFloat(slider.value);
                container.querySelector(`#mmp-fval-${key}`).textContent = slider.value;
                ImageFilters.applyFilters(el);
            };
        });
    }

    static _renderImageFit(container, el) {
        const meta = el._craftoolsMeta || {};
        container.innerHTML = `
            <div class="mmp-section">
                <div class="mmp-pill-group">
                    ${['contain','cover','fill'].map(fit => `
                        <button class="mmp-pill ${meta.objectFit===fit?'active':''}" data-fit="${fit}">${fit}</button>
                    `).join('')}
                </div>
            </div>
        `;
        container.querySelectorAll('.mmp-pill[data-fit]').forEach(btn => {
            btn.onclick = () => {
                meta.objectFit = btn.dataset.fit;
                ImageFilters.applyFilters(el);
                container.querySelectorAll('.mmp-pill[data-fit]').forEach(b => b.classList.toggle('active', b===btn));
            };
        });
    }

    // ─── Section renders: Texto ────────────────────────────────────────────────

    static _renderTextFont(container, el, textEl) {
        if (!textEl) return;
        const fonts = ['DM Sans','DM Serif Display','DM Mono','Open Sans','Pacifico','Lobster','Georgia','Arial','Times New Roman','Courier New','Impact','Parisienne','Dancing Script','Quicksand'];

        let savedLocalFonts = [];
        try {
            const stored = localStorage.getItem('craftools-local-fonts');
            if (stored) savedLocalFonts = JSON.parse(stored);
        } catch (e) {}

        if (Array.isArray(savedLocalFonts)) {
            savedLocalFonts.forEach(font => {
                if (!fonts.includes(font)) fonts.push(font);
            });
        }

        const current = (textEl.style.fontFamily||'DM Sans').replace(/['"]/g,'').split(',')[0].trim();
        if (current && !fonts.includes(current)) fonts.push(current);

        container.innerHTML = `
            <div class="mmp-section">
                <select class="mmp-select" id="mmp-font" style="margin-bottom:12px;">
                    ${fonts.map(f => `<option value="${f}" ${f===current?'selected':''} style="font-family:'${f}',sans-serif">${f}</option>`).join('')}
                </select>
                <label style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:-4px;">${I18n.t('mobileToolbar.addCustomFont')}</label>
                <div style="display:flex; gap:8px;">
                    <input type="text" id="mmp-custom-font" class="mmp-input" placeholder="${I18n.t('mobileToolbar.customFontPlaceholder')}" value="">
                    <button class="mmp-full-btn" id="mmp-add-font" style="width:auto; padding:8px 16px;">${I18n.t('mobileToolbar.loadFontBtn')}</button>
                </div>
            </div>
        `;
        container.querySelector('#mmp-font').onchange = e => {
            textEl.style.fontFamily = `'${e.target.value}', sans-serif`;
            CommonProperties._triggerChange(el);
            container.querySelector('#mmp-custom-font').value = '';
        };
        container.querySelector('#mmp-add-font').onclick = () => {
            const val = container.querySelector('#mmp-custom-font').value.trim();
            if(!val) return;
            textEl.style.fontFamily = `'${val}', sans-serif`;
            CommonProperties._triggerChange(el);

            if(!fonts.includes(val)) {
                savedLocalFonts.push(val);
                localStorage.setItem('craftools-local-fonts', JSON.stringify(savedLocalFonts));
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = val;
                opt.selected = true;
                container.querySelector('#mmp-font').appendChild(opt);
                fonts.push(val);
            } else {
                container.querySelector('#mmp-font').value = val;
            }
        };
    }

    static _renderTextSize(container, el, textEl) {
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
        const range = container.querySelector('#mmp-size-range');
        const num = container.querySelector('#mmp-size-num');
        const apply = v => { textEl.style.fontSize = v+'px'; container.querySelector('#mmp-size-val').textContent = v+'px'; CommonProperties._triggerChange(el); };
        range.oninput = () => { num.value = range.value; apply(range.value); };
        num.oninput = () => { range.value = num.value; apply(num.value); };
    }

    static _renderTextColor(container, el, textEl) {
        if (!textEl) return;
        const col = textEl.style.color || '#1a1a1a';
        container.innerHTML = `
            <div class="mmp-section mmp-center">
                <input type="color" class="mmp-color-big" id="mmp-txt-color" value="${CommonProperties._rgbToHex(col) || col}">
                <label style="margin-top:8px;font-size:13px;">${I18n.t('mobileToolbar.textColorPanelTitle')}</label>
            </div>
        `;
        container.querySelector('#mmp-txt-color').oninput = e => { textEl.style.color = e.target.value; CommonProperties._triggerChange(el); };
    }

    static _renderTextAlign(container, el, textEl) {
        if (!textEl) return;
        container.innerHTML = `
            <div class="mmp-section">
                <div class="mmp-pill-group">
                    ${[['left','format_align_left'],['center','format_align_center'],['right','format_align_right'],['justify','format_align_justify']].map(([a,icon]) => `
                        <button class="mmp-pill ${textEl.style.textAlign===a?'active':''}" data-align="${a}">
                            <span class="material-symbols-outlined" style="font-size:18px;">${icon}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        container.querySelectorAll('.mmp-pill[data-align]').forEach(btn => {
            btn.onclick = () => {
                textEl.style.textAlign = btn.dataset.align;
                container.querySelectorAll('.mmp-pill[data-align]').forEach(b => b.classList.toggle('active', b===btn));
                CommonProperties._triggerChange(el);
            };
        });
    }

    // ─── Section renders: QR Code ──────────────────────────────────────────────

    static _renderQrContent(container, el) {
        import('../tools/qrcode/QRCodeTool.js').then(({ QRCodeTool }) => {
            const meta = el._craftoolsMeta || QRCodeTool.getDefaultMeta();
            if (!el._craftoolsMeta) el._craftoolsMeta = meta;

            container.innerHTML = `
                <div class="mmp-section">
                    <select class="mmp-select" id="mmp-qr-type" style="margin-bottom:12px;">
                        <option value="texto" ${meta.payloadType === 'texto' ? 'selected' : ''}>${I18n.t('qrTool.typeText')}</option>
                        <option value="wifi" ${meta.payloadType === 'wifi' ? 'selected' : ''}>${I18n.t('qrTool.typeWifi')}</option>
                        <option value="telefone" ${meta.payloadType === 'telefone' ? 'selected' : ''}>${I18n.t('qrTool.typePhone')}</option>
                        <option value="email" ${meta.payloadType === 'email' ? 'selected' : ''}>${I18n.t('qrTool.typeEmail')}</option>
                        <option value="sms" ${meta.payloadType === 'sms' ? 'selected' : ''}>${I18n.t('qrTool.typeSms')}</option>
                    </select>
                    <div id="mmp-qr-fields"></div>
                </div>
            `;

            const fieldsContainer = container.querySelector('#mmp-qr-fields');
            const renderFields = () => {
                fieldsContainer.innerHTML = QRCodeTool._renderTypeFields(meta);
                QRCodeTool._bindTypeFields(fieldsContainer, el, meta);
            };
            renderFields();

            container.querySelector('#mmp-qr-type').onchange = (e) => {
                meta.payloadType = e.target.value;
                renderFields();
                QRCodeTool._regenerate(el);
            };
        });
    }

    static _renderQrColors(container, el) {
        import('../tools/qrcode/QRCodeTool.js').then(({ QRCodeTool }) => {
            const meta = el._craftoolsMeta || QRCodeTool.getDefaultMeta();
            if (!el._craftoolsMeta) el._craftoolsMeta = meta;

            container.innerHTML = `
                <div class="mmp-section">
                    <div class="mmp-field mmp-grid2">
                        <div>
                            <label>${I18n.t('qrTool.colorDark')}</label>
                            <input type="color" id="mmp-qr-dark" class="mmp-color-big" value="${meta.darkColor}">
                        </div>
                        <div>
                            <label>${I18n.t('qrTool.colorLight')}</label>
                            <input type="color" id="mmp-qr-light" class="mmp-color-big" value="${meta.lightColor === 'transparent' ? '#ffffff' : meta.lightColor}" ${meta.lightColor === 'transparent' ? 'disabled' : ''}>
                        </div>
                    </div>
                    <label style="display:flex; align-items:center; gap:6px; margin-top:10px; font-size:13px;">
                        <input type="checkbox" id="mmp-qr-transparent" ${meta.lightColor === 'transparent' ? 'checked' : ''}>
                        ${I18n.t('qrTool.transparentBg')}
                    </label>
                </div>
            `;

            const darkInput = container.querySelector('#mmp-qr-dark');
            const lightInput = container.querySelector('#mmp-qr-light');
            const transpInput = container.querySelector('#mmp-qr-transparent');

            darkInput.oninput = () => { meta.darkColor = darkInput.value; QRCodeTool._regenerate(el); };
            lightInput.oninput = () => { meta.lightColor = lightInput.value; QRCodeTool._regenerate(el); };
            transpInput.onchange = () => {
                if (transpInput.checked) { meta.lightColor = 'transparent'; lightInput.disabled = true; }
                else { meta.lightColor = lightInput.value || '#ffffff'; lightInput.disabled = false; }
                QRCodeTool._regenerate(el);
            };
        });
    }

    static _renderQrEcLevel(container, el) {
        import('../tools/qrcode/QRCodeTool.js').then(({ QRCodeTool }) => {
            const meta = el._craftoolsMeta || QRCodeTool.getDefaultMeta();
            if (!el._craftoolsMeta) el._craftoolsMeta = meta;

            container.innerHTML = `
                <div class="mmp-section">
                    <div class="mmp-pill-group" style="flex-wrap:wrap;">
                        ${['L', 'M', 'Q', 'H'].map(lvl => `
                            <button class="mmp-pill ${meta.ecLevel === lvl ? 'active' : ''}" data-ec="${lvl}">${lvl}</button>
                        `).join('')}
                    </div>
                    <p style="font-size:11px; color:var(--text-secondary); margin-top:8px;">${I18n.t('qrTool.ecLevelHelp')}</p>
                </div>
            `;
            container.querySelectorAll('.mmp-pill[data-ec]').forEach(btn => {
                btn.onclick = () => {
                    meta.ecLevel = btn.dataset.ec;
                    container.querySelectorAll('.mmp-pill[data-ec]').forEach(b => b.classList.toggle('active', b === btn));
                    QRCodeTool._regenerate(el);
                };
            });
        });
    }

    // ─── Section renders: Barcode ──────────────────────────────────────────────

    static _renderBarcodeContent(container, el) {
        import('../tools/barcode/BarcodeTool.js').then(({ BarcodeTool }) => {
            import('../utils/BarcodeGenerator.js').then(({ BarcodeGenerator }) => {
                const meta = el._craftoolsMeta || BarcodeTool.getDefaultMeta();
                if (!el._craftoolsMeta) el._craftoolsMeta = meta;

                const renderInner = () => {
                    const isEan = meta.format === 'ean13';
                    const valid = isEan
                        ? BarcodeGenerator.isValidEan13Text(meta.text)
                        : BarcodeGenerator.isValidCode39Text(meta.text);

                    container.innerHTML = `
                        <div class="mmp-section">
                            <select class="mmp-select" id="mmp-bc-format" style="margin-bottom:12px;">
                                <option value="code39" ${!isEan ? 'selected' : ''}>${I18n.t('barcodeTool.formatCode39')}</option>
                                <option value="ean13" ${isEan ? 'selected' : ''}>${I18n.t('barcodeTool.formatEan13')}</option>
                            </select>
                            <div class="mmp-field">
                                <label>${isEan ? I18n.t('barcodeTool.textLabelEan13') : I18n.t('barcodeTool.textLabelCode39')}</label>
                                <input type="text" id="mmp-bc-text" class="mmp-input" style="width:100%;"
                                    placeholder="${isEan ? I18n.t('barcodeTool.textPlaceholderEan13') : I18n.t('barcodeTool.textPlaceholderCode39')}"
                                    value="${BarcodeTool._esc(meta.text)}">
                                <span style="font-size:11px; color:var(--text-secondary); display:block; margin-top:4px;">
                                    ${isEan ? I18n.t('barcodeTool.textHelpEan13') : I18n.t('barcodeTool.textHelpCode39')}
                                </span>
                            </div>
                            <div id="mmp-bc-invalid-warning" style="display:${(!valid && meta.text) ? 'flex' : 'none'}; gap:6px; align-items:flex-start; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:8px; font-size:11px; color:#ef4444; margin-top:8px;">
                                <span class="material-symbols-outlined" style="font-size:14px;">warning</span>
                                <span>${isEan ? I18n.t('barcodeTool.invalidEan13') : I18n.t('barcodeTool.invalidCode39')}</span>
                            </div>
                        </div>
                    `;

                    container.querySelector('#mmp-bc-format').onchange = (e) => {
                        meta.format = e.target.value;
                        renderInner();
                        BarcodeTool._regenerate(el);
                    };
                    container.querySelector('#mmp-bc-text').oninput = (e) => {
                        meta.text = e.target.value;
                        const warningEl = container.querySelector('#mmp-bc-invalid-warning');
                        if (warningEl) {
                            const stillValid = meta.format === 'ean13'
                                ? BarcodeGenerator.isValidEan13Text(meta.text)
                                : BarcodeGenerator.isValidCode39Text(meta.text);
                            warningEl.style.display = (!stillValid && meta.text) ? 'flex' : 'none';
                        }
                        BarcodeTool._regenerate(el);
                    };
                };
                renderInner();
            });
        });
    }

    static _renderBarcodeColors(container, el) {
        import('../tools/barcode/BarcodeTool.js').then(({ BarcodeTool }) => {
            const meta = el._craftoolsMeta || BarcodeTool.getDefaultMeta();
            if (!el._craftoolsMeta) el._craftoolsMeta = meta;

            container.innerHTML = `
                <div class="mmp-section">
                    <div class="mmp-field mmp-grid2">
                        <div>
                            <label>${I18n.t('barcodeTool.colorBar')}</label>
                            <input type="color" id="mmp-bc-bar" class="mmp-color-big" value="${meta.color}">
                        </div>
                        <div>
                            <label>${I18n.t('barcodeTool.colorBackground')}</label>
                            <input type="color" id="mmp-bc-bg" class="mmp-color-big" value="${meta.background === 'transparent' ? '#ffffff' : meta.background}" ${meta.background === 'transparent' ? 'disabled' : ''}>
                        </div>
                    </div>
                    <label style="display:flex; align-items:center; gap:6px; margin-top:10px; font-size:13px;">
                        <input type="checkbox" id="mmp-bc-transparent" ${meta.background === 'transparent' ? 'checked' : ''}>
                        ${I18n.t('barcodeTool.transparentBg')}
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; margin-top:6px; font-size:13px;">
                        <input type="checkbox" id="mmp-bc-showtext" ${meta.showText ? 'checked' : ''}>
                        ${I18n.t('barcodeTool.showText')}
                    </label>
                </div>
            `;

            const barInput = container.querySelector('#mmp-bc-bar');
            const bgInput = container.querySelector('#mmp-bc-bg');
            const transpInput = container.querySelector('#mmp-bc-transparent');
            const showTextInput = container.querySelector('#mmp-bc-showtext');

            barInput.oninput = () => { meta.color = barInput.value; BarcodeTool._regenerate(el); };
            bgInput.oninput = () => { meta.background = bgInput.value; BarcodeTool._regenerate(el); };
            transpInput.onchange = () => {
                if (transpInput.checked) { meta.background = 'transparent'; bgInput.disabled = true; }
                else { meta.background = bgInput.value || '#ffffff'; bgInput.disabled = false; }
                BarcodeTool._regenerate(el);
            };
            showTextInput.onchange = () => {
                meta.showText = showTextInput.checked;
                BarcodeTool._regenerate(el);
            };
        });
    }

    // ─── Section renders: Conteúdo Variável ────────────────────────────────────

    static _renderTextVariable(container, el, textEl) {
        Promise.all([
            import('./VariablePanel.js'),
            import('../tools/variablecontent/VariableContentTool.js'),
        ]).then(([{ VariablePanel }, { VariableContentTool }]) => {
            container.innerHTML = VariablePanel.renderAccordionBody(el._craftoolsVariable, el);
            VariablePanel.bind(container, el._craftoolsVariable, (binding) => {
                el._craftoolsVariable = binding;
                VariableContentTool._applyVariablePreview(el, textEl, binding);
            }, el);
        });
    }

    static _renderQrVariable(container, el) {
        Promise.all([
            import('./VariablePanel.js'),
            import('../tools/qrcode/QRCodeTool.js'),
        ]).then(([{ VariablePanel }, { QRCodeTool }]) => {
            const meta = el._craftoolsMeta || QRCodeTool.getDefaultMeta();
            if (!el._craftoolsMeta) el._craftoolsMeta = meta;
            container.innerHTML = VariablePanel.renderAccordionBody(meta.variableBinding, el);
            VariablePanel.bind(container, meta.variableBinding, (binding) => {
                meta.variableBinding = binding;
                QRCodeTool._regenerate(el);
            }, el);
        });
    }

    static _renderBarcodeVariable(container, el) {
        Promise.all([
            import('./VariablePanel.js'),
            import('../tools/barcode/BarcodeTool.js'),
        ]).then(([{ VariablePanel }, { BarcodeTool }]) => {
            const meta = el._craftoolsMeta || BarcodeTool.getDefaultMeta();
            if (!el._craftoolsMeta) el._craftoolsMeta = meta;
            container.innerHTML = VariablePanel.renderAccordionBody(meta.variableBinding, el);
            VariablePanel.bind(container, meta.variableBinding, (binding) => {
                meta.variableBinding = binding;
                BarcodeTool._regenerate(el);
            }, el);
        });
    }

    // ─── Copiar / Colar estilo ─────────────────────────────────────────────────

    static _renderCopyPaste(container, el, targetSelector) {
        const target = targetSelector ? el.contentArea?.querySelector(targetSelector) : el;
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
        container.querySelector('#mmp-copy-style').onclick = () => {
            window.__craftoolsClipboardStyle = { type: el.getAttribute('data-craftool'), cssText: target?.style.cssText, zIndex: el.style.zIndex, meta: el._craftoolsMeta ? JSON.parse(JSON.stringify(el._craftoolsMeta)) : null };
            const btn = container.querySelector('#mmp-copy-style');
            btn.innerHTML = `<span class="material-symbols-outlined" style="color:var(--accent)">check</span> ${I18n.t('common.copied')}`;
            setTimeout(() => { btn.innerHTML = `<span class="material-symbols-outlined">content_copy</span> ${I18n.t('common.copyStyles')}`; }, 1500);
        };
        container.querySelector('#mmp-paste-style').onclick = () => {
            const clip = window.__craftoolsClipboardStyle;
            if (!clip) return Notify.toast(I18n.t('common.noStyleCopied'), 'error');
            if (clip.type !== el.getAttribute('data-craftool')) return Notify.toast(I18n.t('common.incompatibleStyleTypes'), 'error');
            if (target && clip.cssText) target.style.cssText = clip.cssText;
            if (clip.zIndex) el.style.zIndex = clip.zIndex;
            if (clip.meta && el._craftoolsMeta) { const m = {...clip.meta}; if (el._craftoolsMeta.src) m.src = el._craftoolsMeta.src; Object.assign(el._craftoolsMeta, m); }
            CommonProperties._triggerChange(el);
            this.closeMiniPanel();
        };
    }

    // ─── Ações do modo ferramenta ──────────────────────────────────────────────

    static _triggerTool(type) {
        const mainPage = this._editor?.querySelector('.craftools-page');
        if (!mainPage) return;

        if (type === 'album') {
            // Para álbum: abre o step-by-step modal
            this._openAlbumModal();
            return;
        }

        const rect = mainPage.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;

        if (type === 'imagem') {
            import('../tools/image/ImageTool.js').then(({ ImageTool }) => {
                const el = ImageTool.createElement(type, this._editor);
                el.setAttribute('x', cx - 100);
                el.setAttribute('y', cy - 100);
                mainPage.appendChild(el);
            });
        } else if (type === 'qrcode') {
            import('../tools/qrcode/QRCodeTool.js').then(({ QRCodeTool }) => {
                const el = QRCodeTool.createElement(type, this._editor);
                el.setAttribute('x', cx - 90);
                el.setAttribute('y', cy - 90);
                mainPage.appendChild(el);
            });
        } else {
            import('../tools/text/TextTool.js').then(({ TextTool }) => {
                const el = TextTool.createElement(type, this._editor);
                el.setAttribute('x', cx - 100);
                el.setAttribute('y', cy - 30);
                mainPage.appendChild(el);
            });
        }
    }

    static _triggerAction(action) {
        // Delega para os botões sidebar existentes (sem duplicar lógica)
        const map = {
            newpage: '#pwa-sidebar-newpage',
            export:  '#pwa-sidebar-export',
            papeis:  '#pwa-sidebar-papeis',
        };
        document.querySelector(map[action])?.click();
    }

    // ─── AlbumTool — modal step-by-step ───────────────────────────────────────

    static _openAlbumModal() {
        // AlbumTool.js's wizard logic was ported to AlbumWizard.ts.
        import('../tools/album/AlbumWizard').then(({ AlbumTool }) => {
            const mainPage = this._editor?.querySelector('.craftools-page');
            if (mainPage) AlbumTool.setup(this._editor, mainPage);
        });
    }
}
