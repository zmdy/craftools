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

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },

  // Needed so Vite serves vendor/ and assets/ correctly in dev mode
  publicDir: false,
});
