/** A local-only static server for both the source tree and exported builds. */
import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { dirname, resolve, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
let root = here;
try { await stat(resolve(here, 'index.html')); }
catch { root = resolve(here, 'app'); }
if (process.env.STUDIO_ROOT) root = resolve(process.env.STUDIO_ROOT);
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer between 0 and 65535.');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const server = createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method || '')) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    if (pathname.includes('\0') || pathname.includes('\\')) { res.writeHead(400); res.end('Bad path'); return; }
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const rel = relative(root, path);
    if (rel.startsWith(`..${sep}`) || rel === '..' || rel.split(sep).some(part => part.startsWith('.'))) { res.writeHead(403); res.end('Forbidden'); return; }
    if (!(await stat(path)).isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const bytes = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Content-Length': bytes.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch (error) { res.writeHead(error instanceof URIError ? 400 : 404); res.end(error instanceof URIError ? 'Bad path' : 'Not found'); }
});
server.on('error', error => { console.error(`Could not start Vice Cover Studio: ${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => { const address = server.address(); console.log(`Vice Cover Studio → http://127.0.0.1:${typeof address === 'object' ? address.port : port}\nServing ${root}\nPress Ctrl+C to stop.`); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
