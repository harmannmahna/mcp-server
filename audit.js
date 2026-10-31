export function inspect(html, page) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] || '';
  const headings = [...html.matchAll(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  const blocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const findings = [];
  if (!title) findings.push({ id: 'add-title', category: 'SEO', severity: 'high', issue: 'Page has no title tag.' });
  else if (title.length < 30 || title.length > 60) findings.push({ id: 'improve-title', category: 'SEO', severity: 'medium', issue: `Title is ${title.length} characters; aim for about 30–60.` });
  if (!description) findings.push({ id: 'add-description', category: 'SEO', severity: 'high', issue: 'Page has no meta description.' });
  else if (description.length < 70 || description.length > 160) findings.push({ id: 'improve-description', category: 'SEO', severity: 'low', issue: `Description is ${description.length} characters; aim for about 70–160.` });
  if (headings.filter((h) => h[1].toLowerCase() === 'h1').length !== 1) findings.push({ id: 'fix-h1', category: 'SEO/AEO', severity: 'medium', issue: 'Use exactly one clear H1 heading.' });
  if (headings.some((h, i) => i && Number(h[1][1]) > Number(headings[i - 1][1][1]) + 1)) findings.push({ id: 'heading-order', category: 'SEO/AEO', severity: 'low', issue: 'Heading levels skip a level.' });
  if (html.replace(/<[^>]+>/g, ' ').split(/\s+/).length < 60) findings.push({ id: 'answer-content', category: 'AEO', severity: 'medium', issue: 'Add concise, scannable answer content.' });
  if (!blocks.length) findings.push({ id: 'add-schema', category: 'SEO/GEO', severity: 'medium', issue: 'No JSON-LD structured data found.' });
  for (const block of blocks) { try { JSON.parse(block[1]); } catch { findings.push({ id: 'fix-schema', category: 'SEO/GEO', severity: 'high', issue: 'JSON-LD is invalid.' }); } }
  if (!/Portland|Oregon/i.test(html)) findings.push({ id: 'local-context', category: 'GEO', severity: 'low', issue: 'No clear geographic context found.' });
  return { page, title, description, headings: headings.map((h) => ({ level: h[1], text: h[2].replace(/<[^>]+>/g, '').trim() })), structuredDataBlocks: blocks.length, findings };
}
