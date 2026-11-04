# OCT Explorer — implementation-verified feature specification

The previously missing OCT application has been recovered and its source is now stored in this repository. This document describes **functions actually found in the uploaded code**, not a proposed UI mockup.

**Inputs:** local folders (including subfolders), ZIPs, classic TIFF strips (8/16-bit grayscale and RGB; uncompressed/PackBits/LZW/Deflate where supported), PNG and JPEG. Discovery groups image sequences using subfolder, filename prefix, numeric suffix width and type.

**Viewer:** linked source fundus and B-scan acquisition traces for detected Heidelberg composites; acquired B-scan selection; orthogonal/en face planes; interactive 3D via WebGL 2 or CPU fallback; controls for contrast, render mode, palettes and red–cyan stereo.

**Calibration:** offline scale-bar detection requires review; X/Z dimensions derived from source crop pixel spacing; Y scan-center interval separately entered. No quantitative volume should be reported with missing X/Y/Z spacing.

**Lesion analysis:** hand-drawn polygons saved in original source coordinates, editable scan-by-scan with absent-scan markers. Cross-sectional area from shoelace formula; 3D volume by trapezoidal integration across annotated scan centers. Provides ROI project JSON and CSV tables. This does not automatically detect CNV, perfusion or retinal layers.

**Exports:** single and paired PNG views with optional calibrated bars, annotations and color legend; seekable WebM rotation and sweep videos.

**Known boundaries:** exported display intensities are not raw OCT reflectivity. No motion correction, clinical diagnosis or registration. Very large image sequences may be sampled; missing frames are not reconstructed. Test data and independent real-device verification are still required.

Build provenance and module ownership are documented in SOURCE_MAP.md.
