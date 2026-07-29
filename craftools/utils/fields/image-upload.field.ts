/**
 * image-upload field — file picker button + thumbnail preview.
 *
 * Value: a data-URL string (base64 image) or empty string.
 * onChange receives the data-URL of the selected file.
 */

import { FieldRegistry } from '../FieldRegistry';
import { tr } from '../i18nLabel';
import type { ImageUploadField } from '../../types/PropertySchema';

FieldRegistry.register('image-upload', {
  render(container, field, value) {
    const f = field as ImageUploadField;
    const src = String(value ?? '');
    const label = tr(f.i18nKey, f.label ?? '');

    if (!container.querySelector('.ct-img-upload-btn')) {
      container.innerHTML = `
        <div class="ct-field ct-field--block">
          ${label ? `<div class="craftools-label">${label}</div>` : ''}
          <div class="ct-field-row" style="gap:8px;">
            <div class="ct-img-preview" style="
              width:48px; height:48px; border-radius:6px;
              border:1px solid var(--border); background:var(--bg-input);
              overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center;">
              ${src
                ? `<img style="width:100%;height:100%;object-fit:cover;" src="${src}">`
                : `<span class="material-symbols-outlined" style="font-size:20px; color:var(--text-muted);">image</span>`}
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
              <button class="craftools-pill ct-img-upload-btn" type="button" style="width:100%; justify-content:center; gap:4px;">
                <span class="material-symbols-outlined" style="font-size:13px;">upload</span>
                Choose image
              </button>
              ${src ? `<button class="craftools-pill ct-img-clear-btn" type="button" style="width:100%; justify-content:center; gap:4px; font-size:10px;">
                <span class="material-symbols-outlined" style="font-size:12px;">close</span> Clear
              </button>` : ''}
            </div>
          </div>
          <input type="file" class="ct-fi" accept="image/*" style="display:none;">
        </div>`;
    } else {
      // Update preview only
      const preview = container.querySelector<HTMLElement>('.ct-img-preview');
      if (preview) {
        preview.innerHTML = src
          ? `<img style="width:100%;height:100%;object-fit:cover;" src="${src}">`
          : `<span class="material-symbols-outlined" style="font-size:20px; color:var(--text-muted);">image</span>`;
      }
    }
  },

  bind(container, _field, onChange) {
    const fileInput = container.querySelector<HTMLInputElement>('.ct-fi');

    container.querySelector('.ct-img-upload-btn')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => onChange(e.target?.result as string ?? '');
      reader.readAsDataURL(file);
    });

    container.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('.ct-img-clear-btn')) {
        if (fileInput) fileInput.value = '';
        onChange('');
      }
    });
  },
});
