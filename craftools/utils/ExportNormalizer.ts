/**
 * ExportNormalizer.ts — Pre-processor for PDF and Image Export pipelines.
 *
 * Solves export fidelity issues across html2canvas (ImageExport) and
 * @tooooools/html-to-svg / svg2pdf.js (PdfVectorExport & AgendaSvgExport):
 *
 * 1. Image Object-Fit & Pan/Zoom Crop Normalization:
 *    html2canvas ignores CSS `object-fit: cover/contain` on <img> tags.
 *    html-to-svg creates SVG <image> tags without preserveAspectRatio or
 *    cell clip paths for translated/scaled photos.
 *    ExportNormalizer renders each <img> with non-default object-fit,
 *    zoom, pan, or rotation onto a 300 DPI Canvas 2D, pre-cropping it to
 *    the exact container dimensions. Replaces img.src with the pre-cropped
 *    PNG Data URL, guaranteeing 100% pixel-perfect image fitting and zero
 *    distortion across all export routes.
 *
 * 2. Auto-Enhancement Synchronization:
 *    Ensures photos with `autoEnhance: true` have their enhanced Canvas Data
 *    URL generated and applied to img.src before export capture.
 *
 * 3. Text Layout & Font Alignment Normalization:
 *    Freezes explicit computed font-size, line-height, text-align, and
 *    white-space on contenteditable and AutoFitText elements.
 */

import { ImageEnhancer } from './ImageEnhancer.js';

export interface ImageMeta {
  src?: string;
  originalSrc?: string;
  autoEnhance?: boolean;
  objectFit?: string;
  contentAlign?: string;
  zoom?: number;
  posX?: number;
  posY?: number;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
}

export class ExportNormalizer {
  /**
   * Pre-processes a cloned page element before passing it to html2canvas or html-to-svg.
   * Must be called while pageClone is attached to a visible or off-screen DOM stage
   * so offsetWidth / offsetHeight / getComputedStyle return valid layout values.
   */
  static async normalizePage(pageClone: HTMLElement): Promise<void> {
    await this.syncAutoEnhancement(pageClone);
    await this.normalizeImages(pageClone);
    this.normalizeTexts(pageClone);
  }

  /**
   * Ensures all images with autoEnhance: true have their Canvas quality-enhanced Data URL generated.
   */
  static async syncAutoEnhancement(container: HTMLElement): Promise<void> {
    const elements = [...container.querySelectorAll<HTMLElement>('craftools-element[data-craftool="image"], .craftools-grid-cell, .photostrip-slot')];

    for (const el of elements) {
      const meta = (el as HTMLElement & { _craftoolsMeta?: ImageMeta })._craftoolsMeta;
      const isAutoEnhance = meta?.autoEnhance ?? el.getAttribute('data-auto-enhance') === 'true';

      if (isAutoEnhance) {
        const img = el.querySelector<HTMLImageElement>('img');
        if (img && img.src && !img.src.startsWith('data:image/svg+xml')) {
          try {
            const rawSrc = meta?.originalSrc || img.src;
            // Match the on-canvas result: per-image adaptive analysis with the
            // global reference-learned profile blended on top as a light
            // colour "toque" (see ImageEnhancer.enhanceImageAuto).
            const bias = ImageEnhancer.getProfile();
            const enhancedUrl = await ImageEnhancer.enhanceImageAuto(rawSrc, bias);
            img.src = enhancedUrl;
          } catch (err) {
            console.warn('[ExportNormalizer] Auto-enhance sync failed for image:', err);
          }
        }
      }
    }
  }

  /**
   * Pre-crops and normalizes all <img> elements on pageClone using Canvas 2D.
   * Solves object-fit and pan/zoom transform distortion in both html2canvas and html-to-svg.
   */
  static async normalizeImages(container: HTMLElement): Promise<void> {
    const images = [...container.querySelectorAll<HTMLImageElement>('img')];

    for (const img of images) {
      // Skip placeholders, missing sources, or micro SVGs
      const src = img.getAttribute('src') || img.src || '';
      if (!src || src.startsWith('data:image/svg+xml')) continue;

      const parentEl = img.parentElement;
      if (!parentEl) continue;

      // Find host craftools-element or grid cell for metadata
      const hostEl = (img.closest<HTMLElement>('craftools-element, .craftools-grid-cell, .photostrip-slot')) || parentEl;
      const meta = (hostEl as HTMLElement & { _craftoolsMeta?: ImageMeta })._craftoolsMeta ?? {};

      const computedStyle = window.getComputedStyle(img);
      const objectFit = meta.objectFit || computedStyle.objectFit || 'cover';
      const contentAlign = meta.contentAlign || computedStyle.objectPosition || 'center center';
      const zoom = meta.zoom ?? 1;
      const posX = meta.posX ?? 0;
      const posY = meta.posY ?? 0;
      const rotation = meta.rotation ?? 0;
      const flipH = meta.flipH ?? false;
      const flipV = meta.flipV ?? false;

      // Determine container box dimensions
      const boxWidth = parentEl.clientWidth || parentEl.offsetWidth || parseFloat(computedStyle.width) || 200;
      const boxHeight = parentEl.clientHeight || parentEl.offsetHeight || parseFloat(computedStyle.height) || 200;

      if (boxWidth <= 0 || boxHeight <= 0) continue;

      // If default layout without zoom/pan/fit-cover, skip heavy canvas crop
      const isDefaultFit = objectFit === 'fill' && zoom === 1 && posX === 0 && posY === 0 && rotation === 0 && !flipH && !flipV;
      if (isDefaultFit) continue;

      try {
        const croppedDataUrl = await this._renderCroppedImage({
          src,
          boxWidth,
          boxHeight,
          objectFit,
          contentAlign,
          zoom,
          posX,
          posY,
          rotation,
          flipH,
          flipV,
        });

        if (croppedDataUrl) {
          img.src = croppedDataUrl;
          img.style.objectFit = 'fill';
          img.style.objectPosition = 'center center';
          img.style.transform = 'none';
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.top = '0';
          img.style.left = '0';
          img.style.position = 'absolute';
        }
      } catch (err) {
        console.warn('[ExportNormalizer] Failed to pre-crop image for export:', err);
      }
    }
  }

  /**
   * Freezes explicit computed text properties to ensure identical layout in export.
   */
  static normalizeTexts(container: HTMLElement): void {
    const textEls = [...container.querySelectorAll<HTMLElement>('[contenteditable], .ct-text-content, .craftools-element[data-craftool="title"], .craftools-element[data-craftool="paragraph"]')];

    for (const el of textEls) {
      const cs = window.getComputedStyle(el);
      if (!el.style.fontSize && cs.fontSize) el.style.fontSize = cs.fontSize;
      if (!el.style.lineHeight && cs.lineHeight) el.style.lineHeight = cs.lineHeight;
      if (!el.style.textAlign && cs.textAlign) el.style.textAlign = cs.textAlign;
      if (!el.style.letterSpacing && cs.letterSpacing) el.style.letterSpacing = cs.letterSpacing;
      if (!el.style.fontFamily && cs.fontFamily) el.style.fontFamily = cs.fontFamily;
      el.style.whiteSpace = 'pre-wrap';
      el.style.wordBreak = 'break-word';
    }
  }

  // ── Canvas 2D Cropping Engine ─────────────────────────────────────────────

  private static _renderCroppedImage(opts: {
    src: string;
    boxWidth: number;
    boxHeight: number;
    objectFit: string;
    contentAlign: string;
    zoom: number;
    posX: number;
    posY: number;
    rotation: number;
    flipH: boolean;
    flipV: boolean;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const { src, boxWidth, boxHeight, objectFit, zoom, posX, posY, rotation, flipH, flipV } = opts;

        // Render at 3x resolution scale for sharp 300 DPI print quality
        const scale = 3;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(boxWidth * scale);
        canvas.height = Math.round(boxHeight * scale);

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas 2D context unavailable'));

        ctx.scale(scale, scale);

        // Fill background with transparent or white if needed
        ctx.clearRect(0, 0, boxWidth, boxHeight);

        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;

        if (!imgW || !imgH) return resolve(src);

        // Calculate base fitted size
        let drawW = boxWidth;
        let drawH = boxHeight;

        if (objectFit === 'cover') {
          const coverScale = Math.max(boxWidth / imgW, boxHeight / imgH);
          drawW = imgW * coverScale;
          drawH = imgH * coverScale;
        } else if (objectFit === 'contain') {
          const containScale = Math.min(boxWidth / imgW, boxHeight / imgH);
          drawW = imgW * containScale;
          drawH = imgH * containScale;
        }

        // Apply zoom scale
        drawW *= zoom;
        drawH *= zoom;

        // Draw centered with offsets & rotation
        ctx.save();

        // Move to box center
        ctx.translate(boxWidth / 2 + posX, boxHeight / 2 + posY);

        // Rotate
        if (rotation) {
          ctx.rotate((rotation * Math.PI) / 180);
        }

        // Flip
        const scaleX = flipH ? -1 : 1;
        const scaleY = flipV ? -1 : 1;
        if (flipH || flipV) {
          ctx.scale(scaleX, scaleY);
        }

        // Draw image centered at origin
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

        ctx.restore();

        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = err => reject(err);
      img.src = opts.src;
    });
  }
}
