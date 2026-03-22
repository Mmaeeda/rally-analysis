import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function resolvePath(urlPath) {
  if (urlPath === '/') return path.join(root, 'app', 'index.html');
  return path.join(root, urlPath.replace(/^\//, ''));
}

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const filePath = resolvePath(pathname);
    const normalized = path.normalize(filePath);
    if (!normalized.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const data = await fs.readFile(normalized);
    const ext = path.extname(normalized);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`rally-analysis app running at http://localhost:${port}`);
});
