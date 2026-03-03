import fs from "fs";
import path from "path";
import { fetchNpmWeeklyDownloads } from "./npmMetric";
import { fetchGitHubTopicRepoCount } from "./githubMetric";

// Metric 1: npm weekly downloads for the ajv JSON Schema validator
const NPM_PACKAGE = "ajv";

// Metric 2: count of GitHub repositories tagged with the json-schema topic
const GITHUB_TOPIC = "json-schema";

const OUTPUT_DIR = path.resolve(__dirname, "../output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "metrics.json");

// Each metric is self-describing: name, value, source, and a plain-English description.
// This makes the JSON file readable on its own and easy to extend with new metrics.
interface Metric {
    name: string;
    value: number;
    source: string;
    description: string;
}

interface MetricsOutput {
    timestamp: string;
    metrics: Metric[];
}

function ensureOutputDir(): void {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
}

function writeMetrics(data: MetricsOutput): void {
    ensureOutputDir();
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), "utf-8");
    console.log(`\n✅ Metrics written to ${OUTPUT_FILE}`);
}

async function main(): Promise<void> {
    console.log("🔍 Fetching JSON Schema ecosystem metrics...\n");

    // Both API calls are independent — run them in parallel
    const [npmDownloads, githubRepos] = await Promise.all([
        fetchNpmWeeklyDownloads(NPM_PACKAGE).then((count) => {
            console.log(`  📦 ajv weekly downloads: ${count.toLocaleString()}`);
            return count;
        }),
        fetchGitHubTopicRepoCount(GITHUB_TOPIC).then((count) => {
            console.log(
                `  🐙 GitHub repos with topic "${GITHUB_TOPIC}": ${count.toLocaleString()}`
            );
            return count;
        }),
    ]);

    const output: MetricsOutput = {
        timestamp: new Date().toISOString(),
        metrics: [
            {
                name: "ajv_weekly_downloads",
                value: npmDownloads,
                source: "npm",
                description: "Weekly download count for the ajv JSON Schema validator",
            },
            {
                name: "github_json_schema_topic_repos",
                value: githubRepos,
                source: "github",
                description:
                    "Number of public GitHub repositories tagged with the json-schema topic",
            },
        ],
    };

    writeMetrics(output);
}

main().catch((err: unknown) => {
    console.error("\n❌ Error collecting metrics:");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
