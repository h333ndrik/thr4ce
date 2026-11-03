# thr4ce

**Image & Stencil Editor**

thr4ce is a standalone, browser-based image editor for preparing tattoo flash artwork and designs for stencil printing.

## Status

**MVP 1 implemented.**

The baseline and implementation Blocks 0–8 are complete. thr4ce is dependency-free and runs directly in the browser with no build step.

## Features

- Import PNG, JPG, and WebP artwork with a file picker or drag and drop.
- Reject unsupported, unreadable, or oversized files without changing the active edit.
- Adjust brightness, contrast, and the black-and-white threshold.
- Choose a threshold automatically with Otsu histogram analysis.
- Convert artwork with Floyd–Steinberg, Jarvis–Judice–Ninke, Bayer, or round-dot halftone dithering.
- Refine the persistent 1-bit mask with Break, Thin, Fatten, Dissolve, and Restore brush modes.
- Replay every stroke deterministically from its recorded seed, radius, strength, and path.
- Remove ink components smaller than four pixels with deterministic despeckling.
- Preview the original beneath the mask with the Ghost overlay.
- Compare against the untouched source while holding Compare.
- Mirror artwork for stencil transfer.
- Zoom from 25–800%, fit to view, and pan with Hand, Space-drag, or touch.
- Mark rectangular regions with Select using mouse, pen, or touch.
- Isolate a selection, erase its interior, or crop the displayed artwork to that region.
- Pinch to zoom and double-click or double-tap to fit.
- Undo and redo up to 50 edits.
- Define print width and height in millimetres, centimetres, or inches.
- Print at 203 dpi for thermal output, 300 dpi, 600 dpi, or a custom resolution.
- Position artwork against the 58 mm roll-width guide.
- Invert to white ink on black and rotate the export by 90°.
- Export a freshly rendered PNG at the exact physical print size.

## Print

Set the physical width and height, choose the output resolution, and export. Pixel dimensions are calculated as `millimetres × dpi / 25.4` and rounded to whole pixels. The artwork is scaled proportionally inside the requested print area so its aspect ratio is preserved.

thr4ce works with Phomemo, AirPrint, any printer — one perfect file.

## Selection & Isolate

Choose **Select**, then drag a rectangle over the artwork. The live selection size appears in the status line.

- **Isolate** turns everything outside the rectangle into paper white. It is stored in the replayable operation list as an `isolate` treatment with a deterministic seed.
- **Erase inside** turns the selected interior into paper white and is stored as an `erase` treatment.
- **Crop** bakes the visible crop into a new working image, clears strokes and history, and fits the new canvas. The imported file is never modified.
- Press Escape, click outside the selection, or switch tools to dismiss it.

Isolate and Erase are each one undo step. Export always uses the current mask, so an isolated export contains no artwork outside the selected region.

## Export Evidence

Each export prepares a `<name>.stencil.json` sidecar next to the PNG. It records the source dimensions and SHA-256 hash, all tone, dithering, brush, inversion, despeckle, rotation, and print settings, plus every stroke seed and segment.

Some browsers block a second automatic download. When that happens, the **Download .stencil.json** control remains available after export and writes the same evidence file.

## Philosophy

thr4ce prepares the trace, not the artwork. 1-bit honesty. Break with intention. Nothing is destroyed. Local, quiet, fast.

## Design Direction

A clean, minimal interface keeps the artwork preview central, with compact controls below it. The visual language is organic, precise, and experimental while remaining consistent with the h4 brand family.

## Brand Identity

The official name is **thr4ce**, always lowercase.

thr4ce belongs to the same creative family as:

- **h4ngelic** — portfolio
- **h4moshlab** — video and datamoshing
- **thr4ce** — image and stencil editing

thr4ce is an independent application.

## Run Locally

Open `index.html` directly, or serve the repository directory with any static file server.

## Install (PWA)

GitHub Pages deploys thr4ce at https://h333ndrik.github.io/thr4ce/.

- **iOS / iPadOS:** Open the site in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** Open the site in Chrome, then choose **Install app**.
- **Desktop:** Use the install icon in the browser address bar.

After an update is pushed, reload the app and close/reopen it once. The service worker activates immediately and claims open clients. PWA installation and offline caching require HTTPS or localhost; GitHub Pages provides HTTPS automatically.

Full deployment steps are in [DEPLOY.md](DEPLOY.md).

## Technology

Plain HTML, CSS, and JavaScript with the Canvas API and Web Crypto. No framework, package manager, or build process.

## Next Steps

- Presets for recurring flash and stencil workflows.
- Randomize with a seed for repeatable texture variations.
- `.thr4ce` project files containing source, settings, and strokes.
