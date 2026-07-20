// iris-sdk.js — a collaboration agent. One class; configuring it with a policy + surface is what
// makes it "Iris" (facilitation + decisions) rather than, say, a standup bot (status + tasks).
//
// Collaboration primitives it provides that a single-principal SDK does not:
//   participants            — the group of principals
//   room / caucus(id)       — a shared channel + a private line to each participant
//   memory.shared/.private  — memory partitioned per participant (sealed)
//   surface / room.canvas   — a co-owned artifact + its de-identified projection
//   context({ audience })   — the confidentiality boundary: only what an audience may see
//
// Default drive:  await iris.run({ type:'message', author, text })   // one turn, run to completion
// Debug drive:    const s = iris.stepper(queue)                       // step one pass at a time

import { mockMemory, mockDecision, mockAction } from './scenario-elrond.js';
import { defaultTools } from './tools.js';
import { decisions } from './surfaces.js';

const safeJson = (raw) => { try { const m = String(raw).match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : {}; } catch { return {}; } };
const stanceFromPolicy = (policy) => /stance\W+coach/i.test(String(policy)) ? 'coach' : 'facilitator';
const pick = (obj, keys) => { const o = {}; keys.forEach(k => { if (k in obj) o[k] = obj[k]; }); return o; };
// A per-person read is Iris's private theory-of-mind of a participant, in HER voice: what she
// perceives (interest/position/arc), how sure she is (confidence), and her plan (watch/intent),
// plus an append-only log of how they moved. Never shown to anyone.
// A per-person record has three honest layers:
//   mind        — my THEORY OF MIND of them (BDI): interest (desire), position (intention),
//                 beliefs (what they assume), arc (disposition), regards (how they see OTHERS).
//   confidence  — how sure *I* am of that read (meta, not a fact about them).
//   plan        — my agency toward them: watchingFor (the open question I'm tracking) + helpNext
//                 (how I can help next). Not their mind.
// Plus `shifts` — an append-only log of how their mind has moved.
const TOM_FACETS = ['interest', 'position', 'beliefs', 'arc'];   // patched into rec.mind
const blankRecord = () => ({
  mind: { interest: '', position: '', beliefs: '', arc: 'quiet', regards: [] },
  confidence: 'hunch',
  plan: { watchingFor: '', helpNext: '' },
  shifts: [],
});

// project one surface item to its public, de-identified view (notes + raw contributions dropped)
const projectItem = (item, surface) => ({
  id: item.id,
  ...pick(item, surface.shared),
  ...surface.aggregate(Object.values(item.contributions || {})),
});
const canvasOf = (room, surface) => Object.values(room.items).map(i => projectItem(i, surface));
// `room.canvas` is a live, non-enumerable getter so structuredClone copies only the item data
const bindRoom = (room, surface) => {
  Object.defineProperty(room, 'canvas', { get() { return canvasOf(this, surface); }, enumerable: false, configurable: true });
  return room;
};

export class IrisAgent {
  constructor({ participants, policy, surface = decisions, room = {}, model, tools, store, maxSteps, onEvent }) {
    this.participants = participants;         // [{ id, name, role }]
    this.policy = policy;
    this.surface = surface;                   // the co-owned artifact schema (the "type")
    this.model = model || null;               // async ({ system, prompt }) => string  (null → mocks)
    this.store = store || null;               // reserved: memory I/O adapter (files). Unused in-memory.
    this.tools = {};                          // name -> tool def; post/caucus are swappable defaults
    (tools || defaultTools).forEach(t => { this.tools[t.name] = t; });
    this.maxSteps = maxSteps ?? 6;
    this.onEvent = onEvent || null;
    this.room = bindRoom({ topic: room.topic || '', turn: 0, log: [...(room.log || [])], messages: [], items: structuredClone(room.items || {}) }, surface);
    Object.values(this.room.items).forEach(it => { it.contributions = it.contributions || {}; });
    this.memory = { shared: {}, private: {}, introspection: [] }; // private[id]: sealed per participant; introspection: Iris's own reasoning log
    participants.forEach(p => { this.memory.private[p.id] = { ...blankRecord(), caucus: [] }; });
    this.lastMessage = null; this.decision = null; this._turnActs = 0;
  }

  get isLive() { return !!this.model; }
  _stance() { return stanceFromPolicy(this.policy); }
  _state() { return { room: this.room, memory: this.memory, participants: this.participants, surface: this.surface, turnActs: this._turnActs, last: this.lastMessage }; }
  caucus(id) { return this.memory.private[id] ? this.memory.private[id].caucus : []; }

  // ---- default: one turn, run to completion, triggered by an event ----
  async run(event) {
    if (event.type === 'message') this.ingest(event.author, event.text);        // ① a line enters the room
    else if (event.type === 'caucus') this.ingestCaucus(event.author, event.text); // ① a private reply
    return this.react();                                                          // ② reflect, ③ act*
  }
  // a private reply from a participant, inside their 1:1 with Iris
  ingestCaucus(author, text) {
    this.addCaucusReply(author, text); this.room.turn++;
    this.lastMessage = { author, text, channel: 'caucus' };
    this.decision = null;
  }
  // ② reflect on the current lastMessage, then ③ loop the act beat until Iris holds
  async react() {
    const delta = await this.updateMemory();            // ② reflect
    this.onEvent?.('memory', delta);
    const acts = [];
    this._turnActs = 0;
    for (let i = 0; i < this.maxSteps; i++) {            // ③ act beat, looped: decide + write until she holds
      const choice = await this.decide();                // decide a tool
      this.onEvent?.('decide', choice);
      if (!choice || choice.tool === 'none') break;      // 'none' = hold, ends the turn
      const effect = await this.act();                   // write its message + call the tool
      this.onEvent?.('act', effect);
      acts.push(effect); this._turnActs++;
    }
    return acts;
  }
  stepper(queue = []) { return new Stepper(this, queue); }

  // ---- primitives (each pass) ----
  ingest(author, text) {
    const msg = { author, text };
    this.room.messages.push(msg); this.room.log.push(`${author}: ${text}`); this.room.turn++;
    this.lastMessage = msg; this.decision = null; return msg;
  }
  addCaucusReply(id, text) { if (this.memory.private[id]) this.memory.private[id].caucus.push({ from: id, text }); }

  async updateMemory() {
    const delta = this.isLive ? await this._modelUpdateMemory() : mockMemory(this._state(), this.lastMessage);
    const author = this.lastMessage && this.lastMessage.author;
    const fields = [...this.surface.shared, ...this.surface.notes];
    // a live model doesn't always honor the array types in the schema — it sometimes returns a keyed
    // object { boromir: {...} } instead of [{ id:'boromir', ... }]. Normalize both shapes to an array
    // so the update is preserved (not dropped) and one bad turn can't crash the loop.
    const asArray = (v) => Array.isArray(v) ? v
      : (v && typeof v === 'object' ? Object.entries(v).map(([id, val]) => (val && typeof val === 'object' ? { id, ...val } : val)) : []);
    const items = asArray(delta.items);
    const privateNotes = asArray(delta.privateNotes);
    items.forEach(patch => {
      let it = this.room.items[patch.id];
      if (!it) it = this.room.items[patch.id] = { id: patch.id, ...structuredClone(this.surface.seedItem || {}), contributions: {} };
      fields.forEach(k => {
        if (!(k in patch) || patch[k] == null) return;
        // options: the model names the course-of-action field inconsistently (option/text/name) in
        // free-form JSON — pin each to { label, by } so the Canvas (which reads `label`) always renders it
        if (k === 'options' && Array.isArray(patch[k])) {
          it[k] = patch[k].map(o => (o && typeof o === 'object')
            ? { label: o.label ?? o.option ?? o.text ?? o.name ?? o.course ?? '', by: o.by ?? o.who ?? o.author }
            : { label: String(o) });
        } else it[k] = patch[k];
      });
      if ('resolution' in patch) it.resolution = patch.resolution;   // allow explicit null
      // MECHANICAL participation: the speaker contributed to each item their message moved
      if (author && author !== 'iris' && !it.contributions[author]) it.contributions[author] = { ...(this.surface.contribution || {}) };
    });
    // an explicit sealed contribution value (e.g. a vote)
    if (delta.contribution && author && this.room.items[delta.contribution.item]) {
      this.room.items[delta.contribution.item].contributions[author] = delta.contribution.value;
    }
    // per-person read: patch the facets Iris revised, and append a shift if she saw them move
    // a flat patch from the model is routed into the three layers of the record
    privateNotes.forEach(p => {
      const rec = this.memory.private[p.id]; if (!rec) return;
      TOM_FACETS.forEach(k => { if (p[k] != null) rec.mind[k] = p[k]; });                 // their mind
      (p.regards || []).forEach(rel => {                                                  // their view of others
        const ex = rec.mind.regards.find(x => x.toward === rel.toward);
        if (ex) ex.note = rel.note; else rec.mind.regards.push({ toward: rel.toward, note: rel.note });
      });
      if (p.confidence != null) rec.confidence = p.confidence;                            // my read
      if (p.watchingFor != null) rec.plan.watchingFor = p.watchingFor;                    // my plan
      if (p.helpNext != null) rec.plan.helpNext = p.helpNext;
      if (p.shift && (p.shift.observed || p.shift.to)) rec.shifts.push({ turn: this.room.turn, ...p.shift });  // trajectory
    });
    return delta;
  }
  async decide() {
    this.decision = this.isLive ? await this._modelDecide() : mockDecision(this._state(), this.lastMessage, this._stance());
    this._introspect(this.decision);   // log her reasoning to iris/introspection, first person
    return this.decision;
  }
  // append a first-person note to Iris's private introspection log — what she decided this beat, and why
  _introspect(choice) {
    if (!choice) return '';
    const p = choice.target && this.participants.find(x => x.id === choice.target);
    const lead = choice.tool === 'none' ? 'I decided to do nothing yet.'
      : choice.tool === 'caucus' ? `I opened a private caucus with ${p ? p.name : choice.target}.`
      : choice.tool === 'post' ? 'I surfaced this to the room.'
      : `I used ${choice.tool}.`;
    const note = `${lead} ${choice.rationale || ''}`.trim();
    this.memory.introspection.push({ tool: choice.tool, target: choice.target || null, note });
    return note;
  }
  async act() {
    const action = this.isLive ? await this._modelAct() : mockAction(this._state(), this.decision, this._stance());
    const tool = this.tools[action.tool];   // 'none' → no tool → no-op
    if (tool) tool.run(this, action);
    return action;
  }

  // ---- context: confidentiality is enforced HERE, by what each audience is allowed to see ----
  _transcript() { return this.room.messages.map(m => `${m.author}: ${m.text}`).join('\n'); }
  _itemsFull() {
    return Object.values(this.room.items).map(it => {
      const shared = this.surface.shared.map(k => `${k}: ${JSON.stringify(it[k])}`).join(', ');
      const notes = this.surface.notes.map(k => `    ${k}: ${it[k] ?? '(none)'}`).join('\n');
      const contribs = Object.entries(it.contributions).map(([p, v]) => `    ${p}: ${JSON.stringify(v)}`).join('\n') || '    (none)';
      return `- [${it.id}] ${shared}\n${notes}${notes ? '\n' : ''}  contributions (sealed):\n${contribs}`;
    }).join('\n');
  }
  _itemsPublic(pid) {
    return Object.values(this.room.items).map(it => {
      const pub = projectItem(it, this.surface);
      const line = Object.entries(pub).filter(([k]) => k !== 'id').map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ');
      const own = (pid && it.contributions[pid]) ? `  · your input: ${JSON.stringify(it.contributions[pid])}` : '';
      return `- [${it.id}] ${line}${own}`;
    }).join('\n');
  }
  _minds(ids) {
    return ids.map(id => {
      const rec = this.memory.private[id], m = rec.mind;
      const reg = (m.regards || []).map(x => `        → ${x.toward}: ${x.note}`).join('\n');
      const shifts = (rec.shifts || []).map(s => `        turn ${s.turn}: ${s.observed}${s.from || s.to ? ` (${s.from || '—'} → ${s.to || '—'})` : ''}`).join('\n');
      return `- ${id}:\n    [theory of mind — my read of their mind · confidence: ${rec.confidence || '—'}]\n      interest: ${m.interest || '—'}\n      position: ${m.position || '—'}\n      beliefs: ${m.beliefs || '—'}\n      arc: ${m.arc || '—'}${reg ? `\n      regards:\n${reg}` : ''}\n    [my plan]\n      watching for: ${rec.plan.watchingFor || '—'}\n      how I can help next: ${rec.plan.helpNext || '—'}${shifts ? `\n    [how they've moved]\n${shifts}` : ''}`;
    }).join('\n');
  }

  context({ audience }) {
    const head = `# ${this.surface.name} — topic: ${this.room.topic}\n\n## transcript\n${this._transcript()}`;
    if (audience === 'self') {                       // the agent's own reasoning — sees everything; output stays in memory
      const caucuses = this.participants.map(p => { const t = this.caucus(p.id); return t.length ? `- with ${p.id}: ${t.map(m => `${m.from === 'iris' ? 'you' : p.id}: ${m.text}`).join(' / ')}` : null; }).filter(Boolean).join('\n') || '(none)';
      return `${head}\n\n## items (full)\n${this._itemsFull()}\n\n## my theory of mind of each participant — sealed (NEVER quote to the room)\n${this._minds(this.participants.map(p => p.id))}\n\n## your 1:1 caucuses\n${caucuses}`;
    }
    if (audience === 'room')                          // a room post — public board only, no sealed anything
      return `${head}\n\n## board (public)\n${this._itemsPublic()}`;
    // a specific participant — public board + only THEIR sealed file + your 1:1 with them
    const caucus = this.caucus(audience).map(m => `${m.from === 'iris' ? 'you' : audience}: ${m.text}`).join('\n') || '(none yet)';
    return `${head}\n\n## board (public)\n${this._itemsPublic(audience)}\n\n## my read of ${audience}'s mind (sealed)\n${this._minds([audience])}\n\n## your 1:1 with ${audience}\n${caucus}`;
  }
  _scopedContext(action) {
    const tool = this.tools[action && action.tool];
    return (tool && tool.audience === 'person' && action.target) ? this.context({ audience: action.target }) : this.context({ audience: 'room' });
  }

  // schema for a memory update — derived from the surface, so a new item can never
  // come back without its label (title). This is enforced at the model call, not patched after.
  _memorySchema() {
    const s = this.surface, labelKey = s.shared[0], f = s.fields || {};
    const itemProps = { id: { type: 'string', description: 'stable slug id for the item' } };
    // a field's schema comes from surface.fields when given, else sensible defaults (enum for status, non-empty label, string otherwise)
    const schemaFor = (k) => f[k] ? f[k]
      : k === labelKey ? { type: 'string', minLength: 1, description: 'short human title — never empty' }
      : k === 'status' ? { type: 'string', enum: s.statuses }
      : { type: 'string' };
    s.shared.forEach(k => { itemProps[k] = schemaFor(k); });
    s.notes.forEach(k => { itemProps[k] = schemaFor(k); });
    return {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: itemProps, required: ['id', labelKey] } },
        contribution: { type: 'object', properties: { item: { type: 'string' }, value: { type: 'object' } } },
        // my private read of each participant who moved this turn — in my own voice, first person
        privateNotes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'participant id' },
              interest: { type: 'string', description: 'the durable need I read under their positions (their desire/goal)' },
              position: { type: 'string', description: 'what they are stating/advocating right now (their committed stance)' },
              beliefs: { type: 'string', description: 'what they hold true or ASSUME about the situation — especially false assumptions worth surfacing' },
              arc: { type: 'string', enum: ['digging in', 'softening', 'converging', 'quiet'] },
              confidence: { type: 'string', enum: ['hunch', 'forming', 'confirmed'] },
              watchingFor: { type: 'string', description: "the open question I'm tracking about them" },
              helpNext: { type: 'string', description: 'how I can help them next, and when' },
              regards: {
                type: 'array',
                description: 'group dynamics: how this person regards specific OTHERS (directional, part of their mind). Update when someone reveals or acts on what they think of another.',
                items: { type: 'object', properties: { toward: { type: 'string', description: 'the other participant id' }, note: { type: 'string', description: 'how they regard that person' } }, required: ['toward', 'note'] },
              },
              shift: { type: 'object', description: 'only if they moved this turn', properties: { observed: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } } },
            },
            required: ['id'],
          },
        },
      },
      required: ['items'],
    };
  }
  async _modelUpdateMemory() {
    const s = this.surface;
    const sys = `${this.policy}\n\nTASK: update memory after the newest message on the "${s.name}" surface. RULE #1 — you MUST return a privateNotes entry for the participant who just spoke: a substantive message ALWAYS reveals their interest and position, so form or refresh their read (build it from scratch if it was empty). Never leave the speaker unchanged; do not return an empty update after a real message. Also return items (each with a non-empty title), an optional sealed contribution, and privateNotes for anyone else whose read changed. IMPORTANT: if the newest message raises a distinct question or topic that no existing item covers — even a minor, light, or seemingly off-topic one (e.g. a suggestion about lunch during a serious meeting) — you MUST open a NEW item for it (a fresh id + short title), in addition to updating existing items. A group can track several decisions at once. Statuses: ${s.statuses.join(' | ')}.${s.shared.includes('options') ? ' For each decision keep `options` current: the distinct courses of action on the table. When someone proposes or names a course of action (e.g. Boromir: "why not use the Ring?" → { "label": "use the Ring against Sauron", "by": "boromir" }), add it. Each option is { "label", "by" }: label is the course of action itself (the exact key is "label", NOT "option"/"text"/"name"), by is the id of whoever proposed it (options are PUBLIC positions). Return the COMPLETE options list each time as [{ "label", "by" }], preserving prior ones.' : ''} notes (${s.notes.join(', ') || 'none'}) are your private, DE-IDENTIFIED synthesis (no names — may reach the room). privateNotes update my private read of a participant, written in MY OWN voice, first person ("I read…", "I'll watch…") — NEVER addressed to them (no "you"), never shown to anyone. This has THREE layers: (1) THEIR MIND — my theory of mind of them (interest, position, beliefs, arc, regards); (2) MY CONFIDENCE — how sure I am; (3) MY PLAN — watchingFor (the open question I'm tracking) and helpNext (how I can help them next). ALWAYS form or update the read of WHOEVER JUST SPOKE — a substantive message always reveals something, so give at least their interest and position (build a fresh read from scratch if I had none); never no-op on the speaker. Also update anyone else whose read changed. For each, return { id, interest (the durable need under their position — their desire, slow to change), position (what they're advocating now — their committed stance), beliefs (what they hold true or ASSUME — especially false assumptions worth surfacing, e.g. "assumes the others can all afford it"), arc (${['digging in', 'softening', 'converging', 'quiet'].join(' | ')} — their disposition), confidence (hunch | forming | confirmed — MY certainty, not a fact about them), watchingFor (the open question I'M tracking), helpNext (how I can help them next, and when), regards (how this person regards specific OTHERS — part of their mind, directional: e.g. Boromir regards Aragorn "dismisses him as a mere ranger", Legolas regards Aragorn "reveres him as Isildur's heir"; update whenever someone reveals or acts on what they think of another, as [{ toward, note }]), and if they moved this turn a shift { observed, from, to }. If the newest message is a PRIVATE CAUCUS REPLY, that is where specifics get pinned — capture the concrete answer they gave into their mind (update their position/interest/beliefs and log a shift), and set helpNext to reflect that you now have it. Only include people who actually changed. Participant ids: ${this.participants.map(p => p.id).join(', ')}.`;
    const chan = this.lastMessage.channel === 'caucus' ? ' (private caucus reply to me)' : '';
    // plain JSON, NOT forced tool-use: on this nested schema the tool-call path intermittently
    // garbles `items` into XML-tag junk. safeJson + the merge's coercion handle the free-form result.
    return safeJson(await this.model({ system: sys, prompt: `${this.context({ audience: 'self' })}\n\nNewest — ${this.lastMessage.author}${chan}: ${this.lastMessage.text}\n\nUpdate memory. Return ONLY valid JSON — no prose, no markdown, no XML/<tags> — of shape { "items": [ { "id", "title", "status", "options"?: [{ "label", "by" }], ...notes } ], "contribution"?, "privateNotes": [ { "id", "interest"?, "position"?, "beliefs"?, "arc"?, "confidence"?, "watchingFor"?, "helpNext"?, "regards"?, "shift"? } ] }.` }));
  }
  async _modelDecide() {
    const toolList = Object.values(this.tools).map(t => `"${t.name}" — ${t.description}`).join('; ');
    const names = [...Object.values(this.tools).map(t => t.name), 'none'];
    const schema = { type: 'object', properties: { tool: { type: 'string', enum: names }, target: { type: ['string', 'null'] }, rationale: { type: 'string' } }, required: ['tool', 'rationale'] };
    const sys = `${this.policy}\n\nTASK: choose your next tool. Available: ${toolList}. Or "none" to stay peripheral (the default). Follow your stance as written in the policy. Write "rationale" as a short first-person note to yourself — your private reasoning for this beat (it goes in your introspection log), e.g. "Only one person has spoken; nothing to converge yet, so I'll wait."`;
    return safeJson(await this.model({ system: sys, schema, prompt: `${this.context({ audience: 'self' })}\n\nChoose a tool.` }));
  }
  async _modelAct() {
    const d = this.decision || { tool: 'none' };
    const ctx = this._scopedContext(d);
    const schema = { type: 'object', properties: { tool: { type: 'string' }, target: { type: ['string', 'null'] }, text: { type: 'string', minLength: 1 } }, required: ['tool', 'text'] };
    // a caucus is for DISCOVERY: pin the specific first; only surface once you already have it
    const caucusGuide = d.tool === 'caucus'
      ? ' A caucus is for DISCOVERY. Read your 1:1 history with them: if you have NOT yet pinned the SPECIFIC under their position (a number, a threshold, a named condition), ask ONE concrete question to get it — "too expensive" → "what price would work?"; "wield the Ring" → "what would Gondor actually need to hold — men, an alliance, a plan?". Do NOT restate what they already said, and do NOT offer to carry anything to the room. Only once you ALREADY have the specific may a caucus ask whether you may surface it, de-identified.'
      : '';
    const sys = `${this.policy}\n\nTASK: write the message for tool "${d.tool}"${d.target ? ` (to ${d.target})` : ''}.${caucusGuide} Write in the stance your policy describes. You can only see what this audience may draw on — never attribute or quote anything not present in the context below.`;
    return safeJson(await this.model({ system: sys, schema, prompt: `${ctx}\n\nWrite the message.` }));
  }
}

// ---- Stepper: a debug harness over IrisAgent, with prev/next + undo history ----
export class Stepper {
  constructor(agent, queue = []) {
    this.agent = agent; this.queue = queue; this.qi = 0;
    this.phase = 'msg'; this.changed = new Set();
    this.decision = null; this.label = 'ready';
    this.history = []; this.cursor = -1;
    this._push('start');
  }
  _snap(label) {
    return {
      room: structuredClone(this.agent.room), memory: structuredClone(this.agent.memory),
      lastMessage: this.agent.lastMessage ? { ...this.agent.lastMessage } : null,
      decision: this.agent.decision ? { ...this.agent.decision } : null,
      lastAction: this.lastAction ? { ...this.lastAction } : null,
      turnActs: this.agent._turnActs || 0,
      qi: this.qi, phase: this.phase, changed: [...this.changed], label,
    };
  }
  _push(label) { this.history.push(this._snap(label)); this.cursor = this.history.length - 1; this.label = label; }
  _restore(s) {
    this.agent.room = bindRoom(structuredClone(s.room), this.agent.surface); this.agent.memory = structuredClone(s.memory);
    this.agent.lastMessage = s.lastMessage; this.agent.decision = s.decision; this.agent._turnActs = s.turnActs || 0;
    this.qi = s.qi; this.phase = s.phase; this.changed = new Set(s.changed);
    this.decision = s.decision; this.lastAction = s.lastAction || null; this.label = s.label;
  }
  get canPrev() { return this.cursor > 0; }
  get canRedo() { return this.cursor < this.history.length - 1; }
  get nextLabel() {
    if (this.canRedo) return 'redo ▶';
    if (this.phase === 'msg') { const p = this.queue[this.qi]; return p ? `① ${p.author} speaks` : '① (end)'; }
    if (this.phase === 'reflect') return '② Iris updates memory';
    return '③ Iris introspects & acts';   // phase 'act' — reason (→ introspection) then post / caucus / hold
  }
  _memState() {
    const a = this.agent, items = {}, reads = {};
    Object.values(a.room.items).forEach(it => { items[it.id] = { pub: JSON.stringify(projectItem(it, a.surface)), notes: JSON.stringify(pick(it, a.surface.notes)) }; });
    a.participants.forEach(p => { const r = a.memory.private[p.id]; reads[p.id] = JSON.stringify([r.mind, r.confidence, r.plan, r.shifts]); });   // mutated in place → compare serialized
    return { items, count: Object.keys(a.room.items).length, reads };
  }
  _diff(before) {
    const a = this.agent, s = new Set();
    if (before.count !== Object.keys(a.room.items).length) s.add('canvas');
    Object.values(a.room.items).forEach(it => {
      const b = before.items[it.id];
      if (!b) { s.add('canvas'); s.add('item/' + it.id); return; }
      if (b.pub !== JSON.stringify(projectItem(it, a.surface))) s.add('canvas');       // public change
      if (b.notes !== JSON.stringify(pick(it, a.surface.notes))) s.add('item/' + it.id); // private notes change
    });
    a.participants.forEach(p => { const r = a.memory.private[p.id]; if (before.reads[p.id] !== JSON.stringify([r.mind, r.confidence, r.plan, r.shifts])) s.add('user/' + p.id); });
    return s;
  }
  async next(inject) {
    if (this.canRedo) { this.cursor++; this._restore(this.history[this.cursor]); return this.label; }
    if (this.phase === 'msg') {
      // ① a human line enters the room (from the queue, or injected via the composer)
      let m = inject;
      if (!m) { if (this.qi >= this.queue.length) return null; m = this.queue[this.qi++]; }
      this.agent.ingest(m.author, m.text); this.agent._turnActs = 0;
      this.changed = new Set(['log']); this.decision = null; this.lastAction = null;   // the transcript grew
      this.phase = 'reflect'; this.label = `① ${m.author} spoke`;
    } else if (this.phase === 'reflect') {
      // ② Iris reads the line and updates her memory — items, heartbeats, de-identified reads
      const before = this._memState(); await this.agent.updateMemory(); this.changed = this._diff(before);
      this.phase = 'act'; this.label = this.changed.size ? '② Iris updated her memory' : '② Iris updated her memory — no change';
    } else {
      // ③ Iris decides AND writes in one beat. Holds → turn ends; acts → she may act again.
      const choice = await this.agent.decide(); this.decision = choice;   // decide() also logs to iris/introspection
      const note = this.agent.memory.introspection[this.agent.memory.introspection.length - 1]?.note;
      if (!choice || choice.tool === 'none') {
        this.lastAction = { tool: 'none', rationale: choice && choice.rationale, note };
        this.changed = new Set(['introspection']); this.phase = 'msg';   // she still wrote to her introspection log
        this.label = '③ Iris held — nothing to do';
      } else {
        const a = await this.agent.act(); this.lastAction = { ...a, rationale: choice.rationale, note }; this.agent._turnActs++;
        this.changed = a.tool === 'post' ? new Set(['log', 'introspection']) : new Set(['introspection']);   // a caucus grows a private thread, not the public log
        // honor maxSteps: once she's used her actions this turn, end it — no redundant "anything else?" hold beat
        this.phase = this.agent._turnActs >= this.agent.maxSteps ? 'msg' : 'act';
        this.label = `③ Iris ${a.tool === 'post' ? 'posted to the room' : a.tool === 'caucus' ? 'caucused → ' + a.target : a.tool}`;
      }
    }
    this._push(this.label);
    return this.label;
  }
  prev() { if (this.cursor > 0) { this.cursor--; this._restore(this.history[this.cursor]); } }
  record(label) { this.phase = 'msg'; this.decision = null; this._push(label); }   // snapshot after an out-of-band turn (e.g. a caucus reply)
  goto(n) { if (n >= 0 && n < this.history.length) { this.cursor = n; this._restore(this.history[n]); } }

  // ---- persistence: snapshots are plain data (structuredClone drops the canvas getter), so JSON-safe ----
  serialize() { return { history: this.history, cursor: this.cursor, qi: this.qi }; }
  load(data) {
    if (!data || !Array.isArray(data.history) || !data.history.length) return false;
    this.history = data.history;
    this.cursor = Math.min(data.cursor ?? this.history.length - 1, this.history.length - 1);
    this._restore(this.history[this.cursor]);
    return true;
  }
}
