import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { crawl } from './crawl.js';
import { fetchOnionPage } from './fetch.js';
import { search } from './search.js';
import { checkTorConnection } from './tor.js';
import { hasVendoredTor, startTorProcess } from './torProcess.js';

const server = new McpServer(
	{
		name: 'tor-mcp',
		version: '1.0.0',
	},
	{
		capabilities: { tools: {} },
	},
);

server.registerTool(
	'tor_search',
	{
		description:
			'Search onion sites. Use mode: filtered (Ahmia), unfiltered (Torch), or both (merge and deduplicate).',
		inputSchema: {
			query: z.string().describe('Search query'),
			mode: z
				.enum(['filtered', 'unfiltered', 'both'])
				.optional()
				.default('both')
				.describe(
					'filtered = Ahmia only, unfiltered = Torch only, both = aggregate',
				),
		},
	},
	async ({ query, mode }) => {
		const { results } = await search(query, mode);
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({ results }, null, 2),
				},
			],
		};
	},
);

server.registerTool(
	'tor_fetch',
	{
		description:
			'Fetch a single onion page. Returns title, content, and links.',
		inputSchema: {
			url: z.string().describe('Onion URL (e.g. http://example.onion)'),
		},
	},
	async ({ url }) => {
		const page = await fetchOnionPage(url);
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(page, null, 2),
				},
			],
		};
	},
);

server.registerTool(
	'tor_crawl',
	{
		description: 'Explore links from an onion page up to a given depth.',
		inputSchema: {
			url: z.string().describe('Onion URL to start from'),
			depth: z
				.number()
				.min(0)
				.max(3)
				.optional()
				.default(1)
				.describe('Crawl depth'),
		},
	},
	async ({ url, depth }) => {
		const { links } = await crawl(url, depth);
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({ links }, null, 2),
				},
			],
		};
	},
);

server.registerTool(
	'tor_status',
	{
		description: 'Check Tor connection status (connected, latency, error).',
		inputSchema: {},
	},
	async () => {
		const status = await checkTorConnection();
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(status, null, 2),
				},
			],
		};
	},
);

async function main() {
	const explicitAuto =
		process.env.TOR_AUTO_START === '1' || process.env.TOR_AUTO_START === 'true';
	const explicitOff =
		process.env.TOR_AUTO_START === '0' ||
		process.env.TOR_AUTO_START === 'false';
	const useVendoredByDefault = hasVendoredTor() && !explicitOff;
	if (explicitAuto || useVendoredByDefault) {
		await startTorProcess();
	}
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
