import { createServer } from 'vite';

const server = await createServer({
  configFile: '/sessions/sleepy-quirky-newton/mnt/craftools/vite.config.ts',
  root: '/sessions/sleepy-quirky-newton/mnt/craftools',
  server: { middlewareMode: true },
});

const r1 = await server.pluginContainer.resolveId('../tools/text/TextTool', '/sessions/sleepy-quirky-newton/mnt/craftools/craftools/components/Editor.ts');
console.log('bare "../tools/text/TextTool" from Editor.ts resolves to:', r1 && r1.id);

const r2 = await server.pluginContainer.resolveId('./craftools/components/Editor.js', '/sessions/sleepy-quirky-newton/mnt/craftools/craftools.ts');
console.log('".js"-suffixed "./craftools/components/Editor.js" from craftools.ts resolves to:', r2 && r2.id);

const r3 = await server.pluginContainer.resolveId('./craftools/components/Editor.ts', '/sessions/sleepy-quirky-newton/mnt/craftools/craftools.ts');
console.log('explicit ".ts" "./craftools/components/Editor.ts" from craftools.ts resolves to:', r3 && r3.id);

await server.close();
