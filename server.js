import express from "express";
import fetch from "node-fetch";
import compression from "compression";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import cors from "cors";
import * as cheerio from "cheerio";
import { fileURLToPath } from "url";

// ES module path fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(compression());
app.use(cors({ origin: "*" }));

const PORT = process.env.PORT || 8080;

// Cache folder
const CACHE_DIR = path.resolve(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// Helper: fetch and convert the latest radar image
async function fetchLatestRadar() {
  try {
    const baseUrl = "https://mrms.ncep.noaa.gov/2D/ReflectivityAtLowestAltitude/";
    console.log("Fetching directory list...");

    const html = await fetch(baseUrl).then((res) => res.text());
    const $ = cheerio.load(html);

    const links = $("a")
      .map((_, el) => $(el).attr("href"))
      .get()
      .filter((href) => href && href.endsWith(".grib2.gz"))
      .sort();

    const latest = links.at(-1);
    if (!latest) throw new Error("No radar files found.");

    const fileUrl = `${baseUrl}${latest}`;
    console.log("Latest MRMS file:", fileUrl);

    const gzPath = path.join(CACHE_DIR, "latest.grib2.gz");
    const pngPath = path.join(CACHE_DIR, "latest.png");

    // Download file
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`Failed to download file: ${res.statusText}`);

    const buffer = await res.arrayBuffer();
    fs.writeFileSync(gzPath, Buffer.from(buffer));

    // Convert to PNG using GDAL (must be installed in your runtime)
    execSync(`gunzip -c "${gzPath}" | gdal_translate -of PNG /vsistdin/ "${pngPath}"`);

    console.log("✅ Radar updated!");
    return pngPath;
  } catch (err) {
    console.error("❌ Radar fetch failed:", err.message);
    return null;
  }
}

// Serve latest radar image
app.get("/api/radar/latest", async (req, res) => {
  const pngPath = path.join(CACHE_DIR, "latest.png");
  // if (!fs.existsSync(pngPath)) {
    const updated = await fetchLatestRadar();
    if (!updated) return res.status(500).json({ error: "Failed to fetch radar" });
  // }
  res.sendFile(pngPath);
});

// Force refresh endpoint
app.get("/api/radar/refresh", async (req, res) => {
  const updated = await fetchLatestRadar();
  if (updated) res.json({ message: "Radar refreshed" });
  else res.status(500).json({ error: "Failed to refresh radar" });
});

app.get("/", (req, res) => {
  res.send("✅ MRMS Radar API is running!");
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
