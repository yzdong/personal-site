// models.js — pluggable model adapters.
// A "model" is the whole abstraction: an async function  ({ system, prompt, schema? }) => string.
// When `schema` (a JSON Schema) is passed, the adapter forces a structured result and returns
// its JSON as a string — so a decision can never come back without the fields the schema requires.
// The agent never sees keys or endpoints. Inject one of these, or write your own.

async function readErr(r) { try { return (await r.text()).slice(0, 240); } catch { return ''; } }

// OpenRouter — one key, any model, OpenAI-compatible. Route with a "vendor/model" id.
// https://openrouter.ai   e.g. model: 'anthropic/claude-opus-4' | 'openai/gpt-5' | 'google/gemini-2.5-pro'
export const openrouter = ({ apiKey, model }) => async ({ system, prompt, schema }) => {
  const body = { model, max_tokens: 8000,
    messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] };
  if (schema) body.response_format = { type: 'json_schema', json_schema: { name: 'emit', strict: true, schema } };
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${await readErr(r)}`);
  const d = await r.json();
  return d.choices?.[0]?.message?.content || '';
};

// Anthropic, direct. Browser-direct needs the dangerous header (fine for a local prototype).
export const anthropic = ({ apiKey, model }) => async ({ system, prompt, schema }) => {
  const body = { model, max_tokens: 8000, system, messages: [{ role: 'user', content: prompt }] };
  if (schema) { body.tools = [{ name: 'emit', description: 'Return the structured result.', input_schema: schema }];
    body.tool_choice = { type: 'tool', name: 'emit' }; }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await readErr(r)}`);
  const d = await r.json();
  if (schema) { const tu = (d.content || []).find(b => b.type === 'tool_use'); return tu ? JSON.stringify(tu.input) : ''; }
  return (d.content || []).map(b => b.text || '').join('');
};

// Local proxy — keeps the key server-side (reads .env). Pair with serve.py.
export const proxy = ({ url = '/api/messages', model }) => async ({ system, prompt, schema, temperature }) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, system, prompt, schema, temperature }) });
  if (!r.ok) throw new Error(`proxy ${r.status}: ${await readErr(r)}`);
  const d = await r.json();
  return d.text || '';
};
