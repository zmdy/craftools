// @ts-nocheck
/**
 * Seasons.ts
 *
 * Cálculo da estação do ano correspondente a uma data, para o formato de
 * data "Estação do Ano" do Conteúdo Variável (ver VariableEngine.ts's
 * _formatSeason()). Usa a definição METEOROLÓGICA de estações (baseada no
 * mês civil -- cada estação começa sempre no dia 1 de dezembro/março/junho/
 * setembro) em vez da astronômica (baseada em equinócios/solstícios, cuja
 * data exata varia ano a ano em até ~1 dia) -- mesma filosofia de
 * "aproximação de calendário impresso, não uso científico" já documentada
 * em MoonPhases.ts, e evita ter que calcular equinócios/solstícios reais.
 *
 * O Hemisfério Sul tem as mesmas 4 estações do Hemisfério Norte só que
 * deslocadas 6 meses (verão do Sul = inverno do Norte, etc.) -- por isso
 * getSeasonForDate() só precisa saber o mês e, se for Hemisfério Sul,
 * somar 6 (mod 12) antes de olhar a mesma tabela do Hemisfério Norte.
 */
export class Seasons {

    /**
     * pt-BR label + emoji + um ícone do Material Symbols (mesma fonte
     * "Material Symbols Outlined" já carregada em toda a aplicação, ver
     * Element.ts) para cada uma das 4 estações. Ao contrário de
     * MoonPhases.ts (que precisou desenhar um SVG próprio por não existir
     * um glifo padrão por fase lunar), essas 4 estações têm ícones do
     * Material Symbols conhecidos e estáveis (símbolos clássicos, parte do
     * Material Design desde a primeira versão), então usamos o nome do
     * glifo diretamente em vez de desenhar SVG à mão.
     */
    static _SEASON_INFO = {
        spring: { label: 'Primavera', emoji: '🌸', icon: 'local_florist' },
        summer: { label: 'Verão',     emoji: '☀️', icon: 'wb_sunny' },
        autumn: { label: 'Outono',    emoji: '🍂', icon: 'eco' },
        winter: { label: 'Inverno',   emoji: '❄️', icon: 'ac_unit' },
    };

    /**
     * Estação (uma das 4: 'spring'|'summer'|'autumn'|'winter', nomes em
     * inglês como chave interna -- só os labels exibidos são em pt-BR,
     * mesma convenção de MoonPhases.ts's 'nova'/'crescente'/etc para as
     * fases) do mês (1-12), já considerando o hemisfério.
     * @param {number} month 1-12
     * @param {'south'|'north'} hemisphere
     * @returns {'spring'|'summer'|'autumn'|'winter'}
     */
    static _seasonForMonth(month, hemisphere) {
        // Tabela do Hemisfério Norte (meteorológica): Dez/Jan/Fev =
        // inverno, Mar/Abr/Mai = primavera, Jun/Jul/Ago = verão, Set/Out/
        // Nov = outono.
        const NORTH_BY_MONTH = [
            'winter', 'winter',                 // Jan, Fev
            'spring', 'spring', 'spring',        // Mar, Abr, Mai
            'summer', 'summer', 'summer',        // Jun, Jul, Ago
            'autumn', 'autumn', 'autumn',        // Set, Out, Nov
            'winter',                            // Dez
        ];
        // Hemisfério Sul: mesma tabela, deslocada 6 meses (índice +6 mod 12).
        const idx = hemisphere === 'south' ? (month - 1 + 6) % 12 : (month - 1);
        return NORTH_BY_MONTH[idx];
    }

    /**
     * Estação de uma data qualquer, com label/emoji/ícone prontos.
     * Cálculo 100% local -- sem rede, sem API, sem tabela curada (ao
     * contrário do formato "Feriado / Data comemorativa" que precisa da
     * API do craftools_api porque aquele conteúdo é curado manualmente,
     * uma estação do ano é só uma função direta do mês + hemisfério).
     * @param {Date} date
     * @param {'south'|'north'} [hemisphere='south'] Hemisfério Sul é o
     *   padrão -- mesma convenção "Brasil primeiro" já usada em
     *   BrazilianHolidays.ts e nos nomes de mês/dia-da-semana pt-BR
     *   hardcoded em VariableEngine.ts.
     * @returns {{season:'spring'|'summer'|'autumn'|'winter', label:string, emoji:string, iconHtml:string}}
     */
    static getSeasonInfo(date, hemisphere = 'south') {
        const season = this._seasonForMonth(date.getMonth() + 1, hemisphere);
        const info = this._SEASON_INFO[season];
        const iconHtml = `<span class="material-symbols-outlined" style="font-size:1em; line-height:1; vertical-align:-0.2em;" aria-hidden="true">${info.icon}</span>`;
        return { season, label: info.label, emoji: info.emoji, iconHtml };
    }
}
