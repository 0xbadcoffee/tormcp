import * as cheerio from 'cheerio';

export interface ParsedPage {
	title: string;
	content: string;
	links: string[];
}

export function parseHtml(html: string, baseUrl: string): ParsedPage {
	const $ = cheerio.load(html);
	const title = $('title').text().trim() || '';
	$('script, style, nav, footer, header').remove();
	let content = $('body').text().replace(/\s+/g, ' ').trim();
	if (!content) content = $('html').text().replace(/\s+/g, ' ').trim();
	content = content.slice(0, 50000);
	const links: string[] = [];
	$('a[href]').each((_, el) => {
		const href = $(el).attr('href');
		if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
		try {
			const absolute = new URL(href, baseUrl).href;
			if (absolute.endsWith('.onion') || absolute.includes('.onion/')) {
				links.push(absolute);
			}
		} catch {
			// skip invalid URLs
		}
	});
	return { title, content, links: [...new Set(links)] };
}

export interface SearchResultItem {
	title: string;
	url: string;
	snippet: string;
}

export function parseTorchResults(html: string): SearchResultItem[] {
	const $ = cheerio.load(html);
	const results: SearchResultItem[] = [];
	$(".result, .search-result, .result-block, div[class*='result']").each(
		(_, el) => {
			const $el = $(el);
			const link = $el.find("a[href*='.onion']").first();
			const href = link.attr('href');
			const title =
				link.text().trim() || $el.find('h2, h3').first().text().trim();
			const snippet = $el
				.find('p, .snippet, .description')
				.first()
				.text()
				.replace(/\s+/g, ' ')
				.trim();
			if (href && (title || snippet)) {
				results.push({
					title: title || 'Untitled',
					url: href,
					snippet: snippet.slice(0, 300),
				});
			}
		},
	);
	if (results.length === 0) {
		$("a[href*='.onion']").each((_, el) => {
			const $el = $(el);
			const href = $el.attr('href');
			const title = $el.text().trim();
			if (href && title) {
				results.push({ title, url: href, snippet: '' });
			}
		});
	}
	return results;
}

export function parseAhmiaResults(html: string): SearchResultItem[] {
	const $ = cheerio.load(html);
	const results: SearchResultItem[] = [];
	$('.result, li.result, .searchResult').each((_, el) => {
		const $el = $(el);
		const link = $el.find("a[href*='.onion']").first();
		const href = link.attr('href');
		const title =
			link.text().trim() || $el.find('h4, h3').first().text().trim();
		const snippet = $el
			.find('.snippet, .description, p')
			.first()
			.text()
			.replace(/\s+/g, ' ')
			.trim();
		if (href && (title || snippet)) {
			results.push({
				title: title || 'Untitled',
				url: href,
				snippet: snippet.slice(0, 300),
			});
		}
	});
	if (results.length === 0) {
		$("a[href*='.onion']").each((_, el) => {
			const $el = $(el);
			const href = $el.attr('href');
			const title = $el.text().trim();
			if (href && title) {
				results.push({ title, url: href, snippet: '' });
			}
		});
	}
	return results;
}
