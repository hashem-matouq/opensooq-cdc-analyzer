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

There is no `--webpack` flag in 15.5.23; webpack is the default. Turbopack can only be turned on by
`--turbo`/`--turbopack` or a `TURBOPACK` env var. Two traps with that variable:

- `TURBOPACK=0` still enables Turbopack — the string `"0"` is truthy. Only an empty value
  (`TURBOPACK=`) or `unset TURBOPACK` disables it.
- Next.js loads `.env*`, so a `TURBOPACK=1` line in a local `.env.local` silently forces Turbopack.
  `.gitignore` covers `.env*`, so such a file never shows up in `git status`. The startup banner
  lists loaded env files (`- Environments: .env.local`), which is the quickest way to spot it.

Only run **one** dev server per checkout. Several `next dev` instances (or a `next build`) sharing
one `.next` corrupt each other's manifests, even on the same bundler.

A stale or partially written `.next` surfaces as a runtime `ENOENT ... app-build-manifest.json`
(e.g. for `_not-found`) and returns HTTP 500, or makes `/` start 404ing. Next.js does not self-heal
it; stop every dev server, `rm -rf .next`, and start a single one. `.next/` is gitignored, so
deleting it is always safe.
