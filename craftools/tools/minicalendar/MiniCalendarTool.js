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

const DISPLAY_MODES = [
    { id: 'diasSemana',  labelKey: 'modeDiasSemana',  parts: { header: false, week: true,  days: true,  holidaysBox: false, moonBox: false } },
    { id: 'calendario',  labelKey: 'modeCalendario',  parts: { header: true,  week: true,  days: true,  holidaysBox: false, moonBox: false } },
    { id: 'header',      labelKey: 'modeHeader',      parts: { header: true,  week: false, days: false, holidaysBox: false, moonBox: false } },
    { id: 'holidaysBox', labelKey: 'modeHolidaysBox', parts: { header: false, week: false, days: false, holidaysBox: true,  moonBox: false } },
    { id: 'moonBox',     labelKey: 'modeMoonBox',     parts: { header: false, week: false, days: false, holidaysBox: false, moonBox: true  } },
    { id: 'completo1',   labelKey: 'modeCompleto1',   parts: { header: true,  week: true,  days: true,  holidaysBox: true,  moonBox: false } },
    { id: 'completo2',   labelKey: 'modeCompleto2',   parts: { header: true,  week: true,  days: true,  holidaysBox: true,  moonBox: true  } },
];

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

    static _buildCard(meta) {
        const mode = this._currentMode(meta);
        const card = CalendarRenderer.buildCardElement(meta.year, meta.month, {
            theme: meta.theme,
            parts: mode.parts,
        });
        card.style.userSelect = 'none';
        return card;
    }

    static _renderCard(element) {
        const meta = element._craftoolsMeta;
        if (!meta || !element.contentArea) return;

        element.contentArea.innerHTML = '';
        element.contentArea.appendChild(this._buildCard(meta));

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
        el.appendChild(this._buildCard(el._craftoolsMeta));

        return el;
    }

    // Legacy renderPropertiesPanel deleted.
    // Panel rendering is now schema-driven in MiniCalendarTool.ts via PropertyRenderer.
}
