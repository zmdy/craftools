/**
 * CellBackground.js
 * Aplica fundos (cor, gradiente, imagem) e overlays às grid cells do álbum.
 */
export class CellBackground {
    /**
     * Aplica fundo (cor, gradiente ou imagem) na camada bg-layer da célula.
     * @param {HTMLElement} cellEl - .craftools-grid-cell
     * @param {Object} opts
     * @param {string} opts.type       - 'color' | 'gradient' | 'image'
     * @param {string} opts.value      - Cor hex / CSS gradient / URL da imagem
     * @param {string} [opts.position] - 'center center', 'top left', etc.
     * @param {string} [opts.size]     - 'cover' | 'contain' | 'auto'
     * @param {number} [opts.opacity]  - 0-1 (para futuros usos)
     */
    static applyBackground(cellEl, opts = {}) {
        const bgLayer = cellEl.querySelector('.cell-bg-layer');
        if (!bgLayer) return;

        const { type, value, position = 'center center', size = 'cover' } = opts;

        // Limpa o estado anterior
        bgLayer.style.background = '';
        bgLayer.style.backgroundImage = '';
        bgLayer.style.backgroundSize = '';
        bgLayer.style.backgroundPosition = '';
        bgLayer.style.backgroundColor = '';

        if (type === 'color') {
            bgLayer.style.backgroundColor = value;
            bgLayer.style.backgroundImage = 'none';
        } else if (type === 'gradient') {
            bgLayer.style.backgroundImage = value;
            bgLayer.style.backgroundSize = '100% 100%';
        } else if (type === 'image') {
            bgLayer.style.backgroundImage = `url('${value}')`;
            bgLayer.style.backgroundSize = size;
            bgLayer.style.backgroundPosition = position;
            bgLayer.style.backgroundRepeat = 'no-repeat';
        }

        // Persiste no dataset
        cellEl.dataset.bgType = type || '';
        cellEl.dataset.bgValue = value || '';
        cellEl.dataset.bgPosition = position;
        cellEl.dataset.bgSize = size;
    }

    /** Remove o fundo da célula */
    static clearBackground(cellEl) {
        const bgLayer = cellEl.querySelector('.cell-bg-layer');
        if (!bgLayer) return;
        bgLayer.style.cssText = `
            position: absolute; inset: 0; z-index: 0;
            pointer-events: none;
            background-size: cover;
            background-position: center center;
            background-repeat: no-repeat;
        `;
        delete cellEl.dataset.bgType;
        delete cellEl.dataset.bgValue;
    }

    /**
     * Aplica overlay (imagem por cima do conteúdo) na camada overlay-layer.
     * @param {HTMLElement} cellEl
     * @param {Object} opts
     * @param {string} opts.src        - URL da imagem
     * @param {string} [opts.position] - posição CSS background-position
     * @param {string} [opts.size]     - 'cover' | 'contain' | 'auto'
     * @param {number} [opts.opacity]  - 0-1
     */
    static applyOverlay(cellEl, opts = {}) {
        const overlayLayer = cellEl.querySelector('.cell-overlay-layer');
        if (!overlayLayer) return;

        const { src, position = 'center center', size = 'cover', opacity = 1 } = opts;

        overlayLayer.style.backgroundImage = src ? `url('${src}')` : 'none';
        overlayLayer.style.backgroundSize = size;
        overlayLayer.style.backgroundPosition = position;
        overlayLayer.style.backgroundRepeat = 'no-repeat';
        overlayLayer.style.opacity = opacity;

        cellEl.dataset.overlayUrl = src || '';
        cellEl.dataset.overlayPosition = position;
        cellEl.dataset.overlaySize = size;
        cellEl.dataset.overlayOpacity = opacity;
    }

    /** Remove o overlay da célula */
    static clearOverlay(cellEl) {
        const overlayLayer = cellEl.querySelector('.cell-overlay-layer');
        if (!overlayLayer) return;
        overlayLayer.style.backgroundImage = 'none';
        overlayLayer.style.opacity = '1';
        delete cellEl.dataset.overlayUrl;
    }

    /** Ler estado atual do background de uma cell */
    static getState(cellEl) {
        return {
            bg: {
                type: cellEl.dataset.bgType || '',
                value: cellEl.dataset.bgValue || '',
                position: cellEl.dataset.bgPosition || 'center center',
                size: cellEl.dataset.bgSize || 'cover',
            },
            overlay: {
                url: cellEl.dataset.overlayUrl || '',
                position: cellEl.dataset.overlayPosition || 'center center',
                size: cellEl.dataset.overlaySize || 'cover',
                opacity: parseFloat(cellEl.dataset.overlayOpacity ?? '1'),
            }
        };
    }
}
