/**
 * PropertySchema — pure data contracts for the property panel system.
 *
 * Tools return a PropertySchema describing WHAT properties they have.
 * PropertyRenderer decides HOW to render them.
 * This separation means adding a new UI layout requires zero tool changes.
 */

// ── Field types ───────────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'number'
  | 'color'
  | 'color-gradient'
  | 'toggle'
  | 'select'
  | 'align'
  | 'font-select'
  | 'slider'
  | 'textarea'
  | 'icon-picker'
  | 'image-upload'
  | 'divider'
  | 'page-align'
  | 'variable-binding'
  | 'custom';   // escape hatch: render function provided inline

// ── Base field ────────────────────────────────────────────────────────────────

export interface BaseField {
  type: FieldType;
  /** Maps to the element state property key. */
  key: string;
  /** Display label — i18n key or literal string. */
  label?: string;
  /** Explicit i18n key when label is used as a fallback literal. */
  i18nKey?: string;
  hidden?: boolean | ((el: HTMLElement) => boolean);
  disabled?: boolean | ((el: HTMLElement) => boolean);
}

// ── Concrete field types ──────────────────────────────────────────────────────

export interface TextField extends BaseField {
  type: 'text';
  placeholder?: string;
  maxLength?: number;
}

export interface NumberField extends BaseField {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  /** Displayed after the input: 'px', 'mm', '%', etc. */
  unit?: string;
}

export interface ColorField extends BaseField {
  type: 'color';
}

export interface ColorGradientField extends BaseField {
  type: 'color-gradient';
}

export interface ToggleField extends BaseField {
  type: 'toggle';
}

export interface SelectField extends BaseField {
  type: 'select';
  options: Array<{ value: string; label: string }>;
}

export interface AlignField extends BaseField {
  type: 'align';
}

export interface FontSelectField extends BaseField {
  type: 'font-select';
  /** Overrides the default shared catalog (utils/FontList.ts's FONTS). */
  fonts?: string[];
  /**
   * Shows the "type the name of a locally-installed font" input+button
   * below the picker (ports MobileToolbar.js's _renderTextFont() custom-font
   * UI, previously desktop-only-missing). Default: true.
   */
  allowCustom?: boolean;
}

export interface SliderField extends BaseField {
  type: 'slider';
  min: number;
  max: number;
  step?: number;
}

export interface TextareaField extends BaseField {
  type: 'textarea';
  rows?: number;
  placeholder?: string;
}

export interface IconPickerField extends BaseField {
  type: 'icon-picker';
}

export interface ImageUploadField extends BaseField {
  type: 'image-upload';
}

export interface DividerField extends BaseField {
  type: 'divider';
  key: string; // still required by BaseField; use a unique id like 'divider-1'
  /**
   * When set, renders as a labeled sub-header (icon + uppercase label,
   * matching the legacy `.ct-sublabel` convention from CommonProperties.js)
   * instead of a plain `<hr>`. Used to group Border/Radius/Padding/Margin
   * inside a single combined formaSection() accordion. `label`/`i18nKey`
   * are inherited from BaseField.
   */
  icon?: string;
}

export interface PageAlignField extends BaseField {
  type: 'page-align';
  // No extra config: renders the fixed 6-button page-alignment grid and
  // reports the clicked direction ('left'|'center-h'|'right'|'top'|
  // 'center-v'|'bottom') via onChange. This is a fire-and-forget action --
  // it wraps SnapEngine.align(element, direction), not a stored/diffed
  // value -- see pageAlignSection() in CommonSchema.ts and BaseTool.ts's
  // default _applyProperty(), which special-cases this key.
}

export interface VariableBindingField extends BaseField {
  type: 'variable-binding';
  // No extra config: wraps utils/VariablePanel.js's existing "Texto Variável"
  // accordion (type select + per-type config + live preview + cross-element
  // "Vincular a" linking), shared by QRCodeTool, BarcodeTool and
  // VariableContentTool. Unlike every other field, its stored value is a
  // JSON-*stringified* binding object (see utils/fields/variable-binding.field.ts
  // for why: PropertyRenderer's diffing compares String(value), and every plain
  // object stringifies to the same "[object Object]", which would silently
  // stop this field from ever re-rendering after the first selected element --
  // stringifying makes the diff key actually reflect content/element changes).
  // Tools must JSON.parse() the value in _applyProperty() before writing it
  // into their real storage (_craftoolsMeta.variableBinding or
  // element._craftoolsVariable) and JSON.stringify() it back in
  // _syncFromDOM() when priming dataset.ctState.
}

export interface CustomField extends BaseField {
  type: 'custom';
  /**
   * Renders the field into the container and returns it.
   * Called once at creation time.
   */
  render: (element: HTMLElement, onChange: (value: unknown) => void) => HTMLElement;
}

// ── Field union ───────────────────────────────────────────────────────────────

export type Field =
  | TextField
  | NumberField
  | ColorField
  | ColorGradientField
  | ToggleField
  | SelectField
  | AlignField
  | FontSelectField
  | SliderField
  | TextareaField
  | IconPickerField
  | ImageUploadField
  | DividerField
  | PageAlignField
  | VariableBindingField
  | CustomField;

// ── Section ───────────────────────────────────────────────────────────────────

export interface Section {
  /** Section title — i18n key or literal string. */
  section: string;
  i18nKey?: string;
  /**
   * Material Symbol icon name shown in the accordion header, matching the
   * legacy PanelUI.accordion(id, icon, title, ...) convention (e.g.
   * 'text_fields', 'palette', 'border_style'). Falls back to a generic icon
   * if omitted so older schemas don't render with a blank/misaligned header.
   */
  icon?: string;
  /** Default: true */
  collapsible?: boolean;
  /** Default: false (except the first section, which opens by default). */
  defaultOpen?: boolean;
  fields: Field[];
}

// ── Schema ────────────────────────────────────────────────────────────────────

/** The full property panel descriptor for a tool. Returned by getPropertySchema(). */
export type PropertySchema = Section[];
