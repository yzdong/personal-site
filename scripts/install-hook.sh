#!/bin/bash
# Install the MDX-unsafe pre-commit hook for personal-site.
#
# Run once after cloning: `bash scripts/install-hook.sh`

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_PATH="$REPO_ROOT/.git/hooks/pre-commit"

cat > "$HOOK_PATH" <<'EOF'
#!/bin/bash
# Auto-installed by scripts/install-hook.sh — runs the MDX-unsafe
# pattern check on staged .mdx files. Bypass with --no-verify.
exec python3 "$(git rev-parse --show-toplevel)/scripts/check-mdx-unsafe.py"
EOF

chmod +x "$HOOK_PATH"

echo "Installed pre-commit hook → $HOOK_PATH"
echo "Bypass once: git commit --no-verify"
