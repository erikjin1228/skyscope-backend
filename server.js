import express from "express";
import fetch from "node-fetch";
import compression from "compression";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import cors from "cors";
import * as cheerio from "cheerio";

const app = express();
app.use(compression());
app.use(cors({ origin: "*" }));

const PORT = process.env.PORT || 8080;

// Temporary cache folder
const CACHE_DIR = path.resolve("./cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

// Function to download and convert latest MRMS RALA radar file
async function fetchLatestRadar() {
  try {
    const baseUrl = "https://mrms.ncep.noaa.gov/2D/ReflectivityAtLowestAltitude/";
    console.log("Fetching directory list...");
    const html = await fetch(baseUrl).then((res) => res.text());

    // Parse the directory HTML
    const $ = cheerio.load(html);
    const links = [];
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (href && href.endsWith(".grib2.gz")) links.push(href);
    });

    // Sort by timestamp (last file is latest)
    const latest = links.sort().at(-1);
    if (!latest) throw new Error("No radar files found");

    const fileUrl = `${baseUrl}${latest}`;
    console.log("Latest MRMS file:", fileUrl);

    const gzPath = path.join(CACHE_DIR, "latest.grib2.gz");
    const pngPath = path.join(CACHE_DIR, "latest.png");

    // Download latest file
    const res = await fetch(fileUrl);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(gzPath, Buffer.from(buffer));

    // Convert to PNG with GDAL
    execSync(`gunzip -c ${gzPath} | gdal_translate -of PNG /vsistdin/ ${pngPath}`);

    console.log("Radar updated!");
    return pngPath;
  } catch (err) {
    console.error("Radar fetch failed:", err.message);
    return null;
  }
}

// Serve latest radar image
app.get("/api/radar/latest", async (req, res) => {
  const pngPath = path.join(CACHE_DIR, "latest.png");
//   if (!fs.existsSync(pngPath)) {
    const updated = await fetchLatestRadar();
    if (!updated) return res.status(500).json({ error: "Failed to fetch radar" });
//   }
  res.sendFile(pngPath);
});

// Optional: force refresh
app.get("/api/radar/refresh", async (req, res) => {
  const updated = await fetchLatestRadar();
  if (updated) res.json({ message: "Radar refreshed" });
  else res.status(500).json({ error: "Failed to refresh radar" });
});

app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
