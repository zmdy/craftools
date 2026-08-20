/**
 * Version.ts — single source of truth for CrafTools' semantic app version.
 *
 * Previously only declared inline in craftools.ts (`export const VERSION =
 * '0.1.0';`), consumed nowhere else in the codebase. Pulled out here so the
 * "Informações do projeto" tab (ProjectInfoTool.ts) can read it as a
 * read-only field without statically importing craftools.ts itself --
 * that file is the app's entry point and importing it from a lazily-loaded
 * panel module would pull in its whole side-effecting module graph just to
 * read one constant. craftools.ts re-exports this value under the same
 * name so nothing that already imports `VERSION` from craftools.ts breaks.
 *
 * Deliberately NOT sourced from public/version.json: that file is
 * generated at build time by vite.config.ts's generate-version-plugin as
 * `1.0.<Date.now()>` -- a cache-busting build timestamp, not a meaningful
 * semantic version to show a user. Keep this in sync with package.json's
 * "version" field by hand when bumping releases.
 */
export const VERSION = '0.1.0';
