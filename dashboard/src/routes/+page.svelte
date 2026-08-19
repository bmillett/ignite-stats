<script>
	import { onMount } from 'svelte';
	import { Bar, Line } from 'svelte-chartjs';
	import {
		Chart,
		CategoryScale,
		LinearScale,
		BarElement,
		PointElement,
		LineElement,
		Title,
		Tooltip,
		Legend,
		Filler
	} from 'chart.js';
	import { loadAllStats } from '$lib/data.js';
	import { statsStore, selectedTournaments } from '$lib/stores.js';
	import TournamentSelector from '$lib/TournamentSelector.svelte';

	Chart.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

	const EFF_HIGH = 90;
	const EFF_MID = 80;

	let loading = $state(true);
	let stats = $state(null);
	let selected = $state([]);

	onMount(async () => {
		const data = await loadAllStats();
		statsStore.set(data);
		stats = data;
		const all = Object.keys(data.tournaments);
		selected = [...all];
		selectedTournaments.set(selected);
		loading = false;
	});

	// Keep local selected in sync with store (for derived computations below)
	$effect(() => {
		const unsub = selectedTournaments.subscribe((v) => (selected = v));
		return unsub;
	});

	// Filtered games across selected tournaments, sorted by date ascending
	function getFilteredGames(statsData, sel) {
		if (!statsData) return [];
		const games = [];
		for (const t of sel) {
			const tourney = statsData.tournaments[t];
			if (tourney) games.push(...tourney.games);
		}
		games.sort((a, b) => a.date - b.date);
		return games;
	}

	// Team totals for a single game row
	function gameTeamTotals(game) {
		let touches = 0;
		let turnovers = 0;
		let throwDistYards = 0;
		let throws = 0;
		let throwerErrors = 0;
		for (const p of game.players) {
			touches += p['Touches'] || 0;
			turnovers += p['Turnovers'] ?? 0;
			throwDistYards += p.throwDistanceYards || 0;
			throws += p['Throws'] || 0;
			throwerErrors += p['Thrower errors'] || 0;
		}
		const efficiency = touches > 0 ? (1 - turnovers / touches) * 100 : null;
		const throwCompletionPct = throws > 0 ? ((throws - throwerErrors) / throws) * 100 : null;
		return { touches, turnovers, throwDistYards, efficiency, throws, throwCompletionPct };
	}

	// Build bar chart data (touches vs turnovers) from filtered games
	function buildChartData(games) {
		const labels = games.map((g) => {
			const label = `vs ${g.opponent}`;
			return selected.length > 1 ? `${g.tournament} — ${label}` : label;
		});

		const touchesData = [];
		const turnoversData = [];
		for (const g of games) {
			const totals = gameTeamTotals(g);
			touchesData.push(totals.touches);
			turnoversData.push(totals.turnovers);
		}

		return {
			labels,
			datasets: [
				{
					label: 'Touches',
					data: touchesData,
					backgroundColor: '#3b82f6'
				},
				{
					label: 'Turnovers',
					data: turnoversData,
					backgroundColor: '#f97316'
				}
			]
		};
	}

	// Build line chart data (team efficiency %) from filtered games
	function buildEffChartData(games) {
		const labels = games.map((g) =>
			selected.length > 1 ? `${g.tournament} — vs ${g.opponent}` : `vs ${g.opponent}`
		);
		const effData = games.map((g) => {
			const { efficiency } = gameTeamTotals(g);
			return efficiency !== null ? +efficiency.toFixed(2) : null;
		});
		return {
			labels,
			datasets: [
				{
					label: 'Team Efficiency %',
					data: effData,
					borderColor: '#34d399',
					backgroundColor: 'rgba(52,211,153,0.15)',
					pointBackgroundColor: effData.map((v) =>
						v === null ? '#475569' : v < EFF_MID ? '#f97316' : v < EFF_HIGH ? '#eab308' : '#34d399'
					),
					pointRadius: 5,
					tension: 0.3,
					fill: true,
					spanGaps: true
				}
			]
		};
	}

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				labels: {
					color: '#e2e8f0'
				}
			}
		},
		scales: {
			x: {
				ticks: { color: '#94a3b8' },
				grid: { color: 'rgba(255,255,255,0.1)' }
			},
			y: {
				ticks: { color: '#94a3b8' },
				grid: { color: 'rgba(255,255,255,0.1)' }
			}
		}
	};

	const effChartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: { labels: { color: '#e2e8f0' } },
			tooltip: {
				callbacks: {
					label: (ctx) => ctx.parsed.y !== null ? ` ${ctx.parsed.y.toFixed(1)}%` : ' —'
				}
			}
		},
		scales: {
			x: {
				ticks: { color: '#94a3b8' },
				grid: { color: 'rgba(255,255,255,0.1)' }
			},
			y: {
				min: 0,
				max: 100,
				ticks: { color: '#94a3b8', callback: (v) => v + '%' },
				grid: { color: 'rgba(255,255,255,0.1)' }
			}
		}
	};

	let filteredGames = $derived(getFilteredGames(stats, selected));
	let chartData = $derived(buildChartData(filteredGames));
	let effChartData = $derived(buildEffChartData(filteredGames));

	// Tournament-wide summary totals across all filtered games
	let summary = $derived.by(() => {
		let touches = 0, turnovers = 0, throwDistYards = 0, throws = 0, throwerErrors = 0, games = filteredGames.length;
		for (const g of filteredGames) {
			const t = gameTeamTotals(g);
			touches += t.touches;
			turnovers += t.turnovers;
			throwDistYards += t.throwDistYards;
			throws += t.throws;
			throwerErrors += t.throws > 0 ? t.throws * (1 - (t.throwCompletionPct ?? 100) / 100) : 0;
		}
		const efficiency = touches > 0 ? (1 - turnovers / touches) * 100 : null;
		const throwCompletionPct = throws > 0 ? ((throws - throwerErrors) / throws) * 100 : null;
		return { games, touches, turnovers, throwDistYards, efficiency, throws, throwCompletionPct };
	});

	// Aggregate performance (holds/breaks) across selected tournaments
	let perfSummary = $derived.by(() => {
		const agg = {
			holds: 0, cleanHolds: 0, holdOpportunities: 0,
			breaks: 0, cleanBreaks: 0, breakOpportunities: 0,
			totalTurnovers: 0, totalPoints: 0
		};
		if (!stats) return agg;
		for (const t of selected) {
			const p = stats.tournaments[t]?.performance;
			if (!p) continue;
			agg.holds             += p.holds;
			agg.cleanHolds        += p.cleanHolds;
			agg.holdOpportunities += p.holdOpportunities;
			agg.breaks            += p.breaks;
			agg.cleanBreaks       += p.cleanBreaks;
			agg.breakOpportunities+= p.breakOpportunities;
			agg.totalTurnovers    += p.totalTurnovers;
			agg.totalPoints       += p.totalPoints;
		}
		agg.turnoversPerPoint = agg.totalPoints > 0 ? agg.totalTurnovers / agg.totalPoints : 0;
		agg.holdPct  = agg.holdOpportunities  > 0 ? (agg.holds  / agg.holdOpportunities)  * 100 : null;
		agg.breakPct = agg.breakOpportunities > 0 ? (agg.breaks / agg.breakOpportunities) * 100 : null;
		agg.hasData = agg.totalPoints > 0;
		return agg;
	});
</script>

<svelte:head>
	<title>Team Overview</title>
</svelte:head>

<div class="page">
	<header>
		<h1>Team Overview</h1>
		<nav>
			<a href="/leaderboard">View Leaderboard →</a>
		</nav>
	</header>

	{#if loading}
		<p class="loading">Loading stats…</p>
	{:else}
		<TournamentSelector {stats} />

		<!-- Summary stat cards -->
		<section class="cards">
			<div class="card">
				<span class="card-label">Games</span>
				<span class="card-value">{summary.games}</span>
			</div>
			<div class="card">
				<span class="card-label">Total Touches</span>
				<span class="card-value accent">{summary.touches}</span>
			</div>
			<div class="card">
				<span class="card-label">Total Turnovers</span>
				<span class="card-value high-to">{summary.turnovers}</span>
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
				<span class="card-label">Total Throws</span>
				<span class="card-value">{summary.throws}</span>
			</div>
			<div class="card">
				<span class="card-label">Throw Accuracy</span>
				<span class="card-value"
					class:good-eff={summary.throwCompletionPct !== null && summary.throwCompletionPct >= 90}
					class:mid-eff={summary.throwCompletionPct !== null && summary.throwCompletionPct >= 80 && summary.throwCompletionPct < 90}
					class:low-eff={summary.throwCompletionPct !== null && summary.throwCompletionPct < 80}
				>{summary.throwCompletionPct !== null ? summary.throwCompletionPct.toFixed(1) + '%' : '—'}</span>
			</div>
			<div class="card">
				<span class="card-label">Throw Distance</span>
				<span class="card-value">{summary.throwDistYards.toFixed(0)} <small>yds</small></span>
			</div>
		</section>

		{#if perfSummary.hasData}
		<!-- Performance cards -->
		<section class="perf-cards">
			<div class="perf-row">
				<div class="perf-group">
					<h3>Holds <small>({perfSummary.holdOpportunities} opp.)</small></h3>
					<div class="cards">
						<div class="card card-sm">
							<span class="card-label">Holds</span>
							<span class="card-value accent">{perfSummary.holds}</span>
						</div>
						<div class="card card-sm">
							<span class="card-label">Hold %</span>
							<span class="card-value">{perfSummary.holdPct !== null ? perfSummary.holdPct.toFixed(1) + '%' : '—'}</span>
						</div>
						<div class="card card-sm">
							<span class="card-label">Clean</span>
							<span class="card-value good-eff">{perfSummary.cleanHolds}</span>
						</div>
					</div>
				</div>
				<div class="perf-group">
					<h3>Breaks <small>({perfSummary.breakOpportunities} opp.)</small></h3>
					<div class="cards">
						<div class="card card-sm">
							<span class="card-label">Breaks</span>
							<span class="card-value accent">{perfSummary.breaks}</span>
						</div>
						<div class="card card-sm">
							<span class="card-label">Break %</span>
							<span class="card-value">{perfSummary.breakPct !== null ? perfSummary.breakPct.toFixed(1) + '%' : '—'}</span>
						</div>
						<div class="card card-sm">
							<span class="card-label">Clean</span>
							<span class="card-value good-eff">{perfSummary.cleanBreaks}</span>
						</div>
					</div>
				</div>
			</div>
			<a class="perf-link" href="/performance">Full performance breakdown →</a>
		</section>
		{/if}

		<!-- Touches vs Turnovers bar chart -->
		<section class="chart-section">
			<h2>Touches vs Turnovers per Game</h2>
			<div class="chart-wrapper">
				<Bar data={chartData} options={chartOptions} />
			</div>
		</section>

		<!-- Team efficiency line chart -->
		<section class="chart-section">
			<h2>Team Efficiency per Game</h2>
			<div class="chart-wrapper">
				<Line data={effChartData} options={effChartOptions} />
			</div>
		</section>

		<!-- Game Results Table -->
		<section class="table-section">
			<h2>Game Results</h2>
			{#if filteredGames.length === 0}
				<p class="empty">No games for the selected tournament(s).</p>
			{:else}
				<div class="table-scroll">
					<table>
						<thead>
							<tr>
								<th>Tournament</th>
								<th>Opponent</th>
								<th>Date</th>
								<th>Touches</th>
								<th>Turnovers</th>
								<th>Efficiency</th>
								<th>Throws</th>
								<th>Accuracy %</th>
								<th>Throw Dist (yds)</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredGames as game}
								{@const totals = gameTeamTotals(game)}
								<tr>
									<td>{game.tournament}</td>
									<td>vs {game.opponent}</td>
									<td>{game.dateStr}</td>
									<td>{totals.touches}</td>
									<td>{totals.turnovers}</td>
									<td class="efficiency"
										class:mid-eff={totals.efficiency !== null && totals.efficiency >= EFF_MID && totals.efficiency < EFF_HIGH}
										class:low-eff={totals.efficiency !== null && totals.efficiency < EFF_MID}
									>{totals.efficiency !== null ? totals.efficiency.toFixed(1) + '%' : '—'}</td>
									<td>{totals.throws}</td>
									<td class="efficiency"
										class:mid-eff={totals.throwCompletionPct !== null && totals.throwCompletionPct >= 80 && totals.throwCompletionPct < 90}
										class:low-eff={totals.throwCompletionPct !== null && totals.throwCompletionPct < 80}
									>{totals.throwCompletionPct !== null ? totals.throwCompletionPct.toFixed(1) + '%' : '—'}</td>
									<td>{totals.throwDistYards.toFixed(1)} yds</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="totals-row">
								<td colspan="3">Total ({summary.games} games)</td>
								<td>{summary.touches}</td>
								<td>{summary.turnovers}</td>
								<td class="efficiency"
									class:good-eff={summary.efficiency !== null && summary.efficiency >= EFF_HIGH}
									class:mid-eff={summary.efficiency !== null && summary.efficiency >= EFF_MID && summary.efficiency < EFF_HIGH}
									class:low-eff={summary.efficiency !== null && summary.efficiency < EFF_MID}
								>{summary.efficiency !== null ? summary.efficiency.toFixed(1) + '%' : '—'}</td>
								<td>{summary.throws}</td>
								<td class="efficiency"
									class:good-eff={summary.throwCompletionPct !== null && summary.throwCompletionPct >= 90}
									class:mid-eff={summary.throwCompletionPct !== null && summary.throwCompletionPct >= 80 && summary.throwCompletionPct < 90}
									class:low-eff={summary.throwCompletionPct !== null && summary.throwCompletionPct < 80}
								>{summary.throwCompletionPct !== null ? summary.throwCompletionPct.toFixed(1) + '%' : '—'}</td>
								<td>{summary.throwDistYards.toFixed(1)} yds</td>
							</tr>
						</tfoot>
					</table>
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.page {
		max-width: 960px;
		margin: 0 auto;
		padding: 1.5rem 1rem;
		font-family: -apple-system, 'Segoe UI', system-ui, sans-serif;
		color: #e2e8f0;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	header h1 {
		margin: 0;
		font-size: 1.6rem;
	}

	nav a {
		color: #3b82f6;
		text-decoration: none;
		font-size: 0.95rem;
	}

	nav a:hover {
		text-decoration: underline;
	}

	.loading {
		color: #94a3b8;
		font-style: italic;
	}

	.chart-section,
	.table-section {
		margin-bottom: 2rem;
	}

	h2 {
		font-size: 1.1rem;
		margin: 0 0 0.75rem;
		color: #cbd5e1;
	}

	.chart-wrapper {
		height: 320px;
		background: transparent;
	}

	.table-scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	thead th {
		background: #1e293b;
		color: #94a3b8;
		text-align: left;
		padding: 0.5rem 0.75rem;
		font-weight: 600;
		white-space: nowrap;
		border-bottom: 1px solid #334155;
	}

	tbody tr:nth-child(even) {
		background: #0f172a;
	}

	tbody tr:hover {
		background: #1e293b;
	}

	tbody td {
		padding: 0.45rem 0.75rem;
		border-bottom: 1px solid #1e293b;
		white-space: nowrap;
	}

	.empty {
		color: #94a3b8;
		font-style: italic;
	}

	/* Summary cards */
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
		min-width: 110px;
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

	/* Totals footer row */
	tfoot .totals-row td {
		padding: 0.5rem 0.75rem;
		border-top: 2px solid #334155;
		font-weight: 700;
		color: #e2e8f0;
		white-space: nowrap;
		background: #1e293b;
	}

	/* Efficiency colours */
	td.efficiency { font-weight: 600; color: #34d399; }
	td.efficiency.mid-eff { color: #eab308; }
	td.efficiency.low-eff { color: #f97316; }
	.good-eff { color: #34d399; }
	.mid-eff { color: #eab308; }
	.low-eff { color: #f97316; }
	.accent { color: #60a5fa; font-weight: 600; }
	.high-to { color: #f87171; font-weight: 600; }

	/* Performance groups */
	.perf-cards {
		margin-bottom: 2rem;
	}

	.perf-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		margin-bottom: 0.75rem;
	}

	.perf-group {
		flex: 1;
		min-width: 160px;
	}

	.card-sm {
		min-width: 72px;
		padding: 0.5rem 0.75rem;
	}

	.card-sm .card-value {
		font-size: 1.1rem;
	}

	.perf-group h3 {
		font-size: 0.85rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: 0 0 0.5rem;
		font-weight: 600;
	}

	.perf-group h3 small {
		font-size: 0.75rem;
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
		color: #64748b;
	}

	.perf-link {
		font-size: 0.88rem;
		color: #3b82f6;
		text-decoration: none;
		margin-top: 0.25rem;
		display: inline-block;
	}

	.perf-link:hover { text-decoration: underline; }
</style>
