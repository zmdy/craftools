/**
 * CalendarThemeKeyPaths.ts — the canonical CalendarStyleSchema.ts flat key
 * -> real CalendarTheme path table, shared by every consumer that renders
 * `utils/CalendarStyleSchema.ts`'s sections (CalendarTool.ts,
 * MiniCalendarTool.ts, and VariablePanel.ts's inline `miniCalendar` config).
 *
 * Extracted out of MiniCalendarTool.ts (the first consumer to need it) so
 * the mapping isn't redefined three times over -- see CalendarStyleSchema.ts's
 * own header comment for why three separate UI surfaces all need the same
 * field set translated to/from three different storage shapes.
 *
 * `_getPath`/`_setPath` walk an arbitrary-depth path generically (radius
 * corners are 3 levels deep, e.g. `['dayNumbers', 'radius', 'tl']`, while
 * most other fields are 1-2 levels), so every canonical key -- regardless of
 * nesting depth -- is handled by the exact same read/write logic.
 */

/** Reads a value at an arbitrary-depth path inside a plain object tree. */
export function getThemePath(obj: unknown, path: readonly string[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

/** Writes a value at an arbitrary-depth path, cloning each intermediate
 * object along the way (never mutates a shared/default object in place). */
export function setThemePath(obj: Record<string, unknown>, path: readonly string[], value: unknown): void {
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    cur[k] = { ...(cur[k] as Record<string, unknown> ?? {}) };
    cur = cur[k] as Record<string, unknown>;
  }
  cur[path[path.length - 1]] = value;
}

/**
 * Canonical CalendarStyleSchema.ts key -> real path inside CalendarTheme
 * (see that interface in CalendarRenderer.ts).
 *
 * Background keys (`cardBg`/`monthBarBg`/`dayHeaderBg`/`dayHeaderLetterBg`/
 * `daysTableCellBg`/`weekendBg`/`holidaysBg`/`moonBg`) store whatever the
 * gradient-capable 'color-picker' field reports (a JSON ColorPickerValue
 * string) -- written through as-is, since CalendarRenderer.ts itself
 * resolves it via `cssFromValue(normalizeValue(...))` at render time (see
 * CalendarTheme's doc comment). Every other color key comes from a plain
 * solid-only 'color' field, already a bare hex string CalendarRenderer.ts
 * uses directly.
 */
export const CALENDAR_THEME_KEY_PATHS: Record<string, readonly string[]> = {
  cardBg: ['cellBg'],
  cardBorderWidth: ['cellBorder', 'width'],
  cardBorderStyle: ['cellBorder', 'style'],
  cardBorderColor: ['cellBorder', 'color'],
  cardRadiusTL: ['cardRadius', 'tl'], cardRadiusTR: ['cardRadius', 'tr'],
  cardRadiusBR: ['cardRadius', 'br'], cardRadiusBL: ['cardRadius', 'bl'],
  sectionGap: ['sectionGap'],
  cardPadding: ['cardPadding'],

  monthBarFont: ['titleBar', 'font'],
  monthBarFontSize: ['titleBar', 'fontSize'],
  monthBarAlign: ['titleBar', 'align'],
  monthBarTextColor: ['titleBar', 'color'],
  monthBarBg: ['titleBar', 'bg'],
  monthBarSplitMonthYear: ['titleBar', 'splitMonthYear'],
  monthBarRadiusTL: ['titleBar', 'radius', 'tl'], monthBarRadiusTR: ['titleBar', 'radius', 'tr'],
  monthBarRadiusBR: ['titleBar', 'radius', 'br'], monthBarRadiusBL: ['titleBar', 'radius', 'bl'],

  dayHeaderFont: ['weekHeader', 'font'],
  dayHeaderFontSize: ['weekHeader', 'fontSize'],
  dayHeaderAlign: ['weekHeader', 'align'],
  dayHeaderTextColor: ['weekHeader', 'color'],
  dayHeaderBg: ['weekHeader', 'bg'],
  dayHeaderBorderWidth: ['weekHeader', 'innerBorderWidth'],
  dayHeaderBorderStyle: ['weekHeader', 'innerBorderStyle'],
  dayHeaderBorderColor: ['weekHeader', 'innerBorderColor'],
  dayHeaderRadiusTL: ['weekHeader', 'radius', 'tl'], dayHeaderRadiusTR: ['weekHeader', 'radius', 'tr'],
  dayHeaderRadiusBR: ['weekHeader', 'radius', 'br'], dayHeaderRadiusBL: ['weekHeader', 'radius', 'bl'],
  dayHeaderLetterShape: ['weekHeader', 'letterShape'],
  dayHeaderLetterBg: ['weekHeader', 'letterBg'],
  dayHeaderLetterSize: ['weekHeader', 'letterSize'],
  dayHeaderLetterRadiusTL: ['weekHeader', 'letterRadius', 'tl'], dayHeaderLetterRadiusTR: ['weekHeader', 'letterRadius', 'tr'],
  dayHeaderLetterRadiusBR: ['weekHeader', 'letterRadius', 'br'], dayHeaderLetterRadiusBL: ['weekHeader', 'letterRadius', 'bl'],

  daysTableFont: ['dayNumbers', 'font'],
  daysTableFontSize: ['dayNumbers', 'fontSize'],
  daysTableAlign: ['dayNumbers', 'align'],
  daysTableTextColor: ['dayNumbers', 'color'],
  daysTableSundayColor: ['dayNumbers', 'sundayColor'],
  daysTableRowGap: ['dayNumbers', 'rowGap'],
  daysTableColGap: ['dayNumbers', 'colGap'],
  daysTableOtherMonthShow: ['dayNumbers', 'otherMonthShow'],
  daysTableOtherMonthColor: ['dayNumbers', 'otherMonthColor'],
  daysTableOtherMonthBorderWidth: ['dayNumbers', 'otherMonthBorderWidth'],
  daysTableOtherMonthBorderStyle: ['dayNumbers', 'otherMonthBorderStyle'],
  daysTableOtherMonthBorderColor: ['dayNumbers', 'otherMonthBorderColor'],
  daysTableCellStyleEnabled: ['dayNumbers', 'cellStyleEnabled'],
  daysTableCellBg: ['dayNumbers', 'cellBg'],
  daysTableBorderWidth: ['dayNumbers', 'innerBorderWidth'],
  daysTableBorderStyle: ['dayNumbers', 'innerBorderStyle'],
  daysTableBorderColor: ['dayNumbers', 'innerBorderColor'],
  daysTableRadiusTL: ['dayNumbers', 'radius', 'tl'], daysTableRadiusTR: ['dayNumbers', 'radius', 'tr'],
  daysTableRadiusBR: ['dayNumbers', 'radius', 'br'], daysTableRadiusBL: ['dayNumbers', 'radius', 'bl'],
  weekendBg: ['weekendBg'],

  holidaysFont: ['holidays', 'font'],
  holidaysFontSize: ['holidays', 'fontSize'],
  holidaysAlign: ['holidays', 'align'],
  holidaysTextColor: ['holidays', 'color'],
  holidaysBg: ['holidays', 'bg'],
  holidaysRadiusTL: ['holidays', 'radius', 'tl'], holidaysRadiusTR: ['holidays', 'radius', 'tr'],
  holidaysRadiusBR: ['holidays', 'radius', 'br'], holidaysRadiusBL: ['holidays', 'radius', 'bl'],

  moonFont: ['moonPhases', 'font'],
  moonFontSize: ['moonPhases', 'fontSize'],
  moonTextColor: ['moonPhases', 'color'],
  moonBg: ['moonPhases', 'bg'],
  moonRadiusTL: ['moonPhases', 'radius', 'tl'], moonRadiusTR: ['moonPhases', 'radius', 'tr'],
  moonRadiusBR: ['moonPhases', 'radius', 'br'], moonRadiusBL: ['moonPhases', 'radius', 'bl'],
};

/**
 * "Estilos Rápidos" (CalendarStyleSchema.ts's quickStyleSection()) -- each key
 * here is a single simplified picker that bulk-applies to SEVERAL of the
 * canonical CALENDAR_THEME_KEY_PATHS keys above at once, by name (never raw
 * paths), so the two tables can never drift apart from each other:
 *
 *   quickColor               -> month-bar background, holiday colour in the
 *                                days grid, holiday-box text colour
 *   quickBg                  -> the card's own background + the month-bar's
 *                                own text colour
 *   quickTextColor           -> day-numbers text, moon-phases text, and the
 *                                day-header's background (the three fields
 *                                that already share one dark tone by default)
 *   quickFont                -> every section's font, at once
 *   quickTitleFontSize        -> the month-bar's font size only
 *   quickFontSize             -> every OTHER text's font size (day header +
 *                                day numbers)
 *   quickHolidayMoonFontSize -> the holidays-box and moon-phases font sizes
 *
 * Quick styles and the 5 detailed sections write through the exact SAME
 * CalendarTheme paths -- there is no separate "quick" storage and no
 * override-tracking needed: whichever was edited most recently simply wins,
 * the same as any other shared field.
 */
export const QUICK_STYLE_TARGETS: Record<string, readonly string[]> = {
  quickColor:               ['monthBarBg', 'daysTableSundayColor', 'holidaysTextColor'],
  quickBg:                  ['cardBg', 'monthBarTextColor'],
  quickTextColor:           ['daysTableTextColor', 'moonTextColor', 'dayHeaderBg'],
  quickFont:                ['monthBarFont', 'dayHeaderFont', 'daysTableFont', 'holidaysFont', 'moonFont'],
  quickTitleFontSize:       ['monthBarFontSize'],
  quickFontSize:            ['dayHeaderFontSize', 'daysTableFontSize'],
  quickHolidayMoonFontSize: ['holidaysFontSize', 'moonFontSize'],
};

/**
 * Applies one field change from calendarStyleSections()'s 5 detailed
 * sections OR quickStyleSection()'s bulk pickers onto `theme` in place --
 * the single onChange body every consumer (CalendarTool.ts,
 * MiniCalendarTool.ts) should use instead of hand-rolling the "is this a
 * quick key or a canonical key" branch itself. A quick key fans out to every
 * one of its QUICK_STYLE_TARGETS entries; anything else falls back to the
 * plain single-path CALENDAR_THEME_KEY_PATHS lookup.
 */
export function applyCalendarStyleChange(theme: Record<string, unknown>, key: string, value: unknown): void {
  const quickTargets = QUICK_STYLE_TARGETS[key];
  if (quickTargets) {
    for (const targetKey of quickTargets) {
      const path = CALENDAR_THEME_KEY_PATHS[targetKey];
      if (path) setThemePath(theme, path, value);
    }
    return;
  }
  const path = CALENDAR_THEME_KEY_PATHS[key];
  if (path) setThemePath(theme, path, value);
}

/**
 * Seeds each quick-style key's own displayed value from its FIRST target's
 * current value (falling back to `defaults` the same way the canonical
 * per-key loop does) -- purely a starting point for that picker's own UI;
 * quick keys have no independent storage of their own (see
 * QUICK_STYLE_TARGETS's doc comment above).
 */
export function deriveQuickStyleState(theme: unknown, defaults: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [quickKey, targets] of Object.entries(QUICK_STYLE_TARGETS)) {
    const path = CALENDAR_THEME_KEY_PATHS[targets[0]];
    if (!path) continue;
    const fromTheme   = getThemePath(theme, path);
    const fromDefault = getThemePath(defaults, path);
    out[quickKey] = fromTheme !== undefined ? fromTheme : fromDefault;
  }
  return out;
}
