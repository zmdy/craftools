import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { ShapeGenerator } from "../../utils/ShapeGenerator.js";
import { PanelUI } from "../../utils/PanelUI.js";
import "./ShapeTool_Translations.js";

/**
 * ShapeTool
 * Ferramenta de formas/shapes vetoriais (SVG) para o editor CrafTools.
 * A geração dos shapes é feita por ShapeGenerator.js (craftools/utils/) --
 * este arquivo monta o seletor de formas (picker, arrastável para a página),
 * o painel de propriedades (campos específicos por tipo de shape + cor/
 * contorno) e o elemento do editor, no mesmo padrão de EmojiTool/BarcodeTool.
 */

const PICKER_STYLE_ID = 'ct-shape-picker-styles';

function ensurePickerStyles() {
    if (document.getElementById(PICKER_STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = PICKER_STYLE_ID;
    s.textContent = `
        .ct-shape-grid {
            display: grid; grid-template-columns: repeat(4, 1fr);
            gap: 8px; padding: 10px 12px 14px;
        }
        .ct-shape-btn {
            background: var(--bg-input, #f4f4f5); border: 1px solid var(--border, #e4e4e7);
            cursor: grab; border-radius: 8px; padding: 10px;
            display: flex; align-items: center; justify-content: center;
            aspect-ratio: 1; transition: background 0.12s, transform 0.12s, border-color 0.12s;
        }
        .ct-shape-btn:hover { background: var(--bg-hover, rgba(0,0,0,.06)); border-color: var(--accent, #f97316); transform: scale(1.05); }
        .ct-shape-btn:active { cursor: grabbing; transform: scale(0.94); }
        .ct-shape-btn svg { width: 100%; height: 100%; pointer-events: none; }
        .ct-shape-preview {
            display: flex; align-items: center; justify-content: center;
            padding: 14px 0 6px;
        }
        .ct-shape-preview svg { width: 84px; height: 84px; }
        .ct-shape-change-picker { max-height: 260px; overflow-y: auto; }
    `;
    document.head.appendChild(s);
}

const SHAPE_LABEL_KEYS = {
    square: 'shapeSquare', circle: 'shapeCircle', triangle: 'shapeTriangle',
    polygon: 'shapePolygon', star: 'shapeStar', heart: 'shapeHeart',
    blob: 'shapeBlob', flower: 'shapeFlower',
};

export class ShapeTool extends BaseTool {

    // ── Cria um craftools-element contendo um shape SVG ─────────────────────
    static createElement(shapeType, editorApp) {
        const el = document.createElement('craftools-element');
        el.setAttribute('w', '120');
        el.setAttribute('h', '120');
        el.setAttribute('data-craftool', 'shape');

        el._craftoolsMeta = ShapeGenerator.defaultMeta(shapeType);

        const svg = ShapeGenerator.buildSvgElement(el._craftoolsMeta);
        svg.style.userSelect = 'none';
        svg.style.pointerEvents = 'none';
        el.appendChild(svg);

        return el;
    }

    // ── Renderiza o picker de formas ─────────────────────────────────────────
    // Se `targetElement` for informado, clicar numa forma troca a forma desse
    // elemento em vez de criar um novo (usado pelo botão "Trocar forma").
    // `onApplied` é chamado após a troca em um elemento existente (usado para
    // re-renderizar o painel de propriedades com os campos do novo tipo).
    static renderPickerPanel(panelBody, editor, targetElement = null, onApplied = null) {
        ensurePickerStyles();

        const applyShape = (shapeType) => {
            if (targetElement) {
                targetElement._craftoolsMeta = ShapeGenerator.defaultMeta(shapeType);
                this._regenerate(targetElement);
                if (onApplied) onApplied();
            } else {
                const page = editor.querySelector('.craftools-page');
                if (!page) return;
                const rect = page.getBoundingClientRect();
                const scale = window.craftoolsZoomLevel || 1;
                const el = ShapeTool.createElement(shapeType, editor);
                el.setAttribute('x', Math.round(rect.width / scale / 2 - 60));
                el.setAttribute('y', Math.round(rect.height / scale / 2 - 60));
                page.appendChild(el);
                requestAnimationFrame(() => { setTimeout(() => el.select?.(), 20); });
                const ph = page.querySelector('div[style*="font-size: 14px"]');
                if (ph) ph.remove();
            }
        };

        panelBody.innerHTML = `
            <div class="ct-shape-grid" id="ct-shape-grid">
                ${ShapeGenerator.SHAPE_TYPES.map(t => `
                    <button class="ct-shape-btn" data-shape="${t}" draggable="true"
                        title="${I18n.t('shapeTool.' + SHAPE_LABEL_KEYS[t])}">
                        ${ShapeGenerator.buildSvgString({ ...ShapeGenerator.defaultMeta(t), fillColor: '#a1a1aa', strokeWidth: 0 })}
                    </button>
                `).join('')}
            </div>
        `;

        panelBody.querySelectorAll('.ct-shape-btn').forEach(btn => {
            const shapeType = btn.dataset.shape;
            btn.addEventListener('click', (e) => { e.preventDefault(); applyShape(shapeType); });
            btn.addEventListener('dragstart', (ev) => {
                ev.dataTransfer.setData('ToolType', 'shape');
                ev.dataTransfer.setData('ShapeType', shapeType);
                ev.dataTransfer.effectAllowed = 'copy';
            });
        });
    }

    // ── Painel de propriedades (quando um shape está selecionado) ────────────
    static renderPropertiesPanel(editorPanel, element, editor) {
        const meta = element._craftoolsMeta || ShapeGenerator.defaultMeta('square');
        if (!element._craftoolsMeta) element._craftoolsMeta = meta;

        ensurePickerStyles();

        if (element.contentArea) {
            element.contentArea.style.pointerEvents = 'auto';
            element.contentArea.style.cursor = 'move';
        }

        let showingPicker = false;

        const htmlForma = `
            <div class="ct-shape-preview">${ShapeGenerator.buildSvgString(meta)}</div>
            <button class="craftools-pill" id="ct-shape-change-btn"
                style="width:100%;justify-content:center;gap:6px;margin-bottom:6px;">
                <span class="material-symbols-outlined" style="font-size:15px;">category</span>
                ${I18n.t('shapeTool.changeShape')}
            </button>
            <div id="ct-shape-picker-slot"></div>
            <div id="ct-shape-specific-fields">${this._renderShapeSpecificFields(meta)}</div>
        `;

        const htmlCor = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('shapeTool.fillColor')}</span>
                    <input type="color" id="shape-fill-color" class="craftools-color-swatch" value="${meta.fillColor}" style="width:100%;">
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('shapeTool.strokeColor')}</span>
                    <input type="color" id="shape-stroke-color" class="craftools-color-swatch" value="${meta.strokeColor}" style="width:100%;">
                </div>
            </div>
            <div class="ct-field" style="margin-top:8px;">
                <span class="craftools-label">${I18n.t('shapeTool.strokeWidth')}</span>
                ${PanelUI.slider('shape-stroke-width', 0, 10, 0.5, parseFloat(meta.strokeWidth) || 0, 'px')}
            </div>
        `;

        editorPanel.innerHTML =
            PanelUI.accordion('shape-forma', 'category', I18n.t('shapeTool.sectionShape'), htmlForma, { open: true }) +
            PanelUI.accordion('shape-cor', 'palette', I18n.t('shapeTool.sectionColor'), htmlCor);

        this.renderCommonProperties(editorPanel, element, {
            border: 'svg',
            radius: 'svg',
            padding: 'svg',
            margin: 'svg',
            zindex: true,
        });

        // --- Trocar forma ---
        editorPanel.querySelector('#ct-shape-change-btn').addEventListener('click', () => {
            showingPicker = !showingPicker;
            const slot = editorPanel.querySelector('#ct-shape-picker-slot');
            if (!slot) return;
            if (showingPicker) {
                slot.innerHTML = '<div class="ct-shape-change-picker" id="ct-shape-change-picker-body"></div>';
                const pickerBody = slot.querySelector('#ct-shape-change-picker-body');
                ShapeTool.renderPickerPanel(pickerBody, editor, element, () => {
                    this.renderPropertiesPanel(editorPanel, element, editor);
                });
            } else {
                slot.innerHTML = '';
            }
        });

        // --- Cor / contorno ---
        editorPanel.querySelector('#shape-fill-color').oninput = (e) => {
            meta.fillColor = e.target.value;
            this._regenerate(element);
        };
        editorPanel.querySelector('#shape-stroke-color').oninput = (e) => {
            meta.strokeColor = e.target.value;
            this._regenerate(element);
        };
        PanelUI.bindSlider(editorPanel, 'shape-stroke-width', 'px', (val) => {
            meta.strokeWidth = val;
            this._regenerate(element);
        });

        // --- Campos específicos do tipo de forma ---
        this._bindShapeSpecificFields(editorPanel, element, meta);
    }

    // ── Campos de configuração específicos por tipo de shape ─────────────────
    static _renderShapeSpecificFields(meta) {
        switch (meta.shapeType) {
            case 'square':
                return `
                    <div class="ct-field" style="margin-top:8px;">
                        <span class="craftools-label">${I18n.t('shapeTool.cornerRadius')}</span>
                        ${PanelUI.slider('shape-corner-radius', 0, 50, 1, parseFloat(meta.cornerRadius) || 0)}
                    </div>
                `;
            case 'polygon':
                return `
                    <div class="ct-field" style="margin-top:8px;">
                        <span class="craftools-label">${I18n.t('shapeTool.sides')}</span>
                        ${PanelUI.slider('shape-sides', 3, 12, 1, parseInt(meta.sides, 10) || 6)}
                    </div>
                `;
            case 'star':
                return `
                    <div class="ct-field" style="margin-top:8px;">
                        <span class="craftools-label">${I18n.t('shapeTool.points')}</span>
                        ${PanelUI.slider('shape-points', 3, 12, 1, parseInt(meta.points, 10) || 5)}
                    </div>
                    <div class="ct-field" style="margin-top:8px;">
                        <span class="craftools-label">${I18n.t('shapeTool.innerRatio')}</span>
                        ${PanelUI.slider('shape-inner-ratio', 0.15, 0.85, 0.05, meta.innerRatio ?? 0.45)}
                    </div>
                `;
            case 'blob':
                return `
                    <div class="ct-field" style="margin-top:8px;">
                        <span class="craftools-label">${I18n.t('shapeTool.blobPoints')}</span>
                        ${PanelUI.slider('shape-blob-points', 5, 20, 1, parseInt(meta.blobPoints, 10) || 8)}
                    </div>
                    <div class="ct-field" style="margin-top:8px;">
                        <span class="craftools-label">${I18n.t('shapeTool.blobRandomness')}</span>
                        ${PanelUI.slider('shape-blob-randomness', 0, 1, 0.05, meta.blobRandomness ?? 0.35)}
                    </div>
                    <button class="craftools-pill" id="ct-shape-blob-regenerate"
                        style="width:100%;justify-content:center;gap:6px;margin-top:8px;">
                        <span class="material-symbols-outlined" style="font-size:15px;">refresh</span>
                        ${I18n.t('shapeTool.regenerateBlob')}
                    </button>
                `;
            case 'flower':
                return `
                    <div class="ct-field" style="margin-top:8px;">
                        <span class="craftools-label">${I18n.t('shapeTool.petals')}</span>
                        ${PanelUI.slider('shape-petals', 4, 16, 1, parseInt(meta.petals, 10) || 6)}
                    </div>
                `;
            default:
                return '';
        }
    }

    static _bindShapeSpecificFields(editorPanel, element, meta) {
        switch (meta.shapeType) {
            case 'square':
                PanelUI.bindSlider(editorPanel, 'shape-corner-radius', '', (val) => {
                    meta.cornerRadius = val;
                    this._regenerate(element);
                });
                break;
            case 'polygon':
                PanelUI.bindSlider(editorPanel, 'shape-sides', '', (val) => {
                    meta.sides = val;
                    this._regenerate(element);
                });
                break;
            case 'star':
                PanelUI.bindSlider(editorPanel, 'shape-points', '', (val) => {
                    meta.points = val;
                    this._regenerate(element);
                });
                PanelUI.bindSlider(editorPanel, 'shape-inner-ratio', '', (val) => {
                    meta.innerRatio = val;
                    this._regenerate(element);
                });
                break;
            case 'blob': {
                PanelUI.bindSlider(editorPanel, 'shape-blob-points', '', (val) => {
                    meta.blobPoints = val;
                    this._regenerate(element);
                });
                PanelUI.bindSlider(editorPanel, 'shape-blob-randomness', '', (val) => {
                    meta.blobRandomness = val;
                    this._regenerate(element);
                });
                const regenBtn = editorPanel.querySelector('#ct-shape-blob-regenerate');
                if (regenBtn) {
                    regenBtn.addEventListener('click', () => {
                        meta.blobSeed = ShapeGenerator.randomSeed();
                        this._regenerate(element);
                        const preview = editorPanel.querySelector('.ct-shape-preview');
                        if (preview) preview.innerHTML = ShapeGenerator.buildSvgString(meta);
                    });
                }
                break;
            }
            case 'flower':
                PanelUI.bindSlider(editorPanel, 'shape-petals', '', (val) => {
                    meta.petals = val;
                    this._regenerate(element);
                });
                break;
        }
    }

    /** Reconstrói o SVG a partir do estado atual de `_craftoolsMeta`. */
    static _regenerate(element) {
        const meta = element._craftoolsMeta;
        if (!meta || !element.contentArea) return;

        const svgString = ShapeGenerator.buildSvgString(meta);
        const wrapper = document.createElement('div');
        wrapper.innerHTML = svgString;
        const fresh = wrapper.firstElementChild;

        let svg = element.contentArea.querySelector('svg');
        if (svg) {
            // Mantém o mesmo nó <svg> (preserva borda/raio aplicados via CommonProperties)
            svg.setAttribute('viewBox', fresh.getAttribute('viewBox'));
            svg.innerHTML = fresh.innerHTML;
        } else {
            fresh.style.userSelect = 'none';
            fresh.style.pointerEvents = 'none';
            element.contentArea.appendChild(fresh);
        }

        this._triggerChange(element);
    }

    static _triggerChange(element) {
        const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
        element.dispatchEvent(event);
    }

    static getCtxOptions() {
        return [];
    }
}
