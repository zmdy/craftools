/**
 * ApiPicker.ts
 *
 * Modal para selecionar imagens vindas da API de assets do CrafTools.
 *
 * URL base configurada via window.CRAFTOOLS_CONFIG.apiBase (definido no index.html).
 * Nenhum token é enviado do cliente — o acesso sem token retorna conteúdo Free.
 */

import { I18n } from '../../settings/Translations.js';
import './ApiPicker_Translations.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiImage {
  api_url: string;
  tier:    string;
}

interface ApiCollection {
  id:            string | number;
  original_path: string;
  tier:          string;
  images:        ApiImage[];
}

interface ApiResponse {
  status:  string;
  message?: string;
  data?:   ApiCollection[];
}

declare global {
  interface Window {
    CRAFTOOLS_CONFIG?: { apiBase?: string };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function getApiBase(): string {
  return (window.CRAFTOOLS_CONFIG?.apiBase ?? '').replace(/\/$/, '');
}

// ─────────────────────────────────────────────────────────────────────────────

export class ApiPicker {

  /**
   * Abre o modal da API e resolve com a URL da imagem escolhida.
   * @param resource - Recurso da /v1/: 'assets' | 'backgrounds' | 'overlays'
   * @returns URL absoluta da imagem ou null se cancelado
   */
  static open(resource = 'assets'): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const base        = getApiBase();
      const apiEndpoint = base ? `${base}/v1/?resource=${resource}` : null;

      // Overlay de fundo
      const backdrop = document.createElement('div');
      backdrop.id = 'api-picker-backdrop';
      backdrop.style.cssText = `
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(3px);
          animation: fadeIn 0.2s ease;
      `;

      // Modal
      const modal = document.createElement('div');
      modal.style.cssText = `
          background: var(--bg-shell, #fff);
          border-radius: 16px;
          width: min(92vw, 860px);
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0,0,0,0.35);
          animation: slideUp 0.25s cubic-bezier(.22,1,.36,1);
      `;

      modal.innerHTML = `
          <style>
              @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
              @keyframes slideUp { from { transform:translateY(40px); opacity:0 } to { transform:none; opacity:1 } }
              .api-collection { border-bottom: 1px solid var(--border, #e4e4e7); }
              .api-collection-header {
                  display: flex; align-items: center; gap: 10px;
                  padding: 12px 16px; cursor: pointer;
                  transition: background 0.15s;
                  user-select: none;
              }
              .api-collection-header:hover { background: var(--bg-hover, #f0f9ff); }
              .api-collection-header .col-arrow {
                  transition: transform 0.2s; font-size: 18px;
                  color: var(--text-secondary);
              }
              .api-collection-header.open .col-arrow { transform: rotate(90deg); }
              .api-collection-body {
                  display: none; padding: 10px 14px 14px;
                  background: var(--bg-app, #f4f4f5);
              }
              .api-collection-body.open { display: block; }
              .api-img-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                  gap: 8px;
              }
              .api-img-thumb {
                  aspect-ratio: 1;
                  border-radius: 8px;
                  overflow: hidden;
                  cursor: pointer;
                  border: 2px solid transparent;
                  transition: border-color 0.15s, transform 0.15s;
                  background: var(--bg-input, #e4e4e7);
                  position: relative;
              }
              .api-img-thumb:hover { border-color: var(--accent, #f97316); transform: scale(1.04); }
              .api-img-thumb img {
                  width: 100%; height: 100%; object-fit: cover; display: block;
                  transition: opacity 0.2s;
              }
              .api-img-thumb .thumb-loading {
                  position: absolute; inset: 0; display: flex;
                  align-items: center; justify-content: center;
                  font-size: 11px; color: var(--text-muted);
              }
              .api-premium-badge {
                  position: absolute; top: 4px; right: 4px;
                  background: #f59e0b; color: #fff;
                  font-size: 9px; font-weight: 700;
                  padding: 2px 4px; border-radius: 4px;
                  letter-spacing: 0.4px;
              }
              .api-collection-locked {
                  opacity: 0.5; pointer-events: none;
              }
              .api-loader { 
                  display: flex; align-items: center; justify-content: center;
                  padding: 48px; color: var(--text-muted); flex-direction: column; gap: 10px;
              }
              .api-loader .spin {
                  animation: spin 1s linear infinite;
                  font-size: 32px; color: var(--accent);
              }
              @keyframes spin { to { transform: rotate(360deg); } }
              .api-error { padding: 32px; text-align: center; color: #ef4444; }
              .tier-filter-bar {
                  display: flex; gap: 6px; align-items: center;
              }
              .tier-btn {
                  padding: 4px 10px; border-radius: 99px; border: 1px solid var(--border);
                  background: var(--bg-input); color: var(--text-secondary);
                  font-size: 11px; cursor: pointer; transition: all .15s;
                  font-family: 'DM Sans', sans-serif;
              }
              .tier-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
          </style>

          <!-- Header -->
          <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--border); flex-shrink:0;">
              <div>
                  <h3 style="margin:0; font-size:16px; font-weight:700; color:var(--text-primary);">${I18n.t('apiPicker.title')}</h3>
                  <p style="margin:2px 0 0; font-size:12px; color:var(--text-secondary);">${I18n.t('apiPicker.subtitle')}</p>
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                  <div class="tier-filter-bar">
                      <button class="tier-btn active" data-tier="all">${I18n.t('apiPicker.tierAll')}</button>
                      <button class="tier-btn" data-tier="free">${I18n.t('apiPicker.tierFree')}</button>
                      <button class="tier-btn" data-tier="premium">${I18n.t('apiPicker.tierPremium')}</button>
                  </div>
                  <button id="api-picker-close" style="
                      width:32px; height:32px; border-radius:50%; border:1px solid var(--border);
                      background:var(--bg-input); cursor:pointer; display:flex; align-items:center;
                      justify-content:center; color:var(--text-secondary);">
                      <span class="material-symbols-outlined" style="font-size:18px;">close</span>
                  </button>
              </div>
          </div>

          <!-- Busca -->
          <div style="padding: 10px 16px; border-bottom:1px solid var(--border); flex-shrink:0;">
              <input id="api-search" type="text" placeholder="${I18n.t('apiPicker.searchPlaceholder')}"
                  style="width:100%; padding:7px 12px; border-radius:8px; border:1px solid var(--border);
                          background:var(--bg-input); color:var(--text-primary); font-size:13px;
                          outline:none; font-family:'DM Sans',sans-serif; box-sizing:border-box;">
          </div>

          <!-- Corpo rolável -->
          <div id="api-picker-body" style="flex:1; overflow-y:auto; padding: 0;">
              <div class="api-loader">
                  <span class="material-symbols-outlined spin">progress_activity</span>
                  <span>${I18n.t('apiPicker.loadingCollections')}</span>
              </div>
          </div>
      `;

      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      // Close handlers
      const close = (url: string | null = null): void => {
        backdrop.style.animation = 'fadeIn 0.15s ease reverse forwards';
        setTimeout(() => backdrop.remove(), 150);
        resolve(url);
      };

      backdrop.addEventListener('click', (e: MouseEvent) => {
        if (e.target === backdrop) close();
      });
      modal.querySelector<HTMLButtonElement>('#api-picker-close')!
        .addEventListener('click', () => close());

      // Tier filter state
      let activeTier = 'all';
      modal.querySelectorAll<HTMLButtonElement>('.tier-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          activeTier = btn.dataset['tier'] ?? 'all';
          modal.querySelectorAll<HTMLButtonElement>('.tier-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderCollections(allCollections);
        });
      });

      // Search filter
      let searchQuery = '';
      modal.querySelector<HTMLInputElement>('#api-search')!
        .addEventListener('input', (e: Event) => {
          searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
          renderCollections(allCollections);
        });

      // State
      let allCollections: ApiCollection[] = [];
      const body = modal.querySelector<HTMLDivElement>('#api-picker-body')!;

      if (!apiEndpoint) {
        body.innerHTML = `<div class="api-error">
            <span class="material-symbols-outlined" style="font-size:36px; display:block; margin-bottom:8px;">settings</span>
            ${I18n.t('apiPicker.apiNotConfigured')}<br><small>${I18n.t('apiPicker.apiNotConfiguredHint')}</small>
        </div>`;
      } else {
        fetch(apiEndpoint)
          .then(r => r.json() as Promise<ApiResponse>)
          .then(json => {
            if (json.status !== 'success') throw new Error(json.message || 'API Error');
            allCollections = json.data ?? [];
            renderCollections(allCollections);
          })
          .catch((err: Error) => {
            body.innerHTML = `<div class="api-error">
                <span class="material-symbols-outlined" style="font-size:36px; display:block; margin-bottom:8px;">wifi_off</span>
                ${I18n.t('apiPicker.apiConnectError')}<br><small>${err.message}</small>
            </div>`;
          });
      }

      // ── Renderizar coleções ──────────────────────────────────────────────
      const renderCollections = (collections: ApiCollection[]): void => {
        const filtered = collections.filter(col => {
          const nameMatch = !searchQuery || col.original_path.toLowerCase().includes(searchQuery);
          const tierMatch = activeTier === 'all' || col.tier === activeTier;
          return nameMatch && tierMatch;
        });

        if (filtered.length === 0) {
          body.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted); font-size:13px;">
              ${I18n.t('apiPicker.noCollections')}
          </div>`;
          return;
        }

        body.innerHTML = '';
        filtered.forEach(col => {
          const pathParts  = col.original_path.split('/');
          const folderName = pathParts[pathParts.length - 1] || col.original_path;
          const parentPath = pathParts.slice(0, -1).join(' › ');
          const isPremium  = col.tier === 'premium';

          const colEl = document.createElement('div');
          colEl.className = 'api-collection';
          if (isPremium && activeTier === 'free') colEl.classList.add('api-collection-locked');

          colEl.innerHTML = `
              <div class="api-collection-header">
                  <span class="material-symbols-outlined col-arrow" style="font-size:18px;">chevron_right</span>
                  <div style="flex:1; min-width:0;">
                      <div style="font-size:13px; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${folderName}</div>
                      <div style="font-size:10px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${parentPath}</div>
                  </div>
                  <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                      ${isPremium
                        ? `<span style="background:#f59e0b;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:99px;">${I18n.t('apiPicker.tierPremium').toUpperCase()}</span>`
                        : `<span style="background:#10b981;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:99px;">${I18n.t('apiPicker.tierFree').toUpperCase()}</span>`}
                      <span style="font-size:11px; color:var(--text-muted);">${I18n.t('apiPicker.imagesCount').replace('{n}', String(col.images?.length ?? 0))}</span>
                  </div>
              </div>
              <div class="api-collection-body">
                  <div class="api-img-grid" id="grid-${col.id}">
                      ${col.images.map(img => {
                        const imgUrl = img.api_url.startsWith('http') ? img.api_url : `${base}/${img.api_url}`;
                        return `
                        <div class="api-img-thumb" data-url="${imgUrl}" data-col-tier="${col.tier}" data-img-tier="${img.tier}" title="${I18n.t('apiPicker.clickToUse')}">
                            <div class="thumb-loading"><span class="material-symbols-outlined" style="font-size:18px;">image</span></div>
                            <img src="${imgUrl}" loading="lazy"
                                 onload="this.previousElementSibling.style.display='none'"
                                 onerror="this.parentElement.innerHTML='<div class=thumb-loading style=color:#ef4444>!</div>'">
                            ${img.tier === 'premium' ? '<span class="api-premium-badge">PRO</span>' : ''}
                        </div>`;
                      }).join('')}
                  </div>
              </div>
          `;

          // Toggle accordion
          const header = colEl.querySelector<HTMLElement>('.api-collection-header')!;
          const bodyEl = colEl.querySelector<HTMLElement>('.api-collection-body')!;
          header.addEventListener('click', () => {
            const isOpen = bodyEl.classList.contains('open');
            document.querySelectorAll<HTMLElement>('.api-collection-body.open').forEach(b => {
              b.classList.remove('open');
              (b.previousElementSibling as HTMLElement | null)?.classList.remove('open');
            });
            if (!isOpen) {
              bodyEl.classList.add('open');
              header.classList.add('open');
            }
          });

          // Clique nas thumbnails
          colEl.querySelectorAll<HTMLElement>('.api-img-thumb').forEach(thumb => {
            thumb.addEventListener('click', () => {
              close(thumb.dataset['url'] ?? null);
            });
          });

          body.appendChild(colEl);
        });
      };
    });
  }
}
