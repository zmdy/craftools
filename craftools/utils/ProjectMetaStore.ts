import type { ProjectMeta } from './ProjectSerializer.js';

export interface ProjectMetaState {
  title: string;
  /** Per-locale description, keyed by I18n locale code ('pt-br' | 'en' | 'es'). */
  description: Record<string, string>;
  author: string;
  /** "Demais informações" -- free-form catch-all notes field. */
  notes: string;
  /**
   * Base64 data URI of a manually-uploaded thumbnail, or '' if the user
   * hasn't set one this session (in which case export falls back to the
   * usual html2canvas auto-capture -- see ProjectSerializer.exportProject()).
   */
  thumbnail: string;
}

/**
 * In-memory store for the currently open project's editable metadata --
 * backs the "Informações do projeto" tab (ProjectInfoTool.ts).
 *
 * Nothing like this existed before this feature: the project title was
 * only ever asked once, via a single window.prompt() at export time
 * (ExportTool.ts's 'project' case), and description/author/thumbnail were
 * populated by hand only for the bundled assets/samples/*.craftools files
 * -- there was no session-long place to hold or edit them.
 *
 * Lifecycle:
 *  - reset() on a brand-new project (Setup.ts's "Criar projeto novo" ->
 *    craftools.ts's `craftools-start` handler, non-sample branch).
 *  - setFromMeta() right after any ProjectSerializer.importProject() call
 *    (sample gallery via craftools.ts's _loadSampleProject(), the in-editor
 *    "Importar Projeto" file picker in Editor.ts, and the emergency-restore
 *    path), reading ProjectSerializer.lastImportedMeta.
 *  - Read live by ProjectInfoTool.ts (renders the fields) and written back
 *    on every input event (no separate "save" step, matching every other
 *    hand-rolled panel in this app).
 *  - Read by ExportTool.ts's 'project' case when building the next
 *    .craftools file's meta block.
 */
class _ProjectMetaStore {
  private _state: ProjectMetaState = _ProjectMetaStore._defaults();

  private static _defaults(): ProjectMetaState {
    return { title: '', description: {}, author: '', notes: '', thumbnail: '' };
  }

  get(): ProjectMetaState {
    return this._state;
  }

  /** Resets to blank defaults -- called when starting a brand-new project via the manual setup wizard. */
  reset(): void {
    this._state = _ProjectMetaStore._defaults();
  }

  /**
   * Populates from a freshly imported/loaded project's ProjectMeta. Accepts
   * both the current per-locale `description` shape and the legacy plain
   * string (normalized into `{ 'pt-br': <string> }` so the tab always has a
   * per-locale object to work with).
   */
  setFromMeta(meta: ProjectMeta): void {
    const description = typeof meta.description === 'string'
      ? { 'pt-br': meta.description }
      : { ...(meta.description ?? {}) };
    this._state = {
      title: meta.title ?? '',
      description,
      author: (meta.author && meta.author !== 'local-user') ? meta.author : '',
      notes: meta.notes ?? '',
      // Not carried over from the loaded file's own thumbnail -- this field
      // specifically means "user picked a NEW thumbnail this session to
      // override auto-capture on next export"; leaving it '' just means
      // "auto-capture as usual", same as any freshly-opened project.
      thumbnail: '',
    };
  }

  update(patch: Partial<ProjectMetaState>): void {
    this._state = { ...this._state, ...patch };
  }

  setDescriptionForLang(lang: string, text: string): void {
    this._state = { ...this._state, description: { ...this._state.description, [lang]: text } };
  }
}

export const ProjectMetaStore = new _ProjectMetaStore();
