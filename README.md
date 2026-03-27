# json-schema-observability

A lightweight CLI tool that collects key metrics about the JSON Schema ecosystem from multiple registries and writes them to a structured JSON file. Built as a proof-of-concept for the GSoC "Ecosystem Observability" qualification task.

---

## Project Purpose

This tool tracks three specific signals about the JSON Schema ecosystem across two package registries:

1. **npm weekly downloads for `ajv`** - the most widely used JSON Schema validator in the JavaScript ecosystem
2. **Count of GitHub repositories tagged with the `json-schema` topic** - a measure of intentional community engagement
3. **PyPI weekly downloads for `jsonschema`** - the primary JSON Schema validator in the Python ecosystem

It fetches all three from their respective public APIs in parallel, combines them into a single structured JSON snapshot, and visualizes the result on a live dashboard. The goal is to demonstrate a clean, modular, automatable approach to ecosystem observability - one that extends across registries and can grow with additional metrics over time.


---

## Project Structure

```
json-schema-observability/
│
├── src/
│   ├── npmMetric.ts       # Fetches weekly downloads for "ajv" from the npm API
│   ├── githubMetric.ts    # Fetches repo count with topic "json-schema" from GitHub API
│   ├── pypiMetric.ts      # Fetches weekly downloads for "jsonschema" from the PyPI Stats API
│   └── index.ts           # Entry point - orchestrates collection, combines, writes output
│
├── tests/
│   └── metrics.test.ts    # Integration tests for all three metric fetchers
│
├── output/
│   └── metrics.json       # Generated output file (created/overwritten on every run)
│
├── visualization/
│   └── chart.html         # Chart.js dashboard that reads output/metrics.json
│
├── README.md
├── analysis.md            # Part 1 of the qualification task
├── evaluation.md          # Part 2 of the qualification task
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

> The chart uses `fetch()` to load `output/metrics.json`. Opening `chart.html` directly from the filesystem (`file://`) will be blocked by browser CORS policy - a local server sidesteps this.

---

## Testing

```bash
npm test
```

Runs integration tests that verify each metric fetcher returns valid data from its live API and checks that `output/metrics.json` has the correct structure. No extra dependencies needed.

---

## APIs Used

| Source | Endpoint | Auth Required |
|--------|----------|---------------|
| npm Downloads API | `https://api.npmjs.org/downloads/point/last-week/ajv` | No |
| GitHub Search API | `https://api.github.com/search/repositories?q=topic:json-schema` | No (rate-limited to ~10 req/min unauthenticated) |
| PyPI Stats API | `https://pypistats.org/api/packages/jsonschema/recent` | No |

All three are public, free-tier APIs. No API keys are required for basic usage.

**GitHub rate limits:** Unauthenticated requests to the GitHub Search API are limited to 10 requests per minute. If you hit a rate limit, set a `GITHUB_TOKEN` environment variable (a personal access token with no special scopes) to raise the ceiling to 30 requests per minute.

---

## Example Output

```json
{
  "timestamp": "2026-03-18T00:00:00.000Z",
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
    },
    {
      "name": "pypi_jsonschema_weekly_downloads",
      "value": 8500000,
      "source": "pypi",
      "description": "Weekly download count for the jsonschema Python package"
    }
  ]
}
```

---

## How to Extend With More Metrics

The architecture is intentionally modular - each metric lives in its own file and exports a single async function.

**To add a new metric (e.g., Rubygems downloads for `json-schemer`):**

1. Create `src/rubygemsMetric.ts`:
   ```typescript
   import axios from "axios";

   export async function fetchRubygemsDownloads(gem: string): Promise<number> {
     const res = await axios.get(`https://rubygems.org/api/v1/gems/${gem}.json`);
     return res.data.downloads;
   }
   ```

2. Import and call it in `src/index.ts` alongside the existing fetches:
   ```typescript
   import { fetchRubygemsDownloads } from "./rubygemsMetric";

   const rubyDownloads = await fetchRubygemsDownloads("json-schemer");
   ```

3. Add the new entry to the `metrics` array in the output object.

No other files need to change.

---

## Design Decisions

- **`Promise.all` for concurrency** - All three API calls are independent, so they run in parallel rather than sequentially. This minimizes wall-clock time and proves the modular pattern scales to multiple registries.
- **Typed output shape** - The `MetricsOutput` interface in `index.ts` ensures the JSON structure is enforced at compile time and is easy to audit.
- **No framework, no database** - The output is a plain JSON file. Easy to check into version control, diff over time, or feed into any downstream tool.
- **Self-describing metric schema** - Each metric carries its own `source` and `description`. The JSON file is readable without the source code.

---

## Future Extensions

This proof-of-concept tracks three signals across two package registries and GitHub. A production version would grow along the following axes:

**More data sources**
- Rubygems downloads for `json-schemer` (Ruby ecosystem)
- npm downloads for other validators: `zod`, `typebox`, `@sinclair/typebox`
- GitHub stars and open issue counts for key ecosystem repos

**Trend tracking instead of snapshots**
- Switch `output/metrics.json` to an append-only `.jsonl` file - one JSON line per weekly run
- Compute week-over-week delta (e.g., `+1.2%` downloads, `+14` new repos) and include it in the output
- A time-series chart showing growth rates is far more informative than comparing absolute values

**Release and activity signals**
- Track release frequency of major validators (how often do they ship?)
- Watch the JSON Schema spec repo for PR and issue activity
- Count how many repos adopted a new draft version in a given period

**Automation**
- GitHub Actions cron job (see `analysis.md`) to run every Monday and commit the result
- A GitHub Pages deployment so the chart is publicly accessible at a stable URL without running a local server

Each of these extensions follows the same pattern as the current three metrics: add a file in `src/`, export one async function, drop it into the `Promise.all` in `index.ts`. No restructuring needed.
