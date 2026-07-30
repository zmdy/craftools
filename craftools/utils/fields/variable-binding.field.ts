// @ts-nocheck
/**
 * variable-binding field — wraps utils/VariablePanel.js's "Texto Variável"
 * accordion body (type select + per-type config + live preview + cross-
 * element "Vincular a" linking) so QRCodeTool, BarcodeTool and
 * VariableContentTool can offer it from the schema-driven panel, matching
 * what MobileToolbar.js's mini-panels already do for mobile.
 *
 * VariablePanel.js is a self-contained imperative module (own HTML strings,
 * own event binding, own re-render of its "#var-config" subtree when the
 * variable type changes) -- fundamentally the same shape as AlbumWizard.ts,
 * just small enough to wrap in a single field instead of a whole panel-only
 * tool. This handler is a thin adapter, not a port: all the real logic
 * (per-type config forms, live preview, VariableEngine calls, link-candidate
 * discovery) stays in VariablePanel.js untouched.
 *
 * Why the stored value is a JSON *string*, not the binding object itself:
 * PropertyRenderer's diffing compares `String(value)` between renders to
 * decide whether to re-render a field. Every plain object stringifies to the
 * same "[object Object]", so if the binding were stored as a raw object,
 * this field would render once and then NEVER again -- including when a
 * completely different element (with a different binding) gets selected,
 * since Editor.ts reuses the same panelBody DOM across selections and this
 * field would find its wrapper already built. Stringifying makes the diff
 * key actually track content, so switching elements or editing the binding
 * both correctly trigger a fresh render() call.
 *
 * Because the value is a string, callers (QRCodeTool.ts, BarcodeTool.ts,
 * VariableContentTool.ts) must JSON.parse() it in _applyProperty() before
 * writing to their real storage (_craftoolsMeta.variableBinding or
 * element._craftoolsVariable), and JSON.stringify() it back in
 * _syncFromDOM() when priming dataset.ctState. parseVariableBinding() below
 * is exported for exactly that.
 */
import { FieldRegistry } from '../FieldRegistry';
import { VariablePanel } from '../VariablePanel.js';
import type { VariableBinding } from '../VariableEngine.js';

type Binding = VariableBinding | null;

/** Safely parses a stored variable-binding value (JSON string) back into an object, or null. */
export function parseVariableBinding(raw: unknown): Binding {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') {
    return 'type' in raw ? (raw as VariableBinding) : null;
  }
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && 'type' in parsed ? (parsed as VariableBinding) : null;
  } catch {
    return null;
  }
}

/** Serializes a binding object (or null) back to the field's stored string form. */
export function stringifyVariableBinding(binding: Binding | undefined): string {
  return JSON.stringify(binding ?? null);
}

type ContainerWithState = HTMLElement & {
  _ctVarOnChange?: (value: string) => void;
  _ctVarLastBinding?: Binding;
};

/**
 * (Re)builds the VariablePanel.bind() wiring against whatever markup is
 * currently in `container`. Safe to call before onChange is known (does
 * nothing until it is) -- see the render()/bind() ordering note below.
 */
function wireUp(container: ContainerWithState, binding: Binding, element?: HTMLElement): void {
  container._ctVarLastBinding = binding;
  const onChange = container._ctVarOnChange;
  if (!onChange) return; // bind() hasn't run yet -- it will call wireUp() itself once it does
  VariablePanel.bind(container, binding, (newBinding: unknown) => {
    onChange(stringifyVariableBinding(newBinding as Binding));
  }, element);
}

FieldRegistry.register('variable-binding', {
  render(container, field, value, element) {
    const c = container as ContainerWithState;
    const binding = parseVariableBinding(value);
    c.innerHTML = VariablePanel.renderAccordionBody(binding, element, { hideNoneOption: (field as { hideNoneOption?: boolean }).hideNoneOption });
    // PropertyRenderer calls render() BEFORE bind() on first creation, so
    // onChange isn't stashed yet the very first time -- wireUp() no-ops in
    // that case and bind() (running immediately after, same tick) performs
    // the initial wiring instead. On every later real re-render (a genuinely
    // different element/binding selected), onChange is already known, so
    // wireUp() re-binds directly here -- bind() is never called again by
    // PropertyRenderer, by contract.
    wireUp(c, binding, element);
  },

  bind(container, _field, onChange, element) {
    const c = container as ContainerWithState;
    c._ctVarOnChange = onChange as (value: string) => void;
    wireUp(c, c._ctVarLastBinding ?? null, element);
  },
});
