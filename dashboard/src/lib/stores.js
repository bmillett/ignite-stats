import { writable } from 'svelte/store';

export const statsStore = writable(null);
export const selectedTournaments = writable([]); // array of tournament names currently selected
