# Pitcher Signal Radar

Local-first web app for BDRs who want to detect early RFP, RFQ, tender, vendor-evaluation, and commercial-transformation signals before a formal procurement process closes the door.

This MVP is designed for Pitcher-style outbound in pharma, medtech, financial services, and enterprise field-sales accounts. It ranks accounts by explainable signal strength, shows the underlying evidence, recommends who to contact, and generates outreach copy that is careful not to overstate assumptions.

## What the app does

- Monitors accounts with mock provider abstractions and seeded demo data
- Separates weak hints from likely pre-RFP motion and confirmed procurement signals
- Scores each account from `0-100` with visible scoring explanations
- Recommends stakeholders, outreach angle, email copy, LinkedIn copy, and next best action
- Supports CSV upload, manual account creation, and local exports
- Keeps data local in SQLite for the MVP

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Prisma
- SQLite
- Zod
- Papa Parse
- Vitest

## Setup

From the `web/` directory:

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

- `/` dashboard with ranked priority accounts, recent signals, and provider run health
- `/accounts` filterable account table, CSV upload, and manual account creation
- `/accounts/[id]` account detail with evidence, stakeholders, and outreach
- `/signals` chronological signal feed with filters
- `/settings` scoring, keywords, target profile, competitors, and provider registry

## How to upload accounts

Upload a CSV with any of these headers:

```csv
name,website,industry,country,employeeCount,revenue,owner,notes
```

Notes:

- `industry` should use enum-style values such as `PHARMA`, `MEDTECH`, `FINANCIAL_SERVICES`, `ENTERPRISE_FIELD_SALES`, or `OTHER`
- Uploaded accounts are validated with Zod
- Duplicate detection uses normalized account name plus website
- New accounts trigger a mock local scan so the workflow can be tested end to end

## Scoring model

The app uses an explainable `0-100` scoring model.

- Direct RFP / tender mention: `+40`
- Hiring signal tied to CRM / enablement / commercial excellence: `+15`
- New leader or organizational change: `+10`
- Competitor / vendor mention: `+15`
- CRM / Veeva / Salesforce / IQVIA signal: `+20`
- Strategic initiative mention: `+10`
- Multiple signals in 90 days: `+10`
- Fresh signal within 30 days: `+10`
- Target industry fit: `+10`
- Ambiguous inferred-only evidence: `-10`

Stage thresholds:

- `0-20`: No signal
- `21-40`: Early signal
- `41-60`: Pre-RFP
- `61-80`: Active evaluation
- `81-100`: Active RFP / tender

`POST_DECISION` can override the numeric score when the evidence points to a cycle that is already effectively closed.

## Provider abstraction

The MVP ships with mock providers and a clean seam for future connectors.

Current mock providers:

- `mock-hiring-feed`
- `mock-tech-watch`
- `mock-strategy-watch`
- `mock-organizational-watch`
- `mock-vendor-intel`
- `mock-public-tender`

Future real providers can plug into the same model:

- public procurement portals
- approved search providers
- uploaded Sales Navigator or LinkedIn exports
- company sites and press releases
- CRM target lists
- RSS and alert feeds

## Exports

- Current account list as CSV
- Account detail as Markdown
- Outreach pack as Markdown or TXT
- Full dashboard report as Markdown

## Testing

Run:

```bash
npm run typecheck
npm run lint
npm run test
```

Coverage in this MVP includes:

- signal classification
- score and stage assignment
- CSV parsing
- outreach fallback
- duplicate account handling

## Roadmap

1. Real web-search provider integration
2. TED, Find a Tender, NHS, and additional procurement connectors
3. HubSpot account sync
4. Sales Navigator CSV import workflow
5. Weekly monitoring jobs and recurring scans
6. Email alerts
7. Slack alerts
8. Competitor case-study monitoring
9. Chrome extension for account-signal capture
10. AI-generated account briefings

## Limitations

- The current signal set is mock data for a local MVP, not live internet coverage
- Evidence URLs in the seed data are illustrative demo links
- The app does not scrape LinkedIn or other restricted platforms
- Private-market RFP detection is inferential by nature and should not be presented as certainty
- Large accounts are included to demonstrate workflow breadth, not perfect ICP prioritization
