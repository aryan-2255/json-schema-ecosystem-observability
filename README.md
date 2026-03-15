# json-schema-observability

A lightweight CLI tool that collects key metrics about the JSON Schema ecosystem and writes them to a structured JSON file. Built as a proof-of-concept for the GSoC "Ecosystem Observability" qualification task.

---

## Project Purpose

This tool tracks two specific signals about the JSON Schema ecosystem:

1. **npm weekly downloads for `ajv`** — the most widely used JSON Schema validator in the JavaScript ecosystem
2. **Count of GitHub repositories tagged with the `json-schema` topic** — a measure of intentional community engagement

It fetches both from their respective public APIs, combines them into a single structured JSON snapshot, and optionally visualizes the result. The goal is to demonstrate a clean, modular, automatable approach to ecosystem observability — one that can be extended with additional metrics over time.


---

## Project Structure

```
json-schema-observability/
│
├── src/
│   ├── npmMetric.ts       # Fetches weekly downloads for "ajv" from the npm API
│   ├── githubMetric.ts    # Fetches repo count with topic "json-schema" from GitHub API
│   └── index.ts           # Entry point — orchestrates collection, combines, writes output
│
├── output/
│   └── metrics.json       # Generated output file (created/overwritten on every run)
│
├── visualization/
│   └── chart.html         # Chart.js dashboard that reads output/metrics.json
│
├── README.md
├── analysis.md            # Interpretation of the collected metrics
├── evaluation.md          # Code review of the upstream json-schema-org/community repo
├── tsconfig.json
└── package.json
```

---

## Setup & Usage

**Requirements:** Node.js 18 or later

```bash
# 1. Install dependencies
npm install

# 2. Run the metric collector
npm start
```

The script will print live progress to the terminal and write the result to `output/metrics.json`.

**To view the chart:**

```bash
# Serve from project root (any HTTP server works)
python3 -m http.server 8080
```

Then open: [http://localhost:8080/visualization/chart.html](http://localhost:8080/visualization/chart.html)

> The chart uses `fetch()` to load `output/metrics.json`. Opening `chart.html` directly from the filesystem (`file://`) will be blocked by browser CORS policy — a local server sidesteps this.

---

## APIs Used

| Source | Endpoint | Auth Required |
|--------|----------|---------------|
| npm Downloads API | `https://api.npmjs.org/downloads/point/last-week/ajv` | No |
| GitHub Search API | `https://api.github.com/search/repositories?q=topic:json-schema` | No (rate-limited to ~10 req/min unauthenticated) |

Both are public, free-tier APIs. No API keys are required for basic usage.

**GitHub rate limits:** Unauthenticated requests to the GitHub Search API are limited to 10 requests per minute. If you hit a rate limit, set a `GITHUB_TOKEN` environment variable (a personal access token with no special scopes) to raise the ceiling to 30 requests per minute.

---

## Example Output

```json
{
  "timestamp": "2026-03-03T17:50:20.914Z",
  "metrics": [
    {
      "name": "ajv_weekly_downloads",
      "value": 243805475,
      "source": "npm",
      "description": "Weekly download count for the ajv JSON Schema validator"
    },
    {
      "name": "github_json_schema_topic_repos",
      "value": 2377,
      "source": "github",
      "description": "Number of public GitHub repositories tagged with the json-schema topic"
    }
  ]
}
```

---

## How to Extend With More Metrics

The architecture is intentionally modular — each metric lives in its own file and exports a single async function.

**To add a new metric (e.g., PyPI downloads for `jsonschema`):**

1. Create `src/pypiMetric.ts`:
   ```typescript
   import axios from "axios";

   export async function fetchPypiWeeklyDownloads(pkg: string): Promise<number> {
     const res = await axios.get(`https://pypistats.org/api/packages/${pkg}/recent`);
     return res.data.data.last_week;
   }
   ```

2. Import and call it in `src/index.ts` alongside the existing fetches:
   ```typescript
   import { fetchPypiWeeklyDownloads } from "./pypiMetric";

   const pypiDownloads = await fetchPypiWeeklyDownloads("jsonschema");
   ```

3. Add the new field to the `MetricsOutput` interface and the output object.

No other files need to change.

---

## Design Decisions

- **`Promise.all` for concurrency** — Both API calls are independent, so they run in parallel rather than sequentially. This halves the wall-clock time.
- **Typed output shape** — The `MetricsOutput` interface in `index.ts` ensures the JSON structure is enforced at compile time and is easy to audit.
- **No framework, no database** — The output is a plain JSON file. Easy to check into version control, diff over time, or feed into any downstream tool.
- **Self-describing metric schema** — Each metric carries its own `source` and `description`. The JSON file is readable without the source code.

---

## Future Extensions

This proof-of-concept deliberately tracks two signals. A production version of this tool would want to grow along the following axes:

**More data sources**
- PyPI weekly downloads for the `jsonschema` Python library
- Rubygems downloads for `json-schemer` (Ruby ecosystem)
- npm downloads for other validators: `ajv`, `zod`, `typebox`, `@sinclair/typebox`
- GitHub stars and open issue counts for key ecosystem repos

**Trend tracking instead of snapshots**
- Switch `output/metrics.json` to an append-only `.jsonl` file — one JSON line per weekly run
- Compute week-over-week delta (e.g., `+1.2%` downloads, `+14` new repos) and include it in the output
- A time-series chart showing growth rates is far more informative than comparing absolute values

**Release and activity signals**
- Track release frequency of major validators (how often do they ship?)
- Watch the JSON Schema spec repo for PR and issue activity
- Count how many repos adopted a new draft version in a given period

**Automation**
- GitHub Actions cron job (see `analysis.md`) to run every Monday and commit the result
- A GitHub Pages deployment so the chart is publicly accessible at a stable URL without running a local server

Each of these extensions follows the same pattern as the current two metrics: add a file in `src/`, export one async function, drop it into the `Promise.all` in `index.ts`. No restructuring needed.
