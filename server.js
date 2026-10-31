import express from 'express';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { inspect } from './audit.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.join(root, 'site');
const pages = ['index.html', 'about.html', 'menu.html'];
const port = Number(process.env.PORT || 5001);
const sitePort = Number(process.env.SITE_PORT || 4173);
const app = express();
app.use(express.json({ limit: '1mb' }));

function safePage(slug) {
  const normalized = slug === 'home' ? 'index' : String(slug || '').replace(/\.html$/i, '');
  if (!['index', 'about', 'menu'].includes(normalized)) throw new Error('Unknown demo page. Use home, about, or menu.');
  return `${normalized}.html`;
}
const text = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });

const server = new McpServer({ name: 'html-seo-demo', version: '1.0.0' });
server.registerTool('list_pages', { description: 'List the three safe sample HTML pages available to audit.', inputSchema: {} }, async () => text({ pages: ['home', 'about', 'menu'] }));
server.registerTool('read_page', { description: 'Read the source HTML for a sample page. Only home, about, and menu are allowed.', inputSchema: { page: z.string() } }, async ({ page }) => text({ page, html: await readFile(path.join(siteDir, safePage(page)), 'utf8') }));
server.registerTool('analyze_page', { description: 'Audit one sample page for SEO, AEO (answer engine readiness), and GEO (geographic/entity context) opportunities.', inputSchema: { page: z.string() } }, async ({ page }) => text(inspect(await readFile(path.join(siteDir, safePage(page)), 'utf8'), page)));
server.registerTool('analyze_site', { description: 'Audit all three sample pages and summarize findings.', inputSchema: {} }, async () => {
  const results = await Promise.all(['home', 'about', 'menu'].map(async (slug) => inspect(await readFile(path.join(siteDir, safePage(slug)), 'utf8'), slug)));
  return text({ pages: results, totalFindings: results.reduce((sum, item) => sum + item.findings.length, 0) });
});
server.registerTool('apply_recommendation', { description: 'Apply a safe allowlisted SEO/AEO/GEO improvement to a demo page and return updated source. Supported ids: add-description, add-schema, add-faq, add-title.', inputSchema: { page: z.string(), recommendation: z.enum(['add-description', 'add-schema', 'add-faq', 'add-title']) } }, async ({ page, recommendation }) => {
  const file = path.join(siteDir, safePage(page));
  let html = await readFile(file, 'utf8');
  if (recommendation === 'add-description' && !/name=["']description["']/i.test(html)) {
    const name = page === 'about' ? 'Our story, address, hours, and sourcing at Northstar Coffee in Portland, Oregon.' : 'Visit Northstar Coffee in Portland for carefully sourced coffee, seasonal pastries, and friendly neighborhood service.';
    html = html.replace('</head>', `  <meta name="description" content="${name}">\n</head>`);
  } else if (recommendation === 'add-schema' && !/application\/ld\+json/i.test(html)) {
    const schema = { '@context': 'https://schema.org', '@type': 'CafeOrCoffeeShop', name: 'Northstar Coffee', address: { '@type': 'PostalAddress', streetAddress: '1428 NE Alberta Street', addressLocality: 'Portland', addressRegion: 'OR', postalCode: '97211', addressCountry: 'US' }, openingHours: 'Mo-Su 07:00-16:00' };
    html = html.replace('</head>', `  <script type="application/ld+json">${JSON.stringify(schema)}</script>\n</head>`);
  } else if (recommendation === 'add-faq' && !/Frequently asked questions/i.test(html)) {
    html = html.replace('</main>', '    <section><h2>Frequently asked questions</h2><h3>Where is Northstar Coffee?</h3><p>We are at 1428 NE Alberta Street in Portland, Oregon.</p><h3>When are you open?</h3><p>We are open daily from 7 am to 4 pm.</p></section>\n  </main>');
  } else if (recommendation === 'add-title' && !/<title\b/i.test(html)) {
    html = html.replace('</head>', `  <title>${page === 'about' ? 'Our story | Northstar Coffee' : 'Northstar Coffee | Portland cafe'}</title>\n</head>`);
  } else return text({ page, recommendation, changed: false, message: 'The recommendation is already applied or is not applicable.', html });
  await writeFile(file, html, 'utf8');
  return text({ page, recommendation, changed: true, html });
});
server.registerTool('verify_page', { description: 'Re-run the SEO/AEO/GEO audit after edits to verify actual page source improvements.', inputSchema: { page: z.string() } }, async ({ page }) => text(inspect(await readFile(path.join(siteDir, safePage(page)), 'utf8'), page)));

app.get('/health', (_req, res) => res.json({ status: 'ok', mcp: `http://localhost:${port}/mcp`, site: `http://localhost:${sitePort}` }));
app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => transport.close().catch(() => {}));
  try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
  catch (error) { if (!res.headersSent) res.status(500).json({ error: error.message }); }
});
app.get('/mcp', (_req, res) => res.status(405).send('Use POST for Streamable HTTP MCP requests.'));
const site = express();
site.use(express.static(siteDir));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(port, '127.0.0.1', () => console.log(`MCP server listening on http://127.0.0.1:${port}/mcp`));
  site.listen(sitePort, '127.0.0.1', () => console.log(`Dummy HTML site: http://127.0.0.1:${sitePort}`));
}
export { server };
