import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { QrCode } from "../../utils/QrCode.js";
import { PanelUI } from "../../utils/PanelUI.js";
import "./QRCodeTool_Translations.js";

/**
 * QRCodeTool
 * Ferramenta de criação de QR Code vetorial (SVG) para o editor CrafTools.
 * A codificação do QR Code é feita pela lib open-source "qrcode-generator"
 * (vendorizada em craftools/vendor/qrcode-generator/) — este arquivo só monta
 * o conteúdo (texto, Wi-Fi, telefone, e-mail, SMS) e a interface de edição.
 */
export class QRCodeTool extends BaseTool {

    static renderPropertiesPanel(editorPanel, element) {
        const meta = element._craftoolsMeta || this.getDefaultMeta();
        if (!element._craftoolsMeta) element._craftoolsMeta = meta;

        if (element.contentArea) {
            element.contentArea.style.pointerEvents = 'auto';
            element.contentArea.style.cursor = 'move';
        }

        const isSpotify = meta.payloadType === 'spotify';
        const tooLong = !isSpotify && QrCode.isLikelyTooLong(this.buildPayload(meta));

        const htmlConteudo = `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('qrTool.contentType')}</span>
                <select id="qr-type" class="craftools-select" style="width:100%;">
                    <option value="texto" ${meta.payloadType === 'texto' ? 'selected' : ''}>${I18n.t('qrTool.typeText')}</option>
                    <option value="wifi" ${meta.payloadType === 'wifi' ? 'selected' : ''}>${I18n.t('qrTool.typeWifi')}</option>
                    <option value="telefone" ${meta.payloadType === 'telefone' ? 'selected' : ''}>${I18n.t('qrTool.typePhone')}</option>
                    <option value="email" ${meta.payloadType === 'email' ? 'selected' : ''}>${I18n.t('qrTool.typeEmail')}</option>
                    <option value="sms" ${meta.payloadType === 'sms' ? 'selected' : ''}>${I18n.t('qrTool.typeSms')}</option>
                    <option value="pix" ${meta.payloadType === 'pix' ? 'selected' : ''}>${I18n.t('qrTool.typePix')}</option>
                    <option value="spotify" ${meta.payloadType === 'spotify' ? 'selected' : ''}>${I18n.t('qrTool.typeSpotify')}</option>
                </select>
            </div>

            <div id="qr-fields-container" style="display:flex; flex-direction:column; gap:10px;">
                ${this._renderTypeFields(meta)}
            </div>

            <div id="qr-too-long-warning" style="display:${(!isSpotify && tooLong) ? 'flex' : 'none'}; gap:6px; align-items:flex-start; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:8px; font-size:11px; color:#ef4444;">
                <span class="material-symbols-outlined" style="font-size:14px;">warning</span>
                <span>${I18n.t('qrTool.tooLongWarning')}</span>
            </div>
        `;

        // Spotify Code é uma imagem vinda do serviço oficial da Spotify
        // (scannables.scdn.co) -- não tem nível de correção de erro (não é um
        // QR), e só aceita cor de barra preta/branca (limitação da própria
        // API deles), por isso o painel de Aparência é bem diferente nesse modo.
        const htmlAparencia = isSpotify ? `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('qrTool.spotifyBarColor')}</span>
                <div class="ct-field-row">
                    <button type="button" id="qr-spotify-bar-black" class="craftools-pill ${meta.spotifyBarColor !== 'white' ? 'active' : ''}" style="flex:1; justify-content:center;">${I18n.t('qrTool.spotifyBarBlack')}</button>
                    <button type="button" id="qr-spotify-bar-white" class="craftools-pill ${meta.spotifyBarColor === 'white' ? 'active' : ''}" style="flex:1; justify-content:center;">${I18n.t('qrTool.spotifyBarWhite')}</button>
                </div>
            </div>
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('qrTool.spotifyBgColor')}</span>
                <input type="color" id="qr-spotify-bg" class="craftools-color-swatch" value="${meta.spotifyBg}" style="width:100%;">
            </div>
        ` : `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('qrTool.ecLevel')}</span>
                <select id="qr-ec-level" class="craftools-select" style="width:100%;">
                    <option value="L" ${meta.ecLevel === 'L' ? 'selected' : ''}>${I18n.t('qrTool.ecLevelL')}</option>
                    <option value="M" ${meta.ecLevel === 'M' ? 'selected' : ''}>${I18n.t('qrTool.ecLevelM')}</option>
                    <option value="Q" ${meta.ecLevel === 'Q' ? 'selected' : ''}>${I18n.t('qrTool.ecLevelQ')}</option>
                    <option value="H" ${meta.ecLevel === 'H' ? 'selected' : ''}>${I18n.t('qrTool.ecLevelH')}</option>
                </select>
                <span style="font-size:10px; color: var(--text-muted); display:block; margin-top:4px;">${I18n.t('qrTool.ecLevelHelp')}</span>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('qrTool.colorDark')}</span>
                    <input type="color" id="qr-color-dark" class="craftools-color-swatch" value="${meta.darkColor}" style="width:100%;">
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('qrTool.colorLight')}</span>
                    <input type="color" id="qr-color-light" class="craftools-color-swatch" value="${meta.lightColor === 'transparent' ? '#ffffff' : meta.lightColor}" style="width:100%;" ${meta.lightColor === 'transparent' ? 'disabled' : ''}>
                </div>
            </div>
            <label class="ct-field" style="flex-direction:row; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="qr-bg-transparent" ${meta.lightColor === 'transparent' ? 'checked' : ''}>
                <span class="craftools-label" style="margin:0;">${I18n.t('qrTool.transparentBg')}</span>
            </label>
        `;

        editorPanel.innerHTML = 
            PanelUI.accordion('qr-conteudo', 'qr_code', I18n.t('qrTool.content') || 'Conteúdo', htmlConteudo, { open: true }) +
            PanelUI.accordion('qr-aparencia', 'palette', I18n.t('qrTool.appearance') || 'Aparência', htmlAparencia);

        // Render Common Properties (Inherited from BaseTool now handles it all)
        // Spotify Code renderiza como <img>, os demais tipos como <svg> -- o
        // seletor de borda/raio/padding/margem precisa acompanhar qual dos
        // dois está de fato no DOM em cada modo.
        const visualSelector = isSpotify ? 'img' : 'svg';
        this.renderCommonProperties(editorPanel, element, {
            border: visualSelector,
            radius: visualSelector,
            padding: visualSelector,
            margin: visualSelector,
            zindex: true,
            onChange: () => {
                const visual = element.contentArea.querySelector(visualSelector);
                if (visual) {
                    meta.borderWidth = parseFloat(visual.style.borderWidth) || 0;
                    meta.borderStyle = visual.style.borderStyle || 'none';
                    meta.borderColor = visual.style.borderColor || '#000000';
                    meta.borderRadius = visual.style.borderRadius || '0px';
                }
            }
        });

        // --- Bindings ---
        const typeSelect = editorPanel.querySelector('#qr-type');
        typeSelect.onchange = () => {
            meta.payloadType = typeSelect.value;
            this.renderPropertiesPanel(editorPanel, element);
            this._regenerate(element);
        };

        this._bindTypeFields(editorPanel, element, meta);

        // Os campos abaixo só existem no DOM quando NÃO é Spotify Code (ver
        // htmlAparencia acima) -- os bindings do modo Spotify ficam no bloco
        // isSpotify logo em seguida.
        const ecSelect = editorPanel.querySelector('#qr-ec-level');
        if (ecSelect) ecSelect.onchange = () => {
            meta.ecLevel = ecSelect.value;
            this._regenerate(element);
        };

        const colorDark = editorPanel.querySelector('#qr-color-dark');
        if (colorDark) colorDark.oninput = () => {
            meta.darkColor = colorDark.value;
            this._regenerate(element);
        };

        const colorLight = editorPanel.querySelector('#qr-color-light');
        if (colorLight) colorLight.oninput = () => {
            meta.lightColor = colorLight.value;
            this._regenerate(element);
        };

        const bgTransparent = editorPanel.querySelector('#qr-bg-transparent');
        if (bgTransparent) bgTransparent.onchange = () => {
            if (bgTransparent.checked) {
                meta.lightColor = 'transparent';
                colorLight.disabled = true;
            } else {
                meta.lightColor = colorLight.value || '#ffffff';
                colorLight.disabled = false;
            }
            this._regenerate(element);
        };

        if (isSpotify) {
            const barBlackBtn = editorPanel.querySelector('#qr-spotify-bar-black');
            const barWhiteBtn = editorPanel.querySelector('#qr-spotify-bar-white');
            const setBarColor = (color) => {
                meta.spotifyBarColor = color;
                barBlackBtn?.classList.toggle('active', color !== 'white');
                barWhiteBtn?.classList.toggle('active', color === 'white');
                this._regenerate(element);
            };
            barBlackBtn?.addEventListener('click', () => setBarColor('black'));
            barWhiteBtn?.addEventListener('click', () => setBarColor('white'));

            const bgInput = editorPanel.querySelector('#qr-spotify-bg');
            if (bgInput) bgInput.oninput = () => {
                meta.spotifyBg = bgInput.value;
                this._regenerate(element);
            };
        }
    }

    /** Gera o HTML dos campos específicos do tipo de conteúdo selecionado. */
    static _renderTypeFields(meta) {
        switch (meta.payloadType) {
            case 'wifi':
                return `
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.wifiSsid')}</span>
                        <input type="text" id="qr-wifi-ssid" class="craftools-input" value="${this._esc(meta.wifiSsid)}" style="width:100%;">
                    </div>
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.wifiSecurity')}</span>
                        <select id="qr-wifi-security" class="craftools-select" style="width:100%;">
                            <option value="WPA" ${meta.wifiSecurity === 'WPA' ? 'selected' : ''}>WPA/WPA2</option>
                            <option value="WEP" ${meta.wifiSecurity === 'WEP' ? 'selected' : ''}>WEP</option>
                            <option value="nopass" ${meta.wifiSecurity === 'nopass' ? 'selected' : ''}>${I18n.t('qrTool.wifiSecurityNone')}</option>
                        </select>
                    </div>
                    <div class="craftools-field" id="qr-wifi-pass-field" style="${meta.wifiSecurity === 'nopass' ? 'display:none;' : ''}">
                        <span class="craftools-label">${I18n.t('qrTool.wifiPassword')}</span>
                        <input type="text" id="qr-wifi-pass" class="craftools-input" value="${this._esc(meta.wifiPassword)}" style="width:100%;">
                    </div>
                `;
            case 'telefone':
                return `
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.phoneLabel')}</span>
                        <input type="tel" id="qr-phone" class="craftools-input" placeholder="${I18n.t('qrTool.phonePlaceholder')}" value="${this._esc(meta.phone)}" style="width:100%;">
                    </div>
                `;
            case 'email':
                return `
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.emailLabel')}</span>
                        <input type="email" id="qr-email" class="craftools-input" value="${this._esc(meta.email)}" style="width:100%;">
                    </div>
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.emailSubject')}</span>
                        <input type="text" id="qr-email-subject" class="craftools-input" value="${this._esc(meta.emailSubject)}" style="width:100%;">
                    </div>
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.emailBody')}</span>
                        <textarea id="qr-email-body" class="craftools-input" rows="2" style="width:100%; resize:vertical;">${this._esc(meta.emailBody)}</textarea>
                    </div>
                `;
            case 'sms':
                return `
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.smsLabel')}</span>
                        <input type="tel" id="qr-sms-phone" class="craftools-input" value="${this._esc(meta.smsPhone)}" style="width:100%;">
                    </div>
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.smsBody')}</span>
                        <textarea id="qr-sms-body" class="craftools-input" rows="2" style="width:100%; resize:vertical;">${this._esc(meta.smsBody)}</textarea>
                    </div>
                `;
            case 'pix':
                return `
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.pixKey')}</span>
                        <input type="text" id="qr-pix-key" class="craftools-input" placeholder="${I18n.t('qrTool.pixKeyPlaceholder')}" value="${this._esc(meta.pixKey)}" style="width:100%;">
                    </div>
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.pixName')}</span>
                        <input type="text" id="qr-pix-name" class="craftools-input" maxlength="25" value="${this._esc(meta.pixName)}" style="width:100%;">
                    </div>
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.pixCity')}</span>
                        <input type="text" id="qr-pix-city" class="craftools-input" maxlength="15" value="${this._esc(meta.pixCity)}" style="width:100%;">
                    </div>
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.pixAmount')}</span>
                        <input type="number" id="qr-pix-amount" class="craftools-input" min="0" step="0.01" placeholder="${I18n.t('qrTool.pixAmountPlaceholder')}" value="${this._esc(meta.pixAmount)}" style="width:100%;">
                    </div>
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.pixTxid')}</span>
                        <input type="text" id="qr-pix-txid" class="craftools-input" maxlength="25" placeholder="${I18n.t('qrTool.pixTxidPlaceholder')}" value="${this._esc(meta.pixTxid)}" style="width:100%;">
                    </div>
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.pixMessage')}</span>
                        <input type="text" id="qr-pix-message" class="craftools-input" maxlength="72" value="${this._esc(meta.pixMessage)}" style="width:100%;">
                    </div>
                `;
            case 'spotify': {
                const uri = this.buildSpotifyUri(meta.spotifyInput);
                const showInvalid = meta.spotifyInput && !uri;
                return `
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.spotifyLabel')}</span>
                        <input type="text" id="qr-spotify-uri" class="craftools-input" placeholder="${I18n.t('qrTool.spotifyPlaceholder')}" value="${this._esc(meta.spotifyInput)}" style="width:100%;">
                        <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${I18n.t('qrTool.spotifyHelp')}</span>
                    </div>
                    <div id="qr-spotify-invalid-warning" style="display:${showInvalid ? 'flex' : 'none'}; gap:6px; align-items:flex-start; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:8px; font-size:11px; color:#ef4444;">
                        <span class="material-symbols-outlined" style="font-size:14px;">warning</span>
                        <span>${I18n.t('qrTool.spotifyInvalid')}</span>
                    </div>
                `;
            }
            default:
                return `
                    <div class="craftools-field">
                        <span class="craftools-label">${I18n.t('qrTool.textLabel')}</span>
                        <textarea id="qr-text" class="craftools-input" rows="3" placeholder="${I18n.t('qrTool.textPlaceholder')}" style="width:100%; resize:vertical;">${this._esc(meta.text)}</textarea>
                    </div>
                `;
        }
    }

    /** Liga os listeners dos campos específicos do tipo de conteúdo atual. */
    static _bindTypeFields(editorPanel, element, meta) {
        const regen = () => {
            this._regenerate(element);
            this._updateWarning(editorPanel, meta);
        };

        switch (meta.payloadType) {
            case 'wifi': {
                const ssid = editorPanel.querySelector('#qr-wifi-ssid');
                const sec = editorPanel.querySelector('#qr-wifi-security');
                const pass = editorPanel.querySelector('#qr-wifi-pass');
                const passField = editorPanel.querySelector('#qr-wifi-pass-field');
                if (ssid) ssid.oninput = () => { meta.wifiSsid = ssid.value; regen(); };
                if (sec) sec.onchange = () => {
                    meta.wifiSecurity = sec.value;
                    if (passField) passField.style.display = sec.value === 'nopass' ? 'none' : '';
                    regen();
                };
                if (pass) pass.oninput = () => { meta.wifiPassword = pass.value; regen(); };
                break;
            }
            case 'telefone': {
                const phone = editorPanel.querySelector('#qr-phone');
                if (phone) phone.oninput = () => { meta.phone = phone.value; regen(); };
                break;
            }
            case 'email': {
                const email = editorPanel.querySelector('#qr-email');
                const subject = editorPanel.querySelector('#qr-email-subject');
                const body = editorPanel.querySelector('#qr-email-body');
                if (email) email.oninput = () => { meta.email = email.value; regen(); };
                if (subject) subject.oninput = () => { meta.emailSubject = subject.value; regen(); };
                if (body) body.oninput = () => { meta.emailBody = body.value; regen(); };
                break;
            }
            case 'sms': {
                const phone = editorPanel.querySelector('#qr-sms-phone');
                const body = editorPanel.querySelector('#qr-sms-body');
                if (phone) phone.oninput = () => { meta.smsPhone = phone.value; regen(); };
                if (body) body.oninput = () => { meta.smsBody = body.value; regen(); };
                break;
            }
            case 'pix': {
                const key = editorPanel.querySelector('#qr-pix-key');
                const name = editorPanel.querySelector('#qr-pix-name');
                const city = editorPanel.querySelector('#qr-pix-city');
                const amount = editorPanel.querySelector('#qr-pix-amount');
                const txid = editorPanel.querySelector('#qr-pix-txid');
                const message = editorPanel.querySelector('#qr-pix-message');
                if (key) key.oninput = () => { meta.pixKey = key.value; regen(); };
                if (name) name.oninput = () => { meta.pixName = name.value; regen(); };
                if (city) city.oninput = () => { meta.pixCity = city.value; regen(); };
                if (amount) amount.oninput = () => { meta.pixAmount = amount.value; regen(); };
                if (txid) txid.oninput = () => { meta.pixTxid = txid.value; regen(); };
                if (message) message.oninput = () => { meta.pixMessage = message.value; regen(); };
                break;
            }
            case 'spotify': {
                const uriInput = editorPanel.querySelector('#qr-spotify-uri');
                if (uriInput) uriInput.oninput = () => {
                    meta.spotifyInput = uriInput.value;
                    const warn = editorPanel.querySelector('#qr-spotify-invalid-warning');
                    if (warn) {
                        const parsed = this.buildSpotifyUri(meta.spotifyInput);
                        warn.style.display = (meta.spotifyInput && !parsed) ? 'flex' : 'none';
                    }
                    this._regenerate(element);
                };
                break;
            }
            default: {
                const text = editorPanel.querySelector('#qr-text');
                if (text) text.oninput = () => { meta.text = text.value; regen(); };
            }
        }
    }

    static _updateWarning(editorPanel, meta) {
        const warningEl = editorPanel.querySelector('#qr-too-long-warning');
        if (warningEl) warningEl.style.display = (meta.payloadType !== 'spotify' && QrCode.isLikelyTooLong(this.buildPayload(meta))) ? 'flex' : 'none';
    }

    /** Reconstrói o QR Code (ou a imagem do Spotify Code) a partir do estado
     *  atual de `_craftoolsMeta`. */
    static _regenerate(element) {
        const meta = element._craftoolsMeta;
        if (!meta || !element.contentArea) return;

        if (meta.payloadType === 'spotify') {
            this._regenerateSpotify(element, meta);
            return;
        }

        // Modo normal (QR local) -- remove qualquer <img> de Spotify Code
        // deixado por uma troca de tipo anterior.
        const oldImg = element.contentArea.querySelector('img[data-spotify-code]');
        if (oldImg) oldImg.remove();

        const payload = this.buildPayload(meta);
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
    static _regenerateSpotify(element, meta) {
        const oldSvg = element.contentArea.querySelector('svg');
        if (oldSvg) oldSvg.remove();

        const uri = this.buildSpotifyUri(meta.spotifyInput);
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
        if (/^spotify:(track|album|artist|playlist|show|episode|user):[A-Za-z0-9]+$/.test(raw)) return raw;
        const m = raw.match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|artist|playlist|show|episode|user)\/([A-Za-z0-9]+)/i);
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
            borderRadius: 0
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
