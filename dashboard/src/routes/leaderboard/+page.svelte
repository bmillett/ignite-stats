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

	// --- sort state ---
	let sortKey = $state('totalTouches');
	let sortDir = $state(-1); // -1 = descending, 1 = ascending

	let stats = $state(null);
	let selected = $state([]);

	// Subscribe to stores using Svelte 5 $effect
	$effect(() => {
		const unsubStats = statsStore.subscribe((v) => (stats = v));
		const unsubSel = selectedTournaments.subscribe((v) => (selected = v));
		return () => {
			unsubStats();
			unsubSel();
		};
	});

	function setSort(key) {
		if (sortKey === key) {
			sortDir = -sortDir;
		} else {
			sortKey = key;
			sortDir = -1;
		}
	}

	function sortIndicator(key) {
		if (sortKey !== key) return '';
		return sortDir === -1 ? ' ↓' : ' ↑';
	}

	// Merge player aggregates across all selected tournaments
	function getMergedPlayers(statsData, sel) {
		if (!statsData) return [];
		const merged = {};

		for (const t of sel) {
			const tourney = statsData.tournaments[t];
			if (!tourney) continue;
			for (const [name, p] of Object.entries(tourney.players)) {
				if (!merged[name]) {
						merged[name] = {
							name: p.name,
							displayName: p.displayName,
							number: p.number,
							totalPointsPlayed: 0,
							totalTouches: 0,
							totalTurnovers: 0,
							totalThrowerErrors: 0,
							totalReceiverErrors: 0,
							totalThrowDistanceYards: 0,
							totalAssists: 0,
							totalGoals: 0,
							totalBlocks: 0,
							totalThrows: 0
						};
					}
					const m = merged[name];
					m.totalPointsPlayed += p.totalPointsPlayed;
					m.totalTouches += p.totalTouches;
					m.totalTurnovers += p.totalTurnovers;
					m.totalThrowerErrors += p.totalThrowerErrors;
					m.totalReceiverErrors += p.totalReceiverErrors;
					m.totalThrowDistanceYards += p.totalThrowDistanceYards;
					m.totalAssists += p.totalAssists;
					m.totalGoals += p.totalGoals;
					m.totalBlocks += p.totalBlocks;
					m.totalThrows += p.totalThrows;
			}
		}

		return Object.values(merged).map((p) => ({
			...p,
			touchesPerPoint:  p.totalPointsPlayed > 0 ? p.totalTouches / p.totalPointsPlayed : 0,
			efficiency:       p.totalTouches > 0 ? (1 - p.totalTurnovers / p.totalTouches) * 100 : null,
			throwAccuracy:    p.totalThrows > 0 ? (1 - p.totalThrowerErrors / p.totalThrows) * 100 : null
		}));
	}

	function sortedPlayers(players, key, dir) {
		return [...players].sort((a, b) => {
			const av = a[key] ?? 0;
			const bv = b[key] ?? 0;
			if (typeof av === 'string') return dir * av.localeCompare(bv);
			return dir * (av - bv);
		});
	}

	// Top-10 by touches for horizontal bar chart
	function buildChartData(players) {
		const top10 = [...players].sort((a, b) => b.totalTouches - a.totalTouches).slice(0, 10);
		return {
			labels: top10.map((p) => p.displayName),
			datasets: [
				{
					label: 'Touches',
					data: top10.map((p) => p.totalTouches),
					backgroundColor: '#3b82f6'
				}
			]
		};
	}

	const chartOptions = {
		indexAxis: 'y',
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: { display: false }
		},
		scales: {
			x: {
				ticks: { color: '#94a3b8' },
				grid: { color: 'rgba(255,255,255,0.1)' }
			},
			y: {
				ticks: { color: '#e2e8f0' },
				grid: { color: 'rgba(255,255,255,0.05)' }
			}
		}
	};

	const TO_THRESHOLD = 3;

	let players = $derived(getMergedPlayers(stats, selected));
	let tableRows = $derived(sortedPlayers(players, sortKey, sortDir));
	let chartData = $derived(buildChartData(players));
	let loading = $derived(stats === null);
</script>

<svelte:head>
	<title>Player Leaderboard</title>
</svelte:head>

<div class="page">
	<header>
		<div class="header-left">
			<a class="back" href="/">← Tournament Overview</a>
			<h1>Player Leaderboard</h1>
		</div>
	</header>

	{#if loading}
		<p class="loading">Loading stats…</p>
	{:else if players.length === 0}
		<p class="empty">No data. Go to the <a href="/">overview</a> first to load stats.</p>
	{:else}
		<!-- Top-10 Touches Chart -->
		<section class="chart-section">
			<h2>Top 10 Players by Touches</h2>
			<div class="chart-wrapper">
				<Bar data={chartData} options={chartOptions} />
			</div>
		</section>

		<!-- Sortable Table -->
		<section class="table-section">
			<h2>All Players</h2>
			<div class="table-scroll">
				<table>
					<thead>
						<tr>
							<th class="col-name" onclick={() => setSort('displayName')}>
								Player{sortIndicator('displayName')}
							</th>
							<th onclick={() => setSort('totalPointsPlayed')}>
								Pts Played{sortIndicator('totalPointsPlayed')}
							</th>
							<th onclick={() => setSort('totalTouches')}>
								Touches{sortIndicator('totalTouches')}
							</th>
							<th onclick={() => setSort('totalTurnovers')}>
								Turnovers{sortIndicator('totalTurnovers')}
							</th>
							<th onclick={() => setSort('touchesPerPoint')}>
								T/Point{sortIndicator('touchesPerPoint')}
							</th>
							<th onclick={() => setSort('efficiency')}>
								Efficiency{sortIndicator('efficiency')}
							</th>
							<th onclick={() => setSort('totalThrows')}>
								Throws{sortIndicator('totalThrows')}
							</th>
							<th onclick={() => setSort('totalThrowerErrors')}>
								Thrower Err{sortIndicator('totalThrowerErrors')}
							</th>
							<th onclick={() => setSort('throwAccuracy')}>
								Throw Acc %{sortIndicator('throwAccuracy')}
							</th>
							<th onclick={() => setSort('totalReceiverErrors')}>
								Receiver Err{sortIndicator('totalReceiverErrors')}
							</th>
							<th onclick={() => setSort('totalThrowDistanceYards')}>
								Throw Dist (yds){sortIndicator('totalThrowDistanceYards')}
							</th>
							<th onclick={() => setSort('totalAssists')}>
								Assists{sortIndicator('totalAssists')}
							</th>
							<th onclick={() => setSort('totalGoals')}>
								Goals{sortIndicator('totalGoals')}
							</th>
							<th onclick={() => setSort('totalBlocks')}>
								Blocks{sortIndicator('totalBlocks')}
							</th>
						</tr>
					</thead>
					<tbody>
						{#each tableRows as p}
							<tr>
								<td class="col-name">
									<a href="/player/{encodeURIComponent(p.name)}">{p.displayName}</a>
								</td>
								<td>{p.totalPointsPlayed}</td>
								<td class="accent">{p.totalTouches}</td>
								<td class:high-to={p.totalTurnovers > TO_THRESHOLD}>{p.totalTurnovers}</td>
								<td>{p.touchesPerPoint.toFixed(2)}</td>
								<td class="efficiency"
									class:mid-eff={p.efficiency !== null && p.efficiency >= 80 && p.efficiency < 90}
									class:low-eff={p.efficiency !== null && p.efficiency < 80}
								>{p.efficiency !== null ? p.efficiency.toFixed(1) + '%' : '—'}</td>
								<td>{p.totalThrows}</td>
								<td>{p.totalThrowerErrors}</td>
								<td class="efficiency"
									class:mid-eff={p.throwAccuracy !== null && p.throwAccuracy >= 80 && p.throwAccuracy < 90}
									class:low-eff={p.throwAccuracy !== null && p.throwAccuracy < 80}
								>{p.throwAccuracy !== null ? p.throwAccuracy.toFixed(1) + '%' : '—'}</td>
								<td>{p.totalReceiverErrors}</td>
								<td>{p.totalThrowDistanceYards.toFixed(1)}</td>
								<td>{p.totalAssists}</td>
								<td>{p.totalGoals}</td>
								<td>{p.totalBlocks}</td>
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

	.header-left {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.back {
		font-size: 0.85rem;
		color: #94a3b8;
		text-decoration: none;
	}

	.back:hover {
		color: #e2e8f0;
	}

	h1 {
		margin: 0;
		font-size: 1.6rem;
	}

	h2 {
		font-size: 1.1rem;
		margin: 0 0 0.75rem;
		color: #cbd5e1;
	}

	.loading,
	.empty {
		color: #94a3b8;
		font-style: italic;
	}

	.empty a {
		color: #3b82f6;
	}

	/* Chart */
	.chart-section {
		margin-bottom: 2rem;
	}

	.chart-wrapper {
		height: 300px;
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
		cursor: pointer;
		user-select: none;
	}

	thead th:hover {
		color: #e2e8f0;
	}

	thead th.col-name {
		text-align: left;
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

	tbody td.col-name {
		text-align: left;
	}

	tbody td.col-name a {
		color: #3b82f6;
		text-decoration: none;
	}

	tbody td.col-name a:hover {
		text-decoration: underline;
	}

	/* Priority metric highlight */
	td.accent {
		color: #60a5fa;
		font-weight: 600;
	}

	/* High turnovers warning */
	td.high-to {
		color: #f87171;
		font-weight: 600;
	}

	/* Efficiency column */
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
</style>
