import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const base = process.env.MCP_URL || 'http://127.0.0.1:5001/mcp';
const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
const client = new Client({ name: 'html-seo-demo-agent', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(base)));
const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(result.content?.[0]?.text || `${name} failed`);
  return JSON.parse(result.content[0].text);
};
async function askLLM(findings) {
  const prompt = `You are an SEO, answer engine optimization (AEO), and geographic/entity optimization (GEO) consultant. Based on these audited sample-page findings, explain the top three practical, accurate recommendations and pick exactly one supported recommendation id from add-description, add-schema, add-faq, add-title for the about page. Return concise plain text and end with FIX_ID: <id>. Findings: ${JSON.stringify(findings)}`;
  if (provider === 'claude') {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: process.env.CLAUDE_MODEL || 'claude-3-5-haiku-latest', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }) });
    if (!response.ok) throw new Error(`Anthropic API ${response.status}: ${await response.text()}`);
    return (await response.json()).content?.map((part) => part.text || '').join('\n') || '';
  }
  if (!process.env.GEMINI_API_KEY) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  if (!response.ok) throw new Error(`Gemini API ${response.status}: ${await response.text()}`);
  return (await response.json()).candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
}
try {
  console.log('1. Pages available:', JSON.stringify(await call('list_pages')));
  const audit = await call('analyze_site');
  console.log(`2. MCP analyzed ${audit.pages.length} pages and found ${audit.totalFindings} opportunities.`);
  for (const page of audit.pages) console.log(`   ${page.page}: ${page.findings.length} findings`);
  const recommendation = await askLLM(audit);
  if (recommendation) console.log(`3. ${provider.toUpperCase()} recommendations:\n${recommendation}`);
  else console.log(`3. LLM not called: set ${provider === 'claude' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY'} to enable live recommendations.`);
  const fixId = recommendation?.match(/FIX_ID:\s*(add-description|add-schema|add-faq|add-title)/i)?.[1]?.toLowerCase() || 'add-description';
  const before = await call('analyze_page', { page: 'about' });
  const applied = await call('apply_recommendation', { page: 'about', recommendation: fixId });
  const after = await call('verify_page', { page: 'about' });
  console.log(`4. Applied ${fixId}: ${applied.changed}. Findings before/after: ${before.findings.length}/${after.findings.length}.`);
  console.log(`   Verification: ${after.findings.some((item) => item.id === fixId) ? 'check still flags the issue' : 'improvement verified'}`);
} finally { await client.close(); }
