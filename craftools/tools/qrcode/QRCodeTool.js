import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { QrCode } from "../../utils/QrCode.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { VariablePanel } from "../../utils/VariablePanel.js";
import { VariableEngine } from "../../utils/VariableEngine.js";
import "./QRCodeTool_Translations.js";

/**
 * QRCodeTool
 * Ferramenta de criação de QR Code vetorial (SVG) para o editor CrafTools.
 * A codificação do QR Code é feita pela lib open-source "qrcode-generator"
 * (vendorizada em craftools/vendor/qrcode-generator/) — este arquivo só monta
 * o conteúdo (texto, Wi-Fi, telefone, e-mail, SMS) e a interface de edição.
 */
export class QRCodeTool extends BaseTool {
    // Legacy renderPropertiesPanel deleted. Panel rendering is now schema-driven in QRCodeTool.ts via PropertyRenderer.

    

    // Legacy renderPropertiesPanel, _bindTypeFields, and _updateWarning deleted.
    // Panel rendering is now schema-driven in QRCodeTool.ts via PropertyRenderer.

    /** Reconstrói o QR Code (ou a imagem do Spotify Code) a partir do estado
     *  atual de `_craftoolsMeta`. */
    static _regenerate(element) {
        const meta = element._craftoolsMeta;
        if (!meta || !element.contentArea) return;

        const bound = meta.variableBinding && meta.variableBinding.type;
        if (bound) {
            VariableEngine.resolvePreview(meta.variableBinding).then(value => {
                this._renderContent(element, meta, value);
            });
            return;
        }
        this._renderContent(element, meta, null);
    }

    /**
     * @param {string|null} boundValue - quando não-nulo (elemento vinculado a
     * uma variável), substitui o payload manual (buildPayload/spotifyInput)
     * pelo valor resolvido da variável (preview no editor; na Exportação de
     * Agenda o valor real por repetição é resolvido por AgendaExport.js).
     */
    static _renderContent(element, meta, boundValue) {
        if (meta.payloadType === 'spotify') {
            this._regenerateSpotify(element, meta, boundValue);
            return;
        }

        // Modo normal (QR local) -- remove qualquer <img> de Spotify Code
        // deixado por uma troca de tipo anterior.
        const oldImg = element.contentArea.querySelector('img[data-spotify-code]');
        if (oldImg) oldImg.remove();

        const payload = boundValue !== null ? boundValue : this.buildPayload(meta);
        const svgString = QrCode.buildSvgString(payload, {
            ecLevel: meta.ecLevel,
            darkColor: meta.darkColor,
            lightColor: meta.lightColor
        });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = svgString;
        const fresh = wrapper.firstElementChild;

        let svg = element.contentArea.querySelector('svg');
        if (svg) {
            // Mantém o mesmo nó <svg> (preserva borda/raio aplicados via CommonProperties)
            svg.setAttribute('viewBox', fresh.getAttribute('viewBox'));
            svg.innerHTML = fresh.innerHTML;
        } else {
            fresh.style.userSelect = 'none';
            fresh.style.pointerEvents = 'none';
            element.contentArea.appendChild(fresh);
        }

        this._triggerChange(element);
    }

    /**
     * Renderiza o Spotify Code como <img>, vindo do serviço oficial
     * scannables.scdn.co (Spotify) -- não é gerado localmente, precisa de
     * internet. Mantém o mesmo <img> entre atualizações para preservar
     * borda/raio aplicados via CommonProperties.
     */
    static _regenerateSpotify(element, meta, boundValue) {
        const oldSvg = element.contentArea.querySelector('svg');
        if (oldSvg) oldSvg.remove();

        const rawInput = boundValue !== null && boundValue !== undefined ? boundValue : meta.spotifyInput;
        const uri = this.buildSpotifyUri(rawInput);
        const url = uri ? this.buildSpotifyCodeUrl(uri, { bg: meta.spotifyBg, barColor: meta.spotifyBarColor }) : '';

        let img = element.contentArea.querySelector('img[data-spotify-code]');
        if (!img) {
            img = document.createElement('img');
            img.dataset.spotifyCode = 'true';
            img.alt = 'Spotify Code';
            img.style.cssText = 'width:100%;height:100%;display:block;user-select:none;pointer-events:none;object-fit:contain;';
            element.contentArea.appendChild(img);
        }

        if (url) {
            img.src = url;
            img.style.opacity = '1';
        } else {
            img.removeAttribute('src');
            img.style.opacity = '0.35';
        }

        this._triggerChange(element);
    }

    /**
     * Converte um link do Spotify (open.spotify.com/..., com ou sem
     * "intl-xx/") ou uma URI "spotify:tipo:id" já pronta no formato canônico
     * "spotify:tipo:id". Retorna '' se não conseguir reconhecer o link/URI.
     */
    static buildSpotifyUri(input) {
        if (!input) return '';
        const raw = String(input).trim();

        // Canonical simple URI: spotify:type:id (alphanumeric + hyphens/underscores)
        if (/^spotify:(track|album|artist|playlist|show|episode|user):[A-Za-z0-9_-]+$/.test(raw)) return raw;

        // Compound user-playlist URI: spotify:user:USERNAME:type:ID
        // → normalize to spotify:type:ID (modern format)
        const compound = raw.match(/^spotify:user:[^:]+:(track|album|playlist|show|episode|artist):([A-Za-z0-9_-]+)$/i);
        if (compound) return `spotify:${compound[1].toLowerCase()}:${compound[2]}`;

        // Any other spotify: URI with colons — pass through (API handles it)
        if (/^spotify:[a-z]+:[A-Za-z0-9:_-]+$/i.test(raw)) return raw;

        // Open Spotify URL: https://open.spotify.com/[intl-xx/]type/ID[?...]
        const m = raw.match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|artist|playlist|show|episode|user)\/([A-Za-z0-9_-]+)/i);
        if (m) return `spotify:${m[1].toLowerCase()}:${m[2]}`;

        return '';
    }

    /**
     * Monta a URL da imagem do Spotify Code no serviço oficial da Spotify
     * (scannables.scdn.co) -- não tem chave de API, é o mesmo endpoint público
     * usado pelo botão "Compartilhar > Código" do próprio app Spotify.
     */
    static buildSpotifyCodeUrl(uri, { bg = '#ffffff', barColor = 'black', size = 640 } = {}) {
        if (!uri) return '';
        const bgClean = encodeURIComponent(String(bg).replace('#', ''));
        const bar = (barColor === 'white') ? 'white' : 'black';
        return `https://scannables.scdn.co/uri/plain/png/${bgClean}/${bar}/${size}/${encodeURIComponent(uri)}`;
    }

    static _triggerChange(element) {
        const event = new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } });
        element.dispatchEvent(event);
    }

    static _esc(val) {
        return String(val == null ? '' : val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** Constrói a string final a ser codificada no QR a partir do tipo de conteúdo. */
    static buildPayload(meta) {
        if (!meta) return '';
        switch (meta.payloadType) {
            case 'wifi': {
                const esc = (s) => String(s || '').replace(/([\\;,:"])/g, '\\$1');
                const sec = meta.wifiSecurity || 'WPA';
                if (sec === 'nopass') return `WIFI:T:nopass;S:${esc(meta.wifiSsid)};;`;
                return `WIFI:T:${sec};S:${esc(meta.wifiSsid)};P:${esc(meta.wifiPassword)};;`;
            }
            case 'telefone':
                return meta.phone ? `tel:${meta.phone.replace(/\s+/g, '')}` : '';
            case 'email': {
                if (!meta.email) return '';
                const params = [];
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
                return this.buildPixPayload(meta);
            case 'spotify':
                // Não é codificado num QR local -- só usado por isLikelyTooLong
                // (sempre curto, então nunca dispara o aviso).
                return meta.spotifyInput || '';
            default:
                return meta.text || '';
        }
    }

    /**
     * Constrói o payload "Pix Copia e Cola" (BR Code estático) seguindo o
     * Manual de Padrões para Iniciação do Pix (BACEN / EMV QR Code Specification).
     * Estrutura TLV: ID(2) + LEN(2) + VALUE, finalizado com CRC16 (ID 63).
     */
    static buildPixPayload(meta) {
        if (!meta || !meta.pixKey || !String(meta.pixKey).trim()) return '';

        const field = (id, value) => `${id}${String(value).length.toString().padStart(2, '0')}${value}`;

        const sanitize = (val, max, fallback = '') => {
            let v = this._stripAccents(String(val || '')).toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
            if (!v) v = fallback;
            return v.slice(0, max);
        };

        const key = String(meta.pixKey).trim();
        const name = sanitize(meta.pixName, 25, 'RECEBEDOR PIX');
        const city = sanitize(meta.pixCity, 15, 'BRASIL');
        const txid = (String(meta.pixTxid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25)) || '***';
        const message = sanitize(meta.pixMessage, 72);

        let payload = '';
        payload += field('00', '01');                                            // Payload Format Indicator
        payload += field('01', '11');                                            // Point of Initiation Method (estático/reutilizável)
        payload += field('26', field('00', 'BR.GOV.BCB.PIX') + field('01', key)); // Merchant Account Information – Pix
        payload += field('52', '0000');                                          // Merchant Category Code
        payload += field('53', '986');                                           // Transaction Currency (BRL)

        const amount = parseFloat(String(meta.pixAmount || '').replace(',', '.'));
        if (!isNaN(amount) && amount > 0) {
            payload += field('54', amount.toFixed(2));                           // Transaction Amount (opcional)
        }

        payload += field('58', 'BR');                                            // Country Code
        payload += field('59', name);                                            // Merchant Name
        payload += field('60', city);                                            // Merchant City

        let addData = field('05', txid);                                         // Reference Label (TXID)
        if (message) addData = field('02', message) + addData;                   // Mensagem ao pagador (opcional)
        payload += field('62', addData);                                         // Additional Data Field Template

        payload += '6304';                                                       // ID+LEN do CRC (sempre fixo "6304")
        payload += this._crc16(payload);                                         // CRC16-CCITT-FALSE dos dados acima

        return payload;
    }

    /** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, sem XOR final) — usado no campo 63 do Pix. */
    static _crc16(str) {
        let crc = 0xFFFF;
        for (let i = 0; i < str.length; i++) {
            crc ^= (str.charCodeAt(i) << 8) & 0xFFFF;
            for (let j = 0; j < 8; j++) {
                crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
            }
        }
        return crc.toString(16).toUpperCase().padStart(4, '0');
    }

    /** Remove acentos/diacríticos (ex.: "São Paulo" -> "Sao Paulo") para campos ASCII do Pix. */
    static _stripAccents(str) {
        const diacritics = new RegExp(String.fromCharCode(92) + 'u0300-' + String.fromCharCode(92) + 'u036f', 'g');
        return String(str || '').normalize('NFD').replace(diacritics, '');
    }

    static getCtxOptions() {
        return [];
    }

    static getDefaultMeta() {
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
            variableBinding: null
        };
    }

    static createElement(type, editorApp) {
        const el = document.createElement('craftools-element');
        el.setAttribute('x', '50');
        el.setAttribute('y', '50');
        el.setAttribute('w', '180');
        el.setAttribute('h', '180');
        el.setAttribute('data-craftool', 'qrcode');

        el._craftoolsMeta = this.getDefaultMeta();

        const svg = QrCode.buildSvgElement(this.buildPayload(el._craftoolsMeta), {
            ecLevel: el._craftoolsMeta.ecLevel,
            darkColor: el._craftoolsMeta.darkColor,
            lightColor: el._craftoolsMeta.lightColor
        });
        svg.style.userSelect = 'none';
        svg.style.pointerEvents = 'none';

        el.appendChild(svg);

        return el;
    }
}
