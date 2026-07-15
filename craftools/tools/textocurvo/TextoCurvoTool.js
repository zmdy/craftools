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

    // ── Properties panel ────────────────────────────────────────────────────

    static renderPropertiesPanel(panelBody, el, _editor) {
        // Re-hydrate state from attribute if the JS property was lost (e.g., after undo)
        if (!el._ctState && el.dataset.ctState) {
            el._ctState = JSON.parse(el.dataset.ctState);
        }
        const state = el._ctState || DEFAULT_STATE();
        el._ctState = state;

        // ── Font list ──────────────────────────────────────────────────────
        const fonts = (window.craftoolsApp?.fonts || [
            'Arial','Georgia','Verdana','Courier New','Times New Roman',
            'Trebuchet MS','Impact','Palatino','Garamond',
        ]);
        const fontOptions = fonts.map(f =>
            `<option value="${f}" ${state.fontFamily === f ? 'selected' : ''}
                style="font-family:'${f}',sans-serif;">${f}</option>`
        ).join('');

        panelBody.innerHTML = `
<div style="padding:12px;display:flex;flex-direction:column;gap:14px;">

    <!-- Text input -->
    <div>
        <div class="ct-sublabel">
            <span class="material-symbols-outlined">text_fields</span>${t('text')}
        </div>
        <input id="tc-text" type="text" class="craftools-input"
               value="${escXml(state.text)}" placeholder="${t('textPlaceholder')}">
    </div>

    <!-- Path mode -->
    <div>
        <div class="ct-sublabel">
            <span class="material-symbols-outlined">route</span>${t('mode')}
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
            ${[
                ['arc-top',    'north',           t('modeArcTop')   ],
                ['arc-bottom', 'south',           t('modeArcBottom')],
                ['full-circle','circle',          t('modeCircle')   ],
            ].map(([val, icon, label]) => `
                <button data-mode="${val}" style="
                    flex:1;min-width:0;
                    display:flex;flex-direction:column;align-items:center;gap:2px;
                    padding:6px 4px;border-radius:8px;cursor:pointer;font-size:10px;
                    border:2px solid ${state.mode === val ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)'};
                    background:${state.mode === val ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)'};
                    color:var(--text);font-family:inherit;font-weight:600;
                ">
                    <span class="material-symbols-outlined" style="font-size:18px;">${icon}</span>
                    ${label}
                </button>
            `).join('')}
        </div>
    </div>

    <!-- Radius + Start offset (full-circle only) -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('radius')}</div>
            <input id="tc-radius" type="range" class="craftools-input"
                   min="30" max="95" step="1" value="${state.radius}"
                   style="width:100%;accent-color:var(--accent);">
            <div style="font-size:10px;text-align:right;color:var(--text-muted);">${state.radius}</div>
        </div>
        <div id="tc-offset-wrap" style="${state.mode !== 'full-circle' ? 'opacity:.4;pointer-events:none;' : ''}">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('startOffset')}</div>
            <input id="tc-offset" type="range" class="craftools-input"
                   min="0" max="100" step="1" value="${state.startOffset}"
                   style="width:100%;accent-color:var(--accent);">
            <div style="font-size:10px;text-align:right;color:var(--text-muted);">${state.startOffset}%</div>
        </div>
    </div>

    <!-- Font -->
    <div>
        <div class="ct-sublabel">
            <span class="material-symbols-outlined">font_download</span>${t('fontFamily')}
        </div>
        <select id="tc-font" class="craftools-select">${fontOptions}</select>
    </div>

    <!-- Size + Letter-spacing -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('fontSize')}</div>
            <input id="tc-size" type="number" class="craftools-input" min="6" max="60" value="${state.fontSize}">
        </div>
        <div>
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('letterSpacing')}</div>
            <input id="tc-spacing" type="number" class="craftools-input" min="-5" max="20" step="0.5" value="${state.letterSpacing}">
        </div>
    </div>

    <!-- Bold / Italic -->
    <div style="display:flex;gap:6px;">
        <button id="tc-bold" style="
            flex:1;padding:6px;border-radius:8px;cursor:pointer;
            border:2px solid ${state.bold ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)'};
            background:${state.bold ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)'};
            font-weight:700;font-size:12px;color:var(--text);font-family:inherit;
        ">B</button>
        <button id="tc-italic" style="
            flex:1;padding:6px;border-radius:8px;cursor:pointer;
            border:2px solid ${state.italic ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)'};
            background:${state.italic ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)'};
            font-style:italic;font-size:12px;color:var(--text);font-family:inherit;
        ">I</button>
    </div>

    <!-- Color / Gradient -->
    <div>
        <div class="ct-sublabel">
            <span class="material-symbols-outlined">palette</span>${t('color')}
        </div>

        <!-- Mode toggle: solid | gradient -->
        <div style="display:flex;gap:5px;margin-bottom:8px;">
            <button id="tc-mode-solid" style="
                flex:1;padding:5px 8px;border-radius:8px;cursor:pointer;font-size:11px;
                border:2px solid ${!state.useGradient ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)'};
                background:${!state.useGradient ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)'};
                color:var(--text);font-family:inherit;font-weight:600;
            ">${t('solidColor')}</button>
            <button id="tc-mode-grad" style="
                flex:1;padding:5px 8px;border-radius:8px;cursor:pointer;font-size:11px;
                border:2px solid ${state.useGradient ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)'};
                background:${state.useGradient ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)'};
                color:var(--text);font-family:inherit;font-weight:600;
            ">${t('gradient')}</button>
        </div>

        <!-- Solid color row -->
        <div id="tc-solid-row" style="${state.useGradient ? 'display:none;' : ''}">
            <input id="tc-color" type="color" class="craftools-input"
                   value="${state.color}" style="height:34px;padding:2px 4px;cursor:pointer;width:100%;">
        </div>

        <!-- Gradient rows -->
        <div id="tc-grad-rows" style="${!state.useGradient ? 'display:none;' : ''}">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                <div>
                    <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('gradientFrom')}</div>
                    <input id="tc-grad-from" type="color" class="craftools-input"
                           value="${state.gradFrom}" style="height:34px;padding:2px 4px;cursor:pointer;width:100%;">
                </div>
                <div>
                    <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('gradientTo')}</div>
                    <input id="tc-grad-to" type="color" class="craftools-input"
                           value="${state.gradTo}" style="height:34px;padding:2px 4px;cursor:pointer;width:100%;">
                </div>
            </div>
            <div>
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('gradientAngle')} — ${state.gradAngle}°</div>
                <input id="tc-grad-angle" type="range" class="craftools-input"
                       min="0" max="360" step="5" value="${state.gradAngle}"
                       style="width:100%;accent-color:var(--accent);">
            </div>
        </div>
    </div>

</div>`;

        // ── Event binding ──────────────────────────────────────────────────
        const up = () => TextoCurvoTool.updateElement(el, { ...el._ctState });

        const bind = (id, prop, parse = (v) => v) => {
            const inp = panelBody.querySelector(`#${id}`);
            if (!inp) return;
            const evt = inp.type === 'range' || inp.type === 'color' ? 'input' : 'change';
            inp.addEventListener(evt, () => {
                el._ctState[prop] = parse(inp.value);
                up();
                // Update live display for range sliders
                const badge = inp.nextElementSibling;
                if (badge && inp.type === 'range') {
                    badge.textContent = prop === 'startOffset' ? `${inp.value}%` : inp.value;
                }
            });
        };

        bind('tc-text',    'text');
        bind('tc-radius',  'radius',        Number);
        bind('tc-offset',  'startOffset',   Number);
        bind('tc-font',    'fontFamily');
        bind('tc-size',    'fontSize',      Number);
        bind('tc-spacing', 'letterSpacing', Number);
        bind('tc-color',   'color');
        bind('tc-grad-from',  'gradFrom');
        bind('tc-grad-to',    'gradTo');
        bind('tc-grad-angle', 'gradAngle',  Number);

        // Text input: update on every keystroke
        panelBody.querySelector('#tc-text')?.addEventListener('input', (e) => {
            el._ctState.text = e.target.value;
            up();
        });

        // Mode buttons (arc-top / arc-bottom / full-circle)
        panelBody.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                el._ctState.mode = btn.dataset.mode;
                const wrap = panelBody.querySelector('#tc-offset-wrap');
                if (wrap) {
                    const isCircle = el._ctState.mode === 'full-circle';
                    wrap.style.opacity        = isCircle ? '1' : '.4';
                    wrap.style.pointerEvents  = isCircle ? 'auto' : 'none';
                }
                panelBody.querySelectorAll('[data-mode]').forEach(b => {
                    const active = b.dataset.mode === el._ctState.mode;
                    b.style.borderColor = active ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)';
                    b.style.background  = active ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)';
                });
                up();
            });
        });

        // Bold / Italic toggles
        panelBody.querySelector('#tc-bold')?.addEventListener('click', () => {
            el._ctState.bold = !el._ctState.bold;
            const btn = panelBody.querySelector('#tc-bold');
            btn.style.borderColor = el._ctState.bold ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)';
            btn.style.background  = el._ctState.bold ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)';
            up();
        });
        panelBody.querySelector('#tc-italic')?.addEventListener('click', () => {
            el._ctState.italic = !el._ctState.italic;
            const btn = panelBody.querySelector('#tc-italic');
            btn.style.borderColor = el._ctState.italic ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)';
            btn.style.background  = el._ctState.italic ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)';
            up();
        });

        // Solid vs gradient toggle
        const showSolid = (solid) => {
            el._ctState.useGradient = !solid;
            panelBody.querySelector('#tc-solid-row').style.display = solid ? '' : 'none';
            panelBody.querySelector('#tc-grad-rows').style.display  = solid ? 'none' : '';
            ['tc-mode-solid', 'tc-mode-grad'].forEach((id, i) => {
                const active = solid ? i === 0 : i === 1;
                const b = panelBody.querySelector(`#${id}`);
                if (!b) return;
                b.style.borderColor = active ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)';
                b.style.background  = active ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)';
            });
            up();
        };
        panelBody.querySelector('#tc-mode-solid')?.addEventListener('click', () => showSolid(true));
        panelBody.querySelector('#tc-mode-grad')?.addEventListener('click', () => showSolid(false));
    }
}
