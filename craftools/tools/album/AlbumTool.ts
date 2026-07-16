/**
 * AlbumTool.ts — Panel-only stub.
 *
 * AlbumTool is a wizard-style panel: it calls setup(editor, pageEl) to take
 * over the entire properties panel and manages all state (selected template,
 * uploaded photos, quantity mode) inside its own closure.
 *
 * There is no canvas element and no _craftoolsMeta — this tool generates a
 * craftools-grid-container directly on the page, filled with ImageTool elements
 * via Craftools_LayoutGrid.
 *
 * The real implementation is now AlbumWizard.ts (ported from AlbumTool.js,
 * which is dead code as of that port). This stub stays separate and stays
 * tiny because it's imported EAGERLY (Editor.ts, purely for this
 * ToolRegistry.register() side effect), while AlbumWizard.ts is only
 * dynamically imported when the user actually opens the Album tool — see
 * AlbumWizard.ts's header comment for the full reasoning.
 */
import { ToolRegistry } from '../../utils/ToolRegistry';

ToolRegistry.register({
  key: 'album',
  label: 'editor.album',
  icon: 'photo_album',
  panelOnly: true,
  showInFooterNav: false,
  category: 'tools',
});
