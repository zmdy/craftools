import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { CalendarRenderer } from "../../utils/CalendarRenderer.js";
import { CalendarTool } from "../calendar/CalendarTool.js";
import "./MiniCalendarTool_Translations.js";

const m = (key) => I18n.t('miniCalendarTool.' + key);

const MONTH_NAMES_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ── Modos de exibição ────────────────────────────────────────────────────
// Cada modo escolhe quais partes do card (CalendarRenderer.buildCardHtml)
// são montadas -- da tabela de dias isolada até o calendário completo com
// fases da lua. Mesma engine usada pela ferramenta "Calendário" (geração
// de páginas inteiras), só que aqui monta 1 elemento arrastável só.
const DISPLAY_MODES = [
    { id: 'diasSemana',  labelKey: 'modeDiasSemana',  parts: { header: false, week: true,  days: true,  holidaysBox: false, moonBox: false } },
    { id: 'calendario',  labelKey: 'modeCalendario',  parts: { header: true,  week: true,  days: true,  holidaysBox: false, moonBox: false } },
    { id: 'header',      labelKey: 'modeHeader',      parts: { header: true,  week: false, days: false, holidaysBox: false, moonBox: false } },
    { id: 'holidaysBox', labelKey: 'modeHolidaysBox', parts: { header: false, week: false, days: false, holidaysBox: true,  moonBox: false } },
    { id: 'moonBox',     labelKey: 'modeMoonBox',     parts: { header: false, week: false, days: false, holidaysBox: false, moonBox: true  } },
    { id: 'completo1',   labelKey: 'modeCompleto1',   parts: { header: true,  week: true,  days: true,  holidaysBox: true,  moonBox: false } },
    { id: 'completo2',   labelKey: 'modeCompleto2',   parts: { header: true,  week: true,  days: true,  holidaysBox: true,  moonBox: true  } },
];

/**
 * MiniCalendarTool
 *
 * Ferramenta "Mini Calendário" — ao contrário de CalendarTool.js (que assume
 * o painel inteiro e gera páginas cheias de folhas), esta é um elemento
 * arrastável comum (como QRCode/Barcode): 1 mês só, num card que o usuário
 * posiciona/redimensiona livremente na página. Reaproveita CalendarRenderer
 * (mesmo motor visual) e os controles de estilo granular de CalendarTool.js
 * (_renderPartRow/_fontOptions), mantendo a mesma aparência entre as duas
 * ferramentas.
 */
export class MiniCalendarTool extends BaseTool {

    static getDefaultMeta() {
        const now = new Date();
        return {
            displayMode: 'completo1',
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            theme: CalendarRenderer.defaultTheme(),
        };
    }

    static _currentMode(meta) {
        return DISPLAY_MODES.find(d => d.id === meta.displayMode) || DISPLAY_MODES[5];
    }

    static _renderCard(element) {
        const meta = element._craftoolsMeta;
        if (!meta || !element.contentArea) return;

        const mode = this._currentMode(meta);
        const card = CalendarRenderer.buildCardElement(meta.year, meta.month, {
            theme: meta.theme,
            parts: mode.parts,
        });
        card.style.userSelect = 'none';

        element.contentArea.innerHTML = '';
        element.contentArea.appendChild(card);

        this._triggerChange(element);
    }

    static _triggerChange(element) {
        element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
    }

    static getCtxOptions() {
        return [];
    }

    static createElement(type, editorApp) {
        const el = document.createElement('craftools-element');
        el.setAttribute('x', '50');
        el.setAttribute('y', '50');
        el.setAttribute('w', '190');
        el.setAttribute('h', '210');
        el.setAttribute('data-craftool', 'minicalendario');

        el._craftoolsMeta = this.getDefaultMeta();
        this._renderCard(el);

        return el;
    }

    static renderPropertiesPanel(editorPanel, element) {
        const meta = element._craftoolsMeta || this.getDefaultMeta();
        if (!element._craftoolsMeta) element._craftoolsMeta = meta;

        if (element.contentArea) {
            element.contentArea.style.pointerEvents = 'auto';
            element.contentArea.style.cursor = 'move';
        }

        const modeButtonsHtml = DISPLAY_MODES.map(d => `
            <button type="button" class="minical-mode-btn craftools-pill ${meta.displayMode === d.id ? 'active' : ''}" data-mode="${d.id}"
                style="width:100%; text-align:left; padding:9px 10px;">
                <span style="font-size:11px; font-weight:600;">${m(d.labelKey)}</span>
            </button>
        `).join('');

        const monthOptionsHtml = MONTH_NAMES_PT.map((name, i) => `<option value="${i + 1}" ${meta.month === i + 1 ? 'selected' : ''}>${name}</option>`).join('');

        const htmlConteudo = `
            <div class="ct-field" style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
                <span class="craftools-label" style="margin-bottom:2px;">${m('displayModeLabel')}</span>
                ${modeButtonsHtml}
            </div>
            <div class="ct-field">
                <span class="craftools-label">${m('monthYearLabel')}</span>
                <div style="display:grid; grid-template-columns:2fr 1fr; gap:8px;">
                    <select id="minical-month" class="craftools-select">${monthOptionsHtml}</select>
                    <input type="number" id="minical-year" class="craftools-input" value="${meta.year}" min="1900" max="2200">
                </div>
            </div>
        `;

        // Reaproveita os mesmos controles granulares de estilo do CalendarTool
        // (_renderPartRow), já que ambas as ferramentas usam CalendarRenderer.
        const t = meta.theme;
        const htmlEstilo = [
            CalendarTool._renderPartRow('titleBar', I18n.t('calendarTool.styleTitleBar'), t.titleBar, { showBg: true }),
            CalendarTool._renderPartRow('weekHeader', I18n.t('calendarTool.styleWeekHeader'), t.weekHeader, { showBg: true }),
            CalendarTool._renderPartRow('dayNumbers', I18n.t('calendarTool.styleDayNumbers'), t.dayNumbers, {
                secondColorField: 'sundayColor', secondColorLabel: I18n.t('calendarTool.fieldSundayColor'),
                numberField: 'rowGap', numberFieldLabel: I18n.t('calendarTool.fieldRowGap'), numberFieldMin: 0, numberFieldMax: 8, numberFieldStep: 0.5,
            }),
            CalendarTool._renderPartRow('holidays', I18n.t('calendarTool.styleHolidays'), t.holidays, {}),
            CalendarTool._renderPartRow('moonPhases', I18n.t('calendarTool.styleMoonPhases'), t.moonPhases, {}),
            CalendarTool._renderBorderRow(t),
        ].join('');

        editorPanel.innerHTML =
            PanelUI.accordion('minical-conteudo', 'calendar_month', m('content'), htmlConteudo, { open: true }) +
            PanelUI.accordion('minical-estilo', 'palette', I18n.t('calendarTool.tabStyle'), htmlEstilo);

        // Só Tamanho/Posição/Z-Index -- borda/raio/padding/margem ficam de
        // fora de propósito (o card já tem seu próprio controle de borda via
        // "styleCellBorder" acima, evitando dois controles disputando o
        // mesmo estilo inline).
        this.renderCommonProperties(editorPanel, element, { zindex: true });

        // --- Bindings ---
        editorPanel.querySelectorAll('.minical-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                meta.displayMode = btn.dataset.mode;
                this.renderPropertiesPanel(editorPanel, element);
                this._renderCard(element);
            });
        });

        const monthSel = editorPanel.querySelector('#minical-month');
        if (monthSel) monthSel.addEventListener('change', () => {
            meta.month = parseInt(monthSel.value, 10);
            this._renderCard(element);
        });

        const yearInput = editorPanel.querySelector('#minical-year');
        if (yearInput) yearInput.addEventListener('input', () => {
            meta.year = parseInt(yearInput.value, 10) || meta.year;
            this._renderCard(element);
        });

        editorPanel.querySelectorAll('[data-part][data-field]').forEach(input => {
            const evt = (input.tagName === 'SELECT' || input.type === 'color' || input.type === 'number') ? 'input' : 'change';
            input.addEventListener(evt, () => {
                const part = input.dataset.part;
                const field = input.dataset.field;
                const value = input.type === 'number' ? (parseFloat(input.value) || 0) : input.value;
                if (part === 'cellBorder') {
                    meta.theme.cellBorder[field] = value;
                } else if (part === 'cell') {
                    meta.theme.cellBg = value;
                } else if (meta.theme[part]) {
                    meta.theme[part][field] = value;
                }
                this._renderCard(element);
            });
        });
    }
}
