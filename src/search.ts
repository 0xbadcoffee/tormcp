import {
	parseAhmiaResults,
	parseTorchResults,
	type SearchResultItem,
} from '../parsers/htmlParser.js';
import { torFetch } from './tor.js';

const TORCH_ONION =
	'http://xmh57jrknzkhv6y3ls3ubitzfqnkrwxhopf5aygthi7d6rplyvk3noyd.onion';
const AHMIA_ONION =
	'http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion';

export type SearchMode = 'filtered' | 'unfiltered' | 'both';

async function searchTorch(query: string): Promise<SearchResultItem[]> {
	const url = `${TORCH_ONION}/search?query=${encodeURIComponent(query)}`;
	try {
		const html = await torFetch(url);
		return parseTorchResults(html);
	} catch {
		return [];
	}
}

async function searchAhmia(query: string): Promise<SearchResultItem[]> {
	const url = `${AHMIA_ONION}/search/?q=${encodeURIComponent(query)}`;
	try {
		const html = await torFetch(url);
		return parseAhmiaResults(html);
	} catch {
		return [];
	}
}

function mergeAndDedupe(items: SearchResultItem[]): SearchResultItem[] {
	const seen = new Set<string>();
	return items.filter((r) => {
		const key = r.url.toLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export async function search(
	query: string,
	mode: SearchMode = 'both',
): Promise<{ results: SearchResultItem[] }> {
	if (mode === 'unfiltered') {
		const results = await searchTorch(query);
		return { results };
	}
	if (mode === 'filtered') {
		const results = await searchAhmia(query);
		return { results };
	}
	const [torchResults, ahmiaResults] = await Promise.all([
		searchTorch(query),
		searchAhmia(query),
	]);
	const merged = mergeAndDedupe([...ahmiaResults, ...torchResults]);
	return { results: merged };
}
