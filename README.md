# Series 3 Wrong Question Review

This workspace contains a static website generated from four Series 3 screenshot sets:

- the original GreenLight `error-*.png` screenshots
- a second simulated exam result set with 24 missed questions
- simulated final exam 1 with 39 missed questions
- simulated final exam 2 with 24 missed questions

## Rebuild The OCR Data

1. Run the OCR extraction for the original GreenLight batch:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\extract-questions.ps1
```

2. Build the browser-ready data files for the original batch:

```powershell
C:\Users\eric.benhamou\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\scripts\build-questions.mjs
```

3. To rebuild the second exam set, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\extract-questions.ps1 `
  -SourceDir "C:\Users\eric.benhamou\Desktop\wrong\Simulated Exam General 3 - Score 67 - 06-02-2026 (74 questions - 24 errors)" `
  -RawOutput "data\raw-ocr-second-exam.json" `
  -ScreenshotDir "screenshots\second-exam-results"

C:\Users\eric.benhamou\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\scripts\build-questions.mjs `
  --raw data\raw-ocr-second-exam.json `
  --json data\questions-second-exam.json `
  --js data\questions-second-exam.js
```

4. To rebuild simulated final exam 1, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\extract-questions.ps1 `
  -SourceDir "C:\Users\eric.benhamou\Desktop\wrong\Simulated final exam 1 - Score 67 - 05-31-2026 8 05 AM (39 errors)" `
  -RawOutput "data\raw-ocr-simulated-final-exam-1.json" `
  -ScreenshotDir "screenshots\simulated-final-exam-1" `
  -FilePattern "failure-*.png"

C:\Users\eric.benhamou\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\scripts\build-questions.mjs `
  --raw data\raw-ocr-simulated-final-exam-1.json `
  --json data\questions-simulated-final-exam-1.json `
  --js data\questions-simulated-final-exam-1.js
```

5. To rebuild simulated final exam 2, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\extract-questions.ps1 `
  -SourceDir "C:\Users\eric.benhamou\Desktop\wrong\Simulated final exam 2 - Score 80 - 06-01-2026-4 49 AM (24 errors)" `
  -RawOutput "data\raw-ocr-simulated-final-exam-2.json" `
  -ScreenshotDir "screenshots\simulated-final-exam-2"

C:\Users\eric.benhamou\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\scripts\build-questions.mjs `
  --raw data\raw-ocr-simulated-final-exam-2.json `
  --json data\questions-simulated-final-exam-2.json `
  --js data\questions-simulated-final-exam-2.js
```

6. Open one of these pages:

- [index.html](C:\Users\eric.benhamou\Documents\Codex\Series-3\index.html)
- [second-exam-results.html](C:\Users\eric.benhamou\Documents\Codex\Series-3\second-exam-results.html)
- [simulated-final-exam-1.html](C:\Users\eric.benhamou\Documents\Codex\Series-3\simulated-final-exam-1.html)
- [simulated-final-exam-2.html](C:\Users\eric.benhamou\Documents\Codex\Series-3\simulated-final-exam-2.html)

## Notes

- The OCR uses Windows' built-in OCR engine, so no network access is required.
- The generated site works directly from the filesystem because the structured data is emitted as `data/questions.js`.
- Some entries may contain minor OCR artifacts. The original screenshot is included with each question for cross-checking.
