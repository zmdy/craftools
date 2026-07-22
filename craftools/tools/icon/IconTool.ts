/**
 * IconTool.ts — Schema-based TypeScript migration of IconTool.
 *
 * State is stored in element._craftoolsMeta (set by IconLibrary.ts).
 * _syncFromDOM() copies fillColor, strokeColor, strokeWidth into dataset.ctState.
 * _applyProperty() writes back to _craftoolsMeta and re-renders the SVG.
 */

import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { zIndexSection } from '../../utils/CommonSchema';
import { IconLibrary } from '../../utils/IconLibrary';
import { I18n } from '../../settings/Translations.js';
// Registers the 'iconTool.*' i18n keys used by renderPickerPanel() below.
import './IconTool_Translations.js';
// Registers the default "Material Symbols" pack with IconLibrary -- without
// this side-effect import (previously only reached via the now-deleted
// IconTool.js), IconLibrary.getPacks() returns an empty list and the picker
// always shows "no icons found", regardless of createElement working.
import '../../utils/icons/MaterialSymbolsPack.js';
import type { PropertySchema } from '../../types/PropertySchema';

interface IconMeta {
  packId:      string;
  iconId:      string;
  fillColor:   string;
  strokeColor: string;
  strokeWidth: number;
}

const getMeta = (element: HTMLElement): IconMeta =>
  (element as HTMLElement & { _craftoolsMeta?: IconMeta })._craftoolsMeta ?? {
    packId: 'material-symbols', iconId: 'star',
    fillColor: '#1a1a1a', strokeColor: 'none', strokeWidth: 0,
  };

const PICKER_STYLE_ID = 'ct-icon-picker-styles';

function ensurePickerStyles(): void {
  if (document.getElementById(PICKER_STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = PICKER_STYLE_ID;
  s.textContent = `
    .ct-icon-pack-tab-bar {
      display: flex; gap: 4px; padding: 10px 12px 0; flex-wrap: wrap;
    }
    .ct-icon-pack-tab {
      background: var(--bg-input, #f4f4f5); border: 1px solid var(--border, #e4e4e7);
      border-radius: 20px; padding: 5px 12px; font-size: 11px; font-weight: 600;
      cursor: pointer; color: var(--text-secondary, #71717a);
    }
    .ct-icon-pack-tab.active { background: var(--accent, #f97316); border-color: var(--accent, #f97316); color: #fff; }
    .ct-icon-cat-bar {
      display: flex; gap: 4px; padding: 8px 12px 0; overflow-x: auto;
    }
    .ct-icon-cat-tab {
      background: transparent; border: 1px solid var(--border, #e4e4e7);
      border-radius: 20px; padding: 4px 10px; font-size: 10.5px; white-space: nowrap;
      cursor: pointer; color: var(--text-secondary, #71717a); flex-shrink: 0;
    }
    .ct-icon-cat-tab.active { background: var(--bg-hover, rgba(0,0,0,.06)); border-color: var(--accent, #f97316); color: var(--text, #1a1a1a); }
    .ct-icon-search {
      margin: 8px 12px; padding: 7px 10px; border-radius: 8px;
      border: 1px solid var(--border, #e4e4e7); background: var(--bg-input, #f4f4f5);
      font-size: 12px; width: calc(100% - 24px);
    }
    .ct-icon-grid {
      display: grid; grid-template-columns: repeat(5, 1fr);
      gap: 8px; padding: 6px 12px 14px; max-height: 320px; overflow-y: auto;
    }
    .ct-icon-btn {
      background: var(--bg-input, #f4f4f5); border: 1px solid var(--border, #e4e4e7);
      cursor: grab; border-radius: 8px; padding: 8px;
      display: flex; align-items: center; justify-content: center;
      aspect-ratio: 1; transition: background 0.12s, transform 0.12s, border-color 0.12s;
    }
    .ct-icon-btn:hover { background: var(--bg-hover, rgba(0,0,0,.06)); border-color: var(--accent, #f97316); transform: scale(1.05); }
    .ct-icon-btn:active { cursor: grabbing; transform: scale(0.94); }
    .ct-icon-btn svg { width: 100%; height: 100%; pointer-events: none; }
    .ct-icon-empty { padding: 20px 12px; text-align: center; font-size: 12px; color: var(--text-secondary, #71717a); }
    .ct-icon-preview {
      display: flex; align-items: center; justify-content: center;
      padding: 14px 0 6px;
    }
    .ct-icon-preview svg { width: 72px; height: 72px; }
    .ct-icon-change-picker { max-height: 300px; overflow-y: auto; }
  `;
  document.head.appendChild(s);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = Record<string, any>;

export class IconTool extends BaseTool {

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};

    if (!('fillColor'   in existing)) patch.fillColor   = meta.fillColor;
    if (!('strokeColor' in existing)) patch.strokeColor = meta.strokeColor;
    if (!('strokeWidth' in existing)) patch.strokeWidth = meta.strokeWidth;

    if (Object.keys(patch).length) {
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
    }
  }

  /**
   * Builds a `<craftools-element>` containing an SVG icon. Recovered from
   * the pre-migration IconTool.js (deleted by the "Purge legacy JS" commit
   * without this logic being ported) -- the previous file had no
   * createElement() at all, throwing "createElement is not a function"
   * for every icon element creation.
   */
  public static createElement(packId: string, iconId: string, _editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as HTMLElement & { _craftoolsMeta?: IconMeta };
    el.setAttribute('w', '100');
    el.setAttribute('h', '100');
    el.setAttribute('data-craftool', 'icon');

    el._craftoolsMeta = (IconLibrary as unknown as AnyRec).defaultMeta(packId, iconId);

    const svg = (IconLibrary as unknown as AnyRec).buildSvgElement(packId, iconId, el._craftoolsMeta) as SVGElement | null;
    if (svg) {
      svg.style.userSelect = 'none';
      svg.style.pointerEvents = 'none';
      el.appendChild(svg);
    }

    return el;
  }

  /**
   * Renders the icon picker (pack/category tabs + search + grid) into
   * `panelBody`. Recovered from the pre-migration IconTool.js -- this
   * method didn't exist anywhere post-migration, so opening the "Icon"
   * sidebar/footer-nav entry rendered an empty panel.
   *
   * If `targetElement` is given, clicking an icon swaps that element's
   * icon instead of creating a new one (used by the "Change icon"
   * context-bar action). `onApplied` runs after swapping an existing
   * element (used to re-render the properties panel for the new type).
   */
  public static renderPickerPanel(
    panelBody: HTMLElement,
    editor: HTMLElement,
    targetElement: (HTMLElement & { _craftoolsMeta?: IconMeta; select?: () => void }) | null = null,
    onApplied: (() => void) | null = null,
  ): void {
    ensurePickerStyles();

    const Lib = IconLibrary as unknown as AnyRec;
    const packs: AnyRec[] = Lib.getPacks();
    if (!packs.length) {
      panelBody.innerHTML = `<div class="ct-icon-empty">${I18n.t('iconTool.noResults')}</div>`;
      return;
    }

    let activePackId = packs[0].id as string;
    let activeCategoryId: string | null = null; // null = "all"
    let searchQuery = '';

    const applyIcon = (packId: string, iconId: string): void => {
      if (targetElement) {
        targetElement._craftoolsMeta = Lib.defaultMeta(packId, iconId);
        IconTool._regenerate(targetElement);
        if (onApplied) onApplied();
      } else {
        const page = editor.querySelector('.craftools-page') as HTMLElement | null;
        if (!page) return;
        const rect = page.getBoundingClientRect();
        const scale = window.craftoolsZoomLevel || 1;
        const el = IconTool.createElement(packId, iconId, editor) as HTMLElement & { select?: () => void };
        el.setAttribute('x', String(Math.round(rect.width / scale / 2 - 50)));
        el.setAttribute('y', String(Math.round(rect.height / scale / 2 - 50)));
        page.appendChild(el);
        requestAnimationFrame(() => { setTimeout(() => el.select?.(), 20); });
        const ph = page.querySelector('div[style*="font-size: 14px"]');
        if (ph) ph.remove();
      }
    };

    const buildGrid = (): string => {
      const pack = Lib.getPack(activePackId);
      if (!pack) return `<div class="ct-icon-empty">${I18n.t('iconTool.noResults')}</div>`;

      let icons: AnyRec[];
      if (searchQuery.trim()) {
        icons = Lib.search(searchQuery, activePackId).map((r: AnyRec) => r.icon);
      } else if (activeCategoryId) {
        icons = Lib.byCategory(activePackId, activeCategoryId);
      } else {
        icons = pack.icons;
      }

      if (!icons.length) return `<div class="ct-icon-empty">${I18n.t('iconTool.noResults')}</div>`;

      return icons.map(icon => `
        <button class="ct-icon-btn" data-icon="${icon.id}" draggable="true" title="${icon.label}">
          ${Lib.buildSvgString(activePackId, icon.id, { fillColor: '#71717a' })}
        </button>
      `).join('');
    };

    const bindGridEvents = (grid: Element | null): void => {
      if (!grid) return;
      grid.querySelectorAll<HTMLButtonElement>('.ct-icon-btn').forEach(btn => {
        const iconId = btn.dataset.icon as string;
        btn.addEventListener('click', (e) => { e.preventDefault(); applyIcon(activePackId, iconId); });
        btn.addEventListener('dragstart', (ev: Event) => {
          const dt = (ev as DragEvent).dataTransfer;
          dt?.setData('ToolType', 'icon');
          dt?.setData('IconPackId', activePackId);
          dt?.setData('IconId', iconId);
          if (dt) dt.effectAllowed = 'copy';
        });
      });
    };

    const rebuildGrid = (): void => {
      const grid = panelBody.querySelector('#ct-icon-grid');
      if (!grid) return;
      grid.innerHTML = buildGrid();
      bindGridEvents(grid);
    };

    const renderAll = (): void => {
      const pack = Lib.getPack(activePackId);
      const cats: AnyRec[] = pack ? pack.categories : [];

      panelBody.innerHTML = `
        ${packs.length > 1 ? `
          <div class="ct-icon-pack-tab-bar" id="ct-icon-pack-bar">
            ${packs.map(p => `<button class="ct-icon-pack-tab ${p.id === activePackId ? 'active' : ''}" data-pack="${p.id}">${p.label}</button>`).join('')}
          </div>
        ` : ''}
        <div class="ct-icon-cat-bar" id="ct-icon-cat-bar">
          <button class="ct-icon-cat-tab ${!activeCategoryId ? 'active' : ''}" data-cat="">All</button>
          ${cats.map(c => `<button class="ct-icon-cat-tab ${c.id === activeCategoryId ? 'active' : ''}" data-cat="${c.id}">${c.label}</button>`).join('')}
        </div>
        <input type="text" class="ct-icon-search" id="ct-icon-search" placeholder="${I18n.t('iconTool.searchPlaceholder')}" value="${searchQuery}">
        <div class="ct-icon-grid" id="ct-icon-grid">${buildGrid()}</div>
      `;

      panelBody.querySelectorAll<HTMLButtonElement>('.ct-icon-pack-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          activePackId = tab.dataset.pack as string;
          activeCategoryId = null;
          searchQuery = '';
          renderAll();
        });
      });

      panelBody.querySelectorAll<HTMLButtonElement>('.ct-icon-cat-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          activeCategoryId = tab.dataset.cat || null;
          searchQuery = '';
          panelBody.querySelectorAll('.ct-icon-cat-tab').forEach(t => t.classList.toggle('active', t === tab));
          const search = panelBody.querySelector<HTMLInputElement>('#ct-icon-search');
          if (search) search.value = '';
          rebuildGrid();
        });
      });

      const searchInput = panelBody.querySelector<HTMLInputElement>('#ct-icon-search');
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          searchQuery = searchInput.value;
          rebuildGrid();
        });
      }

      bindGridEvents(panelBody.querySelector('#ct-icon-grid'));
    };

    renderAll();
  }

  static getPropertySchema(_element: HTMLElement): PropertySchema {
    return [
      {
        section: 'Icon Style',
        icon: 'interests',
        defaultOpen: true,
        fields: [
          { type: 'color-picker', key: 'fillColor',   label: 'Fill color' },
          { type: 'color-picker', key: 'strokeColor', label: 'Stroke color' },
          { type: 'slider', key: 'strokeWidth', label: 'Stroke width', min: 0, max: 10, step: 0.5 },
        ],
      },
      zIndexSection(),
    ];
  }

  /**
   * "Change icon" ctx-bar action -- swaps the selected element's icon via
   * the same picker (pack/category tabs + search + grid) used to add a new
   * one, in "change" mode (renderPickerPanel()'s `targetElement` param,
   * supported since this tool's migration but never actually reachable:
   * this getCtxOptions() override didn't exist at all, so BaseTool's
   * default (an empty array) applied and the ctx-bar never offered a
   * "change icon" button. iconTool.changeIcon/pickerTitle's translations
   * already existed for exactly this feature, confirming it was planned
   * but never wired up -- same gap ShapeTool.ts had for "Change shape".
   */
  static getCtxOptions(): Array<{ icon: string; label: string; command: (element: HTMLElement) => void }> {
    return [
      {
        icon: 'published_with_changes',
        label: I18n.t('iconTool.changeIcon'),
        command: (element: HTMLElement) => {
          const panelTitle = document.getElementById('panel-title');
          const panelBody  = document.getElementById('panel-body');
          if (!panelBody) return;
          if (panelTitle) panelTitle.textContent = I18n.t('iconTool.pickerTitle');
          // `editor` (2nd param) is only read by renderPickerPanel()'s
          // "create a brand-new element" branch -- unused whenever
          // `targetElement` (3rd param) is passed, as it is here, so
          // reusing `element` in that slot is safe.
          IconTool.renderPickerPanel(panelBody, element, element, () => {
            // Picker replaced panelBody's contents wholesale, bypassing
            // renderPropertiesPanel()'s own "same element, don't re-clear"
            // tracking -- clear it explicitly so the properties panel
            // rebuilds cleanly instead of appending its sections after the
            // stale picker markup.
            panelBody.innerHTML = '';
            if (panelTitle) panelTitle.textContent = I18n.t('iconTool.panelTitle');
            IconTool.renderPropertiesPanel(panelBody, element);
          });
        },
      },
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    // 'zIndex' (from CommonSchema.ts's zIndexSection()) is a plain CSS
    // stacking property, not part of the icon's own SVG meta -- routing it
    // through _craftoolsMeta/_regenerate() below persisted the value but
    // never actually touched element.style.zIndex, so the manual Z-Index
    // field visibly did nothing for this tool. Apply it directly instead,
    // same as every other tool's 'zIndex' case.
    if (key === 'zIndex') { element.style.zIndex = String(value); return; }
    const el = element as HTMLElement & { _craftoolsMeta?: IconMeta };
    if (el._craftoolsMeta) {
      (el._craftoolsMeta as unknown as Record<string, unknown>)[key] = value;
    }
    // Calls _regenerate() directly (previously dispatched an unlistened
    // 'craftools-icon-regenerate' custom event, so edits never actually
    // touched the rendered SVG).
    IconTool._regenerate(element);
  }

  /** Rebuilds the SVG from the current _craftoolsMeta state. */
  private static _regenerate(element: HTMLElement): void {
    const meta = (element as HTMLElement & { _craftoolsMeta?: IconMeta })._craftoolsMeta;
    if (!meta) return;

    const svgString = (IconLibrary as unknown as AnyRec).buildSvgString(meta.packId, meta.iconId, meta);
    if (!svgString) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = svgString;
    const fresh = wrapper.firstElementChild as SVGElement;

    const svg = element.querySelector<SVGElement>('svg');
    if (svg) {
      svg.setAttribute('viewBox', fresh.getAttribute('viewBox') ?? '');
      svg.innerHTML = fresh.innerHTML;
    } else {
      fresh.style.userSelect = 'none';
      fresh.style.pointerEvents = 'none';
      element.appendChild(fresh);
    }

    IconTool._triggerChange(element);
  }

  private static _triggerChange(element: HTMLElement): void {
    element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
  }
}

// ── Self-registration ─────────────────────────────────────────────────────────

IconTool.registeredKeys = ['icon'];

// label/icon match the desktop sidebar (index.html #pwa-sidebar-icon) --
// 'editor.icon' (singular) isn't a registered key, only 'editor.icons' is.
ToolRegistry.register({
  key:             'icon',
  label:           'editor.icons',
  icon:            'grid_view',
  tool:            IconTool,
  draggable:       true,
  showInFooterNav: true,
  category:        'elements',
});
