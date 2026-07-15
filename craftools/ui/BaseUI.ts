/**
 * BaseUI — abstract UI layout contract.
 *
 * Swap the entire panel layout by providing a different BaseUI subclass
 * to the Craftools constructor. Tool files and the core editor are never
 * touched when a new UI is introduced.
 *
 * Current default: StandardSidebarUI (current sidebar layout).
 * Future examples: MobileSheetUI, FloatingToolbarUI, OverlayUI.
 */

import type { PropertySchema } from '../types/PropertySchema';
import type { ToolDefinition } from '../utils/ToolRegistry';

export abstract class BaseUI {
  protected wrapper: HTMLElement;

  constructor(wrapper: HTMLElement) {
    this.wrapper = wrapper;
  }

  /**
   * Builds the application shell (sidebar, canvas area, toolbar, etc.)
   * inside the wrapper element.
   *
   * @param tools - The active tool definitions to populate the sidebar/nav.
   */
  abstract buildShell(tools: ToolDefinition[]): void;

  /**
   * Renders (or updates) the property panel for the selected element.
   * Called every time a new element is selected or its state changes.
   *
   * @param schema   - The schema returned by the tool's getPropertySchema().
   * @param element  - The selected canvas element.
   * @param onChange - Callback to apply a property change to the element.
   */
  abstract showPropertiesPanel(
    schema: PropertySchema,
    element: HTMLElement,
    onChange: (key: string, value: unknown) => void,
  ): void;

  /**
   * Hides / clears the property panel.
   * Called when no element is selected.
   */
  abstract hidePropertiesPanel(): void;

  /**
   * Opens the tool picker (e.g., the "add element" drawer or sidebar).
   * On mobile this may show a bottom sheet; on desktop it may toggle a sidebar.
   */
  abstract showToolPicker(): void;
}
