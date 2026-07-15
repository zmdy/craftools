import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { PanelUI } from "../../utils/PanelUI.js";
import "./CarimboTool_Translations.js";

const t = (key) => I18n.t('carimbo.' + key);

const DEFAULT_STATE = () => ({
    outerText:     'EMPRESA FANTASIA LTDA',
    outerFontSize: 11,
    outerBold:     true,
    showInnerText: true,
    innerText:     'CNPJ: 00.000.000/0001-00',
    innerFontSize: 9,
    centerType:    'text',     // 'text' | 'none'
    centerText:    'CARIMBO',
    centerFontSize: 14,
    centerBold:    true,
    outerRadius:   85,         // controls overall stamp size inside 200×200 viewBox
    rings:         2,          // 1 | 2 | 3
    ringWidth:     1.5,
    separator:     'star',     // 'star' | 'dot' | 'diamond' | 'none'
    fontFamily:    'Arial',
    color:         '#1a1a2e',
});

const escXml = (s) =>
    String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const SEP_GLYPHS = { star: '★', dot: '●', diamond: '◆', none: '' };

export class CarimboTool extends BaseTool {

    // ── SVG generation ─────────────────────────────────────────────────────

    /**
     * Builds the complete stamp SVG from a state object.
     *
     * Layout (viewBox 0 0 200 200, centre = 100,100):
     *
     *   [outerBorderR] — outermost ring  (outerRadius)
     *   [outerBorderR2]— second thin ring (outerRadius - 4)
     *   [outerTextR]   — outer text arc   (outerRadius - 10)
     *   ★  sep  ★      — at (cx ± outerTextR, cy)
     *   [innerTextR]   — inner text arc   (outerRadius - 33)
     *   [innerBorderR] — inner thin ring  (outerRadius - 37) if rings=3
     *   CENTER TEXT    — at (cx, cy)
     */
    static buildSVG(state, uid) {
        const {
            outerText, outerFontSize, outerBold,
            showInnerText, innerText, innerFontSize,
            centerType, centerText, centerFontSize, centerBold,
            outerRadius, rings, ringWidth,
            separator, fontFamily, color,
        } = state;

        const cx = 100, cy = 100;
        const r  = Math.max(30, Math.min(93, outerRadius)); // clamp

        // Derived radii
        const outerBorderR  = r;
        const outerBorderR2 = r - 4;
        const outerTextR    = r - 10;
        const innerTextR    = r - 33;
        const innerBorderR  = r - 37;

        // Path IDs
        const outerPathId = `cb-op-${uid}`;
        const innerPathId = `cb-ip-${uid}`;

        // Arc paths (see TextoCurvoTool for the geometry proof):
        //   Top arc  (CW, sweep=1): M left A r r 0 0,1 right  → outside top, L→R
        //   Bot arc  (CCW, sweep=0): M left A r r 0 0,0 right → outside bottom, L→R
        const outerTopPath = `M ${cx - outerTextR},${cy} A ${outerTextR},${outerTextR} 0 0,1 ${cx + outerTextR},${cy}`;
        const innerBotPath = `M ${cx - innerTextR},${cy} A ${innerTextR},${innerTextR} 0 0,0 ${cx + innerTextR},${cy}`;

        // Border rings
        const ring1 = `<circle cx="${cx}" cy="${cy}" r="${outerBorderR}" fill="none" stroke="${color}" stroke-width="${ringWidth}"/>`;
        const ring2 = rings >= 2
            ? `<circle cx="${cx}" cy="${cy}" r="${outerBorderR2}" fill="none" stroke="${color}" stroke-width="${ringWidth * 0.4}"/>`
            : '';
        const ring3 = rings >= 3
            ? `<circle cx="${cx}" cy="${cy}" r="${innerBorderR}" fill="none" stroke="${color}" stroke-width="${ringWidth * 0.4}"/>`
            : '';

        // Separator glyphs — placed at the left and right junction of the text arcs
        const glyph = SEP_GLYPHS[separator] || '';
        const sepHtml = glyph ? `
            <text font-size="8" fill="${color}" font-family="${escXml(fontFamily)},sans-serif"
                  text-anchor="middle" dominant-baseline="middle">
                <tspan x="${cx - outerTextR}" y="${cy}">${glyph}</tspan>
            </text>
            <text font-size="8" fill="${color}" font-family="${escXml(fontFamily)},sans-serif"
                  text-anchor="middle" dominant-baseline="middle">
                <tspan x="${cx + outerTextR}" y="${cy}">${glyph}</tspan>
            </text>` : '';

        // Center content
        let centerHtml = '';
        if (centerType === 'text' && centerText) {
            // Multi-line support: split on \n
            const lines = String(centerText).split(/\\n|\n/);
            const lineH = Number(centerFontSize) * 1.25;
            const totalH = lines.length * lineH;
            const startY = cy - totalH / 2 + lineH * 0.45;
            centerHtml = `
            <text font-family="${escXml(fontFamily)},sans-serif"
                  font-size="${centerFontSize}"
                  font-weight="${centerBold ? 'bold' : 'normal'}"
                  fill="${color}"
                  text-anchor="middle">
                ${lines.map((line, i) =>
                    `<tspan x="${cx}" y="${startY + i * lineH}">${escXml(line)}</tspan>`
                ).join('')}
            </text>`;
        }

        return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
                     width="100%" height="100%" overflow="visible">
            <defs>
                <path id="${outerPathId}" d="${outerTopPath}"/>
                <path id="${innerPathId}" d="${innerBotPath}"/>
            </defs>

            ${ring1}
            ${ring2}
            ${ring3}

            <!-- Outer text (top arc) -->
            <text font-size="${outerFontSize}"
                  font-family="${escXml(fontFamily)},sans-serif"
                  font-weight="${outerBold ? 'bold' : 'normal'}"
                  fill="${color}">
                <textPath href="#${outerPathId}" startOffset="50%" text-anchor="middle">
                    ${escXml(outerText)}
                </textPath>
            </text>

            ${showInnerText ? `
            <!-- Inner text (bottom arc) -->
            <text font-size="${innerFontSize}"
                  font-family="${escXml(fontFamily)},sans-serif"
                  fill="${color}">
                <textPath href="#${innerPathId}" startOffset="50%" text-anchor="middle">
                    ${escXml(innerText)}
                </textPath>
            </text>` : ''}

            ${sepHtml}
            ${centerHtml}
        </svg>`;
    }

    // ── Element creation ────────────────────────────────────────────────────

    static createElement(type, editorApp) {
        const el  = document.createElement('craftools-element');
        const uid = Math.random().toString(36).slice(2, 8);

        el.setAttribute('data-craftool', 'carimbo');
        el.setAttribute('data-ct-uid',   uid);
        el.setAttribute('w',  '160');
        el.setAttribute('h',  '160');
        el.setAttribute('x',  '20');
        el.setAttribute('y',  '20');

        const state = DEFAULT_STATE();
        el.dataset.ctState = JSON.stringify(state);
        el._ctState = state;

        el.innerHTML = this.buildSVG(state, uid);
        return el;
    }

    static updateElement(el, state) {
        el._ctState = state;
        el.dataset.ctState = JSON.stringify(state);

        const uid = el.getAttribute('data-ct-uid') || 'x';
        const svgHtml = this.buildSVG(state, uid);

        const container = el.contentArea || el;
        const existing  = container.querySelector('svg');
        if (existing) {
            existing.outerHTML = svgHtml;
        } else {
            container.innerHTML = svgHtml;
        }
    }

    static getCtxOptions(_el) { return []; }
}
