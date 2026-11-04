# Scientific verification and quality assurance

Checks completed against the uploaded source:
1. Canonical HTML reconstructed byte-for-byte from CSS, vendor JS, and annotated source chunks.
2. Python unittest tests for exact reconstruction and bundle completeness.
3. JavaScript syntax of concatenated application and JSZip vendor bundle.
4. Isolated numerical tests: polygon area; rejection of a crossing polygon; trapezoidal lesion-volume integration; refusal to calculate volume when the Y axis is uncalibrated.

Still necessary before using results quantitatively:
- Load representative real Heidelberg composite, ordinary TIFF and ZIP exports in Chrome.
- Compare original B-scan order, fundus locator, frame sampling and crop against acquisition files.
- Verify independently recorded X/Z calibration and Y distance between discovered scans.
- Calculate area/volume for manually drawn reference lesions, including absent end scans, missing intermediates and boundaries.
- Compare saved/reloaded ROI project hashes, CSV numeric fields and units against reference calculations.
- Validate WebGL/CPU, PNG and WebM video exports on target browsers.
- Ensure patient identifiers and proprietary experimental images are absent from source and tests.

The browser viewer is research visualization software, not a medical device or clinically validated algorithm. An original HTML file and passing isolated tests do not establish acquisition compatibility or quantitative accuracy.
