import { FieldRegistry } from '../FieldRegistry';
import type { CustomField } from '../../types/PropertySchema';

/**
 * 'custom' field type handler — the escape hatch declared in
 * types/PropertySchema.ts's CustomField (`render: (element, onChange) =>
 * HTMLElement`) but never actually wired into PropertyRenderer/
 * FieldRegistry until now (PropertyRenderer._renderField() would look up
 * FieldRegistry.get('custom'), find nothing, log a warning, and silently
 * skip the field).
 *
 * Unlike every other field type, CustomField.render() takes no `value`
 * parameter — it's expected to manage its own internal DOM/state (reading
 * current state via PropertyRenderer._readState(element) itself if it
 * needs to), matching its own doc comment ("Called once at creation
 * time"). So `render()` here is a no-op on the normal value-diffed
 * re-render path; the real construction happens once in `bind()`, which
 * PropertyRenderer only calls at field-creation time -- exactly the
 * "once" the type's doc comment promises.
 */
FieldRegistry.register('custom', {
  render(_container, _field, _value, _element) {
    // No-op: see header comment. bind() does the actual (one-time) build.
  },

  bind(container, field, onChange, element) {
    if (!element) return;
    const node = (field as CustomField).render(element, onChange);
    container.appendChild(node);
  },
});
