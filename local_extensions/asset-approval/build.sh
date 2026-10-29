#!/usr/bin/env bash
# Assemble the loadable bundle: dist is build output, source lives beside it.
#
# This builds the frontend rather than hoping someone already did. It used to
# copy `frontend/dist` when it happened to exist and otherwise write a
# manifest with no `frontend` key at all, silently -- and `frontend/dist` is
# gitignored, so a fresh clone produced a backend-only extension that loaded
# without complaint and served none of the review UI.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$here/../.." && pwd)"

core_types="$repo_root/superset-frontend/packages/superset-core/lib/index.d.ts"

build_frontend() {
  if ! command -v npm >/dev/null 2>&1; then
    echo "build.sh: npm is not on PATH, so the frontend cannot be built." >&2
    echo "  Install node, or re-run with SKIP_FRONTEND=1 for a backend-only bundle." >&2
    return 1
  fi

  # The monorepo pins node ^24.16.0 in superset-frontend/package.json and
  # .nvmrc. Under the node 18 that is still many machines' default, the
  # webpack and ts-loader versions here fail in ways that do not name the
  # cause, so refuse rather than emit a bundle built by the wrong toolchain.
  node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "$node_major" -lt 24 ]; then
    echo "build.sh: node $(node -v 2>/dev/null || echo 'not found') is too old; this repo pins v24.16.0 (.nvmrc)." >&2
    echo "  nvm use   # or: export PATH=\"\$HOME/.nvm/versions/node/v24.16.0/bin:\$PATH\"" >&2
    return 1
  fi

  # `@apache-superset/core` is typed from the package's build output, which is
  # not in git. Without it `styled` resolves to `any` and every styled block
  # fails with TS7031, which reads as a missing Emotion augmentation and is
  # not one -- so say what is actually missing.
  if [ ! -f "$core_types" ]; then
    echo "build.sh: @apache-superset/core has not been built." >&2
    echo "  Expected: $core_types" >&2
    echo "  Build it with:" >&2
    echo "    cd $repo_root/superset-frontend/packages/superset-core && npm run build" >&2
    return 1
  fi

  cd "$here/frontend"
  # `npm ci` is slow enough to be worth skipping when nothing has changed,
  # and wrong to skip when the lockfile has moved under an existing tree.
  if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
    echo "build.sh: installing frontend dependencies"
    # --legacy-peer-deps because @apache-superset/core still declares
    # `peer react@^17.0.2` while this repo runs react 18.3.1, so npm's peer
    # resolution refuses a tree that in fact works. Without it `npm ci`
    # fails with ERESOLVE and nothing is installed.
    npm ci --legacy-peer-deps
  fi
  npm run build
  cd "$here"

  # webpack can exit 0 having emitted nothing worth loading, and the host
  # finds the container by this filename, so check for it rather than for
  # the directory.
  if ! compgen -G "$here/frontend/dist/remoteEntry*.js" >/dev/null; then
    echo "build.sh: the frontend build produced no remoteEntry bundle." >&2
    return 1
  fi
}

skip_frontend="${SKIP_FRONTEND:-}"
if [ -n "$skip_frontend" ]; then
  echo "build.sh: SKIP_FRONTEND set -- not building the frontend." >&2
  echo "  Whatever is in frontend/dist is bundled as-is, stale or absent." >&2
  echo "  For backend-only iteration. Do not ship the result." >&2
else
  build_frontend
fi

rm -rf "$here/dist"
mkdir -p "$here/dist/backend/src"
cp -r "$here/backend/src/asset_approval" "$here/dist/backend/src/"
if [ -d "$here/frontend/dist" ]; then
  mkdir -p "$here/dist/frontend"
  cp -r "$here/frontend/dist" "$here/dist/frontend/dist"
fi
find "$here/dist" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
# The CLI derives the entrypoint from publisher.name; this extension's Python
# package is `asset_approval`, so the manifest is written here instead.
python3 - "$here" "${skip_frontend:+skip}" <<'PYEOF'
import json, os, sys
here = sys.argv[1]
skipping = len(sys.argv) > 2 and sys.argv[2] == "skip"
config = json.load(open(os.path.join(here, "extension.json")))
manifest = {k: v for k, v in config.items() if k != "backend"}
manifest["backend"] = {"entrypoint": "asset_approval.entrypoint"}
frontend_dist = os.path.join(here, "dist", "frontend", "dist")
entry = None
if os.path.isdir(frontend_dist):
    entry = next(
        (f for f in os.listdir(frontend_dist) if f.startswith("remoteEntry")), None
    )
if entry:
    manifest["frontend"] = {
        "remoteEntry": entry,
        "moduleFederationName": "preset_assetApproval",
    }
elif not skipping:
    # Reaching here means the frontend was built and the bundle still did not
    # arrive. Writing the manifest anyway is what hid this for so long.
    raise SystemExit(
        "build.sh: no remoteEntry in dist/frontend/dist; refusing to write a "
        "manifest that claims no frontend."
    )
json.dump(manifest, open(os.path.join(here, "dist", "manifest.json"), "w"), indent=2)
PYEOF
echo "built: $(find "$here/dist" -type f | wc -l | tr -d ' ') files"
