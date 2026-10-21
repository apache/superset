#!/usr/bin/env bash
# Assemble the loadable bundle: dist is build output, source lives beside it.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
python3 - "$here" <<'PYEOF'
import json, os, sys
here = sys.argv[1]
config = json.load(open(os.path.join(here, "extension.json")))
manifest = {k: v for k, v in config.items() if k != "backend"}
manifest["backend"] = {"entrypoint": "asset_approval.entrypoint"}
frontend_dist = os.path.join(here, "dist", "frontend", "dist")
if os.path.isdir(frontend_dist):
    entry = next(
        (f for f in os.listdir(frontend_dist) if f.startswith("remoteEntry")), None
    )
    if entry:
        manifest["frontend"] = {
            "remoteEntry": entry,
            "moduleFederationName": "preset_assetApproval",
        }
json.dump(manifest, open(os.path.join(here, "dist", "manifest.json"), "w"), indent=2)
PYEOF
echo "built: $(find "$here/dist" -type f | wc -l | tr -d ' ') files"
