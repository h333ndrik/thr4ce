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
- Mini-block loupe: complete. A toggleable 4× loupe samples a 40×40 px area from the currently visible canvas, stays crisp with nearest-neighbor scaling, follows mouse and touch pointers, updates after brush strokes, shows the original while Compare is held, and leaves export/history untouched.
- Blocks 0–15, 17, and 18 plus the mini-block loupe and UX polish are complete. The optional Block 16 was not separately present; loupe inspection is now delivered by the mini-block.
- Block 8 verification: `node --check` passed for `app.js`, `cursor.js`, and `sw.js`; manifest and installability errors were empty; the service worker activated and controlled the page; 192, 512, and 180 px icons rendered; Add-to-Home-Screen metadata was present; a full offline reload loaded the app from `thr4ce-v1`.

## In progress
- None.

## Next
- User feedback.
- Enable GitHub Pages using `DEPLOY.md`, then rerun the live PWA check.
