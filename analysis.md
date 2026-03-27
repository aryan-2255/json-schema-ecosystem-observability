# Analysis - JSON Schema Ecosystem Metrics

---

## Metrics tracked

1. **npm weekly downloads for `ajv`** - fetched from `api.npmjs.org/downloads/point/last-week/ajv`
2. **Count of GitHub repositories with the `json-schema` topic** - fetched from `api.github.com/search/repositories?q=topic:json-schema`
3. **PyPI weekly downloads for `jsonschema`** - fetched from `pypistats.org/api/packages/jsonschema/recent`

---

## What do these metrics tell us about the JSON Schema ecosystem?

These three numbers measure very different things. Reading them together is where the real signal is.


**npm weekly downloads - `ajv`: 243,805,475**

This is not a measure of conscious developer adoption. It is a measure of infrastructure embedding.

`ajv` is pulled in automatically as a dependency of ESLint, Webpack, Jest, and dozens of other foundational build-chain tools. A developer who has never heard of JSON Schema almost certainly runs `ajv` on every `npm install`. This makes the download count the wrong metric for measuring community awareness, but exactly the right metric for measuring how deeply JSON Schema validation is woven into the Node.js ecosystem's core.

The practical reading: JSON Schema is not a niche standard used by specialists - it is load-bearing infrastructure for the JavaScript ecosystem. The standard runs beneath tools that hundreds of millions of developers depend on daily.

**GitHub topic repos - `json-schema`: 2,377**

This number measures something categorically different: *intentional* usage. A developer must actively label their repository with the `json-schema` topic. This captures validators, schema libraries, tooling projects, language bindings, educational resources, and projects that build schemas as a first-class artifact.

2,377 repos is not a small number. But the contrast with 243M weekly downloads exposes the core structural challenge for the JSON Schema organisation: **the standard has massive invisible adoption and modest visible community engagement**. Most of the people depending on JSON Schema daily have no relationship with the standard itself.

**The gap is the signal.**

The ratio between npm downloads and GitHub topics - roughly 100,000:1 - represents an enormous unreached audience. Meanwhile, the PyPI downloads for `jsonschema` (95M+/week) confirm that this pattern repeats across language ecosystems, not just JavaScript. If even a fraction of the teams silently depending on these validators could be drawn into the ecosystem as contributors, documentation readers, or RFC commenters, the community would look fundamentally different. Observability work that makes this invisible adoption visible - tracking who is downloading, which validator versions, what tooling they combine it with - is the groundwork for reaching that audience.

**Combined, the metrics represent three distinct layers:**

| Layer | Metric | What it reflects |
|---|---|---|
| JS production adoption | npm weekly downloads | How embedded JSON Schema is in JavaScript infrastructure |
| Python production adoption | PyPI weekly downloads | How embedded JSON Schema is in Python infrastructure |
| Community engagement | GitHub topic repos | How many developers explicitly identify with the ecosystem |

A healthy ecosystem needs all three to grow together. Right now, the infrastructure layers are enormous across both registries and the community engagement layer is comparatively small. That is not a failure - it is a growth opportunity that observability data can help prioritize.

---

## How could this script be automated weekly?

The most direct path is a GitHub Actions workflow with a `schedule` trigger:

```yaml
# .github/workflows/collect-metrics.yml
name: Weekly Metrics Collection

on:
  schedule:
    - cron: "0 9 * * 1"   # Every Monday at 09:00 UTC
  workflow_dispatch:        # Allow manual triggers for on-demand runs

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - run: npm ci

      - run: npm start
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Commit updated metrics
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add output/metrics.json
          git commit -m "chore: weekly metrics snapshot $(date -u +%Y-%m-%d)" || echo "Nothing to commit"
          git push
```

Each run overwrites `output/metrics.json` and commits it. Over time, git history becomes the time series - every weekly commit is a data point you can `git log` or `git diff` to trace. For a proper time-series store, switch the output to an append-only `.jsonl` file (one JSON object per line per week) or maintain a rolling `metrics-history.json` array.

**One low-effort extension:** push the JSON to a GitHub Pages branch and point the chart at its stable URL. The visualization then updates itself every Monday without anyone touching a server.

---

## One technical challenge faced and how it was solved

**Challenge: 243 million and 2,377 do not belong on the same Y axis.**

On a standard linear bar chart, the GitHub repo bar is a rounding error - an invisible sliver at the base of the npm bar. This is a real data visualization problem that comes up any time you compare metrics from different domains on the same scale.

Three options I considered:

1. **Normalize both values to a 0–100 scale** - clean chart, but destroys the actual numbers, which are the whole point.
2. **Use a logarithmic Y axis** - statistically honest, but log scales require explanation and confuse most readers.
3. **Separate the insight layer from the comparison layer** - this is what I did.

The chart uses a single linear Y axis and shows both bars. The primary insight is delivered through the stat cards above the chart, where each value is formatted in its natural units (`243.8M` and `2,377`). Readers immediately understand the scale from the cards without staring at a distorted axis.

The bar chart then serves a structural purpose: it shows that these are two distinct quantities being compared, not that one is "bigger" in a meaningful absolute sense. The tooltip on hover shows the exact raw value.

This pattern - separating summary cards from a structural chart - is common in production dashboards precisely because it avoids the log-scale problem and keeps both the human-readable summary and the visual comparison intact.

A cleaner long-term solution would be a time-series chart showing weekly growth rates rather than absolute counts. A 0.1% growth in downloads and a 2% growth in repos would sit comfortably on the same axis, and growth rate is the more actionable number anyway.

---

## Limitations of These Metrics

Being honest about what a metric does *not* measure is as important as knowing what it does. These three signals have real blind spots.

**npm download counts inflate due to CI and mirroring**

Every time a CI pipeline runs `npm install`, it downloads `ajv` again. On a project with 50 developers committing daily, `ajv` might be downloaded 50+ times per day from CI alone - none of which reflects a human making a conscious choice to use JSON Schema. Package mirrors and caching proxies can further distort the count in either direction. The true number of developers who *intentionally* reach for `ajv` is unknowably smaller than 243M/week.

**GitHub topic labels are manually assigned and inconsistently applied**

A repository must have a human explicitly add the `json-schema` topic. Many projects use JSON Schema internally without tagging themselves - a company's internal API validation library, a private tooling repo, a schema-heavy monorepo. The 2,377 count is a lower bound on intentional ecosystem usage, not a complete census.

**Neither metric reflects spec compliance or correctness**

A validator can claim to support JSON Schema draft 2020-12 and implement it incorrectly. A repository tagged `json-schema` might use a draft that was superseded five years ago. These metrics count presence in the ecosystem, not quality or standards conformance. They say nothing about which draft versions are actually in use, which is arguably the most important signal for the specification itself.

**Registry data is still limited to two package registries**

The tool covers npm and PyPI, which represent the JavaScript and Python ecosystems. However, Rust's `jsonschema-rs`, Go's `gojsonschema`, and Java's `everit-json-schema` are significant ecosystem components that remain untracked. Measuring npm and PyPI gives a solid picture of the two largest user bases, but still under-represents the ecosystem's true cross-language diversity.

**These metrics do not compound into insight without a time series**

A single snapshot of 243M downloads and 2,377 repos means almost nothing in isolation. Is 2,377 growing or shrinking? Is the download count accelerating or plateauing? Without week-over-week comparison, these numbers are orientation, not intelligence. The real value of this tool emerges after running it for several months.

**Why Observability Matters to a Specification Organization**

For a specification body, ecosystem metrics are not about celebrating large numbers - they are about guiding evolution responsibly. Raw download counts or repository totals only become meaningful when interpreted in relation to version adoption, community engagement, and implementation diversity.

If validator downloads continue to grow while draft adoption remains stagnant, that may signal version inertia or migration friction. If repository counts increase while download growth plateaus, that may indicate grassroots experimentation or the emergence of specialized tooling. If implementation diversity expands across languages, it may suggest increasing cross-platform maturity.

Observability transforms ecosystem scale into governance intelligence. Instead of relying on anecdotal signals, maintainers can use measurable trends to inform roadmap decisions, deprecation timelines, documentation priorities, and community outreach strategies. Over time, consistent metric collection becomes less about the absolute numbers and more about directional change - which is ultimately what matters for the long-term health of a specification ecosystem.
