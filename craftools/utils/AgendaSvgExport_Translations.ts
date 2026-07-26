import { I18n } from "../settings/Translations.js";

/**
 * Runtime toasts for AgendaSvgExport.ts's export pipeline (distinct from
 * AgendaExportTool_Translations.ts's own agendaExportTool.exportSvg* keys,
 * which cover the panel UI -- button label, merge toggle, etc. -- that
 * triggers this).
 */
I18n.addTranslations('agendaSvgExport', {
    "pt-br": {
        noPagesFound: "Nenhuma página encontrada para exportar.",
        generating: "Gerando SVG(s)… isso pode levar alguns segundos.",
        done: "{n} página(s) exportada(s) como SVG.",
        someFailed: "{n} página(s) falharam (provavelmente uma fonte usada na página não está declarada — veja o console).",
        exportError: "Não foi possível exportar para SVG. Tente novamente."
    },
    "en": {
        noPagesFound: "No pages found to export.",
        generating: "Generating SVG(s)… this may take a few seconds.",
        done: "{n} page(s) exported as SVG.",
        someFailed: "{n} page(s) failed (likely a font used on the page isn't declared — check the console).",
        exportError: "Could not export to SVG. Please try again."
    },
    "es": {
        noPagesFound: "No se encontraron páginas para exportar.",
        generating: "Generando SVG(s)… esto puede tardar unos segundos.",
        done: "{n} página(s) exportada(s) como SVG.",
        someFailed: "{n} página(s) fallaron (probablemente una fuente usada en la página no está declarada — revisa la consola).",
        exportError: "No se pudo exportar a SVG. Inténtelo de nuevo."
    }
});
