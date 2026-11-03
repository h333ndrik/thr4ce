# thr4ce state

## Last state
- Baseline scaffold: `b77503f` (`baseline scaffold`).
- Block 0 baseline check: `21cfa41` (`block 0: baseline check`).
- Block 1 import robustness: `f9af4af` (`block 1: harden image import`).
- Block 2 zoom and pan: `1c11522` (`block 2: add zoom and pan`).
- Import now uses one shared path for picker and drag/drop, validates file type, decodeability, and the 30 MB limit, and leaves the active edit unchanged on failure.
- Compare always renders the untouched, unmirrored original; export still renders fresh before download.

## Block
- Block 3 morphology brush: complete. The binary mask rebuilds from tone/threshold/dithering/mirror, strokes replay deterministically from seeded hashes, Break/Thin/Fatten/Dissolve/Restore are available, and a zoom-aware brush ring follows the pointer.

## In progress
- None.

## Next
- Block 4 cleanup tools.
