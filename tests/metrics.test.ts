import { fetchNpmWeeklyDownloads } from "../src/npmMetric";
import { fetchGitHubTopicRepoCount } from "../src/githubMetric";
import { fetchPyPIWeeklyDownloads } from "../src/pypiMetric";
import fs from "fs";
import path from "path";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
    try {
        await fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (err: unknown) {
        console.log(`  ❌ ${name}`);
        console.log(`     ${err instanceof Error ? err.message : String(err)}`);
        failed++;
    }
}

function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
    console.log("\nRunning tests...\n");

    console.log("npm metric:");

    await test("fetchNpmWeeklyDownloads returns a positive number", async () => {
        const downloads = await fetchNpmWeeklyDownloads("ajv");
        assert(typeof downloads === "number", `Expected number, got ${typeof downloads}`);
        assert(downloads > 0, `Expected positive downloads, got ${downloads}`);
    });

    await test("fetchNpmWeeklyDownloads throws on invalid package", async () => {
        let threw = false;
        try {
            await fetchNpmWeeklyDownloads("this-package-definitely-does-not-exist-abc123xyz");
        } catch {
            threw = true;
        }
        assert(threw, "Expected an error for a nonexistent package");
    });

    console.log("\nGitHub metric:");

    await test("fetchGitHubTopicRepoCount returns a positive number", async () => {
        const count = await fetchGitHubTopicRepoCount("json-schema");
        assert(typeof count === "number", `Expected number, got ${typeof count}`);
        assert(count > 0, `Expected positive count, got ${count}`);
    });

    console.log("\nPyPI metric:");

    await test("fetchPyPIWeeklyDownloads returns a positive number", async () => {
        const downloads = await fetchPyPIWeeklyDownloads("jsonschema");
        assert(typeof downloads === "number", `Expected number, got ${typeof downloads}`);
        assert(downloads > 0, `Expected positive downloads, got ${downloads}`);
    });

    console.log("\nOutput file:");

    await test("output/metrics.json exists and has valid structure", async () => {
        const outputPath = path.resolve(__dirname, "../output/metrics.json");
        assert(fs.existsSync(outputPath), "metrics.json does not exist - run npm start first");

        const raw = fs.readFileSync(outputPath, "utf-8");
        const data = JSON.parse(raw);

        assert(typeof data.timestamp === "string", "Missing timestamp field");
        assert(Array.isArray(data.metrics), "metrics should be an array");
        assert(data.metrics.length === 3, `Expected 3 metrics, got ${data.metrics.length}`);

        for (const metric of data.metrics) {
            assert(typeof metric.name === "string", "Each metric needs a name");
            assert(typeof metric.value === "number", "Each metric needs a numeric value");
            assert(typeof metric.source === "string", "Each metric needs a source");
            assert(typeof metric.description === "string", "Each metric needs a description");
        }
    });

    await test("metrics.json contains expected metric names", async () => {
        const outputPath = path.resolve(__dirname, "../output/metrics.json");
        const data = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
        const names = data.metrics.map((m: { name: string }) => m.name);

        assert(names.includes("ajv_weekly_downloads"), "Missing ajv_weekly_downloads");
        assert(names.includes("github_json_schema_topic_repos"), "Missing github_json_schema_topic_repos");
        assert(names.includes("pypi_jsonschema_weekly_downloads"), "Missing pypi_jsonschema_weekly_downloads");
    });

    console.log(`\n${"─".repeat(40)}`);
    console.log(`  ${passed} passed, ${failed} failed`);

    if (failed > 0) {
        process.exit(1);
    }
}

run().catch((err: unknown) => {
    console.error("\nTest runner crashed:");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
