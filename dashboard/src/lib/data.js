import Papa from 'papaparse';

// Filename pattern: "Player Stats vs. {Opponent} {YYYY-MM-DD}_{HH-MM-SS}.csv"
const FILE_PATTERN = /^Player Stats vs\. (.+?) (\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})\.csv$/;

function parseFilename(filename) {
	const m = FILE_PATTERN.exec(filename);
	if (!m) return { opponent: filename, date: new Date(0), dateStr: '' };
	const [, opponent, dateStr] = m;
	return { opponent, date: new Date(dateStr), dateStr };
}

function parsePlayerName(raw) {
	const idx = raw.indexOf(' ');
	if (idx === -1) return { number: '', displayName: raw };
	return { number: raw.slice(0, idx), displayName: raw.slice(idx + 1) };
}

function derivePlayerRow(row) {
	const pointsPlayed = row['Points played total'] || 0;
	const touches = row['Touches'] || 0;
	const turnovers = row['Turnovers'] ?? 0;
	const distM = row['Total completed throw distance (m)'] || 0;
	return {
		...row,
		turnovers,
		touchesPerPoint: pointsPlayed > 0 ? touches / pointsPlayed : 0,
		throwDistanceYards: distM * 1.09361,
		efficiency: touches > 0 ? (1 - turnovers / touches) * 100 : null
	};
}

function accumulatePlayer(acc, row, opponent, dateStr) {
	const name = row['Player'];
	if (!name) return;

	const { number, displayName } = parsePlayerName(name);

	if (!acc[name]) {
		acc[name] = {
			name,
			displayName,
			number,
			totalPointsPlayed: 0,
			totalTouches: 0,
			totalTurnovers: 0,
			totalThrowerErrors: 0,
			totalReceiverErrors: 0,
			totalThrowDistanceYards: 0,
			totalAssists: 0,
			totalGoals: 0,
			totalBlocks: 0,
			totalThrows: 0,
			totalCatches: 0,
			touchesPerPoint: 0,
			games: []
		};
	}

	const p = acc[name];
	p.totalPointsPlayed += row['Points played total'] || 0;
	p.totalTouches += row['Touches'] || 0;
	p.totalTurnovers += row['Turnovers'] ?? 0;
	p.totalThrowerErrors += row['Thrower errors'] || 0;
	p.totalReceiverErrors += row['Receiver errors'] || 0;
	p.totalThrowDistanceYards += row.throwDistanceYards;
	p.totalAssists += row['Assists'] || 0;
	p.totalGoals += row['Goals'] || 0;
	p.totalBlocks += row['Defensive blocks'] || 0;
	p.totalThrows += row['Throws'] || 0;
	p.totalCatches += row['Catches'] || 0;

	p.games.push({ opponent, dateStr, ...row });
}

function finalisePlayerAggregates(players) {
	for (const p of Object.values(players)) {
		p.touchesPerPoint = p.totalPointsPlayed > 0 ? p.totalTouches / p.totalPointsPlayed : 0;
		p.efficiency = p.totalTouches > 0 ? (1 - p.totalTurnovers / p.totalTouches) * 100 : null;
		// Sort games by date ascending
		p.games.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));
	}
}

export async function loadAllStats() {
	const manifestRes = await fetch('/data/manifest.json');
	if (!manifestRes.ok) throw new Error('Failed to load manifest.json');
	const manifest = await manifestRes.json();

	const tournaments = {};

	for (const entry of manifest) {
		const { tournament, files } = entry;
		const games = [];
		const players = {};

		for (const filename of files) {
			const { opponent, date, dateStr } = parseFilename(filename);
			const url = `/data/${tournament}/${encodeURIComponent(filename)}`;

			const res = await fetch(url);
			if (!res.ok) {
				console.warn(`Failed to fetch ${url}`);
				continue;
			}
			const text = await res.text();

			const result = Papa.parse(text, {
				header: true,
				dynamicTyping: true,
				skipEmptyLines: true
			});

			const playerRows = result.data.map(derivePlayerRow);

			games.push({ tournament, opponent, date, dateStr, players: playerRows });

			for (const row of playerRows) {
				accumulatePlayer(players, row, opponent, dateStr);
			}
		}

		// Sort games by date ascending
		games.sort((a, b) => a.date - b.date);

		finalisePlayerAggregates(players);

		tournaments[tournament] = { games, players };
	}

	return { tournaments };
}
