/**
 * Element.d.ts — TypeScript ambient declarations for Craftools_Element.
 *
 * The implementation (Element.js, 473 lines) is battle-tested and intentionally
 * NOT migrated to TypeScript. This file gives the type-checker enough information
 * to work with Craftools_Element in new .ts files without touching the engine.
 */

export declare class Craftools_Element extends HTMLElement {
  // ── Position & size (in the element's own units) ──────────────────────────
  px: number;
  py: number;
  pw: number;
  ph: number;
  /** Rotation in degrees. */
  pr: number;

  unitX: string;
  unitY: string;
  unitW: string;
  unitH: string;

  // ── State flags ───────────────────────────────────────────────────────────
  isDragging: boolean;
  isResizing: boolean;
  isRotating: boolean;

  // ── DOM refs ──────────────────────────────────────────────────────────────
  /** The inner content area (child elements go here). */
  readonly contentArea: HTMLElement;

  // ── Public API ────────────────────────────────────────────────────────────

  /** Marks this element as selected and deselects all others on the page. */
  select(): void;

  /** Deselects this element. */
  deselect(): void;

  /** Re-applies the current px/py/pw/ph/pr values as CSS transforms. */
  _applyTransform(): void;

  // ── Static ────────────────────────────────────────────────────────────────

  /** Registers the `<craftools-element>` custom element. Call once at startup. */
  static init(): void;
}

// Extend the global HTMLElementTagNameMap so TS understands
// document.querySelector('craftools-element') returns Craftools_Element.
declare global {
  interface HTMLElementTagNameMap {
    'craftools-element': Craftools_Element;
  }
}
