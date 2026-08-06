/// <reference types="node" />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  // Serve from the repo root so ./assets, ./vendor and ./craftools paths all resolve
  root: '.',

  // Relative base so the built dist/index.html's injected <script>/<link> tags
  // use "./assets/..." instead of "/assets/...". With the default "/" base,
  // the build only works when dist/ itself is the webserver's document root --
  // serving it from a subfolder (e.g. XAMPP htdocs/craftools/dist/) makes every
  // asset request resolve against the domain root instead and 404.
  base: './',

  resolve: {
    alias: {
      '@tools':      resolve(__dirname, 'craftools/tools'),
      '@utils':      resolve(__dirname, 'craftools/utils'),
      '@settings':   resolve(__dirname, 'craftools/settings'),
      '@components': resolve(__dirname, 'craftools/components'),
    },
    // Vite's default order (['.mjs','.js','.mts','.ts',...]) checks .js BEFORE
    // .ts. During this migration, ~19 files exist as both Foo.ts (new,
    // ToolRegistry-registering) and Foo.js (legacy, kept for createElement /
    // dynamic-import use) side by side. Every bare-specifier import of one of
    // these (e.g. import from '../tools/text/TextTool') was silently resolving
    // to the OLD Foo.js -- which never calls ToolRegistry.register() -- so no
    // tool ever actually registered itself. This reorder makes bare imports
    // prefer .ts, matching what tsc already assumes (moduleResolution:
    // "bundler" prefers .ts over .js for the same reason). Imports that
    // explicitly write ".js" (e.g. the panel-only tools' dynamic imports,
    // which intentionally target the legacy implementation) are untouched --
    // explicit extensions always resolve literally, ignoring this list.
    extensions: ['.mjs', '.mts', '.ts', '.js', '.jsx', '.tsx', '.json'],
  },

  // ── Dependency pre-bundling ───────────────────────────────────────────────
  // Explicitly declaring all npm deps here prevents Vite from discovering
  // them lazily during page load and triggering a full-page re-optimisation
  // (which causes the browser to reload mid-load). All five entries were
  // already being auto-discovered and cached in node_modules/.vite/deps/,
  // so this just makes that deterministic and avoids the first-load penalty
  // on a cold cache or after `vite --force`.
  optimizeDeps: {
    include: [
      'bootstrap/dist/js/bootstrap.bundle.min.js',
      'html2canvas',
      'sortablejs',
      '@tooooools/html-to-svg',
      '@fortawesome/free-solid-svg-icons',
    ],
  },

  // ── Dev server ────────────────────────────────────────────────────────────
  server: {
    // Pre-transforms the critical-path source files before the first browser
    // request. Without warmup Vite transforms each file on-demand as the
    // browser walks the import graph -- for a deep graph like this app's
    // (Editor.ts → CtxBar, PropertyRenderer, HistoryManager, …) that
    // creates a sequential waterfall. Warming these files up front collapses
    // that waterfall into a single paint.
    warmup: {
      clientFiles: [
        './main.ts',
        './craftools.ts',
        './craftools/components/Editor.ts',
        './craftools/components/Setup.ts',
        './craftools/components/Element.ts',
        './craftools/utils/CtxBar.ts',
        './craftools/utils/PropertyRenderer.ts',
        './craftools/utils/ToolRegistry.ts',
        './craftools/utils/HistoryManager.ts',
        './craftools/utils/SessionManager.ts',
        './craftools/utils/AppSettings.ts',
        './craftools/settings/Translations.ts',
      ],
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },

  plugins: [
    {
      name: 'generate-version-plugin',
      generateBundle() {
        const versionData = JSON.stringify({
          version: `1.0.${Date.now()}`,
          buildTime: Date.now(),
        }, null, 2);
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: versionData,
        });
      },
    },
  ],

  // Needed so Vite serves vendor/ and assets/ correctly in dev mode
  publicDir: 'public',
});
