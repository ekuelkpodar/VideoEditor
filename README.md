# VideoEditor: Local Motion Lab

Local Motion Lab is a local-first, Ezgif-style browser app for image, frame, and lightweight video editing workflows. Files stay inside the browser tab, and the current implementation uses Canvas, MediaRecorder, and native browser file APIs rather than a server-side processing pipeline.

The app is designed as a practical client-side foundation: browser-native tools work today, while codec-heavy workflows have explicit adapter points for `ffmpeg.wasm`, `gifsicle-wasm`, and jSquash packages.

## Features

- Drag/drop and file-picker import for images and videos.
- Multi-image animation frame model with preview, playback, frame strip, delays, reverse, ping-pong, shuffle, and trim.
- Canvas transforms: resize, crop, rotate, and flip.
- Canvas effects: grayscale, sepia, invert, brightness/contrast, halftone, pixelate, and color-key background removal.
- Text overlays and static watermark/overlay images across frame ranges.
- Static image to animation generation with zoom, scroll, and rotate presets.
- Frame extraction UI, current-frame PNG export, sprite-sheet generation, and sprite-sheet cutting.
- Browser-native video sampling into editable frames.
- Browser-native still export to PNG/JPEG/WebP and animation export to WebM.

## Run

This project has no required runtime dependencies beyond a modern browser and Python 3 for the local static server.

```sh
npm run dev
```

Then open `http://127.0.0.1:5174`.

You can also open `index.html` directly, but a local server is more reliable for ES modules and media APIs.

## Project Structure

```text
.
|-- index.html
|-- styles.css
|-- package.json
`-- src
    |-- app.js
    |-- canvas-utils.js
    `-- codecs.js
```

## Development

Validate JavaScript syntax:

```sh
npm run validate
```

## WASM Adapter Points

The browser cannot natively encode real GIFs or transcode arbitrary video without codec libraries. The project keeps those integrations explicit in `src/codecs.js`:

- `exportGifWithAdapter`: wire to `gif.js` or `gifsicle-wasm`.
- `runFfmpegAdapter`: wire to `@ffmpeg/ffmpeg` for video-to-GIF, GIF-to-video, crop/cut/rotate/compress.
- `runGifsicleAdapter`: wire to `@movable/gifsicle-wasm` for GIF split/optimize/merge.
- `runModernImageCodecAdapter`: wire to jSquash packages for WebP/AVIF/JXL/APNG quality-controlled encode/decode.

This avoids pretending the repo can use large WASM packages that are not installed yet, while keeping the codebase ready for them.

## Roadmap

- Add `gif.js` or `gifsicle-wasm` for real GIF export.
- Add `@ffmpeg/ffmpeg` for video-to-GIF, GIF-to-video, video crop/cut/rotate, and video compression.
- Add jSquash codecs for AVIF, WebP, JPEG XL, and advanced PNG workflows.
- Move heavy frame operations into Web Workers for large files.
- Add automated browser smoke tests for import, transform, export, and adapter fallback states.
