/**
 * CalendarTool.ts — Panel-only stub.
 * This tool takes over the entire properties panel via setup(editor).
 * The real implementation is in CalendarTool.js.
 */
import { ToolRegistry } from '../../utils/ToolRegistry';

ToolRegistry.register({
  key: 'calendario',
  label: 'editor.calendar',
  icon: 'calendar_month',
  panelOnly: true,
  showInFooterNav: false,
  category: 'tools',
});
