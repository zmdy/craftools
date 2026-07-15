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

    // ── Properties panel ────────────────────────────────────────────────────

    static renderPropertiesPanel(panelBody, el, _editor) {
        if (!el._ctState && el.dataset.ctState) {
            el._ctState = JSON.parse(el.dataset.ctState);
        }
        const state = el._ctState || DEFAULT_STATE();
        el._ctState = state;

        const fonts = (window.craftoolsApp?.fonts || [
            'Arial','Georgia','Verdana','Courier New','Times New Roman',
            'Trebuchet MS','Impact',
        ]);
        const fontOptions = fonts.map(f =>
            `<option value="${f}" ${state.fontFamily === f ? 'selected' : ''}
                style="font-family:'${f}',sans-serif;">${f}</option>`
        ).join('');

        const sepOptions = [
            ['none',    t('sepNone')   ],
            ['star',    t('sepStar')   ],
            ['dot',     t('sepDot')    ],
            ['diamond', t('sepDiamond')],
        ].map(([v, l]) => `<option value="${v}" ${state.separator === v ? 'selected' : ''}>${l}</option>`).join('');

        const sizeContent = `
            <div style="padding:4px 10px 10px;">
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('outerRadius')}</div>
                <input id="cb-radius" type="range" class="craftools-input"
                       min="45" max="93" step="1" value="${state.outerRadius}"
                       style="width:100%;accent-color:var(--accent);">
                <div id="cb-radius-val" style="font-size:10px;text-align:right;color:var(--text-muted);">${state.outerRadius}</div>
            </div>`;

        const outerContent = `
            <div style="padding:4px 10px 10px;display:flex;flex-direction:column;gap:8px;">
                <input id="cb-outer-text" type="text" class="craftools-input"
                       value="${escXml(state.outerText)}" placeholder="${t('outerText')}">
                <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;">
                    <input id="cb-outer-size" type="number" class="craftools-input"
                           min="6" max="20" value="${state.outerFontSize}">
                    <label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;">
                        <input id="cb-outer-bold" type="checkbox" ${state.outerBold ? 'checked' : ''}
                               style="accent-color:var(--accent);"> <b>B</b>
                    </label>
                </div>
            </div>`;

        const innerContent = `
            <div style="padding:4px 10px 10px;display:flex;flex-direction:column;gap:8px;">
                <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;">
                    <input id="cb-show-inner" type="checkbox" ${state.showInnerText ? 'checked' : ''}
                           style="accent-color:var(--accent);">
                    ${t('showInnerText')}
                </label>
                <div id="cb-inner-fields" style="${!state.showInnerText ? 'opacity:.4;pointer-events:none;' : ''}">
                    <input id="cb-inner-text" type="text" class="craftools-input"
                           value="${escXml(state.innerText)}" placeholder="${t('innerText')}">
                    <div style="margin-top:6px;">
                        <input id="cb-inner-size" type="number" class="craftools-input"
                               min="6" max="18" value="${state.innerFontSize}">
                    </div>
                </div>
            </div>`;

        const centerContent = `
            <div style="padding:4px 10px 10px;display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;gap:5px;">
                    ${[['none', t('centerTypeNone')], ['text', t('centerTypeText')]].map(([v, l]) => `
                        <button data-center-type="${v}" style="
                            flex:1;padding:5px 8px;border-radius:8px;cursor:pointer;font-size:11px;
                            border:2px solid ${state.centerType === v ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)'};
                            background:${state.centerType === v ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)'};
                            color:var(--text);font-family:inherit;font-weight:600;
                        ">${l}</button>`).join('')}
                </div>
                <div id="cb-center-fields" style="${state.centerType === 'none' ? 'display:none;' : ''}">
                    <textarea id="cb-center-text" class="craftools-input"
                              rows="2" placeholder="${t('centerText')}"
                              style="resize:vertical;">${escXml(state.centerText)}</textarea>
                    <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-top:6px;">
                        <input id="cb-center-size" type="number" class="craftools-input"
                               min="6" max="32" value="${state.centerFontSize}">
                        <label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;">
                            <input id="cb-center-bold" type="checkbox" ${state.centerBold ? 'checked' : ''}
                                   style="accent-color:var(--accent);"> <b>B</b>
                        </label>
                    </div>
                </div>
            </div>`;

        const ringsContent = `
            <div style="padding:4px 10px 10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div>
                    <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('rings')}</div>
                    <select id="cb-rings" class="craftools-select">
                        ${[1,2,3].map(n => `<option value="${n}" ${state.rings === n ? 'selected' : ''}>${n}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('ringWidth')}</div>
                    <input id="cb-ring-w" type="number" class="craftools-input"
                           min="0.5" max="5" step="0.5" value="${state.ringWidth}">
                </div>
            </div>`;

        const sepContent = `
            <div style="padding:4px 10px 10px;">
                <select id="cb-sep" class="craftools-select">${sepOptions}</select>
            </div>`;

        const styleContent = `
            <div style="padding:4px 10px 10px;display:flex;flex-direction:column;gap:8px;">
                <div>
                    <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('fontFamily')}</div>
                    <select id="cb-font" class="craftools-select">${fontOptions}</select>
                </div>
                <div>
                    <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">${t('color')}</div>
                    <input id="cb-color" type="color" class="craftools-input"
                           value="${state.color}" style="height:34px;padding:2px 4px;cursor:pointer;width:100%;">
                </div>
            </div>`;

        panelBody.innerHTML = `<div style="padding:8px;">
            ${PanelUI.accordion('cb-size',   'straighten',   t('outerRadius'),      sizeContent,  { open: false })}
            ${PanelUI.accordion('cb-outer',  'text_fields',  t('sectionOuter'),     outerContent, { open: true  })}
            ${PanelUI.accordion('cb-inner',  'vertical_distribute', t('sectionInner'), innerContent, { open: true })}
            ${PanelUI.accordion('cb-center', 'center_focus_strong', t('sectionCenter'), centerContent, { open: true })}
            ${PanelUI.accordion('cb-rings',  'circle',       t('sectionRings'),     ringsContent, { open: false })}
            ${PanelUI.accordion('cb-sep',    'star',         t('sectionSeparator'), sepContent,   { open: false })}
            ${PanelUI.accordion('cb-style',  'palette',      t('sectionStyle'),     styleContent, { open: false })}
        </div>`;

        PanelUI.bindAccordions(panelBody);

        const up = () => CarimboTool.updateElement(el, { ...el._ctState });

        // Bind all inputs generically
        const bind = (id, prop, parse = v => v) => {
            const inp = panelBody.querySelector(`#${id}`);
            if (!inp) return;
            const evt = inp.type === 'color' || inp.type === 'range' || inp.tagName === 'SELECT'
                ? 'input' : (inp.tagName === 'TEXTAREA' ? 'input' : 'change');
            inp.addEventListener(evt, () => {
                el._ctState[prop] = parse(inp.value);
                up();
                if (id === 'cb-radius') {
                    const badge = panelBody.querySelector('#cb-radius-val');
                    if (badge) badge.textContent = inp.value;
                }
            });
        };

        bind('cb-outer-text', 'outerText');
        bind('cb-outer-size', 'outerFontSize', Number);
        bind('cb-inner-text', 'innerText');
        bind('cb-inner-size', 'innerFontSize', Number);
        bind('cb-center-text','centerText');
        bind('cb-center-size','centerFontSize', Number);
        bind('cb-radius',     'outerRadius',    Number);
        bind('cb-rings',      'rings',          Number);
        bind('cb-ring-w',     'ringWidth',      Number);
        bind('cb-sep',        'separator');
        bind('cb-font',       'fontFamily');
        bind('cb-color',      'color');

        // Checkbox bindings
        const bindCheck = (id, prop) => {
            const inp = panelBody.querySelector(`#${id}`);
            if (!inp) return;
            inp.addEventListener('change', () => {
                el._ctState[prop] = inp.checked;
                up();
            });
        };
        bindCheck('cb-outer-bold',  'outerBold');
        bindCheck('cb-center-bold', 'centerBold');

        // Show-inner toggle
        panelBody.querySelector('#cb-show-inner')?.addEventListener('change', (e) => {
            el._ctState.showInnerText = e.target.checked;
            const fields = panelBody.querySelector('#cb-inner-fields');
            if (fields) {
                fields.style.opacity       = e.target.checked ? '1' : '.4';
                fields.style.pointerEvents = e.target.checked ? 'auto' : 'none';
            }
            up();
        });

        // Center type buttons
        panelBody.querySelectorAll('[data-center-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                el._ctState.centerType = btn.dataset.centerType;
                const fields = panelBody.querySelector('#cb-center-fields');
                if (fields) fields.style.display = el._ctState.centerType === 'none' ? 'none' : '';
                panelBody.querySelectorAll('[data-center-type]').forEach(b => {
                    const active = b.dataset.centerType === el._ctState.centerType;
                    b.style.borderColor = active ? 'var(--accent,#f97316)' : 'var(--border,#e4e4e7)';
                    b.style.background  = active ? 'rgba(249,115,22,.07)' : 'var(--bg-input,#f4f4f5)';
                });
                up();
            });
        });
    }
}
