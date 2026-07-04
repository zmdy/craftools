import { I18n } from "../settings/Translations.js";
import { VariableEngine } from "./VariableEngine.js";
import "./VariablePanel_Translations.js";

/**
 * VariablePanel
 *
 * UI compartilhada da aba/acordeão "Texto Variável", reaproveitada por
 * TextTool (Título/Texto), QRCodeTool e BarcodeTool (tanto no painel desktop
 * quanto nos mini-painéis do MobileToolbar).
 *
 * Uso:
 *   const html = PanelUI.accordion('xxx-variavel', 'data_object',
 *       I18n.t('variablePanel.title'), VariablePanel.renderAccordionBody(binding), { open: false });
 *   editorPanel.innerHTML += html; // (ou dentro da composição normal do painel)
 *   ...
 *   VariablePanel.bind(editorPanel, binding, (newBinding) => {
 *       // newBinding é `null` quando o usuário volta para "Nenhuma"
 *       meta.variableBinding = newBinding; // ou element._craftoolsVariable = newBinding
 *       // ... aplicar preview / regenerar visual ...
 *   });
 */
export class VariablePanel {

    // ── HTML principal (select de tipo + config específica + preview) ──────

    static renderAccordionBody(binding) {
        const type = binding && binding.type ? binding.type : '';
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.typeLabel')}</span>
                <select id="var-type" class="craftools-select" style="width:100%;">
                    <option value="">${I18n.t('variablePanel.typeNone')}</option>
                    <option value="date" ${type === 'date' ? 'selected' : ''}>${I18n.t('variablePanel.typeDate')}</option>
                    <option value="sequenceNumber" ${type === 'sequenceNumber' ? 'selected' : ''}>${I18n.t('variablePanel.typeSequenceNumber')}</option>
                    <option value="sequenceText" ${type === 'sequenceText' ? 'selected' : ''}>${I18n.t('variablePanel.typeSequenceText')}</option>
                    <option value="pageNumber" ${type === 'pageNumber' ? 'selected' : ''}>${I18n.t('variablePanel.typePageNumber')}</option>
                    <option value="link" ${type === 'link' ? 'selected' : ''}>${I18n.t('variablePanel.typeLink')}</option>
                    <option value="emoji" ${type === 'emoji' ? 'selected' : ''}>${I18n.t('variablePanel.typeEmoji')}</option>
                    <option value="apiPhrase" ${type === 'apiPhrase' ? 'selected' : ''}>${I18n.t('variablePanel.typeApiPhrase')}</option>
                </select>
            </div>
            <div id="var-config">${this._renderConfig(binding)}</div>
            <div class="ct-field" id="var-preview" style="${type ? '' : 'display:none;'}">
                <span class="craftools-label">${I18n.t('variablePanel.previewLabel')}</span>
                <div id="var-preview-value" style="font-size:12px; padding:6px 9px; background:rgba(127,127,127,0.12); border-radius:6px; word-break:break-word; min-height:16px;">${I18n.t('variablePanel.previewLoading')}</div>
            </div>
        `;
    }

    // ── HTML de configuração específica por tipo ────────────────────────────

    static _renderConfig(binding) {
        if (!binding || !binding.type) return '';
        switch (binding.type) {
            case 'date': return this._dateConfig(binding);
            case 'sequenceNumber': return this._seqNumberConfig(binding);
            case 'sequenceText': return this._seqTextConfig(binding);
            case 'pageNumber': return this._pageNumberConfig(binding);
            case 'link': return this._linkConfig(binding);
            case 'emoji': return this._emojiConfig(binding);
            case 'apiPhrase': return this._apiPhraseConfig(binding);
            default: return '';
        }
    }

    static _dateFormats() {
        return [
            ['DD/MM/YYYY', 'DDMMYYYY'], ['DD/MM/YY', 'DDMMYY'], ['DD/MM', 'DDMM'], ['MM/YYYY', 'MMYYYY'],
            ['YYYY-MM-DD', 'ISO'], ['DIA_MES_EXTENSO', 'DiaMesExtenso'], ['DIA_MES_ANO_EXTENSO', 'DiaMesAnoExtenso'],
            ['DIA_SEMANA', 'DiaSemana'], ['DIA_SEMANA_DATA', 'DiaSemanaData'],
        ];
    }

    static _dateConfig(b) {
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.dateStartLabel')}</span>
                <input type="date" id="var-date-start" class="craftools-input" style="width:100%;" value="${this._esc(b.startDate)}">
            </div>
            <div style="display:grid; grid-template-columns: 1fr 72px; gap:10px;">
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('variablePanel.dateIntervalLabel')}</span>
                    <select id="var-date-interval" class="craftools-select" style="width:100%;">
                        <option value="none" ${b.interval === 'none' ? 'selected' : ''}>${I18n.t('variablePanel.dateIntervalNone')}</option>
                        <option value="daily" ${b.interval === 'daily' ? 'selected' : ''}>${I18n.t('variablePanel.dateIntervalDaily')}</option>
                        <option value="weekly" ${b.interval === 'weekly' ? 'selected' : ''}>${I18n.t('variablePanel.dateIntervalWeekly')}</option>
                        <option value="monthly" ${b.interval === 'monthly' ? 'selected' : ''}>${I18n.t('variablePanel.dateIntervalMonthly')}</option>
                        <option value="yearly" ${b.interval === 'yearly' ? 'selected' : ''}>${I18n.t('variablePanel.dateIntervalYearly')}</option>
                    </select>
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('variablePanel.dateStepLabel')}</span>
                    <input type="number" id="var-date-step" class="craftools-input" style="width:100%;" value="${parseInt(b.step, 10) || 1}" min="1">
                </div>
            </div>
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.dateFormatLabel')}</span>
                <select id="var-date-format" class="craftools-select" style="width:100%;">
                    ${this._dateFormats().map(([fmt, key]) => `
                        <option value="${fmt}" ${b.format === fmt ? 'selected' : ''}>${I18n.t('variablePanel.dateFormat' + key)}</option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    static _seqNumberConfig(b) {
        return `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('variablePanel.seqNumberStartLabel')}</span>
                    <input type="number" id="var-seqnum-start" class="craftools-input" style="width:100%;" value="${b.start ?? 1}">
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('variablePanel.seqNumberStepLabel')}</span>
                    <input type="number" id="var-seqnum-step" class="craftools-input" style="width:100%;" value="${b.step ?? 1}">
                </div>
            </div>
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.seqNumberPaddingLabel')}</span>
                <input type="number" id="var-seqnum-padding" class="craftools-input" style="width:100%;" value="${b.padding ?? 0}" min="0" max="10">
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('variablePanel.seqNumberPrefixLabel')}</span>
                    <input type="text" id="var-seqnum-prefix" class="craftools-input" style="width:100%;" value="${this._esc(b.prefix)}">
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('variablePanel.seqNumberSuffixLabel')}</span>
                    <input type="text" id="var-seqnum-suffix" class="craftools-input" style="width:100%;" value="${this._esc(b.suffix)}">
                </div>
            </div>
        `;
    }

    static _seqTextConfig(b) {
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.seqTextValuesLabel')}</span>
                <textarea id="var-seqtext-values" class="craftools-input" rows="4" placeholder="${this._esc(I18n.t('variablePanel.seqTextValuesPlaceholder'))}" style="width:100%; resize:vertical;">${this._esc(b.values)}</textarea>
                <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${I18n.t('variablePanel.seqTextValuesHelp')}</span>
            </div>
            <label class="ct-field" style="flex-direction:row; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="var-seqtext-loop" ${b.loop !== false ? 'checked' : ''}>
                <span class="craftools-label" style="margin:0;">${I18n.t('variablePanel.seqTextLoopLabel')}</span>
            </label>
        `;
    }

    static _pageNumberConfig(b) {
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.pageNumberStartAtLabel')}</span>
                <input type="number" id="var-pagenum-startat" class="craftools-input" style="width:100%;" value="${b.startAt ?? 1}" min="1">
            </div>
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.pageNumberFormatLabel')}</span>
                <select id="var-pagenum-format" class="craftools-select" style="width:100%;">
                    <option value="n" ${b.format === 'n' ? 'selected' : ''}>${I18n.t('variablePanel.pageNumberFormatSimple')}</option>
                    <option value="n_of_total" ${b.format === 'n_of_total' ? 'selected' : ''}>${I18n.t('variablePanel.pageNumberFormatOfTotal')}</option>
                </select>
            </div>
        `;
    }

    static _linkConfig(b) {
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.linkUrlLabel')}</span>
                <input type="text" id="var-link-url" class="craftools-input" style="width:100%;" placeholder="${this._esc(I18n.t('variablePanel.linkUrlPlaceholder'))}" value="${this._esc(b.url)}">
            </div>
            <label class="ct-field" style="flex-direction:row; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="var-link-append" ${b.appendIndex ? 'checked' : ''}>
                <span class="craftools-label" style="margin:0;">${I18n.t('variablePanel.linkAppendIndexLabel')}</span>
            </label>
            <div class="ct-field" id="var-link-startat-field" style="${b.appendIndex ? '' : 'display:none;'}">
                <span class="craftools-label">${I18n.t('variablePanel.linkStartAtLabel')}</span>
                <input type="number" id="var-link-startat" class="craftools-input" style="width:100%;" value="${b.startAt ?? 1}" min="1">
            </div>
        `;
    }

    static _emojiConfig(b) {
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.emojiValuesLabel')}</span>
                <textarea id="var-emoji-values" class="craftools-input" rows="2" placeholder="${this._esc(I18n.t('variablePanel.emojiValuesPlaceholder'))}" style="width:100%; resize:vertical; font-family:'Noto Color Emoji', sans-serif; font-size:16px;">${this._esc(b.values)}</textarea>
                <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${I18n.t('variablePanel.emojiValuesHelp')}</span>
            </div>
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.apiPhraseModeLabel')}</span>
                <select id="var-emoji-mode" class="craftools-select" style="width:100%;">
                    <option value="sequential" ${b.mode !== 'random' ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseModeSequential')}</option>
                    <option value="random" ${b.mode === 'random' ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseModeRandom')}</option>
                </select>
            </div>
        `;
    }

    static _apiPhraseConfig(b) {
        const knownFields = ['', 'phrase', 'author', 'category'];
        const isCustom = !!b.field && !knownFields.includes(b.field);
        const filterField = b.filterField || '';
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.apiPhraseFieldLabel')}</span>
                <select id="var-api-field-select" class="craftools-select" style="width:100%;">
                    <option value="" ${!isCustom && !b.field ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFieldAuto')}</option>
                    <option value="phrase" ${b.field === 'phrase' ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFieldPhrase')}</option>
                    <option value="author" ${b.field === 'author' ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFieldAuthor')}</option>
                    <option value="category" ${b.field === 'category' ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFieldCategory')}</option>
                    <option value="__custom__" ${isCustom ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFieldCustom')}</option>
                </select>
                <input type="text" id="var-api-field-custom" class="craftools-input" style="width:100%; margin-top:6px; ${isCustom ? '' : 'display:none;'}" placeholder="${this._esc(I18n.t('variablePanel.apiPhraseFieldPlaceholder'))}" value="${isCustom ? this._esc(b.field) : ''}">
                <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${I18n.t('variablePanel.apiPhraseFieldHelp')}</span>
            </div>
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.apiPhraseFilterLabel')}</span>
                <select id="var-api-filter-field" class="craftools-select" style="width:100%;">
                    <option value="" ${!filterField ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFilterNone')}</option>
                    <option value="author" ${filterField === 'author' ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFilterAuthor')}</option>
                    <option value="category" ${filterField === 'category' ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFilterCategory')}</option>
                </select>
            </div>
            <div class="ct-field" id="var-api-filter-value-wrap" style="${filterField ? '' : 'display:none;'}">
                <span class="craftools-label">${I18n.t('variablePanel.apiPhraseFilterValueLabel')}</span>
                <select id="var-api-filter-value" class="craftools-select" style="width:100%;">
                    <option value="">${I18n.t('variablePanel.apiPhraseFilterLoading')}</option>
                </select>
            </div>
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.apiPhraseModeLabel')}</span>
                <select id="var-api-mode" class="craftools-select" style="width:100%;">
                    <option value="sequential" ${b.mode !== 'random' ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseModeSequential')}</option>
                    <option value="random" ${b.mode === 'random' ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseModeRandom')}</option>
                </select>
            </div>
        `;
    }

    // ── Bind: liga os listeners e mantém preview/estado sincronizados ──────

    /**
     * @param {HTMLElement} container   O painel (ou mini-painel) que contém o HTML de renderAccordionBody()
     * @param {object|null} initialBinding
     * @param {Function} onChange       Chamado com (novoBinding|null) sempre que algo muda
     */
    static bind(container, initialBinding, onChange) {
        const typeSelect = container.querySelector('#var-type');
        if (!typeSelect) return;

        let binding = initialBinding ? { ...initialBinding } : null;

        const updatePreview = () => {
            const previewBox = container.querySelector('#var-preview');
            const previewValue = container.querySelector('#var-preview-value');
            if (!binding || !binding.type) {
                if (previewBox) previewBox.style.display = 'none';
                return;
            }
            if (previewBox) previewBox.style.display = '';
            if (previewValue) previewValue.textContent = I18n.t('variablePanel.previewLoading');
            VariableEngine.resolvePreview(binding).then(val => {
                if (previewValue) previewValue.textContent = (val && String(val).length) ? val : '—';
            });
        };

        const bindConfigFields = () => {
            if (!binding || !binding.type) return;
            const notify = () => { updatePreview(); onChange(binding); };

            switch (binding.type) {
                case 'date': {
                    const startInput = container.querySelector('#var-date-start');
                    const intervalSelect = container.querySelector('#var-date-interval');
                    const stepInput = container.querySelector('#var-date-step');
                    const formatSelect = container.querySelector('#var-date-format');
                    if (startInput) startInput.oninput = () => { binding.startDate = startInput.value; notify(); };
                    if (intervalSelect) intervalSelect.onchange = () => { binding.interval = intervalSelect.value; notify(); };
                    if (stepInput) stepInput.oninput = () => { binding.step = parseInt(stepInput.value, 10) || 1; notify(); };
                    if (formatSelect) formatSelect.onchange = () => { binding.format = formatSelect.value; notify(); };
                    break;
                }
                case 'sequenceNumber': {
                    const startInput = container.querySelector('#var-seqnum-start');
                    const stepInput = container.querySelector('#var-seqnum-step');
                    const paddingInput = container.querySelector('#var-seqnum-padding');
                    const prefixInput = container.querySelector('#var-seqnum-prefix');
                    const suffixInput = container.querySelector('#var-seqnum-suffix');
                    if (startInput) startInput.oninput = () => { binding.start = startInput.value; notify(); };
                    if (stepInput) stepInput.oninput = () => { binding.step = stepInput.value; notify(); };
                    if (paddingInput) paddingInput.oninput = () => { binding.padding = paddingInput.value; notify(); };
                    if (prefixInput) prefixInput.oninput = () => { binding.prefix = prefixInput.value; notify(); };
                    if (suffixInput) suffixInput.oninput = () => { binding.suffix = suffixInput.value; notify(); };
                    break;
                }
                case 'sequenceText': {
                    const valuesInput = container.querySelector('#var-seqtext-values');
                    const loopInput = container.querySelector('#var-seqtext-loop');
                    if (valuesInput) valuesInput.oninput = () => { binding.values = valuesInput.value; notify(); };
                    if (loopInput) loopInput.onchange = () => { binding.loop = loopInput.checked; notify(); };
                    break;
                }
                case 'pageNumber': {
                    const startAtInput = container.querySelector('#var-pagenum-startat');
                    const formatSelect = container.querySelector('#var-pagenum-format');
                    if (startAtInput) startAtInput.oninput = () => { binding.startAt = startAtInput.value; notify(); };
                    if (formatSelect) formatSelect.onchange = () => { binding.format = formatSelect.value; notify(); };
                    break;
                }
                case 'link': {
                    const urlInput = container.querySelector('#var-link-url');
                    const appendInput = container.querySelector('#var-link-append');
                    const startAtField = container.querySelector('#var-link-startat-field');
                    const startAtInput = container.querySelector('#var-link-startat');
                    if (urlInput) urlInput.oninput = () => { binding.url = urlInput.value; notify(); };
                    if (appendInput) appendInput.onchange = () => {
                        binding.appendIndex = appendInput.checked;
                        if (startAtField) startAtField.style.display = appendInput.checked ? '' : 'none';
                        notify();
                    };
                    if (startAtInput) startAtInput.oninput = () => { binding.startAt = startAtInput.value; notify(); };
                    break;
                }
                case 'emoji': {
                    const valuesInput = container.querySelector('#var-emoji-values');
                    const modeSelect = container.querySelector('#var-emoji-mode');
                    if (valuesInput) valuesInput.oninput = () => { binding.values = valuesInput.value; notify(); };
                    if (modeSelect) modeSelect.onchange = () => { binding.mode = modeSelect.value; notify(); };
                    break;
                }
                case 'apiPhrase': {
                    const fieldSelect = container.querySelector('#var-api-field-select');
                    const fieldCustom = container.querySelector('#var-api-field-custom');
                    const filterFieldSelect = container.querySelector('#var-api-filter-field');
                    const filterValueWrap = container.querySelector('#var-api-filter-value-wrap');
                    const filterValueSelect = container.querySelector('#var-api-filter-value');
                    const modeSelect = container.querySelector('#var-api-mode');

                    if (fieldSelect) fieldSelect.onchange = () => {
                        if (fieldSelect.value === '__custom__') {
                            if (fieldCustom) { fieldCustom.style.display = ''; fieldCustom.focus(); }
                            binding.field = fieldCustom ? fieldCustom.value : '';
                        } else {
                            if (fieldCustom) fieldCustom.style.display = 'none';
                            binding.field = fieldSelect.value;
                        }
                        notify();
                    };
                    if (fieldCustom) fieldCustom.oninput = () => { binding.field = fieldCustom.value; notify(); };

                    // Popula o select de "Valor do filtro" com os valores
                    // distintos reais (autor/categoria) vindos da API.
                    const loadFilterValues = async (selectedValue) => {
                        if (!filterValueSelect) return;
                        filterValueSelect.innerHTML = `<option value="">${I18n.t('variablePanel.apiPhraseFilterLoading')}</option>`;
                        const values = await VariableEngine.loadFilterOptions(binding.filterField);
                        filterValueSelect.innerHTML = values.length
                            ? values.map(v => `<option value="${this._esc(v)}" ${v === selectedValue ? 'selected' : ''}>${this._esc(v)}</option>`).join('')
                            : `<option value="">${I18n.t('variablePanel.apiPhraseFilterEmpty')}</option>`;
                        if (!values.includes(binding.filterValue)) {
                            binding.filterValue = values[0] || '';
                            notify();
                        }
                    };

                    if (filterFieldSelect) filterFieldSelect.onchange = () => {
                        binding.filterField = filterFieldSelect.value;
                        binding.filterValue = '';
                        if (filterValueWrap) filterValueWrap.style.display = binding.filterField ? '' : 'none';
                        if (binding.filterField) loadFilterValues('');
                        notify();
                    };

                    if (filterValueSelect) filterValueSelect.onchange = () => {
                        binding.filterValue = filterValueSelect.value;
                        notify();
                    };

                    if (modeSelect) modeSelect.onchange = () => { binding.mode = modeSelect.value; notify(); };

                    // Carrega as opções do filtro já na primeira renderização
                    // se um filtro já estiver configurado (ex.: reabrindo o painel).
                    if (binding.filterField) loadFilterValues(binding.filterValue);
                    break;
                }
            }
        };

        typeSelect.onchange = () => {
            const newType = typeSelect.value;
            binding = newType ? VariableEngine.defaultBinding(newType) : null;
            const configEl = container.querySelector('#var-config');
            if (configEl) configEl.innerHTML = this._renderConfig(binding);
            bindConfigFields();
            updatePreview();
            onChange(binding);
        };

        bindConfigFields();
        updatePreview();
    }

    static _esc(val) {
        return String(val == null ? '' : val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
