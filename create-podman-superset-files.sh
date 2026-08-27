#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-$HOME/Project/superset}"
cd "$PROJECT_DIR"

SOURCE_CONTAINERFILE="Dockerfile"
SOURCE_COMPOSE="docker-compose.yml"
PODMAN_CONTAINERFILE="Containerfile.podman"
PODMAN_COMPOSE="docker-compose.podman.yml"

if [[ ! -f "$SOURCE_CONTAINERFILE" ]]; then
  echo "ERROR: $SOURCE_CONTAINERFILE was not found in $PWD" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_COMPOSE" ]]; then
  echo "ERROR: $SOURCE_COMPOSE was not found in $PWD" >&2
  exit 1
fi

# Always regenerate Podman-specific files from untouched upstream files.
cp "$SOURCE_CONTAINERFILE" "$PODMAN_CONTAINERFILE"
cp "$SOURCE_COMPOSE" "$PODMAN_COMPOSE"

# Podman treats BUILDPLATFORM as a predefined build argument and rejects the
# explicit redefinition used by this Dockerfile. Build for the host's native
# architecture instead.
sed -i \
  -e "/If BUILDPLATFORM is null, set it to 'amd64'/d" \
  -e '/^[[:space:]]*ARG BUILDPLATFORM=/d' \
  -e 's|^FROM[[:space:]]\+--platform=${BUILDPLATFORM}[[:space:]]\+|FROM |' \
  -e '\|^[[:space:]]*COPY --from=superset-node /app/superset/static/service-worker\.j\[s\] superset/static/service-worker\.js[[:space:]]*$|d' \
  "$PODMAN_CONTAINERFILE"

# Remove cache_from only from the Podman-specific Compose copy. A small Python
# YAML-aware indentation pass avoids corrupting the following mapping.
python3 - "$PODMAN_COMPOSE" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
out = []
i = 0

while i < len(lines):
    line = lines[i]
    match = re.match(r"^(\s*)cache_from:\s*(?:#.*)?(?:\r?\n)?$", line)
    if not match:
        out.append(line)
        i += 1
        continue

    base_indent = len(match.group(1))
    i += 1

    # Skip all children belonging to cache_from. Stop at the next nonblank,
    # noncomment line whose indentation is at or above cache_from.
    while i < len(lines):
        candidate = lines[i]
        stripped = candidate.strip()
        indent = len(candidate) - len(candidate.lstrip(" "))

        if stripped and not stripped.startswith("#") and indent <= base_indent:
            break

        i += 1

path.write_text("".join(out), encoding="utf-8")
PY

# Add dockerfile beside every exact "context: ." entry while preserving that
# entry's indentation. This covers x-common-build and superset-node.build.
python3 - "$PODMAN_COMPOSE" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
out = []
insertions = 0

for line in lines:
    out.append(line)
    match = re.match(r"^(\s*)context:\s*\.\s*(?:#.*)?(?:\r?\n)?$", line)
    if match:
        newline = "\r\n" if line.endswith("\r\n") else "\n"
        out.append(f"{match.group(1)}dockerfile: Containerfile.podman{newline}")
        insertions += 1

if insertions != 2:
    raise SystemExit(
        f"ERROR: expected 2 exact 'context: .' entries, found {insertions}. "
        "No valid Podman Compose file was generated."
    )

path.write_text("".join(out), encoding="utf-8")
PY

# Static checks before asking Podman Compose to parse the generated file.
if grep -nE \
    'ARG BUILDPLATFORM|--platform=.*BUILDPLATFORM|service-worker\.j\[s\]' \
    "$PODMAN_CONTAINERFILE"; then
  echo "ERROR: an incompatible Containerfile definition remains." >&2
  exit 1
fi

if grep -nE '^[[:space:]]*cache_from:' "$PODMAN_COMPOSE"; then
  echo "ERROR: cache_from remains in $PODMAN_COMPOSE." >&2
  exit 1
fi

count=$(grep -c '^[[:space:]]*dockerfile: Containerfile\.podman$' \
  "$PODMAN_COMPOSE" || true)
if [[ "$count" -ne 2 ]]; then
  echo "ERROR: expected 2 Containerfile.podman references, found $count." >&2
  exit 1
fi

# Parse and expand the final Compose model. This catches YAML indentation and
# anchor errors before starting an expensive build.
podman compose \
  -f "$PODMAN_COMPOSE" \
  -p superset-dev \
  config > /tmp/superset-podman-resolved.yml

if grep -nE '^[[:space:]]*cache_from:' /tmp/superset-podman-resolved.yml; then
  echo "ERROR: cache_from remains in the resolved Compose configuration." >&2
  exit 1
fi

cat <<MSG

Podman-specific files were generated successfully:
  $PWD/$PODMAN_CONTAINERFILE
  $PWD/$PODMAN_COMPOSE

The original files were not modified:
  $PWD/$SOURCE_CONTAINERFILE
  $PWD/$SOURCE_COMPOSE

Build:
  podman compose -f $PODMAN_COMPOSE -p superset-dev build --no-cache

Start:
  podman compose -f $PODMAN_COMPOSE -p superset-dev up -d

Status:
  podman compose -f $PODMAN_COMPOSE -p superset-dev ps -a

Initialization logs:
  podman compose -f $PODMAN_COMPOSE -p superset-dev logs -f superset-init
MSG
