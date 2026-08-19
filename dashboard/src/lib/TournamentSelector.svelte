<script>
	import { selectedTournaments } from '$lib/stores.js';

	let { stats } = $props();

	let selected = $state([]);
	let allTournaments = $derived(stats ? Object.keys(stats.tournaments) : []);

	// Sync local state from store on mount and when store changes
	$effect(() => {
		const unsub = selectedTournaments.subscribe((v) => (selected = v));
		return unsub;
	});

	// When allTournaments first populates and nothing is selected yet, select all
	$effect(() => {
		if (allTournaments.length > 0 && selected.length === 0) {
			selected = [...allTournaments];
			selectedTournaments.set(selected);
		}
	});

	function toggle(name) {
		if (selected.includes(name)) {
			selected = selected.filter((t) => t !== name);
		} else {
			selected = [...selected, name];
		}
		selectedTournaments.set(selected);
	}

	function selectAll() {
		selected = [...allTournaments];
		selectedTournaments.set(selected);
	}

	let label = $derived(
		selected.length === allTournaments.length && allTournaments.length > 0
			? 'All tournaments'
			: selected.join(', ') || 'None'
	);
</script>

<section class="selector">
	<span class="selector-label">Showing: <strong>{label}</strong></span>
	<div class="pills">
		{#each allTournaments as t}
			<button class="pill" class:active={selected.includes(t)} onclick={() => toggle(t)}>
				{t}
			</button>
		{/each}
		{#if allTournaments.length > 1}
			<button class="pill pill-all" onclick={selectAll}>All</button>
		{/if}
	</div>
</section>

<style>
	.selector { margin-bottom: 1.5rem; }
	.selector-label { font-size: 0.9rem; color: #94a3b8; display: block; margin-bottom: 0.5rem; }
	.pills { display: flex; flex-wrap: wrap; gap: 0.4rem; }
	.pill { padding: 0.3rem 0.8rem; border-radius: 999px; border: 1px solid #475569; background: transparent; color: #94a3b8; font-size: 0.85rem; cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s; }
	.pill:hover { border-color: #3b82f6; color: #e2e8f0; }
	.pill.active { background: #3b82f6; border-color: #3b82f6; color: #fff; }
	.pill-all { border-color: #7c5cd8; color: #7c5cd8; }
	.pill-all:hover { background: #7c5cd8; color: #fff; }
</style>
