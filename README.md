# Vice Cover Studio

An offline photo-to-cover editor inspired by the bold panels, pastel sunsets, and ink borders of crime-game cover art. Load a photo, add a title, compose your poster, and download a clean **1200 × 1500 PNG**. No accounts, API keys, dependencies, uploads, or remote fonts.

## Run the studio

Use Node **22.18 or newer** (native TypeScript support):

```sh
node serve.ts
```

Open **http://127.0.0.1:8080**. Choose another port with `node serve.ts --port 8090` or `PORT=8090 node serve.ts`.

You can also open `app/index.html` directly in a current desktop browser, including while disconnected. The app uses classic scripts so no module server, service worker installation, or internet connection is required. In direct-file mode, start with the procedural illustration or upload your own photo; bundled sample buttons are disabled because browsers restrict reading neighboring image files into an exportable canvas. Run the local server to use the included samples. The served page blocks network connections through its content security policy.

## Make a cover

1. Select a photo or drop it on the upload area. JPG, PNG, WEBP, and other browser-decodable raster formats work. The limit is 25 MB and 65 megapixels; SVG is intentionally excluded. Two sample photos from the starter kit are included.
2. Type a title of up to 48 characters. The title automatically fits onto one or two lines. An optional 60-character tagline appears along the bottom.
3. Choose **The classic** (7 panels), **Split second** (5 angled panels), or **Six stories** (6 panels). Choose Vice sunset, Neon nights, or Golden hour.
4. Adjust the photo zoom and horizontal/vertical focus, color intensity, and deterministic film grain. Each panel uses a different crop of the same photo. Reset all restores the initial settings and Boulevard sample.
5. Press **Export cover**. Your browser downloads `vice-cover-your-title.png`. Export redraws the artwork on its own full-resolution canvas, with no editor frame, watermark, or screenshot artifacts.

The preview updates locally. Image files become temporary object URLs that are released after decoding; photos and captions are never transmitted or saved to browser storage. Reloading starts fresh. Images are resized to a maximum 2200-pixel edge for processing, then posterized with original contour-ink processing before panel composition. This is a deterministic canvas treatment, not a generative AI service. If a sample cannot be opened, an original procedural skyline and palm illustration keeps the editor usable.

## Build the bounty entry

```sh
mkdir -p /tmp/gcout
MAKEFUN_OUTPUT_DIR=/tmp/gcout node main.ts
```

Without `MAKEFUN_OUTPUT_DIR`, the destination is `/output`. The driver validates required app files, rejects symlink inputs, packages the app and screenshots, and writes a deterministic SHA-256 `build-manifest.json`, this README, and the canonical `dossier.json` using the starter's existing make.fun packaging library. It prints the destination and bundle size and exits zero on success. No browser, package manager, or network is needed to build. The destination must be separate from the source app and cannot be the project root or an ancestor of it.

Open the exported `app/index.html` to use the packaged version. Screenshot evidence lives in `screenshots/`; those files are not used by the editor.

## Tests

```sh
node --test app/tests/studio.test.mjs
```

The dependency-free Node tests check crop geometry, zoom and focus bounds, full panel coverage, text fitting, safe filenames, immutable defaults, all nine layout/color combinations, the no-photo fallback, balanced canvas state, local-only script references, and the real HTTP server's assets, HEAD responses, and path handling.

`tools/browser-check.mjs` provides an additional development smoke test when Playwright and its Chromium browser are already installed. It exercises the real canvas, upload, layouts, PNG encoding, direct-file operation, and mobile layout, and regenerates three screenshots. It is not required to run or build the app and never downloads dependencies.

## Source map

- `main.ts` — Node 22 build and export driver.
- `serve.ts` — loopback static server, with `createStudioServer()` exported for tests.
- `app/index.html`, `app/style.css` — accessible responsive editor.
- `app/src/cover.js` — self-contained original canvas compositor and pure geometry/text helpers.
- `app/src/main.js` — local image handling, controls, preview scheduling, and PNG download.
- `app/tests/studio.test.mjs` — built-in Node test suite.
- `vendor/makefun-app.ts` — pre-existing starter packaging library; not part of the browser app.

All application implementation and tests were authored for this entry. The original starter sample photographs and packaging library are retained. Independent fan-made tool; no affiliation with Rockstar Games or Grand Theft Auto. Use photos you have permission to edit and share.
