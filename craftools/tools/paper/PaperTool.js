import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { PaperPatterns } from "./PaperPatterns.js";
import { CommonProperties } from "../../utils/CommonProperties.js";
import "./PaperTool_Translations.js";

export const PaperThemes = {
    default: { bg: '#ffffff', line: '#a1a1aa' },
    night: { bg: '#1e1e2f', line: '#4a4a6a' },
    sepia: { bg: '#faf0d8', line: '#cca785' },
    vintage: { bg: '#fbf6e3', line: '#cca633' },
    pastel: { bg: '#faf5ff', line: '#d8b4fe' },
    classic: { bg: '#fefcf0', line: '#d2c7b5' },
    minimalist: { bg: '#fafafa', line: '#eaeaea' },
    ocean: { bg: '#f0f9ff', line: '#bae6fd' },
    forest: { bg: '#f0fdf4', line: '#bbf7d0' },
    sunset: { bg: '#fff7ed', line: '#fed7aa' },
    tech: { bg: '#09090b', line: '#14b8a6' },
    elegant: { bg: '#fafaf9', line: '#e7e5e4' },
    creative: { bg: '#fff7fe', line: '#f0abfc' }
};

export const PaperPresets = {
    a4: { name: "A4 (210 × 297 mm)", w: 210, h: 297, unit: "mm" },
    a5: { name: "A5 (148 × 210 mm)", w: 148, h: 210, unit: "mm" },
    a3: { name: "A3 (297 × 420 mm)", w: 297, h: 420, unit: "mm" },
    b4: { name: "B4 (250 × 353 mm)", w: 250, h: 353, unit: "mm" },
    b5: { name: "B5 (176 × 250 mm)", w: 176, h: 250, unit: "mm" },
    letter: { name: "Letter (216 × 279 mm)", w: 216, h: 279, unit: "mm" },
    legal: { name: "Legal (216 × 356 mm)", w: 216, h: 356, unit: "mm" },
    tabloid: { name: "Tabloid (279 × 432 mm)", w: 279, h: 432, unit: "mm" },
    executive: { name: "Executive (184 × 267 mm)", w: 184, h: 267, unit: "mm" },
    custom: { name: "Custom Size", w: 210, h: 297, unit: "mm" }
};

export class PaperTool extends BaseTool {
    
    static getCtxOptions() {
        return [];
    }

    static getDefaultMeta() {
        return {
            paperType: 'lined',
            paperSize: 'a4',
            theme: 'default',
            lineColor: '#a1a1aa',
            lineStyle: 'solid',
            lineSpacing: 8,
            lineWidth: 0.5,
            margins: {
                top: 25,
                right: 20,
                bottom: 25,
                left: 20
            },
            sidebar: {
                enabled: false
            },
            bgColor: '#ffffff',
            bgPattern: 'none',
            watermark: {
                enabled: false
            },
            logo: {
                enabled: false
            },
            pageSettings: {
                pageCount: 1,
                showPageNumber: false
            }
        };
    }

    static createElement(type, editorApp) {
        const el = document.createElement('craftools-element');
        el.setAttribute('data-craftool', 'papeis');
        // O papel de fundo fica travado por padrão -- diferente de todas as outras
        // ferramentas (que nascem destravadas) -- para não ser movido/redimensionado
        // sem querer por cima da página. Ver CommonProperties.js (toggle "Bloquear")
        // e Element.js (_syncLockUI) para o mecanismo genérico de bloqueio.
        el.setAttribute('data-locked', 'true');

        // Configurações padrão de papel
        const meta = this.getDefaultMeta();
        el._craftoolsMeta = meta;

        // Se houver uma página ativa no editor, ajustamos o papel ao tamanho total dela
        const activePage = editorApp.activePage || editorApp.querySelector('.craftools-page');
        let width = 210;
        let height = 297;
        let unit = 'mm';

        if (activePage) {
            const pageW = activePage.style.width || '210mm';
            const pageH = activePage.style.minHeight || '297mm';
            unit = pageW.replace(/[0-9.-]/g, '') || 'mm';
            width = parseFloat(pageW) || 210;
            height = parseFloat(pageH) || 297;
        }

        el.setAttribute('x', `0${unit}`);
        el.setAttribute('y', `0${unit}`);
        el.setAttribute('w', `${width}${unit}`);
        el.setAttribute('h', `${height}${unit}`);

        // O papel fica no fundo de tudo (z-index baixo)
        el.style.zIndex = '1';

        // Cria a div interna de conteúdo
        const innerDiv = document.createElement('div');
        innerDiv.className = 'paper-content-area';
        innerDiv.style.cssText = 'width:100%; height:100%; position:relative; overflow:hidden;';
        
        // Gera o SVG do papel
        innerDiv.innerHTML = PaperPatterns.generateSVG(meta, width, height);
        el.appendChild(innerDiv);

        return el;
    }

    static updatePaperSVG(element) {
        const meta = element._craftoolsMeta;
        if (!meta) return;

        const container = element.querySelector('.paper-content-area') || element.firstElementChild;
        if (container) {
            const w = element.pw || parseFloat(element.getAttribute('w')) || 210;
            const h = element.ph || parseFloat(element.getAttribute('h')) || 297;
            container.innerHTML = PaperPatterns.generateSVG(meta, w, h);
        }

        element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
    }

    static renderPropertiesPanel(editorPanel, element) {
        const meta = element._craftoolsMeta || this.getDefaultMeta();
        if (!element._craftoolsMeta) element._craftoolsMeta = meta;

        // Ao selecionar o papel, garantimos que podemos clicar nele, mas ele fica atrás dos outros
        element.style.zIndex = '1';

        const editor = element.closest('craftools-editor') || document.querySelector('craftools-editor');

        // Obter quantidade de páginas
        let pageCountVal = 1;
        if (editor) {
            const pages = editor.querySelectorAll('.craftools-page');
            pageCountVal = pages.length;
            meta.pageSettings.pageCount = pageCountVal;
        }

        // ── Acordeão 1: Tipo de Papel ──────────────────────────────────────────
        const htmlTipo = `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('paperTool.paperType')}</span>
                <select id="paper-select-type" class="craftools-select" style="width:100%;">
                    <option value="lined" ${meta.paperType === 'lined' ? 'selected' : ''}>${I18n.t('paperTool.lined')}</option>
                    <option value="vertical_lined" ${meta.paperType === 'vertical_lined' ? 'selected' : ''}>${I18n.t('paperTool.vertical_lined')}</option>
                    <option value="grid" ${meta.paperType === 'grid' ? 'selected' : ''}>${I18n.t('paperTool.grid')}</option>
                    <option value="dot" ${meta.paperType === 'dot' ? 'selected' : ''}>${I18n.t('paperTool.dot')}</option>
                    <option value="pink_millimeter_grid" ${meta.paperType === 'pink_millimeter_grid' ? 'selected' : ''}>${I18n.t('paperTool.pink_millimeter_grid')}</option>
                    <option value="grid_lined_split" ${meta.paperType === 'grid_lined_split' ? 'selected' : ''}>${I18n.t('paperTool.grid_lined_split')}</option>
                    <option value="blank" ${meta.paperType === 'blank' ? 'selected' : ''}>${I18n.t('paperTool.blank')}</option>
                    <option value="music" ${meta.paperType === 'music' ? 'selected' : ''}>${I18n.t('paperTool.music')}</option>
                    <option value="guitar_tab" ${meta.paperType === 'guitar_tab' ? 'selected' : ''}>${I18n.t('paperTool.guitar_tab')}</option>
                    <option value="ukulele_staff_tab" ${meta.paperType === 'ukulele_staff_tab' ? 'selected' : ''}>${I18n.t('paperTool.ukulele_staff_tab')}</option>
                    <option value="guitar_chord_treble_staff" ${meta.paperType === 'guitar_chord_treble_staff' ? 'selected' : ''}>${I18n.t('paperTool.guitar_chord_treble_staff')}</option>
                    <option value="calligraphy" ${meta.paperType === 'calligraphy' ? 'selected' : ''}>${I18n.t('paperTool.calligraphy')}</option>
                    <option value="cornell" ${meta.paperType === 'cornell' ? 'selected' : ''}>${I18n.t('paperTool.cornell')}</option>
                    <option value="isometric" ${meta.paperType === 'isometric' ? 'selected' : ''}>${I18n.t('paperTool.isometric')}</option>
                    <option value="perspective_sketch" ${meta.paperType === 'perspective_sketch' ? 'selected' : ''}>${I18n.t('paperTool.perspective_sketch')}</option>
                    <option value="hexagonal" ${meta.paperType === 'hexagonal' ? 'selected' : ''}>${I18n.t('paperTool.hexagonal')}</option>
                    <option value="seyes" ${meta.paperType === 'seyes' ? 'selected' : ''}>${I18n.t('paperTool.seyes')}</option>
                    <option value="storyboard" ${meta.paperType === 'storyboard' ? 'selected' : ''}>${I18n.t('paperTool.storyboard')}</option>
                </select>
            </div>
            
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('paperTool.paperSize')}</span>
                <select id="paper-select-size" class="craftools-select" style="width:100%;">
                    ${Object.entries(PaperPresets).map(([key, item]) => `
                        <option value="${key}" ${meta.paperSize === key ? 'selected' : ''}>${item.name}</option>
                    `).join('')}
                </select>
            </div>

            <div class="ct-field">
                <span class="craftools-label">${I18n.t('paperTool.theme')}</span>
                <select id="paper-select-theme" class="craftools-select" style="width:100%;">
                    ${Object.keys(PaperThemes).map(themeKey => `
                        <option value="${themeKey}" ${meta.theme === themeKey ? 'selected' : ''}>${I18n.t('paperTool.' + themeKey) || themeKey}</option>
                    `).join('')}
                </select>
            </div>
        `;

        // ── Acordeão 2: Estilo das Linhas ─────────────────────────────────────
        const htmlLinhas = `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('paperTool.lineColor')}</span>
                <input type="color" id="paper-line-color" class="craftools-color-swatch" value="${meta.lineColor}" style="width:100%;">
            </div>

            <div class="ct-field">
                <span class="craftools-label">${I18n.t('paperTool.lineStyle')}</span>
                <select id="paper-line-style" class="craftools-select" style="width:100%;">
                    <option value="solid" ${meta.lineStyle === 'solid' ? 'selected' : ''}>${I18n.t('paperTool.solid')}</option>
                    <option value="dashed" ${meta.lineStyle === 'dashed' ? 'selected' : ''}>${I18n.t('paperTool.dashed')}</option>
                    <option value="dotted" ${meta.lineStyle === 'dotted' ? 'selected' : ''}>${I18n.t('paperTool.dotted')}</option>
                </select>
            </div>

            <div class="ct-field">
                <span class="craftools-label">${I18n.t('paperTool.lineSpacing')}</span>
                <div style="position:relative; display:flex; align-items:center;">
                    <input type="number" id="paper-line-spacing" min="4" max="20" step="0.5" class="craftools-input" style="width:100%; padding-right:80px;" value="${meta.lineSpacing}">
                    <button type="button" id="paper-btn-spacing-rec" style="position:absolute; right:4px; top:50%; transform:translateY(-50%); font-size:9px; font-weight:600; padding:3px 6px; border:none; border-radius:4px; background:var(--accent-subtle, #ffe4e6); color:var(--accent, #f43f5e); cursor:pointer;">Rec (8mm)</button>
                </div>
            </div>

            <div class="ct-field">
                <span class="craftools-label">${I18n.t('paperTool.lineWidth')}</span>
                <input type="number" id="paper-line-width" min="0.1" max="5" step="0.1" class="craftools-input" style="width:100%;" value="${meta.lineWidth}">
            </div>
        `;

        // ── Acordeão 3: Margens ────────────────────────────────────────────────
        const htmlMargens = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('paperTool.topMargin')}</span>
                    <input type="number" id="paper-margin-top" class="craftools-input" value="${meta.margins.top}">
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('paperTool.rightMargin')}</span>
                    <input type="number" id="paper-margin-right" class="craftools-input" value="${meta.margins.right}">
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('paperTool.bottomMargin')}</span>
                    <input type="number" id="paper-margin-bottom" class="craftools-input" value="${meta.margins.bottom}">
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('paperTool.leftMargin')}</span>
                    <input type="number" id="paper-margin-left" class="craftools-input" value="${meta.margins.left}">
                </div>
            </div>
        `;

        // ── Acordeão 4: Barra Lateral & Marca d'água ──────────────────────────
        const htmlExtras = `
            <div class="ct-field" style="flex-direction:row; align-items:center; gap:6px;">
                <input type="checkbox" id="paper-check-sidebar" ${meta.sidebar.enabled ? 'checked' : ''} style="cursor:pointer;">
                <span class="craftools-label" style="margin:0; cursor:pointer;" id="label-check-sidebar">${I18n.t('paperTool.enableSidebar')}</span>
            </div>

            <div class="ct-field" style="flex-direction:row; align-items:center; gap:6px; margin-top:8px;">
                <input type="checkbox" id="paper-check-watermark" ${meta.watermark.enabled ? 'checked' : ''} style="cursor:pointer;">
                <span class="craftools-label" style="margin:0; cursor:pointer;" id="label-check-watermark">${I18n.t('paperTool.enableWatermark')}</span>
            </div>

            <div class="ct-field" style="flex-direction:row; align-items:center; gap:6px; margin-top:8px;">
                <input type="checkbox" id="paper-check-logo" ${meta.logo.enabled ? 'checked' : ''} style="cursor:pointer;">
                <span class="craftools-label" style="margin:0; cursor:pointer;" id="label-check-logo">${I18n.t('paperTool.enableLogo')}</span>
            </div>
        `;

        // ── Acordeão 5: Configurações de Fundo ────────────────────────────────
        const htmlFundo = `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('paperTool.bgColor')}</span>
                <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                    <input type="color" id="paper-bg-color" class="craftools-color-swatch" value="${meta.bgColor}" style="flex:0 0 40px; height:34px;">
                    <input type="text" id="paper-bg-hex" class="craftools-input" value="${meta.bgColor}" style="flex:1;" placeholder="#ffffff">
                </div>
                
                <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap:4px;" id="paper-bg-palette">
                    ${['#ffffff', '#fff8e1', '#f8f9fa', '#f0f9ff', '#f0fdf4', '#fcf2f8', '#fffbeb'].map(c => `
                        <div class="color-palette-swatch" data-color="${c}" style="width:100%; aspect-ratio:1; border-radius:6px; background:${c}; cursor:pointer; border:1px solid var(--border); box-sizing:border-box;"></div>
                    `).join('')}
                </div>
            </div>

            <div class="ct-field">
                <span class="craftools-label">${I18n.t('paperTool.bgPattern')}</span>
                <select id="paper-bg-pattern" class="craftools-select" style="width:100%;">
                    <option value="none" ${meta.bgPattern === 'none' ? 'selected' : ''}>${I18n.t('paperTool.none')}</option>
                    <option value="grid" ${meta.bgPattern === 'grid' ? 'selected' : ''}>${I18n.t('cellPanel.grid')}</option>
                    <option value="dots" ${meta.bgPattern === 'dots' ? 'selected' : ''}>${I18n.t('paperTool.dots')}</option>
                    <option value="lines" ${meta.bgPattern === 'lines' ? 'selected' : ''}>${I18n.t('paperTool.lines')}</option>
                    <option value="crosshatch" ${meta.bgPattern === 'crosshatch' ? 'selected' : ''}>${I18n.t('paperTool.crosshatch')}</option>
                    <option value="graph" ${meta.bgPattern === 'graph' ? 'selected' : ''}>${I18n.t('paperTool.graph')}</option>
                </select>
            </div>
        `;

        // ── Acordeão 6: Configurações de Página ───────────────────────────────
        const htmlPaginas = `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('paperTool.pageCount')}</span>
                <input type="number" id="paper-page-count" min="1" max="100" class="craftools-input" value="${pageCountVal}">
            </div>

            <div class="ct-field" style="flex-direction:row; align-items:center; gap:6px; margin-top:8px;">
                <input type="checkbox" id="paper-check-pagenumbering" ${meta.pageSettings.showPageNumber ? 'checked' : ''} style="cursor:pointer;">
                <span class="craftools-label" style="margin:0; cursor:pointer;" id="label-check-pagenumbering">${I18n.t('paperTool.showPageNumber')}</span>
            </div>

            <div style="display:flex; gap:8px; margin-top:14px;">
                <button class="craftools-pill" id="paper-btn-export" style="flex:1; justify-content:center; gap:4px; font-size:11px; padding:6px 0;">
                    <span class="material-symbols-outlined" style="font-size:14px;">download</span> ${I18n.t('paperTool.exportSettings')}
                </button>
                <button class="craftools-pill" id="paper-btn-import" style="flex:1; justify-content:center; gap:4px; font-size:11px; padding:6px 0;">
                    <span class="material-symbols-outlined" style="font-size:14px;">upload</span> ${I18n.t('paperTool.importSettings')}
                </button>
                <input type="file" id="paper-import-file" accept=".json" style="display:none;">
            </div>
        `;

        editorPanel.innerHTML = 
            PanelUI.accordion('paper-tipo', 'layers', I18n.t('paperTool.paperType') || 'Tipo de Papel', htmlTipo, { open: true }) +
            PanelUI.accordion('paper-linhas', 'edit', I18n.t('paperTool.lineStyle') || 'Estilo de Linhas', htmlLinhas) +
            PanelUI.accordion('paper-margens', 'fullscreen', I18n.t('paperTool.margins') || 'Márgenes', htmlMargens) +
            PanelUI.accordion('paper-extras', 'more_horiz', I18n.t('paperTool.sidebar') || 'Opções Extras', htmlExtras) +
            PanelUI.accordion('paper-fundo', 'palette', I18n.t('paperTool.bgSettings') || 'Fundo', htmlFundo) +
            PanelUI.accordion('paper-paginas', 'pages', I18n.t('paperTool.pageSettings') || 'Configurações de Página', htmlPaginas);

        // Renderização de propriedades comuns no final
        this.renderCommonProperties(editorPanel, element, {
            zindex: true,
            onChange: () => {
                this.updatePaperSVG(element);
            }
        });

        // ── Vinculação de Eventos (Bindings) ──────────────────────────────────
        
        // 1. Tipo de papel
        const selType = editorPanel.querySelector('#paper-select-type');
        selType.addEventListener('change', (e) => {
            meta.paperType = e.target.value;
            this.updatePaperSVG(element);
        });

        // 2. Tamanho do Papel e Presets de Página
        const selSize = editorPanel.querySelector('#paper-select-size');
        selSize.addEventListener('change', (e) => {
            const sizeKey = e.target.value;
            meta.paperSize = sizeKey;
            
            const preset = PaperPresets[sizeKey];
            if (preset && preset !== 'custom') {
                const page = element.closest('.craftools-page');
                if (page) {
                    // Atualiza a dimensão da página
                    page.style.width = preset.w + preset.unit;
                    page.style.minHeight = preset.h + preset.unit;
                    
                    // Atualiza a dimensão e posicionamento do papel para cobrir a página
                    element.setAttribute('x', `0${preset.unit}`);
                    element.setAttribute('y', `0${preset.unit}`);
                    element.setAttribute('w', `${preset.w}${preset.unit}`);
                    element.setAttribute('h', `${preset.h}${preset.unit}`);
                    
                    element.px = 0;
                    element.py = 0;
                    element.pw = preset.w;
                    element.ph = preset.h;
                    
                    if (typeof element._applyTransform === 'function') {
                        element._applyTransform();
                    }
                }
            }
            this.updatePaperSVG(element);
        });

        // 3. Temas
        const selTheme = editorPanel.querySelector('#paper-select-theme');
        selTheme.addEventListener('change', (e) => {
            const themeKey = e.target.value;
            meta.theme = themeKey;
            
            const themeConfig = PaperThemes[themeKey];
            if (themeConfig) {
                meta.bgColor = themeConfig.bg;
                meta.lineColor = themeConfig.line;
                
                // Atualiza inputs no painel
                editorPanel.querySelector('#paper-line-color').value = themeConfig.line;
                editorPanel.querySelector('#paper-bg-color').value = themeConfig.bg;
                editorPanel.querySelector('#paper-bg-hex').value = themeConfig.bg;
            }
            this.updatePaperSVG(element);
        });

        // 4. Estilo de linhas
        const lineColorInput = editorPanel.querySelector('#paper-line-color');
        lineColorInput.addEventListener('input', (e) => {
            meta.lineColor = e.target.value;
            this.updatePaperSVG(element);
        });

        const lineStyleSelect = editorPanel.querySelector('#paper-line-style');
        lineStyleSelect.addEventListener('change', (e) => {
            meta.lineStyle = e.target.value;
            this.updatePaperSVG(element);
        });

        const lineSpacingInput = editorPanel.querySelector('#paper-line-spacing');
        lineSpacingInput.addEventListener('input', (e) => {
            meta.lineSpacing = parseFloat(e.target.value) || 8;
            this.updatePaperSVG(element);
        });

        const btnSpacingRec = editorPanel.querySelector('#paper-btn-spacing-rec');
        btnSpacingRec.addEventListener('click', () => {
            lineSpacingInput.value = 8;
            meta.lineSpacing = 8;
            this.updatePaperSVG(element);
        });

        const lineWidthInput = editorPanel.querySelector('#paper-line-width');
        lineWidthInput.addEventListener('input', (e) => {
            meta.lineWidth = parseFloat(e.target.value) || 0.5;
            this.updatePaperSVG(element);
        });

        // 5. Margens
        ['top', 'right', 'bottom', 'left'].forEach(side => {
            const input = editorPanel.querySelector(`#paper-margin-${side}`);
            input.addEventListener('input', (e) => {
                meta.margins[side] = parseFloat(e.target.value) || 0;
                this.updatePaperSVG(element);
            });
        });

        // 6. Configurações Extras (Sidebar, Watermark, Logo)
        const checkSidebar = editorPanel.querySelector('#paper-check-sidebar');
        const labelSidebar = editorPanel.querySelector('#label-check-sidebar');
        const toggleSidebar = () => {
            meta.sidebar.enabled = checkSidebar.checked;
            this.updatePaperSVG(element);
        };
        checkSidebar.addEventListener('change', toggleSidebar);
        labelSidebar.addEventListener('click', () => {
            checkSidebar.checked = !checkSidebar.checked;
            toggleSidebar();
        });

        const checkWatermark = editorPanel.querySelector('#paper-check-watermark');
        const labelWatermark = editorPanel.querySelector('#label-check-watermark');
        const toggleWatermark = () => {
            meta.watermark.enabled = checkWatermark.checked;
            this.updatePaperSVG(element);
        };
        checkWatermark.addEventListener('change', toggleWatermark);
        labelWatermark.addEventListener('click', () => {
            checkWatermark.checked = !checkWatermark.checked;
            toggleWatermark();
        });

        const checkLogo = editorPanel.querySelector('#paper-check-logo');
        const labelLogo = editorPanel.querySelector('#label-check-logo');
        const toggleLogo = () => {
            meta.logo.enabled = checkLogo.checked;
            this.updatePaperSVG(element);
        };
        checkLogo.addEventListener('change', toggleLogo);
        labelLogo.addEventListener('click', () => {
            checkLogo.checked = !checkLogo.checked;
            toggleLogo();
        });

        // 7. Configurações de Fundo (Cor, Hex, Paleta, Padrão)
        const bgColorInput = editorPanel.querySelector('#paper-bg-color');
        const bgHexInput = editorPanel.querySelector('#paper-bg-hex');
        
        const updateBg = (val) => {
            meta.bgColor = val;
            bgColorInput.value = val;
            bgHexInput.value = val;
            this.updatePaperSVG(element);
        };

        bgColorInput.addEventListener('input', (e) => updateBg(e.target.value));
        bgHexInput.addEventListener('change', (e) => {
            if (/^#[0-9a-f]{3,6}$/i.test(e.target.value)) {
                updateBg(e.target.value);
            }
        });

        editorPanel.querySelectorAll('#paper-bg-palette .color-palette-swatch').forEach(sw => {
            sw.addEventListener('click', (e) => {
                e.preventDefault();
                updateBg(sw.dataset.color);
            });
        });

        const bgPatternSelect = editorPanel.querySelector('#paper-bg-pattern');
        bgPatternSelect.addEventListener('change', (e) => {
            meta.bgPattern = e.target.value;
            this.updatePaperSVG(element);
        });

        // 8. Configurações de Página (Quantidade e paginação)
        const pageCountInput = editorPanel.querySelector('#paper-page-count');
        pageCountInput.addEventListener('change', async (e) => {
            if (!editor) return;
            const newCount = Math.max(1, parseInt(e.target.value) || 1);
            meta.pageSettings.pageCount = newCount;
            
            const pagesWrapper = editor.querySelector('#pages-wrapper');
            if (pagesWrapper) {
                const currentPages = Array.from(pagesWrapper.querySelectorAll('.craftools-page'));
                const currentCount = currentPages.length;
                
                if (newCount > currentCount) {
                    // Adiciona novas páginas
                    const { PageTool } = await import("../page/PageTool.js");
                    for (let i = currentCount; i < newCount; i++) {
                        PageTool.addNewPage(editor);
                    }
                } else if (newCount < currentCount) {
                    // Remove do final (respeitando a página mínima de 1)
                    for (let i = currentCount - 1; i >= newCount; i--) {
                        currentPages[i].remove();
                    }
                }
                
                // Notificar alteração de página para o histórico
                document.dispatchEvent(new CustomEvent('craftools-page-add', { bubbles: true }));
            }
        });

        const checkPageNum = editorPanel.querySelector('#paper-check-pagenumbering');
        const labelPageNum = editorPanel.querySelector('#label-check-pagenumbering');
        const togglePageNum = () => {
            meta.pageSettings.showPageNumber = checkPageNum.checked;
            this.updatePaperSVG(element);
        };
        checkPageNum.addEventListener('change', togglePageNum);
        labelPageNum.addEventListener('click', () => {
            checkPageNum.checked = !checkPageNum.checked;
            togglePageNum();
        });

        // 9. Exportar / Importar
        const btnExport = editorPanel.querySelector('#paper-btn-export');
        btnExport.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(meta, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", "paper-settings.json");
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        });

        const btnImport = editorPanel.querySelector('#paper-btn-import');
        const importFileInput = editorPanel.querySelector('#paper-import-file');
        
        btnImport.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const importedMeta = JSON.parse(event.target.result);
                        
                        // Atualiza as propriedades no meta do elemento
                        Object.assign(meta, importedMeta);
                        element._craftoolsMeta = meta;
                        
                        // Recarrega o painel de propriedades para atualizar os seletores
                        this.renderPropertiesPanel(editorPanel, element);
                        
                        // Atualiza o SVG do papel
                        this.updatePaperSVG(element);
                    } catch (err) {
                        console.error("Erro ao ler JSON de configuração de papel", err);
                    }
                };
                reader.readAsText(file);
            }
        });
    }
}
