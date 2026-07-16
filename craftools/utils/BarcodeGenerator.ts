/**
 * BarcodeGenerator.ts — Gerador de código de barras vetorial (SVG).
 * Formatos: CODE 39 e EAN-13 (sem dependências externas).
 */

export interface BarcodeOptions {
    format?:     'code39' | 'ean13';
    color?:      string;
    background?: string;
    showText?:   boolean;
    barHeight?:  number;
}

export class BarcodeGenerator {

    static readonly FORMATS: string[] = ['code39', 'ean13'];

    // ── CODE 39 (ISO/IEC 16388) ───────────────────────────────────────────────
    static readonly CODE39_CHARS: Record<string, string> = {
        '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
        '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
        '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
        'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw', 'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw',
        'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn',
        'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn', 'K': 'wnnnnnnww', 'L': 'nnwnnnnww',
        'M': 'wnwnnnnwn', 'N': 'nnnnwnnww', 'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn',
        'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn', 'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn',
        'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw',
        'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
        '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn',
        '$': 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn',
        '*': 'nwnnwnwnn',
    };

    static isValidCode39Text(text: unknown): boolean {
        const clean = String(text ?? '').toUpperCase();
        return clean.length > 0 && /^[A-Z0-9\-. $/+%]+$/.test(clean);
    }

    private static _code39ToModules(text: string, wideRatio = 2): string {
        const clean = String(text).toUpperCase();
        const chars = ['*', ...clean.split(''), '*'];
        let modules = '';
        chars.forEach((c, idx) => {
            const pattern = this.CODE39_CHARS[c] ?? this.CODE39_CHARS['-'];
            for (let i = 0; i < pattern.length; i++) {
                const isBar = i % 2 === 0;
                const width = pattern[i] === 'w' ? wideRatio : 1;
                modules += (isBar ? '1' : '0').repeat(width);
            }
            if (idx < chars.length - 1) modules += '0';
        });
        return modules;
    }

    // ── EAN-13 ────────────────────────────────────────────────────────────────
    static readonly EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
    static readonly EAN_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
    static readonly EAN_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
    static readonly EAN_FIRST = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

    static isValidEan13Text(text: unknown): boolean {
        const digits = String(text ?? '').replace(/\D/g, '');
        return digits.length === 12 || digits.length === 13;
    }

    static ean13CheckDigit(digits12: string): number {
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            const d = parseInt(digits12[i], 10) || 0;
            sum += (i % 2 === 0) ? d : d * 3;
        }
        return (10 - (sum % 10)) % 10;
    }

    private static _ean13ToModules(text: string): { modules: string; digits: string } | null {
        let digits = String(text ?? '').replace(/\D/g, '');
        if (digits.length === 12) {
            digits += String(this.ean13CheckDigit(digits));
        } else if (digits.length === 13) {
            digits = digits.slice(0, 12) + String(this.ean13CheckDigit(digits.slice(0, 12)));
        } else {
            return null;
        }

        const first  = parseInt(digits[0], 10);
        const parity = this.EAN_FIRST[first];
        const left   = digits.slice(1, 7);
        const right  = digits.slice(7, 13);

        let modules = '101';
        for (let i = 0; i < 6; i++) {
            const d = parseInt(left[i], 10);
            modules += (parity[i] === 'L') ? this.EAN_L[d] : this.EAN_G[d];
        }
        modules += '01010';
        for (let i = 0; i < 6; i++) {
            modules += this.EAN_R[parseInt(right[i], 10)];
        }
        modules += '101';

        return { modules, digits };
    }

    // ── SVG rendering ─────────────────────────────────────────────────────────

    static buildSvgString(text: string, options: BarcodeOptions = {}): string {
        const {
            format     = 'code39',
            color      = '#000000',
            background = '#ffffff',
            showText   = true,
            barHeight  = 70,
        } = options;

        let modules     = '';
        let displayText = '';

        if (format === 'ean13') {
            if (!this.isValidEan13Text(text)) return this._errorSvg('EAN-13 precisa de 12 ou 13 dígitos numéricos');
            const enc = this._ean13ToModules(text);
            if (!enc) return this._errorSvg('EAN-13 inválido');
            modules     = enc.modules;
            displayText = enc.digits;
        } else {
            if (!this.isValidCode39Text(text)) return this._errorSvg('Digite um texto válido (letras, números, espaço, - . $ / + %)');
            modules     = this._code39ToModules(text);
            displayText = `*${String(text).toUpperCase()}*`;
        }

        const quiet      = 10;
        const barsWidth  = modules.length;
        const totalWidth = barsWidth + quiet * 2;
        const textHeight = showText ? 16 : 0;
        const totalHeight = barHeight + textHeight;

        let path = '';
        let i = 0;
        while (i < modules.length) {
            if (modules[i] === '1') {
                const start = i;
                while (i < modules.length && modules[i] === '1') i++;
                const w = i - start;
                path += `M${quiet + start},0h${w}v${barHeight}h-${w}z`;
            } else { i++; }
        }

        const bg = (background === 'transparent')
            ? ''
            : `<rect width="${totalWidth}" height="${totalHeight}" fill="${this._escapeAttr(background)}"/>`;

        const textSvg = showText
            ? `<text x="${totalWidth / 2}" y="${barHeight + 12}" text-anchor="middle" ` +
              `font-family="'DM Mono', monospace" font-size="12" letter-spacing="1" ` +
              `fill="${this._escapeAttr(color)}">${this._escXml(displayText)}</text>`
            : '';

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" ` +
            `preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" ` +
            `style="display:block;width:100%;height:100%;">` +
            `${bg}<path d="${path}" fill="${this._escapeAttr(color)}"/>${textSvg}</svg>`;
    }

    static buildSvgElement(text: string, options: BarcodeOptions = {}): SVGElement {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = this.buildSvgString(text, options);
        return wrapper.firstElementChild as SVGElement;
    }

    private static _errorSvg(message: string): string {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 70" ` +
            `style="display:block;width:100%;height:100%;">` +
            `<rect width="320" height="70" fill="#fff5f5" stroke="#ef4444" stroke-width="1"/>` +
            `<text x="160" y="39" text-anchor="middle" font-family="'DM Sans', sans-serif" ` +
            `font-size="11" fill="#ef4444">${this._escXml(message)}</text></svg>`;
    }

    private static _escapeAttr(val: string): string { return String(val).replace(/"/g, '&quot;'); }
    private static _escXml(val: string): string {
        return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
