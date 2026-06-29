/**
 * UserTemplates.js
 *
 * CRUD simples para templates de álbum criados pelo usuário,
 * persistidos no localStorage. Cada template segue o mesmo schema
 * dos GridSizes.js/API, com campo extra `_source: 'user'` e `_id` único.
 *
 * Uso:
 *   import { UserTemplates } from './UserTemplates.js';
 *   UserTemplates.save({ name: 'Meu Kit', ... });
 *   const all = UserTemplates.load();
 */

const STORAGE_KEY = 'craftools_custom_templates';

export class UserTemplates {

    /** Lê todos os templates do usuário do localStorage.
     *  @returns {object[]}
     */
    static load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    /**
     * Salva (insere ou actualiza) um template.
     * Se o objeto já tiver `_id`, substitui o existente.
     * Caso contrário, gera um novo `_id` e adiciona.
     * @param {object} template
     * @returns {object} O template salvo (com _id e _source definidos)
     */
    static save(template) {
        const all = this.load();

        const toSave = {
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

    /**
     * Remove um template pelo seu _id.
     * @param {string} id
     */
    static delete(id) {
        const all = this.load().filter(t => t._id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    }

    /** Remove todos os templates do usuário. */
    static clear() {
        localStorage.removeItem(STORAGE_KEY);
    }

    /**
     * Retorna um template pelo _id, ou null.
     * @param {string} id
     * @returns {object|null}
     */
    static getById(id) {
        return this.load().find(t => t._id === id) || null;
    }
}
