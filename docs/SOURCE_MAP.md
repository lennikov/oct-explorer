# Annotated source map

The uploaded application is a standalone HTML file containing CSS, **JSZip v3.10.1**, and one classic OCT application script. The original HTML is retained verbatim. Source JavaScript was divided into consecutive chunks with @repo-annotation comments; the builder strips only these added comments and rejoins the exact original script.

| File | Purpose and key code |
|---|---|
| src/01-file-identity-and-catalog.js | OCT SHA-256 image fingerprints, ZIP and filename grouping, series switching, linked fundus-trace detection |
| src/02-calibration-and-palette.js | Offline scale-bar glyph/L-marker recognition, X/Z and Y calibration, palette LUTs and stereo-camera offsets |
| src/03-video-codecs.js | WebCodecs encoder, seekable EBML/WebM muxer and recorder fallback |
| src/04-lesion-analysis.js | LesionMath shoelace polygon area, polygon validation, slice-area interpolation, trapezoidal volume, ROI JSON and CSV |
| src/05-ui-and-state.js | UI state, canvas references, view and input helpers |
| src/06-import-and-volume.js | Classic TIFF strip decoding, ZIP and raster loading, image crop, reconstruction, 3D spatial calibration |
| src/07-volume-rendering.js | GLSL WebGL 2 raymarch, CPU fallback, camera control and measured overlays |
| src/08-export-workflows.js | PNG and video exports, calibrated overlays, safe cancellation |
| src/style.css | Standalone viewer styling |
| vendor/jszip-3.10.1.min.js | Original third-party bundled code, including upstream copyright notice |
| src/template.html | HTML shell with the three build insertion markers |

**Lesion algorithm:** polygon area is determined from original pixel coordinates. Section area (µm²) = original pixel area × X spacing × Z spacing. Lesion volume (µm³) = sum over annotated intervals of (area at scan i + area at scan i+1) / 2 × physical scan interval. No extrapolation outside first and last reviewed centers. Unreviewed scans can be linearly interpolated only if the user enables it; ambiguous positions or missing X/Y/Z calibration suppress volume results.

**Rendering limitation:** output is a visualization of exported OCT image intensities; the palette does not imply structural thickness or diagnose pathology.
