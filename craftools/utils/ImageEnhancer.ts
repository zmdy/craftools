/**
 * ImageEnhancer.ts
 *
 * Canvas-based image quality enhancement and reference-based color grading engine.
 * Analyzes reference images to extract tonal distribution (luminance),
 * contrast/saturation targets, and 3-zone Color Balance (Shadows / Midtones / Highlights)
 * for Cyan-Red, Magenta-Green, and Yellow-Blue channels.
 *
 * Provides fast 2D ImageData pixel processing for the "Melhorar Qualidade da Imagem" toggle.
 */

export interface ColorBalanceZone {
  cyanRed: number;      // -100 to +100 (Red <-> Cyan)
  magentaGreen: number; // -100 to +100 (Green <-> Magenta)
  yellowBlue: number;   // -100 to +100 (Blue <-> Yellow)
}

export interface EnhanceProfile {
  brightness: number;  // -100 to +100
  contrast: number;    // -100 to +100
  saturation: number;  // -100 to +100
  shadows: ColorBalanceZone;
  midtones: ColorBalanceZone;
  highlights: ColorBalanceZone;
}

export const DEFAULT_ENHANCE_PROFILE: EnhanceProfile = {
  brightness: 6,
  contrast: 14,
  saturation: 18,
  shadows: { cyanRed: 2, magentaGreen: -2, yellowBlue: -4 },
  midtones: { cyanRed: 5, magentaGreen: 1, yellowBlue: -3 },
  highlights: { cyanRed: 3, magentaGreen: 2, yellowBlue: 4 },
};

export class ImageEnhancer {
  /** Cache of enhanced image Data URLs keyed by src + profile hash */
  private static _cache = new Map<string, string>();

  /**
   * Analyzes one or more reference images to extract color balance, brightness,
   * contrast, and saturation profiles.
   */
  static async analyzeReferences(imageSources: string[]): Promise<EnhanceProfile> {
    if (!imageSources.length) return { ...DEFAULT_ENHANCE_PROFILE };

    let totalLumSum = 0;
    let totalPixelCount = 0;

    let shadowSumR = 0, shadowSumG = 0, shadowSumB = 0, shadowCount = 0;
    let midtoneSumR = 0, midtoneSumG = 0, midtoneSumB = 0, midtoneCount = 0;
    let highlightSumR = 0, highlightSumG = 0, highlightSumB = 0, highlightCount = 0;

    let totalSatSum = 0;
    let lumSqSum = 0;

    for (const src of imageSources) {
      try {
        const img = await this._loadImage(src);
        const canvas = document.createElement('canvas');
        const sampleSize = 256; // Scale down for fast analysis
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) continue;

        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          totalLumSum += lum;
          lumSqSum += lum * lum;
          totalPixelCount++;

          // Saturation approximation: (max - min) / max
          const maxRGB = Math.max(r, g, b);
          const minRGB = Math.min(r, g, b);
          const sat = maxRGB > 0 ? (maxRGB - minRGB) / maxRGB : 0;
          totalSatSum += sat;

          if (lum < 85) {
            shadowSumR += r; shadowSumG += g; shadowSumB += b;
            shadowCount++;
          } else if (lum > 170) {
            highlightSumR += r; highlightSumG += g; highlightSumB += b;
            highlightCount++;
          } else {
            midtoneSumR += r; midtoneSumG += g; midtoneSumB += b;
            midtoneCount++;
          }
        }
      } catch (err) {
        console.warn('[ImageEnhancer] Failed to process reference image:', err);
      }
    }

    if (!totalPixelCount) return { ...DEFAULT_ENHANCE_PROFILE };

    const avgLum = totalLumSum / totalPixelCount;
    const lumVariance = Math.sqrt(Math.max(0, (lumSqSum / totalPixelCount) - (avgLum * avgLum)));
    const avgSat = totalSatSum / totalPixelCount;

    // Helper to compute zonal channel balances
    const getZoneBalance = (sumR: number, sumG: number, sumB: number, count: number): ColorBalanceZone => {
      if (!count) return { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 };
      const r = sumR / count;
      const g = sumG / count;
      const b = sumB / count;

      // Cyan-Red: difference between Red and average of (Green + Blue)
      const cr = r - ((g + b) / 2);
      // Magenta-Green: difference between Green and average of (Red + Blue)
      const mg = g - ((r + b) / 2);
      // Yellow-Blue: difference between average of (Red + Green) and Blue
      const yb = ((r + g) / 2) - b;

      // Scale to -100..+100 range and normalize
      const clampVal = (v: number) => Math.max(-30, Math.min(30, Math.round(v * 0.4)));
      return {
        cyanRed: clampVal(cr),
        magentaGreen: clampVal(mg),
        yellowBlue: clampVal(-yb),
      };
    };

    // Calculate target brightness & contrast shifts based on ideal histogram distribution
    const brightnessTarget = Math.round((128 - avgLum) * 0.25);
    const contrastTarget = Math.round((64 - lumVariance) * 0.4);
    const saturationTarget = Math.round((0.45 - avgSat) * 50);

    return {
      brightness: Math.max(-20, Math.min(25, brightnessTarget)),
      contrast: Math.max(5, Math.min(30, contrastTarget > 0 ? contrastTarget + 10 : 12)),
      saturation: Math.max(5, Math.min(35, saturationTarget > 0 ? saturationTarget + 15 : 18)),
      shadows: getZoneBalance(shadowSumR, shadowSumG, shadowSumB, shadowCount),
      midtones: getZoneBalance(midtoneSumR, midtoneSumG, midtoneSumB, midtoneCount),
      highlights: getZoneBalance(highlightSumR, highlightSumG, highlightSumB, highlightCount),
    };
  }

  /**
   * Applies enhancement algorithm to an HTMLImageElement or image URL using Canvas 2D.
   * Returns processed Data URL.
   */
  static async enhanceImage(srcOrImg: string | HTMLImageElement, profile: EnhanceProfile = DEFAULT_ENHANCE_PROFILE): Promise<string> {
    const src = typeof srcOrImg === 'string' ? srcOrImg : (srcOrImg.src || srcOrImg.getAttribute('src') || '');
    if (!src) throw new Error('Source image is empty');

    const cacheKey = `${src}::${JSON.stringify(profile)}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey)!;
    }

    const img = typeof srcOrImg === 'string' ? await this._loadImage(srcOrImg) : srcOrImg;
    const width = img.naturalWidth || img.width || 800;
    const height = img.naturalHeight || img.height || 600;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not create Canvas 2D context');

    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Pre-calculate profile factors
    const bShift = profile.brightness * 1.8; // Brightness shift
    const cFactor = Math.max(0.1, 1 + (profile.contrast / 100) * 1.2); // Contrast factor
    const sFactor = Math.max(0, 1 + (profile.saturation / 100) * 1.3); // Saturation factor

    const sZone = profile.shadows;
    const mZone = profile.midtones;
    const hZone = profile.highlights;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // 1. Calculate luminance (0 to 255)
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // 2. Calculate 3-zone weights
      const wShadow = Math.max(0, (128 - lum) / 128);
      const wHighlight = Math.max(0, (lum - 128) / 128);
      const wMidtone = 1 - Math.min(1, Math.abs(lum - 128) / 128);

      // 3. Apply zonal Color Balance (Cyan-Red, Magenta-Green, Yellow-Blue)
      // Red channel: influenced by Cyan-Red (+Red, -Cyan)
      const deltaR = (sZone.cyanRed * wShadow + mZone.cyanRed * wMidtone + hZone.cyanRed * wHighlight) * 0.8;
      // Green channel: influenced by Magenta-Green (+Green, -Magenta)
      const deltaG = (sZone.magentaGreen * wShadow + mZone.magentaGreen * wMidtone + hZone.magentaGreen * wHighlight) * 0.8;
      // Blue channel: influenced by Yellow-Blue (-Yellow = +Blue)
      const deltaB = (-sZone.yellowBlue * wShadow - mZone.yellowBlue * wMidtone - hZone.yellowBlue * wHighlight) * 0.8;

      r += deltaR;
      g += deltaG;
      b += deltaB;

      // 4. Apply Contrast & Brightness
      r = (r - 128) * cFactor + 128 + bShift;
      g = (g - 128) * cFactor + 128 + bShift;
      b = (b - 128) * cFactor + 128 + bShift;

      // 5. Apply Saturation adjustment relative to pixel luminance
      if (sFactor !== 1) {
        const curLum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = curLum + (r - curLum) * sFactor;
        g = curLum + (g - curLum) * sFactor;
        b = curLum + (b - curLum) * sFactor;
      }

      // Clamp RGB to [0, 255]
      data[i]     = r < 0 ? 0 : r > 255 ? 255 : r;
      data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }

    ctx.putImageData(imageData, 0, 0);
    const resultUrl = canvas.toDataURL('image/jpeg', 0.92);

    this._cache.set(cacheKey, resultUrl);
    return resultUrl;
  }

  /** Clears the processed image cache */
  static clearCache(): void {
    this._cache.clear();
  }

  private static _loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  }
}
