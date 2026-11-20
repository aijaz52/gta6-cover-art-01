/** Node 22 build/export driver. No install, browser, or network required. */
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { renderCover, DEFAULTS } from './app/src/cover.js';
import { RasterCanvas } from './tools/authored-raster.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR || resolve(root, 'dist'));
const assets = ['index.html', 'style.css', 'icon.svg', 'sw.js', 'src/main.js', 'src/cover.js'];

async function build() {
  // Fail before overwriting source if an output directory is misconfigured.
  const fromApp = relative(resolve(root, 'app'), output);
  if (output === root || !(fromApp === '..' || fromApp.startsWith(`..${sep}`))) {
    throw new Error('Choose an output directory outside the app source directory and repository root.');
  }
  await mkdir(output, { recursive: true });
  const manifest = [];
  for (const asset of assets) {
    const destination = resolve(output, asset);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(root, 'app', asset), destination);
    const bytes = await readFile(destination);
    manifest.push({ file: asset, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const preview = new RasterCanvas(1000, 1250);
  renderCover(preview, DEFAULTS);
  const png = preview.toPNG();
  await writeFile(resolve(output, 'sample-cover.png'), png);
  await writeFile(resolve(output, 'build-manifest.json'), JSON.stringify({ name: 'Vice Cover Studio', offline: true, entry: 'index.html', sample: 'sample-cover.png', assets: manifest }, null, 2) + '\n');
  await copyFile(resolve(root, 'serve.ts'), resolve(output, 'serve.ts'));
  await writeFile(resolve(output, 'package.json'), JSON.stringify({ private: true, type: 'module' }, null, 2) + '\n');
  await writeFile(resolve(output, 'START-HERE.txt'), 'VICE COVER STUDIO\n\nRun: node serve.ts\nOpen: http://127.0.0.1:4173\n\nThis folder is a complete, dependency-free offline web app.\nUse a local HTTP server for ES modules and offline caching.\nThe sample-cover.png was rendered by the Node build driver.\nBrowser exports use full native canvas typography.\n');
  console.log(`Vice Cover Studio built successfully.\nOutput: ${output}\nWeb app: ${resolve(output, 'index.html')}\nSample PNG: ${resolve(output, 'sample-cover.png')} (${png.length.toLocaleString('en-US')} bytes)\nServe: node ${resolve(output, 'serve.ts')}\nNo packages or network access required.`);
}

build().catch(error => { console.error(`Build failed: ${error.message}`); process.exitCode = 1; });
