/**
 * QrCode.ts
 */
// @ts-ignore - Vendor files lack types
import { qrcode } from "../../vendor/qrcode-generator/qrcode.mjs";
// @ts-ignore - Vendor files lack types
import { stringToBytes } from "../../vendor/qrcode-generator/qrcode-utf8.mjs";

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

      const bg = (lightColor === 'transparent')
          ? ''
          : `<rect width="${size}" height="${size}" fill="${this._escapeAttr(lightColor)}"/>`;

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
          `preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" ` +
          `style="display:block;width:100%;height:100%;">` +
          `${bg}<path d="${path}" fill="${this._escapeAttr(darkColor)}"/></svg>`;
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
