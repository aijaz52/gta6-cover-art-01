/* A loopback-only, dependency-free static host for the offline studio. */
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const appDirectory = path.join(import.meta.dirname, 'app');
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'], ['.png', 'image/png'], ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'], ['.ico', 'image/x-icon']
]);

export function createStudioServer(root = appDirectory) {
  const base = path.resolve(root);
  return http.createServer(async (request, response) => {
    const fail = (code, message) => { response.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });response.end(message); };
    if (!['GET', 'HEAD'].includes(request.method || '')) {
      response.setHeader('Allow', 'GET, HEAD');fail(405, 'Read-only static server');return;
    }
    let decoded;
    try { decoded = decodeURIComponent((request.url || '/').split('?')[0]); }
    catch { fail(400, 'Malformed URL');return; }
    if (decoded.includes('\0') || decoded.includes('\\')) { fail(400, 'Invalid path');return; }
    const requested = path.resolve(base, `.${decoded.endsWith('/') ? decoded + 'index.html' : decoded}`);
    if (!requested.startsWith(base + path.sep)) { fail(403, 'Path outside app');return; }
    try {
      const actual = await fs.realpath(requested);
      const actualBase = await fs.realpath(base);
      if (!actual.startsWith(actualBase + path.sep)) { fail(403, 'Path outside app');return; }
      const info = await fs.stat(actual);
      if (!info.isFile()) { fail(404, 'File not found');return; }
      const data = await fs.readFile(actual);
      response.writeHead(200, {
        'Content-Type': contentTypes.get(path.extname(actual).toLowerCase()) || 'application/octet-stream',
        'Content-Length': data.length,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
      });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      fail(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500, 'Unable to open this file');
    }
  });
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntrypoint) {
  const args = process.argv.slice(2);
  const index = args.indexOf('--port');
  const port = Number(index >= 0 ? args[index + 1] : process.env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('Choose a port from 1 to 65535: node serve.ts --port 8080');
    process.exitCode = 1;
  } else {
    const server = createStudioServer();
    server.on('error', error => { console.error(`Studio server: ${error.message}`);process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`Vice Cover Studio is ready at http://127.0.0.1:${port} · Ctrl+C to stop`));
    for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close());
  }
}
