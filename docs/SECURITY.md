# Security and privacy

- All acquisitions should be processed locally; no real OCT images, donor or patient identifiers, ROI records, decryption keys or credentials belong in Git.
- Review TIFF/ZIP parsing and memory bounds when accepting untrusted datasets. JSZip is included as embedded third-party source.
- If sharing ROI projects or CSV files, check source filenames and paths for protected or proprietary information.
- Do not assume browser-local processing replaces required institutional data-handling policies.
- Validate outputs before using the tool for quantitative scientific conclusions.
