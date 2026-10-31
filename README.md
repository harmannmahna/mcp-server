# HTML SEO MCP Demo

A safe, self-contained sandbox: three sample HTML pages, a Node.js static site/API, an MCP server, and an optional Gemini or Claude agent. The demo never accesses an existing website. SEO/AEO/GEO checks are deterministic; the LLM turns the findings into prioritized, page-specific recommendations.

## Run

Requires Node.js 20+.

```sh
npm install
cp .env.example .env
# Add GEMINI_API_KEY (or select Claude and add ANTHROPIC_API_KEY) for live agent responses.
npm start
```

In another terminal:

```sh
npm run demo
```

Open `http://localhost:4173/`. The MCP Streamable HTTP endpoint is `http://localhost:5001/mcp` and is compatible with MCP Inspector and MCP clients. Run `npm test` for the end-to-end workflow check.

### Connect an MCP client

Configure your MCP client with a Streamable HTTP server at `http://localhost:5001/mcp`. For Claude Desktop or another stdio-only client, use a local MCP HTTP bridge or the included agent demo. The agent uses Gemini by default; set `LLM_PROVIDER=claude` to use Anthropic. Keys are read from environment variables and never returned by health endpoints.

## Tools

- `list_pages`, `read_page`: inspect only the three sandbox pages.
- `analyze_page`, `analyze_site`: audit metadata, headings, structured data, answer readiness, and geographic/entity context.
- `apply_recommendation`: apply an allowlisted, reversible improvement to the sample page; the tool returns the updated HTML.
- `verify_page`: re-run checks after a change.

The included demo agent calls the MCP tools, sends their results to the configured LLM, applies a concrete fix, then verifies the resulting page. Without an API key, checks still run but the natural-language LLM step reports that a key is needed.

## Safety

The server binds to localhost by default and accepts only sample page slugs. Fixes modify files under `site/` only. Do not put credentials in source files; use `.env` (ignored by Git) or environment variables.
