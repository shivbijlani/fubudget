#!/usr/bin/env node
// Turns a plan JSON file into a fubudget share link.
// Usage: node scripts/encode-plan.mjs path/to/plan.json [baseUrl]
// The JSON may be a bare params object or a { "version": 1, "params": {...} } payload.
import fs from "node:fs";
import zlib from "node:zlib";

const [file, baseUrl = "https://fubudget.com/"] = process.argv.slice(2);
if (!file) {
  console.error("Usage: node scripts/encode-plan.mjs path/to/plan.json [baseUrl]");
  process.exit(1);
}

const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
const payload = typeof parsed.version === "number" ? parsed : { version: 1, params: parsed };
// Level 6, not 9: Chrome's DecompressionStream rejects the level-9 stream,
// so links built at level 9 fall back to demo data in a real browser.
// Level 6 matches what the app's own encoder (CompressionStream) produces.
const compressed = zlib.deflateRawSync(Buffer.from(JSON.stringify(payload), "utf8"), { level: 6 });
const encoded = "z1." + compressed.toString("base64url");

const url = new URL(baseUrl);
url.searchParams.set("plan", encoded);
process.stdout.write(url.toString() + "\n");
