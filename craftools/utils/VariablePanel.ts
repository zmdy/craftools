import { I18n }           from '../settings/Translations.js';
import { VariableEngine, type VariableBinding } from './VariableEngine.js';
import { loadEmojiKitchenPartners, loadEmojiKitchenSupported } from './ApiDataLoader.js';
import { renderEmojiPicker } from './EmojiPickerUI';
import { withEmojiFallback } from './EmojiFont.js';
import { renderColorPicker, normalizeValue } from './ColorPickerUI.js';
import { PropertyRenderer } from './PropertyRenderer.js';
import { parseVariableBinding } from './fields/variable-binding.field.js';
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
                <div id="var-preview-value" style="font-size:12px; padding:6px 9px; background:rgba(127,127,127,0.12); border-radius:6px; word-break:break-word; min-height:16px; font-family:${withEmojiFallback('DM Sans')};">${I18n.t('variablePanel.previewLoading')}</div>
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
            case 'miniCalendar':   return linkRow + this._miniCalendarConfig(binding, element);
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

    /**
     * Same in-memory-first, `dataset.ctState`-fallback pattern as
     * AgendaExport.ts's own `_getBinding()` (kept in sync with it
     * deliberately -- see that method's doc comment for the full
     * rationale). Without the fallback, a freshly pasted Variable Content
     * copy never showed up as a "Vincular a" candidate for any OTHER
     * element: Editor.ts's paste only copies `_craftoolsMeta`/
     * `_craftoolsAutoResize` onto the clone, never `_craftoolsVariable`
     * (an in-memory-only property, deliberately not shared by reference
     * with the original -- see the paste code), so the copy's binding
     * stayed invisible to `_findLinkCandidates()` until the user happened
     * to select it once (which is what actually primes
     * `_craftoolsVariable`, via `VariableContentTool._syncFromDOM()`).
     * `dataset.ctState` is a real HTML attribute that DOES survive the
     * clone, so it's always at least as current as whatever was last saved
     * through the panel.
     */
    private static _getElementBinding(el: VarElement, toolType: string | null): VariableBinding | null {
        if (toolType === 'variablecontent') {
            if (el._craftoolsVariable) return el._craftoolsVariable;
            const state = PropertyRenderer._readState(el);
            return 'variableBinding' in state ? parseVariableBinding(state.variableBinding) : null;
        }
        if (toolType === 'qrcode' || toolType === 'barcode') {
            const meta = el._craftoolsMeta as (Record<string, unknown> & { variableBinding?: VariableBinding }) | undefined;
            if (meta?.variableBinding) return meta.variableBinding;
            const state = PropertyRenderer._readState(el);
            return 'variableBinding' in state ? parseVariableBinding(state.variableBinding) : null;
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
        if (toolType === 'variablecontent') {
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

    /**
     * The 9 multi-select "piece" buttons shown above the always-visible
     * custom format box (replaces the old single-select `<select>` of ~17
     * mutually-exclusive whole formats). Clicking one inserts/removes its
     * `token` inside the custom format text (see _formatCustomDate() in
     * VariableEngine.ts) -- several can be active at once, composing
     * together into the same string, instead of picking one whole format.
     * Display order here is also the button row's order. Dia/Mês/Ano use
     * the compact 2-/4-digit tokens (not e.g. 'mmmm') specifically so they
     * match defaultBinding()'s starting customFormat ('dd/mm/yyyy') --
     * those three are the ones selected by default (see defaultBinding()
     * in VariableEngine.ts).
     */
    private static _dateFormatButtons(): { token: string; i18nKey: string }[] {
        return [
            { token: 'dd',          i18nKey: 'dateBtnDay' },
            { token: 'mm',          i18nKey: 'dateBtnMonth' },
            { token: 'yyyy',        i18nKey: 'dateBtnYear' },
            { token: 'wwww',        i18nKey: 'dateBtnWeekday' },
            { token: '{dayofyear}', i18nKey: 'dateBtnDayOfYear' },
            { token: '{season}',    i18nKey: 'dateBtnSeason' },
            { token: '{moon}',      i18nKey: 'dateBtnMoonPhase' },
            { token: '{zodiac}',    i18nKey: 'dateBtnZodiac' },
            { token: '{holiday}',   i18nKey: 'dateBtnHoliday' },
        ];
    }

    /**
     * Best-effort custom-token equivalent of a legacy whole `format` value
     * (every format that isn't 'CUSTOM' itself), used ONLY to pre-fill the
     * now-always-visible custom format box + button active-states the
     * first time a binding saved under the old single-select system is
     * opened in the panel -- doesn't mutate the binding by itself, so a
     * binding untouched by the user keeps resolving exactly as before
     * (still via _formatDate()'s own dedicated case for that format, see
     * VariableEngine.ts). Only once the user actually edits a button/the
     * custom box does bindConfigFields() flip `binding.format` to 'CUSTOM'
     * for real, seeded from this same string. 'DAYS_BOX' has no text
     * equivalent (its own dedicated option block stays reachable via
     * `b.format === 'DAYS_BOX'` instead, see _dateConfig()).
     */
    private static _legacyFormatToCustomToken(format?: string): string {
        switch (format) {
            case 'DD/MM/YYYY':          return 'dd/mm/yyyy';
            case 'DD/MM/YY':            return 'dd/mm/yy';
            case 'DD/MM':               return 'dd/mm';
            case 'MM/YYYY':             return 'mm/yyyy';
            case 'YYYY-MM-DD':          return 'yyyy-mm-dd';
            case 'DAY_MONTH_LONG':      return 'd [de] mmmm';
            case 'DAY_MONTH_YEAR_LONG': return 'd [de] mmmm [de] yyyy';
            case 'WEEKDAY':             return 'wwww';
            case 'WEEKDAY_SHORT':       return 'ww';
            case 'WEEKDAY_DATE':        return 'wwww, dd/mm';
            case 'DAY_ONLY':            return 'd';
            case 'MONTH_ONLY':          return 'mmmm';
            case 'DAY_OF_YEAR':         return '{dayofyear}';
            case 'SPECIAL_DATE':        return '{holiday}';
            case 'MOON_PHASE':          return '{moon}';
            case 'SEASON':              return '{season}';
            case 'ZODIAC':              return '{zodiac}';
            case 'DAYS_BOX':            return '';
            case 'CUSTOM':              return '';
            default:                    return 'dd/mm/yyyy';
        }
    }

    private static _dateConfig(b: VariableBinding): string {
        // Best-effort text driving both the always-visible custom box and
        // the buttons' initial active state: the binding's own customFormat
        // when it's already 'CUSTOM', otherwise a derived equivalent for
        // whatever legacy whole format it currently has (see
        // _legacyFormatToCustomToken()) -- purely for display until the
        // user actually edits something (see that method's doc comment).
        const customValue = b.format === 'CUSTOM' ? (b.customFormat ?? '') : this._legacyFormatToCustomToken(b.format);
        const hasToken = (t: string) => customValue.toLowerCase().includes(t.toLowerCase());
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
                <div id="var-date-format-buttons" class="ct-field-row" style="gap:4px; flex-wrap:wrap;">
                    ${this._dateFormatButtons().map(({ token, i18nKey }) => `
                        <button type="button" class="craftools-pill var-date-fmt-btn ${hasToken(token) ? 'active' : ''}" data-token="${this._esc(token)}">${I18n.t('variablePanel.' + i18nKey)}</button>
                    `).join('')}
                    <button type="button" id="var-date-daysbox-btn" class="craftools-pill ${b.format === 'DAYS_BOX' ? 'active' : ''}">${I18n.t('variablePanel.dateFormatDaysBox')}</button>
                </div>
            </div>

            <div id="var-date-daysbox-options" style="display: ${b.format === 'DAYS_BOX' ? 'block' : 'none'}; margin-top: 10px; padding: 10px; background: var(--bg-surface); border-radius: 6px; border: 1px solid var(--border);">
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('variablePanel.dateDaysBoxColor')}</span>
                    <div id="var-date-daysbox-color-picker"></div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div class="ct-field">
                        <span class="craftools-label">${I18n.t('variablePanel.dateDaysBoxRadius')}</span>
                        <input type="number" id="var-date-daysbox-radius" class="craftools-input" style="width:100%;" value="${b.daysBoxBorderRadius !== undefined ? b.daysBoxBorderRadius : 50}" min="0">
                    </div>
                    <div class="ct-field">
                        <span class="craftools-label">${I18n.t('variablePanel.dateDaysBoxPadding')}</span>
                        <input type="number" id="var-date-daysbox-padding" class="craftools-input" style="width:100%;" value="${b.daysBoxPadding !== undefined ? b.daysBoxPadding : 4}" min="0">
                    </div>
                </div>
                <div class="ct-field" style="margin-top:10px;">
                    <span class="craftools-label">${I18n.t('variablePanel.dateDaysBoxHeight')}</span>
                    <input type="number" id="var-date-daysbox-height" class="craftools-input" style="width:100%;"
                        value="${b.daysBoxHeight !== undefined ? b.daysBoxHeight : ''}" min="0"
                        placeholder="${this._esc(I18n.t('variablePanel.dateDaysBoxHeightPlaceholder'))}">
                    <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">${I18n.t('variablePanel.dateDaysBoxHeightHelp')}</span>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                    <div class="ct-field">
                        <span class="craftools-label">${I18n.t('common.borderStyle')}</span>
                        <select id="var-date-daysbox-borderstyle" class="craftools-select" style="width:100%;">
                            ${['solid','dashed','dotted','double','groove','ridge','inset','outset','none'].map(style => `
                                <option value="${style}" ${(b.daysBoxBorderStyle || 'solid') === style ? 'selected' : ''}>${I18n.t('common.border' + style.charAt(0).toUpperCase() + style.slice(1))}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="ct-field">
                        <span class="craftools-label">${I18n.t('common.borderWidth')}</span>
                        <input type="number" id="var-date-daysbox-borderwidth" class="craftools-input" style="width:100%;" value="${b.daysBoxBorderWidth !== undefined ? b.daysBoxBorderWidth : 1}" min="0">
                    </div>
                </div>
                <div class="ct-field" style="margin-top:10px;">
                    <span class="craftools-label">${I18n.t('common.borderColor')}</span>
                    <div id="var-date-daysbox-bordercolor-picker"></div>
                </div>
                <label class="ct-field" style="flex-direction:row; align-items:center; gap:6px; cursor:pointer; margin-top: 6px;">
                    <input type="checkbox" id="var-date-daysbox-sunday" ${b.daysBoxStartSunday ? 'checked' : ''}>
                    <span class="craftools-label" style="margin:0;">${I18n.t('variablePanel.dateDaysBoxSundayFirst')}</span>
                </label>
            </div>

            <div id="var-date-custom-options" style="display: block; margin-top: 10px; padding: 10px; background: var(--bg-surface); border-radius: 6px; border: 1px solid var(--border);">
                <div style="font-size:11px; color:var(--text-muted); line-height:1.6; margin-bottom:8px;">
                    ${I18n.t('variablePanel.dateCustomLegend')}
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('variablePanel.dateCustomLabel')}</span>
                    <input type="text" id="var-date-custom-format" class="craftools-input" style="width:100%;"
                        placeholder="${this._esc(I18n.t('variablePanel.dateCustomPlaceholder'))}"
                        value="${this._esc(customValue)}">
                </div>
            </div>

            <div id="var-date-special-options" style="display: ${hasToken('{holiday}') ? 'block' : 'none'}; margin-top: 10px; padding: 10px; background: var(--bg-surface); border-radius: 6px; border: 1px solid var(--border);">
                ${this._specialDateCategoriesFields(b)}
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                    <div class="ct-field">
                        <span class="craftools-label">${I18n.t('variablePanel.dateSpecialLimitLabel')}</span>
                        <input type="number" id="var-date-special-limit" class="craftools-input" style="width:100%;" min="1"
                            placeholder="${this._esc(I18n.t('variablePanel.dateSpecialLimitPlaceholder'))}"
                            value="${b.specialDateLimit !== undefined && b.specialDateLimit !== '' ? b.specialDateLimit : ''}">
                    </div>
                    <label class="ct-field" style="flex-direction:row; align-items:center; gap:6px; cursor:pointer; margin-top:18px;">
                        <input type="checkbox" id="var-date-special-randomize" ${b.specialDateRandomize ? 'checked' : ''}>
                        <span class="craftools-label" style="margin:0;">${I18n.t('variablePanel.dateSpecialRandomizeLabel')}</span>
                    </label>
                </div>
                <div class="ct-field" style="margin-top:10px;">
                    <span class="craftools-label">${I18n.t('variablePanel.dateSpecialSeparatorLabel')}</span>
                    <input type="text" id="var-date-special-separator" class="craftools-input" style="width:100%;"
                        value="${this._esc(b.specialDateSeparator ?? ', ')}">
                </div>
                <div class="ct-field" style="margin-top:10px;">
                    <span class="craftools-label">${I18n.t('variablePanel.dateSpecialEmptyTextLabel')}</span>
                    <input type="text" id="var-date-special-emptytext" class="craftools-input" style="width:100%;"
                        placeholder="${this._esc(I18n.t('variablePanel.dateSpecialEmptyTextPlaceholder'))}"
                        value="${this._esc(b.specialDateEmptyText)}">
                </div>
            </div>

            <div id="var-date-season-options" style="display: ${hasToken('{season}') ? 'block' : 'none'}; margin-top: 10px; padding: 10px; background: var(--bg-surface); border-radius: 6px; border: 1px solid var(--border);">
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('variablePanel.dateHemisphereLabel')}</span>
                    <select id="var-date-hemisphere" class="craftools-select" style="width:100%;">
                        <option value="south" ${(b.hemisphere ?? 'south') === 'south' ? 'selected' : ''}>${I18n.t('variablePanel.dateHemisphereSouth')}</option>
                        <option value="north" ${b.hemisphere === 'north' ? 'selected' : ''}>${I18n.t('variablePanel.dateHemisphereNorth')}</option>
                    </select>
                </div>
            </div>

            <div id="var-date-calendar-options" style="display: ${(this._isCalendarPartsFormat(b.format) || hasToken('{season}') || hasToken('{moon}') || hasToken('{zodiac}')) ? 'block' : 'none'}; margin-top: 10px; padding: 10px; background: var(--bg-surface); border-radius: 6px; border: 1px solid var(--border);">
                <span class="craftools-label">${I18n.t('variablePanel.dateCalendarModeLabel')}</span>
                <div class="ct-field-row" style="gap:4px; margin-top:4px;">
                    <button type="button" class="craftools-pill var-date-calendar-mode-btn ${(b.calendarDisplay ?? 'text') === 'text' ? 'active' : ''}" data-mode="text">${I18n.t('variablePanel.dateCalendarModeText')}</button>
                    <button type="button" class="craftools-pill var-date-calendar-mode-btn ${b.calendarDisplay === 'icon' ? 'active' : ''}" data-mode="icon">${I18n.t('variablePanel.dateCalendarModeIcon')}</button>
                    <button type="button" class="craftools-pill var-date-calendar-mode-btn ${b.calendarDisplay === 'emoji' ? 'active' : ''}" data-mode="emoji">${I18n.t('variablePanel.dateCalendarModeEmoji')}</button>
                </div>
            </div>
        `;
    }

    /**
     * Which 'date' formats expose the shared text/icon/emoji single-select
     * display mode (VariableBinding's `calendarDisplay` -- see
     * VariableEngine.ts's _renderCalendarInfo()). 'DAYS_BOX' is
     * intentionally excluded even though it's also an HTML-returning
     * format (VariableEngine.HTML_DATE_FORMATS) -- it has its own,
     * unrelated set of options (colors/border/padding), not an icon or
     * emoji. Only matters for a binding still on one of these legacy whole
     * formats (pre-dating the multi-select custom-token redesign) --
     * once on 'CUSTOM', visibility instead follows whether any of
     * {season}/{moon}/{zodiac} is present in the text (see the `hasToken`
     * checks at this method's call site).
     */
    private static _isCalendarPartsFormat(format?: string): boolean {
        return format === 'MOON_PHASE' || format === 'SEASON' || format === 'ZODIAC';
    }

    private static _specialDateCategories(): [string, string][] {
        return [
            ['holiday',       'dateSpecialCategoryHoliday'],
            ['commemoration', 'dateSpecialCategoryCommemoration'],
            ['saint',         'dateSpecialCategorySaint'],
            ['event',         'dateSpecialCategoryEvent'],
        ];
    }

    private static _specialDateCategoriesFields(b: VariableBinding): string {
        const active = b.specialDateCategories?.length ? b.specialDateCategories : ['holiday', 'commemoration', 'saint', 'event'];
        return `
            <span class="craftools-label">${I18n.t('variablePanel.dateSpecialCategoriesLabel')}</span>
            ${this._specialDateCategories().map(([cat, key]) => `
                <label class="ct-field" style="flex-direction:row; align-items:center; gap:6px; cursor:pointer; margin-top:4px;">
                    <input type="checkbox" class="var-date-special-cat" value="${cat}" ${active.includes(cat) ? 'checked' : ''}>
                    <span class="craftools-label" style="margin:0;">${I18n.t('variablePanel.' + key)}</span>
                </label>
            `).join('')}
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

    private static _miniCalendarConfig(b: VariableBinding, element: VarElement | null): string {
        const monthOptions = this._monthNamesPt().map((name, i) =>
            `<option value="${i + 1}" ${b.month === i + 1 ? 'selected' : ''}>${name}</option>`
        ).join('');
        const highlightDaySource = b.miniCalendarHighlightDaySource ?? 'today';
        const highlightLinked = highlightDaySource === 'linked';
        // Candidates for "link the highlight day to a date variable" -- any
        // OTHER 'date'-type binding on the page (same _findLinkCandidates()
        // the generic "Vincular a" row above uses, just called with the
        // literal 'date' type instead of this binding's own 'miniCalendar'
        // type, since the highlight day is sourced from a *different*-typed
        // element than the miniCalendar binding itself). Rendered in the
        // SAME top position the generic link row occupies for every other
        // variable type, as a single toggle -- ON pulls the highlight day
        // from the chosen date variable, OFF falls back to today.
        const dateLinkCandidates = element ? this._findLinkCandidates('date', element) : [];
        const dateLinkOptions = dateLinkCandidates.map(c =>
            `<option value="${this._esc(c.id)}" ${b.miniCalendarHighlightLinkedTo === c.id ? 'selected' : ''}>${this._esc(c.label)}</option>`
        ).join('');
        const highlightLinkRow = dateLinkCandidates.length ? `
            <div class="ct-field" id="var-minical-highlightlink-wrap">
                <label class="ct-toggle-label" style="display:flex; align-items:center; cursor:pointer; gap:6px;">
                    <input type="checkbox" id="var-minical-highlight-linked-toggle" class="ct-fi" style="display:none;" ${highlightLinked ? 'checked' : ''}>
                    <span class="ct-toggle-track" style="width:32px; height:18px; border-radius:99px; background:${highlightLinked ? 'var(--accent)' : 'var(--border)'}; position:relative; transition:background .15s; flex-shrink:0;">
                        <span class="ct-toggle-thumb" style="position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:#fff; transition:transform .15s; box-shadow:0 1px 3px rgba(0,0,0,.2); transform:${highlightLinked ? 'translateX(14px)' : 'translateX(0)'};"></span>
                    </span>
                    <span class="craftools-label" style="margin:0;">${I18n.t('variablePanel.miniCalendarHighlightLinkToggle')}</span>
                </label>
                <div id="var-minical-highlight-linked-wrap" style="display:${highlightLinked ? '' : 'none'}; margin-top:8px;">
                    <select id="var-minical-highlight-linked" class="craftools-select" style="width:100%;">
                        <option value="">${I18n.t('variablePanel.linkTargetNone')}</option>
                        ${dateLinkOptions}
                    </select>
                </div>
            </div>
        ` : '';
        return `
            ${highlightLinkRow}
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
                    <option value="weekdays"    ${b.displayMode === 'weekdays'    ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeWeekdays')}</option>
                    <option value="calendar"    ${b.displayMode === 'calendar'    ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeCalendar')}</option>
                    <option value="header"      ${b.displayMode === 'header'      ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeHeader')}</option>
                    <option value="holidaysBox" ${b.displayMode === 'holidaysBox' ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeHolidaysBox')}</option>
                    <option value="moonBox"     ${b.displayMode === 'moonBox'     ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeMoonBox')}</option>
                    <option value="complete1"   ${b.displayMode === 'complete1'   ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeComplete1')}</option>
                    <option value="complete2"   ${b.displayMode === 'complete2'   ? 'selected' : ''}>${I18n.t('miniCalendarTool.modeComplete2')}</option>
                </select>
            </div>
            <div class="ct-field" style="margin-top:6px;">
                <label class="ct-toggle-label" style="display:flex; align-items:center; cursor:pointer; gap:6px;">
                    <input type="checkbox" id="var-minical-week-sunday" class="ct-fi" style="display:none;" ${b.weekStartSunday !== false ? 'checked' : ''}>
                    <span class="ct-toggle-track" style="width:32px; height:18px; border-radius:99px; background:${b.weekStartSunday !== false ? 'var(--accent)' : 'var(--border)'}; position:relative; transition:background .15s; flex-shrink:0;">
                        <span class="ct-toggle-thumb" style="position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:#fff; transition:transform .15s; box-shadow:0 1px 3px rgba(0,0,0,.2); transform:${b.weekStartSunday !== false ? 'translateX(14px)' : 'translateX(0)'};"></span>
                    </span>
                    <span class="craftools-label" style="margin:0;">${I18n.t('variablePanel.miniCalendarWeekStartSunday')}</span>
                </label>
            </div>
            <div class="ct-field" style="margin-top:6px;">
                <label class="ct-toggle-label" style="display:flex; align-items:center; cursor:pointer; gap:6px;">
                    <input type="checkbox" id="var-minical-highlight-enabled" class="ct-fi" style="display:none;" ${b.miniCalendarHighlightEnabled ? 'checked' : ''}>
                    <span class="ct-toggle-track" style="width:32px; height:18px; border-radius:99px; background:${b.miniCalendarHighlightEnabled ? 'var(--accent)' : 'var(--border)'}; position:relative; transition:background .15s; flex-shrink:0;">
                        <span class="ct-toggle-thumb" style="position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:#fff; transition:transform .15s; box-shadow:0 1px 3px rgba(0,0,0,.2); transform:${b.miniCalendarHighlightEnabled ? 'translateX(14px)' : 'translateX(0)'};"></span>
                    </span>
                    <span class="craftools-label" style="margin:0;">${I18n.t('variablePanel.miniCalendarHighlightToggle')}</span>
                </label>
            </div>
            <div id="var-minical-highlight-options" style="display: ${b.miniCalendarHighlightEnabled ? 'block' : 'none'}; margin-top: 10px; padding: 10px; background: var(--bg-surface); border-radius: 6px; border: 1px solid var(--border);">
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('variablePanel.miniCalendarHighlightBg')}</span>
                    <div id="var-minical-highlight-bg-picker"></div>
                </div>
                <div class="ct-field">
                    <span class="craftools-label">${I18n.t('variablePanel.miniCalendarHighlightTextColor')}</span>
                    <div id="var-minical-highlight-text-picker"></div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                    <div class="ct-field">
                        <span class="craftools-label">${I18n.t('common.borderStyle')}</span>
                        <select id="var-minical-highlight-borderstyle" class="craftools-select" style="width:100%;">
                            ${['solid','dashed','dotted','double','none'].map(style => `
                                <option value="${style}" ${(b.miniCalendarHighlightBorderStyle || 'solid') === style ? 'selected' : ''}>${I18n.t('common.border' + style.charAt(0).toUpperCase() + style.slice(1))}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="ct-field">
                        <span class="craftools-label">${I18n.t('common.borderWidth')}</span>
                        <input type="number" id="var-minical-highlight-borderwidth" class="craftools-input" style="width:100%;" value="${b.miniCalendarHighlightBorderWidth !== undefined ? b.miniCalendarHighlightBorderWidth : 1}" min="0">
                    </div>
                </div>
                <div class="ct-field" style="margin-top:10px;">
                    <span class="craftools-label">${I18n.t('common.borderColor')}</span>
                    <div id="var-minical-highlight-bordercolor-picker"></div>
                </div>
                <div class="ct-field" style="margin-top:10px;">
                    <span class="craftools-label">${I18n.t('common.borderRadius')}</span>
                    <input type="number" id="var-minical-highlight-radius" class="craftools-input" style="width:100%;" value="${b.miniCalendarHighlightBorderRadius !== undefined ? b.miniCalendarHighlightBorderRadius : 0}" min="0">
                </div>
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
                } else if (binding!.type === 'date' && VariableEngine.isHtmlDateFormat(binding!.format) && val) {
                    // _formatDate()'s DAYS_BOX/MOON_PHASE cases return real
                    // markup (a row of day-letter boxes / an icon+emoji+text
                    // span), not typed text -- was falling into the
                    // plain-text branch below, which showed the literal
                    // "<div style=...>S</div>..." tags as text instead of
                    // rendering them.
                    previewValue.innerHTML = val;
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
                    const startInput      = container.querySelector<HTMLInputElement>('#var-date-start');
                    const intervalSel     = container.querySelector<HTMLSelectElement>('#var-date-interval');
                    const stepInput       = container.querySelector<HTMLInputElement>('#var-date-step');
                    const formatButtons   = container.querySelectorAll<HTMLButtonElement>('.var-date-fmt-btn');
                    const daysBoxOpts     = container.querySelector<HTMLElement>('#var-date-daysbox-options');
                    const daysBoxColorEl  = container.querySelector<HTMLElement>('#var-date-daysbox-color-picker');
                    const daysBoxRadius   = container.querySelector<HTMLInputElement>('#var-date-daysbox-radius');
                    const daysBoxPad      = container.querySelector<HTMLInputElement>('#var-date-daysbox-padding');
                    const daysBoxHeight   = container.querySelector<HTMLInputElement>('#var-date-daysbox-height');
                    const daysBoxBStyle   = container.querySelector<HTMLSelectElement>('#var-date-daysbox-borderstyle');
                    const daysBoxBWidth   = container.querySelector<HTMLInputElement>('#var-date-daysbox-borderwidth');
                    const daysBoxBColorEl = container.querySelector<HTMLElement>('#var-date-daysbox-bordercolor-picker');
                    const daysBoxSun      = container.querySelector<HTMLInputElement>('#var-date-daysbox-sunday');
                    const customFormat    = container.querySelector<HTMLInputElement>('#var-date-custom-format');
                    const specialOpts     = container.querySelector<HTMLElement>('#var-date-special-options');
                    const specialCatBoxes = container.querySelectorAll<HTMLInputElement>('.var-date-special-cat');
                    const specialLimit    = container.querySelector<HTMLInputElement>('#var-date-special-limit');
                    const specialRandom   = container.querySelector<HTMLInputElement>('#var-date-special-randomize');
                    const specialSep      = container.querySelector<HTMLInputElement>('#var-date-special-separator');
                    const specialEmpty    = container.querySelector<HTMLInputElement>('#var-date-special-emptytext');
                    const calendarOpts    = container.querySelector<HTMLElement>('#var-date-calendar-options');
                    const calendarModeBtns = container.querySelectorAll<HTMLButtonElement>('.var-date-calendar-mode-btn');
                    const seasonOpts      = container.querySelector<HTMLElement>('#var-date-season-options');
                    const hemisphereSel   = container.querySelector<HTMLSelectElement>('#var-date-hemisphere');

                    if (startInput)  startInput.oninput    = () => { binding!.startDate = startInput.value;                                notify(); };
                    if (intervalSel) intervalSel.onchange  = () => { binding!.interval  = intervalSel.value;                               notify(); };
                    if (stepInput)   stepInput.oninput     = () => { binding!.step      = parseInt(stepInput.value, 10) || 1;              notify(); };
                    // Applies a new custom-format string from either a
                    // button click or free typing: writes it into the text
                    // box + binding (always flipping `format` to 'CUSTOM'
                    // from this point on -- see _legacyFormatToCustomToken()'s
                    // doc comment for why a mere panel-open doesn't do this),
                    // re-derives every button's active state from the text
                    // (so typing "reflects in the marked buttons", per spec),
                    // and shows/hides the Estação/Signo/Fase da Lua/Feriado
                    // sub-option blocks by whether their token is present.
                    // The text/icon/emoji single-select (calendarOpts) is
                    // shared by all three of {season}/{moon}/{zodiac} -- see
                    // _renderCalendarInfo() in VariableEngine.ts, which every
                    // one of those tokens (and their whole-format
                    // counterparts) render through -- so it shows whenever
                    // ANY of the three is present, not just one.
                    const applyCustomText = (text: string): void => {
                        if (customFormat) customFormat.value = text;
                        binding!.format       = 'CUSTOM';
                        binding!.customFormat = text;
                        const lower = text.toLowerCase();
                        formatButtons.forEach(btn => {
                            const token = (btn.dataset.token || '').toLowerCase();
                            btn.classList.toggle('active', !!token && lower.includes(token));
                        });
                        if (daysBoxOpts)  daysBoxOpts.style.display  = 'none';
                        if (specialOpts)  specialOpts.style.display  = lower.includes('{holiday}') ? 'block' : 'none';
                        if (seasonOpts)   seasonOpts.style.display   = lower.includes('{season}') ? 'block' : 'none';
                        if (calendarOpts) calendarOpts.style.display = (lower.includes('{season}') || lower.includes('{moon}') || lower.includes('{zodiac}')) ? 'block' : 'none';
                        notify();
                    };
                    // Dia/mês/ano are the one trio in the pill row that the
                    // legacy default ('dd/mm/yyyy') and this UI's own
                    // convention always glue together with "/" -- so unlike
                    // the other pieces (which just get appended/removed with
                    // a plain space), toggling any of the three rebuilds
                    // that whole slash-joined group from scratch instead of
                    // literally inserting/stripping the token text. This
                    // avoids the leftover "/" that a plain token-removal
                    // would leave behind (e.g. unchecking "Dia" from
                    // "dd/mm/yyyy" now yields "mm/yyyy", not "/mm/yyyy"),
                    // and inserts a fresh "/" automatically when re-checking
                    // one, in the canonical dd/mm/yyyy order regardless of
                    // click order.
                    const DATE_PART_TOKENS = ['dd', 'mm', 'yyyy'];
                    formatButtons.forEach(btn => {
                        btn.onclick = () => {
                            const token    = btn.dataset.token || '';
                            const current  = customFormat ? customFormat.value : '';
                            const isActive = btn.classList.contains('active');
                            const isDatePart = DATE_PART_TOKENS.includes(token);
                            let next: string;

                            if (isDatePart) {
                                const activeDateParts = new Set(
                                    DATE_PART_TOKENS.filter(t => [...formatButtons].some(b => b.dataset.token === t && b.classList.contains('active')))
                                );
                                if (isActive) activeDateParts.delete(token); else activeDateParts.add(token);
                                const group = DATE_PART_TOKENS.filter(t => activeDateParts.has(t)).join('/');

                                // Everything that isn't a dd/mm/yyyy token or
                                // the "/" gluing them is "the rest" (other
                                // pieces/literal text the user added) and is
                                // kept as-is, reattached after the group.
                                let rest = current;
                                DATE_PART_TOKENS.forEach(t => { rest = rest.split(t).join(''); });
                                rest = rest.replace(/\//g, '').replace(/[ \t]{2,}/g, ' ').trim();

                                next = [group, rest].filter(Boolean).join(' ');
                            } else if (isActive) {
                                next = current.split(token).join('').replace(/[ \t]{2,}/g, ' ').trim();
                            } else {
                                const sep = current && !/\s$/.test(current) ? ' ' : '';
                                next = current + sep + token;
                            }

                            if (isActive) {
                                // Deselecting the LAST active piece resets
                                // the box to fully empty (per spec) rather
                                // than leaving behind whatever literal
                                // separators/text the user had typed around
                                // the pieces.
                                const anyLeft = VariablePanel._dateFormatButtons().some(o => next.toLowerCase().includes(o.token.toLowerCase()));
                                if (!anyLeft) next = '';
                            }

                            applyCustomText(next);
                        };
                    });
                    if (customFormat) customFormat.oninput = () => applyCustomText(customFormat.value);
                    // "Caixa de dias" is a whole separate render mode (a row
                    // of colored weekday boxes -- see VariableEngine.ts's
                    // 'DAYS_BOX' case), not a text token, so it can't compose
                    // with the pieces above the way they compose with each
                    // other. Clicking it flips the binding to 'DAYS_BOX'
                    // outright (deselecting every text-token pill); clicking
                    // it again goes back to 'CUSTOM', restoring whatever was
                    // last in the custom-format box.
                    const daysBoxBtn = container.querySelector<HTMLButtonElement>('#var-date-daysbox-btn');
                    if (daysBoxBtn) {
                        daysBoxBtn.onclick = () => {
                            const turningOn = !daysBoxBtn.classList.contains('active');
                            if (turningOn) {
                                binding!.format = 'DAYS_BOX';
                                daysBoxBtn.classList.add('active');
                                formatButtons.forEach(b => b.classList.remove('active'));
                                if (daysBoxOpts)  daysBoxOpts.style.display  = 'block';
                                if (specialOpts)  specialOpts.style.display  = 'none';
                                if (seasonOpts)   seasonOpts.style.display   = 'none';
                                if (calendarOpts) calendarOpts.style.display = 'none';
                                notify();
                            } else {
                                daysBoxBtn.classList.remove('active');
                                applyCustomText(customFormat ? customFormat.value : 'dd/mm/yyyy');
                            }
                        };
                    }
                    if (hemisphereSel) hemisphereSel.onchange = () => { binding!.hemisphere = hemisphereSel.value as 'south' | 'north'; notify(); };
                    // Single-select: exactly one of text/icon/emoji is ever
                    // active (replaces the old independent calendarShowIcon/
                    // Emoji/Text checkboxes, which allowed combining several
                    // at once) -- see VariableBinding's calendarDisplay doc
                    // comment in VariableEngine.ts.
                    calendarModeBtns.forEach(btn => {
                        btn.onclick = () => {
                            binding!.calendarDisplay = (btn.dataset.mode as 'text' | 'icon' | 'emoji') || 'text';
                            calendarModeBtns.forEach(b => b.classList.toggle('active', b === btn));
                            notify();
                        };
                    });
                    specialCatBoxes.forEach(box => {
                        box.onchange = () => {
                            // An empty array here is a valid, deliberate
                            // choice (user unchecked every category) --
                            // _formatSpecialDate() only falls back to "all
                            // four" when this is `undefined`, never for a
                            // real empty array, so the stored value and the
                            // checkbox state stay in sync (unlike falling
                            // back to "all checked" here, which would leave
                            // every box visibly unchecked while the
                            // formatter quietly showed everything anyway).
                            binding!.specialDateCategories = [...specialCatBoxes].filter(c => c.checked).map(c => c.value);
                            notify();
                        };
                    });
                    if (specialLimit) specialLimit.oninput = () => {
                        // Empty field = "show all" (undefined, not 0/NaN --
                        // _formatSpecialDate() only slices when the parsed
                        // value is a positive number).
                        const raw = specialLimit.value.trim();
                        binding!.specialDateLimit = raw === '' ? undefined : parseInt(raw, 10);
                        notify();
                    };
                    if (specialRandom) specialRandom.onchange = () => { binding!.specialDateRandomize = specialRandom.checked; notify(); };
                    if (specialSep)    specialSep.oninput     = () => { binding!.specialDateSeparator = specialSep.value;   notify(); };
                    if (specialEmpty)  specialEmpty.oninput   = () => { binding!.specialDateEmptyText = specialEmpty.value; notify(); };
                    if (daysBoxRadius) daysBoxRadius.oninput = () => { binding!.daysBoxBorderRadius = parseInt(daysBoxRadius.value, 10);   notify(); };
                    if (daysBoxPad)    daysBoxPad.oninput    = () => { binding!.daysBoxPadding      = parseInt(daysBoxPad.value, 10);      notify(); };
                    if (daysBoxHeight) daysBoxHeight.oninput = () => {
                        // Empty field -> back to the original content-driven
                        // min-height instead of writing an empty/NaN height.
                        const raw = daysBoxHeight.value.trim();
                        binding!.daysBoxHeight = raw === '' ? undefined : parseInt(raw, 10);
                        notify();
                    };
                    if (daysBoxBStyle) daysBoxBStyle.onchange = () => { binding!.daysBoxBorderStyle = daysBoxBStyle.value;                  notify(); };
                    if (daysBoxBWidth) daysBoxBWidth.oninput  = () => { binding!.daysBoxBorderWidth = parseInt(daysBoxBWidth.value, 10);    notify(); };
                    if (daysBoxSun)    daysBoxSun.onchange   = () => { binding!.daysBoxStartSunday    = daysBoxSun.checked;                  notify(); };

                    // Highlight/border color -- the same standardized picker
                    // every other color field in the app uses (palette
                    // swatches + custom pick), replacing what used to be a
                    // bare native <input type="color">. Solid-only: a
                    // gradient on a ~1.5em letter box wasn't requested and
                    // VariableEngine's DAYS_BOX renderer only ever applies
                    // these as plain `background-color`/`border-color`
                    // values, not a `background`/`border-image` gradient.
                    if (daysBoxColorEl) {
                        renderColorPicker(daysBoxColorEl, normalizeValue(binding!.daysBoxHighlightColor || '#f97316'), (next) => {
                            binding!.daysBoxHighlightColor = next.solid;
                            notify();
                        }, { allowGradient: false });
                    }
                    if (daysBoxBColorEl) {
                        renderColorPicker(daysBoxBColorEl, normalizeValue(binding!.daysBoxBorderColor || '#000000'), (next) => {
                            binding!.daysBoxBorderColor = next.solid;
                            notify();
                        }, { allowGradient: false });
                    }
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

                    // Standard toggle-switch visual update (track background +
                    // thumb translateX) -- same pattern as fields/toggle.field.ts's
                    // own bind(), just scoped to the specific <label> each
                    // checkbox lives in (this container can hold several
                    // toggles at once, so a container-wide query would grab
                    // the wrong track/thumb).
                    const _paintToggle = (input: HTMLInputElement) => {
                        const track = input.closest('label')?.querySelector<HTMLElement>('.ct-toggle-track');
                        const thumb = input.closest('label')?.querySelector<HTMLElement>('.ct-toggle-thumb');
                        if (track) track.style.background = input.checked ? 'var(--accent)' : 'var(--border)';
                        if (thumb) thumb.style.transform  = input.checked ? 'translateX(14px)' : 'translateX(0)';
                    };

                    const weekSundaySel = container.querySelector<HTMLInputElement>('#var-minical-week-sunday');
                    if (weekSundaySel) weekSundaySel.onchange = () => {
                        binding!.weekStartSunday = weekSundaySel.checked;
                        _paintToggle(weekSundaySel);
                        notify();
                    };

                    // Highlight (single day-of-month, styled independently of
                    // the sunday/holiday coloring) -- same option shape as
                    // MiniCalendarTool.ts's own "Highlight" schema section,
                    // both ultimately feed CalendarRenderer.ts's `highlight`
                    // option. Was previously missing here entirely: the
                    // miniCalendar variable format rendered through
                    // CalendarRenderer just like the standalone Mini
                    // Calendar tool, but had no UI (or binding fields) to
                    // turn highlighting on.
                    const hlEnabled     = container.querySelector<HTMLInputElement>('#var-minical-highlight-enabled');
                    const hlOptions     = container.querySelector<HTMLElement>('#var-minical-highlight-options');
                    // The "link highlight day to a date variable" toggle lives
                    // at the TOP of the config (same position the generic
                    // "Vincular a" row occupies for every other variable
                    // type), not inside #var-minical-highlight-options --
                    // it's a source for the highlight day, independent of
                    // whether highlighting itself is currently switched on.
                    const hlLinkToggle  = container.querySelector<HTMLInputElement>('#var-minical-highlight-linked-toggle');
                    const hlLinkedWrap  = container.querySelector<HTMLElement>('#var-minical-highlight-linked-wrap');
                    const hlLinked      = container.querySelector<HTMLSelectElement>('#var-minical-highlight-linked');
                    const hlBgEl        = container.querySelector<HTMLElement>('#var-minical-highlight-bg-picker');
                    const hlTextEl      = container.querySelector<HTMLElement>('#var-minical-highlight-text-picker');
                    const hlBorderStyle = container.querySelector<HTMLSelectElement>('#var-minical-highlight-borderstyle');
                    const hlBorderWidth = container.querySelector<HTMLInputElement>('#var-minical-highlight-borderwidth');
                    const hlBorderColorEl = container.querySelector<HTMLElement>('#var-minical-highlight-bordercolor-picker');
                    const hlRadius      = container.querySelector<HTMLInputElement>('#var-minical-highlight-radius');

                    if (hlEnabled) hlEnabled.onchange = () => {
                        binding!.miniCalendarHighlightEnabled = hlEnabled.checked;
                        if (hlOptions) hlOptions.style.display = hlEnabled.checked ? 'block' : 'none';
                        _paintToggle(hlEnabled);
                        notify();
                    };
                    if (hlLinkToggle) hlLinkToggle.onchange = () => {
                        binding!.miniCalendarHighlightDaySource = hlLinkToggle.checked ? 'linked' : 'today';
                        if (hlLinkedWrap) hlLinkedWrap.style.display = hlLinkToggle.checked ? '' : 'none';
                        _paintToggle(hlLinkToggle);
                        notify();
                    };
                    if (hlLinked) hlLinked.onchange = () => { binding!.miniCalendarHighlightLinkedTo = hlLinked.value; notify(); };
                    if (hlBorderStyle) hlBorderStyle.onchange = () => { binding!.miniCalendarHighlightBorderStyle = hlBorderStyle.value;               notify(); };
                    if (hlBorderWidth) hlBorderWidth.oninput  = () => { binding!.miniCalendarHighlightBorderWidth = parseInt(hlBorderWidth.value, 10); notify(); };
                    if (hlRadius)      hlRadius.oninput       = () => { binding!.miniCalendarHighlightBorderRadius = parseInt(hlRadius.value, 10);     notify(); };

                    if (hlBgEl) {
                        renderColorPicker(hlBgEl, normalizeValue(binding!.miniCalendarHighlightBg || '#f97316'), (next) => {
                            binding!.miniCalendarHighlightBg = next.solid;
                            notify();
                        }, { allowGradient: false });
                    }
                    if (hlTextEl) {
                        renderColorPicker(hlTextEl, normalizeValue(binding!.miniCalendarHighlightTextColor || '#ffffff'), (next) => {
                            binding!.miniCalendarHighlightTextColor = next.solid;
                            notify();
                        }, { allowGradient: false });
                    }
                    if (hlBorderColorEl) {
                        renderColorPicker(hlBorderColorEl, normalizeValue(binding!.miniCalendarHighlightBorderColor || '#f97316'), (next) => {
                            binding!.miniCalendarHighlightBorderColor = next.solid;
                            notify();
                        }, { allowGradient: false });
                    }
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
