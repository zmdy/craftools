/**
 * AlbumPreviewSVG.js
 *
 * Gerador de preview SVG de página de álbum/kit, compartilhado entre
 * AlbumTool e GeradorTool.
 *
 * Uso:
 *   import { AlbumPreviewSVG } from '../../utils/AlbumPreviewSVG.js';
 *   const svgHtml = AlbumPreviewSVG.build(template, selectedSize, { maxW: 180, maxH: 140 });
 */

export class AlbumPreviewSVG {

    /**
     * Gera o SVG de preview de uma página do álbum/kit.
     *
     * @param {object} template   - Template no formato GridSizes.js
     * @param {object} selectedSize - { size: "210,297", sizeUnit: "mm" }
     * @param {object} [options]
     * @param {number} [options.maxW=180]  - Largura máxima do SVG em px
     * @param {number} [options.maxH=140]  - Altura máxima do SVG em px
     * @param {string} [options.cellFill='#9ca3af']   - Cor de preenchimento das células
     * @param {string} [options.cellStroke='#d1d5db'] - Cor da borda das células
     * @param {string} [options.bgColor='white']      - Cor do fundo da página
     * @returns {string} HTML string com o elemento <svg>
     */
    static build(template, selectedSize, {
        maxW = 180,
        maxH = 140,
        cellFill = '#9ca3af',
        cellStroke = '#d1d5db',
        bgColor = 'white',
    } = {}) {
        if (!selectedSize || !template) return '';

        const parts = (selectedSize.size || '210,297').split(',').map(Number);
        const docW = parts[0] || 210;
        const docH = parts[1] || 297;

        const scale = Math.min(maxW / docW, maxH / docH);
        const svgW = Math.round(docW * scale);
        const svgH = Math.round(docH * scale);

        // stroke-width em unidades de viewBox para aparecer ~1 px na tela
        const sw = (1 / scale).toFixed(3);

        const margins = this._parseMargin(template.pageMargin || '5 5 5 5');
        const [mT, mR, mB, mL] = margins;

        let shapes = '';

        if (template.type === 'promo_kit') {
            shapes = this._buildPromoKit(template, docW, mL, mT, mR, sw, cellFill, cellStroke);
        } else {
            shapes = this._buildNormalGrid(template, docW, docH, mL, mT, mR, mB, sw, cellFill, cellStroke);
        }

        return `<svg viewBox="0 0 ${docW} ${docH}" width="${svgW}" height="${svgH}"
            xmlns="http://www.w3.org/2000/svg"
            style="display:block; background:${bgColor}; border:1px solid ${cellStroke}; border-radius:3px; box-shadow:0 1px 4px rgba(0,0,0,0.12); margin:0 auto;">
            ${shapes}
        </svg>`;
    }

    // ── Privados ──────────────────────────────────────────────────────────────

    static _parseMargin(str) {
        const parts = String(str).split(' ').map(v => parseFloat(v) || 0);
        if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
        if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
        if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
        return parts;
    }

    static _drawCell(x, y, cW, cH, padStr, isStripe, sL, sC, sw, cellFill, cellStroke) {
        const [pT, pR, pB, pL] = this._parseMargin(padStr || '0 0 0 0');
        const iX = x + pL;
        const iY = y + pT;
        const iW = Math.max(0, cW - pL - pR);
        const iH = Math.max(0, cH - pT - pB);

        let out = `<rect x="${x}" y="${y}" width="${cW}" height="${cH}" fill="white" stroke="${cellStroke}" stroke-width="${sw}"/>`;

        if (isStripe && sL >= 1 && sC >= 1) {
            const slotW = iW / sC;
            const slotH = iH / sL;
            for (let sr = 0; sr < sL; sr++) {
                for (let sc = 0; sc < sC; sc++) {
                    out += `<rect x="${(iX + sc * slotW).toFixed(2)}" y="${(iY + sr * slotH).toFixed(2)}" width="${slotW.toFixed(2)}" height="${slotH.toFixed(2)}" fill="${cellFill}"/>`;
                }
            }
        } else {
            out += `<rect x="${iX}" y="${iY}" width="${iW}" height="${iH}" fill="${cellFill}"/>`;
        }
        return out;
    }

    static _buildPromoKit(template, docW, mL, mT, mR, sw, cellFill, cellStroke) {
        const gap = parseFloat(template.cellGap) || 0;
        const availableW = docW - mL - mR;
        let curX = 0, curY = 0, shelfH = 0;

        const blocks = (template.cellSlots || []).map(slot => {
            const slotGap = slot.cellGap !== undefined ? parseFloat(slot.cellGap) : gap;
            let cols, rows;
            if (slot.slotColumns && slot.slotLines) {
                cols = slot.slotColumns;
                rows = slot.slotLines;
            } else {
                const Kmax = Math.floor((availableW + slotGap) / (slot.cellWidth + slotGap)) || 1;
                cols = Math.min(slot.cellCount || 1, Kmax);
                rows = Math.ceil((slot.cellCount || 1) / cols);
            }
            const blockW = cols * slot.cellWidth + (cols > 1 ? (cols - 1) * slotGap : 0);
            const blockH = rows * slot.cellHeight + (rows > 1 ? (rows - 1) * slotGap : 0);
            return { slot, cols, rows, blockW, blockH, slotGap };
        });

        blocks.forEach(b => {
            if (curX + b.blockW > availableW && curX > 0) {
                curX = 0; curY += shelfH + gap; shelfH = 0;
            }
            b.x = curX; b.y = curY;
            curX += b.blockW + gap;
            shelfH = Math.max(shelfH, b.blockH);
        });

        let shapes = '';
        blocks.forEach(b => {
            const isStripeSlot = !!(b.slot.cellLines || b.slot.cellColumns);
            const sL = b.slot.slotLines || b.slot.cellLines || 1;
            const sC = b.slot.slotColumns || b.slot.cellColumns || 1;
            for (let r = 0; r < b.rows; r++) {
                for (let c = 0; c < b.cols; c++) {
                    if (r * b.cols + c >= (b.slot.cellCount || 1)) break;
                    const cx = mL + b.x + c * (b.slot.cellWidth + b.slotGap);
                    const cy = mT + b.y + r * (b.slot.cellHeight + b.slotGap);
                    const isGrid = !!(b.slot.slotLines && b.slot.slotColumns);
                    shapes += this._drawCell(cx, cy, b.slot.cellWidth, b.slot.cellHeight,
                        b.slot.cellPadding || '0 0 0 0', isStripeSlot || isGrid, sL, sC, sw, cellFill, cellStroke);
                }
            }
        });
        return shapes;
    }

    static _buildNormalGrid(template, docW, docH, mL, mT, mR, mB, sw, cellFill, cellStroke) {
        const gap = parseFloat(template.cellGap) || 0;
        const cW = parseFloat(template.cellWidth) || 50;
        const cH = parseFloat(template.cellHeight) || 70;
        const cols = Math.max(1, Math.floor((docW - mL - mR + gap) / (cW + gap)));
        const rows = Math.max(1, Math.floor((docH - mT - mB + gap) / (cH + gap)));
        const isStripe = !!(template.cellLines || template.cellColumns);
        const sL = template.cellLines || 1;
        const sC = template.cellColumns || 1;

        let shapes = '';
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cx = mL + c * (cW + gap);
                const cy = mT + r * (cH + gap);
                shapes += this._drawCell(cx, cy, cW, cH, template.cellPadding || '0 0 0 0',
                    isStripe, sL, sC, sw, cellFill, cellStroke);
            }
        }
        return shapes;
    }
}
