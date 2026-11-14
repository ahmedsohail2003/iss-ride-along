// Load the page's own TypeScript modules into a Node script (so scripts run the same code as the
// page, never a second copy). Uses Vite's server-side module loader; no browser, no port opened.
import { createServer } from 'vite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Load `paths` (from the app root, e.g. '/src/agent/loop.ts'); returns the modules and a close(). */
export async function loadTs(paths) {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const mods = [];
  for (const p of paths) mods.push(await server.ssrLoadModule(p));
  return { mods, close: () => server.close() };
}
