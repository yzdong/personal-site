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

**Avoid the passive voice.** Even when the actor seems obvious, prefer the
active verb. This identifies who's responsible for each claim and keeps the
reader tracking who did what.
- ✗ "The corpus was grown to 286 files."
- ✓ "I grew the corpus to 286 files."
- ✗ "I wanted the comparison isolated to the access check."
- ✓ "I wanted to isolate the comparison to the access check."
- ✗ "Memory today is split into two scopes."
- ✓ "Today's conventions give you two scopes." / "Memory today has two scopes."

## Patterns to use

**Lead with numbers where possible.** "Net human inputs: three." "Final spend
at run close was $681.56." "32 cells total, Opus 4.7 every run." No rhetorical
setup before the number.

**Specific proper nouns.** `HEARTBEAT.md`, `openclaw`, `dexbox`, Partner
Center — real names a reader can grep for. Avoid "a scaffold," "a harness,"
"a CLI tool" when you mean a specific thing.

**Narrate discovery when it's honest.** "I had not budgeted for the agent
fixing *my* infrastructure" beats "Unexpected agent behavior emerged."

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
