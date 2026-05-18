#!/usr/bin/env python3
"""Pre-commit check for MDX-unsafe `<digit` / `<$` patterns.

Catches '<' followed by a digit or '$' outside of backticks/code blocks.
These patterns break the Turbopack MDX parser — it treats them as JSX
tag openers and fails because the next character can't start a tag
name (`Unexpected character `1` (U+0031) before name`).

Examples that break the build:
    cost <$25                  -> `<$` parsed as tag start
    <1 acre                    -> `<1` parsed as tag start
    delay of <10 minutes       -> `<1` parsed as tag start

Examples that DON'T break (inside backticks):
    `<gcp-project>`            -> fine, it's a code span
    ```text
    <example>
    ```                        -> fine, it's a fenced code block

Fix: replace `<` with prose ("under 25" / "less than an acre") or
HTML-escape (`&lt;`).
"""
import re
import subprocess
import sys
from pathlib import Path

UNSAFE_PATTERN = re.compile(r'<[\$\d]')


def get_staged_mdx_files() -> list[Path]:
    result = subprocess.run(
        ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'],
        capture_output=True, text=True, check=True,
    )
    return [Path(f) for f in result.stdout.splitlines() if f.endswith('.mdx')]


def get_staged_content(path: Path) -> str:
    result = subprocess.run(
        ['git', 'show', f':{path}'],
        capture_output=True, text=True, check=True,
    )
    return result.stdout


def strip_code_spans(text: str) -> str:
    """Mask inline code spans and fenced code blocks with spaces of the
    same length so line/column numbers don't shift.
    """
    def mask(m: re.Match) -> str:
        # Preserve newlines so line numbers stay aligned.
        return ''.join(c if c == '\n' else ' ' for c in m.group(0))
    # Fenced code blocks first.
    text = re.sub(r'```[\s\S]*?```', mask, text)
    # Then single-backtick inline code spans (single-line only).
    text = re.sub(r'`[^`\n]+`', mask, text)
    return text


def scan_file(path: Path) -> list[tuple[int, int, str]]:
    """Return [(line_no, col, snippet)] for each unsafe match."""
    content = get_staged_content(path)
    stripped = strip_code_spans(content)
    findings: list[tuple[int, int, str]] = []
    orig_lines = content.splitlines()
    for lineno, line in enumerate(stripped.splitlines(), start=1):
        for m in UNSAFE_PATTERN.finditer(line):
            col = m.start() + 1
            orig = orig_lines[lineno - 1] if lineno <= len(orig_lines) else ''
            start = max(0, m.start() - 30)
            end = min(len(orig), m.end() + 50)
            snippet = orig[start:end]
            findings.append((lineno, col, snippet))
    return findings


def main() -> int:
    files = get_staged_mdx_files()
    if not files:
        return 0
    total = 0
    for f in files:
        for lineno, col, snippet in scan_file(f):
            print(f'[MDX-unsafe] {f}:{lineno}:{col}')
            print(f'  context: ...{snippet}...')
            print(f'  fix:     replace `<` with prose ("under N" / "less than N") or HTML-escape (&lt;)')
            total += 1
    if total > 0:
        print()
        print(f'check-mdx-unsafe: BLOCKED — {total} MDX-unsafe pattern(s) in staged .mdx files.')
        print('These patterns break Turbopack MDX parse and would fail the Vercel build.')
        print('Resolve, re-stage, retry. Bypass with `git commit --no-verify` if you must.')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
