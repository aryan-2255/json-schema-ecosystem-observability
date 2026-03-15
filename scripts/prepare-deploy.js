/**
 * Prepares the public/ directory for Vercel deployment.
 *
 * 1. Copies visualization/chart.html → public/index.html
 *    (adjusts the fetch path so it reads metrics.json from the same directory)
 * 2. Copies output/metrics.json → public/metrics.json
 *
 * Run with:  npm run prepare-deploy
 * Vercel runs this automatically via the buildCommand in vercel.json.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

// Ensure public/ exists
if (!fs.existsSync(PUBLIC)) {
    fs.mkdirSync(PUBLIC, { recursive: true });
}

// 1. Copy chart.html → public/index.html with adjusted fetch path
const chartSrc = path.join(ROOT, "visualization", "chart.html");
let html = fs.readFileSync(chartSrc, "utf-8");
html = html.replace(
    "fetch('../output/metrics.json')",
    "fetch('./metrics.json')"
);
fs.writeFileSync(path.join(PUBLIC, "index.html"), html, "utf-8");

// 2. Copy metrics snapshot
const metricsSrc = path.join(ROOT, "output", "metrics.json");
if (fs.existsSync(metricsSrc)) {
    fs.copyFileSync(metricsSrc, path.join(PUBLIC, "metrics.json"));
}

console.log("✅ public/ prepared for deployment");
