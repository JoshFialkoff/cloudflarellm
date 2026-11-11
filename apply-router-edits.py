#!/usr/bin/env python3
"""Apply the 4 router edits to src/index.js with strict assertions (no partial writes)."""
import re
import sys
from pathlib import Path

path = Path("src/index.js")
source = path.read_text()
original = source

# ── Edit 1: system prompt — append DECISIVE block ────────────────────────────
old_prompt = (
    "You are a helpful, expert AI assistant. Follow the user's instructions carefully. "
    "Be concise but thorough, and follow modern best practices. Prefer short, direct answers: "
    "no preamble, no re-stating the question, no filler, no bullet-point summaries unless the user "
    "asks for them. Answer in the fewest words that fully satisfy the request."
)
decisive = (
    " Be DECISIVE: commit to your first answer and never second-guess, hedge, or backtrack. "
    "Never write phrases like 'Wait', 'Actually', 'But', 'Hold on', 'Let me reconsider', "
    "'On the other hand', or 'Hmm' - these indicate wavering and are forbidden. Give the single "
    "best answer; do not present multiple options or alternatives. Do not narrate your internal "
    "reasoning or deliberation process. Provide complete, ready-to-use answers with no placeholders."
)
assert source.count(old_prompt) == 1, f"Edit 1: expected system prompt exactly once, found {source.count(old_prompt)}"
source = source.replace(old_prompt, old_prompt + decisive, 1)

# ── Edit 2: vacillation threshold 7 -> 4 ─────────────────────────────────────
assert source.count("isVacillating: score >= 7") == 1, "Edit 2: expected threshold exactly once"
source = source.replace("isVacillating: score >= 7", "isVacillating: score >= 4", 1)

# ── Edit 3: append wavering patterns after last signs-array entry ────────────
anchor = r"    { pattern: /\bthere (isn't|is not) (a clear|an easy|a simple|one right) (answer|solution|choice|way)\b/i, weight: 2 },"
new_patterns = (
    "    { pattern: /\\bwait\\b/i, weight: 2 },\n"
    "    { pattern: /\\bactually\\b/i, weight: 2 },\n"
    "    { pattern: /\\bhold on\\b/i, weight: 2 },\n"
    "    { pattern: /\\bhmm\\b/i, weight: 1 },\n"
    "    { pattern: /\\bbut wait\\b/i, weight: 2 },\n"
    "    { pattern: /\\blet me (think|check|see|look)\\b/i, weight: 1 },"
)
assert source.count(anchor) == 1, f"Edit 3: expected vacillation anchor exactly once, found {source.count(anchor)}"
source = source.replace(anchor, anchor + "\n" + new_patterns, 1)

# ── Edit 4: too-short guard before BOTH empty-response checks ────────────────
guard_re = re.compile(r"(?m)^([ \t]*)if \(!result\.content && !result\.toolCalls\) \{")

def _insert_guard(m):
    ind = m.group(1)
    lines = [
        ind + "if (result.content && result.content.trim().length < 200 && !result.toolCalls) {",
        ind + "  console.log(`[router] ${modelId} too-short (${result.content.trim().length} chars) - fall through`);",
        ind + "  errors.push({ model: modelId, error: 'response too short' });",
        ind + "  continue;",
        ind + "}",
    ]
    return "\n".join(lines) + "\n" + m.group(0)

source, count = guard_re.subn(_insert_guard, source)
assert count == 2, f"Edit 4: expected two empty-response checks, found {count}"

assert source != original
path.write_text(source)
print("Applied all 4 edits to src/index.js")
print(f"  - system prompt: DECISIVE block appended")
print(f"  - threshold: score >= 7 -> score >= 4")
print(f"  - wavering patterns: +6 entries in detectVacillation")
print(f"  - too-short guard: inserted before {count} empty-response checks")
