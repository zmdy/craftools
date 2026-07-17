import { Craftools_Settings } from '../settings/Settings.js';
import { I18n } from '../settings/Translations.js';

/**
 * Setup.ts — Initial media-type + size selection screen.
 *
 * Renders a two-step wizard as a Custom Element (`<craftools-setup>`):
 *  Step 1 — Choose media type (post, card, poster, etc.)
 *  Step 2 — Choose canvas size within that media type
 *
 * Dispatches `craftools-start` (CustomEvent) on the element when the
 * user selects a size, carrying `{ media, size }` in `detail`.
 */
export class Craftools_Setup extends HTMLElement {
  // See the matching comment on Craftools_Editor.TAG_NAME in Editor.ts --
  // craftools.ts's _renderComponent() must not derive the custom-element tag
  // name from this.screen.name (the runtime class name), since a minified
  // production build mangles it, silently creating the wrong element.
  static readonly TAG_NAME = 'craftools-setup';

  constructor() { super(); }

  connectedCallback(): void {
    this.renderMediaTypes();
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
            <button id="back-btn" class="craftools-topbtn" style="position: absolute; top: 20px; left: 20px;">
                <span class="material-symbols-outlined">arrow_back</span> ${I18n.t('setup.back')}
            </button>
            <h2 style="font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; font-family: 'DM Serif Display', serif;">${I18n.t('setup.chooseSize')}</h2>
            <p style="color: var(--text-secondary); font-size: 14px;">${I18n.t('setup.availableSizes')} ${I18n.t('mediaTypes.' + mediaKey)}</p>
            ${sizesHtml}
        </div>
    </div>
    <style>
        .media-btn:hover { border-color: var(--accent) !important; transform: translateY(-2px); box-shadow: var(--shadow-lg) !important; }
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
