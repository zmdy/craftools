/**
 * ToolRegistry — composable tool registration system.
 *
 * Each tool self-registers at the end of its own file by calling
 * ToolRegistry.register(). The Editor reads from the registry at runtime
 * instead of importing tools directly, removing all switch/case coupling.
 *
 * Tree-shaking: importing only specific tool files means only those tools
 * end up in the bundle — zero dead code for lightweight embeds.
 */

import type { BaseTool } from '../tools/BaseTool';

// ── ToolDefinition ────────────────────────────────────────────────────────────

export interface ToolDefinition {
  /** Canvas element key, e.g. 'titulo', 'imagem', 'qrcode'. */
  key: string;
  /** i18n key or literal string shown in the sidebar. */
  label: string;
  /** Material Symbol icon name. */
  icon: string;
  /**
   * A literal character (or short string) to render instead of `icon` as
   * this tool's sidebar/footer glyph, for tools whose "icon" is more
   * honest as an actual emoji than a Material Symbol stand-in (e.g. the
   * Emoji tool itself: `icon: 'emoji_emotions'` still exists as a Material
   * Symbol fallback for any UI that doesn't special-case this field, but
   * emojiIcon: '😊' is what actually renders in the sidebar/footer -- see
   * MobileToolbar.ts's _renderFooterItems()). Rendered with
   * `var(--font-emoji)` (see EmojiFont.ts) rather than the icon font.
   */
  emojiIcon?: string;
  /**
   * A literal image URL to render instead of `icon`/`emojiIcon` as this
   * tool's sidebar/footer glyph, for tools whose desktop entry already uses
   * an `<img>` instead of a Material Symbol (e.g. Emoji Kitchen: the
   * sidebar shows a live combo preview thumbnail, not an icon font glyph --
   * see index.html #pwa-sidebar-emojikitchen). Takes priority over
   * `emojiIcon`/`icon` when rendering the mobile footer (MobileToolbar.ts's
   * _renderFooterItems()), so the footer matches the desktop exactly
   * instead of falling back to an unrelated icon-font stand-in.
   */
  iconImg?: string;
  /**
   * The tool class. Must extend BaseTool.
   * Undefined for panel-only tools (use panelOnly: true instead).
   */
  tool?: typeof BaseTool;
  /**
   * True for tools that take over the sidebar panel (AgendaExport, Gerador, etc.)
   * and do not create canvas elements. These tools call setup(editor) instead of
   * renderPropertiesPanel(). Editor.ts will check this flag to route accordingly.
   */
  panelOnly?: boolean;
  /** Whether the tool can be dragged from the sidebar onto the canvas. Default: true. */
  draggable?: boolean;
  /** Whether this tool appears in the mobile bottom navigation bar. */
  showInFooterNav?: boolean;
  /** Sidebar section grouping label (i18n key or literal). */
  category?: string;
}

// ── CraftoolsConfig ───────────────────────────────────────────────────────────

export interface CraftoolsConfig {
  /**
   * Tool classes to activate. If omitted, all registered tools are used.
   * Import the tool files you need — their ToolRegistry.register() calls
   * run at import time, making them available here.
   */
  tools?: (typeof BaseTool)[];

  /**
   * UI driver class. Defaults to StandardSidebarUI.
   * Provide a custom BaseUI subclass to swap the entire panel layout.
   */
  ui?: new (...args: unknown[]) => unknown;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const registry = new Map<string, ToolDefinition>();

export const ToolRegistry = {
  /**
   * Registers a tool definition.
   * Called at the end of each tool file — self-registration pattern.
   */
  register(def: ToolDefinition): void {
    registry.set(def.key, def);
  },

  /** Returns the definition for a key, or undefined if not registered. */
  get(key: string): ToolDefinition | undefined {
    return registry.get(key);
  },

  /** Returns all registered tool definitions in registration order. */
  all(): ToolDefinition[] {
    return [...registry.values()];
  },

  /**
   * Returns definitions for the given keys only, in the provided order.
   * Keys not found in the registry are silently skipped.
   */
  subset(keys: string[]): ToolDefinition[] {
    return keys
      .map(k => registry.get(k))
      .filter((d): d is ToolDefinition => d !== undefined);
  },

  /** Returns true if a tool is registered under the given key. */
  has(key: string): boolean {
    return registry.has(key);
  },

  /** Returns all registered keys (useful for debugging). */
  registeredKeys(): string[] {
    return [...registry.keys()];
  },
};
