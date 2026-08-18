# OpenSooq CDC Data Analyzer

Convert complicated CDC / raw technical data into clear, readable business information.

## Features

- Upload **PDF** or **CSV** CDC exports (processed locally in the browser)
- Dynamic field detection + human-readable field dictionary
- **Full lifecycle timeline** — every listing replayed from its first event to its last,
  with the gap between events, what changed at each step, and the evidence behind it
- Dashboard, search, filters, record detail, raw/human toggle
- Important events, change detection, QA anomaly analysis
- Charts, record comparison, CSV / Excel / JSON / summary export
- Sensitive-data masking with an optional reveal setting

## Stack

- Next.js + React + TypeScript
- Tailwind CSS
- Zustand, TanStack Table, Recharts
- PDF.js + Papa Parse

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Try the sample file at `sample-data/sample-cdc.csv`.

PDF and CSV uploads are both supported. Parsing runs in the browser.

## Documentation

Full project documentation (architecture, user guide, field dictionary, status codes, privacy, and operations) is available as a PDF:

- [`docs/OpenSooq-CDC-Data-Analyzer-Documentation.pdf`](docs/OpenSooq-CDC-Data-Analyzer-Documentation.pdf)

## Privacy

Uploaded files are parsed in the browser. Nothing is sent to third-party AI services by default.
