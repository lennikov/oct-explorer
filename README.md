# OCT Explorer — OCT Volume Studio

A browser-local retinal optical coherence tomography (OCT) volume explorer and manual lesion measurement workspace developed for Lennikov Lab.

## Recovered application

**The full previously missing OCT application is now recovered.** The attached original is preserved, unchanged, in [OCT_Volume_Studio.html](OCT_Volume_Studio.html) and [releases/recovered-2026-11/OCT_Volume_Studio.html](releases/recovered-2026-11/OCT_Volume_Studio.html).

To run it, download the HTML file and open in desktop Chrome. Select **Open folder** or **Files / ZIP** to load exported OCT images. Data are processed locally.

**Version caveat:** The file does not identify itself as “v5”; this association comes from our October 2026 project history. We have **not** established that the recovered file is byte-identical to the earlier hosted deployment. It is therefore labeled **recovered November 2026 source snapshot**, not a formally certified v5 release.

**Uploaded source SHA-256:** c5a461a270220110d535564cd84b3b7e7ce606a18b7aef900719f39544aab06c

### Features present in the recovered source

- Open classic TIFF, PNG, JPEG and ZIP files; discover and group volume sequences by directory, literal filename prefix and numeric suffix length.
- Read Heidelberg composite OCT images, link source fundus with acquired B-scans, and render en face, orthogonal and 3D volume views using WebGL 2 or CPU fallback.
- Adjust intensity LUTs (grayscale, clinical, inferno and viridis), camera, slice angle, zoom, and red–cyan 3D stereo.
- Detect scale-bar markers for review; calibrate X/Z pixel dimensions and separately enter Y scan spacing.
- Manually outline laser CNV or other lesions in original source coordinates; compute cross-sectional areas and trapezoidal lesion volumes from X/Y/Z spacing; export ROI JSON and summary/per-section CSV.
- Export PNG, linked fundus/B-scan images and seekable WebM video.

### Scientific and usage limitations

The viewer reconstructs **exported display intensities, not raw OCT reflectivity**. No automated lesion identification, anatomical layer segmentation, scan registration, motion correction or clinical diagnosis is performed. The browser may sample large stacks to stay within memory budgets. Scale-marker detection is not a substitute for checking the original acquisition spacing; Y must be supplied separately and physical volumes require all three axes.

**Validation with representative instrument datasets is pending.** Rebuilding and isolated calculation tests confirm the code package, but do not establish measurement accuracy across datasets. Do not use unverified results for clinical decisions.

## Annotated source and build

The single-file HTML includes the JSZip vendor bundle and the OCT application script. Sources have been extracted into:
- [src/](src/) — eight consecutively ordered, annotated JS segments plus CSS and the original HTML shell.
- [vendor/](vendor/) — unchanged embedded JSZip 3.10.1 vendor code.
- [scripts/build.py](scripts/build.py) — concatenates those segments into the exact original HTML.
- [tests/](tests/) — byte-integrity and isolated mathematical regression tests.
- [docs/SOURCE_MAP.md](docs/SOURCE_MAP.md) — individual components, algorithms and their boundaries.

Build and verify:

    python scripts/build.py --check
    python -m unittest discover -s tests -v
    node tests/test_lesion_math.js

See [scientific validation requirements](docs/VALIDATION.md), [recovery provenance](SOURCE_STATUS.json), [release notes](releases/README.md), and [third-party notices](THIRD_PARTY_NOTICES.md). No open-source license for the first-party OCT app is implied. Do not commit identifiable OCT data.
