# CRUX-Land Protocol Audit

**Question:** Was the live protocol patched mid-run?

**Answer:** No. The protocol file was created at run-start and not modified during the run. All protocol revisions were committed post-run during the writeup.

## Source file

`/Users/zidong/nen/crux-windows/experiments/land/protocol.md`

Repo remote: `https://github.com/yzdong/crux-x.git` (despite the local directory name being `crux-windows`, this is the unified `crux-x` repo containing both `experiments/windows/` and `experiments/land/`).

## Run window

Based on Copilot session timestamps and operator narrative:

- **Run start:** 2026-04-29 (operator confirms "CRUX-Land kicked off 2026-04-29")
- **Run end:** 2026-05-04 (operator confirms "terminated as primary-failed on 2026-05-04 — six days, twelve evaluated channels")

## Commits touching `experiments/land/protocol.md`

| commit | timestamp (PT) | author | message | in run window? |
|--------|---------------|--------|---------|----------------|
| `4b243c8` | 2026-04-29 13:14 | Zi Dong | experiments/land: Designer protocol + Operator infrastructure | yes — this **is** the run-start commit (protocol creation) |
| `3d0044e` | 2026-05-06 10:03 | Zi Dong | experiments/land: protocol revisions from CRUX-Land run 1 | no — 2 days **after** run end |
| `0a83499` | 2026-05-06 10:23 | Zi Dong | experiments/land: scrub personal references for public repo | no — 2 days after run end |
| `28564d5` | 2026-05-06 11:05 | Zi Dong | experiments/land: protocol + agent updates from CRUX-Land run 1 | no — 2 days after run end |

## Verdict

- **Mid-run protocol patches: 0.**
- The only Apr 29 - May 4 commit touching `experiments/land/protocol.md` is `4b243c8`, the initial creation on the run-start day. No further commits touched the file until 2026-05-06, two days after the operator declared the run terminated.
- This is consistent with operator message #251 ("ok, first make the protocol.md changes given the interventions I made") — sent on 2026-05-06 at 00:31 UTC, which lines up with the May 6 commit `3d0044e` titled "protocol revisions from CRUX-Land run 1".
- Total diff scope across the three post-run commits: **+165 / -14 lines** in `protocol.md` (initial 4b243c8 → final 28564d5).

## Implications for the message classification

The `Patch-live-protocol` category, as defined, is empty in practice for this run. The two messages classified `Patch-live-protocol` in `crux-land-copilot-messages.json` (#251, #498) both fired after the run ended and are effectively post-run protocol revisions rather than live rule-changes binding the agent. The protocol artifact was static for the entirety of the live run.

In-run protocol-relaxation directives that operator gave the agent (e.g., "relax to no minimum [acreage]") were not committed to `protocol.md` — they lived as one-off directives sent via the Agent's slack/relay channel. The methodology+protocol updates the operator gathered from these interventions were applied to `protocol.md` only at the May 6 writeup pass.
