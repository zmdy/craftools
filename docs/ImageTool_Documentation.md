# CrafTools: ImageTool Documentation

## Overview
The \`ImageTool\` in CrafTools is a highly polished, modular component designed to provide full visual manipulation of images. Inspired by professional editors, it supports internal positioning, scaling, custom CSS filters, and a dynamic interaction model.

## Modular Architecture (SRP)
To adhere to the Single Responsibility Principle, the image tool logic is decoupled into multiple specialized modules within the \`craftools/tools/image/\` directory:

- \`ImageTool.js\`: The main orchestrator. Handles injecting the tool into the DOM, generating the property panel UI, and communicating with the global CrafTools ecosystem.
- \`ImageTool_Translations.js\`: Houses the localization dictionaries for the tool's labels, ensuring multi-language support (i18n).
- \`ImageFilters.js\`: Dedicated to managing CSS filters (brightness, contrast, saturation, hue-rotation, blur, etc.) and object-fit alignments (contain, cover, fill).
- \`ImageTransform.js\`: Manages the complex logic of internal image transformations (Scale, Translate, Rotate) and user interactions (Scroll, Pointer Drag).

## Interaction Models
The ImageTool uses an advanced context-aware interaction layer. This means that shortcuts bypass standard element dragging *only* when the image is actively being edited.

### 1. Scroll actions
- **Internal Zoom:** Scrolling the mouse wheel while the image is selected adjusts its internal \`scale\`.
- **Internal Rotation:** Holding \`CTRL\` or \`CMD\` while scrolling the mouse wheel adjusts the image's internal \`rotation\`.

### 2. Double-Click to Pan (Crop Mode)
By default, dragging an element moves the \`Craftools_Element\` container over the page. 
- **Entering Pan Mode:** Double-clicking the image temporarily exposes the inner image layer. 
- **Panning:** Dragging will now move the internal image (translating X and Y offsets) rather than the external box, effectively acting as a crop/position tool.
- **Exiting Pan Mode:** Clicking outside the element fires the global \`deselect()\` trigger, locking the internal image and returning drag control to the main wrapper.

## The Global Element Deselect Fix
A critical architectural improvement was made to \`craftools/components/Element.js\` to sustain the Pan Mode. 

Previously, \`Element.js\` relied on the \`focusout\` native event to restore the protective drag overlay (which intercepts standard drags). Since non-text elements (like \`<img>\`) do not emit \`focusout\` without hacks like \`tabindex\`, the overlay remained permanently disabled after double-clicking.

**The Fix:** 
The \`deselect()\` method inside \`Element.js\` now globally forces the interaction state to reset:
\`\`\`javascript
deselect() {
    // Other cleanup...
    this._overlay.style.pointerEvents = '';
    this._content.style.pointerEvents = 'none';
    const event = new CustomEvent('craftools-element-deselect', /*...*/);
}
\`\`\`
This safely ensures that *all* custom tools can confidently disable the drag overlay for their specific features (like panning or double-click to edit) knowing it will reliably reset when the user clicks away.
