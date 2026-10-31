import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from './audit.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const pages = ['index.html', 'about.html', 'menu.html'];
const results = await Promise.all(pages.map(async (page) => inspect(await readFile(path.join(root, 'site', page), 'utf8'), page)));
assert.equal(results.length, 3);
assert(results.every((result) => result.findings.length > 0), 'sample pages should have useful opportunities');
assert(results.some((result) => result.findings.some((finding) => finding.category.includes('AEO'))));
assert(results.some((result) => result.findings.some((finding) => finding.category.includes('GEO'))));

const beforeHtml = await readFile(path.join(root, 'site', 'about.html'), 'utf8');
const before = inspect(beforeHtml, 'about');
const fix = 'Our story, address, hours, and sourcing at Northstar Coffee in Portland, Oregon.';
const fixedHtml = beforeHtml.replace('</head>', `  <meta name="description" content="${fix}">\n</head>`);
const after = inspect(fixedHtml, 'about');
assert(!after.findings.some((finding) => finding.id === 'add-description'));
assert(after.findings.length < before.findings.length, 'verified improvement should reduce findings');

const schema = { '@context': 'https://schema.org', '@type': 'CafeOrCoffeeShop', name: 'Northstar Coffee' };
const schemaHtml = beforeHtml.replace('</head>', `  <script type="application/ld+json">${JSON.stringify(schema)}</script>\n</head>`);
const schemaAudit = inspect(schemaHtml, 'about');
assert.equal(schemaAudit.structuredDataBlocks, 1);
assert(!schemaAudit.findings.some((finding) => finding.id === 'add-schema' || finding.id === 'fix-schema'));
console.log(`PASS: audited ${results.length} HTML pages for SEO/AEO/GEO; verified description and JSON-LD changes against updated HTML (${before.findings.length} -> ${after.findings.length} about-page findings).`);
