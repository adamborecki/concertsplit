import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadProject, saveProject } from './project.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(__dirname, '..', 'web');

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

  app.use(express.static(WEB_DIR));

  const server = createServer(app);

  const port = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : null);
    });
  });

  return { server, url: `http://localhost:${port}` };
}
