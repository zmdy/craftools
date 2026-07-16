/**
 * UserTemplates.ts
 */

import type { GridTemplate } from './GridSizes.js';

const STORAGE_KEY = 'craftools_custom_templates';

export class UserTemplates {

  static load(): GridTemplate[] {
      try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
      } catch {
          return [];
      }
  }

  static save(template: GridTemplate): GridTemplate {
      const all = this.load();

      const toSave: GridTemplate = {
          ...template,
          _source: 'user',
          _id: template._id || ('ut_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
      };

      const idx = all.findIndex(t => t._id === toSave._id);
      if (idx >= 0) {
          all[idx] = toSave;
      } else {
          all.push(toSave);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      return toSave;
  }

  static delete(id: string): void {
      const all = this.load().filter(t => t._id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  static clear(): void {
      localStorage.removeItem(STORAGE_KEY);
  }

  static getById(id: string): GridTemplate | null {
      return this.load().find(t => t._id === id) || null;
  }
}
