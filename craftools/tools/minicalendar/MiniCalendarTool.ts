import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import type { PropertySchema } from '../../types/PropertySchema';

const getMeta = (el: HTMLElement) =>
  (el as HTMLElement & { _craftoolsMeta?: Record<string, unknown> })._craftoolsMeta ?? {};

const DISPLAY_MODES = [
  { value: 'completo1', label: 'Full (style 1)' },
  { value: 'completo2', label: 'Full (style 2)' },
  { value: 'mes',       label: 'Month only' },
  { value: 'semana',    label: 'Week grid' },
  { value: 'mini',      label: 'Mini' },
  { value: 'lista',     label: 'List' },
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
