// surfaces.js — the co-owned artifact schema. A surface is what varies between collaboration
// agents; the substrate handles items, participation, projection, and confidentiality generically.
//
// A surface declares:
//   shared        — public field names on an item (everyone sees)
//   notes         — the agent's private field names (its working synthesis; never projected)
//   contribution  — the shape of a per-participant SEALED contribution on an item
//   statuses      — the status vocabulary (lifecycle)
//   fields        — (optional) per-field JSON Schema for the model. Fields not listed default to
//                   { type:'string' } (status defaults to an enum of `statuses`). This is how a
//                   field can be richer than a string — e.g. an array of proposals.
//   seedItem      — default field values for a new item
//   aggregate(contribs) — turns the sealed contributions into DE-IDENTIFIED public fields
//
// The public projection of an item is: its `shared` fields + aggregate(contributions).
// `notes` and the raw contributions never cross to the room — that's where the surface meets
// the confidentiality boundary.

export const decisions = {
  name: 'decisions',
  shared:  ['title', 'options', 'status', 'resolution'],
  notes:   ['heartbeat', 'read'],
  contribution: { stance: '' },
  statuses: ['gathering', 'groan', 'converging', 'decided'],
  fields: {
    title: { type: 'string', minLength: 1, description: 'short title for the decision (the question on the table)' },
    // the courses of action on the table. A proposal stated openly in the room is a PUBLIC position,
    // so it is attributed — unlike the private `read` (interest), which stays de-identified.
    options: {
      type: 'array',
      description: 'the distinct courses of action proposed for this decision. Whenever someone proposes or names a course of action, add it. Return the COMPLETE current list each time (keep prior options).',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'the proposal in a few words, e.g. "destroy the Ring in Mount Doom"' },
          by:    { type: 'string', description: 'name of who proposed it (a public position, so attributed)' },
        },
        required: ['label'],
      },
    },
    resolution: { type: ['string', 'null'], description: 'the chosen course, once status is decided; otherwise null' },
  },
  seedItem: { title: '', options: [], status: 'gathering', resolution: null, heartbeat: '', read: '' },
  aggregate: (contribs) => ({ weighedIn: contribs.length }),
};

// A secret ballot: individual votes are sealed contributions; only the tally is ever public.
export const poll = {
  name: 'poll',
  shared:  ['question', 'options', 'status', 'winner'],
  notes:   [],
  contribution: { vote: null },
  statuses: ['open', 'closed'],
  seedItem: { question: '', options: [], status: 'open', winner: null },
  aggregate: (contribs) => {
    const tally = {};
    contribs.forEach(c => { if (c.vote) tally[c.vote] = (tally[c.vote] || 0) + 1; });
    return { tally, votes: contribs.length };
  },
};
