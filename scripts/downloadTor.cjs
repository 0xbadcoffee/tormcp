const { join } = require('path');
const {
	createWriteStream,
	mkdirSync,
	readdirSync,
	renameSync,
	rmSync,
	existsSync,
} = require('fs');
const { get } = require('https');
const tar = require('tar');

if (process.env.TOR_SKIP_DOWNLOAD === '1') process.exit(0);
const VERSION = process.env.TOR_VERSION || '15.0.7';
const BASE = 'https://archive.torproject.org/tor-package-archive/torbrowser';
const vendorDir = join(process.cwd(), 'vendor', 'tor');
const extractDir = join(process.cwd(), 'vendor', 'tor_extract');
const binaryName = process.platform === 'win32' ? 'tor.exe' : 'tor';

function getBundleName() {
	const p = process.platform;
	const arch =
		process.arch === 'x64'
			? 'x86_64'
			: process.arch === 'arm64'
				? 'aarch64'
				: 'i686';
	if (p === 'win32') return `tor-expert-bundle-windows-${arch}-${VERSION}`;
	if (p === 'darwin') return `tor-expert-bundle-macos-${arch}-${VERSION}`;
	if (p === 'linux') return `tor-expert-bundle-linux-${arch}-${VERSION}`;
	return null;
}

function download(url) {
	return new Promise((resolve, reject) => {
		const file = join(process.cwd(), 'vendor', `tor-${VERSION}.tar.gz`);
		mkdirSync(join(process.cwd(), 'vendor'), { recursive: true });
		const stream = createWriteStream(file);
		get(url, (res) => {
			if (res.statusCode === 302 || res.statusCode === 301) {
				const redirect = res.headers.location;
				return download(
					redirect.startsWith('http') ? redirect : new URL(redirect, url).href,
				)
					.then(resolve)
					.catch(reject);
			}
			if (res.statusCode !== 200) {
				stream.destroy();
				return reject(new Error(`HTTP ${res.statusCode}`));
			}
			res.pipe(stream);
			stream.on('finish', () => {
				stream.close();
				resolve(file);
			});
		}).on('error', (err) => {
			stream.destroy();
			reject(err);
		});
	});
}

function findBinary(dir, depth = 0) {
	if (depth > 5) return null;
	const entries = readdirSync(dir, { withFileTypes: true });
	for (const e of entries) {
		const full = join(dir, e.name);
		if (e.isFile() && e.name === binaryName) return full;
		if (e.isDirectory() && !e.name.startsWith('.')) {
			const found = findBinary(full, depth + 1);
			if (found) return found;
		}
	}
	return null;
}

async function main() {
	const bundle = getBundleName();
	if (!bundle) {
		console.log(
			'Unsupported platform for vendored Tor. Use system Tor or set TOR_EXECUTABLE.',
		);
		return;
	}
	const url = `${BASE}/${VERSION}/${bundle}.tar.gz`;
	console.log('Downloading Tor', VERSION, 'from', url);
	mkdirSync(extractDir, { recursive: true });
	try {
		const file = await download(url);
		await tar.x({ file, cwd: extractDir });
		const binaryPath = findBinary(extractDir);
		if (!binaryPath) throw new Error('Tor binary not found in archive');
		const torDir = join(binaryPath, '..');
		if (existsSync(vendorDir))
			rmSync(vendorDir, { recursive: true, force: true });
		renameSync(torDir, vendorDir);
		console.log('Tor binary ready at', join(vendorDir, binaryName));
	} finally {
		rmSync(extractDir, { recursive: true, force: true });
		const tarball = join(process.cwd(), 'vendor', `tor-${VERSION}.tar.gz`);
		if (existsSync(tarball)) rmSync(tarball, { force: true });
	}
}

main().catch((err) => {
	console.error('Tor download failed:', err.message);
	process.exit(1);
});
