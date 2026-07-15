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
