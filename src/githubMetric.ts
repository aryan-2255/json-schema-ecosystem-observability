import axios from "axios";

const GITHUB_SEARCH_API = "https://api.github.com/search/repositories";

// 10 seconds — enough for a public API under normal conditions
const REQUEST_TIMEOUT_MS = 10_000;

// Warn when fewer than this many requests remain in the current rate-limit window
const RATE_LIMIT_WARNING_THRESHOLD = 5;

// Build request headers. If GITHUB_TOKEN is set, attach it to raise rate limits
// from 10 req/min (anonymous) to 30 req/min (authenticated).
function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "json-schema-observability-cli/1.0.0",
        "X-GitHub-Api-Version": "2022-11-28",
    };

    if (process.env.GITHUB_TOKEN) {
        headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    return headers;
}

/**
 * Parses the X-RateLimit-Reset header (a Unix timestamp in seconds)
 * and returns a human-readable local time string.
 */
function formatResetTime(resetHeader: string | undefined): string {
    if (!resetHeader) return "unknown";
    const resetAt = new Date(parseInt(resetHeader, 10) * 1000);
    return resetAt.toLocaleTimeString();
}

/**
 * Safely reads a response header value as a plain string.
 * Axios types headers as AxiosHeaderValue (string | string[] | number | null),
 * so we normalise to string | undefined before any further use.
 */
function headerAsString(
    headers: Record<string, unknown>,
    key: string
): string | undefined {
    const val = headers[key];
    return val != null ? String(val) : undefined;
}

/**
 * Fetches the total number of GitHub repositories tagged with a given topic.
 * Endpoint: https://api.github.com/search/repositories?q=topic:<topic>
 *
 * After a successful request, logs a warning if the remaining rate-limit
 * quota is low. On a 403 or 429, surfaces the exact reset time so the
 * caller knows when to retry.
 */
export async function fetchGitHubTopicRepoCount(
    topic: string
): Promise<number> {
    const url = `${GITHUB_SEARCH_API}?q=topic:${encodeURIComponent(topic)}&per_page=1`;

    try {
        const response = await axios.get<{ total_count: number }>(url, {
            headers: buildHeaders(),
            timeout: REQUEST_TIMEOUT_MS,
        });

        const { total_count } = response.data;

        if (typeof total_count !== "number") {
            throw new Error(
                `Unexpected response shape from GitHub Search API for topic "${topic}"`
            );
        }

        // Warn proactively if quota is running low so the caller isn't surprised next run
        const responseHeaders = response.headers as Record<string, unknown>;
        const remaining = headerAsString(responseHeaders, "x-ratelimit-remaining");
        if (remaining !== undefined && parseInt(remaining, 10) < RATE_LIMIT_WARNING_THRESHOLD) {
            const resetTime = formatResetTime(
                headerAsString(responseHeaders, "x-ratelimit-reset")
            );
            console.warn(
                `  ⚠️  GitHub rate limit low: ${remaining} requests remaining (resets at ${resetTime}). ` +
                `Set GITHUB_TOKEN to increase limits.`
            );
        }

        return total_count;
    } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            const errHeaders = (err.response?.headers ?? {}) as Record<string, unknown>;

            // 403 = primary rate limit exceeded; 429 = secondary (burst) rate limit
            if (status === 403 || status === 429) {
                const resetTime = formatResetTime(
                    headerAsString(errHeaders, "x-ratelimit-reset")
                );
                throw new Error(
                    `GitHub rate limit exceeded (HTTP ${status}). ` +
                    `Resets at ${resetTime}. ` +
                    `Set a GITHUB_TOKEN environment variable to raise your quota.`
                );
            }

            throw new Error(
                `GitHub API request failed for topic "${topic}": ${err.message} (status: ${status ?? "unknown"})`
            );
        }
        throw err;
    }
}
