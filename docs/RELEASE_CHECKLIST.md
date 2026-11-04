# Release-blocking checklist

- [ ] Recover the complete `OCT_Volume_Studio_v5.html` or original development project.
- [ ] Check whether the file matches the last tested v5 version (not an intermediate build).
- [ ] Scan defaults and source for patient identifiers, credentials, sample images and private laboratory data.
- [ ] Verify OCT slice ordering, X/Y/Z spacing, 3D reconstruction and derived voxel volume on known reference data.
- [ ] Test TIFF ZIP/folder ingestion and association of en-face and B-scan images.
- [ ] Validate 3D, anaglyph, PNG/WebM export, ROI CSV and cancel/abort behavior across supported browsers.
- [ ] Publish unchanged executable build, tag, version-specific release notes and checksum.

Do **not** label a scaffold as a tested release.
