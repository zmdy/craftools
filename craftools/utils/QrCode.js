/**
 * CrafTools QrCode Utility
 *
 * Camada fina sobre a lib open-source "qrcode-generator" (Kazuhiko Arase, MIT,
 * vendorizada em craftools/vendor/qrcode-generator/) para gerar QR Codes como
 * SVG vetorial. Não reimplementa o algoritmo de codificação/correção de erro —
 * apenas monta a string SVG final a partir da matriz de módulos retornada pela
 * lib, com suporte a cores customizadas e correto encode UTF-8 (acentos, etc.).
 */
import { qrcode } from "../../vendor/qrcode-generator/qrcode.mjs";
import { stringToBytes } from "../../vendor/qrcode-generator/qrcode-utf8.mjs";

// Garante codificação UTF-8 real (a lib, por padrão, trunca cada char em 1 byte).
qrcode.stringToBytes = stringToBytes;

export class QrCode {

    /** Níveis de correção de erro suportados, do mais "leve" ao mais robusto. */
    static EC_LEVELS = ['L', 'M', 'Q', 'H'];

    /**
     * Monta a string SVG completa do QR Code.
     * @param {string} text - conteúdo a codificar.
     * @param {object} [options]
     * @param {'L'|'M'|'Q'|'H'} [options.ecLevel='M'] - nível de correção de erro.
     * @param {string} [options.darkColor='#000000'] - cor dos módulos escuros.
     * @param {string} [options.lightColor='#ffffff'] - cor de fundo ('transparent' = sem fundo).
     * @param {number} [options.margin=4] - margem/quiet zone, em módulos (padrão ISO = 4).
     * @returns {string} markup SVG (`<svg ...>...</svg>`).
     */
    static buildSvgString(text, options = {}) {
        const {
            ecLevel = 'M',
            darkColor = '#000000',
            lightColor = '#ffffff',
            margin = 4,
        } = options;

        // A lib não aceita addData('') — garante ao menos 1 caractere.
        const safeText = (text && String(text).length) ? String(text) : ' ';
        const level = this.EC_LEVELS.includes(ecLevel) ? ecLevel : 'M';

        const qr = qrcode(0, level); // typeNumber 0 = versão automática (1-40)
        qr.addData(safeText);
        qr.make();

        const n = qr.getModuleCount();
        const size = n + margin * 2;

        // Funde módulos escuros adjacentes (mesma linha) em um único retângulo
        // dentro de um <path> só. Reduz nós SVG e evita frestas de anti-aliasing
        // entre retângulos vizinhos.
        let path = '';
        for (let r = 0; r < n; r++) {
            let c = 0;
            while (c < n) {
                if (qr.isDark(r, c)) {
                    const start = c;
                    while (c < n && qr.isDark(r, c)) c++;
                    const w = c - start;
                    path += `M${start + margin},${r + margin}h${w}v1h-${w}z`;
                } else {
                    c++;
                }
            }
        }

        const bg = (lightColor === 'transparent')
            ? ''
            : `<rect width="${size}" height="${size}" fill="${this._escapeAttr(lightColor)}"/>`;

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
            `preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" ` +
            `style="display:block;width:100%;height:100%;">` +
            `${bg}<path d="${path}" fill="${this._escapeAttr(darkColor)}"/></svg>`;
    }

    /**
     * Retorna um elemento <svg> (DOM) pronto para inserir no elemento da ferramenta.
     * @returns {SVGElement}
     */
    static buildSvgElement(text, options = {}) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = this.buildSvgString(text, options);
        return wrapper.firstElementChild;
    }

    /**
     * Estimativa simples de "isso provavelmente cabe num QR razoável".
     * Versão 40 / nível L comporta ~2953 bytes; usamos uma margem de segurança.
     */
    static isLikelyTooLong(text) {
        return (text ? String(text).length : 0) > 1800;
    }

    static _escapeAttr(val) {
        return String(val).replace(/"/g, '&quot;');
    }
}
