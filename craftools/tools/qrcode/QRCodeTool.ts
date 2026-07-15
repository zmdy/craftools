import { BaseTool } from '../BaseTool';
import { ToolRegistry } from '../../utils/ToolRegistry';
import { PropertyRenderer } from '../../utils/PropertyRenderer';
import { borderSection, radiusSection } from '../../utils/CommonSchema';
import type { PropertySchema } from '../../types/PropertySchema';

const getMeta = (el: HTMLElement) =>
  (el as HTMLElement & { _craftoolsMeta?: Record<string, unknown> })._craftoolsMeta ?? {};

const setMeta = (el: HTMLElement, patch: Record<string, unknown>) => {
  const e = el as HTMLElement & { _craftoolsMeta?: Record<string, unknown> };
  e._craftoolsMeta = { ...getMeta(el), ...patch };
};

export class QRCodeTool extends BaseTool {

  protected static _syncFromDOM(element: HTMLElement): void {
    const meta = getMeta(element);
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
    if (Object.keys(patch).length)
      element.dataset.ctState = JSON.stringify({ ...existing, ...patch });
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
          // text / url
          { type: 'text', key: 'text',  label: 'Text',  hidden: !(isText || isUrl) },
          // wifi
          { type: 'text', key: 'wifiSsid',     label: 'Network name', hidden: !isWifi },
          { type: 'text', key: 'wifiPassword',  label: 'Password',     hidden: !isWifi },
          { type: 'select', key: 'wifiSecurity', label: 'Security',    hidden: !isWifi,
            options: [{ value: 'WPA', label: 'WPA/WPA2' }, { value: 'WEP', label: 'WEP' }, { value: '', label: 'None' }] },
          // phone
          { type: 'text', key: 'phone', label: 'Phone number', hidden: !isPhone },
          // email
          { type: 'text', key: 'email',        label: 'E-mail',  hidden: !isEmail },
          { type: 'text', key: 'emailSubject',  label: 'Subject', hidden: !isEmail },
          { type: 'text', key: 'emailBody',     label: 'Body',    hidden: !isEmail },
          // sms
          { type: 'text', key: 'smsPhone', label: 'Phone',   hidden: !isSms },
          { type: 'text', key: 'smsBody',  label: 'Message', hidden: !isSms },
          // pix
          { type: 'text', key: 'pixKey',     label: 'PIX key',     hidden: !isPix },
          { type: 'text', key: 'pixName',    label: 'Recipient',   hidden: !isPix },
          { type: 'text', key: 'pixCity',    label: 'City',        hidden: !isPix },
          { type: 'text', key: 'pixAmount',  label: 'Amount',      hidden: !isPix },
          { type: 'text', key: 'pixTxid',    label: 'Transaction', hidden: !isPix },
          { type: 'text', key: 'pixMessage', label: 'Description', hidden: !isPix },
          // spotify
          { type: 'text',  key: 'spotifyInput', label: 'Spotify URL / URI', hidden: !isSpotify },
          { type: 'color', key: 'spotifyBg',    label: 'Background color',  hidden: !isSpotify },
        ].filter(f => !f.hidden),
      },
      {
        section: 'Appearance',
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
    ];
  }

  protected static _applyProperty(element: HTMLElement, key: string, value: unknown): void {
    PropertyRenderer.applyChange(element, key, value);
    setMeta(element, { [key]: value });
    element.dispatchEvent(new CustomEvent('craftools-qr-regenerate', { bubbles: false }));
  }
}

QRCodeTool.registeredKeys = ['qrcode'];
ToolRegistry.register({ key: 'qrcode', label: 'editor.qrCode', icon: 'qr_code_2', tool: QRCodeTool, draggable: true, showInFooterNav: false, category: 'elements' });
