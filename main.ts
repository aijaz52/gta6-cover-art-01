import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const app = new URL('./app/', import.meta.url);

export async function standalone() {
  const [html, css, renderer, editor] = await Promise.all(
    ['index.html', 'style.css', 'src/cover.js', 'src/main.js'].map(name => readFile(new URL(name, app), 'utf8')),
  );
  // The browser entry has a single relative import; its exports are inlined above it.
  const source = `${renderer.replace(/^export /gm, '')}\n${editor.replace(/^import [^\n]+ from '\.\/cover\.js';\n/, '')}`;
  if (/<\/script/i.test(source) || /<\/style/i.test(css)) throw new Error('Unexpected closing tag in an embedded asset');
  return html
    .replace('<link rel="stylesheet" href="./style.css">', () => `<style>\n${css}</style>`)
    .replace('<script type="module" src="./src/main.js"></script>', () => `<script type="module">\n${source}</script>`);
}

async function build() {
  const output = resolve(process.env.MAKEFUN_OUTPUT_DIR || fileURLToPath(new URL('./dist/', import.meta.url)));
  await mkdir(output, {recursive:true});
  const destination = await realpath(output);
  if (destination === await realpath(fileURLToPath(app))) throw new Error('Choose an output directory outside the app source folder');
  const path = resolve(destination, 'index.html');
  const html = await standalone();
  await writeFile(path, html);
  console.log(`Vice Cover Studio: ${path} (${Buffer.byteLength(html)} bytes)`);
}

if (process.argv[1] && pathToFileURL(await realpath(process.argv[1])).href === import.meta.url) await build();
