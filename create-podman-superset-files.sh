#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-$HOME/Project/superset}"
cd "$PROJECT_DIR"

SOURCE_CONTAINERFILE="Dockerfile"
SOURCE_COMPOSE="docker-compose.yml"
PODMAN_CONTAINERFILE="Containerfile.podman"
PODMAN_COMPOSE="docker-compose.podman.yml"
RESOLVED_COMPOSE="/tmp/superset-podman-resolved.yml"

for file in "$SOURCE_CONTAINERFILE" "$SOURCE_COMPOSE"; do
  [[ -f "$file" ]] || { echo "ERROR: $file not found in $PWD" >&2; exit 1; }
done
command -v python3 >/dev/null || { echo "ERROR: python3 is required" >&2; exit 1; }
command -v podman >/dev/null || { echo "ERROR: podman is required" >&2; exit 1; }

echo "Generating Podman-specific files..."
cp "$SOURCE_CONTAINERFILE" "$PODMAN_CONTAINERFILE"
cp "$SOURCE_COMPOSE" "$PODMAN_COMPOSE"

# Containerfile fixes:
# - Remove Docker BuildKit BUILDPLATFORM handling.
# - Remove the optional service-worker glob COPY that Podman rejects when the
#   file is absent in a DEV_MODE build.
sed -i \
  -e "/If BUILDPLATFORM is null, set it to 'amd64'/d" \
  -e '/^[[:space:]]*ARG BUILDPLATFORM=/d' \
  -e 's|^FROM[[:space:]]\+--platform=${BUILDPLATFORM}[[:space:]]\+|FROM |' \
  -e '\|^[[:space:]]*COPY --from=superset-node /app/superset/static/service-worker\.j\[s\] superset/static/service-worker\.js[[:space:]]*$|d' \
  "$PODMAN_CONTAINERFILE"

# Force APT to use IPv4 in the Node and Python base stages.
python3 - "$PODMAN_CONTAINERFILE" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
out = []
targets = {"superset-node-ci", "python-base"}
inserted = set()

for line in lines:
    out.append(line)
    m = re.match(r"^\s*FROM\s+\S+\s+AS\s+(\S+)\s*(?:\r?\n)?$", line, re.I)
    if m and m.group(1).lower() in targets:
        stage = m.group(1).lower()
        newline = "\r\n" if line.endswith("\r\n") else "\n"
        out.append(
            "RUN printf '%s\\n' 'Acquire::ForceIPv4 \"true\";' "
            "> /etc/apt/apt.conf.d/99force-ipv4" + newline
        )
        inserted.add(stage)

missing = targets - inserted
if missing:
    raise SystemExit("ERROR: missing stages: " + ", ".join(sorted(missing)))

path.write_text("".join(out), encoding="utf-8")
PY

# Compose fixes:
# - Remove cache_from.
# - Select Containerfile.podman for context: . builds.
# - Add SELinux shared labels (:z) to source-code bind mounts.
# - Preserve read-only mounts as :ro,z.
python3 - "$PODMAN_COMPOSE" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
lines = path.read_text(encoding="utf-8").splitlines(keepends=True)

# Remove cache_from block and its children.
clean = []
i = 0
cache_blocks = 0
while i < len(lines):
    m = re.match(r"^(\s*)cache_from:\s*(?:#.*)?(?:\r?\n)?$", lines[i])
    if not m:
        clean.append(lines[i])
        i += 1
        continue
    cache_blocks += 1
    base_indent = len(m.group(1))
    i += 1
    while i < len(lines):
        text = lines[i].strip()
        indent = len(lines[i]) - len(lines[i].lstrip(" "))
        if text and not text.startswith("#") and indent <= base_indent:
            break
        i += 1

if cache_blocks != 1:
    raise SystemExit(f"ERROR: expected 1 cache_from block, found {cache_blocks}")

# Exact bind-mount replacements. :z is used because these project paths may be
# shared by multiple Superset containers.
mounts = {
    "./docker:/app/docker": "./docker:/app/docker:z",
    "./superset:/app/superset": "./superset:/app/superset:z",
    "./superset-core:/app/superset-core": "./superset-core:/app/superset-core:z",
    "./superset-frontend:/app/superset-frontend": "./superset-frontend:/app/superset-frontend:z",
    "./tests:/app/tests": "./tests:/app/tests:z",
    "./local_extensions:/app/local_extensions": "./local_extensions:/app/local_extensions:z",
    "./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro": "./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro,z",
    "./docker/nginx/templates:/etc/nginx/templates:ro": "./docker/nginx/templates:/etc/nginx/templates:ro,z",
    "./docker/docker-entrypoint-initdb.d:/docker-entrypoint-initdb.d": "./docker/docker-entrypoint-initdb.d:/docker-entrypoint-initdb.d:z",
    "./superset-websocket:/home/superset-websocket": "./superset-websocket:/home/superset-websocket:z",
    "./docker/superset-websocket/config.example.json:/home/superset-websocket/config.json:ro": "./docker/superset-websocket/config.example.json:/home/superset-websocket/config.json:ro,z",
}
counts = {key: 0 for key in mounts}
out = []
dockerfile_insertions = 0

for line in clean:
    replaced = False
    for source, target in mounts.items():
        m = re.match(rf"^(\s*-\s*){re.escape(source)}\s*(?:\r?\n)?$", line)
        if m:
            newline = "\r\n" if line.endswith("\r\n") else "\n"
            out.append(f"{m.group(1)}{target}{newline}")
            counts[source] += 1
            replaced = True
            break
    if replaced:
        continue

    out.append(line)
    m = re.match(r"^(\s*)context:\s*\.\s*(?:#.*)?(?:\r?\n)?$", line)
    if m:
        newline = "\r\n" if line.endswith("\r\n") else "\n"
        out.append(f"{m.group(1)}dockerfile: Containerfile.podman{newline}")
        dockerfile_insertions += 1

if dockerfile_insertions != 2:
    raise SystemExit(
        f"ERROR: expected 2 context entries, found {dockerfile_insertions}"
    )

missing = [source for source, count in counts.items() if count == 0]
if missing:
    raise SystemExit("ERROR: expected mounts not found:\n  " + "\n  ".join(missing))

path.write_text("".join(out), encoding="utf-8")
PY

# Podman-specific runtime compatibility:
# - Pass shell boolean values as explicit lowercase strings.
# - Let Nginx reach webpack directly through Compose service DNS.
sed -i \
  -e 's/^\([[:space:]]*BUILD_SUPERSET_FRONTEND_IN_DOCKER:\)[[:space:]]*true[[:space:]]*$/\1 "true"/' \
  -e 's/^\([[:space:]]*NPM_RUN_PRUNE:\)[[:space:]]*false[[:space:]]*$/\1 "false"/' \
  -e 's|http://host\.docker\.internal:9000/static/assets/manifest\.json|http://superset-node:9000/static/assets/manifest.json|g' \
  "$PODMAN_COMPOSE"

# Static validation.
if grep -nE 'ARG BUILDPLATFORM|--platform=.*BUILDPLATFORM|service-worker\.j\[s\]' "$PODMAN_CONTAINERFILE"; then
  echo "ERROR: incompatible Containerfile instruction remains" >&2
  exit 1
fi
[[ $(grep -c 'Acquire::ForceIPv4' "$PODMAN_CONTAINERFILE" || true) -eq 2 ]] || {
  echo "ERROR: expected 2 APT IPv4 settings" >&2; exit 1;
}
if grep -nE '^[[:space:]]*cache_from:' "$PODMAN_COMPOSE"; then
  echo "ERROR: cache_from remains" >&2
  exit 1
fi
[[ $(grep -c '^[[:space:]]*dockerfile: Containerfile\.podman$' "$PODMAN_COMPOSE" || true) -eq 2 ]] || {
  echo "ERROR: expected 2 Containerfile.podman references" >&2; exit 1;
}

# Parse the generated YAML and resolve anchors.
echo "Validating generated Compose configuration..."
podman compose -f "$PODMAN_COMPOSE" -p superset-dev config > "$RESOLVED_COMPOSE"

echo
echo "SUCCESS: generated and validated:"
echo "  $PWD/$PODMAN_CONTAINERFILE"
echo "  $PWD/$PODMAN_COMPOSE"
echo
echo "Original files were not modified:"
echo "  $PWD/$SOURCE_CONTAINERFILE"
echo "  $PWD/$SOURCE_COMPOSE"
echo
echo "Set rootless Nginx port in docker/.env-local:"
echo "  NGINX_PORT=8080"
echo
echo "Build:"
echo "  podman compose -f $PODMAN_COMPOSE -p superset-dev build"
echo
echo "Start:"
echo "  podman compose -f $PODMAN_COMPOSE -p superset-dev up -d"
echo
echo "Status:"
echo "  podman compose -f $PODMAN_COMPOSE -p superset-dev ps -a"
echo
echo "Logs:"
echo "  podman compose -f $PODMAN_COMPOSE -p superset-dev logs -f"
