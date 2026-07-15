/**
 * GeradorTool.ts — Panel-only stub.
 * This tool takes over the entire properties panel via setup(editor).
 * The real implementation is in GeradorTool.js; this stub registers
 * the tool in ToolRegistry so routing works without importing the JS implementation.
 */
import { ToolRegistry } from '../../utils/ToolRegistry';

ToolRegistry.register({
  key: 'gerador',
  label: 'editor.generator',
  icon: 'auto_awesome',
  panelOnly: true,
  showInFooterNav: false,
  category: 'tools',
});
