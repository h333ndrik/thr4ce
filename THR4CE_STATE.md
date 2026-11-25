# thr4ce state

## Last state
- Baseline scaffold: `b77503f` (`baseline scaffold`).
- Block 0 baseline check: `21cfa41` (`block 0: baseline check`).
- Block 1 import robustness: `f9af4af` (`block 1: harden image import`).
- Block 2 zoom and pan: `1c11522` (`block 2: add zoom and pan`).
- Block 3 morphology brush: `6f3b1fb` (`block 3: add morphology brush`).
- Block 4 cleanup tools: `5bc5995` (`block 4: add cleanup tools`).
- Block 5 print and export: `4ee4b3a` (`block 5: add print export`).
- Block 6 export evidence: `16c74db` (`block 6: add export evidence`).
- Block 7 selection and isolate: `cf30126` (`block 7: add selection and isolate`).
- Block 8 deploy and PWA: `7757581` (`block 8: add deploy and PWA support`).
- Block 9 favicon and share polish: `d9637cf` (`block 9: favicon and share polish`).
- Block 10 workflow and texture presets: `490b86b` (`block 10: workflow and texture presets`).
- Block 11 seeded randomize: `e6d6267` (`block 11: randomize with seed`).
- Block 12 project files: `748556b` (`block 12: project files`).
- Block 13 coverage meter: `ff9ccc9` (`block 13: coverage meter`).
- Block 14 final docs and live verification: `8745063` (`block 14: final docs and live verification`).
- Blocks 0–15, 17, and 18 are implemented. The app remains dependency-free and runs without a build step.
- Source hashes, complete settings, and deterministic stroke evidence are included in the JSON export.
- Desktop and 390 px layouts were rendered and inspected.

## Block
- Block 15 staged flow UX: complete. Import, Make stencil, and Refine & export are grouped into three steps with a clickable PHOTO/STENCIL badge and a header project menu. Selection features remain in code but are hidden from the UI for future use.
- Block 17 Levels and pre-blur: complete. Black/white point remapping and 0–6 px pre-blur run before threshold/dithering; Otsu uses the same adjusted base. Slider gestures are one undo step, reset is neutral, and Levels settings persist in projects and evidence.
- Block 18 zone treatments: complete. Rectangle selection returns with the Select tool and a single Add zone action. Up to eight zones snapshot their method, threshold, dot size, and intensity; zone quantization is isolated to its rectangle, participates in undo/redo, projects, and evidence, and reset clears all zones.
- Mini-block UX polish: complete. The empty image-info readout is hidden before import and revealed with live canvas data; Export is disabled at 0 images with the existing 0.4 opacity; the footer wording remains correct.
- Mini-block favicon fallback: complete. A 16+32 px `favicon.ico` generated from the thr wordmark is linked explicitly and precached by service worker `thr4ce-v14`.
- Device-feedback UX pass: complete. Imported images fit fully inside the viewer before the normal 25% minimum applies, the zoom controls have an explicit stacking layer and isolated pointer handlers, the loupe was removed, and rotation moved beside Mirror and Reset.
- Sticky-viewer pass: complete. The full-size viewer stays pinned 8 px from the viewport edge while Tone, Dithering, Brush, and Transform scroll beneath it; it releases with the main containing block. The mini-preview, its canvas copy, render hook, observer, and CSS were removed.
- Export now opens a summary dialog for size, resolution, inversion, and rotation with separate PNG and `.stencil.json` downloads. Preset feedback names the applied treatment, and the Ghost/Despeckle tooltips use the requested wording.
- The h4 cursor now hides on window blur and document mouseleave, uses one rAF-driven `translate3d` update, remains in the dialog top layer while it is open, and preserves the ready class and `cursor:none` rule across dialogs and dynamic elements.
- Blocks 0–18 plus the device-feedback UX pass are complete. The optional Block 16 was not separately present; the loupe from the earlier mini-block was removed after device feedback.
- Layout tabs pass: complete. The three-step stack is replaced by a 36 px tab bar in the 320 px right column (image / dither / print) over the existing `#stage-photo`, `#stage-stencil`, and `#stage-refine` containers, plus a permanent brush dock between the viewer grid and the status bar. Measured at 1440×900 with an image loaded: header 56, tab bar 36, dock 103, viewer 657, status 40, body scrollHeight 900 = clientHeight 900 (page does not scroll). Panel scroll is internal: image 665/665, dither 1278/665 (only scrolling tab), print 665/665. At 390×844 there is no horizontal overflow (scrollWidth 390 = clientWidth 390); the viewer is visible and the sticky dock is reachable. The ≤900 px fallback keeps the old scrolling behaviour and is interim — the drawer or bottom tab bar is a separate block.
- Dot-size pass: complete. Dot size is entered in millimetres (0.10–2.00, step 0.05, default 0.25) and the readout shows the derived print pixels and dpi. `effectiveDotSourcePx()` is the single source of truth: `dotPrintPx = round(dotMm / 25.4 * dpi)`, `dotSourcePx = round(dotPrintPx * sourceWidth / printPxWidth)`, clamped to 1 — dpi cancels because the dot and the print width scale with it. Measured on a 2880 × 1800 source at 100 × 75 mm / 203 dpi: changed-pixel share 0.25 → 0.30 mm = 0.00 %, 0.30 → 0.35 mm = 14.78 %; both under the 35 % threshold, so the dither algorithm and its phase anchoring were left untouched (Step 5 not needed). Export at 0.60 mm: label `5 px @ 203 dpi`, measured lattice period in the 799 × 599 PNG = 5 px. Legacy `.thr4ce` from `87613ea` (dotsize 5, round-dot) reloads with an identical mask SHA-256 (`9f837d04…23ce`) and shows `0.17 mm · 1.4 px`; the pixel size survives until the slider moves. Zones keep legacy `dotsize` and snapshot `dotMm` for new ones; evidence adds `dotMm` and `dot_px`.
- Dot-grid pass: complete. The slider now has one stop per print pixel (min = 25.4/dpi, max = 16 stops, step = 25.4/dpi): 16 stops at 203 dpi, 0.13–2.00 mm, each adjacent stop exactly +1 print pixel (1→16). Presets set their dot in print pixels (newsprint 2, halftone 3, xerox 1, riso 1, decay 1) and randomize draws 1–16 print pixels, so preset output changed by design. Anchoring: 3 print px via the grid (dotMm) and via a legacy dotsize of 11 source px produce the identical mask SHA-256 `e96b502e…ae34ed`. Neighbour change between adjacent stops, round-dot: 24.23 / 25.67 / 27.31 / 28.07 / 27.58 %; bayer: 19.49 / 19.78 / 19.76 / 19.81 / 20.35 %. applyDither on the 2880 × 1800 base: 36.6 ms (1 px), 31.7 ms (3 px), 32.4 ms (6 px). A c0b8610-era project with dotsize 5 reloads with the same mask `9f837d04…23ce`, shows `legacy 0.17 mm · 1.4 px`, and converts to `0.50 mm · 4 px` on the first slider move. `mockups/` was deleted in this pass.
- Service worker cache is `thr4ce-v16`; all 14 precache entries resolve, the old cache is removed, and an offline reload succeeds.
- The dot-size pass bumps the cache to `thr4ce-v18`; the dot-grid pass bumps it to `thr4ce-v19`.
- The layout tabs pass bumps the cache to `thr4ce-v17`; the precache list is unchanged.
- Block 8 verification: `node --check` passed for `app.js`, `cursor.js`, and `sw.js`; manifest and installability errors were empty; the service worker activated and controlled the page; 192, 512, and 180 px icons rendered; Add-to-Home-Screen metadata was present; a full offline reload loaded the app from `thr4ce-v1`.

## In progress
- None.

## Next
- User feedback.
- Enable GitHub Pages using `DEPLOY.md`, then rerun the live PWA check.
