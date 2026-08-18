# AGENTS.md

## Cursor Cloud specific instructions

This is a **fully client-side Next.js app** (OpenSooq CDC Data Analyzer). There is no backend,
database, or external API — CDC files (PDF/CSV) are parsed entirely in the browser. No secrets
or environment variables are required.

Standard commands live in `package.json` (`dev`, `build`, `start`, `lint`); see the
[README](./README.md) for the intended flow. Notes that aren't obvious from those files:

- Node.js 20+ is required (the VM has Node 22, which works).
- The single dev service is the Next.js dev server: `npm run dev` on port 3000. The `dev` script
  sets `WATCHPACK_POLLING=true` so hot reload works reliably in this containerized VM.
- `npm run lint` runs ESLint (`eslint-config-next`); `npm run build` also type-checks and lints.
- To exercise core functionality, upload a CDC file on the landing page — a sample is at
  `sample-data/sample-cdc.csv`. A successful upload replaces the upload screen with the analyzer
  dashboard (records, timeline, insights, QA analysis, charts, export).
- Because everything runs in the browser, verifying real behavior requires a browser (e.g. driving
  the pre-installed Chrome at `/usr/bin/google-chrome-stable` via Playwright); `curl` only returns
  the pre-upload HTML shell.
