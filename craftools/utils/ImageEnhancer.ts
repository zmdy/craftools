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

import { AppSettings } from './AppSettings.js';

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
   * Cache of per-image analysis profiles keyed by src. Analysis is
   * deterministic for a given source, so it's memoized here -- the same photo
   * placed in several album cells (or re-enhanced on export) is measured once.
   */
  private static _analysisCache = new Map<string, EnhanceProfile>();

  /** Returns active enhance profile from AppSettings or DEFAULT_ENHANCE_PROFILE */
  static getProfile(): EnhanceProfile {
    try {
      const settings = (window as any).craftoolsAppSettings ?? AppSettings.getAll();
      return settings?.autoEnhanceProfile || DEFAULT_ENHANCE_PROFILE;
    } catch {
      return DEFAULT_ENHANCE_PROFILE;
    }
  }

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

  /** Returns a fresh copy of DEFAULT_ENHANCE_PROFILE. */
  static defaultProfile(): EnhanceProfile {
    return { ...DEFAULT_ENHANCE_PROFILE,
      shadows:    { ...DEFAULT_ENHANCE_PROFILE.shadows },
      midtones:   { ...DEFAULT_ENHANCE_PROFILE.midtones },
      highlights: { ...DEFAULT_ENHANCE_PROFILE.highlights },
    };
  }

  /** Clears the processed image and per-image analysis caches. */
  static clearCache(): void {
    this._cache.clear();
    this._analysisCache.clear();
  }

  // ── Per-image adaptive analysis ───────────────────────────────────────────

  /**
   * Measures ONE image and derives a correction profile tailored to it --
   * the opposite of {@link analyzeReferences}, which learns a look to
   * *reproduce*. Here the goal is to *normalize* each photo proportionally to
   * its own state, expressed ENTIRELY through the same brightness / contrast /
   * saturation / 3-zone colour-balance knobs the per-image panel exposes --
   * so the sliders show exactly what's being applied, and differ image to
   * image:
   *
   *   - `brightness` — from mean luminance vs a mid target: dark photos are
   *                    lifted, blown-out ones eased down.
   *   - `contrast`   — from the actual tonal range (0.4% / 99.6% luminance
   *                    percentiles): a flat, low-range photo gets a real boost,
   *                    an already-punchy one barely moves.
   *   - `saturation` — boosted when the image reads dull, eased back when
   *                    it's already very saturated.
   *   - `shadows/midtones/highlights` — corrective colour balance that
   *                    *neutralizes* each zone's measured colour cast (the
   *                    inverse of the cast, not a reproduction of it).
   *
   * Deterministic per src and memoized. On any failure (load error, tainted
   * cross-origin canvas) it falls back to the legacy fixed default so
   * enhancement still does something reasonable.
   */
  static async analyzeImage(src: string): Promise<EnhanceProfile> {
    if (!src) return this.defaultProfile();
    const cached = this._analysisCache.get(src);
    if (cached) return cached;

    let profile: EnhanceProfile;
    try {
      const img = await this._loadImage(src);
      const sample = 160; // enough for stable histogram, cheap to scan
      const canvas = document.createElement('canvas');
      canvas.width = sample;
      canvas.height = sample;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return this.defaultProfile();
      ctx.drawImage(img, 0, 0, sample, sample);
      const data = ctx.getImageData(0, 0, sample, sample).data;

      const lumHist = new Array<number>(256).fill(0);
      let n = 0, lumSum = 0, satSum = 0;

      // Per-zone channel accumulators (for corrective colour balance).
      let sR = 0, sG = 0, sB = 0, sN = 0; // shadows   (lum < 85)
      let mR = 0, mG = 0, mB = 0, mN = 0; // midtones  (85..170)
      let hR = 0, hG = 0, hB = 0, hN = 0; // highlights (> 170)

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 8) continue; // skip (near-)transparent pixels
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const li = lum < 0 ? 0 : lum > 255 ? 255 : lum | 0;
        lumHist[li]++;
        lumSum += lum;
        n++;

        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        satSum += mx > 0 ? (mx - mn) / mx : 0;

        if (lum < 85)       { sR += r; sG += g; sB += b; sN++; }
        else if (lum > 170) { hR += r; hG += g; hB += b; hN++; }
        else                { mR += r; mG += g; mB += b; mN++; }
      }

      if (!n) return this.defaultProfile();

      // Cumulative-histogram percentile lookup.
      const pAt = (frac: number): number => {
        const target = n * frac;
        let acc = 0;
        for (let l = 0; l < 256; l++) {
          acc += lumHist[l];
          if (acc >= target) return l;
        }
        return 255;
      };

      const clampI = (v: number, lo: number, hi: number) =>
        Math.max(lo, Math.min(hi, Math.round(v)));

      // ── Brightness: pull mean luminance toward a mid target ───────────────
      const avgLum = lumSum / n;
      const brightness = clampI((120 - avgLum) * 0.22, -25, 25);

      // ── Contrast: from the real tonal range (flat range -> boost) ─────────
      const bp = pAt(0.004);
      const wp = pAt(0.996);
      const range = Math.max(1, wp - bp);
      const contrast = clampI((205 - range) * 0.18, -8, 35);

      // ── Saturation: dull -> boost, already-vivid -> ease back ─────────────
      const avgSat = satSum / n;
      const saturation = clampI((0.42 - avgSat) * 55, -10, 28);

      // ── Corrective per-zone colour balance (neutralize each zone's cast) ──
      // A zone that skews red gets a NEGATIVE Cyan-Red push (toward cyan), etc.
      // Signs match enhanceImage's pipeline: +cyanRed adds red, +magentaGreen
      // adds green, +yellowBlue removes blue.
      const zoneBalance = (zr: number, zg: number, zb: number, zc: number): ColorBalanceZone => {
        if (!zc) return { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 };
        const r = zr / zc, g = zg / zc, b = zb / zc;
        const gray = (r + g + b) / 3;
        const K = 0.45; // gentle correction
        return {
          cyanRed:      clampI(-(r - gray) * K, -22, 22),
          magentaGreen: clampI(-(g - gray) * K, -22, 22),
          yellowBlue:   clampI( (b - gray) * K, -22, 22),
        };
      };

      profile = {
        brightness,
        contrast,
        saturation,
        shadows:    zoneBalance(sR, sG, sB, sN),
        midtones:   zoneBalance(mR, mG, mB, mN),
        highlights: zoneBalance(hR, hG, hB, hN),
      };
    } catch (err) {
      console.warn('[ImageEnhancer] Per-image analysis failed, using default profile:', err);
      profile = this.defaultProfile();
    }

    this._analysisCache.set(src, profile);
    return profile;
  }

  /**
   * Blends a per-image `base` profile (from {@link analyzeImage}) with the
   * global reference-learned/manual `bias` profile. Two separate strengths:
   *
   *   - `toneK`  — light touch for brightness/contrast/saturation, since the
   *                per-image analysis already handles exposure/tone adaptively.
   *   - `colorK` — strong for the 3-zone colour balance, because that IS the
   *                "look" the user teaches via reference images (Settings ->
   *                "Imagens de Referência para Aprendizado de Cor") and it
   *                should be applied consistently across every photo, on top of
   *                the per-image cast correction.
   */
  static combineProfiles(
    base: EnhanceProfile,
    bias?: EnhanceProfile,
    toneK = 0.30,
    colorK = 0.75,
  ): EnhanceProfile {
    if (!bias) return { ...base, shadows: { ...base.shadows }, midtones: { ...base.midtones }, highlights: { ...base.highlights } };
    const zone = (a: ColorBalanceZone, b: ColorBalanceZone): ColorBalanceZone => ({
      cyanRed:      Math.round(a.cyanRed      + b.cyanRed      * colorK),
      magentaGreen: Math.round(a.magentaGreen + b.magentaGreen * colorK),
      yellowBlue:   Math.round(a.yellowBlue   + b.yellowBlue   * colorK),
    });
    return {
      brightness: Math.round(base.brightness + bias.brightness * toneK),
      contrast:   Math.round(base.contrast   + bias.contrast   * toneK),
      saturation: Math.round(base.saturation + bias.saturation * toneK),
      shadows:    zone(base.shadows,    bias.shadows),
      midtones:   zone(base.midtones,   bias.midtones),
      highlights: zone(base.highlights, bias.highlights),
    };
  }

  /**
   * The profile actually applied to `src` in pure-auto mode: the per-image
   * analysis blended with the global reference/manual `bias`. This is what the
   * per-element panel shows in its sliders (so they differ image to image),
   * and what gets frozen into a per-image override the moment the user edits a
   * slider there.
   */
  static async getEffectiveProfile(
    src: string,
    bias?: EnhanceProfile,
    toneK = 0.30,
    colorK = 0.75,
  ): Promise<EnhanceProfile> {
    return this.combineProfiles(await this.analyzeImage(src), bias, toneK, colorK);
  }

  /**
   * Adaptive entry point for the "Melhorar Qualidade da Imagem" toggle:
   * analyzes THIS image, blends the global reference/manual profile on top as
   * a light colour "toque", and renders the result. Replaces the old
   * `enhanceImage(src, fixedGlobalProfile)` call so every photo -- especially
   * each album cell -- is corrected proportionally to its own tone/colour
   * instead of all receiving the same fixed shift.
   */
  static async enhanceImageAuto(
    srcOrImg: string | HTMLImageElement,
    bias?: EnhanceProfile,
    toneK = 0.30,
    colorK = 0.75,
  ): Promise<string> {
    const src = typeof srcOrImg === 'string'
      ? srcOrImg
      : (srcOrImg.src || srcOrImg.getAttribute('src') || '');
    if (!src) throw new Error('Source image is empty');

    const final = await this.getEffectiveProfile(src, bias, toneK, colorK);
    return this.enhanceImage(srcOrImg, final);
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
