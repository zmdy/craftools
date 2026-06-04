<div align="center">
  <img src="assets/logo-craftools.svg" alt="CrafTools Logo" width="150" />
  
  <p><strong>Professional Editing & Customization Suite for Stationery</strong></p>

  <!-- Badges -->
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/License-GPL_v3-blue?style=for-the-badge" alt="License" />
</div>

---

**CrafTools** is a web-based graphic editing engine built specifically to meet the demands of custom stationery, design studios, and album producers. The system offers a rich interface, allowing the manipulation of visual elements with millimeter precision, and optimized export for professional printing.

## 🚀 Key Features

### 📸 Advanced Image Manipulation
*   **Free Transformations**: Zoom, pan, and rotate images within dynamic containers.
*   **Native CSS Filters**: Real-time adjustment of brightness, contrast, saturation, and grayscale.
*   **Background Blur (Smart Fill)**: Automatically generates a blurred background from the main image to fill empty spaces or create visual depth.
*   **Cropping & Framing**: Support for different `object-fit` modes (Cover, Contain).

### ✍️ Text and Typography Tools
*   **In-Place Editing**: Direct editing on the canvas with support for custom Google Fonts.
*   **Complete Styling**: Control over colors, alignments, sizes, and layers (z-index).

### 🖼️ Album and Grid Generator (AlbumTool)
*   **Layout Automation**: Intelligent engine that automatically calculates the number of photos per page based on paper size (A4, A5, etc.).
*   **Business Card Mode**: Creation of synchronized grids where editing one card instantly reflects on all others on the page.
*   **Interactive Grid**: Reordering of slots via Drag-and-Drop.

## 🛠️ Technical Architecture

CrafTools was built following **Object-Oriented** principles and **Modern Componentization**, ensuring extensibility and performance.

### 🏗️ Web Components Core
The heart of the system is the `<craftools-element>`, a Custom Element that encapsulates:
*   **Interactivity**: Native drag, resize, and rotate systems.
*   **Isolation**: Protected internal structure that separates the actual content from the UI controls.
*   **Precision**: Support for native CSS units (`mm`, `px`, `cm`), ensuring that what you see on the screen is exactly what will be printed.

### 🧬 Inheritance System (BaseTool)
All tools (Image, Text, Album) inherit from a common `BaseTool`. This allows:
*   **Standardized Interface**: Border, rounding, padding, and z-index sections are shared and consistent.
*   **Style Copy/Paste**: A global system that allows copying complex properties from one element and pasting them onto another compatible type.

### 📐 Grid Engine (LayoutGrid)
A decoupled utility that uses **CSS Grid** to render complex layouts with absolute precision, respecting margins, bleeds, and spacing defined in templates.

## 📄 Export & Printing (PdfExport)

The CrafTools export engine is not just a screen "print". It features a **Flattening System**:
1.  **Serialization**: Converts dynamic Web Components into clean, static HTML/CSS.
2.  **Media Optimization**: Ensures images maintain their resolution and applied filters.
3.  **Page Precision**: Applies dynamic `@page` directives so the browser understands the exact paper size of each project page.

## 🧰 Development Guide

*   **Language**: Vanilla JavaScript (ES6+).
*   **Styling**: Modern CSS (Variables, Grid, Flexbox).
*   **UI Assets**: Material Symbols for icons and DM Sans typography.
*   **Interactions**: PointerEvents for hybrid mouse and touch support.

## 📜 License

This program is free software distributed under the terms of the **GNU General Public License v3**. See the license file for more details.

---
<div align="center">
  <i>CrafTools - Technology for Creativity.</i>
</div>
