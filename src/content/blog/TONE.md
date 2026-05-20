# Blog tone guide

Voice conventions for posts in this directory. Read before editing any `.mdx`
here. The reference post for this voice is `crux-windows.mdx` — when in doubt,
copy its cadence.

## Voice

Direct, factual, slightly under-stated. Claims anchor to specific numbers or
named artifacts. Uncertainty gets admitted inline rather than hedged around.
Emphasis is sparse — **bold** is for timestamps and milestone events, not for
adjectives or thesis-sentences.

## Patterns to avoid

**No bolded-headline-punchline structure.** A bolded sentence at the start of a
paragraph that restates the paragraph's thesis reads markety.
- ✗ `**The split is cost.**` (as a standalone sentence, bolded)
- ✓ "Cost is where they split. At n=286, Arm A used ~5× more input tokens..."

**No sweeping-propagation connectors.** Phrases that promise a finding extends
to some larger population usually over-promise.
- ✗ "Whatever conventions coding agents settle on will propagate outward."
- ✗ "It's the question for every enterprise agent that's coming."
- ✓ "The same conventions are already showing up outside coding — Anthropic's Cowork uses Claude Code's runtime for non-engineering roles."

**No pat philosophical formulations.** Single clean sentences that sound like
they belong in a conference abstract. They rarely carry weight.
- ✗ "That's a permissioning problem layered on top of a memory problem."
- ✓ "Access control on top of a file tree."

**Jargon only when it pays.** If "retrieval primitives," "cost curve,"
"attention dilutes," or "scaling ceiling" is doing real work, fine. If it's
just signaling sophistication, cut it.
- ✗ "Richer retrieval primitives turn discovery into a constant-time operation when filename conventions hold."
- ✓ "With `read_file` available and predictable paths, the agent skips the walk entirely."

**Avoid inflated metaphors and sophistication-signaling phrases.** These
usually stand in for a plain word that would do the same job. When you
catch one, ask what it means literally and say that instead.
- ✗ "becomes load-bearing" → ✓ "becomes necessary," "starts mattering"
- ✗ "first-class" → ✓ "supported directly," "built in"
- ✗ "non-trivial" → ✓ "hard," "takes real work"
- ✗ "blast radius" → ✓ "what it affects when it breaks"
- ✗ "orthogonal" (as a vague "not the same as") → ✓ "unrelated," "separate concern"

**Hedge extrapolations explicitly.** If it wasn't measured, say so.
- ✗ "At n=10,000, Arm A likely fails."
- ✓ "At n=10,000, I didn't run this, but Arm A probably falls over."

**Concrete over metaphorical.** Name the file, the command, the number, the
date. A metaphor ("bites", "compounds", "tax") is borrowing pathos it didn't
earn.

**Section headings name the section's content, not its takeaway.** Punchy
three-word titles read like slide headers. Prefer descriptive headings a
reader can skim to locate the content. The ✗ version is fine as a sentence
inside the section, not as the heading.
- ✗ `## The hires reveal the strategy`
- ✓ `## Who each company hired`
- ✗ `## The absence is the signal`
- ✓ `## What's missing from the org chart`

**Don't re-list a cast of named people across sections.** Once you've
introduced four people in §3 with specific roles, refer back to the *roles*
in §6, not the names. Re-rolling the same names reads like filler.
- ✗ "Gross is the Doximity architect, Alexander is the consumer-product weight, Singhal provides benchmark credibility, Hairston handles the regulator."
- ✓ "The hires I walked through in §3 line up with this motion 1:1: a clinician-PLG operator at the top, a consumer-PLG product chief, a clinical-AI research lead, a regulatory lead."

**Contrast-pair one-liners read markety.** Two short symmetric sentences
that pivot on a single contrast ("X shipped A. Y shipped B.") are headline
copy, not analysis. Unpack them into a paragraph with the concrete end
users or mechanisms behind each side.
- ✗ "OpenAI shipped apps. Anthropic shipped primitives."
- ✓ "The person who opens ChatGPT Health is a patient sitting down with bloodwork results. The person who opens Claude for Healthcare doesn't exist yet — the connectors and Skills Anthropic shipped go into other people's products..."

**Avoid the passive voice.** Even when the actor seems obvious, prefer the
active verb. This identifies who's responsible for each claim and keeps the
reader tracking who did what.
- ✗ "The corpus was grown to 286 files."
- ✓ "I grew the corpus to 286 files."
- ✗ "I wanted the comparison isolated to the access check."
- ✓ "I wanted to isolate the comparison to the access check."
- ✗ "Memory today is split into two scopes."
- ✓ "Today's conventions give you two scopes." / "Memory today has two scopes."

**Don't dress up arbitrary choices as principled ones.** Many decisions in
any project — a numerical threshold, a time budget, a hire, a tool, an
approach taken — are picked for convenience, comfort, or gut. Reverse-
engineering a principled rationale after the fact reads as confidence but
obscures what actually drove the call. Often the more interesting story
is the discovered consequence: name the choice as arbitrary, then describe
what it ended up forcing.
- ✗ "The constraint stack is tight on purpose. A $1,500 parcel cap forces the agent into the cheap-rural-parcel market — that's the segment where benchmark performance and real-world completion gets ugly."
- ✓ "The $1,500 cap was an arbitrary pick — I just wanted something not too expensive. It forced the agent to be aggressively selective."

**Don't gild credentials in the service of a setup.** Tempting to dress up
qualifications because they make a contrast land cleaner, but the contrast
lands fine without overclaim — and getting it wrong erodes trust in
everything else in the post. State only what you actually have or know.
- ✗ "I had a software background — I knew what code-signing certificates were and what the WACK validator complains about, even if I'd never personally shipped a Windows Store app."
- ✓ "I had a software background to fall back on — I know how to build software."

**No contentless transitional fragments.** Sentence fragments that gesture
at what's coming next without naming anything ("Walking them.", "Onward.",
"Now the details.") read clipped, not under-stated. Replace with a full
sentence that previews the content, or cut the transition entirely and
let the next heading carry the structure.
- ✗ "...encoded as criteria the agent would check against each parcel. Walking them."
- ✓ "...encoded as criteria the agent would check against each parcel. The five follow, in the order the protocol checks them."

## Patterns to use

**Lead with numbers where possible.** "Net human inputs: three." "Final spend
at run close was $681.56." "32 cells total, Opus 4.7 every run." No rhetorical
setup before the number.

**Specific proper nouns.** `HEARTBEAT.md`, `openclaw`, `dexbox`, Partner
Center — real names a reader can grep for. Avoid "a scaffold," "a harness,"
"a CLI tool" when you mean a specific thing.

**Narrate discovery when it's honest.** "I had not budgeted for the agent
fixing *my* infrastructure" beats "Unexpected agent behavior emerged."

**Make the analyst visible.** For research or analysis posts, signal how
the work was done. "I read each company's public health-team roster and
cross-referenced public bios against LinkedIn" grounds the claim in
verifiable effort. Passive "The hires reveal..." hides the analyst and
reads like marketing.
- ✗ "Three buyer segments matter for frontier-model healthcare products."
- ✓ "I spent the last few months reading each company's public posts,
  mapping the hires, pulling the customer lists, and running the April
  releases through a three-segment frame."

**Name the end user for product-shape claims.** "Who opens this app, and
what are they doing in that moment?" is usually more legible than a
category label. Ground the product shape in a specific person's context.
- ✗ "ChatGPT Health is a consumer product."
- ✓ "The person who opens ChatGPT Health is a patient sitting down with
  bloodwork results, an insurance plan, or a list of pre-appointment
  questions."

**Partnership and customer lists need per-partner depth.** Listing names
and asserting they "matter" reads as market-map copy. Each named partner
gets one concrete sentence on what flows through the relationship, what
the user experiences, or what each side gets back. If you can't name a
public use case, say so explicitly ("named partner, use case not publicly
detailed") rather than implying one.
- ✗ "The vertical-AI-app list (X, Y, Z, W) is structurally important."
- ✓ "Qualified Health built on Claude Sonnet 4.5 to identify patients
  across the University of Texas System (2M+ population) who qualify for
  evidence-based interventions. Carta Healthcare uses Claude for clinical
  data abstraction: 66% reduction in data processing time at 99%
  accuracy..."

**Acknowledge apparatus issues.** When the setup was off, say so and flag it
plainly: "Ambiguous whether that's in-scope agent work or modifying the
apparatus; logged and moved on."

**Short paragraphs.** No section needs a thesis sentence. Let the data carry.

## First-person

Personal posts use **I**, not "we." When quoting a hypothetical employee's
POV, use "a platform team" / "a sales pod," not "our platform team."

Prefer active first-person verbs over agentless or passive constructions.
The author is present in the experiment — let the prose show it. This
grounds claims in a specific person's work rather than floating them as
anonymous findings.

- ✗ "A controlled A/B between two access layers."
- ✓ "I ran a controlled A/B between two access layers."
- ✗ "The corpus was grown from 8 to 286 files."
- ✓ "I grew the corpus from 8 to 286 files."
- ✗ "Token issuance, per-subagent scoping, and write-conflict handling were not implemented."
- ✓ "I didn't implement token issuance, per-subagent scoping, or write-conflict handling."

When describing neutral experimental facts (counts, measurements), passive
is fine. When describing what you decided or did, first-person is almost
always better.

## Draft status

Early drafts carry an explicit marker: `*Draft — not final. May be revised.*`
Remove once the post is stable.

## Editor's notes

When a specific claim depends on unresolved verification (e.g., confirming a
detail with an author), use an `[Editor's note: ...]` block rather than
silently smoothing the uncertainty. See `crux-windows.mdx` for an example.
