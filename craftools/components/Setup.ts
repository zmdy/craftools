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

/** How many sample cards renderHome() shows before requiring "Ver mais". */
const SAMPLES_PAGE_SIZE = 6;

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

  /** All samples successfully read so far (populated once by _loadSamples()). */
  private _samples: SampleEntry[] = [];
  /** False until _loadSamples() has resolved -- distinguishes "still fetching" from "fetched, zero readable samples" (both start with an empty _samples array). */
  private _samplesLoaded = false;
  /** Lowercased search box value; '' means "no filter". */
  private _searchQuery = '';
  /** How many of the (filtered) samples _renderSampleCards() currently shows. */
  private _visibleCount = SAMPLES_PAGE_SIZE;

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
    // Fresh entry into the home screen (first load, language switch, or
    // "Voltar" from the media-type wizard) always starts from a clean
    // slate -- an in-progress search/pagination state from a PRIOR visit
    // shouldn't silently survive a re-render the user didn't ask to filter.
    this._searchQuery   = '';
    this._visibleCount  = SAMPLES_PAGE_SIZE;

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
            ${sampleUrls.length ? `
            <div style="position: relative; max-width: 360px; margin: 20px auto 0;">
                <span class="material-symbols-outlined" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 18px; color: var(--text-muted); pointer-events: none;">search</span>
                <input type="text" id="sample-search-input" placeholder="${I18n.t('setup.searchPlaceholder')}" style="width: 100%; padding: 9px 12px 9px 34px; border-radius: 10px; background: var(--bg-input); border: 1px solid var(--border); color: var(--text-primary); font-family: 'DM Sans', sans-serif; font-size: 13px; box-sizing: border-box;">
            </div>` : ''}
            <div id="samples-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 20px;">
                ${sampleUrls.length ? `<p id="samples-loading" style="grid-column: 1 / -1; color: var(--text-muted); font-size: 12px;">${I18n.t('setup.loadingSamples')}</p>` : ''}
            </div>
            <div id="samples-load-more-wrap" style="margin-top: 18px;"></div>
        </div>
    </div>
    <style>
        .media-btn:hover { border-color: var(--accent) !important; transform: translateY(-2px); box-shadow: var(--shadow-lg) !important; }
        .sample-thumb { width: 100%; aspect-ratio: 4 / 3; border-radius: 8px; overflow: hidden; background: var(--bg-input); display: flex; align-items: center; justify-content: center; }
        .sample-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        #sample-search-input:focus { outline: none; border-color: var(--accent); }
        .samples-load-more-btn {
            padding: 9px 20px; border-radius: 10px; border: 1px solid var(--border);
            background: var(--bg-input); color: var(--text-primary); font-family: 'DM Sans', sans-serif;
            font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .samples-load-more-btn:hover { border-color: var(--accent); color: var(--accent); }
    </style>
    `;

    (this.querySelector('#lang-select') as HTMLSelectElement)
      .addEventListener('change', (e: Event) => {
        I18n.lang = (e.target as HTMLSelectElement).value;
        this.renderHome();
      });

    const searchInput = this.querySelector<HTMLInputElement>('#sample-search-input');
    searchInput?.addEventListener('input', () => {
      this._searchQuery  = searchInput.value.trim().toLowerCase();
      this._visibleCount = SAMPLES_PAGE_SIZE; // a new search always restarts pagination
      this._renderSampleCards();
    });

    this._renderSampleCards();

    if (sampleUrls.length) {
      this._loadSamples(sampleUrls);
    }
  }

  /**
   * Fetches + decompresses each sample's `meta` block (title, description,
   * thumbnail) in parallel via ProjectSerializer.readMeta(), stores the
   * successful ones on `this._samples`, then re-renders the grid. Kept as a
   * dynamic import (like every other heavy/optional module in this
   * codebase, e.g. ExportTool.ts's export actions) so the gzip/crypto
   * decompression path never loads for users who never see a sample
   * (assets/samples/ empty) or go straight to "Criar projeto novo". Each
   * sample is read independently (try/catch per URL) so one corrupted/
   * unreadable file can't blank out the others.
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

    if (!this.querySelector('#samples-grid')) return; // user already navigated away (e.g. clicked "Criar projeto novo")

    this._samples = results.filter((s): s is SampleEntry => s !== null);
    this._samplesLoaded = true;
    this._renderSampleCards();
  }

  /**
   * Rebuilds #samples-grid + the "Ver mais" button from current state
   * (`this._samples`, `this._searchQuery`, `this._visibleCount`). Cheap
   * enough to fully re-render on every keystroke/click rather than
   * diffing -- at most a couple dozen sample cards in practice, and this
   * only ever runs from user input (typing in the search box, clicking
   * "Ver mais"), never on a timer/animation frame.
   *
   * The "Criar projeto novo" tile is NOT part of the paginated/filterable
   * set -- it's always rendered last in the grid regardless of search text
   * or how many sample cards are currently visible, so it's never more than
   * one click away.
   */
  private _renderSampleCards(): void {
    const grid = this.querySelector('#samples-grid');
    const loadMoreWrap = this.querySelector('#samples-load-more-wrap');
    if (!grid) return;

    const q = this._searchQuery;
    const filtered = q
      ? this._samples.filter(s =>
          s.meta.title.toLowerCase().includes(q) ||
          (s.meta.description ?? '').toLowerCase().includes(q))
      : this._samples;

    const visible = filtered.slice(0, this._visibleCount);

    grid.innerHTML = '';

    if (!this._samplesLoaded && Object.keys(SAMPLE_PROJECT_URLS).length) {
      // Still loading (first call, before _loadSamples() resolves).
      grid.innerHTML = `<p id="samples-loading" style="grid-column: 1 / -1; color: var(--text-muted); font-size: 12px;">${I18n.t('setup.loadingSamples')}</p>`;
    } else if (q && this._samples.length && !filtered.length) {
      // Only shown when there IS a search term filtering out otherwise-
      // present samples -- if every sample simply failed to load (or none
      // are bundled at all), there's no search to blame, so this stays
      // silent and just the "Criar projeto novo" tile below shows.
      grid.innerHTML = `<p style="grid-column: 1 / -1; color: var(--text-muted); font-size: 12px;">${I18n.t('setup.noSamplesFound')}</p>`;
    } else {
      visible.forEach(sample => {
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
        grid.appendChild(card);
      });
    }

    // "Criar projeto novo" -- always last, always present, never paginated.
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

    // "Ver mais" -- lives OUTSIDE the grid (its own row below), so it never
    // becomes a grid cell competing for a column with the sample/create-new
    // tiles. Reveals SAMPLES_PAGE_SIZE more filtered samples per click;
    // removed once every filtered sample is visible.
    if (loadMoreWrap) {
      loadMoreWrap.innerHTML = '';
      if (filtered.length > visible.length) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'samples-load-more-btn';
        btn.textContent = I18n.t('setup.loadMore');
        btn.addEventListener('click', () => {
          this._visibleCount += SAMPLES_PAGE_SIZE;
          this._renderSampleCards();
        });
        loadMoreWrap.appendChild(btn);
      }
    }
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
