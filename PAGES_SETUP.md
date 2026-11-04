# GitHub Pages deployment

The public repository contains a root `index.html` which redirects to `OCT_Volume_Studio.html`. The `.nojekyll` file disables Jekyll to preserve the single-file application as-is.

To activate GitHub Pages:

1. Open https://github.com/lennikov/oct-explorer/settings/pages.
2. Under Build and deployment, select Source **Deploy from a branch**.
3. Select branch **main**, folder **/(root)**, and click **Save**.

Then visit https://lennikov.github.io/oct-explorer/ (direct app: https://lennikov.github.io/oct-explorer/OCT_Volume_Studio.html).

The source snapshot supports browser-local OCT volume exploration and manual lesion volumetry; independent validation against acquisition data remains necessary. No OCT datasets or patient-identifiable images should be committed to the public repository.
