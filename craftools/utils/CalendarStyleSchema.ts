/**
 * CalendarStyleSchema.ts — canonical PropertySchema sections for styling a
 * rendered calendar card (utils/CalendarRenderer.ts's CalendarTheme).
 *
 * THREE separate UI surfaces need to expose the exact same set of style
 * controls over the exact same CalendarTheme shape: CalendarTool.ts (the
 * "Calendário" page-generator's Estilo tabs), MiniCalendarTool.ts (the
 * "Mini Calendário" element's own properties panel), and VariablePanel.ts's
 * inline `miniCalendar` variable-content config. Rather than tripling every
 * field definition, this file is the SINGLE source of truth for the field
 * types/labels/i18n keys/options; each of the three consumers renders these
 * sections through `PropertyRenderer.render()` against its own
 * synthetic-element adapter (same detached-`<div>` + `dataset.ctState`
 * pattern already established by SettingsTool.ts / AlbumWizard.ts's border
 * section) and supplies its own translation layer between this schema's flat
 * canonical keys (below) and whatever shape it actually persists to
 * (CalendarTool's `state.theme`, MiniCalendarTool's `_craftoolsMeta.theme`,
 * VariablePanel's flat `miniCalendarTheme*` VariableBinding fields).
 *
 * Every field here uses the same global field components the rest of the
 * app's element panels use (font-select/slider/align for typography,
 * color-picker for solid-or-gradient backgrounds, plain `color` for
 * text/border colors, `toggle` for booleans) -- mirroring TextTool.ts's
 * Typography section, per the "use the same components as text/paragraph
 * tools" requirement this file exists to satisfy.
 *
 * Radius controls are 4 independent `number` fields (TL/TR/BR/BL) rather
 * than a single uniform slider -- CSS `border-radius` shorthand order is
 * TL TR BR BL (see CalendarRenderer.ts's RadiusCorners doc comment), which
 * `radiusFields()` below mirrors exactly so a consumer can spread the 4
 * reported values straight into a `RadiusCorners` object with zero
 * reordering.
 */

import type { Section, Field } from '../types/PropertySchema';
import { I18n } from '../settings/Translations.js';
import './CalendarStyleSchema_Translations.js';

const s = (key: string): string => I18n.t('calendarStyle.' + key);

const BORDER_STYLE_OPTIONS = [
  { value: 'solid',  label: 'Solid',  i18nKey: 'common.borderSolid' },
  { value: 'dashed', label: 'Dashed', i18nKey: 'common.borderDashed' },
  { value: 'dotted', label: 'Dotted', i18nKey: 'common.borderDotted' },
  { value: 'double', label: 'Double', i18nKey: 'common.borderDouble' },
  { value: 'none',   label: 'None',   i18nKey: 'common.borderNone' },
];

/** Typography trio (font-select + size slider + align pills) -- mirrors TextTool.ts's Typography section exactly. */
function fontFields(prefix: string): Field[] {
  return [
    { type: 'font-select', key: `${prefix}Font`,     label: s('font'),     i18nKey: 'calendarStyle.font' },
    { type: 'slider',      key: `${prefix}FontSize`, label: s('fontSize'), i18nKey: 'calendarStyle.fontSize', min: 2, max: 30, step: 0.5 },
    { type: 'align',       key: `${prefix}Align` },
  ];
}

/** Border trio (width/style/color) -- same shape as CommonSchema.ts's borderSection(), independently keyed per region. */
function borderFields(prefix: string): Field[] {
  return [
    { type: 'number', key: `${prefix}BorderWidth`, label: s('borderWidth'), i18nKey: 'calendarStyle.borderWidth', min: 0, max: 50, unit: 'px' },
    { type: 'select', key: `${prefix}BorderStyle`, label: s('borderStyle'), i18nKey: 'calendarStyle.borderStyle', options: BORDER_STYLE_OPTIONS },
    { type: 'color',  key: `${prefix}BorderColor`, label: s('borderColor'), i18nKey: 'calendarStyle.borderColor' },
  ];
}

/** 4-corner radius via standardized quad-number 2x2 field with link toggle. */
function radiusFields(prefix: string): Field[] {
  const keys: [string, string, string, string] = [
    `${prefix}RadiusTL`,
    `${prefix}RadiusTR`,
    `${prefix}RadiusBR`,
    `${prefix}RadiusBL`,
  ];
  return [
    {
      type: 'quad-number',
      key: `${prefix}RadiusTL`,
      keys,
      watchKeys: keys,
      label: s('radius'),
      i18nKey: 'calendarStyle.radius',
      labels: ['Topo', 'Direita', 'Base', 'Esquerda'],
      i18nKeys: ['common.top', 'common.right', 'common.bottom', 'common.left'],
      min: 0,
      max: 300,
      unit: 'px',
    },
  ];
}

/** "Estilo do Cartão" -- the outer card container's background/border/radius + section spacing. */
export function cardStyleSection(): Section {
  return {
    section: s('sectionCard'),
    i18nKey: 'calendarStyle.sectionCard',
    icon: 'crop_din',
    fields: [
      { type: 'color-picker', key: 'cardBg', label: s('background'), i18nKey: 'calendarStyle.background', defaultSolid: '#ffffff' },
      ...borderFields('card'),
      ...radiusFields('card'),
      { type: 'divider', key: 'card-spacing-divider', label: s('sectionGap'), i18nKey: 'calendarStyle.sectionGap', icon: 'height' },
      { type: 'number', key: 'sectionGap', label: s('sectionGap'), i18nKey: 'calendarStyle.sectionGap', min: 0, max: 60, unit: 'px' },
    ],
  };
}

/** "Barra do Mês" -- title bar typography/colors/background/radius + the month/year split toggle. */
export function monthBarSection(): Section {
  return {
    section: s('sectionMonthBar'),
    i18nKey: 'calendarStyle.sectionMonthBar',
    icon: 'calendar_view_week',
    fields: [
      ...fontFields('monthBar'),
      { type: 'color', key: 'monthBarTextColor', label: s('textColor'), i18nKey: 'calendarStyle.textColor' },
      { type: 'color-picker', key: 'monthBarBg', label: s('background'), i18nKey: 'calendarStyle.background', defaultSolid: '#e11d2e' },
      { type: 'divider', key: 'monthBar-split-divider', label: s('splitMonthYear'), i18nKey: 'calendarStyle.splitMonthYear', icon: 'swap_horiz' },
      { type: 'toggle', key: 'monthBarSplitMonthYear', label: s('splitMonthYear'), i18nKey: 'calendarStyle.splitMonthYear' },
      ...radiusFields('monthBar'),
    ],
  };
}

/** "Cabeçalho dos Dias" -- weekday-letters row typography/colors/background/border/radius + per-letter circle shape. */
export function dayHeaderSection(): Section {
  return {
    section: s('sectionDayHeader'),
    i18nKey: 'calendarStyle.sectionDayHeader',
    icon: 'view_week',
    fields: [
      ...fontFields('dayHeader'),
      { type: 'color', key: 'dayHeaderTextColor', label: s('textColor'), i18nKey: 'calendarStyle.textColor' },
      { type: 'color-picker', key: 'dayHeaderBg', label: s('background'), i18nKey: 'calendarStyle.background', defaultSolid: '#1a1a1a' },
      { type: 'divider', key: 'dayHeader-border-divider', label: s('dividerBorder'), i18nKey: 'calendarStyle.dividerBorder', icon: 'border_vertical' },
      ...borderFields('dayHeader'),
      ...radiusFields('dayHeader'),
      { type: 'divider', key: 'dayHeader-letter-divider', label: s('letterShape'), i18nKey: 'calendarStyle.letterShape', icon: 'circle' },
      { type: 'toggle', key: 'dayHeaderLetterShape', label: s('letterShape'), i18nKey: 'calendarStyle.letterShape' },
      { type: 'color-picker', key: 'dayHeaderLetterBg', label: s('letterBackground'), i18nKey: 'calendarStyle.letterBackground', defaultSolid: '#ffffff' },
      { type: 'number', key: 'dayHeaderLetterSize', label: s('letterSize'), i18nKey: 'calendarStyle.letterSize', min: 8, max: 80, unit: 'px' },
      ...radiusFields('dayHeaderLetter'),
    ],
  };
}

/** "Tabela de Dias" -- day-number grid typography/colors/row-gap + per-cell background/border/radius toggle + weekend background. */
export function daysTableSection(): Section {
  return {
    section: s('sectionDaysTable'),
    i18nKey: 'calendarStyle.sectionDaysTable',
    icon: 'calendar_view_month',
    fields: [
      ...fontFields('daysTable'),
      { type: 'color', key: 'daysTableTextColor', label: s('textColor'), i18nKey: 'calendarStyle.textColor' },
      { type: 'color', key: 'daysTableSundayColor', label: s('sundayHolidayColor'), i18nKey: 'calendarStyle.sundayHolidayColor' },
      { type: 'number', key: 'daysTableRowGap', label: s('rowGap'), i18nKey: 'calendarStyle.rowGap', min: 0, max: 40, unit: 'px' },
      { type: 'number', key: 'daysTableColGap', label: s('colGap'), i18nKey: 'calendarStyle.colGap', min: 0, max: 40, unit: 'px' },
      { type: 'divider', key: 'daysTable-cell-divider', label: s('cellStyle'), i18nKey: 'calendarStyle.cellStyle', icon: 'grid_on' },
      { type: 'toggle', key: 'daysTableCellStyleEnabled', label: s('cellStyle'), i18nKey: 'calendarStyle.cellStyle' },
      { type: 'color-picker', key: 'daysTableCellBg', label: s('background'), i18nKey: 'calendarStyle.background', defaultSolid: '#ffffff' },
      ...borderFields('daysTable'),
      ...radiusFields('daysTable'),
      { type: 'divider', key: 'daysTable-othermonth-divider', label: s('otherMonthDays'), i18nKey: 'calendarStyle.otherMonthDays', icon: 'calendar_view_day' },
      { type: 'toggle', key: 'daysTableOtherMonthShow', label: s('otherMonthShow'), i18nKey: 'calendarStyle.otherMonthShow' },
      { type: 'color', key: 'daysTableOtherMonthColor', label: s('otherMonthColor'), i18nKey: 'calendarStyle.otherMonthColor' },
      { type: 'number', key: 'daysTableOtherMonthBorderWidth', label: s('borderWidth'), i18nKey: 'calendarStyle.borderWidth', min: 0, max: 50, unit: 'px' },
      { type: 'select', key: 'daysTableOtherMonthBorderStyle', label: s('borderStyle'), i18nKey: 'calendarStyle.borderStyle', options: BORDER_STYLE_OPTIONS },
      { type: 'color', key: 'daysTableOtherMonthBorderColor', label: s('borderColor'), i18nKey: 'calendarStyle.borderColor' },
      { type: 'divider', key: 'daysTable-weekend-divider', label: s('weekendBackground'), i18nKey: 'calendarStyle.weekendBackground', icon: 'weekend' },
      { type: 'color-picker', key: 'weekendBg', label: s('weekendBackground'), i18nKey: 'calendarStyle.weekendBackground', defaultSolid: 'transparent' },
    ],
  };
}

/** "Feriados e Fases da Lua" -- two sub-groups, each with their own typography/colors/background/radius. */
export function holidaysMoonSection(): Section {
  return {
    section: s('sectionHolidaysMoon'),
    i18nKey: 'calendarStyle.sectionHolidaysMoon',
    icon: 'brightness_3',
    fields: [
      { type: 'divider', key: 'holidays-divider', label: s('holidays'), i18nKey: 'calendarStyle.holidays', icon: 'event' },
      ...fontFields('holidays'),
      { type: 'color', key: 'holidaysTextColor', label: s('textColor'), i18nKey: 'calendarStyle.textColor' },
      { type: 'color-picker', key: 'holidaysBg', label: s('background'), i18nKey: 'calendarStyle.background', defaultSolid: 'transparent' },
      ...radiusFields('holidays'),
      { type: 'divider', key: 'moon-divider', label: s('moonPhases'), i18nKey: 'calendarStyle.moonPhases', icon: 'brightness_2' },
      { type: 'font-select', key: 'moonFont', label: s('font'), i18nKey: 'calendarStyle.font' },
      { type: 'slider', key: 'moonFontSize', label: s('fontSize'), i18nKey: 'calendarStyle.fontSize', min: 2, max: 30, step: 0.5 },
      { type: 'color', key: 'moonTextColor', label: s('textColor'), i18nKey: 'calendarStyle.textColor' },
      { type: 'color-picker', key: 'moonBg', label: s('background'), i18nKey: 'calendarStyle.background', defaultSolid: 'transparent' },
      ...radiusFields('moon'),
    ],
  };
}

/** All 5 sections, in the order the user asked for (card / month bar / days table / day header / holidays+moon). */
export function calendarStyleSections(): Section[] {
  return [
    cardStyleSection(),
    monthBarSection(),
    daysTableSection(),
    dayHeaderSection(),
    holidaysMoonSection(),
  ];
}

/**
 * "Estilos Rápidos" -- a simplified, single-tab way to set the calendar's
 * typography/colours all at once, for a user who doesn't want to open the 5
 * detailed sections above. Each field here bulk-writes several of THOSE
 * sections' own canonical keys at once (see CalendarThemeKeyPaths.ts's
 * QUICK_STYLE_TARGETS for exactly which, and applyCalendarStyleChange() for
 * how a consumer should route both kinds of change through one handler) --
 * quick and detailed controls read/write the exact same CalendarTheme paths,
 * so anything picked here can always be fine-tuned (or overridden)
 * afterward in the matching detailed section, and vice-versa.
 *
 * Deliberately solid-colour-only (`type:'color'`, not the gradient-capable
 * `color-picker` some of its targets use in their own detailed section) --
 * a single quick pick fans out to several fields at once, some of which are
 * plain solid-only colours elsewhere (e.g. the holiday text colour), so
 * mixing in a gradient here has nowhere consistent to go. A plain hex still
 * renders correctly on every gradient-capable target too (cssFromValue/
 * normalizeValue treat a bare hex as a solid, same as always) -- so nothing
 * is lost, just kept to solids for a fast/simple pass; reach for the
 * detailed section directly for a gradient.
 *
 * NOT included in calendarStyleSections() above -- it's opt-in per consumer
 * (CalendarTool.ts, MiniCalendarTool.ts add it explicitly) rather than
 * automatically inherited by every surface that renders those 5 sections
 * (e.g. VariablePanel.ts's miniCalendar binding), since only the standalone
 * Calendar/Mini Calendar tools asked for this simplified tab.
 */
export function quickStyleSection(): Section {
  return {
    section: s('sectionQuickStyle'),
    i18nKey: 'calendarStyle.sectionQuickStyle',
    icon: 'auto_awesome',
    fields: [
      { type: 'color', key: 'quickColor',      label: s('quickColor'),      i18nKey: 'calendarStyle.quickColor' },
      { type: 'color', key: 'quickBg',         label: s('quickBg'),         i18nKey: 'calendarStyle.quickBg' },
      { type: 'color', key: 'quickTextColor',  label: s('quickTextColor'),  i18nKey: 'calendarStyle.quickTextColor' },
      { type: 'divider', key: 'quickstyle-typography-divider', label: s('quickTypographyDivider'), i18nKey: 'calendarStyle.quickTypographyDivider', icon: 'text_fields' },
      { type: 'font-select', key: 'quickFont', label: s('font'), i18nKey: 'calendarStyle.font' },
      { type: 'slider', key: 'quickTitleFontSize',       label: s('quickTitleFontSize'),       i18nKey: 'calendarStyle.quickTitleFontSize',       min: 2, max: 30, step: 0.5 },
      { type: 'slider', key: 'quickFontSize',            label: s('quickFontSize'),            i18nKey: 'calendarStyle.quickFontSize',            min: 2, max: 30, step: 0.5 },
      { type: 'slider', key: 'quickHolidayMoonFontSize', label: s('quickHolidayMoonFontSize'), i18nKey: 'calendarStyle.quickHolidayMoonFontSize', min: 2, max: 30, step: 0.5 },
    ],
  };
}
