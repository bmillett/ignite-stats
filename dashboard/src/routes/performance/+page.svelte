<script>
	import { Bar } from 'svelte-chartjs';
	import {
		Chart,
		CategoryScale,
		LinearScale,
		BarElement,
		Title,
		Tooltip,
		Legend
	} from 'chart.js';
	import { statsStore, selectedTournaments } from '$lib/stores.js';

	Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

	let stats = $state(null);
	let selected = $state([]);

	$effect(() => {
		const u1 = statsStore.subscribe((v) => (stats = v));
		const u2 = selectedTournaments.subscribe((v) => (selected = v));
		return () => { u1(); u2(); };
	});

	let loading = $derived(stats === null);

	// Collect per-game performance rows across selected tournaments
	let gameRows = $derived.by(() => {
		if (!stats) return [];
		const rows = [];
		const targets = selected.length > 0 ? selected : Object.keys(stats.tournaments);
		for (const t of targets) {
			const tourney = stats.tournaments[t];
			if (!tourney) continue;
			for (const g of tourney.games) {
				if (g.performance) rows.push({ ...g.performance, opponent: g.opponent, dateStr: g.dateStr, tournament: g.tournament });
			}
		}
		rows.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
		return rows;
	});

	// Tournament-wide aggregate
	let agg = $derived.by(() => {
		const a = {
			holds: 0, cleanHolds: 0, holdOpportunities: 0,
			breaks: 0, cleanBreaks: 0, breakOpportunities: 0,
			totalTurnovers: 0, totalPoints: 0
		};
		for (const g of gameRows) {
			a.holds             += g.holds;
			a.cleanHolds        += g.cleanHolds;
			a.holdOpportunities += g.holdOpportunities;
			a.breaks            += g.breaks;
			a.cleanBreaks       += g.cleanBreaks;
			a.breakOpportunities+= g.breakOpportunities;
			a.totalTurnovers    += g.totalTurnovers;
			a.totalPoints       += g.totalPoints;
		}
		a.holdPct  = a.holdOpportunities  > 0 ? (a.holds  / a.holdOpportunities)  * 100 : null;
		a.breakPct = a.breakOpportunities > 0 ? (a.breaks / a.breakOpportunities) * 100 : null;
		a.turnoversPerPoint = a.totalPoints > 0 ? a.totalTurnovers / a.totalPoints : 0;
		return a;
	});

	// Stacked bar: holds/breaks per game
	let chartData = $derived.by(() => {
		const labels = gameRows.map((g) =>
			selected.length > 1 ? `${g.tournament}\nvs ${g.opponent}` : `vs ${g.opponent}`
		);
		return {
			labels,
			datasets: [
				{ label: 'Clean Holds',  data: gameRows.map((g) => g.cleanHolds),                          backgroundColor: '#34d399' },
				{ label: 'Holds (w/ TO)',data: gameRows.map((g) => g.holds - g.cleanHolds),                backgroundColor: '#6ee7b7' },
				{ label: 'Hold Losses',  data: gameRows.map((g) => g.holdOpportunities - g.holds),         backgroundColor: '#1e293b' },
				{ label: 'Clean Breaks', data: gameRows.map((g) => g.cleanBreaks),                         backgroundColor: '#3b82f6' },
				{ label: 'Breaks (w/ TO)',data: gameRows.map((g) => g.breaks - g.cleanBreaks),             backgroundColor: '#93c5fd' },
				{ label: 'Break Losses', data: gameRows.map((g) => g.breakOpportunities - g.breaks),       backgroundColor: '#1e293b' }
			]
		};
	});

	// TO per point per game bar chart
	let toChartData = $derived.by(() => {
		const labels = gameRows.map((g) =>
			selected.length > 1 ? `${g.tournament}\nvs ${g.opponent}` : `vs ${g.opponent}`
		);
		return {
			labels,
			datasets: [{
				label: 'Turnovers per Point',
				data: gameRows.map((g) => g.turnoversPerPoint),
				backgroundColor: gameRows.map((g) =>
					g.turnoversPerPoint > 1 ? '#f87171' : g.turnoversPerPoint > 0.5 ? '#f97316' : '#34d399'
				)
			}]
		};
	});

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: { labels: { color: '#e2e8f0' } }
		},
		scales: {
			x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.07)' } },
			y: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.07)' } }
		}
	};

	const toChartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: { legend: { display: false } },
		scales: {
			x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.07)' } },
			y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.07)' } }
		}
	};
</script>

<svelte:head>
	<title>Performance</title>
</svelte:head>

<div class="page">
	<header>
		<a class="back" href="/">← Overview</a>
		<h1>Performance</h1>
	</header>

	{#if loading}
		<p class="muted">Loading stats… <a href="/">Go to overview first</a></p>
	{:else if gameRows.length === 0}
		<p class="muted">No performance data available. Points CSV files are needed alongside Player Stats files.</p>
	{:else}

		<!-- Summary cards -->
		<section class="summary">
			<div class="group">
				<h3>Holds <small>({agg.holdOpportunities} opp.)</small></h3>
				<div class="cards">
					<div class="card">
						<span class="card-label">Holds</span>
						<span class="card-value accent">{agg.holds}</span>
					</div>
					<div class="card">
						<span class="card-label">Hold %</span>
						<span class="card-value">{agg.holdPct !== null ? agg.holdPct.toFixed(1) + '%' : '—'}</span>
					</div>
					<div class="card">
						<span class="card-label">Clean Holds</span>
						<span class="card-value good-eff">{agg.cleanHolds}</span>
					</div>
					<div class="card">
						<span class="card-label">Clean Hold %</span>
						<span class="card-value good-eff">{agg.holds > 0 ? ((agg.cleanHolds / agg.holds) * 100).toFixed(1) + '%' : '—'}</span>
					</div>
				</div>
			</div>
			<div class="group">
				<h3>Breaks <small>({agg.breakOpportunities} opp.)</small></h3>
				<div class="cards">
					<div class="card">
						<span class="card-label">Breaks</span>
						<span class="card-value accent">{agg.breaks}</span>
					</div>
					<div class="card">
						<span class="card-label">Break %</span>
						<span class="card-value">{agg.breakPct !== null ? agg.breakPct.toFixed(1) + '%' : '—'}</span>
					</div>
					<div class="card">
						<span class="card-label">Clean Breaks</span>
						<span class="card-value good-eff">{agg.cleanBreaks}</span>
					</div>
					<div class="card">
						<span class="card-label">Clean Break %</span>
						<span class="card-value good-eff">{agg.breaks > 0 ? ((agg.cleanBreaks / agg.breaks) * 100).toFixed(1) + '%' : '—'}</span>
					</div>
				</div>
			</div>
			<div class="group">
				<h3>Turnovers</h3>
				<div class="cards">
					<div class="card">
						<span class="card-label">Total</span>
						<span class="card-value high-to">{agg.totalTurnovers}</span>
					</div>
					<div class="card">
						<span class="card-label">Per Point</span>
						<span class="card-value">{agg.turnoversPerPoint.toFixed(2)}</span>
					</div>
					<div class="card">
						<span class="card-label">Total Points</span>
						<span class="card-value">{agg.totalPoints}</span>
					</div>
				</div>
			</div>
		</section>

		<!-- Stacked holds/breaks chart -->
		<section class="chart-section">
			<h2>Holds & Breaks per Game</h2>
			<div class="chart-wrapper">
				<Bar data={chartData} options={chartOptions} />
			</div>
		</section>

		<!-- TO per point chart -->
		<section class="chart-section">
			<h2>Turnovers per Point</h2>
			<div class="chart-wrapper-sm">
				<Bar data={toChartData} options={toChartOptions} />
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
							<th>Points</th>
							<th>TOs</th>
							<th>TO/Pt</th>
							<th>Holds</th>
							<th>Hold %</th>
							<th>Clean Holds</th>
							<th>Breaks</th>
							<th>Break %</th>
							<th>Clean Breaks</th>
						</tr>
					</thead>
					<tbody>
						{#each gameRows as g}
							{@const hp = g.holdOpportunities > 0 ? (g.holds / g.holdOpportunities * 100) : null}
							{@const bp = g.breakOpportunities > 0 ? (g.breaks / g.breakOpportunities * 100) : null}
							<tr>
								<td class="left">vs {g.opponent}</td>
								<td class="left">{g.dateStr}</td>
								<td>{g.totalPoints}</td>
								<td class="high-to">{g.totalTurnovers}</td>
								<td>{g.turnoversPerPoint.toFixed(2)}</td>
								<td class="accent">{g.holds} / {g.holdOpportunities}</td>
								<td>{hp !== null ? hp.toFixed(1) + '%' : '—'}</td>
								<td class="good-eff">{g.cleanHolds}</td>
								<td class="accent">{g.breaks} / {g.breakOpportunities}</td>
								<td>{bp !== null ? bp.toFixed(1) + '%' : '—'}</td>
								<td class="good-eff">{g.cleanBreaks}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="totals-row">
							<td colspan="2">Total ({gameRows.length} games)</td>
							<td>{agg.totalPoints}</td>
							<td class="high-to">{agg.totalTurnovers}</td>
							<td>{agg.turnoversPerPoint.toFixed(2)}</td>
							<td class="accent">{agg.holds} / {agg.holdOpportunities}</td>
							<td>{agg.holdPct !== null ? agg.holdPct.toFixed(1) + '%' : '—'}</td>
							<td class="good-eff">{agg.cleanHolds}</td>
							<td class="accent">{agg.breaks} / {agg.breakOpportunities}</td>
							<td>{agg.breakPct !== null ? agg.breakPct.toFixed(1) + '%' : '—'}</td>
							<td class="good-eff">{agg.cleanBreaks}</td>
						</tr>
					</tfoot>
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

	header { margin-bottom: 1.5rem; }

	.back {
		font-size: 0.85rem;
		color: #94a3b8;
		text-decoration: none;
		display: inline-block;
		margin-bottom: 0.35rem;
	}
	.back:hover { color: #e2e8f0; }

	h1 { margin: 0; font-size: 1.6rem; }
	h2 { font-size: 1.1rem; margin: 0 0 0.75rem; color: #cbd5e1; }

	.muted { color: #94a3b8; font-style: italic; }
	.muted a { color: #3b82f6; }

	/* Summary groups */
	.summary { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; }

	.group h3 {
		font-size: 0.85rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: 0 0 0.5rem;
		font-weight: 600;
	}
	.group h3 small {
		font-size: 0.75rem; font-weight: 400;
		text-transform: none; letter-spacing: 0; color: #64748b;
	}

	.cards { display: flex; flex-wrap: wrap; gap: 0.75rem; }

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
		font-size: 0.72rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.card-value { font-size: 1.4rem; font-weight: 700; color: #e2e8f0; }

	/* Charts */
	.chart-section { margin-bottom: 2rem; }
	.chart-wrapper { height: 300px; }
	.chart-wrapper-sm { height: 220px; }

	/* Table */
	.table-section { margin-bottom: 2rem; }
	.table-scroll { overflow-x: auto; }

	table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }

	thead th {
		background: #1e293b;
		color: #94a3b8;
		text-align: right;
		padding: 0.5rem 0.65rem;
		font-weight: 600;
		white-space: nowrap;
		border-bottom: 1px solid #334155;
	}
	thead th.left { text-align: left; }

	tbody tr:nth-child(even) { background: #0f172a; }
	tbody tr:hover { background: #1e293b; }

	tbody td {
		padding: 0.42rem 0.65rem;
		border-bottom: 1px solid #1e293b;
		white-space: nowrap;
		text-align: right;
	}
	tbody td.left { text-align: left; }

	tfoot .totals-row td {
		padding: 0.5rem 0.65rem;
		border-top: 2px solid #334155;
		font-weight: 700;
		color: #e2e8f0;
		white-space: nowrap;
		background: #1e293b;
		text-align: right;
	}
	tfoot .totals-row td:first-child { text-align: left; }

	.accent  { color: #60a5fa; font-weight: 600; }
	.good-eff{ color: #34d399; font-weight: 600; }
	.high-to { color: #f87171; font-weight: 600; }
</style>
