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

        const items = [
            { icon: 'title',         label: 'Título',     action: () => this._triggerTool('titulo') },
            { icon: 'notes',         label: 'Texto',      action: () => this._triggerTool('paragrafo') },
            { icon: 'image',         label: 'Imagem',     action: () => this._triggerTool('imagem') },
            { icon: 'photo_library', label: 'Álbum',      action: () => this._triggerTool('album') },
            { icon: 'note_add',      label: 'Nova Pág.',  action: () => this._triggerAction('newpage') },
            { icon: 'picture_as_pdf',label: 'PDF',        action: () => this._triggerAction('export') },
            { icon: 'layers',        label: 'Papéis',     action: () => this._triggerAction('papeis') },
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
        }

        // Botão "voltar" sempre no início
        items.unshift({
            icon: 'arrow_back',
            label: 'Fechar',
            action: () => {
                this.showToolMode();
                // Deseleciona o elemento no editor
                document.querySelectorAll('craftools-element').forEach(el => el.deselect?.());
            }
        });

        this._renderFooterItems(items);
    }

    // ─── Definição de itens por tipo de elemento ───────────────────────────────

    static _getImageItems(el) {
        return [
            {
                icon: 'photo_camera', label: 'Foto',
                action: () => this.openMiniPanel('Trocar Foto', c => this._renderImagePhoto(c, el))
            },
            {
                icon: 'tune', label: 'Ajuste',
                action: () => this.openMiniPanel('Ajuste de Imagem', c => this._renderImageTransform(c, el))
            },
            {
                icon: 'photo_filter', label: 'Filtros',
                action: () => this.openMiniPanel('Filtros CSS', c => this._renderImageFilters(c, el))
            },
            {
                icon: 'fit_screen', label: 'Encaixe',
                action: () => this.openMiniPanel('Encaixe da Imagem', c => this._renderImageFit(c, el))
            },
            {
                icon: 'border_style', label: 'Borda',
                action: () => this.openMiniPanel('Borda', c => CommonProperties.renderBorder(c, el, 'img'))
            },
            {
                icon: 'rounded_corner', label: 'Arred.',
                action: () => this.openMiniPanel('Arredondamento', c => CommonProperties.renderBorderRadius(c, el, 'img'))
            },
            {
                icon: 'layers', label: 'Camada',
                action: () => this.openMiniPanel('Camada (Z-Index)', c => CommonProperties.renderZIndex(c, el))
            },
            {
                icon: 'content_copy', label: 'Copiar',
                action: () => this.openMiniPanel('Copiar / Colar Estilo', c => this._renderCopyPaste(c, el, 'img'))
            },
        ];
    }

    static _getTextItems(el) {
        const textEl = el.contentArea?.querySelector('[contenteditable]');
        return [
            {
                icon: 'font_download', label: 'Fonte',
                action: () => this.openMiniPanel('Fonte', c => this._renderTextFont(c, el, textEl))
            },
            {
                icon: 'format_size', label: 'Tamanho',
                action: () => this.openMiniPanel('Tamanho', c => this._renderTextSize(c, el, textEl))
            },
            {
                icon: 'palette', label: 'Cor',
                action: () => this.openMiniPanel('Cor do Texto', c => this._renderTextColor(c, el, textEl))
            },
            {
                icon: 'format_align_left', label: 'Alinha.',
                action: () => this.openMiniPanel('Alinhamento', c => this._renderTextAlign(c, el, textEl))
            },
            {
                icon: 'border_style', label: 'Borda',
                action: () => this.openMiniPanel('Borda', c => CommonProperties.renderBorder(c, el, '[contenteditable]'))
            },
            {
                icon: 'padding', label: 'Padding',
                action: () => this.openMiniPanel('Espaçamento Interno', c => CommonProperties.renderPadding(c, el, '[contenteditable]'))
            },
            {
                icon: 'layers', label: 'Camada',
                action: () => this.openMiniPanel('Camada (Z-Index)', c => CommonProperties.renderZIndex(c, el))
            },
            {
                icon: 'content_copy', label: 'Copiar',
                action: () => this.openMiniPanel('Copiar / Colar Estilo', c => this._renderCopyPaste(c, el, '[contenteditable]'))
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
    }

    static closeMiniPanel() {
        this._miniPanel?.classList.remove('open');
        this._overlay?.classList.remove('open');
    }

    // ─── Section renders: Imagem ───────────────────────────────────────────────

    static _renderImagePhoto(container, el) {
        container.innerHTML = `
            <div class="mmp-section">
                <button class="mmp-full-btn" id="mmp-img-switch">
                    <span class="material-symbols-outlined">photo_camera</span>
                    Trocar Foto
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
                    <label>Zoom <span class="mmp-val" id="mmp-zoom-val">${Math.round((meta.zoom||1)*100)}%</span></label>
                    <input type="range" id="mmp-zoom" min="0.1" max="5" step="0.05" value="${meta.zoom||1}">
                </div>
                <div class="mmp-field">
                    <label>Rotação <span class="mmp-val" id="mmp-rot-val">${meta.rotation||0}°</span></label>
                    <input type="range" id="mmp-rot" min="-180" max="180" step="1" value="${meta.rotation||0}">
                </div>
                <div class="mmp-field">
                    <label>Blur de Fundo <span class="mmp-val" id="mmp-blur-val">${meta.bgBlur||0}px</span></label>
                    <input type="range" id="mmp-blur" min="0" max="100" step="1" value="${meta.bgBlur||0}">
                </div>
                <div class="mmp-field mmp-grid2">
                    <div>
                        <label>Pos X</label>
                        <input type="number" id="mmp-posx" class="mmp-input" value="${Math.round(meta.posX||0)}">
                    </div>
                    <div>
                        <label>Pos Y</label>
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
                <label style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:-4px;">Adicionar Fonte Customizada</label>
                <div style="display:flex; gap:8px;">
                    <input type="text" id="mmp-custom-font" class="mmp-input" placeholder="Ex: Roboto" value="">
                    <button class="mmp-full-btn" id="mmp-add-font" style="width:auto; padding:8px 16px;">Carregar</button>
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
                    <label>Tamanho <span class="mmp-val" id="mmp-size-val">${size}px</span></label>
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
                <label style="margin-top:8px;font-size:13px;">Cor do Texto</label>
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

    // ─── Copiar / Colar estilo ─────────────────────────────────────────────────

    static _renderCopyPaste(container, el, targetSelector) {
        const target = targetSelector ? el.contentArea?.querySelector(targetSelector) : el;
        container.innerHTML = `
            <div class="mmp-section">
                <button class="mmp-full-btn" id="mmp-copy-style">
                    <span class="material-symbols-outlined">content_copy</span> Copiar Estilo
                </button>
                <button class="mmp-full-btn mmp-secondary" id="mmp-paste-style">
                    <span class="material-symbols-outlined">content_paste</span> Colar Estilo
                </button>
            </div>
        `;
        container.querySelector('#mmp-copy-style').onclick = () => {
            window.__craftoolsClipboardStyle = { type: el.getAttribute('data-craftool'), cssText: target?.style.cssText, zIndex: el.style.zIndex, meta: el._craftoolsMeta ? JSON.parse(JSON.stringify(el._craftoolsMeta)) : null };
            const btn = container.querySelector('#mmp-copy-style');
            btn.innerHTML = '<span class="material-symbols-outlined" style="color:var(--accent)">check</span> Copiado!';
            setTimeout(() => { btn.innerHTML = '<span class="material-symbols-outlined">content_copy</span> Copiar Estilo'; }, 1500);
        };
        container.querySelector('#mmp-paste-style').onclick = () => {
            const clip = window.__craftoolsClipboardStyle;
            if (!clip) return Notify.toast('Nenhum estilo copiado!', 'error');
            if (clip.type !== el.getAttribute('data-craftool')) return Notify.toast('Tipos incompatíveis.', 'error');
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
        import('../tools/album/AlbumTool.js').then(({ AlbumTool }) => {
            const mainPage = this._editor?.querySelector('.craftools-page');
            if (mainPage) AlbumTool.setup(this._editor, mainPage);
        });
    }
}
