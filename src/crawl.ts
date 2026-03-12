import { fetchOnionPage } from './fetch.js';

export async function crawl(
	url: string,
	depth: number = 1,
): Promise<{ links: string[] }> {
	if (!url.includes('.onion')) {
		throw new Error('URL must be an onion address');
	}
	const collected = new Set<string>();
	const queue: { url: string; d: number }[] = [{ url, d: 0 }];
	const seen = new Set<string>([url.toLowerCase()]);

	while (queue.length > 0) {
		const item = queue.shift();
		if (!item) break;
		const { url: current, d } = item;
		if (d > depth) continue;
		try {
			const { links } = await fetchOnionPage(current);
			for (const link of links) {
				const norm = link.toLowerCase().replace(/\/$/, '');
				collected.add(link);
				if (d < depth && !seen.has(norm)) {
					seen.add(norm);
					queue.push({ url: link, d: d + 1 });
				}
			}
		} catch {
			// skip unreachable pages
		}
	}
	return { links: [...collected] };
}
