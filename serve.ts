import { createServer } from 'node:http';
import { standalone } from './main.ts';

const port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer between 0 and 65535');

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) {
    response.writeHead(405, {Allow:'GET, HEAD'}).end();
    return;
  }
  const path = request.url?.split('?', 1)[0];
  if (path !== '/' && path !== '/index.html') {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const page = await standalone();
    response.writeHead(200, {
      'Content-Type':'text/html; charset=utf-8',
      'Content-Length':Buffer.byteLength(page),
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff',
    }).end(request.method === 'HEAD' ? undefined : page);
  } catch (error) {
    console.error(error);
    response.writeHead(500).end('Could not assemble the studio');
  }
});

server.listen(port,'127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address === 'object') console.log(`Vice Cover Studio: http://127.0.0.1:${address.port}`);
});
