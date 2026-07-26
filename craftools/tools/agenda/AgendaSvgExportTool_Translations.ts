import { I18n } from "../../settings/Translations.js";

/**
 * Traduções do painel "Exportar para SVG" (AgendaSvgExportTool.ts).
 */
I18n.addTranslations('agendaSvgExportTool', {
    "pt-br": {
        panelTitle: "Exportar para SVG",
        experimentalNotice: "Recurso experimental: exporta páginas da Agenda como arquivos .svg vetoriais (em vez de PDF) para testarmos a qualidade do resultado. Nem todo recurso visual é suportado ainda — confira os arquivos gerados antes de usar em produção.",
        agendaIntro: "Gera as primeiras páginas da Agenda (com as variáveis já resolvidas) como arquivos .svg individuais, um por página.",
        pageCountLabel: "Quantas páginas exportar (teste)",
        pageCountHint: "Mantenha baixo (1–3) para um teste rápido — cada página é renderizada e baixada separadamente.",
        exportButton: "Exportar Agenda (SVG)",
        generating: "Gerando…",
        exportError: "Não foi possível exportar. Tente novamente.",
        noPagesFound: "Nenhuma página encontrada para exportar."
    },
    "en": {
        panelTitle: "Export to SVG",
        experimentalNotice: "Experimental feature: exports Agenda pages as vector .svg files (instead of PDF) so we can test result quality. Not every visual feature is supported yet — check the generated files before using them in production.",
        agendaIntro: "Generates the Agenda's first pages (with variables already resolved) as individual .svg files, one per page.",
        pageCountLabel: "How many pages to export (test)",
        pageCountHint: "Keep it low (1–3) for a quick test — each page is rendered and downloaded separately.",
        exportButton: "Export Agenda (SVG)",
        generating: "Generating…",
        exportError: "Could not export. Please try again.",
        noPagesFound: "No pages found to export."
    },
    "es": {
        panelTitle: "Exportar a SVG",
        experimentalNotice: "Función experimental: exporta páginas de la Agenda como archivos .svg vectoriales (en lugar de PDF) para probar la calidad del resultado. No todos los recursos visuales están soportados todavía — revisa los archivos generados antes de usarlos en producción.",
        agendaIntro: "Genera las primeras páginas de la Agenda (con las variables ya resueltas) como archivos .svg individuales, uno por página.",
        pageCountLabel: "Cuántas páginas exportar (prueba)",
        pageCountHint: "Mantenlo bajo (1–3) para una prueba rápida — cada página se renderiza y descarga por separado.",
        exportButton: "Exportar Agenda (SVG)",
        generating: "Generando…",
        exportError: "No se pudo exportar. Inténtelo de nuevo.",
        noPagesFound: "No se encontraron páginas para exportar."
    }
});
