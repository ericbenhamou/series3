# Series 3 Wrong Question Review

This workspace contains a static website generated from the GreenLight `error-*.png` screenshots.

## Rebuild The OCR Data

1. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\extract-questions.ps1
```

2. Then build the browser-ready data files:

```powershell
C:\Users\eric.benhamou\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\scripts\build-questions.mjs
```

3. Open [index.html](C:\Users\eric.benhamou\Documents\Codex\Series-3\index.html).

## Notes

- The OCR uses Windows' built-in OCR engine, so no network access is required.
- The generated site works directly from the filesystem because the structured data is emitted as `data/questions.js`.
- Some entries may contain minor OCR artifacts. The original screenshot is included with each question for cross-checking.
