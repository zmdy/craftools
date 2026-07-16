/**
 * CellBackground.ts
 *
 * Aplica fundos (cor, gradiente, imagem) e overlays às grid cells do álbum.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type BgType = 'color' | 'gradient' | 'image' | '';

export interface BgOptions {
  type:       BgType;
  value:      string;
  position?:  string;
  size?:      string;
  /** Se true, evita propagar para irmãos (Business Card mode). */
  _silent?:   boolean;
}

export interface OverlayOptions {
  src:        string;
  position?:  string;
  size?:      string;
  opacity?:   number;
  _silent?:   boolean;
}

export interface CellState {
  bg: {
    type:     string;
    value:    string;
    position: string;
    size:     string;
  };
  overlay: {
    url:      string;
    position: string;
    size:     string;
    opacity:  number;
  };
}

/** craftools-element inside a grid cell, carrying Business Card sibling refs. */
interface LinkedElement extends HTMLElement {
  _linkedElements?: HTMLElement[];
}

// ─────────────────────────────────────────────────────────────────────────────

export class CellBackground {

  /**
   * Aplica fundo (cor, gradiente ou imagem) na camada cell-content-layer da célula.
   */
  static applyBackground(cellEl: HTMLElement, opts: BgOptions = { type: '', value: '' }): void {
    const bgLayer = cellEl.querySelector<HTMLElement>('.cell-content-layer');
    if (!bgLayer) return;

    const { type, value, position = 'center center', size = 'cover' } = opts;

    // Limpa o estado anterior
    bgLayer.style.background          = '';
    bgLayer.style.backgroundImage     = '';
    bgLayer.style.backgroundSize      = '';
    bgLayer.style.backgroundPosition  = '';
    bgLayer.style.backgroundColor     = '';

    if (type === 'color') {
      bgLayer.style.backgroundColor = value;
      bgLayer.style.backgroundImage = 'none';
    } else if (type === 'gradient') {
      bgLayer.style.backgroundImage = value;
      bgLayer.style.backgroundSize  = '100% 100%';
    } else if (type === 'image') {
      bgLayer.style.backgroundImage    = `url('${value}')`;
      bgLayer.style.backgroundSize     = size;
      bgLayer.style.backgroundPosition = position;
      bgLayer.style.backgroundRepeat   = 'no-repeat';
    }

    // Persiste no dataset
    cellEl.dataset['bgType']     = type || '';
    cellEl.dataset['bgValue']    = value || '';
    cellEl.dataset['bgPosition'] = position;
    cellEl.dataset['bgSize']     = size;

    // Propaga se houver _linkedElements (Business Card mode)
    if (!opts._silent) {
      const element = cellEl.querySelector<LinkedElement>('craftools-element');
      if (element?._linkedElements) {
        element._linkedElements.forEach(sibling => {
          const siblingCell = sibling.closest<HTMLElement>('.craftools-grid-cell');
          if (siblingCell && siblingCell !== cellEl) {
            CellBackground.applyBackground(siblingCell, { ...opts, _silent: true });
          }
        });
      }
    }
  }

  /** Remove o fundo da célula. */
  static clearBackground(cellEl: HTMLElement, silent = false): void {
    const bgLayer = cellEl.querySelector<HTMLElement>('.cell-content-layer');
    if (!bgLayer) return;

    bgLayer.style.background         = 'white';
    bgLayer.style.backgroundImage    = '';
    bgLayer.style.backgroundSize     = '';
    bgLayer.style.backgroundPosition = '';
    bgLayer.style.backgroundColor    = 'white';

    delete cellEl.dataset['bgType'];
    delete cellEl.dataset['bgValue'];

    if (!silent) {
      const element = cellEl.querySelector<LinkedElement>('craftools-element');
      if (element?._linkedElements) {
        element._linkedElements.forEach(sibling => {
          const siblingCell = sibling.closest<HTMLElement>('.craftools-grid-cell');
          if (siblingCell && siblingCell !== cellEl) {
            CellBackground.clearBackground(siblingCell, true);
          }
        });
      }
    }
  }

  /**
   * Aplica overlay (imagem por cima do conteúdo) na camada overlay-layer.
   */
  static applyOverlay(cellEl: HTMLElement, opts: OverlayOptions = { src: '' }): void {
    const overlayLayer = cellEl.querySelector<HTMLElement>('.cell-overlay-layer');
    if (!overlayLayer) return;

    const { src, position = 'center center', size = 'cover', opacity = 1 } = opts;

    overlayLayer.style.backgroundImage    = src ? `url('${src}')` : 'none';
    overlayLayer.style.backgroundSize     = size;
    overlayLayer.style.backgroundPosition = position;
    overlayLayer.style.backgroundRepeat   = 'no-repeat';
    overlayLayer.style.opacity            = String(opacity);

    cellEl.dataset['overlayUrl']      = src || '';
    cellEl.dataset['overlayPosition'] = position;
    cellEl.dataset['overlaySize']     = size;
    cellEl.dataset['overlayOpacity']  = String(opacity);

    if (!opts._silent) {
      const element = cellEl.querySelector<LinkedElement>('craftools-element');
      if (element?._linkedElements) {
        element._linkedElements.forEach(sibling => {
          const siblingCell = sibling.closest<HTMLElement>('.craftools-grid-cell');
          if (siblingCell && siblingCell !== cellEl) {
            CellBackground.applyOverlay(siblingCell, { ...opts, _silent: true });
          }
        });
      }
    }
  }

  /** Remove o overlay da célula. */
  static clearOverlay(cellEl: HTMLElement, silent = false): void {
    const overlayLayer = cellEl.querySelector<HTMLElement>('.cell-overlay-layer');
    if (!overlayLayer) return;

    overlayLayer.style.backgroundImage = 'none';
    overlayLayer.style.opacity         = '1';

    delete cellEl.dataset['overlayUrl'];

    if (!silent) {
      const element = cellEl.querySelector<LinkedElement>('craftools-element');
      if (element?._linkedElements) {
        element._linkedElements.forEach(sibling => {
          const siblingCell = sibling.closest<HTMLElement>('.craftools-grid-cell');
          if (siblingCell && siblingCell !== cellEl) {
            CellBackground.clearOverlay(siblingCell, true);
          }
        });
      }
    }
  }

  /** Ler estado atual do background de uma cell. */
  static getState(cellEl: HTMLElement): CellState {
    return {
      bg: {
        type:     cellEl.dataset['bgType']     || '',
        value:    cellEl.dataset['bgValue']    || '',
        position: cellEl.dataset['bgPosition'] || 'center center',
        size:     cellEl.dataset['bgSize']     || 'cover',
      },
      overlay: {
        url:      cellEl.dataset['overlayUrl']      || '',
        position: cellEl.dataset['overlayPosition'] || 'center center',
        size:     cellEl.dataset['overlaySize']     || 'cover',
        opacity:  parseFloat(cellEl.dataset['overlayOpacity'] ?? '1'),
      },
    };
  }
}
