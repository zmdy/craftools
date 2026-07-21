import { I18n } from "../../settings/Translations.js";

/**
 * Traduções do painel "Exportar Agenda" (AgendaExportTool.js).
 */
I18n.addTranslations('agendaExportTool', {
    "pt-br": {
        panelTitle: "Exportar Agenda",
        tabPages: "Páginas",
        tabPreview: "Pré-visualização",
        tabExport: "Ações",

        pagesIntro: "Marque as páginas que devem se repetir várias vezes na Agenda (ex: uma página modelo repetida para cada dia do mês). Páginas não marcadas aparecem apenas uma vez, como no PDF normal.",
        pageLabel: "Página",
        alternateToggle: "Páginas Alternadas (Frente e Verso)",
        repeatCheckLabel: "Repetir esta página várias vezes",
        repeatCountLabel: "Quantas vezes repetir",
        variablesFoundSuffix: "elemento(s) com variável configurada nesta página.",
        noVariablesWarning: "Esta página está marcada para repetir, mas nenhum elemento dela tem uma variável configurada (aba \"Texto Variável\" no Texto/Título/QR Code/Código de Barras) — todas as repetições ficarão idênticas.",

        previewVisualScopeLabel: "Pré-visualização das páginas",
        previewScopeLimited: "Primeiras 5 páginas",
        previewScopeAll: "Todas as páginas",

        previewIntro: "Amostra de como cada página repetida vai variar entre as repetições (mostrando a 1ª, 2ª e última).",
        previewNoRepeats: "Nenhuma página está marcada para repetir. Vá na aba \"Páginas\" para configurar.",
        previewCommonPage: "comum (aparece 1x)",
        previewRepeatedPage: "repetida {n}x",
        previewRepetitionLabel: "Repetição",
        previewNoBindings: "Nenhuma variável configurada nesta página.",

        exportIntro: "Ao exportar, o sistema gera todas as páginas repetidas com as variáveis já substituídas e depois abre a janela de impressão do navegador (Ctrl+P) automaticamente.",
        exportSummaryLabel: "Total de páginas que serão geradas",
        exportButton: "Exportar Agenda",
        generating: "Gerando páginas…",
        exportError: "Não foi possível gerar a Agenda. Tente novamente.",
        noPagesFound: "Nenhuma página encontrada para exportar."
    },
    "en": {
        panelTitle: "Export Agenda",
        tabPages: "Pages",
        tabPreview: "Preview",
        tabExport: "Actions",

        pagesIntro: "Mark the pages that should repeat multiple times in the Agenda (e.g. a template page repeated for each day of the month). Unmarked pages appear only once, like in a normal PDF.",
        pageLabel: "Page",
        alternateToggle: "Alternate Pages (Duplex Printing)",
        repeatCheckLabel: "Repeat this page multiple times",
        repeatCountLabel: "How many times to repeat",
        variablesFoundSuffix: "element(s) with a configured variable on this page.",
        noVariablesWarning: "This page is marked to repeat, but none of its elements have a configured variable (\"Variable Text\" tab on Text/Title/QR Code/Barcode) — every repetition will look identical.",

        previewIntro: "Sample of how each repeated page will vary between repetitions (showing the 1st, 2nd and last).",
        previewNoRepeats: "No page is marked to repeat. Go to the \"Pages\" tab to configure it.",
        previewCommonPage: "common (appears 1x)",
        previewRepeatedPage: "repeated {n}x",
        previewRepetitionLabel: "Repetition",
        previewNoBindings: "No variable configured on this page.",

        exportIntro: "When exporting, the system generates all repeated pages with the variables already substituted, then automatically opens the browser's print window (Ctrl+P).",
        exportSummaryLabel: "Total pages that will be generated",
        exportButton: "Export Agenda",
        generating: "Generating pages…",
        exportError: "Could not generate the Agenda. Please try again.",
        noPagesFound: "No pages found to export."
    },
    "es": {
        panelTitle: "Exportar Agenda",
        tabPages: "Páginas",
        tabPreview: "Vista previa",
        tabExport: "Acciones",

        pagesIntro: "Marque las páginas que deben repetirse varias veces en la Agenda (ej: una página modelo repetida para cada día del mes). Las páginas no marcadas aparecen solo una vez, como en el PDF normal.",
        pageLabel: "Página",
        alternateToggle: "Páginas Alternas (Doble Cara)",
        repeatCheckLabel: "Repetir esta página varias veces",
        repeatCountLabel: "Cuántas veces repetir",
        variablesFoundSuffix: "elemento(s) con variable configurada en esta página.",
        noVariablesWarning: "Esta página está marcada para repetirse, pero ninguno de sus elementos tiene una variable configurada (pestaña \"Texto Variable\" en Texto/Título/QR Code/Código de Barras) — todas las repeticiones serán idénticas.",

        previewIntro: "Muestra de cómo variará cada página repetida entre las repeticiones (mostrando la 1ª, 2ª y última).",
        previewNoRepeats: "Ninguna página está marcada para repetirse. Vaya a la pestaña \"Páginas\" para configurarlo.",
        previewCommonPage: "común (aparece 1x)",
        previewRepeatedPage: "repetida {n}x",
        previewRepetitionLabel: "Repetición",
        previewNoBindings: "Ninguna variable configurada en esta página.",

        exportIntro: "Al exportar, el sistema genera todas las páginas repetidas con las variables ya sustituidas y luego abre automáticamente la ventana de impresión del navegador (Ctrl+P).",
        exportSummaryLabel: "Total de páginas que se generarán",
        exportButton: "Exportar Agenda",
        generating: "Generando páginas…",
        exportError: "No se pudo generar la Agenda. Inténtelo de nuevo.",
        noPagesFound: "No se encontraron páginas para exportar."
    }
});
