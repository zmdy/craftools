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
    // Legacy renderPropertiesPanel, _renderShapeSpecificFields, and _bindShapeSpecificFields deleted.
    // Panel rendering is now schema-driven in ShapeTool.ts via PropertyRenderer.

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
