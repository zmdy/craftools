import { I18n } from "../settings/Translations.js";
import { VariableEngine } from "./VariableEngine.js";
import "./VariablePanel_Translations.js";
// Reaproveita os textos de "O que exibir" (modos de recorte do card) já
// definidos para a ferramenta Mini Calendário -- importado incondicionalmente
// aqui (em vez de depender do import dinâmico feito só quando o usuário
// arrasta a ferramenta) para garantir que as traduções existam mesmo quando
// o Mini Calendário é usado só como Texto Variável, sem nunca ter sido
// arrastado como elemento.
import "../tools/minicalendar/MiniCalendarTool_Translations.js";

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

    static renderAccordionBody(binding, element) {
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
                    <option value="emojiKitchen" ${type === 'emojiKitchen' ? 'selected' : ''}>${I18n.t('variablePanel.typeEmojiKitchen')}</option>
                    <option value="miniCalendar" ${type === 'miniCalendar' ? 'selected' : ''}>${I18n.t('variablePanel.typeMiniCalendar')}</option>
                </select>
            </div>
            <div id="var-config">${this._renderConfig(binding, element)}</div>
            <div class="ct-field" id="var-preview" style="${type ? '' : 'display:none;'}">
                <span class="craftools-label">${I18n.t('variablePanel.previewLabel')}</span>
                <div id="var-preview-value" style="font-size:12px; padding:6px 9px; background:rgba(127,127,127,0.12); border-radius:6px; word-break:break-word; min-height:16px;">${I18n.t('variablePanel.previewLoading')}</div>
            </div>
        `;
    }

    // ── HTML de configuração específica por tipo ────────────────────────────

    static _renderConfig(binding, element) {
        if (!binding || !binding.type) return '';
        const linkRow = this._renderLinkRow(binding, element);
        switch (binding.type) {
            case 'date': return linkRow + this._dateConfig(binding);
            case 'sequenceNumber': return linkRow + this._seqNumberConfig(binding);
            case 'sequenceText': return linkRow + this._seqTextConfig(binding);
            case 'pageNumber': return linkRow + this._pageNumberConfig(binding);
            case 'link': return linkRow + this._linkConfig(binding);
            case 'emoji': return linkRow + this._emojiConfig(binding);
            case 'apiPhrase': return linkRow + this._apiPhraseConfig(binding);
            case 'emojiKitchen': return linkRow + this._emojiKitchenConfig(binding);
            case 'miniCalendar': return linkRow + this._miniCalendarConfig(binding);
            default: return '';
        }
    }

    // ── Vínculo entre variáveis ("Vincular a") ───────────────────────────────

    /**
     * Linha de UI (select) para vincular este binding a outra instância já
     * existente NA MESMA página, do MESMO tipo, que ainda não esteja ela
     * própria vinculada a outra (só "líderes" podem ser alvo de vínculo).
     * Some silenciosamente se não houver nenhum candidato.
     */
    static _renderLinkRow(binding, element) {
        if (!element) return '';
        const candidates = this._findLinkCandidates(binding.type, element);
        if (!candidates.length) return '';
        const options = candidates.map(c =>
            `<option value="${this._esc(c.id)}" ${binding.linkedTo === c.id ? 'selected' : ''}>${this._esc(c.label)}</option>`
        ).join('');
        return `
            <div class="ct-field" id="var-link-target-wrap">
                <span class="craftools-label">${I18n.t('variablePanel.linkTargetLabel')}</span>
                <select id="var-link-target" class="craftools-select" style="width:100%;">
                    <option value="">${I18n.t('variablePanel.linkTargetNone')}</option>
                    ${options}
                </select>
                ${binding.linkedTo ? `<span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${I18n.t('variablePanel.linkTargetNotice')}</span>` : ''}
            </div>
        `;
    }

    /** Outros elementos NA MESMA página, mesmo tipo de variável, não-vinculados. */
    static _findLinkCandidates(type, element) {
        if (!element || !element.closest) return [];
        const page = element.closest('.craftools-page');
        const scope = page || document;
        const results = [];
        scope.querySelectorAll('craftools-element').forEach(el => {
            if (el === element) return;
            const toolType = el.getAttribute('data-craftool');
            const binding = this._getElementBinding(el, toolType);
            if (!binding || binding.type !== type || binding.linkedTo) return;
            const id = this._ensureVarId(el);
            results.push({ id, label: this._labelFor(el, toolType, binding) });
        });
        return results;
    }

    /** Lê o binding de variável já configurado num elemento (mesma lógica do AgendaExport.js). */
    static _getElementBinding(el, toolType) {
        if (toolType === 'titulo' || toolType === 'paragrafo') return el._craftoolsVariable || null;
        if (toolType === 'qrcode' || toolType === 'barcode') return (el._craftoolsMeta && el._craftoolsMeta.variableBinding) || null;
        return null;
    }

    /** Garante um id estável (só em memória, dura a sessão) para "Vincular a". */
    static _ensureVarId(el) {
        if (!el._craftoolsVarId) el._craftoolsVarId = 'v' + Math.random().toString(36).slice(2, 9);
        return el._craftoolsVarId;
    }

    static _findElementById(currentEl, id) {
        if (!id) return null;
        const page = currentEl && currentEl.closest ? currentEl.closest('.craftools-page') : null;
        const scope = page || document;
        let found = null;
        scope.querySelectorAll('craftools-element').forEach(el => {
            if (el._craftoolsVarId === id) found = el;
        });
        return found;
    }

    static _labelFor(el, toolType, binding) {
        const typeKey = 'type' + binding.type.charAt(0).toUpperCase() + binding.type.slice(1);
        const typeLabel = I18n.t('variablePanel.' + typeKey) || binding.type;
        let snippet = '';
        if (toolType === 'titulo' || toolType === 'paragrafo') {
            const ce = el.contentArea && el.contentArea.querySelector('[contenteditable]');
            const raw = (el._craftoolsVariablePrevHtml !== undefined ? el._craftoolsVariablePrevHtml : (ce ? ce.textContent : '')) || '';
            snippet = String(raw).replace(/<[^>]*>/g, '').trim().slice(0, 18);
        } else if (toolType === 'qrcode') {
            snippet = 'QR Code';
        } else if (toolType === 'barcode') {
            snippet = 'Barcode';
        }
        return snippet ? `${typeLabel} — "${snippet}"` : typeLabel;
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
                <span class="craftools-label">${I18n.t('variablePanel.apiPhraseCollectionLabel')}</span>
                <select id="var-api-collection" class="craftools-select" style="width:100%;">
                    <option value="">${I18n.t('variablePanel.apiPhraseCollectionLoading')}</option>
                </select>
                <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${I18n.t('variablePanel.apiPhraseCollectionHelp')}</span>
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

    static _emojiKitchenConfig(b) {
        const hasLeft = !!(b.leftEmoji || '').trim();
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.emojiKitchenLeftLabel')}</span>
                <input type="text" id="var-kitchen-left" class="craftools-input" style="width:100%; font-family:'Noto Color Emoji', sans-serif; font-size:16px;" placeholder="${this._esc(I18n.t('variablePanel.emojiKitchenPlaceholder'))}" value="${this._esc(b.leftEmoji)}" maxlength="8">
            </div>
            <div class="ct-field" id="var-kitchen-right-wrap" style="${hasLeft ? '' : 'display:none;'}">
                <span class="craftools-label">${I18n.t('variablePanel.emojiKitchenRightLabel')}</span>
                <input type="text" id="var-kitchen-right" class="craftools-input" style="width:100%; font-family:'Noto Color Emoji', sans-serif; font-size:16px;" placeholder="${this._esc(I18n.t('variablePanel.emojiKitchenPlaceholder'))}" value="${this._esc(b.rightEmoji)}" maxlength="8">
                <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${I18n.t('variablePanel.emojiKitchenRightHelp')}</span>
            </div>
            <div class="ct-field" id="var-kitchen-mode-wrap" style="${hasLeft ? '' : 'display:none;'}">
                <span class="craftools-label">${I18n.t('variablePanel.emojiKitchenModeLabel')}</span>
                <select id="var-kitchen-mode" class="craftools-select" style="width:100%;">
                    <option value="sequential" ${b.mode !== 'random' ? 'selected' : ''}>${I18n.t('variablePanel.emojiKitchenModeSequential')}</option>
                    <option value="random" ${b.mode === 'random' ? 'selected' : ''}>${I18n.t('variablePanel.emojiKitchenModeRandom')}</option>
                </select>
                <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${I18n.t('variablePanel.emojiKitchenModeHelp')}</span>
            </div>
        `;
    }

    // Mesmos nomes de mês usados no seletor "Mês/ano" do CalendarTool.js
    // (hardcoded em pt-br ali também -- não há chave de i18n para nomes de
    // mês no projeto ainda).
    static _monthNamesPt() {
        return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    }

    static _miniCalendarConfig(b) {
        const monthOptions = this._monthNamesPt().map((name, i) => `<option value="${i + 1}" ${b.month === i + 1 ? 'selected' : ''}>${name}</option>`).join('');
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.miniCalendarModeLabel')}</span>
                <select id="var-minical-mode" class="craftools-select" style="width:100%;">
                    <option value="fixed" ${b.mode !== 'sequentialMonthly' ? 'selected' : ''}>${I18n.t('variablePanel.miniCalendarModeFixed')}</option>
                    <option value="sequentialMonthly" ${b.mode === 'sequentialMonthly' ? 'selected' : ''}>${I18n.t('variablePanel.miniCalendarModeSequential')}</option>
                </select>
                <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${I18n.t('variablePanel.miniCalendarModeHelp')}</span>
            </div>
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.miniCalendarMonthYearLabel')}</span>
                <div style="display:grid; grid-template-columns:2fr 1fr; gap:8px;">
                    <select id="var-minical-month" class="craftools-select">${monthOptions}</select>
                    <input type="number" id="var-minical-year" class="craftools-input" value="${b.year ?? new Date().getFullYear()}" min="1900" max="2200">
                </div>
            </div>
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.miniCalendarDisplayModeLabel')}</span>
                <select id="var-minical-displaymode" class="craftools-select" style="width:100%;">
                    <option value="diasSemana" ${b.displayMode === 'diasSemana' ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeDiasSemana')}</option>
                    <option value="calendario" ${b.displayMode === 'calendario' ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeCalendario')}</option>
                    <option value="header" ${b.displayMode === 'header' ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeHeader')}</option>
                    <option value="holidaysBox" ${b.displayMode === 'holidaysBox' ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeHolidaysBox')}</option>
                    <option value="moonBox" ${b.displayMode === 'moonBox' ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeMoonBox')}</option>
                    <option value="completo1" ${b.displayMode === 'completo1' ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeCompleto1')}</option>
                    <option value="completo2" ${b.displayMode === 'completo2' ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeCompleto2')}</option>
                </select>
            </div>
        `;
    }

    // ── Bind: liga os listeners e mantém preview/estado sincronizados ──────

    /**
     * @param {HTMLElement} container   O painel (ou mini-painel) que contém o HTML de renderAccordionBody()
     * @param {object|null} initialBinding
     * @param {Function} onChange       Chamado com (novoBinding|null) sempre que algo muda
     * @param {HTMLElement} [element]   O <craftools-element> dono deste binding -- necessário
     *                                  para o recurso "Vincular a" (procurar/rotular candidatos
     *                                  na mesma página e mostrar o preview já vinculado).
     */
    static bind(container, initialBinding, onChange, element) {
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

            // emojiKitchen resolve para uma URL de imagem, não texto -- mostra
            // a imagem em si no preview em vez do link cru. miniCalendar
            // resolve para um bloco de HTML (o card inteiro) -- mostra
            // renderizado (via innerHTML) em vez do markup cru.
            const renderPreviewValue = (val) => {
                if (!previewValue) return;
                if (binding.type === 'emojiKitchen' && val) {
                    previewValue.innerHTML = `<img src="${this._esc(val)}" alt="" style="max-width:100%; max-height:60px; display:block; margin:0 auto; object-fit:contain;">`;
                } else if (binding.type === 'miniCalendar' && val) {
                    previewValue.innerHTML = `<div style="width:120px; height:135px; margin:0 auto;">${val}</div>`;
                } else {
                    previewValue.textContent = (val && String(val).length) ? val : '—';
                }
            };

            // Se vinculado, resolve o "líder" primeiro para que o preview
            // mostre o valor REAL que sairá na geração (mesmo item, campo
            // próprio) em vez de um valor independente/desencontrado.
            if (binding.linkedTo && element) {
                const leaderEl = this._findElementById(element, binding.linkedTo);
                const leaderBinding = leaderEl ? this._getElementBinding(leaderEl, leaderEl.getAttribute('data-craftool')) : null;
                if (leaderBinding && leaderBinding.type === binding.type) {
                    VariableEngine.prefetchApiResources([leaderBinding, binding]).then(apiCache => {
                        const picks = VariableEngine.newLinkRegistry();
                        VariableEngine.resolve(leaderBinding, {}, apiCache, { id: '__leader__', picks });
                        const val = VariableEngine.resolve({ ...binding, linkedTo: '__leader__' }, {}, apiCache, { id: '__me__', picks });
                        renderPreviewValue(val);
                    });
                    return;
                }
            }

            VariableEngine.resolvePreview(binding).then(val => {
                renderPreviewValue(val);
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
                    const collectionSelect = container.querySelector('#var-api-collection');
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
                    // distintos reais (autor/categoria) vindos da API, já
                    // restritos à coleção selecionada (filtro de "1º nível").
                    const loadFilterValues = async (selectedValue) => {
                        if (!filterValueSelect) return;
                        filterValueSelect.innerHTML = `<option value="">${I18n.t('variablePanel.apiPhraseFilterLoading')}</option>`;
                        const values = await VariableEngine.loadFilterOptions(binding.filterField, binding.collection);
                        filterValueSelect.innerHTML = values.length
                            ? values.map(v => `<option value="${this._esc(v)}" ${v === selectedValue ? 'selected' : ''}>${this._esc(v)}</option>`).join('')
                            : `<option value="">${I18n.t('variablePanel.apiPhraseFilterEmpty')}</option>`;
                        if (!values.includes(binding.filterValue)) {
                            binding.filterValue = values[0] || '';
                            notify();
                        }
                    };

                    // Popula o select de "Coleção" (filtro de "1º nível") com
                    // os nomes das coleções de frases cadastradas.
                    const loadCollections = async () => {
                        if (!collectionSelect) return;
                        const names = await VariableEngine.loadPhraseCollectionOptions();
                        const noneLabel = I18n.t('variablePanel.apiPhraseCollectionNone');
                        collectionSelect.innerHTML = [`<option value="">${noneLabel}</option>`]
                            .concat(names.map(n => `<option value="${this._esc(n)}" ${binding.collection === n ? 'selected' : ''}>${this._esc(n)}</option>`))
                            .join('');
                        if (binding.collection && !names.includes(binding.collection)) {
                            binding.collection = '';
                            notify();
                        }
                    };

                    if (collectionSelect) collectionSelect.onchange = () => {
                        binding.collection = collectionSelect.value;
                        // Categorias/autores disponíveis dependem da coleção --
                        // recarrega o "Valor do filtro" para refletir só o que
                        // existe dentro dela.
                        if (binding.filterField) loadFilterValues('');
                        notify();
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

                    loadCollections();

                    // Carrega as opções do filtro já na primeira renderização
                    // se um filtro já estiver configurado (ex.: reabrindo o painel).
                    if (binding.filterField) loadFilterValues(binding.filterValue);
                    break;
                }
                case 'emojiKitchen': {
                    const leftInput = container.querySelector('#var-kitchen-left');
                    const rightInput = container.querySelector('#var-kitchen-right');
                    const rightWrap = container.querySelector('#var-kitchen-right-wrap');
                    const modeWrap = container.querySelector('#var-kitchen-mode-wrap');
                    const modeSelect = container.querySelector('#var-kitchen-mode');
                    if (leftInput) leftInput.oninput = () => {
                        binding.leftEmoji = leftInput.value;
                        const hasLeft = !!leftInput.value.trim();
                        if (rightWrap) rightWrap.style.display = hasLeft ? '' : 'none';
                        if (modeWrap) modeWrap.style.display = hasLeft ? '' : 'none';
                        notify();
                    };
                    if (rightInput) rightInput.oninput = () => { binding.rightEmoji = rightInput.value; notify(); };
                    if (modeSelect) modeSelect.onchange = () => { binding.mode = modeSelect.value; notify(); };
                    break;
                }
                case 'miniCalendar': {
                    const modeSelect = container.querySelector('#var-minical-mode');
                    const monthSelect = container.querySelector('#var-minical-month');
                    const yearInput = container.querySelector('#var-minical-year');
                    const displayModeSelect = container.querySelector('#var-minical-displaymode');
                    if (modeSelect) modeSelect.onchange = () => { binding.mode = modeSelect.value; notify(); };
                    if (monthSelect) monthSelect.onchange = () => { binding.month = parseInt(monthSelect.value, 10); notify(); };
                    if (yearInput) yearInput.oninput = () => { binding.year = parseInt(yearInput.value, 10) || binding.year; notify(); };
                    if (displayModeSelect) displayModeSelect.onchange = () => { binding.displayMode = displayModeSelect.value; notify(); };
                    break;
                }
            }

            const linkSelect = container.querySelector('#var-link-target');
            if (linkSelect) linkSelect.onchange = () => {
                binding.linkedTo = linkSelect.value || '';
                if (element) this._ensureVarId(element);
                updatePreview();
                onChange(binding);
            };
        };

        typeSelect.onchange = () => {
            const newType = typeSelect.value;
            binding = newType ? VariableEngine.defaultBinding(newType) : null;
            if (element && binding) this._ensureVarId(element);
            const configEl = container.querySelector('#var-config');
            if (configEl) configEl.innerHTML = this._renderConfig(binding, element);
            bindConfigFields();
            updatePreview();
            onChange(binding);
        };

        if (element && binding && binding.type) this._ensureVarId(element);
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
