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

/**
 * Per-channel auto-levels (tonal-range stretch). Computed individually for
 * each image by {@link ImageEnhancer.analyzeImage} from its own luminance
 * histogram -- black/white points pulled to the image's actual darkest/
 * lightest percentiles, plus a midtone gamma nudge. Optional: a fixed/manual
 * profile (the global "bias") never carries this, so `enhanceImage` skips the
 * whole step when it's absent and behaves exactly as before.
 */
export interface LevelsAdjust {
  blackPoint: number;  // 0..255 — input level mapped to 0
  whitePoint: number;  // 0..255 — input level mapped to 255
  gamma: number;       // >0 — <1 brightens midtones, >1 darkens
}

/**
 * Gray-world white-balance gains (multiplicative, per channel, ~1 = neutral).
 * Computed per image to neutralize a measured colour cast; softened and
 * clamped so genuinely colourful photos aren't desaturated. Optional for the
 * same reason as {@link LevelsAdjust}.
 */
export interface WhiteBalanceGains {
  r: number;
  g: number;
  b: number;
}

export interface EnhanceProfile {
  brightness: number;  // -100 to +100
  contrast: number;    // -100 to +100
  saturation: number;  // -100 to +100
  shadows: ColorBalanceZone;
  midtones: ColorBalanceZone;
  highlights: ColorBalanceZone;
  /** Per-image tonal stretch (auto-levels). Absent on fixed/manual profiles. */
  levels?: LevelsAdjust;
  /** Per-image colour-cast correction. Absent on fixed/manual profiles. */
  whiteBalance?: WhiteBalanceGains;
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

    // Per-image pre-correction factors (present only on analyzed profiles --
    // a fixed/manual "bias" profile carries neither, so both steps are skipped
    // and the pipeline is byte-for-byte the legacy one).
    const wb = profile.whiteBalance;
    const lv = profile.levels;
    const lvScale   = lv ? 255 / Math.max(1, lv.whitePoint - lv.blackPoint) : 1;
    const lvBlack   = lv ? lv.blackPoint : 0;
    const lvGammaEx = lv && lv.gamma > 0 ? 1 / lv.gamma : 1;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // 0a. White balance — neutralize the image's own colour cast (gray-world
      //     gains, softened/clamped in analyzeImage so vivid photos survive).
      if (wb) {
        r *= wb.r; g *= wb.g; b *= wb.b;
        if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
      }

      // 0b. Auto-levels — stretch this image's actual tonal range to full
      //     black..white, then a midtone gamma nudge. This is the per-image
      //     "proportional" correction: a flat/hazy photo gets a big stretch, an
      //     already-punchy one barely moves.
      if (lv) {
        r = (r - lvBlack) * lvScale;
        g = (g - lvBlack) * lvScale;
        b = (b - lvBlack) * lvScale;
        if (r < 0) r = 0; if (g < 0) g = 0; if (b < 0) b = 0;
        if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
        if (lvGammaEx !== 1) {
          r = 255 * Math.pow(r / 255, lvGammaEx);
          g = 255 * Math.pow(g / 255, lvGammaEx);
          b = 255 * Math.pow(b / 255, lvGammaEx);
        }
      }

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
   * its own state:
   *
   *   - `levels`        — auto-contrast: black/white points pulled to the
   *                       image's real darkest/lightest percentiles (0.4% /
   *                       99.6%), plus a midtone gamma nudge toward mid-grey.
   *                       A flat, low-contrast photo gets a strong stretch; an
   *                       already well-exposed one barely moves.
   *   - `whiteBalance`  — gray-world gains that neutralize a measured colour
   *                       cast, softened and clamped so a genuinely warm/cool
   *                       or vivid subject isn't flattened to grey.
   *   - `saturation`    — boosted when the image reads dull, eased back when
   *                       it's already very saturated.
   *
   * brightness/contrast/colour-balance are left near zero on purpose: the
   * tonal work is done by `levels`, and any deliberate colour *look* is meant
   * to come from the global reference-learned profile blended on top (see
   * {@link combineProfiles} / {@link enhanceImageAuto}).
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
      let n = 0;
      let sumR = 0, sumG = 0, sumB = 0, wbN = 0;
      let satSum = 0;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 8) continue; // skip (near-)transparent pixels
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const li = lum < 0 ? 0 : lum > 255 ? 255 : lum | 0;
        lumHist[li]++;
        n++;

        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        satSum += mx > 0 ? (mx - mn) / mx : 0;

        // White-balance estimate excludes near-black/near-white pixels: they
        // carry little reliable hue and clipped highlights would bias the cast.
        if (lum > 25 && lum < 235) { sumR += r; sumG += g; sumB += b; wbN++; }
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

      // ── Auto-levels ──────────────────────────────────────────────────────
      let bp = Math.max(0, Math.min(60, pAt(0.004)));
      let wp = Math.max(195, Math.min(255, pAt(0.996)));
      if (wp - bp < 32) { bp = 0; wp = 255; } // degenerate: skip stretch

      const hasHeadroom = bp > 4 || wp < 251;
      let levels: LevelsAdjust | undefined;
      if (hasHeadroom) {
        // Partial stretch (85%) rather than snapping fully to 0..255 -- keeps a
        // little shadow/highlight headroom so the correction reads natural, not
        // clipped.
        const LV = 0.85;
        const blackPoint = bp * LV;
        const whitePoint = 255 - (255 - wp) * LV;

        // Midtone gamma: aim the (post-stretch) median toward mid-grey, at 60%
        // strength and clamped so it never turns into a heavy exposure shove.
        const median = pAt(0.5);
        const mStretched = Math.max(0, Math.min(255, (median - blackPoint) * (255 / Math.max(1, whitePoint - blackPoint))));
        const mNorm = Math.max(0.05, Math.min(0.95, mStretched / 255));
        let gamma = Math.log(0.5) / Math.log(mNorm);
        gamma = Math.max(0.75, Math.min(1.35, 1 + (gamma - 1) * 0.6));

        levels = { blackPoint, whitePoint, gamma };
      }

      // ── White balance (gray-world) ───────────────────────────────────────
      let whiteBalance: WhiteBalanceGains | undefined;
      if (wbN) {
        const mr = sumR / wbN, mg = sumG / wbN, mb = sumB / wbN;
        const gray = (mr + mg + mb) / 3;
        if (gray > 1) {
          const rawR = gray / Math.max(1, mr);
          const rawG = gray / Math.max(1, mg);
          const rawB = gray / Math.max(1, mb);
          const cast = Math.max(Math.abs(rawR - 1), Math.abs(rawG - 1), Math.abs(rawB - 1));
          if (cast > 0.03) { // ignore negligible casts
            const WBK = 0.6; // soften: correct 60% of the measured cast
            const soft = (x: number) => Math.max(0.8, Math.min(1.25, 1 + (x - 1) * WBK));
            whiteBalance = { r: soft(rawR), g: soft(rawG), b: soft(rawB) };
          }
        }
      }

      // ── Adaptive saturation ──────────────────────────────────────────────
      const avgSat = satSum / n;
      const saturation = Math.max(-8, Math.min(28, Math.round((0.42 - avgSat) * 60)));

      profile = {
        brightness: 0,
        contrast: 0,
        saturation,
        shadows:    { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
        midtones:   { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
        highlights: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
        levels,
        whiteBalance,
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
   *                should be applied consistently across every photo.
   *
   * The per-image `levels`/`whiteBalance` are carried straight through (a
   * fixed profile never has them to contribute).
   */
  static combineProfiles(
    base: EnhanceProfile,
    bias?: EnhanceProfile,
    toneK = 0.30,
    colorK = 0.75,
  ): EnhanceProfile {
    if (!bias) return base;
    const zone = (a: ColorBalanceZone, b: ColorBalanceZone): ColorBalanceZone => ({
      cyanRed:      a.cyanRed      + b.cyanRed      * colorK,
      magentaGreen: a.magentaGreen + b.magentaGreen * colorK,
      yellowBlue:   a.yellowBlue   + b.yellowBlue   * colorK,
    });
    return {
      brightness: base.brightness + bias.brightness * toneK,
      contrast:   base.contrast   + bias.contrast   * toneK,
      saturation: base.saturation + bias.saturation * toneK,
      shadows:    zone(base.shadows,    bias.shadows),
      midtones:   zone(base.midtones,   bias.midtones),
      highlights: zone(base.highlights, bias.highlights),
      levels: base.levels,
      whiteBalance: base.whiteBalance,
    };
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

    const base  = await this.analyzeImage(src);
    const final = this.combineProfiles(base, bias, toneK, colorK);
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
