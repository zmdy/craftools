/**
 * tools/index.ts — barrel that activates all tool self-registrations.
 *
 * Importing this file (or any subset below) causes each tool's
 * ToolRegistry.register() call to execute, making the tool available
 * to Editor.ts and Craftools without any explicit switch/case coupling.
 *
 * Usage:
 *   import './craftools/tools';           // all tools
 *   import { TextTool } from './craftools/tools/text/TextTool'; // single tool
 */

// ── Text ──────────────────────────────────────────────────────────────────────
export { TextTool }            from './text/TextTool';

// ── Image ─────────────────────────────────────────────────────────────────────
export { ImageTool }           from './image/ImageTool';

// ── Shape ─────────────────────────────────────────────────────────────────────
export { ShapeTool }           from './shape/ShapeTool';

// ── Icon ──────────────────────────────────────────────────────────────────────
export { IconTool }            from './icon/IconTool';

// ── Emoji ─────────────────────────────────────────────────────────────────────
export { EmojiTool }           from './emoji/EmojiTool';
export { EmojiKitchenTool }    from './emojikitchen/EmojiKitchenTool';

// ── QR / Barcode ──────────────────────────────────────────────────────────────
export { QRCodeTool }          from './qrcode/QRCodeTool';
export { BarcodeTool }         from './barcode/BarcodeTool';

// ── Text effects ──────────────────────────────────────────────────────────────
export { CurvedTextTool }      from './curvedtext/CurvedTextTool';
export { StampTool }           from './stamp/StampTool';

// ── Calendar ──────────────────────────────────────────────────────────────────
export { MiniCalendarTool }    from './minicalendar/MiniCalendarTool';

// ── Paper / Background ───────────────────────────────────────────────────────
export { PaperTool }           from './paper/PaperTool';

// ── Variable content ──────────────────────────────────────────────────────────
export { VariableContentTool } from './variablecontent/VariableContentTool';

// ── Panel-only tools (side-effect imports — no canvas element) ────────────────
// These just run ToolRegistry.register(); they have no exported class.
import './album/AlbumTool';
import './agenda/AgendaExportTool';
import './generator/GeneratorTool';
import './imageslicer/ImageSlicerTool';
import './calendar/CalendarTool';
