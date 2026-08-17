#!/usr/bin/env node
/**
 * scripts/build-manifest.js
 *
 * Walks static/data/, groups CSV files by sub-folder (tournament), and
 * writes static/data/manifest.json.
 *
 * Run with:  node scripts/build-manifest.js
 *        or: npm run manifest
 */

import { readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dataDir = resolve(__dirname, '../static/data');
const outFile = join(dataDir, 'manifest.json');

const entries = [];

for (const entry of readdirSync(dataDir)) {
	const entryPath = join(dataDir, entry);
	if (!statSync(entryPath).isDirectory()) continue;

	const csvFiles = readdirSync(entryPath)
		.filter((f) => f.endsWith('.csv'))
		.sort(); // deterministic order

	if (csvFiles.length === 0) continue;

	entries.push({ tournament: entry, files: csvFiles });
}

// Sort tournaments alphabetically for a stable output
entries.sort((a, b) => a.tournament.localeCompare(b.tournament));

writeFileSync(outFile, JSON.stringify(entries, null, 2) + '\n', 'utf8');

console.log(`Written ${outFile}`);
for (const e of entries) {
	console.log(`  ${e.tournament}: ${e.files.length} game(s)`);
}
