# thr4ce

**Image & Stencil Editor**

thr4ce is a standalone, browser-based image editor for preparing tattoo flash artwork and designs for stencil printing.

## Status

**MVP 1 implemented.**

The baseline and implementation Blocks 0–15, 17, and 18 are complete. thr4ce is dependency-free, installable as a PWA, and runs directly in the browser with no build step.

## How it works

Import a photo or flash artwork. Choose a threshold or dithering treatment to make the stencil. Refine it with the brush and export at print size.

## Features

### 1 · Import

- Import PNG, JPG, and WebP artwork through the file picker or drag and drop.
- Reject unsupported, unreadable, or oversized files without changing the active edit.
- Replace the working image at any time; originals are never modified.

### 2 · Make stencil

- Toggle the viewer between PHOTO and STENCIL · 1-BIT without changing settings.
- Adjust brightness, contrast, and the black-and-white threshold.
- Set black and white points to remap midtones, and apply 0–6 px of pre-blur to soften scan grain.
- Choose a threshold automatically with Otsu histogram analysis; analysis includes the active Levels and pre-blur.
- The tone pipeline runs in a fixed order: white base → brightness/contrast → pre-blur → levels → mirror → threshold/dithering.
- Apply Clean Stencil, Newsprint, Halftone, Xerox, Riso, and Decay workflow presets.
- Randomize tonal and dithering settings from a reproducible 16-character seed.
- Convert artwork with Floyd–Steinberg, Jarvis–Judice–Ninke, Bayer, or round-dot halftone dithering.
- Read neutral ink coverage after every rebuilt mask.
- Select a rectangle and add up to eight zones with independent dithering or threshold settings.

### 3 · Refine & export

- Refine the persistent 1-bit mask with Break, Thin, Fatten, Dissolve, and Restore brush modes.
- Replay every stroke deterministically from its recorded seed, radius, strength, and path.
- Remove ink components smaller than four pixels with deterministic despeckling.
- Preview the original beneath the mask with the Ghost overlay.
- Compare against the untouched source while holding Compare.
- Mirror artwork for stencil transfer.
- Zoom from 25–800%, fit to view, and pan with Hand, Space-drag, or touch.
- Pinch to zoom and double-click or double-tap to fit.
- Undo and redo up to 50 edits.
- Define print width and height in millimetres, centimetres, or inches.
- Print at 203 dpi for thermal output, 300 dpi, 600 dpi, or a custom resolution.
- Position artwork against the 58 mm roll-width guide.
- Invert to white ink on black and rotate the export by 90°.
- Export a freshly rendered PNG at the exact physical print size.
- Save and reopen portable `.thr4ce` project files from the header menu.

## Levels & Pre-Blur

Black point and white point remap luminance after brightness/contrast and before thresholding. Raising the black point deepens shadows; lowering the white point brightens highlights and increases separation. The controls stay ordered so the white point is always above the black point.

Pre-blur softens scan grain before Levels, thresholding, and dithering. It also softens fine lines, so use the smallest amount that cleans the scan. Both settings are part of undo history, project files, and export evidence.

## Presets

Presets tune existing controls only and never change mirror orientation.

- **Clean Stencil:** neutral tone, Otsu threshold, clean thresholding, despeckle.
- **Newsprint:** round-dot halftone, dot size 5, intensity 55, brightness 8.
- **Halftone:** round-dot halftone, dot size 8, intensity 50, brightness 12.
- **Xerox:** Bayer grid, dot size 3, intensity 70, brightness 8, contrast 60.
- **Riso:** Jarvis dithering, dot size 2, intensity 65, brightness -4.
- **Decay:** Floyd–Steinberg, dot size 3, intensity 80, brightness -8.

Each preset click is one undo step.

## Seeded Randomize

Randomize creates a new eight-byte cryptographic seed and derives method, dot size, intensity, brightness, contrast, and threshold values from it. The same seed produces the same settings. The seed appears in the status report and the exported `.stencil.json` evidence as `random_seed`.

Randomize never changes mirroring, strokes, treatments, inversion, rotation, or print settings.

## Zones

Select a rectangle on the canvas, then choose **Add zone**. The zone snapshots the current dithering method, threshold, dot size, and intensity. Change the global method afterward to combine treatments, for example global Bayer with a round-dot zone.

Zones override only the dithering treatment, not tone, Levels, pre-blur, or mirroring. Error diffusion runs inside each zone rectangle, so its error cannot spill outside. Bayer and round-dot patterns restart at the zone’s top-left corner. Zone edges can therefore show seams; that is intentional and visible.

Up to eight zones are supported. Use the zone chip’s `×` to remove it. A zone must be at least 8 × 8 pixels. Add and remove actions are each one undo step.

## Project Files (.thr4ce)

**Save project** writes a settings-only `.thr4ce` JSON file containing the source dimensions and SHA-256, every active setting, all strokes and treatments, and the zone list. Images themselves stay with the user. Project version 1 remains compatible: files created before zones load with an empty zone list.

To reopen one, import the matching source image first and choose **Open project**. thr4ce compares the current SHA-256 with the project hash. A match restores every setting and operation deterministically and starts a fresh history; a mismatch is rejected without changing the edit.

## Coverage

The image status includes the current percentage of ink pixels after every mask rebuild, for example `41% ink`. It is a neutral measurement, not a score or warning. Too dense a mask can smear during transfer; too sparse a mask can lose detail.

## Print

Set the physical width and height, choose the output resolution, and export. Pixel dimensions are calculated as `millimetres × dpi / 25.4` and rounded to whole pixels. The artwork is scaled proportionally inside the requested print area so its aspect ratio is preserved.

thr4ce works with Phomemo, AirPrint, any printer — one perfect file.

## Export Evidence

Each export prepares a `<name>.stencil.json` sidecar next to the PNG. It records the source dimensions and SHA-256 hash, all tone, dithering, brush, inversion, despeckle, rotation, and print settings, every stroke seed and segment, and the zone list.

Some browsers block a second automatic download. When that happens, the **Download .stencil.json** control remains available after export and writes the same evidence file.

## Philosophy

thr4ce prepares the trace, not the artwork. 1-bit honesty. Break with intention. Nothing is destroyed. Local, quiet, fast.

## Design Direction

A clean, minimal interface keeps the artwork preview central, with compact controls below it. The visual language is organic, precise, and experimental while remaining consistent with the h4 brand family.

## Brand Identity

The official name is **thr4ce**, always lowercase.

The official icon wordmark is **thr**, set lowercase in Arial/Helvetica Bold on a black tile with white lettering, following the same typographic system as the h4ngelic, h4moshlab, and m4shlab wordmarks. The black tile is icon artwork only; the app theme stays light at `#f5f5f3`. The h4 cursor remains a separate shared brand element and is unchanged.

thr4ce belongs to the same creative family as:

- **h4ngelic** — portfolio
- **h4moshlab** — video and datamoshing
- **thr4ce** — image and stencil editing

thr4ce is an independent application.

## Run Locally

Open `index.html` directly, or serve the repository directory with any static file server.

## Install (PWA)

The project is prepared for GitHub Pages at https://h333ndrik.github.io/thr4ce/. If that URL returns **Site not found**, enable Pages for the repository using [DEPLOY.md](DEPLOY.md), then redeploy.

- **iOS / iPadOS:** Open the site in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** Open the site in Chrome, then choose **Install app**.
- **Desktop:** Use the install icon in the browser address bar.

After an update is pushed, reload the app and close/reopen it once. The service worker activates immediately and claims open clients. PWA installation and offline caching require HTTPS or localhost; GitHub Pages provides HTTPS automatically.

Full deployment steps are in [DEPLOY.md](DEPLOY.md).

## Technology

Plain HTML, CSS, and JavaScript with the Canvas API and Web Crypto. No framework, package manager, or build process.

## Backlog (later)

- Streaks and drip textures.
- Dual-zone processing.
- Loupe inspection.
- Transfer simulation.
- Compare wipe.
- Print queue.
