# Code Evaluation — `json-schema-org/ecosystem/projects/initial-data`

**Repository:** https://github.com/json-schema-org/ecosystem/tree/main/projects/initial-data  
**Reviewed:** 2026-03-03

---

## What It Does

`initial-data` is a Node.js (ESM) script that uses the GitHub REST API (via the `octokit` SDK) to collect all GitHub repositories tagged with the `json-schema` topic. For each repository, it queries the Internet Archive's Wayback Machine API to determine whether the topic was already applied when the repository first appeared online. Results are written progressively to a CSV file as they are collected.

The goal, as stated in the README, is to track *when* repos joined the JSON Schema ecosystem — a time-series of ecosystem growth. The Internet Archive angle is an interesting heuristic for approximate "original topic" detection.

---

## Code Review

### What It Does Well

**1. Intentional pacing to respect rate limits.**  
The script deliberately runs slowly (with artificial delays) to avoid hitting GitHub's rate limit. This is a pragmatic choice for a long-running batch job, and the README is upfront about it. This kind of thoughtfulness in a data-collection script matters more than it might seem; a script that hammers an API and gets blocked halfway through is far worse than a slow one that finishes.

**2. Progressive CSV writing.**  
`DataRecorder` appends each row to the CSV file as it's processed, not after the entire run completes. This is the right design for a job that takes hours — if it crashes at repo 800, you still have data for repos 1–799 rather than nothing.

**3. Clean separation in `DataRecorder`.**  
The `DataRecorder` class is small, focused, and easy to test. Its single responsibility is clear: manage a CSV file. The test for it is straightforward and tests the actual filesystem behaviour, not a mock.

**4. Flexible input handling.**  
`setup.js` reads configuration from both environment variables and CLI flags (`--github-token`, `--topic`, `--num-repos`), which makes it easy to run in different contexts (local dev, CI) without changing the code.

---

### Limitations

**1. No TypeScript — types are entirely implicit.**  
The codebase is plain JavaScript. The data structure of a "row" being written to the CSV is an array that happens to match the column order defined elsewhere — nothing enforces this relationship. Adding TypeScript interfaces for the repository record shape, the CSV row structure, and the API response would eliminate an entire class of silent bugs (e.g., column order drift).

**2. Internet Archive dependency is a fragile hard rate limit.**  
The Wayback Machine API caps at 500 requests per hour with no documented way to authenticate or raise the limit. The README acknowledges this, but there is no retry logic, exponential backoff, or graceful degradation built in. If the rate limit is hit mid-run, the script either stalls or errors out depending on how the HTTP client handles a 429. For a production-grade tool, this API dependency would need careful wrapping.

**3. Mixed toolchain complexity.**  
The project uses `pnpm` (Node.js), `csvkit` (Python), and optionally `gnuplot` for the full data pipeline. Each of these requires a separate installation step, and `csvkit` in particular is a Python tool that many Node.js developers will not have available. The post-processing pipeline is documented as a series of shell commands to run manually, not as an automated step. This significantly raises the barrier to entry.

**4. CSV as output format limits downstream usability.**  
CSV is fine for data exploration but harder to consume programmatically or diff meaningfully in version control. The data collected (repo name, creation date, first-release date) would be equally well represented as JSONL (one JSON object per line) or a structured JSON file, both of which are friendlier for automation and API consumption.

**5. Test suite requires a live GitHub token.**  
`processRespository.test.js` calls `getInput()` at module load time, which reads `GITHUB_TOKEN` from the environment. Running the tests without a valid token will exit with an error before any test runs. There's no mocking at the network boundary, so the test suite is effectively an integration test suite that depends on external infrastructure and your own token.

**6. The `main.js` export structure is split awkwardly.**  
The file exports both `fetchRepoCreationDate` (a utilities function) and `runMain` (the entry point), and the actual `main` function is not exported. This organisation makes unit testing individual functions harder — you'd need to restructure exports if you wanted to test the core loop logic in isolation.

---

### What Happens When You Run It

After running `pnpm install` and creating a `.env` file with `GITHUB_TOKEN`, `TOPIC=json-schema`, and `NUM_REPOS=10`:

1. `node start.js` calls `runMain()`, which initialises Octokit and paginates through GitHub's topic search results.
2. For each of the first 10 repos, it makes a Wayback Machine API call to check the earliest archived snapshot of the repo page.
3. Each row is appended to a CSV file named `initialTopicRepoData-<timestamp>.csv`.
4. Progress is logged to stdout: `processed 1`, `processed 2`, etc.

With `NUM_REPOS=-1`, the run will process every repo in the topic (potentially 10,000+). Given the Wayback Machine's 500 req/hour cap, a full run could take 20+ hours. There is no resume/checkpoint capability — if the script is interrupted, you restart from zero.

---

### Observations About Maintainability

- The codebase is small enough that any single developer can hold it in their head, which is appropriate for its current scope.
- The manual post-processing step (three separate shell commands to sort, reformat, and graph the CSV) should be scripted — perhaps as an npm script or a separate `process.js` file. As written, it's discoverable only if you read the README carefully.
- There are no type definitions, no JSDoc comments, and minimal inline comments. The code is readable, but a new contributor would need to trace the call chain to understand the data flow.
- The project name in `package.json` is `"initial-data"` with no description. Filling in even a one-sentence description would help GitHub search indexing and signal that the project is intentional.

---

## Recommendation

---

### Should we build on this code or start fresh?

**Build on it.**

This codebase has a clear and narrow focus — collecting GitHub topic data and anchoring it to Internet Archive timestamps. That is a good problem to solve and not one that any general-purpose tool currently handles. The core idea is worth preserving. Starting fresh would mean discarding working API integration logic, an existing data file (`initialTopicRepoData-1711533629611.csv`), and a data collection pattern that already runs end to end.

---

### Justification (2–3 sentences)

The Internet Archive heuristic for determining when a repository *first* adopted the `json-schema` topic is a genuinely novel approach — it is not found in any comparable ecosystem observability tool. Rebuilding this from scratch would cost more time than it would save, and the existing structure (configuration, pagination, progressive file writing) is sound enough to build on. The real problem is not the approach but the lack of type safety, retry logic, and post-processing automation — all of which are refactoring tasks, not reasons to start over.

---

### If building on it: What would you change first?

**Priority 1 — Add TypeScript (or JSDoc types) to the data layer**

The highest immediate risk is the CSV row format. A row is built by calling `Object.values(dataRow)` and appending the result — meaning column order is determined at runtime by object key insertion order. If any upstream change reorders keys, the CSV columns silently shift without any error. The first refactoring step would be to define explicit TypeScript interfaces for:
- The repository record returned by the GitHub API
- The processed row written to the CSV
- The shape of the `getInput()` return value

This adds zero runtime cost and eliminates a whole category of silent bugs.

**Priority 2 — Wrap Internet Archive calls in retry logic with backoff**

The Wayback Machine allows 500 requests per hour. With `NUM_REPOS=-1`, a full run processes 10,000+ repositories. A mid-run rate limit hit currently either stalls or crashes the process with no recovery. A simple exponential backoff wrapper around the Wayback Machine calls — pause on 429, retry up to 3 times, skip and log on repeated failure — would make the tool reliable enough to run unattended in CI.

**Priority 3 — Script the post-processing pipeline**

Currently, the README documents three manual shell commands (`csvsort`, `csvcut`, `gnuplot`) that must be run by hand after data collection. These should be a single `npm run process` script that takes the latest CSV, applies the transforms, and outputs the graph automatically. This removes a copy-paste step that is guaranteed to be missed or done incorrectly by a new contributor.

---

### If starting fresh: What would you keep from the approach?

Even in a full rewrite, three design decisions from this codebase are worth carrying forward:

**1. The Internet Archive timestamp heuristic**
The idea of querying the Wayback Machine to verify that a repository had the `json-schema` topic at its original creation time — rather than just at the time of scraping — is clever and defensible. It filters out repos that retroactively tagged themselves with the topic. This nuance matters for accurate ecosystem growth tracking and should not be discarded.

**2. Progressive / append-only file writing**
Writing each processed row to disk immediately rather than batching everything in memory is the right design for a job that runs for hours. A crash at repo 8,000 should not lose the first 7,999 results. This pattern (whether with CSV, JSONL, or SQLite) belongs in any replacement implementation.

**3. Configuration from both environment variables and CLI flags**
`setup.js` reads `GITHUB_TOKEN`, `TOPIC`, and `NUM_REPOS` from both `.env` and command-line arguments. This makes the tool flexible to run locally (with a `.env` file) and in CI (with environment variables injected by the runner) without code changes. Any replacement tool should support the same dual-input pattern.

---

### Architectural Direction

A long-term improvement would be to introduce a collector abstraction layer where each data source (GitHub topic scanning, Wayback enrichment, npm metrics, PyPI metrics, draft adoption tracking, etc.) is implemented as an independent collector module. Each collector would emit structured JSON conforming to a unified output schema, rather than writing directly to CSV.

This would separate data acquisition, enrichment, and output formatting into distinct layers, making the system easier to extend without restructuring the core pipeline. New ecosystem signals could be added by implementing a new collector rather than modifying the main loop.

Such a design would allow the project to evolve from a single-purpose script into a scalable observability framework capable of tracking multiple dimensions of the JSON Schema ecosystem over time.