/**
 * CellPanel.ts
 * Painel de propriedades de uma craftools-grid-cell.
 * Abas: Fundo (cor / gradiente / imagem) | Overlay | Borda
 */

import { CellBackground, type CellState } from './CellBackground.js';
import { ApiPicker }   from './ApiPicker.js';
import { I18n }        from '../../settings/Translations.js';
import './CellPanel_Translations.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Position {
  label: string;
  value: string;
}

type ActiveTab = 'bg' | 'overlay' | 'border';
type BgSubMode = 'color' | 'gradient' | 'image';
type ImageRole  = 'bg' | 'overlay';

interface LinkedElement extends HTMLElement {
  _linkedElements?: HTMLElement[];
}

// ─────────────────────────────────────────────────────────────────────────────

// Posições disponíveis para bg-position (grade 3x3)
const POSITIONS: Position[] = [
  { label: '↖', value: 'top left' },
  { label: '↑', value: 'top center' },
  { label: '↗', value: 'top right' },
  { label: '←', value: 'center left' },
  { label: '◎', value: 'center center' },
  { label: '→', value: 'center right' },
  { label: '↙', value: 'bottom left' },
  { label: '↓', value: 'bottom center' },
  { label: '↘', value: 'bottom right' },
];

// ─────────────────────────────────────────────────────────────────────────────

export class CellPanel {

  /**
   * Abre o painel direito para editar uma grid cell (método legado/compatibilidade).
   */
  static open(editor: HTMLElement, cellEl: HTMLElement): void {
    const rightPanel = editor.querySelector<HTMLElement>('#right-panel');
    const panelTitle = editor.querySelector<HTMLElement>('#panel-title');
    const panelBody  = editor.querySelector<HTMLElement>('#panel-body');
    if (!rightPanel || !panelTitle || !panelBody) return;

    // If the clicked element is a photostrip slot, resolve to the stripe container
    const targetCell = cellEl.closest<HTMLElement>('.craftools-grid-cell') || cellEl;

    panelTitle.textContent = targetCell.dataset['isPhotostrip']
      ? I18n.t('cellPanel.editStrip')
      : I18n.t('cellPanel.editCell');
    rightPanel.classList.remove('hidden');

    // Destacar célula selecionada
    editor.querySelectorAll<HTMLElement>('.craftools-grid-cell.cell-selected')
      .forEach(c => c.classList.remove('cell-selected'));
    targetCell.classList.add('cell-selected');

    this.renderInto(panelBody, targetCell, null);
  }

  /**
   * Renderiza os controles de célula diretamente dentro de um container do painel.
   */
  static renderInto(
    container: HTMLElement,
    cellEl:    HTMLElement,
    onChange:  (() => void) | null,
  ): void {
    const state = CellBackground.getState(cellEl);
    let activeTab: ActiveTab = 'bg';

    const render = (): void => {
      container.innerHTML = '';

      // Section Header
      const header = document.createElement('div');
      header.style.cssText = 'padding: 10px 0 4px; font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; border-top: 1px solid var(--border); margin-top: 5px; letter-spacing: 0.5px;';
      header.textContent = I18n.t('cellPanel.bgOverlayHeader');
      container.appendChild(header);

      // Tabs
      const tabs = document.createElement('div');
      tabs.style.cssText = 'display:flex; border-bottom:1px solid var(--border); margin-bottom: 12px;';

      const tabDefs: [ActiveTab, string, string][] = [
        ['bg',      I18n.t('pageTool.background'),  'background_2'],
        ['overlay', I18n.t('cellPanel.tabOverlay'), 'layers'],
        ['border',  I18n.t('common.border'),        'border_style'],
      ];

      tabDefs.forEach(([id, label, icon]) => {
        const btn = document.createElement('button');
        btn.style.cssText = `
            flex:1; padding:8px 2px; border:none; border-bottom:2px solid ${activeTab === id ? 'var(--accent)' : 'transparent'};
            background:none; cursor:pointer; font-size:11px; color:${activeTab === id ? 'var(--accent)' : 'var(--text-secondary)'};
            display:flex; flex-direction:column; align-items:center; gap:2px;
            font-family:'DM Sans',sans-serif; font-weight:${activeTab === id ? '600' : '400'};
            transition: all .15s;
        `;
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;">${icon}</span>${label}`;
        btn.addEventListener('click', (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          activeTab = id;
          render();
        });
        tabs.appendChild(btn);
      });
      container.appendChild(tabs);

      const content = document.createElement('div');
      content.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
      container.appendChild(content);

      const triggerChange = (): void => { if (onChange) onChange(); };

      if      (activeTab === 'bg')      renderBgTab(content, cellEl, state, () => { triggerChange(); render(); });
      else if (activeTab === 'overlay') renderOverlayTab(content, cellEl, state, () => { triggerChange(); render(); });
      else if (activeTab === 'border')  renderBorderTab(content, cellEl);
    };

    render();
  }
}

// ── Tab: FUNDO ────────────────────────────────────────────────────────────────

function renderBgTab(
  container: HTMLElement,
  cellEl:    HTMLElement,
  state:     CellState,
  rerender:  () => void,
): void {
  let bgMode: BgSubMode = (state.bg.type as BgSubMode) || 'color';

  // Sub-tabs
  const subTabs = document.createElement('div');
  subTabs.style.cssText = 'display:flex; gap:4px; margin-bottom:12px;';

  const subTabDefs: [BgSubMode, string, string][] = [
    ['color',    I18n.t('pageTool.color'),    'palette'],
    ['gradient', I18n.t('pageTool.gradient'), 'gradient'],
    ['image',    I18n.t('editor.image'),      'image'],
  ];

  subTabDefs.forEach(([id, label, icon]) => {
    const btn = document.createElement('button');
    btn.style.cssText = `
        flex:1; padding:6px 2px; border-radius:8px; border:1px solid ${bgMode === id ? 'var(--accent)' : 'var(--border)'};
        background:${bgMode === id ? 'var(--accent-subtle, #fff7ed)' : 'var(--bg-input)'};
        color:${bgMode === id ? 'var(--accent)' : 'var(--text-secondary)'};
        cursor:pointer; font-size:10px; display:flex; flex-direction:column;
        align-items:center; gap:2px; font-family:'DM Sans',sans-serif;
        font-weight:${bgMode === id ? '600' : '400'};
    `;
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">${icon}</span>${label}`;
    btn.addEventListener('click', (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      bgMode = id;
      renderBgSubMode();
    });
    subTabs.appendChild(btn);
  });
  container.appendChild(subTabs);

  const subContent = document.createElement('div');
  container.appendChild(subContent);

  const renderBgSubMode = (): void => {
    subContent.innerHTML = '';
    if      (bgMode === 'color')    renderColorMode(subContent, cellEl);
    else if (bgMode === 'gradient') renderGradientMode(subContent, cellEl);
    else if (bgMode === 'image')    renderImageMode(subContent, cellEl, 'bg');
  };
  renderBgSubMode();

  // Botão limpar
  const clearBtn = document.createElement('button');
  clearBtn.style.cssText = 'margin-top:14px; width:100%; padding:7px; border-radius:6px; border:1px solid var(--border); background:transparent; color:#ef4444; font-size:12px; font-family:"DM Sans",sans-serif; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;';
  clearBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:15px;">delete</span> ${I18n.t('cellPanel.removeBg')}`;
  clearBtn.addEventListener('click', (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    CellBackground.clearBackground(cellEl);
    rerender();
  });
  container.appendChild(clearBtn);
}

// ─────────────────────────────────────────────────────────────────────────────

function renderColorMode(container: HTMLElement, cellEl: HTMLElement): void {
  const bgVal = cellEl.dataset['bgType'] === 'color' ? (cellEl.dataset['bgValue'] || '#ffffff') : '#ffffff';
  const wrap  = document.createElement('div');
  wrap.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
  wrap.innerHTML = `
      <label style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px;">${I18n.t('cellPanel.solidColor')}</label>
      <div style="display:flex; gap:8px; align-items:center;">
          <input type="color" id="bg-color-pick" value="${bgVal}"
              style="width:44px; height:44px; border:1px solid var(--border); border-radius:8px; cursor:pointer; padding:2px;">
          <input type="text" id="bg-color-hex" value="${bgVal}"
              style="flex:1; padding:7px 9px; border-radius:6px; border:1px solid var(--border);
                     background:var(--bg-input); color:var(--text-primary); font-size:12px;
                     font-family:'DM Mono',monospace; outline:none;">
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${['#ffffff','#18181b','#f97316','#3b82f6','#10b981','#f59e0b','#ec4899','#8b5cf6',
             '#f4f4f5','#e4e4e7','#fef3c7','#dbeafe','#d1fae5','#fce7f3']
            .map(c => `<div data-color="${c}" style="width:24px;height:24px;border-radius:50%;background:${c};border:2px solid ${c === '#ffffff' ? '#e4e4e7' : 'transparent'};cursor:pointer;transition:transform .1s;" title="${c}"></div>`).join('')}
      </div>
  `;

  const colorPick = wrap.querySelector<HTMLInputElement>('#bg-color-pick')!;
  const colorHex  = wrap.querySelector<HTMLInputElement>('#bg-color-hex')!;

  const apply = (val: string): void => {
    colorPick.value = val;
    colorHex.value  = val;
    CellBackground.applyBackground(cellEl, { type: 'color', value: val });
  };

  colorPick.addEventListener('input', () => apply(colorPick.value));
  colorHex.addEventListener('change', () => {
    if (/^#[0-9a-f]{3,6}$/i.test(colorHex.value)) apply(colorHex.value);
  });
  wrap.querySelectorAll<HTMLElement>('[data-color]').forEach(sw => {
    sw.addEventListener('click', (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      apply(sw.dataset['color']!);
    });
    sw.addEventListener('mouseenter', () => { sw.style.transform = 'scale(1.2)'; });
    sw.addEventListener('mouseleave', () => { sw.style.transform = 'scale(1)'; });
  });

  container.appendChild(wrap);
}

// ─────────────────────────────────────────────────────────────────────────────

function renderGradientMode(container: HTMLElement, cellEl: HTMLElement): void {
  const isGradient   = cellEl.dataset['bgType'] === 'gradient';
  const currentGrad  = isGradient
    ? (cellEl.dataset['bgValue'] || 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)')
    : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
  wrap.innerHTML = `
      <label style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px;">${I18n.t('cellPanel.gradientCss')}</label>
      <div id="grad-preview" style="height:60px; border-radius:10px; background:${currentGrad}; border:1px solid var(--border);"></div>
      <div style="display:flex; gap:6px; align-items:center;">
          <select id="grad-type" style="padding:6px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-input); color:var(--text-primary); font-size:12px; font-family:'DM Sans',sans-serif; flex:1;">
              <option value="linear">${I18n.t('cellPanel.linear')}</option>
              <option value="radial">${I18n.t('cellPanel.radial')}</option>
          </select>
          <div style="display:flex; align-items:center; gap:4px;">
              <span style="font-size:11px; color:var(--text-secondary);">${I18n.t('cellPanel.angle')}</span>
              <input type="number" id="grad-angle" value="135" min="0" max="360"
                  style="width:55px; padding:5px; border-radius:6px; border:1px solid var(--border);
                         background:var(--bg-input); color:var(--text-primary); font-size:12px; text-align:center;">
              <span style="font-size:11px;">°</span>
          </div>
      </div>
      <div style="display:flex; gap:8px;">
          <div style="flex:1;">
              <label style="font-size:10px; color:var(--text-muted);">${I18n.t('cellPanel.startColor')}</label>
              <input type="color" id="grad-c1" value="#f97316" style="width:100%; height:36px; border-radius:6px; border:1px solid var(--border); cursor:pointer; padding:2px;">
          </div>
          <div style="flex:1;">
              <label style="font-size:10px; color:var(--text-muted);">${I18n.t('cellPanel.endColor')}</label>
              <input type="color" id="grad-c2" value="#ea580c" style="width:100%; height:36px; border-radius:6px; border:1px solid var(--border); cursor:pointer; padding:2px;">
          </div>
      </div>
      <label style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; margin-top:4px;">${I18n.t('cellPanel.pasteGradientCss')}</label>
      <textarea id="grad-raw" rows="2" style="width:100%; padding:7px; border-radius:6px; border:1px solid var(--border); background:var(--bg-input); color:var(--text-primary); font-size:11px; font-family:'DM Mono',monospace; resize:vertical; box-sizing:border-box;">${currentGrad}</textarea>
      <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${[
            'linear-gradient(135deg,#f97316,#ea580c)',
            'linear-gradient(135deg,#3b82f6,#8b5cf6)',
            'linear-gradient(135deg,#10b981,#3b82f6)',
            'linear-gradient(135deg,#f59e0b,#ec4899)',
            'linear-gradient(135deg,#18181b,#3f3f46)',
            'radial-gradient(circle at 30% 30%,#f97316,#18181b)',
          ].map(g => `<div data-grad="${g}" style="width:44px;height:30px;border-radius:6px;background:${g};cursor:pointer;border:2px solid transparent;transition:border-color .1s;" title="${g}"></div>`).join('')}
      </div>
  `;

  const preview  = wrap.querySelector<HTMLElement>('#grad-preview')!;
  const typeEl   = wrap.querySelector<HTMLSelectElement>('#grad-type')!;
  const angleEl  = wrap.querySelector<HTMLInputElement>('#grad-angle')!;
  const c1El     = wrap.querySelector<HTMLInputElement>('#grad-c1')!;
  const c2El     = wrap.querySelector<HTMLInputElement>('#grad-c2')!;
  const rawEl    = wrap.querySelector<HTMLTextAreaElement>('#grad-raw')!;

  const buildGrad = (): string => {
    const t  = typeEl.value;
    const a  = angleEl.value;
    const c1 = c1El.value;
    const c2 = c2El.value;
    return t === 'radial'
      ? `radial-gradient(circle at 30% 30%,${c1},${c2})`
      : `linear-gradient(${a}deg,${c1},${c2})`;
  };

  const applyBuilt = (): void => {
    const g = buildGrad();
    rawEl.value = g;
    preview.style.background = g;
    CellBackground.applyBackground(cellEl, { type: 'gradient', value: g });
  };

  [typeEl, angleEl, c1El, c2El].forEach(el => el.addEventListener('input', applyBuilt));

  rawEl.addEventListener('input', () => {
    preview.style.background = rawEl.value;
    CellBackground.applyBackground(cellEl, { type: 'gradient', value: rawEl.value });
  });

  wrap.querySelectorAll<HTMLElement>('[data-grad]').forEach(sw => {
    sw.addEventListener('click', (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      rawEl.value = sw.dataset['grad']!;
      preview.style.background = sw.dataset['grad']!;
      CellBackground.applyBackground(cellEl, { type: 'gradient', value: sw.dataset['grad']! });
    });
    sw.addEventListener('mouseenter', () => { sw.style.borderColor = 'var(--accent)'; });
    sw.addEventListener('mouseleave', () => { sw.style.borderColor = 'transparent'; });
  });

  container.appendChild(wrap);
}

// ─────────────────────────────────────────────────────────────────────────────

function renderImageMode(
  container: HTMLElement,
  cellEl:    HTMLElement,
  role:      ImageRole,
): void {
  const currentUrl = role === 'bg'
    ? (cellEl.dataset['bgType'] === 'image' ? (cellEl.dataset['bgValue'] || '') : '')
    : (cellEl.dataset['overlayUrl'] || '');

  const currentPos     = role === 'bg' ? (cellEl.dataset['bgPosition'] || 'center center') : (cellEl.dataset['overlayPosition'] || 'center center');
  const currentSize    = role === 'bg' ? (cellEl.dataset['bgSize']     || 'cover')          : (cellEl.dataset['overlaySize']     || 'cover');
  const currentOpacity = parseFloat(role === 'overlay' ? (cellEl.dataset['overlayOpacity'] ?? '1') : '1');

  let selectedUrl     = currentUrl;
  let selectedPos     = currentPos;
  let selectedSize    = currentSize;
  let selectedOpacity = currentOpacity;

  const applyImage = (): void => {
    if (!selectedUrl) return;
    if (role === 'bg') {
      CellBackground.applyBackground(cellEl, { type: 'image', value: selectedUrl, position: selectedPos, size: selectedSize });
    } else {
      CellBackground.applyOverlay(cellEl, { src: selectedUrl, position: selectedPos, size: selectedSize, opacity: selectedOpacity });
    }
  };

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex; flex-direction:column; gap:10px;';

  // Preview
  const preview = document.createElement('div');
  preview.style.cssText = `height:90px; border-radius:10px; border:2px dashed var(--border); background:var(--bg-input);
      display:flex; align-items:center; justify-content:center; color:var(--text-muted);
      font-size:12px; overflow:hidden; position:relative;`;
  if (selectedUrl) {
    preview.style.backgroundImage    = `url('${selectedUrl}')`;
    preview.style.backgroundSize     = 'cover';
    preview.style.backgroundPosition = 'center';
  } else {
    preview.innerHTML = '<span class="material-symbols-outlined" style="font-size:32px; margin-bottom:4px;">image</span>';
  }
  wrap.appendChild(preview);

  // Botões de fonte
  const sourceBtns = document.createElement('div');
  sourceBtns.style.cssText = 'display:flex; gap:6px;';
  sourceBtns.innerHTML = `
      <button id="src-upload" style="flex:1; padding:7px; border-radius:8px; border:1px solid var(--border); background:var(--bg-input); color:var(--text-secondary); cursor:pointer; font-size:11px; font-family:'DM Sans',sans-serif; display:flex; align-items:center; justify-content:center; gap:4px;">
          <span class="material-symbols-outlined" style="font-size:16px;">upload</span> ${I18n.t('cellPanel.uploadBtn')}
      </button>
      <button id="src-api" style="flex:1; padding:7px; border-radius:8px; border:1px solid var(--accent); background:var(--accent-subtle,#fff7ed); color:var(--accent); cursor:pointer; font-size:11px; font-family:'DM Sans',sans-serif; display:flex; align-items:center; justify-content:center; gap:4px;">
          <span class="material-symbols-outlined" style="font-size:16px;">cloud</span> ${I18n.t('cellPanel.fromApiBtn')}
      </button>
  `;

  const fileInput  = document.createElement('input');
  fileInput.type   = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  sourceBtns.appendChild(fileInput);
  wrap.appendChild(sourceBtns);

  sourceBtns.querySelector<HTMLButtonElement>('#src-upload')!.addEventListener('click', (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener('change', (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => {
      selectedUrl = ev.target!.result as string;
      preview.style.backgroundImage    = `url('${selectedUrl}')`;
      preview.style.backgroundSize     = 'cover';
      preview.style.backgroundPosition = 'center';
      preview.innerHTML = '';
      applyImage();
    };
    reader.readAsDataURL(file);
  });

  sourceBtns.querySelector<HTMLButtonElement>('#src-api')!.addEventListener('click', async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const route = role === 'bg' ? 'backgrounds' : 'overlays';
    const url   = await ApiPicker.open(route);
    if (!url) return;
    selectedUrl = url;
    preview.style.backgroundImage    = `url('${selectedUrl}')`;
    preview.style.backgroundSize     = 'cover';
    preview.style.backgroundPosition = 'center';
    preview.innerHTML = '';
    applyImage();
  });

  // ── Controles de posição (grade 3×3) ─────────────────────────────────────
  const posLabel = document.createElement('label');
  posLabel.style.cssText = 'font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px;';
  posLabel.textContent = I18n.t('cellPanel.positioning');
  wrap.appendChild(posLabel);

  const posGrid = document.createElement('div');
  posGrid.style.cssText = 'display:grid; grid-template-columns:repeat(3,1fr); gap:4px; width:100%;';

  POSITIONS.forEach(pos => {
    const btn = document.createElement('button');
    btn.style.cssText = `
        padding:8px 4px; border-radius:6px; border:1px solid ${selectedPos === pos.value ? 'var(--accent)' : 'var(--border)'};
        background:${selectedPos === pos.value ? 'var(--accent-subtle,#fff7ed)' : 'var(--bg-input)'};
        color:${selectedPos === pos.value ? 'var(--accent)' : 'var(--text-secondary)'};
        cursor:pointer; font-size:16px; transition:all .1s;
    `;
    btn.title     = pos.value;
    btn.textContent = pos.label;
    btn.addEventListener('click', (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      selectedPos = pos.value;
      posGrid.querySelectorAll<HTMLButtonElement>('button').forEach(b => {
        b.style.borderColor = 'var(--border)';
        b.style.background  = 'var(--bg-input)';
        b.style.color       = 'var(--text-secondary)';
      });
      btn.style.borderColor = 'var(--accent)';
      btn.style.background  = 'var(--accent-subtle,#fff7ed)';
      btn.style.color       = 'var(--accent)';
      applyImage();
    });
    posGrid.appendChild(btn);
  });
  wrap.appendChild(posGrid);

  // ── Fit ───────────────────────────────────────────────────────────────────
  const fitWrap = document.createElement('div');
  fitWrap.style.cssText = 'display:flex; gap:6px;';
  const fitLabels: Record<string, string> = {
    cover:   I18n.t('cellPanel.fitCover'),
    contain: I18n.t('cellPanel.fitContain'),
    auto:    I18n.t('cellPanel.fitAuto'),
  };

  (['cover', 'contain', 'auto'] as const).forEach(fit => {
    const btn = document.createElement('button');
    btn.style.cssText = `flex:1; padding:5px; border-radius:6px; font-size:10px; cursor:pointer;
        border:1px solid ${selectedSize === fit ? 'var(--accent)' : 'var(--border)'};
        background:${selectedSize === fit ? 'var(--accent-subtle,#fff7ed)' : 'var(--bg-input)'};
        color:${selectedSize === fit ? 'var(--accent)' : 'var(--text-secondary)'};
        font-family:'DM Sans',sans-serif;`;
    btn.textContent = fitLabels[fit];
    btn.addEventListener('click', (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      selectedSize = fit;
      fitWrap.querySelectorAll<HTMLButtonElement>('button').forEach(b => {
        b.style.borderColor = 'var(--border)';
        b.style.background  = 'var(--bg-input)';
        b.style.color       = 'var(--text-secondary)';
      });
      btn.style.borderColor = 'var(--accent)';
      btn.style.background  = 'var(--accent-subtle,#fff7ed)';
      btn.style.color       = 'var(--accent)';
      applyImage();
    });
    fitWrap.appendChild(btn);
  });
  wrap.appendChild(fitWrap);

  // ── Opacidade (apenas para overlay) ──────────────────────────────────────
  if (role === 'overlay') {
    const opacWrap = document.createElement('div');
    opacWrap.innerHTML = `
        <label style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; display:block; margin-bottom:6px;">
            ${I18n.t('imageTool.opacity')}: <span id="opac-val">${Math.round(selectedOpacity * 100)}%</span>
        </label>
        <input type="range" id="opac-range" min="0" max="100" value="${Math.round(selectedOpacity * 100)}"
            style="width:100%;">
    `;
    opacWrap.querySelector<HTMLInputElement>('#opac-range')!.addEventListener('input', (e: Event) => {
      const rawVal   = Number((e.target as HTMLInputElement).value);
      selectedOpacity = rawVal / 100;
      opacWrap.querySelector<HTMLElement>('#opac-val')!.textContent = `${rawVal}%`;
      applyImage();
    });
    wrap.appendChild(opacWrap);
  }

  container.appendChild(wrap);
}

// ── Tab: OVERLAY ──────────────────────────────────────────────────────────────

function renderOverlayTab(
  container: HTMLElement,
  cellEl:    HTMLElement,
  state:     CellState,
  rerender:  () => void,
): void {
  renderImageMode(container, cellEl, 'overlay');

  const clearBtn = document.createElement('button');
  clearBtn.style.cssText = 'margin-top:14px; width:100%; padding:7px; border-radius:6px; border:1px solid var(--border); background:transparent; color:#ef4444; font-size:12px; font-family:"DM Sans",sans-serif; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;';
  clearBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:15px;">delete</span> ${I18n.t('cellPanel.removeOverlay')}`;
  clearBtn.addEventListener('click', (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    CellBackground.clearOverlay(cellEl);
    rerender();
  });
  container.appendChild(clearBtn);
}

// ── Tab: BORDA ────────────────────────────────────────────────────────────────

function renderBorderTab(container: HTMLElement, cellEl: HTMLElement): void {
  const bw = parseFloat(cellEl.style.borderWidth) || 1;
  const bs = cellEl.style.borderStyle || 'dashed';
  const bc = cellEl.style.borderColor || '#cccccc';

  const section = document.createElement('div');
  section.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
  section.innerHTML = `
      <label style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px;">${I18n.t('common.border')}</label>
      <div style="display:flex; gap:6px; align-items:center;">
          <input type="number" id="cell-bw" class="craftools-input" value="${bw}" min="0" max="20" style="width:55px;">
          <select id="cell-bs" class="craftools-select" style="flex:1;">
              <option value="none"   ${bs === 'none'   ? 'selected' : ''}>${I18n.t('common.borderNone')}</option>
              <option value="solid"  ${bs === 'solid'  ? 'selected' : ''}>${I18n.t('common.borderSolid')}</option>
              <option value="dashed" ${bs === 'dashed' ? 'selected' : ''}>${I18n.t('common.borderDashed')}</option>
              <option value="dotted" ${bs === 'dotted' ? 'selected' : ''}>${I18n.t('common.borderDotted')}</option>
          </select>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
          <input type="color" id="cell-bc" value="${bc.startsWith('#') ? bc : '#cccccc'}" style="width:40px; height:32px; border-radius:6px; border:1px solid var(--border); cursor:pointer; padding:2px;">
          <span style="font-size:12px; color:var(--text-secondary);">${I18n.t('common.borderColor')}</span>
      </div>
      <label style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px;">${I18n.t('common.radius')}</label>
      <input type="number" id="cell-br" class="craftools-input" value="${parseFloat(cellEl.style.borderRadius) || 0}" min="0" max="100" style="width:80px;">
  `;

  const update = (): void => {
    const w = (section.querySelector<HTMLInputElement>('#cell-bw')!).value;
    const s = (section.querySelector<HTMLSelectElement>('#cell-bs')!).value;
    const c = (section.querySelector<HTMLInputElement>('#cell-bc')!).value;
    const r = (section.querySelector<HTMLInputElement>('#cell-br')!).value;

    cellEl.style.borderWidth  = w + 'px';
    cellEl.style.borderStyle  = s;
    cellEl.style.borderColor  = c;
    cellEl.style.borderRadius = r + 'px';
    cellEl.style.setProperty('--cell-border-width', w + 'px');
    cellEl.style.setProperty('--cell-border-style', s);
    cellEl.style.setProperty('--cell-border-color', c);

    // Propaga se houver _linkedElements (Business Card mode)
    const element = cellEl.querySelector<LinkedElement>('craftools-element');
    if (element?._linkedElements) {
      element._linkedElements.forEach(sibling => {
        const siblingCell = sibling.closest<HTMLElement>('.craftools-grid-cell');
        if (siblingCell && siblingCell !== cellEl) {
          siblingCell.style.borderWidth  = w + 'px';
          siblingCell.style.borderStyle  = s;
          siblingCell.style.borderColor  = c;
          siblingCell.style.borderRadius = r + 'px';
          siblingCell.style.setProperty('--cell-border-width', w + 'px');
          siblingCell.style.setProperty('--cell-border-style', s);
          siblingCell.style.setProperty('--cell-border-color', c);
        }
      });
    }
  };

  (['#cell-bw', '#cell-bs', '#cell-bc', '#cell-br'] as const).forEach(sel => {
    const el = section.querySelector<HTMLElement>(sel);
    if (el) el.addEventListener('input', update);
  });

  container.appendChild(section);
}
