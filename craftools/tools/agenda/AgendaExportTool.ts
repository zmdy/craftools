/**
 * AgendaExportTool.ts — Panel-only stub.
 * This tool takes over the entire properties panel via setup(editor).
 * The real implementation is in AgendaExportTool.js; this stub just registers
 * the tool in ToolRegistry so the sidebar button and routing work without
 * depending on the JS implementation at type-check time.
 */
import { ToolRegistry } from '../../utils/ToolRegistry';

ToolRegistry.register({
  key: 'agendaexport',
  label: 'editor.agendaExport',
  icon: 'export_notes',
  panelOnly: true,
  showInFooterNav: false,
  category: 'export',
});
