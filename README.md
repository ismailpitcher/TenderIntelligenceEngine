# Tender Intelligence Engine

Tender Intelligence Engine is a Europe-first web application that finds public tenders, RFPs, RFQs, and notices that are likely to be relevant for Pitcher.

It is designed around one principle: the best opportunities usually do not mention `Pitcher` by name. They describe the buying problem. This app ingests procurement notices from official public sources, normalizes them, scores them against a Pitcher-fit taxonomy, and gives SDRs or commercial teams a review queue instead of a noisy tender dump.

## What the MVP does

- Pulls live procurement notices from:
  - TED
  - BOAMP
  - Contracts Finder
  - Find a Tender
- Normalizes notices into one schema
- Scores notices for `Pitcher-fit` using industry, workflow, buyer-team, integration, and scale signals
- Applies negative filters for obviously irrelevant procurement like construction, cleaning, physical supplies, and unrelated infrastructure buys
- Lets users:
  - sync sources on demand
  - filter and search notices
  - review notices as `qualified`, `watch`, or `rejected`
  - export the filtered list as CSV

## Free hosting mode

If you do not want to pay for backend hosting, this repo now supports a zero-backend deployment model:

- GitHub Actions runs the sync and scoring pipeline on a schedule
- the app exports a static `snapshot.json`
- GitHub Pages serves a static review UI from `docs/`
- review status and notes are stored in the browser with `localStorage`

This means:

- no paid backend hosting
- no server process to keep alive
- no persistent shared review database in the hosted version

The live FastAPI app still exists for local use, but the free hosted version is static.

## Product assumptions

The scoring model is tuned to Pitcher-style deals:

- sales enablement
- revenue enablement
- commercial excellence
- field force effectiveness
- CRM and ERP-connected seller workflows
- compliant buyer engagement in regulated sectors
- pharma, medtech, life sciences, and adjacent enterprise field-selling environments

## Stack

- Backend: FastAPI
- Storage: SQLite by default
- Frontend: server-hosted HTML/CSS/JavaScript
- Connectors: official public APIs and open endpoints where available

## Quick start

1. Create a virtualenv and install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Start the app

```bash
uvicorn app.main:app --reload
```

3. Open the UI

```text
http://127.0.0.1:8000
```

4. Run the first sync from the UI, or with the CLI

```bash
python3 -m app.cli sync --days-back 7 --limit-per-source 15
```

## CLI

Initialize the database:

```bash
python3 -m app.cli init-db
```

Sync official sources:

```bash
python3 -m app.cli sync --days-back 7 --sources ted boamp contracts_finder find_tender
```

Re-score everything:

```bash
python3 -m app.cli rescore
```

Export the static GitHub Pages snapshot:

```bash
python3 -m app.cli export-static --out-dir docs/data --limit 1000
```

## GitHub Pages deployment

The workflow in [.github/workflows/pages.yml](./.github/workflows/pages.yml) does all of the following for free on GitHub:

1. installs dependencies
2. syncs tender sources
3. scores and exports a static snapshot
4. deploys the `docs/` site to GitHub Pages

The workflow runs:

- on push to `main`
- on manual dispatch
- on a daily schedule

Once GitHub Pages is enabled for the repository, the hosted app will be the static site in `docs/`.

## Environment variables

- `TIE_DB_PATH`
- `TIE_DEFAULT_SYNC_DAYS`
- `TIE_SYNC_LIMIT_PER_SOURCE`
- `TIE_USER_AGENT`
- `TIE_REQUEST_TIMEOUT`

## Data model

Each notice is stored with:

- source and source notice ID
- title
- buyer
- country
- publication and deadline dates
- notice URL and document URL
- extracted text
- CPV codes when available
- fit score and reasoning
- review status and notes

## Notes on source coverage

This MVP is intentionally Europe-first and public-source-first. It covers the most accessible official data sources that can be integrated quickly and reliably.

Private-market RFQs and pre-RFP buying signals should be built as a second layer on top of this:

- jobs
- press releases
- consultancy announcements
- incumbent stack signals
- framework expirations

## Testing

```bash
python3 -m pytest
```

## Repo structure

```text
app/
  connectors/
  services/
  static/
  templates/
data/
tests/
```
