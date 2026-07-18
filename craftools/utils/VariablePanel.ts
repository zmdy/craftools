import { I18n }           from '../settings/Translations.js';
import { VariableEngine, type VariableBinding } from './VariableEngine.js';
import { loadEmojiKitchenPartners, loadEmojiKitchenSupported } from './ApiDataLoader.js';
import { renderEmojiPicker } from './EmojiPickerUI';
import './VariablePanel_Translations.js';
import '../tools/minicalendar/MiniCalendarTool_Translations.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VarElement extends HTMLElement {
    contentArea?:              HTMLElement;
    _craftoolsVariable?:       VariableBinding | null;
    _craftoolsMeta?:           Record<string, unknown>;
    _craftoolsVarId?:          string;
    _craftoolsVariablePrevHtml?: string;
}

interface LinkCandidate { id: string; label: string; }

type OnChange = (binding: VariableBinding | null) => void;

// ── Panel ─────────────────────────────────────────────────────────────────────

export class VariablePanel {

    // ── HTML ──────────────────────────────────────────────────────────────────

    static renderAccordionBody(binding: VariableBinding | null, element: VarElement | null): string {
        const type = binding?.type ?? '';
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.typeLabel')}</span>
                <select id="var-type" class="craftools-select" style="width:100%;">
                    <option value="">${I18n.t('variablePanel.typeNone')}</option>
                    <option value="date"            ${type === 'date'            ? 'selected' : ''}>${I18n.t('variablePanel.typeDate')}</option>
                    <option value="sequenceNumber"  ${type === 'sequenceNumber'  ? 'selected' : ''}>${I18n.t('variablePanel.typeSequenceNumber')}</option>
                    <option value="sequenceText"    ${type === 'sequenceText'    ? 'selected' : ''}>${I18n.t('variablePanel.typeSequenceText')}</option>
                    <option value="pageNumber"      ${type === 'pageNumber'      ? 'selected' : ''}>${I18n.t('variablePanel.typePageNumber')}</option>
                    <option value="link"            ${type === 'link'            ? 'selected' : ''}>${I18n.t('variablePanel.typeLink')}</option>
                    <option value="emoji"           ${type === 'emoji'           ? 'selected' : ''}>${I18n.t('variablePanel.typeEmoji')}</option>
                    <option value="apiPhrase"       ${type === 'apiPhrase'       ? 'selected' : ''}>${I18n.t('variablePanel.typeApiPhrase')}</option>
                    <option value="emojiKitchen"    ${type === 'emojiKitchen'    ? 'selected' : ''}>${I18n.t('variablePanel.typeEmojiKitchen')}</option>
                    <option value="miniCalendar"    ${type === 'miniCalendar'    ? 'selected' : ''}>${I18n.t('variablePanel.typeMiniCalendar')}</option>
                </select>
            </div>
            <div id="var-config">${this._renderConfig(binding, element)}</div>
            <div class="ct-field" id="var-preview" style="${type ? '' : 'display:none;'}">
                <span class="craftools-label">${I18n.t('variablePanel.previewLabel')}</span>
                <div id="var-preview-value" style="font-size:12px; padding:6px 9px; background:rgba(127,127,127,0.12); border-radius:6px; word-break:break-word; min-height:16px;">${I18n.t('variablePanel.previewLoading')}</div>
            </div>
        `;
    }

    private static _renderConfig(binding: VariableBinding | null, element: VarElement | null): string {
        if (!binding?.type) return '';
        const linkRow = this._renderLinkRow(binding, element);
        switch (binding.type) {
            case 'date':           return linkRow + this._dateConfig(binding);
            case 'sequenceNumber': return linkRow + this._seqNumberConfig(binding);
            case 'sequenceText':   return linkRow + this._seqTextConfig(binding);
            case 'pageNumber':     return linkRow + this._pageNumberConfig(binding);
            case 'link':           return linkRow + this._linkConfig(binding);
            case 'emoji':          return linkRow + this._emojiConfig(binding);
            case 'apiPhrase':      return linkRow + this._apiPhraseConfig(binding);
            case 'emojiKitchen':   return linkRow + this._emojiKitchenConfig(binding);
            case 'miniCalendar':   return linkRow + this._miniCalendarConfig(binding);
            default:               return '';
        }
    }

    // ── Link row ──────────────────────────────────────────────────────────────

    private static _renderLinkRow(binding: VariableBinding, element: VarElement | null): string {
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

    private static _findLinkCandidates(type: string, element: VarElement): LinkCandidate[] {
        if (!element?.closest) return [];
        const page   = element.closest<HTMLElement>('.craftools-page');
        const scope  = page ?? document;
        const results: LinkCandidate[] = [];
        scope.querySelectorAll<VarElement>('craftools-element').forEach(el => {
            if (el === element) return;
            const toolType = el.getAttribute('data-craftool');
            const binding  = this._getElementBinding(el, toolType);
            if (!binding || binding.type !== type || binding.linkedTo) return;
            const id = this._ensureVarId(el);
            results.push({ id, label: this._labelFor(el, toolType ?? '', binding) });
        });
        return results;
    }

    private static _getElementBinding(el: VarElement, toolType: string | null): VariableBinding | null {
        if (toolType === 'conteudovariavel') return el._craftoolsVariable ?? null;
        if (toolType === 'qrcode' || toolType === 'barcode') {
            return (el._craftoolsMeta?.variableBinding as VariableBinding | undefined) ?? null;
        }
        return null;
    }

    private static _ensureVarId(el: VarElement): string {
        if (!el._craftoolsVarId) el._craftoolsVarId = 'v' + Math.random().toString(36).slice(2, 9);
        return el._craftoolsVarId;
    }

    private static _findElementById(currentEl: VarElement | null, id: string): VarElement | null {
        if (!id) return null;
        const page  = currentEl?.closest<HTMLElement>('.craftools-page');
        const scope = page ?? document;
        let found: VarElement | null = null;
        scope.querySelectorAll<VarElement>('craftools-element').forEach(el => {
            if (el._craftoolsVarId === id) found = el;
        });
        return found;
    }

    private static _labelFor(el: VarElement, toolType: string, binding: VariableBinding): string {
        const typeKey   = 'type' + binding.type.charAt(0).toUpperCase() + binding.type.slice(1);
        const typeLabel = I18n.t('variablePanel.' + typeKey) || binding.type;
        let snippet     = '';
        if (toolType === 'conteudovariavel') {
            const ce  = el.contentArea?.querySelector<HTMLElement>('[contenteditable]');
            const raw = String(el._craftoolsVariablePrevHtml !== undefined
                ? el._craftoolsVariablePrevHtml
                : (ce?.textContent ?? ''));
            snippet = raw.replace(/<[^>]*>/g, '').trim().slice(0, 18);
        } else if (toolType === 'qrcode')   snippet = 'QR Code';
        else if (toolType === 'barcode') snippet = 'Barcode';
        return snippet ? `${typeLabel} — "${snippet}"` : typeLabel;
    }

    // ── Config HTML per type ──────────────────────────────────────────────────

    private static _dateFormats(): [string, string][] {
        return [
            ['DD/MM/YYYY','DDMMYYYY'],['DD/MM/YY','DDMMYY'],['DD/MM','DDMM'],['MM/YYYY','MMYYYY'],
            ['YYYY-MM-DD','ISO'],['DIA_MES_EXTENSO','DiaMesExtenso'],['DIA_MES_ANO_EXTENSO','DiaMesAnoExtenso'],
            ['DIA_SEMANA','DiaSemana'],['DIA_SEMANA_DATA','DiaSemanaData'],
        ];
    }

    private static _dateConfig(b: VariableBinding): string {
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.dateStartLabel')}</span>
                <input type="date" id="var-date-start" class="craftools-input" style="width:100%;" value="${this._esc(b.startDate)}">
            </div>
            <div style="display:grid; grid-template-columns: 1fr 72px; gap:10px;">
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('variablePanel.dateIntervalLabel')}</span>
                    <select id="var-date-interval" class="craftools-select" style="width:100%;">
                        <option value="none"    ${b.interval === 'none'    ? 'selected' : ''}>${I18n.t('variablePanel.dateIntervalNone')}</option>
                        <option value="daily"   ${b.interval === 'daily'   ? 'selected' : ''}>${I18n.t('variablePanel.dateIntervalDaily')}</option>
                        <option value="weekly"  ${b.interval === 'weekly'  ? 'selected' : ''}>${I18n.t('variablePanel.dateIntervalWeekly')}</option>
                        <option value="monthly" ${b.interval === 'monthly' ? 'selected' : ''}>${I18n.t('variablePanel.dateIntervalMonthly')}</option>
                        <option value="yearly"  ${b.interval === 'yearly'  ? 'selected' : ''}>${I18n.t('variablePanel.dateIntervalYearly')}</option>
                    </select>
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('variablePanel.dateStepLabel')}</span>
                    <input type="number" id="var-date-step" class="craftools-input" style="width:100%;" value="${parseInt(String(b.step), 10) || 1}" min="1">
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

    private static _seqNumberConfig(b: VariableBinding): string {
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

    private static _seqTextConfig(b: VariableBinding): string {
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

    private static _pageNumberConfig(b: VariableBinding): string {
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.pageNumberStartAtLabel')}</span>
                <input type="number" id="var-pagenum-startat" class="craftools-input" style="width:100%;" value="${b.startAt ?? 1}" min="1">
            </div>
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.pageNumberFormatLabel')}</span>
                <select id="var-pagenum-format" class="craftools-select" style="width:100%;">
                    <option value="n"          ${b.format === 'n'          ? 'selected' : ''}>${I18n.t('variablePanel.pageNumberFormatSimple')}</option>
                    <option value="n_of_total" ${b.format === 'n_of_total' ? 'selected' : ''}>${I18n.t('variablePanel.pageNumberFormatOfTotal')}</option>
                </select>
            </div>
        `;
    }

    private static _linkConfig(b: VariableBinding): string {
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

    private static _emojiConfig(b: VariableBinding): string {
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.emojiValuesLabel')}</span>
                <textarea id="var-emoji-values" class="craftools-input" rows="2" placeholder="${this._esc(I18n.t('variablePanel.emojiValuesPlaceholder'))}" style="width:100%; resize:vertical; font-family:'Noto Color Emoji', sans-serif; font-size:16px;">${this._esc(b.values)}</textarea>
                <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${I18n.t('variablePanel.emojiValuesHelp')}</span>
                <div id="var-emoji-picker-wrap" style="margin-top:8px; border:1px solid var(--border, #e4e4e7); border-radius:8px; overflow:hidden;"></div>
            </div>
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.apiPhraseModeLabel')}</span>
                <select id="var-emoji-mode" class="craftools-select" style="width:100%;">
                    <option value="sequential" ${b.mode !== 'random' ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseModeSequential')}</option>
                    <option value="random"     ${b.mode === 'random' ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseModeRandom')}</option>
                </select>
            </div>
        `;
    }

    private static _apiPhraseConfig(b: VariableBinding): string {
        const knownFields = ['', 'phrase', 'author', 'category'];
        const isCustom    = !!b.field && !knownFields.includes(b.field);
        const filterField = b.filterField ?? '';
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.apiPhraseFieldLabel')}</span>
                <select id="var-api-field-select" class="craftools-select" style="width:100%;">
                    <option value=""         ${!isCustom && !b.field  ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFieldAuto')}</option>
                    <option value="phrase"   ${b.field === 'phrase'   ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFieldPhrase')}</option>
                    <option value="author"   ${b.field === 'author'   ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFieldAuthor')}</option>
                    <option value="category" ${b.field === 'category' ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFieldCategory')}</option>
                    <option value="__custom__" ${isCustom             ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFieldCustom')}</option>
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
                    <option value=""       ${!filterField            ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFilterNone')}</option>
                    <option value="author"   ${filterField === 'author'   ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseFilterAuthor')}</option>
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
                    <option value="random"     ${b.mode === 'random' ? 'selected' : ''}>${I18n.t('variablePanel.apiPhraseModeRandom')}</option>
                </select>
            </div>
        `;
    }

    private static _emojiKitchenConfig(b: VariableBinding): string {
        const hasLeft = !!(b.leftEmoji ?? '').trim();
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.emojiKitchenLeftLabel')}</span>
                <div id="var-kitchen-left-wrap"></div>
            </div>
            <div class="ct-field" id="var-kitchen-right-wrap" style="${hasLeft ? '' : 'display:none;'}">
                <span class="craftools-label">${I18n.t('variablePanel.emojiKitchenRightLabel')}</span>
                <select id="var-kitchen-right" class="craftools-select" style="width:100%; font-family:'Noto Color Emoji', sans-serif; font-size:20px;">
                    <option value="">${I18n.t('variablePanel.previewLoading')}</option>
                </select>
                <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${I18n.t('variablePanel.emojiKitchenRightHelp')}</span>
            </div>
            <div class="ct-field" id="var-kitchen-mode-wrap" style="${hasLeft ? '' : 'display:none;'}">
                <span class="craftools-label">${I18n.t('variablePanel.emojiKitchenModeLabel')}</span>
                <select id="var-kitchen-mode" class="craftools-select" style="width:100%;">
                    <option value="sequential" ${b.mode !== 'random' ? 'selected' : ''}>${I18n.t('variablePanel.emojiKitchenModeSequential')}</option>
                    <option value="random"     ${b.mode === 'random' ? 'selected' : ''}>${I18n.t('variablePanel.emojiKitchenModeRandom')}</option>
                </select>
                <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${I18n.t('variablePanel.emojiKitchenModeHelp')}</span>
            </div>
        `;
    }

    private static _monthNamesPt(): string[] {
        return ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    }

    private static _miniCalendarConfig(b: VariableBinding): string {
        const monthOptions = this._monthNamesPt().map((name, i) =>
            `<option value="${i + 1}" ${b.month === i + 1 ? 'selected' : ''}>${name}</option>`
        ).join('');
        return `
            <div class="ct-field">
                <span class="craftools-label">${I18n.t('variablePanel.miniCalendarModeLabel')}</span>
                <select id="var-minical-mode" class="craftools-select" style="width:100%;">
                    <option value="fixed"             ${b.mode !== 'sequentialMonthly' ? 'selected' : ''}>${I18n.t('variablePanel.miniCalendarModeFixed')}</option>
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
                    <option value="diasSemana"  ${b.displayMode === 'diasSemana'  ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeDiasSemana')}</option>
                    <option value="calendario"  ${b.displayMode === 'calendario'  ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeCalendario')}</option>
                    <option value="header"      ${b.displayMode === 'header'      ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeHeader')}</option>
                    <option value="holidaysBox" ${b.displayMode === 'holidaysBox' ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeHolidaysBox')}</option>
                    <option value="moonBox"     ${b.displayMode === 'moonBox'     ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeMoonBox')}</option>
                    <option value="completo1"   ${b.displayMode === 'completo1'   ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeCompleto1')}</option>
                    <option value="completo2"   ${b.displayMode === 'completo2'   ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeCompleto2')}</option>
                </select>
            </div>
        `;
    }

    // ── Bind ──────────────────────────────────────────────────────────────────

    static bind(
        container:      HTMLElement,
        initialBinding: VariableBinding | null,
        onChange:       OnChange,
        element?:       VarElement,
    ): void {
        const typeSelect = container.querySelector<HTMLSelectElement>('#var-type');
        if (!typeSelect) return;

        let binding: VariableBinding | null = initialBinding ? { ...initialBinding } : null;

        const updatePreview = (): void => {
            const previewBox   = container.querySelector<HTMLElement>('#var-preview');
            const previewValue = container.querySelector<HTMLElement>('#var-preview-value');
            if (!binding?.type) { if (previewBox) previewBox.style.display = 'none'; return; }
            if (previewBox)   previewBox.style.display   = '';
            if (previewValue) previewValue.textContent   = I18n.t('variablePanel.previewLoading');

            const renderPreviewValue = (val: string): void => {
                if (!previewValue) return;
                if (binding!.type === 'emojiKitchen' && val) {
                    previewValue.innerHTML = `<img src="${this._esc(val)}" alt="" style="max-width:100%; max-height:60px; display:block; margin:0 auto; object-fit:contain;">`;
                } else if (binding!.type === 'miniCalendar' && val) {
                    previewValue.innerHTML = `<div style="width:120px; height:135px; margin:0 auto;">${val}</div>`;
                } else {
                    previewValue.textContent = (val?.length) ? val : '—';
                }
            };

            if (binding!.linkedTo && element) {
                const leaderEl      = this._findElementById(element, binding!.linkedTo);
                const leaderBinding = leaderEl ? this._getElementBinding(leaderEl, leaderEl.getAttribute('data-craftool')) : null;
                if (leaderBinding?.type === binding!.type) {
                    VariableEngine.prefetchApiResources([leaderBinding, binding]).then(apiCache => {
                        const picks = VariableEngine.newLinkRegistry();
                        VariableEngine.resolve(leaderBinding, {}, apiCache, { id: '__leader__', picks });
                        const val = VariableEngine.resolve({ ...binding!, linkedTo: '__leader__' }, {}, apiCache, { id: '__me__', picks });
                        renderPreviewValue(val);
                    });
                    return;
                }
            }

            VariableEngine.resolvePreview(binding!).then(val => { renderPreviewValue(val); });
        };

        const bindConfigFields = (): void => {
            if (!binding?.type) return;
            const notify = (): void => { updatePreview(); onChange(binding); };

            switch (binding.type) {
                case 'date': {
                    const startInput    = container.querySelector<HTMLInputElement>('#var-date-start');
                    const intervalSel   = container.querySelector<HTMLSelectElement>('#var-date-interval');
                    const stepInput     = container.querySelector<HTMLInputElement>('#var-date-step');
                    const formatSel     = container.querySelector<HTMLSelectElement>('#var-date-format');
                    if (startInput)  startInput.oninput    = () => { binding!.startDate = startInput.value;                                notify(); };
                    if (intervalSel) intervalSel.onchange  = () => { binding!.interval  = intervalSel.value;                               notify(); };
                    if (stepInput)   stepInput.oninput     = () => { binding!.step      = parseInt(stepInput.value, 10) || 1;              notify(); };
                    if (formatSel)   formatSel.onchange    = () => { binding!.format    = formatSel.value;                                notify(); };
                    break;
                }
                case 'sequenceNumber': {
                    const startInput   = container.querySelector<HTMLInputElement>('#var-seqnum-start');
                    const stepInput    = container.querySelector<HTMLInputElement>('#var-seqnum-step');
                    const paddingInput = container.querySelector<HTMLInputElement>('#var-seqnum-padding');
                    const prefixInput  = container.querySelector<HTMLInputElement>('#var-seqnum-prefix');
                    const suffixInput  = container.querySelector<HTMLInputElement>('#var-seqnum-suffix');
                    if (startInput)   startInput.oninput   = () => { binding!.start   = startInput.value;   notify(); };
                    if (stepInput)    stepInput.oninput    = () => { binding!.step    = stepInput.value;    notify(); };
                    if (paddingInput) paddingInput.oninput = () => { binding!.padding = paddingInput.value; notify(); };
                    if (prefixInput)  prefixInput.oninput  = () => { binding!.prefix  = prefixInput.value;  notify(); };
                    if (suffixInput)  suffixInput.oninput  = () => { binding!.suffix  = suffixInput.value;  notify(); };
                    break;
                }
                case 'sequenceText': {
                    const valuesInput = container.querySelector<HTMLTextAreaElement>('#var-seqtext-values');
                    const loopInput   = container.querySelector<HTMLInputElement>('#var-seqtext-loop');
                    if (valuesInput) valuesInput.oninput  = () => { binding!.values = valuesInput.value;  notify(); };
                    if (loopInput)   loopInput.onchange   = () => { binding!.loop   = loopInput.checked;  notify(); };
                    break;
                }
                case 'pageNumber': {
                    const startAtInput = container.querySelector<HTMLInputElement>('#var-pagenum-startat');
                    const formatSel    = container.querySelector<HTMLSelectElement>('#var-pagenum-format');
                    if (startAtInput) startAtInput.oninput = () => { binding!.startAt = startAtInput.value; notify(); };
                    if (formatSel)    formatSel.onchange   = () => { binding!.format  = formatSel.value;    notify(); };
                    break;
                }
                case 'link': {
                    const urlInput      = container.querySelector<HTMLInputElement>('#var-link-url');
                    const appendInput   = container.querySelector<HTMLInputElement>('#var-link-append');
                    const startAtField  = container.querySelector<HTMLElement>('#var-link-startat-field');
                    const startAtInput  = container.querySelector<HTMLInputElement>('#var-link-startat');
                    if (urlInput) urlInput.oninput = () => { binding!.url = urlInput.value; notify(); };
                    if (appendInput) appendInput.onchange = () => {
                        binding!.appendIndex = appendInput.checked;
                        if (startAtField) startAtField.style.display = appendInput.checked ? '' : 'none';
                        notify();
                    };
                    if (startAtInput) startAtInput.oninput = () => { binding!.startAt = startAtInput.value; notify(); };
                    break;
                }
                case 'emoji': {
                    const valuesInput = container.querySelector<HTMLTextAreaElement>('#var-emoji-values');
                    const modeSel     = container.querySelector<HTMLSelectElement>('#var-emoji-mode');
                    const pickerWrap  = container.querySelector<HTMLElement>('#var-emoji-picker-wrap');
                    if (valuesInput) valuesInput.oninput = () => { binding!.values = valuesInput.value; notify(); };
                    if (modeSel)     modeSel.onchange    = () => { binding!.mode   = modeSel.value;    notify(); };
                    // Same standardized grid picker as EmojiTool/EmojiKitchenTool
                    // (utils/EmojiPickerUI.ts) instead of a bare text field --
                    // appends the picked emoji to the end of the free-form list
                    // textarea rather than replacing it (this field holds a LIST
                    // of emojis, unlike EmojiTool's single-character field).
                    if (pickerWrap) {
                        renderEmojiPicker(pickerWrap, {
                            draggable: false,
                            onSelect: (emoji) => {
                                if (valuesInput) {
                                    valuesInput.value = (valuesInput.value || '') + emoji;
                                    binding!.values = valuesInput.value;
                                }
                                notify();
                            },
                        });
                    }
                    break;
                }
                case 'apiPhrase': {
                    const fieldSel         = container.querySelector<HTMLSelectElement>('#var-api-field-select');
                    const fieldCustom      = container.querySelector<HTMLInputElement>('#var-api-field-custom');
                    const collectionSel    = container.querySelector<HTMLSelectElement>('#var-api-collection');
                    const filterFieldSel   = container.querySelector<HTMLSelectElement>('#var-api-filter-field');
                    const filterValueWrap  = container.querySelector<HTMLElement>('#var-api-filter-value-wrap');
                    const filterValueSel   = container.querySelector<HTMLSelectElement>('#var-api-filter-value');
                    const modeSel          = container.querySelector<HTMLSelectElement>('#var-api-mode');

                    if (fieldSel) fieldSel.onchange = () => {
                        if (fieldSel.value === '__custom__') {
                            if (fieldCustom) { fieldCustom.style.display = ''; fieldCustom.focus(); }
                            binding!.field = fieldCustom?.value ?? '';
                        } else {
                            if (fieldCustom) fieldCustom.style.display = 'none';
                            binding!.field = fieldSel.value;
                        }
                        notify();
                    };
                    if (fieldCustom) fieldCustom.oninput = () => { binding!.field = fieldCustom.value; notify(); };

                    const loadFilterValues = async (selectedValue: string): Promise<void> => {
                        if (!filterValueSel) return;
                        filterValueSel.innerHTML = `<option value="">${I18n.t('variablePanel.apiPhraseFilterLoading')}</option>`;
                        const values = await VariableEngine.loadFilterOptions(binding!.filterField ?? '', binding!.collection);
                        filterValueSel.innerHTML = values.length
                            ? values.map(v => `<option value="${this._esc(v)}" ${v === selectedValue ? 'selected' : ''}>${this._esc(v)}</option>`).join('')
                            : `<option value="">${I18n.t('variablePanel.apiPhraseFilterEmpty')}</option>`;
                        if (!values.includes(binding!.filterValue ?? '')) {
                            binding!.filterValue = values[0] ?? '';
                            notify();
                        }
                    };

                    const loadCollections = async (): Promise<void> => {
                        if (!collectionSel) return;
                        const names = await VariableEngine.loadPhraseCollectionOptions();
                        const noneLabel = I18n.t('variablePanel.apiPhraseCollectionNone');
                        collectionSel.innerHTML = [`<option value="">${noneLabel}</option>`]
                            .concat(names.map(n => `<option value="${this._esc(n)}" ${binding!.collection === n ? 'selected' : ''}>${this._esc(n)}</option>`))
                            .join('');
                        if (binding!.collection && !names.includes(binding!.collection)) {
                            binding!.collection = '';
                            notify();
                        }
                    };

                    if (collectionSel) collectionSel.onchange = () => {
                        binding!.collection = collectionSel.value;
                        if (binding!.filterField) loadFilterValues('');
                        notify();
                    };
                    if (filterFieldSel) filterFieldSel.onchange = () => {
                        binding!.filterField  = filterFieldSel.value;
                        binding!.filterValue  = '';
                        if (filterValueWrap) filterValueWrap.style.display = binding!.filterField ? '' : 'none';
                        if (binding!.filterField) loadFilterValues('');
                        notify();
                    };
                    if (filterValueSel) filterValueSel.onchange = () => { binding!.filterValue = filterValueSel.value; notify(); };
                    if (modeSel)        modeSel.onchange        = () => { binding!.mode        = modeSel.value;        notify(); };

                    loadCollections();
                    if (binding.filterField) loadFilterValues(binding.filterValue ?? '');
                    break;
                }
                case 'emojiKitchen': {
                    const leftWrap   = container.querySelector<HTMLElement>('#var-kitchen-left-wrap');
                    const rightSel   = container.querySelector<HTMLSelectElement>('#var-kitchen-right');
                    const rightWrap  = container.querySelector<HTMLElement>('#var-kitchen-right-wrap');
                    const modeWrap   = container.querySelector<HTMLElement>('#var-kitchen-mode-wrap');
                    const modeSel    = container.querySelector<HTMLSelectElement>('#var-kitchen-mode');

                    let currentPartners: string[] = [];
                    let supportedSet: Set<string> | null = null;

                    const renderRightOptions = (): void => {
                        if (!rightSel) return;
                        const opts = [`<option value="">${I18n.t('variablePanel.emojiKitchenRightSelf') || 'Combinar com ele mesmo'}</option>`]
                            .concat(currentPartners.map(p => `<option value="${this._esc(p)}" ${binding!.rightEmoji === p ? 'selected' : ''}>${this._esc(p)}</option>`));
                        rightSel.innerHTML = opts.join('');
                        if (binding!.rightEmoji && !currentPartners.includes(binding!.rightEmoji)) binding!.rightEmoji = '';
                    };

                    const loadPartners = async (): Promise<void> => {
                        const left = (binding!.leftEmoji ?? '').trim();
                        if (!left || !rightSel) return;
                        rightSel.innerHTML = `<option value="">${I18n.t('variablePanel.previewLoading')}</option>`;
                        const partners = (await loadEmojiKitchenPartners(left)) as string[];
                        currentPartners = partners.filter(p => p !== left);
                        renderRightOptions();
                    };

                    // Same standardized category-tab + search + grid picker as
                    // EmojiTool.ts / EmojiKitchenTool.ts (utils/EmojiPickerUI.ts,
                    // via utils/fields/emoji-kitchen-pair.field.ts's identical
                    // pattern) instead of a bare text input, filtered down to
                    // only emojis that actually have Emoji Kitchen combos.
                    const paintLeft = (): void => {
                        if (!leftWrap) return;
                        renderEmojiPicker(leftWrap, {
                            selected:  binding!.leftEmoji ?? '',
                            draggable: false,
                            loading:   supportedSet === null,
                            filter:    supportedSet ? (e) => supportedSet!.has(e) : undefined,
                            onSelect:  (emoji) => {
                                binding!.leftEmoji  = emoji;
                                binding!.rightEmoji = '';
                                const hasLeftNow    = !!emoji;
                                if (rightWrap) rightWrap.style.display = hasLeftNow ? '' : 'none';
                                if (modeWrap)  modeWrap.style.display  = hasLeftNow ? '' : 'none';
                                notify();
                                loadPartners();
                                // Repaint immediately so the "selected" highlight
                                // shows without waiting on the supported-set
                                // promise again (already resolved by this point).
                                paintLeft();
                            },
                        });
                    };

                    paintLeft(); // loading placeholder first
                    loadEmojiKitchenSupported().then(list => { supportedSet = new Set(list as string[]); paintLeft(); });
                    loadPartners();

                    if (rightSel) rightSel.onchange = () => { binding!.rightEmoji = rightSel.value; notify(); };
                    if (modeSel)  modeSel.onchange  = () => { binding!.mode       = modeSel.value;  notify(); };
                    break;
                }
                case 'miniCalendar': {
                    const modeSel        = container.querySelector<HTMLSelectElement>('#var-minical-mode');
                    const monthSel       = container.querySelector<HTMLSelectElement>('#var-minical-month');
                    const yearInput      = container.querySelector<HTMLInputElement>('#var-minical-year');
                    const displayModeSel = container.querySelector<HTMLSelectElement>('#var-minical-displaymode');
                    if (modeSel)        modeSel.onchange        = () => { binding!.mode        = modeSel.value;                              notify(); };
                    if (monthSel)       monthSel.onchange       = () => { binding!.month       = parseInt(monthSel.value, 10);               notify(); };
                    if (yearInput)      yearInput.oninput       = () => { binding!.year        = parseInt(yearInput.value, 10) || binding!.year; notify(); };
                    if (displayModeSel) displayModeSel.onchange = () => { binding!.displayMode = displayModeSel.value;                       notify(); };
                    break;
                }
            }

            const linkSelect = container.querySelector<HTMLSelectElement>('#var-link-target');
            if (linkSelect) linkSelect.onchange = () => {
                binding!.linkedTo = linkSelect.value ?? '';
                if (element) this._ensureVarId(element);
                updatePreview();
                onChange(binding);
            };
        };

        typeSelect.onchange = () => {
            const newType = typeSelect.value;
            binding = newType ? VariableEngine.defaultBinding(newType) : null;
            if (element && binding) this._ensureVarId(element);
            const configEl = container.querySelector<HTMLElement>('#var-config');
            if (configEl) configEl.innerHTML = this._renderConfig(binding, element ?? null);
            bindConfigFields();
            updatePreview();
            onChange(binding);
        };

        if (element && binding?.type) this._ensureVarId(element);
        bindConfigFields();
        updatePreview();
    }

    // ── Util ──────────────────────────────────────────────────────────────────

    static _esc(val: unknown): string {
        return String(val == null ? '' : val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
