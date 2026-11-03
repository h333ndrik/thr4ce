# thr4ce

**Image & Stencil Editor**

thr4ce is a standalone, browser-based image editor for preparing tattoo flash artwork and designs for stencil printing.

## Status

**MVP 1 implemented.**

The editor is dependency-free and runs directly in the browser. No build step is required.

## Features

- Import PNG, JPG, and WebP images by file picker or drag and drop.
- Adjust brightness, contrast, and black-and-white threshold.
- Convert artwork with Floyd–Steinberg, Jarvis–Judice–Ninke, Bayer, or round-dot halftone dithering.
- Mirror artwork for stencil transfer.
- Refine the binary mask with Break, Thin, Fatten, Dissolve, and Restore brush modes.
- Replay brush strokes deterministically from a recorded seed and path.
- Set the threshold from the tonal histogram with Otsu analysis.
- Remove isolated ink components smaller than four pixels with one deterministic despeckle step.
- Define print width and height in millimetres, centimetres, or inches.
- Print at 203 dpi for thermal/Phomemo output, 300 dpi, 600 dpi, or a custom resolution.
- Preview the 58 mm roll-width guide against the artwork.
- Invert to white ink on black and rotate the export by 90°.
- Export a freshly rendered PNG at the exact calculated print pixel dimensions.
- Zoom from 25–800%, fit to view, and pan with the Hand tool or Space-drag.
- Pinch to zoom and double-click or double-tap to fit.
- Compare against the untouched source for as long as the compare control is held.
- Undo and redo up to 50 edits.
- Export a freshly rendered PNG at the source resolution.

Images larger than 30 MB, unsupported files, and unreadable files are rejected without replacing the current edit.

## Print

Set the physical width and height, choose the output resolution, and export a PNG whose pixel dimensions are derived from that physical size. The artwork is fitted proportionally inside the requested print area so its aspect ratio is preserved. The 58 mm roll guide helps position work for Phomemo-style thermal printers.

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

## Technology

Plain HTML, CSS, and JavaScript with the Canvas API. No framework, package manager, or build process.
