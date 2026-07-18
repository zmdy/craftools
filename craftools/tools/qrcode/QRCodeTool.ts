import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { borderSection, radiusSection, variableBindingSection } from '../../utils/CommonSchema';
import { parseVariableBinding, stringifyVariableBinding } from '../../utils/fields/variable-binding.field';
import { QrCode, type EcLevel } from '../../utils/QrCode';
import type { VariableBinding } from '../../utils/VariableEngine';
import type { PropertySchema } from '../../types/PropertySchema';

/**
 * QRCodeTool
 * QR/Barcode-style vector code element. Encoding is done by the vendored
 * "qrcode-generator" lib (see utils/QrCode.ts); this file builds the payload
 * (text / Wi-Fi / phone / e-mail / SMS / PIX / Spotify) and the SVG (or, for
 * Spotify, an <img> pointed at Spotify's public scannables.scdn.co service).
 */

interface QRCodeMeta {
  payloadType:     string;
  text:            string;
  wifiSsid:        string;
  wifiPassword:    string;
  wifiSecurity:    string;
  phone:           string;
  email:           string;
  emailSubject:    string;
  emailBody:       string;
  smsPhone:        string;
  smsBody:         string;
  pixKey:          string;
  pixName:         string;
  pixCity:         string;
  pixAmount:       string;
  pixTxid:         string;
  pixMessage:      string;
  spotifyInput:    string;
  spotifyBg:       string;
  spotifyBarColor: string;
  ecLevel:         string;
  darkColor:       string;
  lightColor:      string;
  borderWidth:     number;
  borderStyle:     string;
  borderColor:     string;
  borderRadius:    number;
  variableBinding: VariableBinding | null;
}

const getMeta = (el: HTMLElement): QRCodeMeta =>
  (el as HTMLElement & { _craftoolsMeta?: QRCodeMeta })._craftoolsMeta ?? {
    payloadType: 'texto', text: '',
    wifiSsid: '', wifiPassword: '', wifiSecurity: 'WPA',
    phone: '',
    email: '', emailSubject: '', emailBody: '',
    smsPhone: '', smsBody: '',
    pixKey: '', pixName: '', pixCity: '', pixAmount: '', pixTxid: '', pixMessage: '',
    spotifyInput: '', spotifyBg: '#ffffff', spotifyBarColor: 'black',
    ecLevel: 'M', darkColor: '#000000', lightColor: '#ffffff',
    borderWidth: 0, borderStyle: 'none', borderColor: '#000000', borderRadius: 0,
    variableBinding: null,
  };

const setMeta = (el: HTMLElement, patch: Partial<QRCodeMeta>): void => {
  const e = el as HTMLElement & { _craftoolsMeta?: QRCodeMeta };
  e._craftoolsMeta = { ...getMeta(el), ...patch };
};

export class QRCodeTool extends BaseTool {

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element) as unknown as Record<string, unknown>;
    const existing = PropertyRenderer._readState(element);
    const patch: Record<string, unknown> = {};
    const keys = [
      'payloadType','text','wifiSsid','wifiPassword','wifiSecurity',
      'phone','email','emailSubject','emailBody','smsPhone','smsBody',
      'pixKey','pixName','pixCity','pixAmount','pixTxid','pixMessage',
      'spotifyInput','spotifyBg','spotifyBarColor',
      'ecLevel','darkColor','lightColor','borderWidth','borderStyle','borderColor','borderRadius',
    ];
    keys.forEach(k => { if (!(k in existing) && meta[k] !== undefined) patch[k] = meta[k]; });
    // variableBinding is stored as a JSON *string* in ctState (see
    // variable-binding.field.ts for why), unlike every other key above which
    // is copied as-is -- meta.variableBinding itself stays a real object.
    if (!('variableBinding' in existing)) {
      patch.variableBinding = stringifyVariableBinding(meta.variableBinding as VariableBinding | null);
    }
    if (Object.keys(patch).length)
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
  }

  /**
   * Default meta object for a freshly-created QR element. Recovered from
   * the pre-migration QRCodeTool.js (deleted by the "Purge legacy JS"
   * commit) -- the schema-driven file kept only a truncated stub missing
   * most payload-type fields (wifi/phone/email/sms/pix/spotify/border).
   */
  public static getDefaultMeta(): QRCodeMeta {
    return {
      payloadType: 'texto',
      text: '',
      wifiSsid: '',
      wifiPassword: '',
      wifiSecurity: 'WPA',
      phone: '',
      email: '',
      emailSubject: '',
      emailBody: '',
      smsPhone: '',
      smsBody: '',
      pixKey: '',
      pixName: '',
      pixCity: '',
      pixAmount: '',
      pixTxid: '',
      pixMessage: '',
      spotifyInput: '',
      spotifyBg: '#ffffff',
      spotifyBarColor: 'black',
      ecLevel: 'M',
      darkColor: '#000000',
      lightColor: '#ffffff',
      borderWidth: 0,
      borderStyle: 'none',
      borderColor: '#000000',
      borderRadius: 0,
      variableBinding: null,
    };
  }

  // Adapters for MobileToolbar (per-type extra fields not covered by the
  // shared "Payload" desktop panel above).
  public static _renderTypeFields(_meta: Record<string, unknown>): string { return ''; }
  public static _bindTypeFields(_container: HTMLElement, _el: HTMLElement, _meta: Record<string, unknown>): void {}

  /**
   * Reconstructs the QR code (or the Spotify Code image) from the element's
   * current _craftoolsMeta. Called directly after every property edit
   * (desktop schema panel's _applyProperty() below, and MobileToolbar.ts's
   * mini-panels) -- previously this only re-set meta and dispatched a
   * 'craftools-qr-regenerate' custom event that nothing listened for, so
   * edits from the desktop panel silently never touched the rendered SVG.
   */
  public static _regenerate(element: HTMLElement): void {
    const meta = getMeta(element);
    const binding = meta.variableBinding;
    if (binding && binding.type) {
      import('../../utils/VariableEngine.js').then(({ VariableEngine }) => {
        VariableEngine.resolvePreview(binding).then(value => {
          QRCodeTool._renderContent(element, meta, value);
        });
      });
      return;
    }
    QRCodeTool._renderContent(element, meta, null);
  }

  /**
   * boundValue: when non-null (element bound to a variable), replaces the
   * manual payload (buildPayload/spotifyInput) with the resolved variable
   * value (editor preview only; real per-repetition values for Agenda
   * export are resolved by AgendaExport.ts).
   */
  private static _renderContent(element: HTMLElement, meta: QRCodeMeta, boundValue: string | null): void {
    if (meta.payloadType === 'spotify') {
      QRCodeTool._regenerateSpotify(element, meta, boundValue);
      return;
    }

    const oldImg = element.querySelector<HTMLImageElement>('img[data-spotify-code]');
    if (oldImg) oldImg.remove();

    const payload = boundValue !== null ? boundValue : QRCodeTool.buildPayload(meta);
    const svgString = QrCode.buildSvgString(payload, {
      ecLevel: meta.ecLevel as EcLevel,
      darkColor: meta.darkColor,
      lightColor: meta.lightColor,
    });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = svgString;
    const fresh = wrapper.firstElementChild as SVGElement;

    const svg = element.querySelector<SVGElement>('svg');
    if (svg) {
      svg.setAttribute('viewBox', fresh.getAttribute('viewBox') ?? '');
      svg.innerHTML = fresh.innerHTML;
    } else {
      fresh.style.userSelect = 'none';
      fresh.style.pointerEvents = 'none';
      element.appendChild(fresh);
    }

    QRCodeTool._triggerChange(element);
  }

  /**
   * Renders the Spotify Code as an img, from Spotify's public
   * scannables.scdn.co service (not generated locally, needs internet).
   * Keeps the same img between updates to preserve border/radius applied
   * via CommonSchema.
   */
  private static _regenerateSpotify(element: HTMLElement, meta: QRCodeMeta, boundValue: string | null): void {
    const oldSvg = element.querySelector('svg');
    if (oldSvg) oldSvg.remove();

    const rawInput = (boundValue !== null && boundValue !== undefined) ? boundValue : meta.spotifyInput;
    const uri = QRCodeTool.buildSpotifyUri(rawInput);
    const url = uri ? QRCodeTool.buildSpotifyCodeUrl(uri, { bg: meta.spotifyBg, barColor: meta.spotifyBarColor }) : '';

    let img = element.querySelector<HTMLImageElement>('img[data-spotify-code]');
    if (!img) {
      img = document.createElement('img');
      img.dataset.spotifyCode = 'true';
      img.alt = 'Spotify Code';
      img.style.cssText = 'width:100%;height:100%;display:block;user-select:none;pointer-events:none;object-fit:contain;';
      element.appendChild(img);
    }

    if (url) {
      img.src = url;
      img.style.opacity = '1';
    } else {
      img.removeAttribute('src');
      img.style.opacity = '0.35';
    }

    QRCodeTool._triggerChange(element);
  }

  /**
   * Converts a Spotify link (open.spotify.com/..., with or without
   * intl-xx/) or an already-canonical spotify:type:id URI into the
   * canonical form. Returns '' if the link/URI isn't recognized.
   */
  public static buildSpotifyUri(input: unknown): string {
    if (!input) return '';
    const raw = String(input).trim();

    if (/^spotify:(track|album|artist|playlist|show|episode|user):[A-Za-z0-9_-]+$/.test(raw)) return raw;

    const compound = raw.match(/^spotify:user:[^:]+:(track|album|playlist|show|episode|artist):([A-Za-z0-9_-]+)$/i);
    if (compound) return `spotify:${compound[1].toLowerCase()}:${compound[2]}`;

    if (/^spotify:[a-z]+:[A-Za-z0-9:_-]+$/i.test(raw)) return raw;

    const m = raw.match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|artist|playlist|show|episode|user)\/([A-Za-z0-9_-]+)/i);
    if (m) return `spotify:${m[1].toLowerCase()}:${m[2]}`;

    return '';
  }

  /**
   * Builds the Spotify Code image URL from the official scannables.scdn.co
   * service (no API key needed, it is the same public endpoint used by the
   * Spotify app's own Share > Code button).
   */
  public static buildSpotifyCodeUrl(
    uri: string,
    options: { bg?: string; barColor?: string; size?: number } = {},
  ): string {
    if (!uri) return '';
    const { bg = '#ffffff', barColor = 'black', size = 640 } = options;
    const bgClean = encodeURIComponent(String(bg).replace('#', ''));
    const bar = (barColor === 'white') ? 'white' : 'black';
    return `https://scannables.scdn.co/uri/plain/png/${bgClean}/${bar}/${size}/${encodeURIComponent(uri)}`;
  }

  private static _triggerChange(element: HTMLElement): void {
    element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
  }

  /** Builds the final string to encode in the QR from the payload type. */
  public static buildPayload(meta: QRCodeMeta | null | undefined): string {
    if (!meta) return '';
    switch (meta.payloadType) {
      case 'wifi': {
        const esc = (s: string) => String(s || '').replace(/([\\;,:"])/g, '\\$1');
        const sec = meta.wifiSecurity || 'WPA';
        if (sec === 'nopass') return `WIFI:T:nopass;S:${esc(meta.wifiSsid)};;`;
        return `WIFI:T:${sec};S:${esc(meta.wifiSsid)};P:${esc(meta.wifiPassword)};;`;
      }
      case 'telefone':
        return meta.phone ? `tel:${meta.phone.replace(/\s+/g, '')}` : '';
      case 'email': {
        if (!meta.email) return '';
        const params: string[] = [];
        if (meta.emailSubject) params.push('subject=' + encodeURIComponent(meta.emailSubject));
        if (meta.emailBody) params.push('body=' + encodeURIComponent(meta.emailBody));
        const qs = params.length ? '?' + params.join('&') : '';
        return `mailto:${meta.email}${qs}`;
      }
      case 'sms': {
        if (!meta.smsPhone) return '';
        const body = meta.smsBody ? `?body=${encodeURIComponent(meta.smsBody)}` : '';
        return `sms:${meta.smsPhone.replace(/\s+/g, '')}${body}`;
      }
      case 'pix':
        return QRCodeTool.buildPixPayload(meta);
      case 'spotify':
        return meta.spotifyInput || '';
      default:
        return meta.text || '';
    }
  }

  /**
   * Builds the Pix "Copia e Cola" payload (static BR Code) per the Manual
   * de Padroes para Iniciacao do Pix (BACEN / EMV QR Code Specification).
   * TLV structure: ID(2) + LEN(2) + VALUE, terminated by a CRC16 (field 63).
   */
  public static buildPixPayload(meta: QRCodeMeta | null | undefined): string {
    if (!meta || !meta.pixKey || !String(meta.pixKey).trim()) return '';

    const field = (id: string, value: string | number): string =>
      `${id}${String(value).length.toString().padStart(2, '0')}${value}`;

    const sanitize = (val: unknown, max: number, fallback = ''): string => {
      let v = QRCodeTool._stripAccents(String(val || '')).toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
      if (!v) v = fallback;
      return v.slice(0, max);
    };

    const key = String(meta.pixKey).trim();
    const name = sanitize(meta.pixName, 25, 'RECEBEDOR PIX');
    const city = sanitize(meta.pixCity, 15, 'BRASIL');
    const txid = (String(meta.pixTxid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25)) || '***';
    const message = sanitize(meta.pixMessage, 72);

    let payload = '';
    payload += field('00', '01');
    payload += field('01', '11');
    payload += field('26', field('00', 'BR.GOV.BCB.PIX') + field('01', key));
    payload += field('52', '0000');
    payload += field('53', '986');

    const amount = parseFloat(String(meta.pixAmount || '').replace(',', '.'));
    if (!isNaN(amount) && amount > 0) {
      payload += field('54', amount.toFixed(2));
    }

    payload += field('58', 'BR');
    payload += field('59', name);
    payload += field('60', city);

    let addData = field('05', txid);
    if (message) addData = field('02', message) + addData;
    payload += field('62', addData);

    payload += '6304';
    payload += QRCodeTool._crc16(payload);

    return payload;
  }

  /** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no final XOR) -- used in Pix field 63. */
  private static _crc16(str: string): string {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
      crc ^= (str.charCodeAt(i) << 8) & 0xFFFF;
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /** Strips accents/diacritics (e.g. Sao Paulo) for Pix's ASCII-only fields. */
  private static _stripAccents(str: string): string {
    return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /**
   * Builds a fresh craftools-element (data-craftool="qrcode") with a real
   * QR SVG inside. Recovered from the pre-migration QRCodeTool.js (deleted
   * by the "Purge legacy JS" commit without this logic being ported) -- the
   * previous createElement() here was a broken stub that called itself
   * (new this().createElement(), but createElement was never an instance
   * method), throwing "createElement is not a function" for every QR
   * element creation.
   */
  public static createElement(_type: string, _editor?: unknown): HTMLElement {
    const el = document.createElement('craftools-element') as HTMLElement & { _craftoolsMeta?: QRCodeMeta };
    el.setAttribute('x', '50');
    el.setAttribute('y', '50');
    el.setAttribute('w', '180');
    el.setAttribute('h', '180');
    el.setAttribute('data-craftool', 'qrcode');

    el._craftoolsMeta = QRCodeTool.getDefaultMeta();

    const svg = QrCode.buildSvgElement(QRCodeTool.buildPayload(el._craftoolsMeta), {
      ecLevel: el._craftoolsMeta.ecLevel as EcLevel,
      darkColor: el._craftoolsMeta.darkColor,
      lightColor: el._craftoolsMeta.lightColor,
    });
    svg.style.userSelect = 'none';
    svg.style.pointerEvents = 'none';

    el.appendChild(svg);

    return el;
  }

  static getPropertySchema(element: HTMLElement): PropertySchema {
    const state = PropertyRenderer._readState(element);
    const pt = String(state.payloadType ?? 'texto');

    const isText    = pt === 'texto';
    const isUrl     = pt === 'url';
    const isWifi    = pt === 'wifi';
    const isPhone   = pt === 'telefone';
    const isEmail   = pt === 'email';
    const isSms     = pt === 'sms';
    const isPix     = pt === 'pix';
    const isSpotify = pt === 'spotify';

    return [
      {
        section: 'Payload',
        icon: 'edit_note',
        defaultOpen: true,
        fields: [
          {
            type: 'select', key: 'payloadType', label: 'Type',
            options: [
              { value: 'texto',    label: 'Text' },
              { value: 'url',      label: 'URL' },
              { value: 'wifi',     label: 'Wi-Fi' },
              { value: 'telefone', label: 'Phone' },
              { value: 'email',    label: 'E-mail' },
              { value: 'sms',      label: 'SMS' },
              { value: 'pix',      label: 'PIX' },
              { value: 'spotify',  label: 'Spotify' },
            ],
          },
          { type: 'text', key: 'text',  label: 'Text',  hidden: !(isText || isUrl) },
          { type: 'text', key: 'wifiSsid',     label: 'Network name', hidden: !isWifi },
          { type: 'text', key: 'wifiPassword',  label: 'Password',     hidden: !isWifi },
          { type: 'select', key: 'wifiSecurity', label: 'Security',    hidden: !isWifi,
            options: [{ value: 'WPA', label: 'WPA/WPA2' }, { value: 'WEP', label: 'WEP' }, { value: '', label: 'None' }] },
          { type: 'text', key: 'phone', label: 'Phone number', hidden: !isPhone },
          { type: 'text', key: 'email',        label: 'E-mail',  hidden: !isEmail },
          { type: 'text', key: 'emailSubject',  label: 'Subject', hidden: !isEmail },
          { type: 'text', key: 'emailBody',     label: 'Body',    hidden: !isEmail },
          { type: 'text', key: 'smsPhone', label: 'Phone',   hidden: !isSms },
          { type: 'text', key: 'smsBody',  label: 'Message', hidden: !isSms },
          { type: 'text', key: 'pixKey',     label: 'PIX key',     hidden: !isPix },
          { type: 'text', key: 'pixName',    label: 'Recipient',   hidden: !isPix },
          { type: 'text', key: 'pixCity',    label: 'City',        hidden: !isPix },
          { type: 'text', key: 'pixAmount',  label: 'Amount',      hidden: !isPix },
          { type: 'text', key: 'pixTxid',    label: 'Transaction', hidden: !isPix },
          { type: 'text', key: 'pixMessage', label: 'Description', hidden: !isPix },
          { type: 'text',  key: 'spotifyInput', label: 'Spotify URL / URI', hidden: !isSpotify },
          { type: 'color', key: 'spotifyBg',    label: 'Background color',  hidden: !isSpotify },
          { type: 'select', key: 'spotifyBarColor', label: 'Code color', i18nKey: 'qrTool.spotifyBarColor', hidden: !isSpotify,
            options: [
              { value: 'black', label: 'Black' },
              { value: 'white', label: 'White' },
            ] },
        ].filter(f => !f.hidden),
      },
      {
        section: 'Appearance',
        icon: 'palette',
        fields: [
          { type: 'color', key: 'darkColor',  label: 'QR color' },
          { type: 'color', key: 'lightColor', label: 'Background' },
          { type: 'select', key: 'ecLevel', label: 'Error correction',
            options: [
              { value: 'L', label: 'L (7%)' }, { value: 'M', label: 'M (15%)' },
              { value: 'Q', label: 'Q (25%)' }, { value: 'H', label: 'H (30%)' },
            ],
          },
        ],
      },
      borderSection(),
      radiusSection(),
      variableBindingSection(),
    ] as PropertySchema;
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    if (key === 'variableBinding') {
      setMeta(element, { variableBinding: parseVariableBinding(value) });
    } else {
      setMeta(element, { [key]: value } as Partial<QRCodeMeta>);
    }
    QRCodeTool._regenerate(element);
  }
}

QRCodeTool.registeredKeys = ['qrcode'];
// label matches the desktop sidebar (index.html #pwa-sidebar-qrcode) --
// 'editor.qrCode' (capital C) isn't a registered key, only 'editor.qrcode' is.
ToolRegistry.register({ key: 'qrcode', label: 'editor.qrcode', icon: 'qr_code_2', tool: QRCodeTool, draggable: true, showInFooterNav: false, category: 'elements' });
