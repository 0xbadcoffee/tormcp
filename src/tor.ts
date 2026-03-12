import * as http from 'node:http';
import * as https from 'node:https';
import * as zlib from 'node:zlib';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { log } from './logger.js';

function getProxyString(): string {
	const raw = process.env.TOR_SOCKS_PROXY ?? 'socks5h://127.0.0.1:9050';
	return raw.replace(/^socks5:\/\//i, 'socks5h://');
}

let agent: SocksProxyAgent | null = null;

export function resetAgent(): void {
	agent = null;
}

export function getAgent(): SocksProxyAgent {
	if (!agent) {
		agent = new SocksProxyAgent(getProxyString());
	}
	return agent;
}

export function getProxyUrl(): string {
	return getProxyString();
}

const MAX_REDIRECTS = 5;

export interface TorFetchOptions {
	method?: string;
	headers?: Record<string, string>;
	body?: string;
	_redirects?: number;
}

function parseMetaRefresh(html: string): string | null {
	const m = html.match(/content=["']\d+;\s*url=([^"']+)["']/i);
	return m ? m[1].trim() : null;
}

export function torFetch(
	url: string,
	options: TorFetchOptions = {},
): Promise<string> {
	const redirects = options._redirects ?? 0;
	return new Promise((resolve, reject) => {
		const parsed = new URL(url);
		const isHttps = parsed.protocol === 'https:';
		const mod = isHttps ? https : http;
		const reqOptions: https.RequestOptions = {
			host: parsed.hostname,
			port: parsed.port || (isHttps ? 443 : 80),
			path: parsed.pathname + parsed.search,
			method: options.method || 'GET',
			agent: getAgent(),
			headers: options.headers || {},
		};

		const req = mod.request(reqOptions, (res) => {
			const chunks: Buffer[] = [];
			res.on('data', (chunk: Buffer) => chunks.push(chunk));
			res.on('end', () => {
				const raw = Buffer.concat(chunks);
				const encoding = (res.headers['content-encoding'] ?? '').toLowerCase();
				let body: string;
				try {
					if (encoding === 'gzip') {
						body = zlib.gunzipSync(raw).toString('utf-8');
					} else if (encoding === 'br') {
						body = zlib.brotliDecompressSync(raw).toString('utf-8');
					} else if (encoding === 'deflate') {
						body = zlib.inflateSync(raw).toString('utf-8');
					} else {
						body = raw.toString('utf-8');
					}
				} catch (e) {
					body = raw.toString('utf-8');
					log.warn('torFetch: decompress failed, using raw', {
						url,
						encoding,
						error: e instanceof Error ? e.message : String(e),
					});
				}

				const status = res.statusCode ?? 0;
				const location = res.headers.location;
				if (status >= 301 && status <= 308 && location && redirects < MAX_REDIRECTS) {
					const next = new URL(location, url).href;
					log.info('torFetch: following redirect', { from: url, to: next, status });
					return torFetch(next, { ...options, _redirects: redirects + 1 }).then(resolve).catch(reject);
				}

				const metaUrl = body.length < 2000 ? parseMetaRefresh(body) : null;
				if (metaUrl && redirects < MAX_REDIRECTS) {
					const next = new URL(metaUrl, url).href;
					log.info('torFetch: following meta refresh', { from: url, to: next });
					return torFetch(next, { ...options, _redirects: redirects + 1 }).then(resolve).catch(reject);
				}

				const preview = body.slice(0, 200).replace(/\s+/g, ' ');
				log.info('torFetch', {
					url,
					statusCode: status,
					contentEncoding: encoding || 'none',
					bodyLength: body.length,
					preview: preview.length ? preview : '(empty)',
				});
				resolve(body);
			});
			res.on('error', reject);
		});
		req.on('error', reject);
		req.setTimeout(60000, () => {
			req.destroy();
			reject(new Error('Request timeout'));
		});
		if (options.body) {
			req.write(options.body);
		}
		req.end();
	});
}

export async function checkTorConnection(): Promise<{
	connected: boolean;
	latencyMs?: number;
	error?: string;
}> {
	const start = Date.now();
	try {
		await torFetch(
			'http://xmh57jrknzkhv6y3ls3ubitzfqnkrwxhopf5aygthi7d6rplyvk3noyd.onion/',
		);
		return { connected: true, latencyMs: Date.now() - start };
	} catch (e) {
		let errorMessage = e instanceof Error ? e.message : String(e);
		if (errorMessage.includes('ECONNREFUSED')) {
			errorMessage =
				'Tor not running on 127.0.0.1:9050. Set TOR_AUTO_START=1 (and have the tor binary in PATH) so the app spawns Tor, or run Tor Browser / tor daemon yourself, or set TOR_SOCKS_PROXY to your proxy URL.';
		}
		return {
			connected: false,
			error: errorMessage,
			latencyMs: Date.now() - start,
		};
	}
}
