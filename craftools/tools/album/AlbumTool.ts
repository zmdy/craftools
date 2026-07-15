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
 * The real implementation lives in AlbumTool.js (829 lines). This stub only
 * registers the tool in ToolRegistry so the sidebar button and routing work
 * at type-check time without importing the JS implementation.
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
