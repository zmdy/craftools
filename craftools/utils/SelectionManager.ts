/**
 * SelectionManager.ts — Centralized multi-selection state for the Craftools canvas.
 *
 * Maintains a Set of currently multi-selected <craftools-element> nodes.
 * Dispatches 'craftools-multiselect-change' on the document whenever the
 * selection set changes, carrying { detail: { elements: Craftools_Element[] } }.
 *
 * Single-element active selection (craftools-selected class) is NOT managed
 * here — SelectionManager only tracks the secondary multi-selection group
 * built via Ctrl+Click or Rubber Band drag.
 */

import type { Craftools_Element } from '../components/Element.js';

const MULTI_CLASS = 'craftools-multi-selected';

export class SelectionManager {
  private static _selected = new Set<Craftools_Element>();

  /** Add an element to the multi-selection group. */
  static add(el: Craftools_Element): void {
    if (this._selected.has(el)) return;
    this._selected.add(el);
    el.classList.add(MULTI_CLASS);
    this._dispatch();
  }

  /** Remove an element from the multi-selection group. */
  static remove(el: Craftools_Element): void {
    if (!this._selected.has(el)) return;
    this._selected.delete(el);
    el.classList.remove(MULTI_CLASS);
    this._dispatch();
  }

  /** Toggle an element in/out of the multi-selection group. */
  static toggle(el: Craftools_Element): void {
    if (this._selected.has(el)) {
      this.remove(el);
    } else {
      this.add(el);
    }
  }

  /** Clear all multi-selected elements. */
  static clear(): void {
    if (this._selected.size === 0) return;
    this._selected.forEach(el => el.classList.remove(MULTI_CLASS));
    this._selected.clear();
    this._dispatch();
  }

  /** Returns true if the element is in the multi-selection group. */
  static has(el: Craftools_Element): boolean {
    return this._selected.has(el);
  }

  /** Returns all currently multi-selected elements as an array. */
  static getAll(): Craftools_Element[] {
    return [...this._selected];
  }

  /** Number of elements currently in the multi-selection group. */
  static size(): number {
    return this._selected.size;
  }

  /**
   * Move all elements in the group by (dx, dy), except for `origin` which
   * has already been moved by the drag handler in Element.ts.
   */
  static moveGroupBy(origin: Craftools_Element, dx: number, dy: number): void {
    if (this._selected.size === 0) return;
    this._selected.forEach(el => {
      if (el === origin) return;
      el.px += dx;
      el.py += dy;
      el._applyTransform();
    });
  }

  private static _dispatch(): void {
    document.dispatchEvent(new CustomEvent('craftools-multiselect-change', {
      bubbles: false,
      detail: { elements: this.getAll() }
    }));
  }
}
