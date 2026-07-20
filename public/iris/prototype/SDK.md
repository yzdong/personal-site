# Iris SDK — design

The prototype is split into two layers. This doc surfaces the **SDK layer** (the agent), which
is UI-agnostic and lives in `iris-sdk.js`. The display layer (`index.html`) only calls into it.
The polished version of this doc is `SDK.html`.

```
policy.md ─┐
model      ├─►  IrisAgent  ─►  memory (room.md + users/*.md)  ─►  actions (caucus / post)
           ┘         ▲                                                  │
                     └──────────────── the loop ◄───────────────────────┘
```

Behavior is a **pure function of two swappable inputs** — `policy` and `model` — over the current
memory. Swap either and the next beat behaves differently. The coach↔facilitator stance is **not**
a separate knob — it's just what the policy says, so it ships as two default policies
(`policy-facilitator.md`, `policy-coach.md`) you load or fork.

---

## Driving it

`run(event)` is the default: a trigger fires one turn, run to completion.

```js
const iris = new IrisAgent({ policy, users, room, model });
const acts = await iris.run({ type: 'message', author: 'boromir', text: 'Why not use the Ring?' });
// effects (post / caucus / canvas) delivered; run() returns the acts taken this turn
```

The event is the trigger: `{ type:'message', author, text }` today; timers/webhooks slot in the same
way. Within a turn, `run` **updates memory** once, then loops the **introspect & act** beat — reason,
then post / caucus / hold — until Iris chooses `none`, bounded by `maxSteps`.

Stepping one beat at a time is a **debug** affordance, not the default — get a `Stepper`:

```js
const step = iris.stepper(MESSAGE_QUEUE);
await step.next();  // ① a human event — a line enters the room
await step.next();  // ② Iris updates memory
await step.next();  // ③ Iris introspects & acts — reason (→ introspection log) then post / caucus / hold
step.prev();        // real undo (snapshot history)
```

## The cycle (human event → update memory → introspect & act)

| beat | trigger / method | LLM? | what it does |
|---|------|------|--------------|
| ① **human event** | `ingest(author, text)` | no | a line enters the room — appended to `room.md`; this starts the turn |
| ② **update memory** | `updateMemory()` | yes | open / advance / close any decisions this line moves; re-derive their `heartbeat` + `read` |
| ③ **introspect & act** | `decide()` + `act()` | yes | reason privately (`decide()` writes a first-person note to the introspection log), then act on it — `post`, `caucus`, or `none` (hold) — writing the message in the same beat |

**Introspection and action are one beat.** `decide()` is the introspection half — it logs why she's
about to act (or hold) to `iris/introspection/log.md` — and `act()` is the doing half. A decision
without its message is half an action, so the stepper stops *after* the message is written. `none`
is **hold** — she reasoned, and chose to stay peripheral. `maxSteps` bounds actions per turn (the app
sets `1`, so one action ends the turn).

Two tools: `post` (speak to the room) and `caucus` (a private 1:1 DM); `none` stays peripheral.
Coaching and facilitating both use `caucus` — the policy stance shapes the words.

---

## Memory model — Decision is the primitive

The unit of facilitation is the **Decision**, not the channel (a channel holds several, each with
its own memory). The Canvas is those decisions projected to the group, de-identified.

- **`policy` (global)** — the system prompt. Passed in and mutable.
- **`room` (per channel)** — `{ topic, log[], messages[], items{} }` — a container of all surface items.
- **`item` (the primitive; a `Decision` on the `decisions` surface)** — `{ id, title, options[], status, heartbeat, read, weighedIn[], resolution }`.
  Per-item `heartbeat`/`read`; `options` are the courses of action on the table (`{ label, by }`,
  each an **attributed public position** — they show on the Canvas); `weighedIn` is tracked
  **mechanically** (SDK sees who spoke); `resolution` goes on the record when `status` reaches decided.
  The generic runtime noun is **item**; on the `decisions` surface an item is a **Decision** — same object, domain name.
- **`people` (per participant)** — `{ [id]: { mind, confidence, plan, shifts[], caucus[] } }`, built from
  `participants`. In *her* voice, never addressed to them, never shown to anyone. It has three honest
  layers so only the first is truly a theory of mind:
  - **`mind`** (theory of mind, BDI) — `{ interest (desire), position (intention), beliefs (what they
    assume), arc (disposition), regards[{ toward, note }] (how they see the others) }`.
  - **`confidence`** — how sure *Iris* is of that read (`hunch | forming | confirmed`); meta, not a fact
    about them.
  - **`plan`** — `{ watchingFor (the open question she's tracking), helpNext (how she can help them next) }`;
    her agency, **not** their mind.
  - **`shifts[]`** — an append-only, turn-stamped log of how their mind moved (`{ turn, observed, from, to }`).

  She patches facets and appends shifts rather than rewriting. **Positions are attributed; interests are
  de-identified** when surfaced.
- **`introspection` (Iris's own)** — `memory.introspection[]`, a first-person log of what she decided
  each act beat and why (`iris/introspection/log.md`). Written every beat, including a hold. Private —
  it never leaves memory; the group never sees it.
- **`room.canvas` (projection)** — `iris.room.canvas` = `{ id, title, status, weighedIn, resolution }[]`,
  a live getter on `room`, de-identified. The private `read` never leaves memory. Confidentiality as
  data flow: *sealed people files → per-decision read → de-identified Canvas.*

SDK owns the mechanics (identity, scoped memory, participation, status/resolution slots); the
policy owns the status vocabulary; the model owns the judgment (when to open/advance/close).

## Confidentiality — enforced in context

Not a prompt request — a property of what each model call may see. Context assembles in three tiers:

- **full** — every sealed read; used only for Iris's private beats (`reflect`, `decide`).
- **person** — transcript + de-identified decisions + only that one person's sealed file; for a `caucus`.
- **base** — transcript + de-identified decisions, no sealed reads; for a `post`.

A room `post` is composed with no sealed read in context, so it can't leak what it can't see. The
acting tool's `audience` selects the tier. `iris.room.canvas` is the display-level projection of the same.

## Tools

The action space is a registry, not a fixed set. A tool is
`{ name, audience: 'room'|'person', description, run(agent, args) }`. Defaults in `tools.js` are
`post` (audience `room`) and `caucus` (audience `person`) — swappable/extensible via the `tools`
option. `audience` selects the confidentiality tier above, so a new tool's visibility follows for free.

---

## Inputs

```js
new IrisAgent({ policy, users, room, model, tools?, maxSteps?, onEvent? })
```

- **`policy`** — full text of a policy file. Injected as the system prompt on every model call.
  The stance (facilitator / coach) is just prose in the policy — swap the file to change it.
- **`participants`** — `[{ id, name, role, read }]`. Seeds one sealed `people/<id>` file each.
- **`room`** — seed `{ topic, items{}, log }`.
- **`surface`** — the item schema (defaults to `decisions`; see Surfaces).
- **`model`** — the injected adapter: `async ({ system, prompt, schema? }) => string`. Omit → offline mocks.
- **`tools`** — tool registry; defaults to `[post, caucus]`. **`maxSteps`** — actions/turn (default 6).
  **`onEvent`** — `(type, payload) => void` stream of `memory` / `decide` / `act`.

## Models

The model is the whole abstraction; the agent never sees keys or endpoints. Built-in adapters
in `models.js`, each a factory returning `({system, prompt}) => Promise<string>`:

- `openrouter({ apiKey, model })` — one key, any vendor (`'anthropic/claude-opus-4'`, `'openai/gpt-5'`).
- `anthropic({ apiKey, model })` — Claude direct.
- `proxy({ url?, model })` — local proxy that keeps the key server-side (`.env`); pair with `serve.py`.
- *(omit)* — offline mocks from the scenario; still stance-aware.

Browser-direct adapters expose the key to the page — fine for a local prototype, use `proxy`
(or your own backend) otherwise.

---

## Data shapes

```js
message  = { author, text }
Decision = { id, title, options[], status, heartbeat, read, weighedIn[], resolution }  // the item primitive
Record   = { mind:{ interest, position, beliefs, arc, regards:[{toward,note}] }, confidence, plan:{ watchingFor, helpNext }, shifts:[{turn,observed,from,to}] }  // Iris's per-person record
delta    = { items: Partial<Decision>[], contribution?, privateNotes: [{ id, interest?, position?, beliefs?, arc?, confidence?, watchingFor?, helpNext?, regards?, shift? }] } // ② reflect — flat patch, routed into the layers
choice   = { tool: 'none'|'post'|'caucus', target: id|null, rationale }             // ③ act · decide
action   = { tool: 'none'|'post'|'caucus', target: id|null, text }                  // ③ act · write
```

`Decision` (the durable primitive on the Canvas) ≠ `choice` (what `decide()` returns each beat).

Each LLM beat is bound to a **JSON Schema** (`items[]` requires a non-empty `title`, `tool` is an
enum, `text` is non-empty). A wired model returns it via forced tool-calling, so a decision can't
come back malformed; `safeJson()` then parses defensively (a bad response degrades to `{}`).

---

## Extending it

- **A new surface** — the real extension point. Beyond `decisions` and `poll`, author a co-owned
  artifact for whatever a group builds together: `tasks` (assignee / done), `availability`
  ("N of M free"), `concerns` (de-identified), `terms` (agreed clauses). Declare
  `{ shared, notes, contribution, statuses, fields, seedItem, aggregate }` and the substrate gives you
  items, participation, projection, and confidentiality for free — `aggregate` is where you decide
  what stays sealed and what reaches the room.
- **A different agent** — swap the `surface` + `policy` (+ any custom `tools`) and the same class is a
  different collaboration agent: a standup bot (`tasks` + a nudging policy), a neutral vote-teller
  (`poll` + a neutral policy). Policy = how it thinks; surface = what it builds; tools = what it can
  do; the multi-principal plumbing never changes. To retune wording without a new policy, edit the
  per-beat task strings in `_modelUpdateMemory` / `_modelDecide` / `_modelAct`.
- **Undo / redo** — the `Stepper` snapshots `{room, memory, decision, lastAction, phase}` before each
  beat so `prev` / `next` navigate a history stack without recomputation.

The demo is driven by `scenario-elrond.js` (`participants`, `room`, `MESSAGE_QUEUE`, `mock*` fns);
a live model is any `({ system, prompt, schema? }) => Promise<string>` you inject.
