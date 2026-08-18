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

### Use webpack, not Turbopack

Run the dev server via `npm run dev` (webpack). Do **not** add `--turbopack`:

- `next.config.ts` aliases `canvas` to `false` under the `webpack` key, which Turbopack ignores —
  it warns `Webpack is configured while Turbopack is not`. That alias exists for `pdfjs-dist`, so
  PDF uploads are the first thing to break under Turbopack.
- The two bundlers write incompatible `.next` layouts (webpack emits `server/app/_not-found`,
  Turbopack emits `server/app/_not-found/page`). Switching bundlers, or running `next build` and
  `next dev` against the same `.next`, leaves stale manifests behind.

A stale or partially written `.next` surfaces as a runtime `ENOENT ... app-build-manifest.json`
(e.g. for `_not-found`) and returns HTTP 500. Next.js does not self-heal it; stop the dev server,
`rm -rf .next`, and restart. `.next/` is gitignored, so deleting it is always safe.
