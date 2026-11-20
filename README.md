# Vice Cover Studio

A self-contained photo-to-cover studio inspired by the sun-soaked, ink-bordered, multi-panel aesthetic of crime-game box art. Add a photo and a caption, choose an arrangement and a color story, and download an opaque PNG. Includes an original illustration of a coastal city, a character, a speedboat and a pink sports car. No branded game assets, external images, fonts, packages or remote services are needed.

## Run locally

Requires Node 22.18 or later. No installation step.

```sh
node serve.ts
```

Open **http://127.0.0.1:4173**. Use `PORT=8080 node serve.ts` to change the port. The server binds to your own computer's loopback interface. Serve over HTTP rather than opening `index.html` with a `file:` URL because the app uses ES modules.

1. Drop a JPG, PNG or WebP onto the photo area, or click to browse. Images up to 20 MB and 64 megapixels are accepted. The demo works immediately without an upload.
2. Write a caption of up to 56 Unicode characters. The canvas uppercases and fits it into up to three lines. A blank caption is supported.
3. Choose **The original** or **Split decision**, one of three palettes, and optional print texture. Uploaded photos are repeated in different crops across all four panels with contrast and color treatment. Zoom and horizontal/vertical controls adjust the crop.
4. Choose 1200 × 1500 or 2400 × 3000 and click **Export cover**. Ctrl/⌘ + Enter also exports. PNGs are rendered at the selected dimensions independently of the screen preview, without the editor, frame or UI watermark.

**Use demo** removes the photo while keeping the caption and styling. **Start fresh** restores the complete initial state. Photos remain in browser memory, are never sent anywhere, and are discarded on reload. Export a cover before closing the tab. Settings are not persisted.

## Offline behavior

The source server and exported app require no internet connection. All code and demo artwork are local. A small service worker caches the app shell after the first visit on localhost (or HTTPS); allow installation to finish before expecting a server-free offline reload. Browser cache eviction or clearing site data removes this cache. User photos are never cached. If service workers are unavailable, the editor still works with the local server running. No analytics, remote fonts, AI endpoint, account or external API is used.

The effect is a deterministic collage, crop and color treatment; it does not use generative AI or turn a photograph into a hand-drawn illustration. The built-in demo artwork is drawn from original vector primitives.

## Build and sample PNG export

```sh
mkdir -p /tmp/gcout
MAKEFUN_OUTPUT_DIR=/tmp/gcout node main.ts
```

With no environment variable the build goes to `dist/`. The build driver exits after producing a complete static app, a SHA-256 asset manifest, a 1000 × 1250 `sample-cover.png`, and a copy of the local server. It has no network or package dependency. The sample uses a small original software rasterizer and bitmap letterforms; browser exports use native canvas text and anti-aliasing.

To serve the built folder:

```sh
node /tmp/gcout/serve.ts
```

Alternatively use `STUDIO_ROOT=/tmp/gcout node serve.ts`. You can deploy the exported folder to any static host, including at a subdirectory. The service worker uses relative asset URLs.

## Verify

```sh
node --test app/tests/studio.test.mjs
```

Tests cover Unicode captions, option validation, exact panel area, crop coverage and aspect ratio, safe export filenames, line wrapping, all six layout/palette combinations, deterministic rendering, PNG encoding, blank/long captions, accessible controls and local assets. The suite uses only Node's standard library and executes real renders. A browser smoke check should additionally exercise upload, crop, layout changes, PNG download, mobile layout and an offline reload.

An optional automated browser check is available with `node tools/browser-check.mjs` when Playwright and its Chromium browser are already installed. It verifies the real editor, a 2400 × 3000 downloaded PNG, invalid image recovery, mobile fit, service-worker offline reload and the absence of remote requests. Screenshots go to `/tmp/opencode` by default; use `STUDIO_SHOTS` to select an existing output directory. This verification tool is not part of the shipped app or its runtime requirements.

## Source map

- `main.ts` — portable build and sample PNG driver.
- `serve.ts` — loopback static server for source and exported apps.
- `app/index.html`, `app/style.css` — responsive, accessible editor shell.
- `app/src/main.js` — browser state, uploads, controls and PNG downloads.
- `app/src/cover.js` — pure layout/caption/crop utilities and shared canvas renderer.
- `app/sw.js` — local app-shell cache.
- `tools/authored-raster.mjs` — original Node software canvas and PNG encoder.
- `app/tests/studio.test.mjs` — dependency-free Node tests.

Designed for current Chrome, Edge, Firefox and Safari with canvas, ES modules, `HTMLImageElement.decode`, `dialog` and CSS `:has()` support. Font selection varies by platform because all typography uses installed system fonts. The Node sample intentionally uses its own bitmap font for portability. This is an independent fan-made aesthetic study, unaffiliated with Rockstar Games or Grand Theft Auto.
