import { createServer } from 'vite';

const server = await createServer({
  configFile: '/sessions/sleepy-quirky-newton/mnt/craftools/vite.config.ts',
  root: '/sessions/sleepy-quirky-newton/mnt/craftools',
  cacheDir: '/tmp/vite-cache2',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
});

const editorTs = '/sessions/sleepy-quirky-newton/mnt/craftools/craftools/components/Editor.ts';
const craftoolsTs = '/sessions/sleepy-quirky-newton/mnt/craftools/craftools.ts';

const tests = [
  ['../tools/text/TextTool (bare, from Editor.ts)', '../tools/text/TextTool', editorTs],
  ['../tools/image/ImageTool (bare, from Editor.ts)', '../tools/image/ImageTool', editorTs],
  ['../tools/BaseTool (bare, if imported)', '../BaseTool', '/sessions/sleepy-quirky-newton/mnt/craftools/craftools/tools/text/TextTool.ts'],
  ['./craftools/components/Editor.js (explicit .js, from craftools.ts)', './craftools/components/Editor.js', craftoolsTs],
  ['agenda .js dynamic import (explicit .js, intentional)', '../tools/agenda/AgendaExportTool.js', editorTs],
  ['album .js dynamic import (explicit .js, intentional)', '../tools/album/AlbumTool.js', editorTs],
];

for (const [label, spec, importer] of tests) {
  const r = await server.pluginContainer.resolveId(spec, importer);
  console.log(label, '=>', r && r.id);
}

await server.close();
