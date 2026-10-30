import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import { getRequestListener } from '@hono/node-server';
import { prefetchAiCore } from 'financial-mock-agent/prefetch';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT ?? 3142);
const isDev = process.env.NODE_ENV !== 'production';
if (!process.env.JAVA_AGENT_URL) {
  prefetchAiCore();
}

if (isDev) {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  // Watch sibling workspace packages so edits in agent or mock-server trigger SSR reloads
  const agentSrc = path.resolve(import.meta.dirname, '../../agent/src');
  const mockServerSrc = path.resolve(
    import.meta.dirname,
    '../../../mock-server/src',
  );
  vite.watcher.add([agentSrc, mockServerSrc]);

  // Trigger a full browser reload when backend agent or mock-server code changes,
  // keeping the UI chat history in sync with fresh in-memory agent checkpoints.
  const triggerBrowserReload = (file: string) => {
    const normalized = file.replaceAll('\\', '/');
    if (
      normalized.includes('/agent/src/') ||
      normalized.includes('/mock-server/src/') ||
      normalized.includes('/webui/src/app.ts')
    ) {
      vite.ws.send({ type: 'full-reload' });
    }
  };

  vite.watcher.on('change', triggerBrowserReload);
  vite.watcher.on('add', triggerBrowserReload);
  vite.watcher.on('unlink', triggerBrowserReload);

  let cachedApp: unknown = null;
  let cachedListener: ReturnType<typeof getRequestListener> | null = null;

  async function getListener() {
    const mod = (await vite.ssrLoadModule('/src/app.ts')) as {
      default: { fetch: Parameters<typeof getRequestListener>[0] };
    };
    if (mod !== cachedApp || !cachedListener) {
      cachedApp = mod;
      cachedListener = getRequestListener(mod.default.fetch);
    }
    return cachedListener;
  }

  const server = createHttpServer(async (req, res) => {
    const url = req.url ?? '/';
    // Route API and OData paths to Hono, everything else to Vite
    if (url.startsWith('/api/') || url.startsWith('/sap/')) {
      try {
        const listener = await getListener();
        listener(req, res);
      } catch (err) {
        console.error('[Hono SSR Error]', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error:
              err instanceof Error
                ? err.message
                : 'Could not load the agent. Check the server terminal for details.',
          }),
        );
      }
    } else {
      vite.middlewares(req, res);
    }
  });

  server.listen(PORT, () => {
    console.log(`Dev server on http://localhost:${PORT}`);
  });
} else {
  const { default: app } = await import('./app.ts');
  const { serve } = await import('@hono/node-server');
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`Server listening on http://localhost:${info.port}`);
  });
}
