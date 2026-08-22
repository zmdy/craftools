/**
 * UserPalettes.ts — storage for the "Paletas de cores personalizadas"
 * feature: user-created named palettes, each a short ordered list of items
 * that can be either a solid color or a full gradient (type/angle/stops) --
 * so a palette built from "Extrair paleta da imagem" (ImagePaletteExtractor.ts)
 * can keep the gradients it suggested, not just flatten everything to solids.
 *
 * Same load/save/delete shape as UserTemplates.ts (the existing "user's own
 * saved X" pattern in this codebase), just for palettes instead of grid
 * templates, and using SafeStorage instead of raw localStorage so a full
 * quota doesn't throw here either.
 *
 * SYSTEM_PALETTES (the built-in "paletas do sistema") lives in this file too
 * since it's the same PaletteItem/CustomPalette shape -- ColorPickerUI.ts
 * renders both SYSTEM_PALETTES and UserPalettes.load() side by side in its
 * "Paletas" section.
 */

import { SafeStorage } from './SafeStorage.js';
import type { GradientValue } from './ColorPickerUI.js';

export type PaletteItem =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; gradient: GradientValue };

export interface CustomPalette {
  _id: string;
  name: string;
  items: PaletteItem[];
  createdAt: number;
}

const STORAGE_KEY = 'craftools_custom_palettes';

const solid = (color: string): PaletteItem => ({ type: 'solid', color });

/**
 * Curated built-in palettes shown as "Paletas do sistema" -- always
 * available, never edited/deleted by the user (only their own saved
 * palettes in UserPalettes.load() can be). Read-only at the type level
 * (`as const`-style usage: callers must copy before mutating, same
 * convention as ColorPickerUI.ts's COLOR_PRESETS/GRADIENT_PRESETS).
 */
export const SYSTEM_PALETTES: CustomPalette[] = [
  {
    _id: 'sys_vibrant', name: 'Vibrante', createdAt: 0,
    items: ['#f97316', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7'].map(solid),
  },
  {
    _id: 'sys_pastel', name: 'Pastel', createdAt: 0,
    items: ['#fde2e2', '#fef3c7', '#d9f7e8', '#dbeafe', '#ede9fe', '#fce7f3'].map(solid),
  },
  {
    _id: 'sys_earth', name: 'Terroso', createdAt: 0,
    items: ['#7c4a2d', '#a9713f', '#c8a15d', '#8a9b6e', '#4b5d3a', '#e8dcc4'].map(solid),
  },
  {
    _id: 'sys_ocean', name: 'Oceano', createdAt: 0,
    items: [
      solid('#003049'), solid('#00587a'), solid('#0a9396'), solid('#94d2bd'),
      { type: 'gradient', gradient: { type: 'linear', angle: 135, stops: ['#003049', '#0a9396'] } },
    ],
  },
  {
    _id: 'sys_sunset', name: 'Pôr do Sol', createdAt: 0,
    items: [
      solid('#ff9e00'), solid('#ff5400'), solid('#e01e37'), solid('#6a0dad'),
      { type: 'gradient', gradient: { type: 'linear', angle: 120, stops: ['#ff9e00', '#e01e37'] } },
    ],
  },
  {
    _id: 'sys_mono', name: 'Preto e Branco', createdAt: 0,
    items: ['#18181b', '#3f3f46', '#71717a', '#a1a1aa', '#d4d4d8', '#ffffff'].map(solid),
  },
];

export class UserPalettes {
  static load(): CustomPalette[] {
    try {
      const raw = SafeStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private static _persist(all: CustomPalette[]): void {
    SafeStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  /** Creates (or, if `palette._id` matches an existing one, overwrites) a saved palette. */
  static save(palette: { _id?: string; name: string; items: PaletteItem[] }): CustomPalette {
    const all = this.load();
    const toSave: CustomPalette = {
      name: palette.name,
      items: palette.items,
      _id: palette._id || ('up_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
      createdAt: Date.now(),
    };
    const idx = all.findIndex(p => p._id === toSave._id);
    if (idx >= 0) all[idx] = { ...all[idx], ...toSave, createdAt: all[idx].createdAt };
    else all.push(toSave);
    this._persist(all);
    return toSave;
  }

  /** Convenience wrapper for the common "brand new palette from N items" case. */
  static create(name: string, items: PaletteItem[]): CustomPalette {
    return this.save({ name, items });
  }

  /** Appends one item (solid or gradient) to an existing saved palette. No-op if the id isn't found. */
  static addItem(id: string, item: PaletteItem): CustomPalette | null {
    const all = this.load();
    const idx = all.findIndex(p => p._id === id);
    if (idx < 0) return null;
    all[idx] = { ...all[idx], items: [...all[idx].items, item] };
    this._persist(all);
    return all[idx];
  }

  static rename(id: string, name: string): void {
    const all = this.load();
    const idx = all.findIndex(p => p._id === id);
    if (idx < 0) return;
    all[idx] = { ...all[idx], name };
    this._persist(all);
  }

  static delete(id: string): void {
    this._persist(this.load().filter(p => p._id !== id));
  }

  static clear(): void {
    SafeStorage.removeItem(STORAGE_KEY);
  }
}
