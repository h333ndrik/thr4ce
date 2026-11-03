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
- Compare against the untouched source for as long as the compare control is held.
- Undo and redo up to 50 edits.
- Export a freshly rendered PNG at the source resolution.

Images larger than 30 MB, unsupported files, and unreadable files are rejected without replacing the current edit.

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
