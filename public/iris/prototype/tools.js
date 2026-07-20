// tools.js — default facilitation tools.
// These are DEFAULTS, not primitives: provided out of the box (like a hosted web_search),
// registered like any tool, and swappable/extendable. A tool is:
//   { name, audience, description, run(agent, args) }
// `audience` is load-bearing: it tells the runtime whose information a message may draw on, which
// is how confidentiality gets enforced at context-assembly time (see IrisAgent._scopedContext).
//   'room'   → everyone sees it; the model must not see any sealed per-person read.
//   'person' → only the target sees it; the model may see that one person's sealed file, no others.

export const postTool = {
  name: 'post',
  audience: 'room',
  description: 'Speak to the whole room. Everyone sees it.',
  run(agent, { text }) {
    if (!text) return { channel: 'room', text: '' };
    agent.room.messages.push({ author: 'iris', text });
    agent.room.log.push(`iris: ${text}`);
    return { channel: 'room', text };
  },
};

export const caucusTool = {
  name: 'caucus',
  audience: 'person',
  description: 'Send a private 1:1 DM to one person. Sealed from everyone else.',
  run(agent, { target, text }) {
    if (target && text && agent.memory.private[target]) agent.memory.private[target].caucus.push({ from: 'iris', text });
    return { channel: 'caucus', target, text };
  },
};

export const defaultTools = [postTool, caucusTool];
