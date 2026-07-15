/**
 * ImageSlicerTool.ts — Panel-only stub.
 * This tool takes over the entire properties panel via setup(editor).
 * The real implementation is in ImageSlicerTool.js.
 */
import { ToolRegistry } from '../../utils/ToolRegistry';

ToolRegistry.register({
  key: 'fatiador',
  label: 'editor.imageSlicer',
  icon: 'content_cut',
  panelOnly: true,
  showInFooterNav: false,
  category: 'tools',
});
