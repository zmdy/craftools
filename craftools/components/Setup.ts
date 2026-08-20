import { Craftools_Settings } from '../settings/Settings.js';
import { I18n } from '../settings/Translations.js';
import type { ProjectMeta } from '../utils/ProjectSerializer.js';

/**
 * Every `.craftools` sample file bundled under assets/samples/ (any depth),
 * resolved to its build URL by Vite -- same enumerate-a-folder-via-glob
 * pattern ShapeAssetLoader.ts uses for assets/shapes/. `{ query: '?url' }`
 * forces asset (URL) treatment for this non-standard extension instead of
 * Vite trying to parse it as a JS module; the file itself is an opaque
 * gzip blob (ProjectSerializer's container format), fetched and decompressed
 * lazily in renderHome() below, not inlined into the bundle.
 */
const SAMPLE_PROJECT_URLS: Record<string, string> = import.meta.glob(
  '/assets/samples/**/*.craftools',
  { eager: true, query: '?url', import: 'default' },
);

interface SampleEntry {
  url:  string;
  meta: ProjectMeta;
}

/**
 * Setup.ts — Initial screen shown when the app boots with no active/
 * recovered session: a home screen offering ready-made sample projects
 * (assets/samples/*.craftools) plus "Criar projeto novo", followed by the
 * pre-existing two-step media-type + size wizard:
 *  Home  — Pick a bundled sample, or "Criar projeto novo"
 *  Step 1 — Choose media type (post, card, poster, etc.)
 *  Step 2 — Choose canvas size within that media type
 *
 * Dispatches `craftools-start` (CustomEvent) on the element either when
 * the user finishes the size wizard (`detail: { media, size }`) or picks a
 * sample project (`detail: { sampleBlob }`) -- craftools.ts's listener
 * handles both shapes (see the comment on that handler).
 */
export class Craftools_Setup extends HTMLElement {
  // See the matching comment on Craftools_Editor.TAG_NAME in Editor.ts --
  // craftools.ts's _renderComponent() must not derive the custom-element tag
  // name from this.screen.name (the runtime class name), since a minified
  // production build mangles it, silently creating the wrong element.
  static readonly TAG_NAME = 'craftools-setup';

  constructor() { super(); }

  connectedCallback(): void {
    this.renderHome();
  }

  /**
   * Home screen: sample-projects gallery + trailing "Criar projeto novo"
   * tile. Renders immediately with just the "criar novo" tile (never blocks
   * on the network/decompression work below), then fills in sample cards
   * as their metadata resolves -- each sample is read independently so one
   * corrupted/unreadable file can't blank out the others or the whole
   * screen (see the per-sample try/catch below).
   */
  renderHome(): void {
    const sampleUrls = Object.values(SAMPLE_PROJECT_URLS);

    this.innerHTML = `
    <div class="craftools-app" style="padding: 40px 20px; height: 100vh; overflow-y: auto; display: flex; flex-direction: column;">
        <div style="position: absolute; top: 20px; right: 20px; z-index: 10;">
            <select id="lang-select" style="padding: 6px 12px; border-radius: 8px; background: var(--bg-panel); border: 1px solid var(--border); color: var(--text-primary); font-family: 'DM Sans', sans-serif; cursor: pointer; font-size: 12px;">
                <option value="pt-br" ${I18n.currentLang === 'pt-br' ? 'selected' : ''}>PT-BR</option>
                <option value="en" ${I18n.currentLang === 'en' ? 'selected' : ''}>EN-US</option>
                <option value="es" ${I18n.currentLang === 'es' ? 'selected' : ''}>ES-ES</option>
            </select>
        </div>
        <div style="background: var(--bg-shell); padding: 40px 20px; border-radius: 16px; box-shadow: var(--shadow-xl); width: 100%; max-width: 960px; text-align: center; margin: auto;">
            <h2 style="font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; font-family: 'DM Serif Display', serif;">${I18n.t('setup.title')}</h2>
            <p style="color: var(--text-secondary); font-size: 14px;">${I18n.t('setup.samplesSubtitle')}</p>
            <div id="samples-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 20px;">
                ${sampleUrls.length ? `<p id="samples-loading" style="grid-column: 1 / -1; color: var(--text-muted); font-size: 12px;">${I18n.t('setup.loadingSamples')}</p>` : ''}
            </div>
        </div>
    </div>
    <style>
        .media-btn:hover { border-color: var(--accent) !important; transform: translateY(-2px); box-shadow: var(--shadow-lg) !important; }
        .sample-thumb { width: 100%; aspect-ratio: 4 / 3; border-radius: 8px; overflow: hidden; background: var(--bg-input); display: flex; align-items: center; justify-content: center; }
        .sample-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    </style>
    `;

    (this.querySelector('#lang-select') as HTMLSelectElement)
      .addEventListener('change', (e: Event) => {
        I18n.lang = (e.target as HTMLSelectElement).value;
        this.renderHome();
      });

    this._renderCreateNewTile();

    if (sampleUrls.length) {
      this._loadSamples(sampleUrls);
    }
  }

  /** Appends the trailing "Criar projeto novo" tile to #samples-grid. */
  private _renderCreateNewTile(): void {
    const grid = this.querySelector('#samples-grid');
    if (!grid) return;

    const tile = document.createElement('a');
    tile.href = '#';
    tile.className = 'media-btn create-new-project-btn';
    tile.style.cssText = 'background: var(--bg-panel); border: 1.5px dashed var(--border); padding: 20px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 10px; cursor: pointer; text-decoration: none; color: var(--text-primary); transition: all 0.2s; box-shadow: var(--shadow); justify-content: center;';
    tile.innerHTML = `
      <span class="material-symbols-outlined" style="font-size: 32px; color: var(--accent);">add_circle</span>
      <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${I18n.t('setup.createNew')}</h3>
      <p style="margin: 0; font-size: 12px; color: var(--text-secondary); text-align: center;">${I18n.t('setup.createNewDesc')}</p>
    `;
    tile.addEventListener('click', (e: Event) => {
      e.preventDefault();
      this.renderMediaTypes();
    });
    grid.appendChild(tile);
  }

  /**
   * Fetches + decompresses each sample's `meta` block (title, description,
   * thumbnail) in parallel via ProjectSerializer.readMeta(), then renders
   * one card per successfully-read sample, inserted before the "Criar
   * projeto novo" tile. Kept as a dynamic import (like every other
   * heavy/optional module in this codebase, e.g. ExportTool.ts's export
   * actions) so the gzip/crypto decompression path never loads for users
   * who never see a sample (assets/samples/ empty) or go straight to
   * "Criar projeto novo".
   */
  private async _loadSamples(urls: string[]): Promise<void> {
    const { ProjectSerializer } = await import('../utils/ProjectSerializer.js');

    const results = await Promise.all(urls.map(async (url): Promise<SampleEntry | null> => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const meta = await ProjectSerializer.readMeta(blob);
        return { url, meta };
      } catch (err) {
        console.warn(`[Craftools_Setup] Failed to read sample project "${url}":`, err);
        return null;
      }
    }));

    const grid = this.querySelector('#samples-grid');
    if (!grid) return; // user already navigated away (e.g. clicked "Criar projeto novo")

    this.querySelector('#samples-loading')?.remove();

    const samples = results.filter((s): s is SampleEntry => s !== null);
    // Insert sample cards before the trailing "Criar projeto novo" tile so
    // it always stays last, regardless of how many samples resolved.
    const createNewTile = grid.querySelector('.create-new-project-btn');

    samples.forEach(sample => {
      const card = document.createElement('a');
      card.href = '#';
      card.className = 'media-btn';
      card.style.cssText = 'background: var(--bg-panel); border: 1px solid var(--border); padding: 12px; border-radius: 12px; display: flex; flex-direction: column; align-items: stretch; gap: 10px; cursor: pointer; text-decoration: none; color: var(--text-primary); transition: all 0.2s; box-shadow: var(--shadow);';
      card.innerHTML = `
        <div class="sample-thumb">
          ${sample.meta.thumbnail
            ? `<img src="${sample.meta.thumbnail}" alt="">`
            : `<span class="material-symbols-outlined" style="font-size: 32px; color: var(--text-muted);">image</span>`}
        </div>
        <h3 style="margin: 0; font-size: 15px; font-weight: 600;">${Craftools_Setup._escapeHtml(sample.meta.title)}</h3>
        ${sample.meta.description ? `<p style="margin: 0; font-size: 12px; color: var(--text-secondary); text-align: left;">${Craftools_Setup._escapeHtml(sample.meta.description)}</p>` : ''}
      `;
      card.addEventListener('click', (e: Event) => {
        e.preventDefault();
        this._loadSample(sample);
      });

      if (createNewTile) {
        grid.insertBefore(card, createNewTile);
      } else {
        grid.appendChild(card);
      }
    });
  }

  /**
   * Re-fetches the sample's blob (the earlier fetch in _loadSamples() only
   * kept its decompressed meta, not the original compressed bytes -- cheap
   * to redo, this only runs once per click) and hands it off to
   * craftools.ts via the same `craftools-start` event the size wizard uses,
   * carrying `sampleBlob` instead of `media`/`size`. See craftools.ts's
   * listener for how the two shapes are told apart and handled.
   */
  private async _loadSample(sample: SampleEntry): Promise<void> {
    try {
      const res = await fetch(sample.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const event = new CustomEvent('craftools-start', {
        bubbles: true,
        detail: { sampleBlob: blob },
      });
      this.dispatchEvent(event);
    } catch (err) {
      console.error('[Craftools_Setup] Failed to load sample project:', err);
      const { Notify } = await import('../utils/Notify.js');
      Notify.toast(I18n.t('setup.sampleLoadError'), 'error');
    }
  }

  private static _escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  renderMediaTypes(): void {
    let mediaTypes = "<div style='display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 20px;'>";
    for (const key in Craftools_Settings.mediaTypes) {
      const media = (Craftools_Settings.mediaTypes as Record<string, { icon: string }>)[key];
      mediaTypes += `
      <a href="#" data-media="${key}" class="media-btn" style="background: var(--bg-panel); border: 1px solid var(--border); padding: 20px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 10px; cursor: pointer; text-decoration: none; color: var(--text-primary); transition: all 0.2s; box-shadow: var(--shadow);">
          <span class="material-symbols-outlined" style="font-size: 32px; color: var(--accent);">${media.icon}</span>
          <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${I18n.t('mediaTypes.' + key)}</h3>
          <p style="margin: 0; font-size: 12px; color: var(--text-secondary); text-align: center;">${I18n.t('mediaTypes.' + key + 'Desc')}</p>
      </a>`;
    }
    mediaTypes += "</div>";

    this.innerHTML = `
    <div class="craftools-app" style="padding: 40px 20px; height: 100vh; overflow-y: auto; display: flex; flex-direction: column;">
        <div style="position: absolute; top: 20px; right: 20px; z-index: 10;">
            <select id="lang-select" style="padding: 6px 12px; border-radius: 8px; background: var(--bg-panel); border: 1px solid var(--border); color: var(--text-primary); font-family: 'DM Sans', sans-serif; cursor: pointer; font-size: 12px;">
                <option value="pt-br" ${I18n.currentLang === 'pt-br' ? 'selected' : ''}>PT-BR</option>
                <option value="en" ${I18n.currentLang === 'en' ? 'selected' : ''}>EN-US</option>
                <option value="es" ${I18n.currentLang === 'es' ? 'selected' : ''}>ES-ES</option>
            </select>
        </div>
        <div style="background: var(--bg-shell); padding: 40px 20px; border-radius: 16px; box-shadow: var(--shadow-xl); width: 100%; max-width: 800px; text-align: center; margin: auto;">
            <h2 style="font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; font-family: 'DM Serif Display', serif;">${I18n.t('setup.title')}</h2>
            <p style="color: var(--text-secondary); font-size: 14px;">${I18n.t('setup.subtitle')}</p>
            ${mediaTypes}
        </div>
    </div>
    <style>
        .media-btn:hover { border-color: var(--accent) !important; transform: translateY(-2px); box-shadow: var(--shadow-lg) !important; }
    </style>
    `;

    (this.querySelector('#lang-select') as HTMLSelectElement)
      .addEventListener('change', (e: Event) => {
        I18n.lang = (e.target as HTMLSelectElement).value;
        this.renderMediaTypes();
      });

    this.querySelectorAll<HTMLAnchorElement>('.media-btn').forEach(btn => {
      btn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        this.renderSizes(btn.getAttribute('data-media')!);
      });
    });
  }

  renderSizes(mediaKey: string): void {
    const mediaTypes = Craftools_Settings.mediaTypes as Record<string, {
      sizes: Array<{ key: string; size: string; sizeUnit: string; icon: string }>;
    }>;
    const media = mediaTypes[mediaKey];
    if (!media) return;

    let sizesHtml = "<div style='display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 20px;'>";
    media.sizes.forEach((size, index) => {
      const descSize = size.size !== '*' ? ` - ${size.size.replace(',', 'x')}` : '';
      sizesHtml += `
      <a href="#" data-size="${index}" class="media-btn" style="background: var(--bg-panel); border: 1px solid var(--border); padding: 20px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 10px; cursor: pointer; text-decoration: none; color: var(--text-primary); transition: all 0.2s; box-shadow: var(--shadow);">
          <span class="material-symbols-outlined" style="font-size: 32px; color: var(--accent);">${size.icon}</span>
          <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${I18n.t('sizes.' + mediaKey + '.' + size.key)} <span style="font-size: 12px; color: var(--text-muted);">(${size.sizeUnit}${descSize})</span></h3>
          <p style="margin: 0; font-size: 12px; color: var(--text-secondary); text-align: center;">${I18n.t('sizes.' + mediaKey + '.' + size.key + 'Desc')}</p>
      </a>`;
    });
    sizesHtml += "</div>";

    this.innerHTML = `
    <div class="craftools-app" style="padding: 40px 20px; height: 100vh; overflow-y: auto; display: flex; flex-direction: column;">
         <div style="position: absolute; top: 20px; right: 20px; z-index: 10;">
            <select id="lang-select" style="padding: 6px 12px; border-radius: 8px; background: var(--bg-panel); border: 1px solid var(--border); color: var(--text-primary); font-family: 'DM Sans', sans-serif; cursor: pointer; font-size: 12px;">
                <option value="pt-br" ${I18n.currentLang === 'pt-br' ? 'selected' : ''}>PT-BR</option>
                <option value="en" ${I18n.currentLang === 'en' ? 'selected' : ''}>EN-US</option>
                <option value="es" ${I18n.currentLang === 'es' ? 'selected' : ''}>ES-ES</option>
            </select>
        </div>
        <div style="background: var(--bg-shell); padding: 40px 20px; border-radius: 16px; box-shadow: var(--shadow-xl); width: 100%; max-width: 800px; text-align: center; position: relative; margin: auto;">
            <div style="text-align: left; margin-bottom: 18px;">
                <button id="back-btn" class="setup-back-btn">
                    <span class="material-symbols-outlined">arrow_back</span> ${I18n.t('setup.back')}
                </button>
            </div>
            <h2 style="font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; font-family: 'DM Serif Display', serif;">${I18n.t('setup.chooseSize')}</h2>
            <p style="color: var(--text-secondary); font-size: 14px;">${I18n.t('setup.availableSizes')} ${I18n.t('mediaTypes.' + mediaKey)}</p>
            ${sizesHtml}
        </div>
    </div>
    <style>
        .media-btn:hover { border-color: var(--accent) !important; transform: translateY(-2px); box-shadow: var(--shadow-lg) !important; }
        /* Subtle ghost link instead of a bordered pill floating in the
           corner (position:absolute made it look disconnected from the
           heading, especially on narrow/mobile widths) -- now sits inline
           in its own left-aligned row above the title. */
        .setup-back-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 5px 8px;
            border: none;
            border-radius: 8px;
            background: transparent;
            color: var(--text-secondary);
            font-size: 12px;
            font-family: 'DM Sans', sans-serif;
            cursor: pointer;
            transition: background .15s, color .15s;
        }
        .setup-back-btn:hover { background: var(--bg-input); color: var(--text-primary); }
        .setup-back-btn .material-symbols-outlined { font-size: 16px; }
    </style>
    `;

    (this.querySelector('#lang-select') as HTMLSelectElement)
      .addEventListener('change', (e: Event) => {
        I18n.lang = (e.target as HTMLSelectElement).value;
        this.renderSizes(mediaKey);
      });

    (this.querySelector('#back-btn') as HTMLButtonElement)
      .addEventListener('click', () => { this.renderMediaTypes(); });

    this.querySelectorAll<HTMLAnchorElement>('.media-btn').forEach(btn => {
      btn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        const sizeIndex  = Number(btn.getAttribute('data-size'));
        const selectedSize = media.sizes[sizeIndex];
        const event = new CustomEvent('craftools-start', {
          bubbles: true,
          detail: { media, size: selectedSize },
        });
        this.dispatchEvent(event);
      });
    });
  }

  static init(): void {
    customElements.define(Craftools_Setup.TAG_NAME, Craftools_Setup);
  }
}
