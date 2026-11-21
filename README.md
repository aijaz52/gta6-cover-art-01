[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/aijaz52/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/aijaz52/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Built for the [make.fun gta6-cover-art-01 bounty](https://make.fun/bounty/gta6-cover-art-01).

<!-- SPDX-License-Identifier: MIT -->
# Vice Cover Studio

Turn a photo and caption into a five-panel cover inspired by the sunset palettes, heavy outlines, and angled frames of GTA VI-style box art. The editor starts with an original, locally drawn coastal scene so you can try every control before adding a photo.

## Open the editor

Requires Node.js 22.18+ to build or serve. No install step.

```sh
mkdir -p /tmp/gcout && MAKEFUN_OUTPUT_DIR=/tmp/gcout node main.ts
```

Open `/tmp/gcout/index.html` in your browser. The build is a single self-contained HTML file that works from disk without an internet connection. `node main.ts` writes to `dist/` by default.

To use a local URL instead, run `node serve.ts` and open `http://127.0.0.1:4173`. Set `PORT` to use a different port. The local server assembles the same standalone page on each request.

## Make a cover

1. Choose a photo or drop it onto the photo field. JPEG, PNG, WebP, AVIF, GIF and BMP are accepted when supported by the browser. Files are limited to 25 MB and 48 megapixels. Use **Crop zoom** to tighten all five crops.
2. Enter a caption, or leave it blank for an image-only cover. The canvas renders the caption in uppercase and fits it to the cover.
3. Pick **Skyline**, **Crossfire**, or **Strip**, then choose a **Sunset**, **Lagoon**, or **Night** color grade.
4. Pick a PNG size and click **Download PNG**. The browser re-renders the cover at 960 × 1200, 1920 × 2400, or 2880 × 3600 pixels. Editor controls are outside the exported image.

**Use demo** clears the photo and keeps your other settings. The reset icon restores the initial cover. Photos and edits stay in the current tab; nothing is uploaded or persisted, so download your cover before closing the tab.

## Verify

```sh
node --test app/tests/studio.test.mjs
```

The tests exercise the crop geometry, panel layouts, caption fitting inputs, filenames, and the standalone build. For an end-to-end check, `node tools/browser-check.mjs /tmp/gcout/index.html` uses an already-installed Playwright and Chromium to test offline photo import, layout changes, and a PNG download.

Independent fan project, unaffiliated with Rockstar Games.
