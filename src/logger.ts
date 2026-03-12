import * as fs from 'node:fs';
import * as path from 'node:path';

const LOG_PATH =
	process.env.TOR_MCP_LOG ?? path.join(process.cwd(), 'tor-mcp.log');

function line(level: string, msg: string, data?: Record<string, unknown>) {
	const ts = new Date().toISOString();
	const extra = data ? ` ${JSON.stringify(data)}` : '';
	return `${ts} [${level}] ${msg}${extra}\n`;
}

function write(level: string, msg: string, data?: Record<string, unknown>) {
	try {
		fs.appendFileSync(LOG_PATH, line(level, msg, data), 'utf-8');
	} catch {
		// ignore
	}
}

export const log = {
	info: (msg: string, data?: Record<string, unknown>) =>
		write('INFO', msg, data),
	warn: (msg: string, data?: Record<string, unknown>) =>
		write('WARN', msg, data),
	error: (msg: string, data?: Record<string, unknown>) =>
		write('ERROR', msg, data),
};

export function getLogPath(): string {
	return LOG_PATH;
}
