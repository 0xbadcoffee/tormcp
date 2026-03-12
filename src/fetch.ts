import { parseHtml } from '../parsers/htmlParser.js';
import { log } from './logger.js';
import { torFetch } from './tor.js';

export async function fetchOnionPage(url: string): Promise<{
	title: string;
	content: string;
	links: string[];
}> {
	if (!url.includes('.onion')) {
		throw new Error('URL must be an onion address');
	}
	log.info('fetchOnionPage: start', { url });
	const html = await torFetch(url);
	log.info('fetchOnionPage: got html', { url, htmlLength: html.length });
	const parsed = parseHtml(html, url);
	log.info('fetchOnionPage: parsed', {
		url,
		titleLength: parsed.title.length,
		contentLength: parsed.content.length,
		linksCount: parsed.links.length,
	});
	if (parsed.content.length === 0 && html.length > 0) {
		log.warn('fetchOnionPage: empty content, html snippet', {
			url,
			htmlSnippet: html.slice(0, 500).replace(/\s+/g, ' '),
		});
	}
	return parsed;
}
