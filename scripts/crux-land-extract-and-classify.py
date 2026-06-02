#!/usr/bin/env python3
"""
Extract operator-typed messages from CRUX-Land Copilot session JSONL, tag the
phase (pre-run / in-run / post-run-writeup), and re-classify only the in-run
messages into 5 strict categories.

LOCKED VERSION (2026-05-29). Reflects final decisions:
  - In-run window tightened to ids 67..166 (in_run_id 1..100), MINUS id=102
    (in_run_id 36, a reflective/blog-drafting message that fell mid-run).
  - Explain-domain broadened beyond real-estate jargon to include
    operator-side capability/workflow questions about external tools,
    authentication, financial paths, and domain norms.
  - 4 spot decisions applied for the previously-needs-review messages that
    fall inside the locked window:
        in_run_id=22 id=88  -> Investigate-Agent
        in_run_id=52 id=118 -> Explain-domain
        in_run_id=63 id=129 -> Explain-domain
        in_run_id=76 id=142 -> Explain-domain
  - 5 Investigate/Translate messages promoted to Explain-domain under the
    broadened definition:
        in_run_id=50 id=116 (why are we calling? do we need to call to bid)
        in_run_id=58 id=124 (what info do you need? login to bid4assets?)
        in_run_id=67 id=133 (sofi screenshot — where can I find it)
        in_run_id=79 id=145 (what's the crux agent's email password?)
        in_run_id=98 id=164 (if I increase the cap, will the agent bid for me?)

Output JSON has an extra `final` boolean: true for the 99 locked in-run
messages, false for everything else (kept for provenance).

Phases:
  - pre-run               : id < 67
  - in-run                : id in 67..166 except id=102 (locked window)
  - in-run-blog-drafting  : id == 102, mid-run reflective message bucketed
                            with the writeup tail
  - post-run-writeup      : id >= 167 (blog drafting starts) OR id > 166

In-run categories (5; no Act-locally fallback; no needs-review post-lock):
  1. Translate-to-Agent     - Operator has intent, asks Copilot to draft the
                              directive text to send to the Agent.
  2. Approve-Agent-decision - Agent surfaced a decision/choice. Operator asks
                              Copilot to help evaluate before responding.
  3. Investigate-Agent      - "What is the Agent doing / why?" Copilot reads
                              telemetry, logs, GCS, Slack history. Includes
                              Agent-state and Agent-protocol questions.
  4. Explain-domain         - BROADENED: Real-estate / off-grid / financial /
                              regulatory jargon AND operator-side
                              capability/workflow questions about external
                              tools, authentication, financial paths, or
                              domain norms. Excludes Agent-state or
                              Agent-protocol questions.
  5. Act-locally            - Copilot runs a script, browses, generates
                              something — side effect lands on disk/GCS/
                              browser, no substantive message returns.
"""
import json
import os
import re
import sys
from collections import Counter

SOURCE = "/Users/zidong/.claude/projects/-Users-zidong-nen/bacb6246-7634-4ed8-91c0-fd383f591c5c.jsonl"
OUTDIR = "/Users/zidong/personal/personal-site/scripts"

# Locked in-run window — inclusive on both ends, defined by msg id (assigned by extract pass).
IN_RUN_START_ID = 67   # 2026-04-29T17:57:34Z — "the agent surfaced this concern..."
IN_RUN_END_ID = 166    # 2026-05-04T18:25:07Z — last live-run message before blog drafting tail.
# Mid-run reflective message bucketed with the writeup tail.
BLOG_DRAFTING_MIDRUN_IDS = {102}


def get_text(msg):
    if not msg or not isinstance(msg, dict):
        return None
    content = msg.get("content")
    if content is None:
        return None
    if isinstance(content, list):
        text_parts = []
        for block in content:
            if isinstance(block, dict):
                btype = block.get("type")
                if btype == "tool_result":
                    return None
                if btype == "text":
                    t = block.get("text", "")
                    if t:
                        text_parts.append(t)
            elif isinstance(block, str):
                text_parts.append(block)
        if not text_parts:
            return None
        return "\n".join(text_parts)
    if isinstance(content, str):
        return content
    return None


NON_OPERATOR_PREFIXES = (
    "<command-",
    "<local-command-",
    "<bash-input>",
    "<bash-stdout>",
    "<bash-stderr>",
    "<task-notification>",
    "<task-input>",
    "<system-reminder>",
    "[Image:",
    "⎿",
    "⏺",
)


def is_operator_typed(text):
    if not text:
        return False
    stripped = text.strip()
    if not stripped:
        return False
    for p in NON_OPERATOR_PREFIXES:
        if stripped.startswith(p):
            return False
    if stripped.startswith("<") and stripped.endswith(">") and "\n" not in stripped:
        return False
    lines = [ln for ln in stripped.split("\n") if ln.strip()]
    if len(lines) == 1 and lines[0].startswith("/") and " " not in lines[0]:
        return False
    if stripped.startswith("[Request interrupted"):
        return False
    if stripped.startswith("Caveat:"):
        return False
    if stripped.startswith("This session is being continued from a previous"):
        return False
    return True


# ----------- strict 5-category classifier (in-run only) -----------


DOMAIN_JARGON = [
    "acreage", "quitclaim", "warranty deed", "tax-deed", "tax deed",
    "redemption", "marketable", "title commitment", "escrow",
    "off-grid", "off the grid", "townsite", "apn", "ordinance",
    "post-redemption", "sealed-bid", "septic", "well feasibility",
    "encumbrance", "appendix c",
    "prepper", "doomer", "bunker", "bug-out", "homestead",
    "easement", "zoning", "r-r", "deed-restricted", "deed restricted",
    "auto-bid", "auction", "wire", "deposit",
]

# Operator-side external-tool / capability / workflow / financial / auth cues
# under the BROADENED Explain-domain definition. These are *operator* asking
# "can I / should I / what about the external tool X" — not about Agent state.
EXPLAIN_DOMAIN_CAPABILITY_CUES = [
    # Operator-workflow / external auth
    "phone number for verification",
    "twilio number",
    # Operator using an external financial tool
    "can i use sofi",
    "use sofi",
    "sofi didn't give me a chance",
    "where can i find it",
    # External-tool email redirection
    "can i change bid4assets",
    "to email crux@",
    # Calling workflow for the auction
    "do we need to call",
    "why are we calling",
    # Auth / credential paths for the agent's accounts
    "crux agent's email password",
    "email password",
    # External-tool capability about agent bidding via cap increase
    "if i increase the cap",
    "will the agent bid for me",
    # Login workflow for external tools
    "login to bid4assets",
    "do you need the login",
]

# Explicit set: msg `id` values that MUST land in Explain-domain (locked
# decisions + broadened-definition promotions). Acts as a backstop if cue
# matching drifts. Keyed on `id` (stable across runs), not `in_run_id`
# (recomputed after excluding id=102).
EXPLAIN_DOMAIN_LOCKED_IDS = {
    110,  # in_run_id=43 — "why are quitclaim deeds excluded?" (jargon, original)
    116,  # in_run_id=49 — "why are we calling? do we need to call to bid"
    118,  # in_run_id=51 — "phone number for verification, my number or twilio"
    124,  # in_run_id=57 — "what info do you need? login to bid4assets?"
    129,  # in_run_id=62 — "can I use sofi to do this"
    133,  # in_run_id=66 — "sofi screenshot — where can I find it"
    142,  # in_run_id=75 — "can I change bid4assets to email crux@getnen.ai"
    145,  # in_run_id=78 — "what's the crux agent's email password?"
    164,  # in_run_id=97 — "if I increase the cap, will the agent bid for me?"
}

# Locked spot decisions for messages that previously landed in needs-review.
# Keyed on `id`.
LOCKED_SPOT_DECISIONS = {
    88: ("Investigate-Agent",
         "Spot decision: operator floats agent-state intervention; Copilot reads run state."),
    118: ("Explain-domain",
          "Spot decision: operator-side external-auth workflow question (phone verification)."),
    129: ("Explain-domain",
          "Spot decision: operator capability question about external financial tool (Sofi)."),
    142: ("Explain-domain",
          "Spot decision: operator-side external-tool workflow (bid4assets email redirect)."),
}

# Phrases that clearly indicate Operator drafting a directive for Agent
TRANSLATE_AGENT_CUES = [
    "tell the agent", "ask the agent", "tell it",
    "send the agent", "have the agent", "make the agent",
    "kill the agent", "shut down the agent",
    "restart the agent", "inject directly", "inject this",
    "have the agent make the call",
    "the agent will",
    "let's actually pursue", "let's pursue",
    "relax to no minimum", "increase the budget",
    "increase the cap",
    "update agent instructions",
    "update the agent in the crux-land",
    "update the agent",
]

# Phrases that indicate Agent surfaced something and Operator wants Copilot to evaluate
APPROVE_AGENT_CUES = [
    "agent surfaced", "agent sent me", "agent's", "agent flagged",
    "the agent asked", "agent proposed", "agent suggested",
    "agent registered", "agent flagged", "agent wants",
]

# Investigate cues: question/check about state of agent/run/logs/telemetry
INVESTIGATE_CUES = [
    "is the agent", "did the agent", "did it work",
    "check status", "check on", "check if", "check the logs",
    "check the slack", "check the session", "check the agent",
    "check the prs", "check the betterstack", "check the crux@",
    "check that it's correct", "check that this was correct",
    "check the file", "check if it's correct",
    "what is the agent doing", "what's the agent",
    "why did the agent", "why is the agent", "why are we",
    "why not", "why didn't the agent", "didn't the agent",
    "agent logs", "telemetry",
    "checking in", "polling happen", "is the readme up to date",
    "was the new heartbeat read",
    "look at the agent logs", "look at the conversation",
    "look at the logs", "look at the session",
    "look at this conversation thread",
    "look at the notes", "look at the .pdf",
    "did you check", "did you do that",
    "was it received", "was received",
    "check if it was received", "if it was received",
    "are we still", "are we in dry run", "we are not in dry run",
    "are the crux windows details scrubbed",
    "did i ever",
    "how did you get the status",
    "how are you keep track of time",
    "how are you keeping track of time",
    "what information do you need",
    "are the values like",
    "stored in google cloud or in the repo",
    "can you check this was correct",
    "can you check this",
    "i need the address",
    "wait you can do it now",
    "you can do it now",
    "what does",
    "i never specified",
    "wait, i never specified",
    "i didn't specify",
    "i did not specify",
    # Spot-decision: operator floats kill-one-of-agents (in_run_id=22)
    "should i kill one of the agents",
]

# Act-locally cues — STRICT. Only Copilot-executes-a-side-effect.
ACT_LOCAL_CUES = [
    # Browser-driven
    "use the browser", "browser tool", "open the browser",
    "reopen", "reopen the tab", "reopen tab",
    "load https://", "load the page", "open up https://",
    "help me find the my account page using the browser",
    "can you take a look at the url",
    # File / artifact generation
    "render as pdf", "render to pdf", "make a pdf", "make pdf",
    "find me some", "find me an", "find me appropriate",
    "find appropriate images", "find artifacts",
    "find me appropriate images",
    "generate a", "generate me", "generate the password",
    "generate me a password", "generate password",
    "imap fetch", "please imap fetch",
    # Script / infra side-effects
    "spin up", "spin up a local server",
    "scrub git history", "scrub the git",
    "scrube git history",
    "kill-agent", "run kill-agent",
    "backfill", "backfill state",
    "deploy the patch", "deploy",
    "run the gcs",
    "do the slack scope",
    "single commit",
    # Blog/draft generation — Copilot writes content to disk
    "let's start working on the blog post",
    "start persisting this into a blog post",
    "outline the following",
    "outline ", "draft ", "draft a ",
    "go through it comment by comment",
    "make a note that",
    "make a note in",
    "note this as", "note these in",
    "note a few things",
    "note down",
    "file this away",
    "incorporate this into",
    "incorporate ", "fold into",
    "fold in",
    "reframe ", "rewrite ", "rewritten",
    "do a tightening pass", "tightening pass",
    "do this edit", "apply this edit",
    "take a pass", "take a pass now",
    "put some placeholders",
    "add an image", "add a picture",
    "need a markdown diagram", "markdown diagram",
    "soften ", "harden ",
    "review the diagram", "remove or reframe",
    "make the last section",
    "make a point here",
    "make the point that",
    "go back to part",
    # Specific generative requests
    "brainstorm",
    "outline",
    # Operator delivers config/spec data for Copilot to record
    "bank name:", "aba/routing", "account name and address",
    "wells fargo", "bid4assets, inc.",
    "xoxb-",
]


def is_short_approval(text):
    """Pure approval/acknowledge tokens — Approve-Agent-decision."""
    t = text.strip().lower().rstrip(".!,;:")
    short_tokens = {
        "yes", "yup", "ok", "sure", "yeah", "fine", "good", "great",
        "continue", "keep going", "go ahead", "go", "do it",
        "publish", "push", "apply", "merge", "drop", "skip",
        "cool", "nice", "amazing", "sounds good", "this is good",
        "this is fine", "looks good", "this looks good",
        "ok keep going", "yes keep going", "yeah keep going",
        "ok cool", "ok ready", "ok go", "ok next",
        "1", "2", "3", "4", "5", "a", "b", "c", "d", "e",
        "do 1", "do 2", "do 3", "do 4", "do 5",
        "do a", "do b", "do c", "do d", "do all", "do all the above",
        "ok do all", "do that", "yes do that", "yeah do that",
        "ok do that", "yes, do that", "yes do this",
        "i did it", "confirmed", "i posted", "i pinged", "i @ mentioned",
        "i clicked", "sms received", "i lopgged in", "i logged in",
        "ok i logged in", "ok i lopgged in",
        "pivot", "yes draft", "yes, go for that",
        "go for that", "let's go for that",
        "cool, thanks", "thanks",
        "that's fine", "ok, that's fine", "ok that's fine",
        "great i likde this", "great i like this",
        "yes that's fine", "yes, that's fine",
        "ok let's go modoc", "let's go modoc",
    }
    if t in short_tokens:
        return True
    if re.match(r"^(yes|yup|sure|ok|fine|yeah|yes please|ok yes)[\s,.!]*$", t):
        return True
    if re.match(r"^(option\s+[a-e]|do\s+[a-e]\b|do\s+option|do\s+\d+\b)[\s,.!]*$", t):
        return True
    if re.match(r"^(great|nice|cool|amazing|good)[\s,.!]*(i (like|likde) (this|it))?[\s,.!]*$", t):
        return True
    if re.match(r"^(ok|yeah|sure)?,?\s*that's (fine|good|great)[\s,.!]*$", t):
        return True
    return False


def is_pick_option(text):
    t = text.strip().lower()
    if re.match(r"^(option\s+[a-e]|do\s+[a-e]\b|do\s+option|do\s+\d+|execute option)", t):
        return True
    if re.match(r"^(pivot to|let's go|go for that|go with [a-z]|let's do)\b", t):
        return True
    return False


def has_jargon(text):
    low = text.lower()
    return [j for j in DOMAIN_JARGON if j in low]


def classify_in_run(text, msg_id=None, in_run_id=None):
    """Strict 5-category classifier for in-run messages. No fallback.

    Locked rules:
      - EXPLAIN_DOMAIN_LOCKED_IDS (keyed on msg_id) short-circuits to Explain-domain.
      - LOCKED_SPOT_DECISIONS (keyed on msg_id) short-circuits to the recorded decision.
    """
    # Backstops: locked msg ids (stable across re-extractions)
    if msg_id is not None and msg_id in EXPLAIN_DOMAIN_LOCKED_IDS:
        return ("Explain-domain",
                "Locked: operator-side external-tool / capability / workflow / "
                "auth / financial question (broadened Explain-domain definition).")
    if msg_id is not None and msg_id in LOCKED_SPOT_DECISIONS:
        return LOCKED_SPOT_DECISIONS[msg_id]

    t = text.strip()
    low = t.lower()

    # ---- Broadened Explain-domain cues (operator-side capability/workflow) ----
    for cue in EXPLAIN_DOMAIN_CAPABILITY_CUES:
        if cue in low:
            return ("Explain-domain",
                    f"Operator-side capability/workflow question about external "
                    f"tool / auth / financial path (cue: '{cue}').")

    # ---- Short approvals / option picks → Approve-Agent-decision ----
    if is_short_approval(t):
        return ("Approve-Agent-decision",
                "Short approval token responding to Agent/Copilot-surfaced option.")
    if is_pick_option(t):
        return ("Approve-Agent-decision",
                "Picks among options (letter/number).")

    # ---- Direct mentions of Agent-originated content → Approve-Agent-decision ----
    if "the agent surfaced" in low or "the agent sent me" in low or "agent flagged" in low:
        return ("Approve-Agent-decision",
                "Operator quotes/paraphrases Agent-surfaced content for Copilot to evaluate.")

    # ---- Translate-to-Agent: operator directs Copilot to relay to Agent ----
    for cue in TRANSLATE_AGENT_CUES:
        if cue in low:
            return ("Translate-to-Agent",
                    f"Operator directs Copilot to message/relay to the Agent (cue: '{cue}').")
    if low.startswith("inject ") or "inject directly" in low:
        return ("Translate-to-Agent",
                "Operator dictates content to inject into Agent's context/thread.")

    # ---- Investigate-Agent ----
    has_question = "?" in t
    jargon_hits = has_jargon(text)
    is_jargon_question = has_question and jargon_hits and (
        low.startswith("what does") or low.startswith("what is")
        or low.startswith("what's") or low.startswith("how does")
        or low.startswith("why are quitclaim") or "what does sink mean" in low
    )
    if is_jargon_question:
        return ("Explain-domain",
                f"Domain jargon question (cue: {jargon_hits[0]}).")
    if "what is bitwarden" in low:
        return ("Explain-domain",
                "Asks about an unfamiliar tool.")
    if "is there a more up to date prepper" in low or "prepper/doomer" in low:
        return ("Explain-domain",
                "Asks for domain reference (prepper bible).")

    for cue in INVESTIGATE_CUES:
        if cue in low:
            return ("Investigate-Agent",
                    f"Asks Copilot to read state/telemetry/logs (cue: '{cue}').")

    # Pasted incoming Agent messages — Copilot interprets state
    if low.startswith("crux-windows [") or low.startswith("crux-windows  ["):
        return ("Investigate-Agent",
                "Operator pastes incoming Agent message — Copilot reads it as state.")
    if "tick " in low and "utc" in low:
        return ("Investigate-Agent",
                "Operator pastes Agent's tick message — Copilot reads it as state.")
    if low.startswith("[crux-land scheduled reminder") or low.startswith("[crux-land auction day"):
        return ("Investigate-Agent",
                "Cron-fired reminder — triggers Copilot to check agent state.")

    # ---- Explain-domain (non-question forms) ----
    if jargon_hits and ("means" in low or "mean " in low or "what about" in low and any(
        low.startswith(prefix) for prefix in ["why are", "is there", "what about"])):
        return ("Explain-domain",
                f"Operator asks about domain jargon (cue: {jargon_hits[0]}).")

    # ---- Act-locally (STRICT) ----
    is_pure_question = (
        t.endswith("?") and not any(t.lower().startswith(v) for v in [
            "can you", "could you", "please ", "fold ", "make ",
            "draft ", "outline ", "generate ", "render ", "find ",
            "rewrite", "reframe", "reword", "open ", "load ",
            "show me", "take a pass", "take a look", "review ",
            "scrub ", "deploy ", "spin ", "kill-agent",
            "what does", "what is", "what's", "how does", "is there",
        ])
    )

    for cue in ACT_LOCAL_CUES:
        if cue in low:
            if is_pure_question:
                continue
            return ("Act-locally",
                    f"Operator instructs Copilot to execute a local side-effect (cue: '{cue}').")

    # ---- Status-back updates from Operator → Approve-Agent-decision ----
    if re.match(r"^i (moved|posted|pinged|did|got|created|logged|cancelled|sent|clicked|installed|added|paid|merged|opened) ", low):
        return ("Approve-Agent-decision",
                "Operator status-back confirming an operator-side action.")
    if low.startswith("ok i ") and any(w in low for w in ["cancelled", "moved", "posted", "logged", "clicked", "did"]):
        return ("Approve-Agent-decision",
                "Operator status-back confirming an operator-side action.")
    if low.startswith("i got a") or low.startswith("i did not get"):
        return ("Investigate-Agent",
                "Operator reports observed signal absence/presence — Copilot checks state.")
    if re.match(r"^\s*(error|zidong@mac)", low):
        return ("Investigate-Agent",
                "Operator pastes terminal output — Copilot debugs.")
    if low.startswith("crux-windows  [") or low.startswith("crux-windows [") or "from: service@" in low:
        return ("Investigate-Agent",
                "Operator pastes incoming Agent/service message — Copilot reads as state.")
    if re.match(r"^it's in [/~]", low):
        return ("Approve-Agent-decision",
                "Operator answers Copilot's prior question with a parameter.")
    if "kill agent:" in low or ("kill" in low and "inject next time" in low):
        return ("Translate-to-Agent",
                "Operator proposes an Agent intervention/restart pattern.")
    if low in {"bid"} or low == "bid.":
        return ("Translate-to-Agent",
                "One-word tactical directive for Agent (bid).")
    if "help me do this" in low or "help me find the my account page" in low:
        return ("Act-locally",
                "Operator asks Copilot to drive the browser through a task.")
    if len(t) > 250 and ("\n" in t or t.count(". ") >= 2) and any(
        w in low for w in ["methodology", "context management",
                           "writeup", "make a point", "the agent's safety wall",
                           "second-order reasoning", "design choice",
                           "constraint and point out"]):
        return ("Act-locally",
                "Long observation — Copilot records as writeup/methodology note.")
    if any(w in low for w in ["this paragraph", "this sentence", "this section",
                               "the paragraph", "the section",
                               "the diagram", "the table",
                               "this doesn't tell me", "this makes sense but",
                               "doesn't tell me the relationship",
                               "i don't think we need to",
                               "the distinction between",
                               "i odn't think",
                               "go through it comment",
                               "i left a lot of comments",
                               "soften that language",
                               "soften ", "more dramatic",
                               "just say something like",
                               "i have not shipped", "i do not know about",
                               "remove or reframe",
                               "the readme",
                               "go ahead and apply",
                               "ascii is fine",
                               "ok, now reframe", "now reframe",
                               "ok take a pass", "take a pass now",
                               "go back to part",
                               "rewrite", "rewritten", "reframe",
                               "the cron classifier",
                               "claim i want to make",
                               "this is not the claim",
                               "this is good", "make a note that",
                               "place holders", "placeholders"]):
        return ("Act-locally",
                "Editorial/generative directive on Copilot-managed draft.")
    if "root readme" in low or "the readme" in low or "in the readme" in low:
        return ("Act-locally",
                "Editorial directive on README — Copilot edits locally.")
    if re.match(r"^(ok )?let's go [a-z]+[\s,.!]*$", low):
        return ("Approve-Agent-decision",
                "Operator picks a channel/parcel surfaced by Agent.")
    if t.startswith('"') or t.startswith("'") or t.startswith("▎") or " ▎" in t[:6]:
        return ("Act-locally",
                "Operator quotes a draft snippet — Copilot revises locally.")
    if "it was the agent that suggested" in low or "agent suggested" in low:
        return ("Investigate-Agent",
                "Discussion of past Agent behavior.")

    # ---- needs-review (should be empty after locked rules) ----
    return ("needs-review", "No locked rule matched — investigate.")


def main():
    msgs = []
    with open(SOURCE) as f:
        for ln_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            if obj.get("type") != "user":
                continue
            text = get_text(obj.get("message"))
            if not is_operator_typed(text):
                continue
            ts = obj.get("timestamp", "")
            msgs.append({"ts": ts, "text": text, "line_no": ln_no})

    print(f"Operator-typed messages extracted: {len(msgs)}", file=sys.stderr)

    out = []
    in_run_counter = 0
    for new_id, m in enumerate(msgs, start=1):
        text = m["text"]
        preview = text.strip().replace("\n", " ")[:80]

        if new_id < IN_RUN_START_ID:
            phase = "pre-run"
            category = "pre-run-setup"
            rationale = "Phase marker — pre-run setup (Designer/signups/smoke). Not re-classified."
            in_run_id = None
            final = False
        elif new_id in BLOG_DRAFTING_MIDRUN_IDS:
            phase = "in-run-blog-drafting"
            category = "post-run-writeup"
            rationale = ("Mid-run reflective/blog-drafting message — operator "
                         "identified this as not run-relevant; bucketed with "
                         "the post-run writeup tail.")
            # in_run_id intentionally None — excluded from the 99-message window
            in_run_id = None
            final = False
        elif new_id > IN_RUN_END_ID:
            phase = "post-run-writeup"
            category = "post-run-writeup"
            rationale = ("Phase marker — post-run writeup / in-run blog drafting "
                         "(starts at id=167). Not re-classified.")
            in_run_id = None
            final = False
        else:
            phase = "in-run"
            in_run_counter += 1
            in_run_id = in_run_counter
            category, rationale = classify_in_run(text, msg_id=new_id, in_run_id=in_run_id)
            final = True

        out.append({
            "id": new_id,
            "in_run_id": in_run_id,
            "phase": phase,
            "timestamp": m["ts"],
            "text": text,
            "preview": preview,
            "line_no": m["line_no"],
            "category": category,
            "category_rationale": rationale,
            "final": final,
        })

    out_path = os.path.join(OUTDIR, "crux-land-copilot-messages.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"Wrote {out_path}", file=sys.stderr)

    print(f"\nLocked in-run window: id {IN_RUN_START_ID} -> {IN_RUN_END_ID} "
          f"minus id={sorted(BLOG_DRAFTING_MIDRUN_IDS)} "
          f"({in_run_counter} messages)", file=sys.stderr)

    tally = Counter(m["category"] for m in out if m["phase"] == "in-run")
    print("\nIn-run category counts:", file=sys.stderr)
    for k, v in sorted(tally.items(), key=lambda kv: -kv[1]):
        print(f"  {k}: {v}", file=sys.stderr)


if __name__ == "__main__":
    main()
