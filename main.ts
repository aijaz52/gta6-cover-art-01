import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const root = fileURLToPath(new URL('./', import.meta.url));

export async function standalone(): Promise<string> {
  const html = readFileSync(resolve(root, 'app/index.html'), 'utf8');
  const css = readFileSync(resolve(root, 'app/style.css'), 'utf8');
  const renderer = readFileSync(resolve(root, 'app/src/cover.js'), 'utf8');
  const editor = readFileSync(resolve(root, 'app/src/main.js'), 'utf8');
  const source = `${renderer.replace(/^export /gm, '')}\n${editor.replace(/^import [^\n]+ from '\.\/cover\.js';\n/, '')}`;
  if (/<\/script/i.test(source) || /<\/style/i.test(css)) throw new Error('Unexpected closing tag in an embedded asset');
  return html
    .replace('<link rel="stylesheet" href="./style.css">', () => `<style>\n${css}</style>`)
    .replace('<script type="module" src="./src/main.js"></script>', () => `<script type="module">\n${source}</script>`);
}

function build(): void {
  const output = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
  mkdirSync(output, { recursive: true });
  cpSync(resolve(root, 'app'), resolve(output, 'app'), { recursive: true });
  cpSync(resolve(root, 'screenshots'), resolve(output, 'screenshots'), { recursive: true });
  writeFileSync(resolve(output, 'dossier.json'), buildDossier(output, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) build();
