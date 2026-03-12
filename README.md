# Tor MCP

MCP server for searching and fetching Tor onion services. Uses **Torch** (unfiltered, broad index) and **Ahmia** (filtered, curated) with optional aggregation.

## Prerequisites

- Node.js 18+
- pnpm

**Tor** is downloaded into the project at `vendor/tor` when you run `pnpm install` (postinstall script). With `TOR_AUTO_START=1` the app uses that binary so you don't need to install Tor separately. You can also run Tor yourself (Tor Browser or daemon) or set `TOR_EXECUTABLE` to a custom path.

## Install

```bash
pnpm install
pnpm build
```

`pnpm install` downloads the Tor binary for your platform to `vendor/tor` (see `.gitignore`). If the download fails (e.g. offline), run `node scripts/downloadTor.cjs` later.

## Usage

Start the MCP server (stdio). Configure your MCP client to run:

```bash
node dist/src/server.js
```

Or after build:

```bash
pnpm start
```

### Environment

- `TOR_SOCKS_PROXY` — Proxy URL (default `socks5h://127.0.0.1:9050`). Use `socks5h` so .onion is resolved by Tor.
- `TOR_AUTO_START` — Set to `1` or `true` to spawn Tor. When unset, Tor is still auto-started if `vendor/tor` exists (from postinstall). Set to `0` or `false` to disable auto-start.
- `TOR_SOCKS_PORT` — Port for the spawned Tor SOCKS proxy (default `9050`). Used when `TOR_AUTO_START` is set.
- `TOR_EXECUTABLE` — Path or name of the Tor binary. When unset, the app uses `vendor/tor` if present (from postinstall), otherwise `tor` from PATH.
- `TOR_SKIP_DOWNLOAD` — Set to `1` to skip the postinstall Tor download (e.g. in CI).
- `TOR_VERSION` — Version of the Tor expert bundle to download (default `15.0.7`). Used by the postinstall script.
- `TOR_MCP_LOG` — Path to the log file (default `tor-mcp.log` in project root). Request/response and parse details are appended here for debugging.

Example with auto-start:

```bash
set TOR_AUTO_START=1
pnpm start
```

## Testing with MCP Inspector

After `pnpm build`, run:

```bash
pnpm run inspector
```

This starts the MCP Inspector with the correct server path (`dist/src/server.js`). Open the URL it prints in the browser to list and call tools (e.g. `tor_search`, `tor_status`). Do not use `dist/server.js`; the built entry is `dist/src/server.js`.

## Testing in Cursor

1. Build the project: `pnpm build`
2. Open this folder in Cursor as the workspace root (so `.cursor/mcp.json` is used).
3. Reload Cursor or restart the MCP servers (Settings > MCP, or reload window).
4. The **tor-mcp** server runs via `node dist/src/server.js` from the project root. Ensure Tor is running on `127.0.0.1:9050` if you call the tools.
5. In chat, ask the AI to use `tor_search`, `tor_fetch`, `tor_crawl`, or `tor_status`.

## MCP Tools

| Tool        | Description |
|------------|-------------|
| `tor_search` | Search onion sites. `mode`: `filtered` (Ahmia), `unfiltered` (Torch), or `both` (merge + dedupe). |
| `tor_fetch`  | Fetch a single onion page; returns title, content, links. |
| `tor_crawl`   | Explore links from a page up to a given depth. |
| `tor_status`  | Tor connection status (connected, circuit, latency). |

## Indexers

- **Torch** (unfiltered): minimal moderation, large index, more dead/spam links.
- **Ahmia** (filtered): filters abuse/illegal content, cleaner results.

All traffic goes through Tor via `socks5h://127.0.0.1:9050` (hostname resolved by proxy).

## Troubleshooting

**`connect ECONNREFUSED 127.0.0.1:9050`** — Nothing is listening on that port. Either:

- Set `TOR_AUTO_START=1` and have the `tor` binary in PATH (app will spawn Tor), or
- Start Tor yourself: **Tor Browser**, or **Tor daemon** ([Tor Expert Bundle](https://www.torproject.org/download/tor/)), or set `TOR_SOCKS_PROXY` to your proxy (e.g. `socks5h://127.0.0.1:9150` for Tor Browser on 9150).

**Spawn fails (ENOENT / "tor" not found)** — With `TOR_AUTO_START=1`, the `tor` executable must be in PATH or set via `TOR_EXECUTABLE` (full path to the binary).
