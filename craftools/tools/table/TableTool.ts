/**
 * TableTool.ts — editable table/grid canvas element.
 *
 * A real `<table>` (colgroup + tbody/tr/td) lives inside the element's
 * content area. Each `<td>` is `contenteditable="true"` — no per-cell
 * plumbing is needed to make them individually editable: Element.ts's
 * `_enterEdit()` (double-click) flips `pointer-events` to `auto` on the
 * WHOLE content area (not just one child), and `pointer-events` is an
 * inherited CSS property, so every cell becomes natively clickable/
 * focusable at once, exactly like TextTool's single editable node.
 *
 * Row/column count and cell text need zero custom persistence code:
 * StateSerializer.ts already captures `element.contentArea.innerHTML`
 * on every save (same mechanism TextTool's typed paragraphs rely on), and
 * the real `<table>` markup (colspan/rowspan/colgroup widths/cell text)
 * round-trips through that HTML verbatim. `_craftoolsMeta` only needs to
 * remember the three properties that AREN'T recoverable by reading the
 * DOM: which style template is active, whether row 0 is styled as a
 * header, and the accent color driving that template.
 *
 * All template styling is applied as inline `style` (not CSS classes) —
 * matching CalendarRenderer.ts's approach — since exported output
 * (PDF/SVG via html2canvas/html-to-svg) only reliably captures inline
 * styles, not rules from an external/injected stylesheet.
 */

import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import { Notify } from '../../utils/Notify.js';
import { I18n } from '../../settings/Translations.js';
import type { PropertySchema } from '../../types/PropertySchema';
import './TableTool_Translations.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type TableTemplateId = 'simple' | 'header-color' | 'zebra' | 'rounded';

interface TableMeta {
  templateId: TableTemplateId;
  /** Whether the first row is styled as a distinct header. Default: true. */
  headerRow: boolean;
  /** Drives header background / zebra tint / rounded-header background. */
  accentColor: string;
}

type TableElement = HTMLElement & { _craftoolsMeta?: TableMeta; contentArea?: HTMLElement };

const getMeta = (el: HTMLElement): Partial<TableMeta> => (el as TableElement)._craftoolsMeta ?? {};

const DEFAULT_ROWS = 3;
const DEFAULT_COLS = 3;
const MIN_COL_PERCENT = 8;

// ── Template catalog (id + i18n label key, for the picker gallery) ────────────

const TEMPLATES: Array<{ id: TableTemplateId; i18nKey: string }> = [
  { id: 'simple',       i18nKey: 'tableTool.templateSimple' },
  { id: 'header-color', i18nKey: 'tableTool.templateHeaderColor' },
  { id: 'zebra',        i18nKey: 'tableTool.templateZebra' },
  { id: 'rounded',      i18nKey: 'tableTool.templateRounded' },
];

// ── Color helper (hex -> rgba, for the zebra tint) ─────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#f97316');
  if (!m) return `rgba(249,115,22,${alpha})`;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export class TableTool extends BaseTool {

  static getDefaultMeta(): TableMeta {
    return { templateId: 'simple', headerRow: true, accentColor: '#f97316' };
  }

  // ── Template styling (inline CSS, export-safe) ──────────────────────────────

  private static _tableStyleCss(preview = false): string {
    return [
      'width:100%', 'height:100%',
      'border-collapse:collapse',
      'table-layout:fixed',
      `font-family:${preview ? 'inherit' : "'DM Sans', system-ui, sans-serif"}`,
      `font-size:${preview ? '7px' : '13px'}`,
      'color:#1a1a1a',
    ].join(';');
  }

  private static _cellStyleCss(opts: {
    templateId: TableTemplateId;
    accentColor: string;
    isHeader: boolean;
    rowIndex: number;
    preview?: boolean;
  }): string {
    const { templateId, accentColor, isHeader, rowIndex, preview } = opts;
    const pad = preview ? '2px 3px' : '6px 8px';
    const base = [`padding:${pad}`, 'vertical-align:middle', 'overflow-wrap:break-word', 'outline:none'];

    if (templateId === 'header-color') {
      if (isHeader) {
        return [...base, `background:${accentColor}`, 'color:#ffffff', 'font-weight:700',
          'border:1px solid ' + accentColor].join(';');
      }
      return [...base, 'background:#ffffff', 'color:#1a1a1a',
        'border:1px solid #e4e4e7'].join(';');
    }

    if (templateId === 'zebra') {
      if (isHeader) {
        return [...base, `background:${accentColor}`, 'color:#ffffff', 'font-weight:700',
          'border-bottom:2px solid ' + accentColor].join(';');
      }
      const zebraOn = (rowIndex % 2) === 1;
      return [...base, `background:${zebraOn ? hexToRgba(accentColor, 0.1) : '#ffffff'}`,
        'color:#1a1a1a', 'border-bottom:1px solid #e4e4e7'].join(';');
    }

    if (templateId === 'rounded') {
      const bg = isHeader ? accentColor : '#ffffff';
      const color = isHeader ? '#ffffff' : '#1a1a1a';
      return [...base, `background:${bg}`, `color:${color}`, isHeader ? 'font-weight:700' : '',
        'border:1px solid #e4e4e7', 'border-radius:8px',
        preview ? '' : 'box-shadow:0 1px 2px rgba(0,0,0,.06)'].filter(Boolean).join(';');
    }

    // 'simple'
    return [...base, 'background:transparent', 'color:#1a1a1a',
      isHeader ? 'font-weight:700' : '', 'border:1px solid #d4d4d8'].filter(Boolean).join(';');
  }

  /** Table-level cssText for a given template — 'rounded' needs cell spacing
   * (border-spacing) instead of border-collapse so each cell reads as its
   * own little card, per the confirmed template brief. */
  private static _tableStyleForTemplate(templateId: TableTemplateId, preview = false): string {
    const common = TableTool._tableStyleCss(preview);
    if (templateId === 'rounded') {
      return common.replace('border-collapse:collapse', `border-collapse:separate;border-spacing:${preview ? '2px' : '6px'}`);
    }
    return common;
  }

  /**
   * Re-paints every existing `<td>`'s inline style from the current
   * template/accent/header-row settings — never touches cell content,
   * colSpan/rowSpan, or the colgroup's widths. Safe to call after any
   * structural change (add/remove row/col, merge/unmerge) or property edit.
   */
  private static _restyle(table: HTMLTableElement, meta: TableMeta): void {
    table.style.cssText = TableTool._tableStyleForTemplate(meta.templateId);
    const rows = Array.from(table.tBodies[0]?.rows ?? []);
    rows.forEach((tr, rowIndex) => {
      const isHeader = meta.headerRow && rowIndex === 0;
      Array.from(tr.cells).forEach(cell => {
        cell.style.cssText = TableTool._cellStyleCss({
          templateId: meta.templateId, accentColor: meta.accentColor, isHeader, rowIndex,
        });
      });
    });
  }

  // ── Table construction ──────────────────────────────────────────────────────

  private static _buildTable(meta: TableMeta, rows = DEFAULT_ROWS, cols = DEFAULT_COLS): HTMLTableElement {
    const table = document.createElement('table');
    table.className = 'ct-table';

    const colgroup = document.createElement('colgroup');
    const colWidth = (100 / cols).toFixed(3);
    for (let c = 0; c < cols; c++) {
      const col = document.createElement('col');
      col.style.width = `${colWidth}%`;
      colgroup.appendChild(col);
    }
    table.appendChild(colgroup);

    const tbody = document.createElement('tbody');
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        td.setAttribute('contenteditable', 'true');
        if (meta.headerRow && r === 0) td.textContent = `${I18n.t('tableTool.defaultHeaderCellPrefix')} ${c + 1}`;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    TableTool._restyle(table, meta);
    return table;
  }

  public static createElement(_type: string, _editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as TableElement;
    el.setAttribute('x', '50');
    el.setAttribute('y', '50');
    el.setAttribute('w', '320');
    el.setAttribute('h', '160');
    el.setAttribute('data-craftool', 'table');

    el._craftoolsMeta = TableTool.getDefaultMeta();
    el.appendChild(TableTool._buildTable(el._craftoolsMeta));
    return el;
  }

  /**
   * Swaps `element`'s active template (and repaints every existing cell to
   * match) without touching row/column count, cell text, or merges. Public
   * so callers outside this file -- PageTool.ts's drag-drop handler,
   * renderPickerPanel()'s "swap an existing element" branch -- don't have
   * to reach into the private `_restyle()`/meta-mutation internals
   * themselves.
   */
  public static applyTemplate(element: HTMLElement, templateId: TableTemplateId): void {
    const e = element as TableElement;
    const meta = (e._craftoolsMeta ?? TableTool.getDefaultMeta()) as TableMeta;
    meta.templateId = templateId;
    e._craftoolsMeta = meta;
    const table = TableTool._table(element);
    if (table) TableTool._restyle(table, meta);
  }

  private static _table(element: HTMLElement): HTMLTableElement | null {
    const e = element as TableElement;
    const host = e.contentArea ?? element;
    return host.querySelector<HTMLTableElement>(':scope > table.ct-table');
  }

  private static _triggerChange(element: HTMLElement): void {
    element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
  }

  // ── Grid geometry (rowSpan/colSpan-aware) ───────────────────────────────────

  /**
   * Maps every logical (row, col) grid position to the `<td>` occupying it —
   * merged cells appear at every position they cover (same element
   * reference repeated). Standard "table grid" algorithm: walk rows
   * top-to-bottom, skip any grid slot already claimed by an earlier row's
   * rowSpan, then claim `rowSpan × colSpan` slots for each real `<td>`.
   */
  private static _computeGrid(table: HTMLTableElement): (HTMLTableCellElement | null)[][] {
    const rows = Array.from(table.tBodies[0]?.rows ?? []);
    const grid: (HTMLTableCellElement | null)[][] = [];
    rows.forEach((tr, r) => {
      if (!grid[r]) grid[r] = [];
      let c = 0;
      Array.from(tr.cells).forEach(cell => {
        while (grid[r][c]) c++;
        const rowSpan = cell.rowSpan || 1;
        const colSpan = cell.colSpan || 1;
        for (let dr = 0; dr < rowSpan; dr++) {
          if (!grid[r + dr]) grid[r + dr] = [];
          for (let dc = 0; dc < colSpan; dc++) grid[r + dr][c + dc] = cell;
        }
        c += colSpan;
      });
    });
    return grid;
  }

  /** Bounding (r1,c1)-(r2,c2) of a cell's own span within `grid`. */
  private static _cellSpan(grid: (HTMLTableCellElement | null)[][], cell: HTMLTableCellElement): { r1: number; c1: number; r2: number; c2: number } | null {
    let r1 = Infinity, c1 = Infinity, r2 = -1, c2 = -1;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
        if (grid[r][c] === cell) {
          r1 = Math.min(r1, r); c1 = Math.min(c1, c);
          r2 = Math.max(r2, r); c2 = Math.max(c2, c);
        }
      }
    }
    return r2 === -1 ? null : { r1, c1, r2, c2 };
  }

  private static _colCount(table: HTMLTableElement): number {
    return table.querySelectorAll(':scope > colgroup > col').length;
  }

  // ── Row / column structural edits ───────────────────────────────────────────

  private static _addRow(element: HTMLElement): void {
    const table = TableTool._table(element);
    const meta = getMeta(element) as TableMeta;
    if (!table) return;
    const cols = TableTool._colCount(table);
    const tr = document.createElement('tr');
    for (let c = 0; c < cols; c++) {
      const td = document.createElement('td');
      td.setAttribute('contenteditable', 'true');
      tr.appendChild(td);
    }
    table.tBodies[0].appendChild(tr);
    TableTool._restyle(table, meta as TableMeta);
    TableTool._triggerChange(element);
  }

  private static _removeRow(element: HTMLElement): void {
    const table = TableTool._table(element);
    if (!table) return;
    const tbody = table.tBodies[0];
    if (tbody.rows.length <= 1) {
      Notify.toast(I18n.t('tableTool.minRows'), 'error');
      return;
    }
    tbody.deleteRow(tbody.rows.length - 1);
    TableTool._restyle(table, getMeta(element) as TableMeta);
    TableTool._triggerChange(element);
  }

  private static _addColumn(element: HTMLElement): void {
    const table = TableTool._table(element);
    if (!table) return;
    const colgroup = table.querySelector('colgroup');
    if (colgroup) {
      const cols = colgroup.querySelectorAll('col');
      const newCount = cols.length + 1;
      const width = (100 / newCount).toFixed(3);
      cols.forEach(col => { col.style.width = `${width}%`; });
      const col = document.createElement('col');
      col.style.width = `${width}%`;
      colgroup.appendChild(col);
    }
    Array.from(table.tBodies[0]?.rows ?? []).forEach(tr => {
      const td = document.createElement('td');
      td.setAttribute('contenteditable', 'true');
      tr.appendChild(td);
    });
    TableTool._restyle(table, getMeta(element) as TableMeta);
    TableTool._triggerChange(element);
  }

  private static _removeColumn(element: HTMLElement): void {
    const table = TableTool._table(element);
    if (!table) return;
    const colCount = TableTool._colCount(table);
    if (colCount <= 1) {
      Notify.toast(I18n.t('tableTool.minCols'), 'error');
      return;
    }

    const grid = TableTool._computeGrid(table);
    const lastCol = colCount - 1;
    // Block removal if any cell's merge crosses the boundary being cut —
    // ask the user to unmerge first rather than silently mangling content.
    for (let r = 0; r < grid.length; r++) {
      if (grid[r]?.[lastCol] && grid[r][lastCol] === grid[r][lastCol - 1]) {
        Notify.toast(I18n.t('tableTool.unmergeBeforeRemoveCol'), 'error');
        return;
      }
    }

    const removed = new Set<HTMLTableCellElement>();
    for (let r = 0; r < grid.length; r++) {
      const cell = grid[r]?.[lastCol];
      if (cell && !removed.has(cell)) {
        removed.add(cell);
        cell.remove();
      }
    }
    const cols = table.querySelectorAll('colgroup > col');
    cols[cols.length - 1]?.remove();
    const newCount = colCount - 1;
    const width = (100 / newCount).toFixed(3);
    table.querySelectorAll('colgroup > col').forEach(col => { (col as HTMLElement).style.width = `${width}%`; });

    TableTool._restyle(table, getMeta(element) as TableMeta);
    TableTool._triggerChange(element);
  }

  // ── Merge / unmerge ──────────────────────────────────────────────────────────

  private static _mergeRect(element: HTMLElement, r1: number, c1: number, r2: number, c2: number): void {
    const table = TableTool._table(element);
    if (!table) return;
    const grid = TableTool._computeGrid(table);

    // Every grid slot in the rectangle must be covered by a cell whose OWN
    // span lies entirely inside the rectangle -- otherwise the selection
    // isn't a clean union of whole cells (e.g. it clips an already-merged
    // cell) and merging would silently drop content.
    const seen = new Set<HTMLTableCellElement>();
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const cell = grid[r]?.[c];
        if (!cell) { Notify.toast(I18n.t('tableTool.invalidMergeSelection'), 'error'); return; }
        const span = TableTool._cellSpan(grid, cell);
        if (!span || span.r1 < r1 || span.c1 < c1 || span.r2 > r2 || span.c2 > c2) {
          Notify.toast(I18n.t('tableTool.invalidMergeSelection'), 'error');
          return;
        }
        seen.add(cell);
      }
    }
    if (seen.size < 2) return;

    // Anchor = the cell at the rectangle's top-left; every other cell's
    // content is folded into it (joined by a space) and then removed.
    const anchor = grid[r1][c1] as HTMLTableCellElement;
    const parts: string[] = [];
    seen.forEach(cell => {
      const html = cell.innerHTML.trim();
      if (cell !== anchor && html) parts.push(html);
      if (cell !== anchor) cell.remove();
    });
    if (parts.length) {
      const anchorHtml = anchor.innerHTML.trim();
      anchor.innerHTML = [anchorHtml, ...parts].filter(Boolean).join(' ');
    }
    anchor.rowSpan = (r2 - r1 + 1);
    anchor.colSpan = (c2 - c1 + 1);

    TableTool._restyle(table, getMeta(element) as TableMeta);
    TableTool._triggerChange(element);
  }

  private static _unmergeCell(element: HTMLElement, cell: HTMLTableCellElement): void {
    const table = TableTool._table(element);
    if (!table) return;
    const rowSpan = cell.rowSpan || 1;
    const colSpan = cell.colSpan || 1;
    if (rowSpan <= 1 && colSpan <= 1) return;

    const grid = TableTool._computeGrid(table);
    const span = TableTool._cellSpan(grid, cell);
    if (!span) return;

    cell.rowSpan = 1;
    cell.colSpan = 1;

    const rows = Array.from(table.tBodies[0].rows);
    for (let r = span.r1; r <= span.r2; r++) {
      const tr = rows[r];
      for (let c = span.c1; c <= span.c2; c++) {
        if (r === span.r1 && c === span.c1) continue; // the anchor itself
        // Insert a fresh empty cell right before whichever real <td> in
        // this row starts at the next grid column after `c` (or append at
        // the row's end if none does) -- keeps DOM order matching visual
        // column order.
        const freshGrid = TableTool._computeGrid(table);
        let before: HTMLTableCellElement | null = null;
        for (let cc = c + 1; cc < TableTool._colCount(table); cc++) {
          const candidate = freshGrid[r]?.[cc];
          if (candidate && TableTool._cellSpan(freshGrid, candidate)?.c1 === cc) { before = candidate; break; }
        }
        const td = document.createElement('td');
        td.setAttribute('contenteditable', 'true');
        if (before && before.parentElement === tr) tr.insertBefore(td, before);
        else tr.appendChild(td);
      }
    }

    TableTool._restyle(table, getMeta(element) as TableMeta);
    TableTool._triggerChange(element);
  }

  // ── Structural in-canvas UI (column resize + merge selection) ──────────────
  // Only reachable once the element is in inline-edit mode (double-click) --
  // that's the same moment Element.ts flips the content area's pointer-events
  // to 'auto', which is what makes anything inside it clickable at all (the
  // selection overlay otherwise sits on top and captures every pointer
  // event). A capture-phase listener on the element itself still sees the
  // double-click even though the overlay's own bubble-phase handler calls
  // stopPropagation() -- capture runs first, before that.

  private static _attachStructuralUI(element: TableElement): void {
    const marked = element as TableElement & { _ctTableUIBound?: boolean };
    if (marked._ctTableUIBound) return;
    marked._ctTableUIBound = true;

    let handlesLayer: HTMLElement | null = null;
    let toolbar: HTMLElement | null = null;
    let selAnchor: HTMLTableCellElement | null = null;
    let selRect: { r1: number; c1: number; r2: number; c2: number } | null = null;

    const scale = (): number => window.craftoolsZoomLevel || 1;

    const clearSelectionHighlight = (): void => {
      const table = TableTool._table(element);
      table?.querySelectorAll<HTMLElement>('td').forEach(td => { td.style.boxShadow = ''; });
    };

    const hideToolbar = (): void => {
      toolbar?.remove();
      toolbar = null;
      selAnchor = null;
      selRect = null;
      clearSelectionHighlight();
    };

    const showToolbarFor = (kind: 'merge' | 'unmerge', anchorCellRect: DOMRect, tableRect: DOMRect): void => {
      toolbar?.remove();
      const host = element.contentArea ?? element;
      const bar = document.createElement('div');
      bar.className = 'ct-table-mini-toolbar';
      bar.style.cssText = [
        'position:absolute', 'z-index:20', 'pointer-events:auto',
        'background:#1a1a1a', 'color:#fff', 'border-radius:6px', 'padding:4px 8px',
        'font-size:11px', 'font-family:system-ui,sans-serif', 'cursor:pointer',
        'box-shadow:0 4px 10px rgba(0,0,0,.25)', 'white-space:nowrap',
      ].join(';');
      bar.textContent = kind === 'merge' ? I18n.t('tableTool.mergeCells') : I18n.t('tableTool.unmergeCells');
      const left = (anchorCellRect.left - tableRect.left) / scale();
      const top  = (anchorCellRect.top  - tableRect.top)  / scale() - 26;
      bar.style.left = `${Math.max(0, left)}px`;
      bar.style.top  = `${Math.max(-26, top)}px`;
      bar.addEventListener('mousedown', e => e.stopPropagation());
      bar.addEventListener('click', (e) => {
        e.stopPropagation();
        if (kind === 'merge' && selRect) {
          TableTool._mergeRect(element, selRect.r1, selRect.c1, selRect.r2, selRect.c2);
        } else if (kind === 'unmerge' && selAnchor) {
          TableTool._unmergeCell(element, selAnchor);
        }
        hideToolbar();
        positionHandles();
      });
      host.appendChild(bar);
      toolbar = bar;
    };

    const highlightRect = (r1: number, c1: number, r2: number, c2: number): void => {
      clearSelectionHighlight();
      const table = TableTool._table(element);
      if (!table) return;
      const grid = TableTool._computeGrid(table);
      const seen = new Set<HTMLTableCellElement>();
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const cell = grid[r]?.[c];
          if (cell) seen.add(cell);
        }
      }
      seen.forEach(cell => { cell.style.boxShadow = 'inset 0 0 0 2px var(--accent, #f97316)'; });
    };

    const onCellMouseDown = (e: MouseEvent): void => {
      const target = (e.target as HTMLElement).closest('td');
      if (!target) return;
      const table = TableTool._table(element);
      if (!table) return;
      const grid = TableTool._computeGrid(table);
      const span = TableTool._cellSpan(grid, target as HTMLTableCellElement);
      if (!span) return;

      if (e.shiftKey && selAnchor) {
        const anchorSpan = TableTool._cellSpan(grid, selAnchor);
        if (!anchorSpan) return;
        e.preventDefault();
        const r1 = Math.min(anchorSpan.r1, span.r1), r2 = Math.max(anchorSpan.r2, span.r2);
        const c1 = Math.min(anchorSpan.c1, span.c1), c2 = Math.max(anchorSpan.c2, span.c2);
        if (r2 - r1 + 1 < 2 && c2 - c1 + 1 < 2) return;
        selRect = { r1, c1, r2, c2 };
        highlightRect(r1, c1, r2, c2);
        const tableRect = table.getBoundingClientRect();
        showToolbarFor('merge', target.getBoundingClientRect(), tableRect);
        return;
      }

      // Plain click: new anchor. If it's already merged, offer to unmerge.
      selAnchor = target as HTMLTableCellElement;
      selRect = span;
      if ((target as HTMLTableCellElement).rowSpan > 1 || (target as HTMLTableCellElement).colSpan > 1) {
        highlightRect(span.r1, span.c1, span.r2, span.c2);
        const tableRect = table.getBoundingClientRect();
        showToolbarFor('unmerge', target.getBoundingClientRect(), tableRect);
      } else {
        hideToolbar();
        selAnchor = target as HTMLTableCellElement;
      }
    };

    // ── Column resize handles ─────────────────────────────────────────────────

    const positionHandles = (): void => {
      const table = TableTool._table(element);
      const host = element.contentArea ?? element;
      handlesLayer?.remove();
      handlesLayer = null;
      if (!table) return;

      const firstRow = table.tBodies[0]?.rows[0];
      if (!firstRow) return;

      const layer = document.createElement('div');
      layer.className = 'ct-table-col-handles';
      layer.style.cssText = [
        'position:absolute', 'pointer-events:none', 'z-index:19',
        `left:${table.offsetLeft}px`, `top:${table.offsetTop}px`,
        `width:${table.offsetWidth}px`, `height:${table.offsetHeight}px`,
      ].join(';');

      let x = 0;
      const boundaries: number[] = [];
      Array.from(firstRow.cells).forEach(cell => {
        x += cell.offsetWidth;
        boundaries.push(x);
      });
      boundaries.pop(); // last boundary is the table's own right edge -- not resizable

      boundaries.forEach(bx => {
        const handle = document.createElement('div');
        handle.className = 'ct-table-col-handle';
        handle.style.cssText = [
          'position:absolute', 'top:0', 'bottom:0', 'width:8px',
          `left:${bx - 4}px`, 'cursor:col-resize', 'pointer-events:auto',
          'background:transparent',
        ].join(';');
        handle.addEventListener('mouseenter', () => { handle.style.background = 'rgba(249,115,22,.35)'; });
        handle.addEventListener('mouseleave', () => { handle.style.background = 'transparent'; });
        handle.addEventListener('mousedown', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          const cols = table.querySelectorAll<HTMLElement>('colgroup > col');
          const idx = boundaries.indexOf(bx);
          const leftCol = cols[idx], rightCol = cols[idx + 1];
          if (!leftCol || !rightCol) return;
          const startX = e.clientX;
          const tableWidth = table.offsetWidth;
          const leftPct0 = parseFloat(leftCol.style.width) || (100 / cols.length);
          const rightPct0 = parseFloat(rightCol.style.width) || (100 / cols.length);

          const onMove = (ev: MouseEvent): void => {
            const deltaPct = ((ev.clientX - startX) / scale()) / tableWidth * 100;
            let leftPct = leftPct0 + deltaPct;
            let rightPct = rightPct0 - deltaPct;
            if (leftPct < MIN_COL_PERCENT) { rightPct -= (MIN_COL_PERCENT - leftPct); leftPct = MIN_COL_PERCENT; }
            if (rightPct < MIN_COL_PERCENT) { leftPct -= (MIN_COL_PERCENT - rightPct); rightPct = MIN_COL_PERCENT; }
            leftCol.style.width = `${leftPct}%`;
            rightCol.style.width = `${rightPct}%`;
            positionHandles();
          };
          const onUp = (): void => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            TableTool._triggerChange(element);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
        layer.appendChild(handle);
      });

      host.appendChild(layer);
      handlesLayer = layer;
    };

    const teardown = (): void => {
      handlesLayer?.remove();
      handlesLayer = null;
      hideToolbar();
    };

    element.addEventListener('dblclick', () => {
      positionHandles();
      const table = TableTool._table(element);
      table?.addEventListener('mousedown', onCellMouseDown);
    }, { capture: true });

    (element.contentArea ?? element).addEventListener('focusout', (ev: FocusEvent) => {
      if (!element.contains(ev.relatedTarget as Node | null)) teardown();
    });

    // Structural edits (add/remove row/col) invalidate handle positions.
    new ResizeObserver(() => { if (handlesLayer) positionHandles(); }).observe(element);
  }

  // ── Picker gallery (template selection, ShapeTool.renderPickerPanel pattern) ─

  private static readonly PICKER_STYLE_ID = 'ct-table-picker-styles';

  private static _ensurePickerStyles(): void {
    if (document.getElementById(TableTool.PICKER_STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = TableTool.PICKER_STYLE_ID;
    s.textContent = `
      .ct-table-tpl-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; padding:10px 12px 14px; }
      .ct-table-tpl-btn {
        background:var(--bg-input,#f4f4f5); border:1px solid var(--border,#e4e4e7); border-radius:10px;
        padding:8px; cursor:pointer; display:flex; flex-direction:column; gap:6px; align-items:stretch;
        transition:border-color .12s, transform .12s;
      }
      .ct-table-tpl-btn:hover { border-color:var(--accent,#f97316); transform:scale(1.02); }
      .ct-table-tpl-btn table { pointer-events:none; }
      .ct-table-tpl-btn span { font-size:11px; text-align:center; color:var(--text-secondary,#52525b); }
    `;
    document.head.appendChild(s);
  }

  private static _previewTable(templateId: TableTemplateId): HTMLTableElement {
    const meta: TableMeta = { templateId, headerRow: true, accentColor: '#f97316' };
    const table = document.createElement('table');
    table.style.cssText = TableTool._tableStyleForTemplate(templateId, true);
    for (let r = 0; r < 2; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < 2; c++) {
        const td = document.createElement('td');
        td.style.cssText = TableTool._cellStyleCss({ templateId, accentColor: meta.accentColor, isHeader: r === 0, rowIndex: r, preview: true });
        td.innerHTML = '&nbsp;';
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    return table;
  }

  public static renderPickerPanel(
    panelBody: HTMLElement,
    editor: HTMLElement,
    targetElement: (TableElement & { select?: () => void }) | null = null,
    onApplied: (() => void) | null = null,
  ): void {
    TableTool._ensurePickerStyles();

    const applyTemplate = (templateId: TableTemplateId): void => {
      if (targetElement) {
        TableTool.applyTemplate(targetElement, templateId);
        TableTool._triggerChange(targetElement);
        if (onApplied) onApplied();
      } else {
        const page = editor.querySelector('.craftools-page') as HTMLElement | null;
        if (!page) return;
        const rect = page.getBoundingClientRect();
        const scale = window.craftoolsZoomLevel || 1;
        const el = TableTool.createElement('table', editor) as TableElement & { select?: () => void };
        TableTool.applyTemplate(el, templateId);
        el.setAttribute('x', String(Math.round(rect.width / scale / 2 - 160)));
        el.setAttribute('y', String(Math.round(rect.height / scale / 2 - 80)));
        page.appendChild(el);
        requestAnimationFrame(() => { setTimeout(() => el.select?.(), 20); });
        const ph = page.querySelector('div[style*="font-size: 14px"]');
        if (ph) ph.remove();
      }
    };

    panelBody.innerHTML = `<div class="ct-table-tpl-grid" data-part="results"></div>`;
    const grid = panelBody.querySelector<HTMLElement>('[data-part="results"]')!;
    TEMPLATES.forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ct-table-tpl-btn';
      btn.draggable = !targetElement;
      btn.appendChild(TableTool._previewTable(t.id));
      const label = document.createElement('span');
      label.textContent = I18n.t(t.i18nKey);
      btn.appendChild(label);
      btn.addEventListener('click', (e) => { e.preventDefault(); applyTemplate(t.id); });
      btn.addEventListener('dragstart', (ev: DragEvent) => {
        ev.dataTransfer?.setData('ToolType', 'table');
        ev.dataTransfer?.setData('TableTemplateId', t.id);
        if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy';
      });
      grid.appendChild(btn);
    });
  }

  static getCtxOptions(): Array<{ icon: string; label: string; command: (element: HTMLElement) => void }> {
    return [
      {
        icon: 'published_with_changes',
        label: I18n.t('tableTool.changeTemplate'),
        command: (element: HTMLElement) => {
          const panelTitle = document.getElementById('panel-title');
          const panelBody  = document.getElementById('panel-body');
          if (!panelBody) return;
          if (panelTitle) panelTitle.textContent = I18n.t('tableTool.pickerTitle');
          TableTool.renderPickerPanel(panelBody, element, element as TableElement, () => {
            panelBody.innerHTML = '';
            TableTool.renderPropertiesPanel(panelBody, element);
          });
        },
      },
    ];
  }

  // ── Property panel ───────────────────────────────────────────────────────────

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};
    if (!('templateId'   in existing)) patch.templateId   = meta.templateId ?? 'simple';
    if (!('headerRow'    in existing)) patch.headerRow    = meta.headerRow ?? true;
    if (!('accentColor'  in existing)) patch.accentColor  = meta.accentColor ?? '#f97316';
    // rows/cols are a live view of the DOM, not independently persisted --
    // always recomputed so the steppers reflect reality even after a
    // structural edit made outside the panel (ctx-bar template swap, merge).
    const table = TableTool._table(element);
    patch.rows = table ? (table.tBodies[0]?.rows.length ?? DEFAULT_ROWS) : DEFAULT_ROWS;
    patch.cols = table ? TableTool._colCount(table) : DEFAULT_COLS;

    element.dataset.ctState = JSON.stringify({ ...existing, ...patch });

    TableTool._attachStructuralUI(element as TableElement);
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Table',
        i18nKey: 'tableTool.sectionTable',
        icon: 'table',
        defaultOpen: true,
        fields: [
          { type: 'number', key: 'rows', label: 'Rows', i18nKey: 'tableTool.rows', min: 1, max: 20, step: 1 },
          { type: 'number', key: 'cols', label: 'Columns', i18nKey: 'tableTool.cols', min: 1, max: 15, step: 1 },
          { type: 'toggle', key: 'headerRow', label: 'Header row', i18nKey: 'tableTool.headerRow' },
          { type: 'color', key: 'accentColor', label: 'Accent color', i18nKey: 'tableTool.accentColor' },
        ],
      },
      zIndexSection(),
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    const e = element as TableElement;
    const meta = (e._craftoolsMeta ?? TableTool.getDefaultMeta()) as TableMeta;

    if (key === 'rows') {
      PropertyRenderer.applyChange(element, key, value);
      const table = TableTool._table(element);
      const target = Math.max(1, Math.round(Number(value) || 1));
      let current = table?.tBodies[0]?.rows.length ?? 1;
      while (current < target) { TableTool._addRow(element); current++; }
      while (current > target && current > 1) { TableTool._removeRow(element); current--; }
      return;
    }
    if (key === 'cols') {
      PropertyRenderer.applyChange(element, key, value);
      const table = TableTool._table(element);
      const target = Math.max(1, Math.round(Number(value) || 1));
      let current = table ? TableTool._colCount(table) : 1;
      while (current < target) { TableTool._addColumn(element); current++; }
      while (current > target && current > 1) { TableTool._removeColumn(element); current--; }
      return;
    }
    if (key === 'headerRow' || key === 'accentColor') {
      PropertyRenderer.applyChange(element, key, value);
      (meta as unknown as Record<string, unknown>)[key] = value;
      e._craftoolsMeta = meta;
      const table = TableTool._table(element);
      if (table) TableTool._restyle(table, meta);
      TableTool._triggerChange(element);
      return;
    }
    if (key === 'zIndex') {
      PropertyRenderer.applyChange(element, key, value);
      element.style.zIndex = String(value);
      return;
    }
    PropertyRenderer.applyChange(element, key, value);
  }
}

TableTool.registeredKeys = ['table'];
ToolRegistry.register({ key: 'table', label: 'editor.table', icon: 'table', tool: TableTool, draggable: true, showInFooterNav: false, category: 'elements' });
