/**
 * fields/index.ts — barrel that registers all built-in field handlers.
 *
 * Import this once (e.g. in main.ts or craftools.ts) to make every field
 * type available to PropertyRenderer. Each import triggers the file's
 * FieldRegistry.register() call as a side-effect.
 *
 * To register only specific field types (for lightweight embeds), import
 * the individual .field.ts files instead of this barrel.
 */

export * from './text.field';
export * from './number.field';
export * from './color.field';
export * from './color-gradient.field';
export * from './toggle.field';
export * from './select.field';
export * from './align.field';
export * from './font-select.field';
export * from './slider.field';
export * from './divider.field';
export * from './image-upload.field';
export * from './page-align.field';
