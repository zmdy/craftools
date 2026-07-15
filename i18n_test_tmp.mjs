import { createServer } from 'vite';

globalThis.window = { craftoolsLang: 'pt-br' };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

const server = await createServer({
  configFile: '/sessions/sleepy-quirky-newton/mnt/craftools/vite.config.ts',
  root: '/sessions/sleepy-quirky-newton/mnt/craftools',
  cacheDir: '/tmp/vite-cache3',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
});

const { tr } = await server.ssrLoadModule('/craftools/utils/i18nLabel.ts');

console.log('tr("common.border", "Border") =>', tr('common.border', 'Border'));
console.log('tr("common.zindex", "Layer") =>', tr('common.zindex', 'Layer'));
console.log('tr("common.opacity", "Opacity") [missing key] =>', tr('common.opacity', 'Opacity'));
console.log('tr(undefined, "Fallback") =>', tr(undefined, 'Fallback'));

await server.close();
