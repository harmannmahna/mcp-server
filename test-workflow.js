import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { server } from './server.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const aboutPath = path.join(root, 'site', 'about.html');
const originalAbout = await readFile(aboutPath, 'utf8');
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: 'workflow-test', version: '1.0.0' });
try {
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 6);
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args });
    assert(!result.isError, result.content?.[0]?.text);
    return JSON.parse(result.content[0].text);
  };
  assert.deepEqual((await call('list_pages')).pages, ['home', 'about', 'menu']);
  const report = await call('analyze_site');
  assert.equal(report.pages.length, 3);
  assert(report.totalFindings > 0);
  const before = await call('analyze_page', { page: 'about' });
  const changed = await call('apply_recommendation', { page: 'about', recommendation: 'add-description' });
  assert(changed.changed);
  const after = await call('verify_page', { page: 'about' });
  assert(after.findings.length < before.findings.length);
  assert(!after.findings.some((finding) => finding.id === 'add-description'));
  const schemaHtml = originalAbout.replace('</head>', '  <script type="application/ld+json">{"@context":"https://schema.org","@type":"CafeOrCoffeeShop","name":"Northstar Coffee"}</script>\n</head>');
  await writeFile(aboutPath, schemaHtml, 'utf8');
  const schemaCheck = await call('verify_page', { page: 'about' });
  assert.equal(schemaCheck.structuredDataBlocks, 1);
  assert(!schemaCheck.findings.some((finding) => finding.id === 'add-schema' || finding.id === 'fix-schema'));
  console.log(`PASS: MCP client listed tools/pages, audited ${report.pages.length} pages (${report.totalFindings} findings), applied a recommendation, and verified description + JSON-LD improvements.`);
} finally {
  await writeFile(aboutPath, originalAbout, 'utf8');
  await client.close().catch(() => {});
  await server.close().catch(() => {});
}

