/**
 * FieldRegistry — Open/Closed field type system.
 *
 * Maps a FieldType string to a { render, bind } handler pair.
 * Built-in handlers live in utils/fields/ and self-register at import time.
 * Third-party code can extend the system by calling FieldRegistry.register()
 * with a custom type — no core files modified.
 */

import type { Field } from '../types/PropertySchema';

// ── Handler interface ─────────────────────────────────────────────────────────

export interface FieldHandler {
  /**
   * Renders the field UI into the container.
   * Called every time the value changes (diffed by PropertyRenderer).
   */
  render(container: HTMLElement, field: Field, value: unknown): void;

  /**
   * Attaches event listeners to the container.
   * Called ONCE at field creation time — not on re-render.
   * Calls onChange(newValue) whenever the user interacts.
   */
  bind(container: HTMLElement, field: Field, onChange: (value: unknown) => void): void;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const registry = new Map<string, FieldHandler>();

export const FieldRegistry = {
  /**
   * Registers a handler for a field type.
   * Calling register() with an existing type overwrites it (allows overrides).
   */
  register(type: string, handler: FieldHandler): void {
    registry.set(type, handler);
  },

  /** Returns the handler for a type, or undefined if not registered. */
  get(type: string): FieldHandler | undefined {
    return registry.get(type);
  },

  /** Returns true if a handler is registered for the given type. */
  has(type: string): boolean {
    return registry.has(type);
  },

  /** Returns all registered type keys (useful for debugging). */
  registeredTypes(): string[] {
    return [...registry.keys()];
  },
};
