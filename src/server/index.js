import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadProject, saveProject } from './project.js';
import { POSTPROD_DIR } from './prep/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(__dirname, '..', '..', 'web', 'dist');

export async function startServer({ folder, data }) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/project', async (_req, res) => {
    const fresh = await loadProject(folder);
    res.json(fresh ?? data);
  });

  app.put('/api/project', async (req, res) => {
    await saveProject(folder, req.body);
    res.json({ ok: true });
  });

  app.use('/master', express.static(folder, {
    setHeaders: (res) => res.setHeader('Accept-Ranges', 'bytes'),
  }));
  app.use('/postprod', express.static(join(folder, POSTPROD_DIR)));

  app.use(express.static(WEB_DIR));

  const server = createServer(app);

  const desiredPort = process.env.CONCERTSPLIT_PORT
    ? parseInt(process.env.CONCERTSPLIT_PORT, 10)
    : 0;
  const port = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(desiredPort, '127.0.0.1', () => {
      const addr = server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : null);
    });
  });

  return { server, url: `http://localhost:${port}` };
}
