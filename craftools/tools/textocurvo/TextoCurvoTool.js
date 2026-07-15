import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import "./TextoCurvoTool_Translations.js";

const t = (key) => I18n.t('textoCurvo.' + key);

/** Default tool state */
const DEFAULT_STATE = () => ({
    text:          'MINHA EMPRESA',
    mode:          'arc-top',   // 'arc-top' | 'arc-bottom' | 'full-circle'
    radius:        70,
    fontSize:      13,
    fontFamily:    'Arial',
    color:         '#000000',
    letterSpacing: 2,
    startOffset:   50,          // 0–100, only used in full-circle mode
    bold:          false,
    italic:        false,
    useGradient:   false,
    gradFrom:      '#f97316',
    gradTo:        '#ec4899',
    gradAngle:     0,           // degrees — maps to SVG gradient orientation
});

/** Escapes XML special characters for safe SVG embedding */
const escXml = (s) =>
    String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

export class TextoCurvoTool extends BaseTool {

    // ── SVG generation ─────────────────────────────────────────────────────

    /**
     * Returns the SVG path `d` for the requested mode.
     * Origin of the SVG is (0,0); centrepoint is always (100,100).
     *
     * SVG arc geometry cheat-sheet (Y-axis points DOWN):
     *   sweep=1 → visually clockwise   → text placed OUTSIDE (above path)
     *   sweep=0 → visually CCW          → text placed INSIDE  (above path = toward centre)
     *
     * We use:
     *   arc-top:    M left A r r 0 0 1 right  (CW small-arc via top)   → outside top, L→R ✓
     *   arc-bottom: M left A r r 0 0 0 right  (CCW small-arc via bottom) → outside bottom, L→R ✓
     *   full-circle: two CW large-arcs           → outside, startOffset controls position
     */
    static _pathD(mode, r, startOffset) {
        const cx = 100, cy = 100;
        const lx = cx - r, rx = cx + r;

        if (mode === 'arc-top') {
            // Clockwise small arc from left to right — traces the TOP semicircle
            return `M ${lx},${cy} A ${r},${r} 0 0,1 ${rx},${cy}`;
        }
        if (mode === 'arc-bottom') {
            // Counter-clockwise small arc from left to right — traces the BOTTOM semicircle
            // Text appears outside (below the bottom arc) and reads left-to-right ✓
            return `M ${lx},${cy} A ${r},${r} 0 0,0 ${rx},${cy}`;
        }
        // full-circle: two CW 180° arcs starting from the left point
        // 0%=left, 25%=top, 50%=right, 75%=bottom  (text outside, CW)
        return `M ${lx},${cy} A ${r},${r} 0 1,1 ${rx},${cy} A ${r},${r} 0 1,1 ${lx},${cy}`;
    }

    static buildSVG(state, uid) {
        const {
            text, mode, radius, fontSize, fontFamily,
            color, letterSpacing, startOffset,
            bold, italic, useGradient, gradFrom, gradTo, gradAngle,
        } = state;

        const pathId  = `tc-path-${uid}`;
        const gradId  = `tc-grad-${uid}`;
        const fontWeight = bold   ? 'bold'   : 'normal';
        const fontStyle  = italic ? 'italic' : 'normal';

        // Gradient definitions (only if enabled)
        const gradDeg  = Number(gradAngle) || 0;
        const radGrad  = gradDeg * (Math.PI / 180);
        const x1 = 50 - Math.cos(radGrad) * 50;
        const y1 = 50 - Math.sin(radGrad) * 50;
        const x2 = 50 + Math.cos(radGrad) * 50;
        const y2 = 50 + Math.sin(radGrad) * 50;

        const gradDef = useGradient ? `
            <linearGradient id="${gradId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"
                            gradientUnits="userSpaceOnUse"
                            x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
                <stop offset="0%"   stop-color="${gradFrom}"/>
                <stop offset="100%" stop-color="${gradTo}"/>
            </linearGradient>` : '';

        const fillAttr = useGradient ? `fill="url(#${gradId})"` : `fill="${color}"`;
        const pathD = this._pathD(mode, radius, startOffset);

        // For full-circle mode only, startOffset controls where text is placed
        const offset = mode === 'full-circle'
            ? `${Math.max(0, Math.min(100, startOffset))}%`
            : '50%';

        return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" overflow="visible">
            <defs>
                ${gradDef}
                <path id="${pathId}" d="${pathD}"/>
            </defs>
            <text
                font-size="${fontSize}"
                font-family="${escXml(fontFamily)}, sans-serif"
                font-weight="${fontWeight}"
                font-style="${fontStyle}"
                letter-spacing="${letterSpacing}"
                ${fillAttr}
            >
                <textPath href="#${pathId}" startOffset="${offset}" text-anchor="middle">
                    ${escXml(text)}
                </textPath>
            </text>
        </svg>`;
    }

    // ── Element creation ────────────────────────────────────────────────────

    static createElement(type, editorApp) {
        const el  = document.createElement('craftools-element');
        const uid = Math.random().toString(36).slice(2, 8);

        el.setAttribute('data-craftool', 'textocurvo');
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

    /** Update element SVG and persisted state in-place. */
    static updateElement(el, state) {
        el._ctState = state;
        el.dataset.ctState = JSON.stringify(state);

        const uid = el.getAttribute('data-ct-uid') || 'x';
        const svgHtml = this.buildSVG(state, uid);

        // Replace the SVG child (works whether content is in contentArea or directly in el)
        const container = el.contentArea || el;
        const existing  = container.querySelector('svg');
        if (existing) {
            existing.outerHTML = svgHtml;
        } else {
            container.innerHTML = svgHtml;
        }
    }

    static getCtxOptions(_el) { return []; }
    // Legacy renderPropertiesPanel deleted.
    // Panel rendering is now schema-driven in TextoCurvoTool.ts via PropertyRenderer.
}
