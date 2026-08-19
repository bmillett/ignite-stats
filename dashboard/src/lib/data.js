import Papa from 'papaparse';

// Filename pattern: "Player Stats vs. {Opponent} {YYYY-MM-DD}_{HH-MM-SS}.csv"
const FILE_PATTERN = /^(?:Player Stats|Points) vs\. (.+?) (\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})\.csv$/;

function parseFilename(filename) {
	const m = FILE_PATTERN.exec(filename);
	if (!m) return { opponent: filename, date: new Date(0), dateStr: '' };
	const [, opponent, dateStr] = m;
	return { opponent, date: new Date(dateStr), dateStr };
}

// Derive hold/break performance metrics from an array of point rows.
function deriveGamePerformance(pointRows) {
	let holds = 0, cleanHolds = 0, holdOpportunities = 0;
	let breaks = 0, cleanBreaks = 0, breakOpportunities = 0;
	// D-line points where we generated at least one turnover (block or opp error)
	let dPointsWithTurnoverForced = 0;
	let totalTurnovers = 0, totalPoints = pointRows.length;
	// Opponent turnovers forced: blocks + opposition errors, split by line
	let oppTurnoversOnOLine = 0, oppTurnoversOnDLine = 0;

	for (const row of pointRows) {
		const onOffense  = row['Started on offense?'] === 1;
		const scored     = row['Scored?'] === 1;
		const tos        = row['Turnovers'] || 0;
		const blocks     = row['Defensive blocks'] || 0;
		const oppErrors  = row['Opposition errors'] || 0;
		const oppTos     = blocks + oppErrors;
		totalTurnovers  += tos;

		if (onOffense) {
			holdOpportunities++;
			oppTurnoversOnOLine += oppTos;
			if (scored) {
				holds++;
				if (tos === 0) cleanHolds++;
			}
		} else {
			breakOpportunities++;
			oppTurnoversOnDLine += oppTos;
			if (oppTos > 0) dPointsWithTurnoverForced++;
			if (scored) {
				breaks++;
				if (tos === 0) cleanBreaks++;
			}
		}
	}

	return {
		holds, cleanHolds, holdOpportunities,
		breaks, cleanBreaks, breakOpportunities,
		dPointsWithTurnoverForced,
		totalTurnovers, totalPoints,
		oppTurnoversOnOLine, oppTurnoversOnDLine,
		oppTurnoversTotal: oppTurnoversOnOLine + oppTurnoversOnDLine,
		turnoversPerPoint: totalPoints > 0 ? totalTurnovers / totalPoints : 0,
		holdPct:  holdOpportunities  > 0 ? (holds  / holdOpportunities)  * 100 : null,
		breakPct: breakOpportunities > 0 ? (breaks / breakOpportunities) * 100 : null,
		dTurnoverForcedPct: breakOpportunities > 0 ? (dPointsWithTurnoverForced / breakOpportunities) * 100 : null,
		points: pointRows
	};
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

async function fetchCsv(url) {
	const res = await fetch(url);
	if (!res.ok) { console.warn(`Failed to fetch ${url}`); return null; }
	const text = await res.text();
	return Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
}

export async function loadAllStats() {
	const manifestRes = await fetch('/data/manifest.json');
	if (!manifestRes.ok) throw new Error('Failed to load manifest.json');
	const manifest = await manifestRes.json();

	const tournaments = {};

	for (const entry of manifest) {
		const { tournament, files, pointsFiles = [] } = entry;
		const games = [];
		const players = {};

		// Build a lookup: opponent+dateStr -> points performance, keyed by dateStr
		const performanceByDateStr = {};
		for (const filename of pointsFiles) {
			const { opponent, dateStr } = parseFilename(filename);
			const url = `/data/${tournament}/${encodeURIComponent(filename)}`;
			const rows = await fetchCsv(url);
			if (rows) performanceByDateStr[dateStr] = { opponent, ...deriveGamePerformance(rows) };
		}

		for (const filename of files) {
			const { opponent, date, dateStr } = parseFilename(filename);
			const url = `/data/${tournament}/${encodeURIComponent(filename)}`;

			const rows = await fetchCsv(url);
			if (!rows) continue;

			const playerRows = rows.map(derivePlayerRow);
			const performance = performanceByDateStr[dateStr] ?? null;

			games.push({ tournament, opponent, date, dateStr, players: playerRows, performance });

			for (const row of playerRows) {
				accumulatePlayer(players, row, opponent, dateStr);
			}
		}

		// Sort games by date ascending
		games.sort((a, b) => a.date - b.date);

		finalisePlayerAggregates(players);

		// Aggregate tournament-level performance
		const tournamentPerformance = aggregateTournamentPerformance(
			games.map((g) => g.performance).filter(Boolean)
		);

		tournaments[tournament] = { games, players, performance: tournamentPerformance };
	}

	return { tournaments };
}

function aggregateTournamentPerformance(gamePerfs) {
	const agg = {
		holds: 0, cleanHolds: 0, holdOpportunities: 0,
		breaks: 0, cleanBreaks: 0, breakOpportunities: 0,
		dPointsWithTurnoverForced: 0,
		totalTurnovers: 0, totalPoints: 0,
		oppTurnoversOnOLine: 0, oppTurnoversOnDLine: 0
	};
	for (const p of gamePerfs) {
		agg.holds                     += p.holds;
		agg.cleanHolds                += p.cleanHolds;
		agg.holdOpportunities         += p.holdOpportunities;
		agg.breaks                    += p.breaks;
		agg.cleanBreaks               += p.cleanBreaks;
		agg.breakOpportunities        += p.breakOpportunities;
		agg.dPointsWithTurnoverForced += p.dPointsWithTurnoverForced;
		agg.totalTurnovers            += p.totalTurnovers;
		agg.totalPoints               += p.totalPoints;
		agg.oppTurnoversOnOLine       += p.oppTurnoversOnOLine;
		agg.oppTurnoversOnDLine       += p.oppTurnoversOnDLine;
	}
	agg.oppTurnoversTotal   = agg.oppTurnoversOnOLine + agg.oppTurnoversOnDLine;
	agg.turnoversPerPoint   = agg.totalPoints > 0 ? agg.totalTurnovers / agg.totalPoints : 0;
	agg.holdPct             = agg.holdOpportunities  > 0 ? (agg.holds  / agg.holdOpportunities)  * 100 : null;
	agg.breakPct            = agg.breakOpportunities > 0 ? (agg.breaks / agg.breakOpportunities) * 100 : null;
	agg.dTurnoverForcedPct  = agg.breakOpportunities > 0 ? (agg.dPointsWithTurnoverForced / agg.breakOpportunities) * 100 : null;
	return agg;
}
