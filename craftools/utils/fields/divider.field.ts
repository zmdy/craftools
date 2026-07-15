import { FieldRegistry } from '../FieldRegistry';

FieldRegistry.register('divider', {
  render(container, _field, _value) {
    if (!container.querySelector('.ct-divider')) {
      container.innerHTML = `<hr class="ct-divider" style="border:none; border-top:1px solid var(--border); margin:6px 0;">`;
    }
  },

  bind(_container, _field, _onChange) {
    // Dividers are purely visual — no events.
  },
});
