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
- Blocks 0–7 are implemented. The app remains dependency-free and runs without a build step.
- Source hashes, complete settings, and deterministic stroke evidence are included in the JSON export.
- Desktop and 390 px layouts were rendered and inspected.

## Block
- Block 7 selection and isolate: complete at `cf30126`.
- Block 8 deploy and PWA: complete. Added the versioned cache-first service worker with offline navigation fallback, install metadata, maskable PNG icons, GitHub Pages instructions, and the install section in the README.
- Block 8 verification: `node --check` passed for `app.js`, `cursor.js`, and `sw.js`; manifest and installability errors were empty; the service worker activated and controlled the page; 192, 512, and 180 px icons rendered; Add-to-Home-Screen metadata was present; a full offline reload loaded the app from `thr4ce-v1`.

## In progress
- None.

## Next
- Presets for recurring workflows.
- Randomize with a seed.
- `.thr4ce` project file format.
