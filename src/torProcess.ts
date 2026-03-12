import { type ChildProcess, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOR_SOCKS_PORT = parseInt(process.env.TOR_SOCKS_PORT ?? '9050', 10);
const _dir = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(_dir, '..', '..');
const VENDOR_TOR_DIR = path.join(PROJECT_ROOT, 'vendor', 'tor');
const TOR_BINARY_NAME = process.platform === 'win32' ? 'tor.exe' : 'tor';

function resolveTorExecutable(): string {
	if (process.env.TOR_EXECUTABLE) {
		return process.env.TOR_EXECUTABLE;
	}
	const candidates = [
		path.join(VENDOR_TOR_DIR, TOR_BINARY_NAME),
		path.join(VENDOR_TOR_DIR, 'Tor', TOR_BINARY_NAME),
		path.join(VENDOR_TOR_DIR, 'Browser', 'Tor', TOR_BINARY_NAME),
	];
	for (const p of candidates) {
		try {
			if (fs.existsSync(p)) return p;
		} catch {
			// ignore
		}
	}
	return 'tor';
}

export function hasVendoredTor(): boolean {
	const p = resolveTorExecutable();
	return p !== 'tor' && fs.existsSync(p);
}

const POLL_MS = 300;
const MAX_WAIT_MS = 120_000;

let child: ChildProcess | null = null;
let dataDir: string | null = null;

function waitForPort(port: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const deadline = Date.now() + MAX_WAIT_MS;
		const tryConnect = () => {
			const socket = new net.Socket();
			const onConnect = () => {
				socket.destroy();
				resolve();
			};
			socket.once('connect', onConnect);
			socket.once('error', () => {
				socket.destroy();
				if (Date.now() >= deadline) {
					reject(
						new Error(`Tor SOCKS port ${port} did not become ready in time`),
					);
					return;
				}
				setTimeout(tryConnect, POLL_MS);
			});
			socket.connect(port, '127.0.0.1');
		};
		tryConnect();
	});
}

export function isTorProcessRunning(): boolean {
	return child != null;
}

export async function startTorProcess(): Promise<void> {
	if (child != null) {
		return;
	}
	dataDir = path.join(
		os.tmpdir(),
		`tor-mcp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
	);
	const torExecutable = resolveTorExecutable();
	const args = ['SocksPort', String(TOR_SOCKS_PORT), 'DataDirectory', dataDir];
	child = spawn(torExecutable, args, {
		stdio: 'ignore',
		windowsHide: true,
	});
	const spawnError = new Promise<never>((_, reject) => {
		child?.on('error', (err) => {
			child = null;
			reject(err);
		});
	});
	const portReady = waitForPort(TOR_SOCKS_PORT);
	child.on('exit', (_code, _signal) => {
		child = null;
	});
	try {
		await Promise.race([portReady, spawnError]);
	} catch (err) {
		if (child?.pid) {
			child.kill('SIGTERM');
			child = null;
		}
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes('ENOENT') || msg.includes('spawn')) {
			throw new Error(
				`Tor executable not found. Run "pnpm run postinstall" to download Tor into vendor/tor, or set TOR_EXECUTABLE. Original: ${msg}`,
			);
		}
		throw err;
	}
	process.env.TOR_SOCKS_PROXY =
		process.env.TOR_SOCKS_PROXY ?? `socks5h://127.0.0.1:${TOR_SOCKS_PORT}`;
	const { resetAgent } = await import('./tor.js');
	resetAgent();

	const killChild = () => {
		if (child?.pid) {
			try {
				child.kill('SIGTERM');
			} catch {
				// ignore
			}
			child = null;
		}
	};
	process.once('exit', killChild);
}

export async function stopTorProcess(): Promise<void> {
	if (child?.pid) {
		child.kill('SIGTERM');
		child = null;
	}
}
