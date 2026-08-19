<script>
	import { page } from '$app/stores';
	import { Line } from 'svelte-chartjs';
	import {
		Chart,
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		Title,
		Tooltip,
		Legend,
		Filler
	} from 'chart.js';
	import { statsStore, selectedTournaments } from '$lib/stores.js';

	Chart.register(
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		Title,
		Tooltip,
		Legend,
		Filler
	);

	let stats = $state(null);
	let selected = $state([]);

	$effect(() => {
		const unsubStats = statsStore.subscribe((v) => (stats = v));
		const unsubSel = selectedTournaments.subscribe((v) => (selected = v));
		return () => {
			unsubStats();
			unsubSel();
		};
	});

	// Decode the player name from the URL param
	let playerName = $derived(decodeURIComponent($page.params.name));

	// Collect all per-game rows for this player across selected tournaments,
	// sorted by date ascending (used for the line chart).
	let gameRows = $derived.by(() => {
		if (!stats) return [];
		const rows = [];
		// If no tournaments selected, search all
		const targets = selected.length > 0 ? selected : Object.keys(stats.tournaments);
		for (const t of targets) {
			const tourney = stats.tournaments[t];
			if (!tourney) continue;
			const player = tourney.players[playerName];
			if (!player) continue;
			for (const g of player.games) {
				rows.push({ ...g, tournamentName: t });
			}
		}
		rows.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));
		return rows;
	});

	// Same rows sorted by touches descending for the table.
	let tableRows = $derived(
		[...gameRows].sort((a, b) => (b['Touches'] || 0) - (a['Touches'] || 0))
	);

	// Summary stat cards
	let summary = $derived.by(() => {
		if (gameRows.length === 0)
			return {
				totalTouches: 0, totalTurnovers: 0, avgTouchesPerPoint: 0,
				efficiency: null, totalThrowDistYards: 0, totalAssists: 0,
				totalGoals: 0, totalBlocks: 0, totalPointsPlayed: 0,
				totalThrows: 0, totalThrowerErrors: 0, throwAccuracy: null
			};

		let totalTouches = 0, totalTurnovers = 0, totalThrowDistYards = 0,
			totalAssists = 0, totalGoals = 0, totalBlocks = 0,
			totalPointsPlayed = 0, totalThrows = 0, totalThrowerErrors = 0;

		for (const g of gameRows) {
			totalTouches       += g['Touches'] || 0;
			totalTurnovers     += g['Turnovers'] ?? 0;
			totalThrowDistYards+= g.throwDistanceYards || 0;
			totalAssists       += g['Assists'] || 0;
			totalGoals         += g['Goals'] || 0;
			totalBlocks        += g['Defensive blocks'] || 0;
			totalPointsPlayed  += g['Points played total'] || 0;
			totalThrows        += g['Throws'] || 0;
			totalThrowerErrors += g['Thrower errors'] || 0;
		}

		const avgTouchesPerPoint = totalPointsPlayed > 0 ? totalTouches / totalPointsPlayed : 0;
		const efficiency         = totalTouches > 0 ? (1 - totalTurnovers / totalTouches) * 100 : null;
		const throwAccuracy      = totalThrows  > 0 ? (1 - totalThrowerErrors / totalThrows) * 100 : null;

		return {
			totalTouches, totalTurnovers, avgTouchesPerPoint, efficiency,
			totalThrowDistYards, totalAssists, totalGoals, totalBlocks,
			totalPointsPlayed, totalThrows, totalThrowerErrors, throwAccuracy
		};
	});

	// Line chart: touches/point per game
	let chartData = $derived.by(() => {
		const labels = gameRows.map((g) => `vs ${g.opponent}\n${g.dateStr}`);
		const tpp = gameRows.map((g) => {
			const pts = g['Points played total'] || 0;
			const touches = g['Touches'] || 0;
			return pts > 0 ? +(touches / pts).toFixed(3) : 0;
		});
		return {
			labels,
			datasets: [
				{
					label: 'Touches / Point',
					data: tpp,
					borderColor: '#3b82f6',
					backgroundColor: 'rgba(59,130,246,0.15)',
					pointBackgroundColor: '#3b82f6',
					tension: 0.3,
					fill: true
				}
			]
		};
	});

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				labels: { color: '#e2e8f0' }
			}
		},
		scales: {
			x: {
				ticks: { color: '#94a3b8', maxRotation: 45 },
				grid: { color: 'rgba(255,255,255,0.1)' }
			},
			y: {
				beginAtZero: true,
				ticks: { color: '#94a3b8' },
				grid: { color: 'rgba(255,255,255,0.1)' }
			}
		}
	};

	// Display name + number from the player key
	let displayName = $derived.by(() => {
		if (!stats) return playerName;
		for (const t of Object.keys(stats.tournaments)) {
			const p = stats.tournaments[t].players[playerName];
			if (p) return p.displayName;
		}
		return playerName;
	});

	let jerseyNumber = $derived.by(() => {
		if (!stats) return '';
		for (const t of Object.keys(stats.tournaments)) {
			const p = stats.tournaments[t].players[playerName];
			if (p) return p.number;
		}
		return '';
	});

	let loading = $derived(stats === null);
	let notFound = $derived(!loading && gameRows.length === 0);

	const TO_THRESHOLD = 3;
	const EFF_HIGH = 90;
	const EFF_MID = 80;

	function calcEfficiency(touches, turnovers) {
		return touches > 0 ? (1 - turnovers / touches) * 100 : null;
	}
</script>

<svelte:head>
	<title>{displayName} — Player Stats</title>
</svelte:head>

<div class="page">
	<header>
		<a class="back" href="/leaderboard">← Back to Leaderboard</a>
		<h1>
			{#if jerseyNumber}<span class="jersey">#{jerseyNumber}</span>{/if}
			{displayName}
		</h1>
	</header>

	{#if loading}
		<p class="muted">Loading stats…</p>
	{:else if notFound}
		<p class="muted">No data found for <strong>{playerName}</strong>. <a href="/leaderboard">Back to leaderboard</a>.</p>
	{:else}
		<!-- Summary stat cards -->
		<section class="cards">
			<div class="card">
				<span class="card-label">Touches</span>
				<span class="card-value accent">{summary.totalTouches}</span>
			</div>
			<div class="card">
				<span class="card-label">Turnovers</span>
				<span class="card-value" class:high-to={summary.totalTurnovers > TO_THRESHOLD}>{summary.totalTurnovers}</span>
			</div>
			<div class="card">
				<span class="card-label">Throws</span>
				<span class="card-value">{summary.totalThrows}</span>
			</div>
			<div class="card">
				<span class="card-label">Throw Acc %</span>
				<span class="card-value"
					class:good-eff={summary.throwAccuracy !== null && summary.throwAccuracy >= 90}
					class:mid-eff={summary.throwAccuracy !== null && summary.throwAccuracy >= 80 && summary.throwAccuracy < 90}
					class:low-eff={summary.throwAccuracy !== null && summary.throwAccuracy < 80}
				>{summary.throwAccuracy !== null ? summary.throwAccuracy.toFixed(1) + '%' : '—'}</span>
			</div>
			<div class="card">
				<span class="card-label">Efficiency</span>
				<span class="card-value"
					class:good-eff={summary.efficiency !== null && summary.efficiency >= EFF_HIGH}
					class:mid-eff={summary.efficiency !== null && summary.efficiency >= EFF_MID && summary.efficiency < EFF_HIGH}
					class:low-eff={summary.efficiency !== null && summary.efficiency < EFF_MID}
				>{summary.efficiency !== null ? summary.efficiency.toFixed(1) + '%' : '—'}</span>
			</div>
			<div class="card">
				<span class="card-label">Avg T/Point</span>
				<span class="card-value">{summary.avgTouchesPerPoint.toFixed(2)}</span>
			</div>
			<div class="card">
				<span class="card-label">Throw Dist</span>
				<span class="card-value">{summary.totalThrowDistYards.toFixed(1)} <small>yds</small></span>
			</div>
			<div class="card">
				<span class="card-label">Assists</span>
				<span class="card-value">{summary.totalAssists}</span>
			</div>
			<div class="card">
				<span class="card-label">Goals</span>
				<span class="card-value">{summary.totalGoals}</span>
			</div>
			<div class="card">
				<span class="card-label">Blocks</span>
				<span class="card-value">{summary.totalBlocks}</span>
			</div>
			<div class="card">
				<span class="card-label">Pts Played</span>
				<span class="card-value">{summary.totalPointsPlayed}</span>
			</div>
		</section>

		<!-- Touches/Point line chart -->
		<section class="chart-section">
			<h2>Touches per Point — Game by Game</h2>
			<div class="chart-wrapper">
				<Line data={chartData} options={chartOptions} />
			</div>
		</section>

		<!-- Per-game table -->
		<section class="table-section">
			<h2>Game-by-Game Breakdown</h2>
			<div class="table-scroll">
				<table>
					<thead>
						<tr>
							<th class="left">Opponent</th>
							<th class="left">Date</th>
							<th>Pts Played</th>
							<th>Touches</th>
							<th>Turnovers</th>
							<th>Throws</th>
							<th class="sub">Thrower Err</th>
							<th class="sub">Throw Acc %</th>
							<th class="sub">Receiver Err</th>
							<th>Efficiency</th>
							<th>T/Point</th>
							<th>Throw Dist (yds)</th>
							<th>Assists</th>
							<th>Goals</th>
							<th>Blocks</th>
						</tr>
					</thead>
					<tbody>
						{#each tableRows as g}
							{@const pts = g['Points played total'] || 0}
							{@const touches = g['Touches'] || 0}
							{@const throws = g['Throws'] || 0}
							{@const tpp = pts > 0 ? touches / pts : 0}
							{@const turnovers = g['Turnovers'] ?? 0}
							{@const throwerErr = g['Thrower errors'] || 0}
							{@const throwAccuracy = throws > 0 ? (1 - throwerErr / throws) * 100 : null}
							{@const eff = calcEfficiency(touches, turnovers)}
							<tr>
								<td class="left">vs {g.opponent}</td>
								<td class="left">{g.dateStr}</td>
								<td>{pts}</td>
								<td class="accent">{touches}</td>
								<td class:high-to={turnovers > TO_THRESHOLD}>{turnovers}</td>
								<td>{throws}</td>
								<td class="sub">{throwerErr}</td>
								<td class="sub"
									class:good-eff={throwAccuracy !== null && throwAccuracy >= 90}
									class:mid-eff={throwAccuracy !== null && throwAccuracy >= 80 && throwAccuracy < 90}
									class:low-eff={throwAccuracy !== null && throwAccuracy < 80}
								>{throwAccuracy !== null ? throwAccuracy.toFixed(1) + '%' : '—'}</td>
								<td class="sub">{g['Receiver errors'] ?? 0}</td>
								<td class="efficiency"
									class:mid-eff={eff !== null && eff >= EFF_MID && eff < EFF_HIGH}
									class:low-eff={eff !== null && eff < EFF_MID}
								>{eff !== null ? eff.toFixed(1) + '%' : '—'}</td>
								<td>{tpp.toFixed(2)}</td>
								<td>{(g.throwDistanceYards || 0).toFixed(1)}</td>
								<td>{g['Assists'] || 0}</td>
								<td>{g['Goals'] || 0}</td>
								<td>{g['Defensive blocks'] || 0}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>

<style>
	.page {
		max-width: 1100px;
		margin: 0 auto;
		padding: 1.5rem 1rem;
		font-family: -apple-system, 'Segoe UI', system-ui, sans-serif;
		color: #e2e8f0;
	}

	header {
		margin-bottom: 1.5rem;
	}

	.back {
		font-size: 0.85rem;
		color: #94a3b8;
		text-decoration: none;
		display: inline-block;
		margin-bottom: 0.35rem;
	}

	.back:hover {
		color: #e2e8f0;
	}

	h1 {
		margin: 0;
		font-size: 1.6rem;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.jersey {
		font-size: 1rem;
		color: #94a3b8;
		font-weight: 400;
	}

	h2 {
		font-size: 1.1rem;
		margin: 0 0 0.75rem;
		color: #cbd5e1;
	}

	.muted {
		color: #94a3b8;
		font-style: italic;
	}

	.muted a {
		color: #3b82f6;
	}

	/* Stat cards */
	.cards {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 2rem;
	}

	.card {
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 8px;
		padding: 0.75rem 1rem;
		min-width: 100px;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.card-label {
		font-size: 0.75rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.card-value {
		font-size: 1.4rem;
		font-weight: 700;
		color: #e2e8f0;
	}

	.card-value small {
		font-size: 0.75rem;
		font-weight: 400;
		color: #94a3b8;
	}

	/* Chart */
	.chart-section {
		margin-bottom: 2rem;
	}

	.chart-wrapper {
		height: 280px;
	}

	/* Table */
	.table-section {
		margin-bottom: 2rem;
	}

	.table-scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88rem;
	}

	thead th {
		background: #1e293b;
		color: #94a3b8;
		text-align: right;
		padding: 0.5rem 0.65rem;
		font-weight: 600;
		white-space: nowrap;
		border-bottom: 1px solid #334155;
	}

	thead th.left {
		text-align: left;
	}

	thead th.sub {
		color: #64748b;
		font-weight: 400;
	}

	tbody tr:nth-child(even) {
		background: #0f172a;
	}

	tbody tr:hover {
		background: #1e293b;
	}

	tbody td {
		padding: 0.42rem 0.65rem;
		border-bottom: 1px solid #1e293b;
		white-space: nowrap;
		text-align: right;
	}

	tbody td.left {
		text-align: left;
	}

	tbody td.sub {
		color: #64748b;
	}

	td.accent {
		color: #60a5fa;
		font-weight: 600;
	}

	td.high-to {
		color: #f87171;
		font-weight: 600;
	}

	td.efficiency {
		color: #34d399;
		font-weight: 600;
	}

	td.efficiency.mid-eff {
		color: #eab308;
		font-weight: 600;
	}

	td.efficiency.low-eff {
		color: #f97316;
		font-weight: 600;
	}

	.accent {
		color: #60a5fa;
	}

	.high-to {
		color: #f87171;
	}

	.good-eff {
		color: #34d399;
	}

	.mid-eff {
		color: #eab308;
	}

	.low-eff {
		color: #f97316;
	}
</style>
