import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import { CalendarRenderer, type CalendarTheme } from '../../utils/CalendarRenderer';
import type { PropertySchema } from '../../types/PropertySchema';
// Registers the 'miniCalendarTool.*' i18n keys used by DISPLAY_MODES' per-
// option i18nKey below (falls back to the literal English labels without
// it, via utils/i18nLabel.ts's tr() -- see QRCodeTool.ts for the pattern).
import './MiniCalendarTool_Translations.js';

interface MiniCalendarMeta {
  displayMode: string;
  year:        number;
  month:       number;
  theme:       CalendarTheme;
}

const getMeta = (el: HTMLElement): Partial<MiniCalendarMeta> =>
  (el as HTMLElement & { _craftoolsMeta?: MiniCalendarMeta })._craftoolsMeta ?? {};

// Must match MiniCalendarTool.js's real DISPLAY_MODES exactly (id + order) --
// CalendarRenderer only knows how to render these 7 modes. The previous list
// here ('mes'/'semana'/'mini'/'lista') didn't correspond to anything the
// renderer implements (picking them silently fell back to 'completo1'), and
// 5 real modes (diasSemana/calendario/header/holidaysBox/moonBox) were
// missing entirely.
// SelectField.options now supports an optional per-option i18nKey (see
// types/PropertySchema.ts) -- these already exist in
// MiniCalendarTool_Translations.ts (used by the legacy panel/VariablePanel's
// miniCalendar config), just weren't wired up here yet.
const DISPLAY_MODES = [
  { value: 'diasSemana',  label: 'Days table only (with holidays marked)', i18nKey: 'miniCalendarTool.modeDiasSemana' },
  { value: 'calendario',  label: 'Calendar (header + days table)',         i18nKey: 'miniCalendarTool.modeCalendario' },
  { value: 'header',      label: 'Header only (month and year)',          i18nKey: 'miniCalendarTool.modeHeader' },
  { value: 'holidaysBox', label: 'Holidays box only',                     i18nKey: 'miniCalendarTool.modeHolidaysBox' },
  { value: 'moonBox',     label: 'Moon phases box only',                  i18nKey: 'miniCalendarTool.modeMoonBox' },
  { value: 'completo1',   label: 'Calendar with holidays',                i18nKey: 'miniCalendarTool.modeCompleto1' },
  { value: 'completo2',   label: 'Full calendar with moon phases',        i18nKey: 'miniCalendarTool.modeCompleto2' },
];

// id -> CalendarRenderer's `parts` flags for that display mode.
const DISPLAY_MODE_PARTS: Record<string, { header: boolean; week: boolean; days: boolean; holidaysBox: boolean; moonBox: boolean }> = {
  diasSemana:  { header: false, week: true,  days: true,  holidaysBox: false, moonBox: false },
  calendario:  { header: true,  week: true,  days: true,  holidaysBox: false, moonBox: false },
  header:      { header: true,  week: false, days: false, holidaysBox: false, moonBox: false },
  holidaysBox: { header: false, week: false, days: false, holidaysBox: true,  moonBox: false },
  moonBox:     { header: false, week: false, days: false, holidaysBox: false, moonBox: true  },
  completo1:   { header: true,  week: true,  days: true,  holidaysBox: true,  moonBox: false },
  completo2:   { header: true,  week: true,  days: true,  holidaysBox: true,  moonBox: true  },
};

const now = new Date();

export class MiniCalendarTool extends BaseTool {

  /**
   * Default meta for a freshly-created mini-calendar element. Recovered
   * from the pre-migration MiniCalendarTool.js (deleted by the "Purge
   * legacy JS" commit) -- theme uses CalendarRenderer's real (nested)
   * CalendarTheme shape, same as the original.
   */
  public static getDefaultMeta(): MiniCalendarMeta {
    return {
      displayMode: 'completo1',
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      theme: CalendarRenderer.defaultTheme(),
    };
  }

  private static _currentParts(displayMode: string) {
    return DISPLAY_MODE_PARTS[displayMode] ?? DISPLAY_MODE_PARTS.completo1;
  }

  private static _buildCard(meta: MiniCalendarMeta): HTMLElement {
    const card = CalendarRenderer.buildCardElement(meta.year, meta.month, {
      theme: meta.theme,
      parts: MiniCalendarTool._currentParts(meta.displayMode),
    });
    card.style.userSelect = 'none';
    return card;
  }

  /**
   * Rebuilds the card from the element's current _craftoolsMeta. Called
   * directly after every property edit (desktop schema panel's
   * _applyProperty() below) -- previously this only dispatched a
   * 'craftools-minicalendar-regenerate' custom event that nothing listened
   * for, so edits from the desktop panel never actually rebuilt the card.
   */
  public static _regenerate(element: HTMLElement): void {
    const e = element as HTMLElement & { _craftoolsMeta?: MiniCalendarMeta };
    const meta = e._craftoolsMeta;
    if (!meta) return;
    element.innerHTML = '';
    element.appendChild(MiniCalendarTool._buildCard(meta));
    MiniCalendarTool._triggerChange(element);
  }

  private static _triggerChange(element: HTMLElement): void {
    element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
  }

  /**
   * Builds a fresh `<craftools-element data-craftool="minicalendario">`
   * with a real calendar card inside. Recovered from the pre-migration
   * MiniCalendarTool.js (deleted by the "Purge legacy JS" commit without
   * this logic being ported) -- the previous file had no createElement()
   * at all, throwing "createElement is not a function" for every
   * mini-calendar element creation.
   */
  public static createElement(_type: string, _editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as HTMLElement & { _craftoolsMeta?: MiniCalendarMeta };
    el.setAttribute('x', '50');
    el.setAttribute('y', '50');
    el.setAttribute('w', '190');
    el.setAttribute('h', '210');
    el.setAttribute('data-craftool', 'minicalendario');

    el._craftoolsMeta = MiniCalendarTool.getDefaultMeta();
    el.appendChild(MiniCalendarTool._buildCard(el._craftoolsMeta));

    return el;
  }

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};
    if (!('displayMode' in existing)) patch.displayMode = meta.displayMode ?? 'completo1';
    if (!('year'        in existing)) patch.year        = meta.year  ?? now.getFullYear();
    if (!('month'       in existing)) patch.month       = meta.month ?? (now.getMonth() + 1);
    // NOTE: these flattened theme.* colors don't map onto CalendarTheme's
    // real (nested titleBar/weekHeader/dayNumbers/...) shape used by
    // CalendarRenderer -- the Theme panel below is schema-driven UI that
    // predates this crash fix and isn't wired into the actual renderer yet.
    // Left as-is (pre-existing gap, not part of the createElement crash).
    const theme = (meta.theme as unknown as Record<string, unknown>) ?? {};
    if (!('themeHeaderBg'   in existing)) patch.themeHeaderBg   = theme.headerBg   ?? '#f97316';
    if (!('themeHeaderText' in existing)) patch.themeHeaderText = theme.headerText  ?? '#ffffff';
    if (!('themeDayBg'      in existing)) patch.themeDayBg      = theme.dayBg       ?? '#ffffff';
    if (!('themeDayText'    in existing)) patch.themeDayText    = theme.dayText      ?? '#1a1a1a';
    if (!('themeWeekendBg'  in existing)) patch.themeWeekendBg  = theme.weekendBg   ?? '#fff7ed';
    if (Object.keys(patch).length)
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Calendar',
        defaultOpen: true,
        fields: [
          { type: 'select', key: 'displayMode', label: 'Display', options: DISPLAY_MODES },
          { type: 'number', key: 'year',  label: 'Year',  min: 2000, max: 2100, step: 1 },
          { type: 'number', key: 'month', label: 'Month', min: 1,    max: 12,   step: 1 },
        ],
      },
      {
        section: 'Theme',
        fields: [
          { type: 'color', key: 'themeHeaderBg',   label: 'Header background' },
          { type: 'color', key: 'themeHeaderText',  label: 'Header text' },
          { type: 'color', key: 'themeDayBg',       label: 'Day background' },
          { type: 'color', key: 'themeDayText',      label: 'Day text' },
          { type: 'color', key: 'themeWeekendBg',   label: 'Weekend background' },
        ],
      },
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    const e = element as HTMLElement & { _craftoolsMeta?: MiniCalendarMeta };
    if (e._craftoolsMeta) {
      if (key === 'displayMode' || key === 'year' || key === 'month') {
        (e._craftoolsMeta as unknown as Record<string, unknown>)[key] = value;
      } else if (key.startsWith('theme')) {
        const theme = (e._craftoolsMeta.theme as unknown as Record<string, unknown>) ?? {};
        const themeKey = key.replace('theme', '').replace(/^./, c => c.toLowerCase());
        theme[themeKey] = value;
        (e._craftoolsMeta as unknown as Record<string, unknown>).theme = theme;
      } else if (key === 'zIndex') {
        element.style.zIndex = String(value);
      }
    }
    // Calls _regenerate() directly (previously dispatched an unlistened
    // 'craftools-minicalendar-regenerate' custom event, so panel edits
    // never actually rebuilt the rendered card).
    MiniCalendarTool._regenerate(element);
  }
}

MiniCalendarTool.registeredKeys = ['minicalendario'];
ToolRegistry.register({ key: 'minicalendario', label: 'editor.miniCalendar', icon: 'calendar_month', tool: MiniCalendarTool, draggable: true, showInFooterNav: false, category: 'elements' });
