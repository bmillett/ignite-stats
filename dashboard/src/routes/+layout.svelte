<script>
	import '../app.css';
	import { page } from '$app/stores';

	let { children } = $props();
</script>

<nav class="app-nav">
	<a href="/" class="nav-brand">🥏 Frisbee Stats</a>
	<a href="/" class:active={$page.url.pathname === '/'}>Overview</a>
	<a href="/leaderboard" class:active={$page.url.pathname === '/leaderboard'}>Leaderboard</a>
</nav>

<div class="app-body">
	{@render children()}
</div>
