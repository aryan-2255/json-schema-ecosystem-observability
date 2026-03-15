import assert from "assert";
import { fetchNpmWeeklyDownloads } from "../src/npmMetric";
import { fetchGitHubTopicRepoCount } from "../src/githubMetric";

/**
 * Basic integration tests for the metric fetchers.
 * These hit live APIs, so they require network access.
 *
 * Run with: npm test
 */

async function testNpmDownloads(): Promise<void> {
    console.log("  [npm] Fetching weekly downloads for ajv...");
    const downloads = await fetchNpmWeeklyDownloads("ajv");

    assert.strictEqual(typeof downloads, "number", "Expected a number");
    assert(downloads > 0, "Expected a positive download count");
    assert(
        downloads > 1_000_000,
        `ajv should have >1M weekly downloads, got ${downloads}`
    );

    console.log(`  [npm] ✅ ${downloads.toLocaleString()} downloads`);
}

async function testNpmInvalidPackage(): Promise<void> {
    console.log("  [npm] Testing invalid package name...");
    try {
        await fetchNpmWeeklyDownloads("this-package-does-not-exist-999xyz");
        assert.fail("Expected an error for non-existent package");
    } catch (err: unknown) {
        assert(err instanceof Error, "Expected an Error instance");
        console.log(`  [npm] ✅ Correctly threw: ${err.message.slice(0, 60)}...`);
    }
}

async function testGitHubTopicRepos(): Promise<void> {
    console.log("  [github] Fetching repos for topic json-schema...");
    const repos = await fetchGitHubTopicRepoCount("json-schema");

    assert.strictEqual(typeof repos, "number", "Expected a number");
    assert(repos > 0, "Expected a positive repo count");
    assert(
        repos > 1_000,
        `json-schema topic should have >1K repos, got ${repos}`
    );

    console.log(`  [github] ✅ ${repos.toLocaleString()} repositories`);
}

async function testGitHubEmptyTopic(): Promise<void> {
    console.log("  [github] Fetching repos for obscure topic...");
    const repos = await fetchGitHubTopicRepoCount(
        "this-topic-should-not-exist-xyz-999"
    );

    assert.strictEqual(typeof repos, "number", "Expected a number");
    assert.strictEqual(repos, 0, "Expected 0 repos for a made-up topic");

    console.log(`  [github] ✅ Correctly returned 0 for unknown topic`);
}

// ── Runner ──

const tests = [
    { name: "npm: fetch ajv downloads", fn: testNpmDownloads },
    { name: "npm: reject invalid package", fn: testNpmInvalidPackage },
    { name: "github: fetch json-schema repos", fn: testGitHubTopicRepos },
    { name: "github: handle empty topic", fn: testGitHubEmptyTopic },
];

async function runAll(): Promise<void> {
    console.log(`\n🧪 Running ${tests.length} tests...\n`);

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            await test.fn();
            passed++;
        } catch (err: unknown) {
            failed++;
            console.error(
                `  ❌ FAIL: ${test.name}`,
                err instanceof Error ? err.message : err
            );
        }
    }

    console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

runAll();
