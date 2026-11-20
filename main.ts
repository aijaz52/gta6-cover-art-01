/* Vice Cover Studio build/export driver. Node 22; no install or network needed. */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { buildDossier as describeEntry } from './vendor/makefun-app.ts';

const project = import.meta.dirname;
const destination = path.resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
const sourceApp = path.join(project, 'app');

async function inventory(directory, prefix = '') {
  const result = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Build inputs cannot contain links: ${relative}`);
    if (entry.isDirectory()) result.push(...await inventory(absolute, relative));
    else if (entry.isFile()) {
      const data = await fs.readFile(absolute);
      result.push({ path: relative, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    } else throw new Error(`Unsupported build input: ${relative}`);
  }
  return result;
}

async function build() {
  if (destination === project || project.startsWith(destination + path.sep) || destination === sourceApp || destination.startsWith(sourceApp + path.sep)) {
    throw new Error('Choose an output directory separate from the project root and app sources.');
  }
  const files = await inventory(sourceApp);
  for (const required of ['index.html', 'style.css', 'src/cover.js', 'src/main.js']) {
    if (!files.some(file => file.path === required)) throw new Error(`Missing app file: ${required}`);
  }
  await fs.mkdir(destination, { recursive: true });
  await fs.cp(sourceApp, path.join(destination, 'app'), { recursive: true });
  await fs.cp(path.join(project, 'screenshots'), path.join(destination, 'screenshots'), { recursive: true });
  await fs.copyFile(path.join(project, 'README.md'), path.join(destination, 'README.md'));
  const manifest = {
    name: 'Vice Cover Studio',
    version: '1.0.0',
    entry: 'app/index.html',
    offline: true,
    export: { type: 'image/png', width: 1200, height: 1500 },
    layouts: ['classic', 'diagonal', 'grid'],
    files
  };
  await fs.writeFile(path.join(destination, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const limits = {
    text_max_bytes: 160 * 1024,
    app_max_files: 993,
    app_max_bytes: 48 * 1024 * 1024,
    app_path_max_bytes: 1000,
    screenshots: { max: 4, max_bytes: 256 * 1024 }
  };
  const dossier = describeEntry(destination, limits);
  await fs.writeFile(path.join(destination, 'dossier.json'), dossier);
  console.log(`Vice Cover Studio built successfully → ${destination}`);
  console.log(`${files.length} app files · ${files.reduce((sum, file) => sum + file.bytes, 0).toLocaleString('en-US')} bytes · 3 layouts · offline PNG export`);
  console.log('Open app/index.html in a browser, or run node serve.ts from the project.');
}

await build().catch(error => {
  console.error(`Vice Cover Studio build failed: ${error.message}`);
  process.exitCode = 1;
});
