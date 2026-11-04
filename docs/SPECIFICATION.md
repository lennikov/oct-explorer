# OCT Explorer annotated design map

This is a documented specification of previously reported OCT Volume Studio v5 capabilities. **The original implementation source is not present in this repository.**

1. **Importer / acquisition grouping:** Read local TIFF folders and ZIP acquisitions; group associated B-scans, OCT volumes and en-face/fundus views by filenames and metadata. Prevent accidental mixing of eyes and timepoints.
2. **Calibration and volume:** Parse X/Z image spacing; require manually supplied Y interscan spacing when absent. Report volumetric measurements only when X/Y/Z are known.
3. **Viewer:** Browse B-scans alongside en-face images and 3D reconstructions, with orientation, red–cyan stereo and visual LUTs.
4. **Quantification:** Lesion ROI and voxel integration with physical spacing, exportable CSV and saved/reloaded ROI settings. Report units, thresholds and calibration provenance.
5. **Performance and exports:** PNG/WebM visual output, cancelable processing and conservative browser memory usage.
6. **Data privacy:** Process images on the workstation; do not commit OCT scans, identifiers or specimen metadata.

Potential future features such as robust segmentation, automated drusen quantification and a formal scientific validation suite require independent testing and versioning. They should not be presented as delivered until verified in recovered source.
