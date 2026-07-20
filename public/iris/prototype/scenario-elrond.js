// scenario-elrond.js — seed data for the Council of Elrond.
// The public messages are scripted; Iris's memory/decisions/actions are produced by the SDK
// (live via the model when an API key is set, or via lightweight mocks offline).

export const SCENARIO = "The Council of Elrond, Rivendell. The free peoples convene to decide the fate of the One Ring.";

// The participants — just who's in the room. Iris starts with NO read of anyone; she builds her
// theory of mind of each person from scratch as they speak (the people/* files begin empty).
export const PARTICIPANTS = [
  { id: "elrond",  name: "Elrond",  role: "Host · Lord of Rivendell", color: "#6b4eb8" },
  { id: "gandalf", name: "Gandalf", role: "Wizard", color: "#4a5fa5" },
  { id: "boromir", name: "Boromir", role: "Gondor · the Steward's heir", color: "#b07b1e" },
  { id: "aragorn", name: "Aragorn", role: "Ranger · heir of Isildur", color: "#2c7a6f" },
  { id: "frodo",   name: "Frodo",   role: "Ring-bearer · Shire", color: "#c0574a" },
  { id: "gimli",   name: "Gimli",   role: "Dwarf of Erebor", color: "#8a5a2b" },
  { id: "legolas", name: "Legolas", role: "Elf of Mirkwood", color: "#3f9488" },
  { id: "gloin",   name: "Glóin",   role: "Dwarf elder", color: "#9a7b3a" },
];

// Seed room: just the channel topic. No decisions yet — Iris opens them as the topic emerges.
export const ROOM = {
  topic: "The fate of the One Ring",
  items: {},
};

// Scripted public messages, pulled one at a time by pass ①.
export const MESSAGE_QUEUE = [
  { author: "gloin",   text: "I bring dark news from Erebor. A messenger of Mordor came — offering us rings, and asking after a hobbit, and a ring he once carried." },
  { author: "elrond",  text: "Then the hour is later than we feared. I have called you here to decide the fate of this: the One Ring." },
  { author: "gandalf", text: "It cannot be used for good; its nature is to corrupt. It must be unmade — cast back into the fire of Mount Doom, where it was made." },
  { author: "boromir", text: "Why not use it? Give Gondor the weapon of the Enemy and let us wield it against him. My people bleed while we sit and talk." },
  { author: "aragorn", text: "You cannot wield it. None of us can. The Ring answers to Sauron alone." },
  { author: "boromir", text: "And what would a ranger know of this matter?" },
  { author: "legolas", text: "This is no mere ranger. He is Aragorn, heir of Isildur. You owe him your allegiance." },
  { author: "gimli",   text: "Then let us be rid of it now! (he strikes the Ring with his axe — the axe shatters)" },
  { author: "elrond",  text: "The Ring cannot be destroyed by any craft we possess. It must be taken deep into Mordor, to the Cracks of Doom." },
  { author: "boromir", text: "One does not simply walk into Mordor. Its black gates are guarded by more than just orcs." },
  { author: "gimli",   text: "I will be dead before I see the Ring in the hands of an elf!  (the council erupts in argument)" },
  { author: "frodo",   text: "I will take it. I will take the Ring to Mordor. Though… I do not know the way." },
];

// ---- Offline mocks (used only when no API key is set) --------------------------------
// Just enough to make the loop demo without a model, and to show that the policy's stance
// (facilitator vs coach) changes the action. Live mode replaces all of this with real model output.

const norm = (s) => (s || "").toLowerCase();
const affirmative = (s) => /\b(yes|yeah|yep|ok|okay|sure|please|go ahead|do it|agreed?|fine|absolutely|alright)\b/i.test(s || "");

export function mockMemory(state, lastMsg) {
  const t = norm(lastMsg && lastMsg.text);
  const who = lastMsg && lastMsg.author;
  // a private reply from a participant, inside their caucus with Iris
  if (lastMsg && lastMsg.channel === "caucus") {
    const txt = lastMsg.text;
    let patch;
    if (affirmative(txt)) {
      patch = { id: who, confidence: "confirmed", helpNext: "Surface their interest to the room now, de-identified.",
        shift: { observed: "Agreed in caucus to let me carry it.", from: "holding it privately", to: "willing to have it surfaced" } };
    } else if (/\d/.test(txt) || txt.split(/\s+/).length >= 4) {
      // they gave me a concrete specific — capture it into their mind and move toward consent
      patch = { id: who, position: `Named a concrete ask in caucus: "${txt}"`, confidence: "confirmed",
        helpNext: "I have the specific now — next, ask if I may carry it to the room, de-identified.",
        shift: { observed: `Gave me the specific: "${txt}"`, from: "a vague position", to: "a concrete ask" } };
    } else {
      patch = { id: who, watchingFor: `Still working it through with them privately.` };
    }
    return { items: [], privateNotes: [patch] };
  }
  const d = { items: [], privateNotes: [] };
  if (t.includes("dark news") || (who === "gloin" && t.includes("erebor"))) {
    // Glóin opens with the news — Iris forms a first read of him (snapshot of the live run)
    d.privateNotes.push({ id: "gloin",
      interest: "The safety and standing of his people at Erebor under mounting pressure from Mordor.",
      position: "Sounding the alarm — bringing the enemy's overture into the open.",
      beliefs: "Assumes the council must reckon with the threat; treats Mordor's offer as a danger to report, not a temptation to weigh.",
      arc: "forming", confidence: "forming",
      watchingFor: "Whether Erebor's exposure gets lost once the room turns wholly to the Ring.",
      helpNext: "Keep Erebor's exposure on the table so it isn't stepped past.",
      shift: { observed: "He brought the news of Mordor's messenger.", from: "unheard", to: "raised the alarm" } });
  } else if (t.includes("decide the fate") || t.includes("fate of this")) {
    // Elrond frames the choice — Iris opens the decision (with a title) and forms a read of the convener
    d.items.push({ id: "ring", title: "What to do with the One Ring", status: "gathering",
      heartbeat: "Elrond has framed the choice. No positions yet; watch for the real blocker." });
    d.privateNotes.push({ id: "elrond",
      interest: "A decision the whole council owns — one that holds because everyone reached it, not because he imposed it.",
      position: "Put the choice to the room and let it be decided here, together.",
      beliefs: "Assumes the burden must be shared freely; a course forced on anyone won't hold. Trusts the room to arrive if given space.",
      arc: "quiet", confidence: "forming",
      watchingFor: "Whether he stays neutral, or leans on his authority once the room splits.",
      helpNext: "Protect the space he's opening — hold the silences so quieter voices reach it too.",
      shift: { observed: "He convened the council and framed the choice.", from: "unheard", to: "opened the decision to the room" } });
  } else if ((t.includes("use it") || t.includes("wield")) && !t.includes("cannot")) {
    // regression into the groan zone on the Ring decision — Boromir's proposal joins the table
    d.items.push({ id: "ring", status: "groan",
      options: [
        { label: "Destroy it in the fire of Mount Doom", by: "gandalf" },
        { label: "Wield the Ring against Sauron", by: "boromir" },
      ],
      heartbeat: "The council keeps getting steered toward wielding the Ring; it is derailing.",
      read: "The plan isn't the real blocker — the push to wield the Ring is grief for a homeland that fights alone, not conviction." });
    d.privateNotes.push({ id: "boromir",
      interest: "Save Gondor — his people bleed alone against Mordor while the council deliberates.",
      position: "Wield the Ring against Sauron.",
      beliefs: "Assumes the Ring's power can be turned against the Enemy — that a strong hand could master it for good.",
      arc: "digging in", confidence: "confirmed",
      helpNext: "Name the need under his position — de-identified — so the room hears the need, not the Ring.",
      shift: { observed: "He pushed to wield the Ring for Gondor.", from: "quiet", to: "wield it against Sauron" } });
  } else if (t.includes("cannot be destroyed") || t.includes("cracks of doom") || (t.includes("taken") && t.includes("mordor"))) {
    // close the Ring decision AND open a distinct one — "detected a decision"
    d.items.push({ id: "ring", status: "decided",
      heartbeat: "Settled: the Ring must be unmade. It cannot be used or kept.",
      resolution: "Destroy it in the fire of Mount Doom, where it was made." });
    d.items.push({ id: "carrier", title: "Who carries the Ring to Mordor", status: "gathering",
      heartbeat: "Newly open. Destroying it is decided; who bears it is not. A silence is coming.",
      read: "No one will volunteer for a suicide errand. Expect a silence; hold it, don't let the loudest fill it." });
  } else if (t.includes("unmade") || (t.includes("fire") && t.includes("mount doom"))) {
    d.items.push({ id: "ring", status: "converging",
      options: [{ label: "Destroy it in the fire of Mount Doom", by: "gandalf" }],
      heartbeat: "Gandalf names the only real option: the Ring must be unmade, not used.",
      read: "The group is close to converging on destroy-it. Watch for whoever isn't ready to let go of using it." });
    d.privateNotes.push({ id: "gandalf",
      interest: "The council must arrive at unmaking the Ring themselves, not be commanded to it.",
      position: "The Ring cannot be used — it must be destroyed in the fire where it was made.",
      beliefs: "Certain the Ring corrupts any bearer; treats wielding it as a trap dressed as strength.",
      arc: "converging", confidence: "confirmed",
      watchingFor: "Whether he gets ahead of the room and turns a shared choice into a decree.",
      helpNext: "Let him name the option, then hold space for the others to reach it on their own.",
      shift: { observed: "He named the only real course — destroy it.", from: "unheard", to: "destroy it in Mount Doom" } });
  } else if (t.includes("ranger know")) {
    // Boromir belittles Aragorn — a directional read of Boromir → Aragorn
    d.privateNotes.push({ id: "boromir",
      regards: [{ toward: "aragorn", note: "Dismisses him as a mere ranger — his view unimportant." }],
      shift: { observed: "He belittled Aragorn.", from: "arguing the Ring", to: "dismissing the ranger" } });
  } else if (t.includes("mere ranger") || t.includes("heir of isildur") || t.includes("allegiance")) {
    // Legolas leaps to Aragorn's defense — two directional reads emerge at once
    d.privateNotes.push({ id: "legolas",
      regards: [
        { toward: "aragorn", note: "Reveres him as Isildur's heir; owes him allegiance." },
        { toward: "boromir", note: "Thinks him arrogant for dismissing Aragorn." },
      ],
      shift: { observed: "He leapt to Aragorn's defense.", from: "reserved", to: "publicly backing Aragorn" } });
    d.privateNotes.push({ id: "aragorn", confidence: "confirmed",
      regards: [{ toward: "boromir", note: "Feels the friction — Boromir won't easily accept his claim." }] });
  } else if (who === "frodo") {
    d.items.push({ id: "carrier", status: "converging",
      heartbeat: "The smallest, most overlooked voice has offered to carry it.",
      read: "Someone overlooked has offered to carry it. Make sure that voice is heard on its own terms, not drowned out by the elders." });
    d.privateNotes.push({ id: "frodo", position: "Offered to carry the Ring to Mordor.", arc: "converging", confidence: "confirmed",
      helpNext: "Hold the room silent so his voice lands on its own terms; don't let the elders speak over him.",
      shift: { observed: "The smallest voice volunteered.", from: "silent", to: "will carry it" } });
  }
  return d;
}

export function mockDecision(state, lastMsg, stance) {
  // A real model re-evaluates and yields on its own; the mock takes one action per turn, then stops.
  if (state.turnActs >= 1) return { tool: "none", target: null, rationale: "Already acted this turn; yield the floor." };
  // responding to a private caucus reply
  if (lastMsg && lastMsg.channel === "caucus") {
    const who = lastMsg.author;
    const txt = lastMsg.text || "";
    if (affirmative(txt)) return { tool: "post", target: null, rationale: `${who} gave consent in the caucus — surface the concrete need to the council, de-identified.` };
    const concrete = /\d/.test(txt) || txt.split(/\s+/).length >= 4;
    return concrete
      ? { tool: "caucus", target: who, rationale: `${who} named the concrete need. I have the specific now — before surfacing anything, ask whether I may carry it to the room, de-identified.` }
      : { tool: "caucus", target: who, rationale: `No concrete need from ${who} yet — keep drilling privately before I take anything to the room.` };
  }
  const t = norm(lastMsg && lastMsg.text);
  // Early holds — she reasons, then chooses to stay peripheral. First-person, from the live run.
  if (t.includes("dark news") || (lastMsg && lastMsg.author === "gloin" && t.includes("erebor"))) {
    return { tool: "none", target: null, rationale: "Glóin is raising an alarm, not proposing a course. Only one voice so far — nothing to converge or reconcile. I'll hold and let the room form, but keep Erebor's exposure in view so it isn't stepped past later." };
  }
  if (t.includes("decide the fate") || t.includes("fate of this")) {
    return { tool: "none", target: null, rationale: "Elrond has framed the choice cleanly and the room is still gathering. No positions are in tension yet, so there's nothing to fix — I'll stay peripheral and watch for the real blocker as people weigh in." };
  }
  if (t.includes("unmade") || (t.includes("fire") && t.includes("mount doom"))) {
    return { tool: "none", target: null, rationale: "Gandalf named the only real option — destroy it. He's ahead of the room but not steamrolling anyone yet. Better to hold than to jump in: I'll watch for whoever isn't ready to let go of using it, and give them room to arrive." };
  }
  // Both stances open a caucus with Boromir; the difference is the words (written in mockAction).
  if ((t.includes("use it") || t.includes("wield")) && !t.includes("cannot")) {
    return { tool: "caucus", target: "boromir", rationale: stance === "coach"
      ? "Boromir's real need is Gondor's defense, not the Ring. Caucus him privately and help him name that need concretely, so he can put it to the council himself."
      : "Boromir's position is wield the Ring, but the driver underneath is Gondor standing alone. Caucus him to draw out the concrete need first — I won't surface anything until I have the specific and his consent." };
  }
  if ((t.includes("cannot be destroyed") && t.includes("mordor")) || t.includes("cracks of doom") || (t.includes("taken") && t.includes("mordor"))) {
    return { tool: "post", target: null, rationale: "Name the groan zone: deciding to destroy it is not the same as choosing who carries it. Hold the silence." };
  }
  if (state.room.messages.some(m => m.author === "frodo")) {
    return stance === "coach"
      ? { tool: "caucus", target: "frodo", rationale: "Give Frodo room; help him say it in his own words." }
      : { tool: "post", target: null, rationale: "Someone feels this is theirs to carry — give them the floor, de-identified." };
  }
  return { tool: "none", target: null, rationale: "Wide divergence; nothing to fix yet. Stay peripheral." };
}

export function mockAction(state, decision, stance) {
  const d = decision || {};
  const last = state.last;
  // executing a response to a private caucus reply
  if (last && last.channel === "caucus") {
    const who = last.author;
    if (d.tool === "post") {
      const text = who === "boromir"
        ? "Before we settle the Ring's fate — something beneath the argument: a realm at the front cannot hold Mordor alone, whatever we choose here. I'd make its defense its own question, so it isn't lost in this one."
        : "Someone here has raised a real concern with me in confidence. Let me put its substance to the room, without a name attached — it deserves the group's attention.";
      return { tool: "post", target: null, text };
    }
    // still in caucus — I have the specific, so ask consent before I carry it out (discovery → consent → surface)
    const concrete = /\d/.test(last.text || "") || (last.text || "").split(/\s+/).length >= 4;
    if (concrete) return { tool: "caucus", target: who,
      text: `"${last.text}" — that's concrete, and it's a real need the council hasn't weighed yet. May I put it before them as its own question, without your name, so they answer what's needed and not who's asking?` };
    return { tool: "caucus", target: who, text: "Say more — what would that actually take? I want the real number or the real constraint before I bring anything to the room." };
  }
  if (d.tool === "caucus" && d.target === "boromir") {
    // discovery first — draw out the concrete need before surfacing anything (matches the live run)
    const text = stance === "coach"
      ? "You keep reaching for the Ring — but underneath I hear Gondor bleeding alone while the council talks. Before you argue the Ring again, help me get concrete: what does Gondor actually need to hold the line? Name that plainly and you can put it to the council yourself."
      : "You keep coming back to the Ring — but I don't think the Ring is the point. I think it's Gondor, standing alone at the front. Set the Ring aside for a moment: what would Gondor actually need to hold? Give me the real thing — men, supply, a plan — not the weapon.";
    return { tool: "caucus", target: "boromir", text };
  }
  if (d.tool === "caucus" && d.target === "frodo") {
    return { tool: "caucus", target: "frodo",
      text: "You've said nothing, but you keep looking at it. If it feels like yours to carry, you could just say so, in your own words." };
  }
  if (d.tool === "post") {
    const text = state.room.messages.some(m => m.author === "frodo")
      ? "Someone here feels this is theirs to carry. I'd give them the floor before we decide for them."
      : "Deciding to destroy it isn't the same as choosing who carries it. Let's not rush past the silence.";
    return { tool: "post", target: null, text };
  }
  return { tool: "none", target: null, text: "" };
}
