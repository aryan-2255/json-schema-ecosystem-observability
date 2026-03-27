import axios from "axios";

const NPM_DOWNLOADS_API = "https://api.npmjs.org/downloads/point/last-week";

// 10 seconds - enough for a public API under normal conditions
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Fetches the weekly download count for a given npm package.
 * Endpoint: https://api.npmjs.org/downloads/point/last-week/<package>
 *
 * Throws a descriptive error if the request fails or the response shape is unexpected.
 */
export async function fetchNpmWeeklyDownloads(
    packageName: string
): Promise<number> {
    const url = `${NPM_DOWNLOADS_API}/${encodeURIComponent(packageName)}`;

    try {
        const response = await axios.get<{ downloads: number; package: string }>(
            url,
            { timeout: REQUEST_TIMEOUT_MS }
        );

        const { downloads } = response.data;

        if (typeof downloads !== "number") {
            throw new Error(
                `Unexpected response shape from npm API for package "${packageName}"`
            );
        }

        return downloads;
    } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            throw new Error(
                `npm API request failed for "${packageName}": ${err.message} (status: ${err.response?.status ?? "unknown"})`
            );
        }
        throw err;
    }
}
