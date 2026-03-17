import axios from "axios";

const PYPISTATS_API = "https://pypistats.org/api/packages";

// 15 seconds — PyPI Stats API can be slow under load
const REQUEST_TIMEOUT_MS = 15_000;

// Retry configuration — PyPI Stats API imposes aggressive rate limits
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2_000;

/**
 * Pause execution for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches the weekly download count for a given PyPI package.
 * Endpoint: https://pypistats.org/api/packages/<package>/recent
 *
 * Implements exponential backoff for 429 (rate-limit) responses.
 * Returns the "last_week" field from the PyPI Stats API.
 * Throws a descriptive error if all retries are exhausted.
 */
export async function fetchPyPIWeeklyDownloads(
    packageName: string
): Promise<number> {
    const url = `${PYPISTATS_API}/${encodeURIComponent(packageName)}/recent`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
            const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
            console.log(`    ⏳ PyPI rate-limited, retrying in ${backoff / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);
            await sleep(backoff);
        }

        try {
            const response = await axios.get<{ data: { last_week: number } }>(url, {
                timeout: REQUEST_TIMEOUT_MS,
                headers: { "User-Agent": "json-schema-observability-cli/1.0.0" },
            });

            const lastWeek = response.data?.data?.last_week;

            if (typeof lastWeek !== "number") {
                throw new Error(
                    `Unexpected response shape from PyPI stats API for "${packageName}"`
                );
            }

            return lastWeek;
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.status === 429) {
                lastError = new Error(
                    `PyPI API rate-limited for "${packageName}" (attempt ${attempt + 1})`
                );
                continue; // retry
            }

            if (axios.isAxiosError(err)) {
                throw new Error(
                    `PyPI API request failed for "${packageName}": ${err.message} (status: ${err.response?.status ?? "unknown"})`
                );
            }
            throw err;
        }
    }

    throw lastError ?? new Error(`PyPI API failed for "${packageName}" after ${MAX_RETRIES + 1} attempts`);
}
