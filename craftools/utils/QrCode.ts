/**
 * QrCode.ts
 */
// @ts-ignore - Vendor files lack types
import { qrcode } from "../../vendor/qrcode-generator/qrcode.mjs";
// @ts-ignore - Vendor files lack types
import { stringToBytes } from "../../vendor/qrcode-generator/qrcode-utf8.mjs";
import { normalizeValue, svgPaintFromValue } from './ColorPickerUI.js';

qrcode.stringToBytes = stringToBytes;

export type EcLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrCodeOptions {
  ecLevel?:    EcLevel;
  darkColor?:  string;
  lightColor?: string;
  margin?:     number;
}

export class QrCode {
  static EC_LEVELS: EcLevel[] = ['L', 'M', 'Q', 'H'];

  static buildSvgString(text: string, options: QrCodeOptions = {}): string {
      const {
          ecLevel = 'M',
          darkColor = '#000000',
          lightColor = '#ffffff',
          margin = 4,
      } = options;

      const safeText = (text && String(text).length) ? String(text) : ' ';
      const level = this.EC_LEVELS.includes(ecLevel as EcLevel) ? ecLevel : 'M';

      const qr = qrcode(0, level);
      qr.addData(safeText);
      qr.make();

      const n = qr.getModuleCount();
      const size = n + margin * 2;

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

      // darkColor/lightColor hold whatever the standardized color-picker
      // field reports: a bare hex string (legacy value / default meta) or a
      // JSON ColorPickerValue string when the user has picked a gradient --
      // same technique as BarcodeGenerator.ts. 'transparent' was never
      // actually reachable from the panel (the color field's swatch
      // palette/native picker can't produce it), so always drawing the bg
      // rect (fill="transparent" renders identically to omitting it) is a
      // safe simplification.
      const bgPaint   = svgPaintFromValue(normalizeValue(lightColor), 'qr-bg');
      const darkPaint = svgPaintFromValue(normalizeValue(darkColor), 'qr-fg');
      const bg = `<rect width="${size}" height="${size}" fill="${this._escapeAttr(bgPaint.paint)}"/>`;
      const defs = bgPaint.defs + darkPaint.defs;

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
          `preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" ` +
          `style="display:block;width:100%;height:100%;">` +
          `${defs ? `<defs>${defs}</defs>` : ''}${bg}<path d="${path}" fill="${this._escapeAttr(darkPaint.paint)}"/></svg>`;
  }

  static buildSvgElement(text: string, options: QrCodeOptions = {}): SVGElement {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = this.buildSvgString(text, options);
      return wrapper.firstElementChild as SVGElement;
  }

  static isLikelyTooLong(text: string): boolean {
      return (text ? String(text).length : 0) > 1800;
  }

  static _escapeAttr(val: any): string {
      return String(val).replace(/"/g, '&quot;');
  }
}
