import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import type { PropertySchema } from '../../types/PropertySchema';

const getMeta = (el: HTMLElement) =>
  (el as HTMLElement & { _craftoolsMeta?: Record<string, unknown> })._craftoolsMeta ?? {};

// Must match MiniCalendarTool.js's real DISPLAY_MODES exactly (id + order) --
// CalendarRenderer only knows how to render these 7 modes. The previous list
// here ('mes'/'semana'/'mini'/'lista') didn't correspond to anything the
// renderer implements (picking them silently fell back to 'completo1'), and
// 5 real modes (diasSemana/calendario/header/holidaysBox/moonBox) were
// missing entirely.
// SelectField.options now supports an optional per-option i18nKey (see
// types/PropertySchema.ts) -- these already exist in
// MiniCalendarTool_Translations.js (used by the legacy panel/VariablePanel's
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

const now = new Date();

export class MiniCalendarTool extends BaseTool {

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};
    if (!('displayMode' in existing)) patch.displayMode = meta.displayMode ?? 'completo1';
    if (!('year'        in existing)) patch.year        = meta.year  ?? now.getFullYear();
    if (!('month'       in existing)) patch.month       = meta.month ?? (now.getMonth() + 1);
    // Flatten theme colors
    const theme = (meta.theme as Record<string, unknown>) ?? {};
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
    const e = element as HTMLElement & { _craftoolsMeta?: Record<string, unknown> };
    if (e._craftoolsMeta) {
      if (key.startsWith('theme')) {
        const theme = (e._craftoolsMeta.theme as Record<string, unknown>) ?? {};
        const themeKey = key.replace('theme', '').replace(/^./, c => c.toLowerCase());
        theme[themeKey] = value;
        e._craftoolsMeta.theme = theme;
      } else {
        e._craftoolsMeta[key] = value;
      }
    }
    element.dispatchEvent(new CustomEvent('craftools-minicalendar-regenerate', { bubbles: false }));
  }
}

MiniCalendarTool.registeredKeys = ['minicalendario'];
ToolRegistry.register({ key: 'minicalendario', label: 'editor.miniCalendar', icon: 'calendar_month', tool: MiniCalendarTool, draggable: true, showInFooterNav: false, category: 'elements' });
