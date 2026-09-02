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
