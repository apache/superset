#!/usr/bin/env python3
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Regenerates plugin-chart-country-map's GeoJSON files, countries.ts and
docs/data/countries.json from upstream Natural Earth + community geo
data - the script equivalent of running every cell in
`Country Map GeoJSON Generator.ipynb` top to bottom.

By default writes to the same repo-relative locations the notebook
always has (../src/countries/, ../src/countries.ts,
../../../../docs/data/countries.json), so `git diff` after a run shows
exactly what changed - override --out-dir/--countries-ts-path/
--docs-json-path to redirect output elsewhere for a non-destructive
dry run.

Usage:
    python3 build_maps.py
    python3 build_maps.py --preview --out-dir /tmp/maps-out \\
        --countries-ts-path /tmp/maps-out/countries.ts \\
        --docs-json-path /tmp/maps-out/countries.json
    python3 build_maps.py --countries france,turkey  # just these modules
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import geopandas as gpd

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _SCRIPT_DIR)

from maps.assemble import purged_countries, resolve_all, validate_catalog  # noqa: E402
from maps.context import BuildContext  # noqa: E402
from maps.countries import REGISTRY  # noqa: E402
from maps.data import load_natural_earth  # noqa: E402
from maps.output import save_geojson  # noqa: E402
from maps.preview import build_contact_sheet, render_preview  # noqa: E402
from maps.ts_writer import write_countries_ts, write_docs_json  # noqa: E402

_DEFAULT_OUT_DIR = os.path.join(_SCRIPT_DIR, "..", "src", "countries")
_DEFAULT_COUNTRIES_TS_PATH = os.path.join(_SCRIPT_DIR, "..", "src", "countries.ts")
_DEFAULT_DOCS_JSON_PATH = os.path.join(
    _SCRIPT_DIR, "..", "..", "..", "..", "docs", "data", "countries.json"
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default=os.path.expanduser("~/Downloads"))
    parser.add_argument("--out-dir", default=_DEFAULT_OUT_DIR)
    parser.add_argument("--countries-ts-path", default=_DEFAULT_COUNTRIES_TS_PATH)
    parser.add_argument("--docs-json-path", default=_DEFAULT_DOCS_JSON_PATH)
    parser.add_argument(
        "--countries",
        help="Comma-separated subset of registered module NAMEs to run "
        "(default: all registered). The ~190 plain catalog entries that "
        "don't need a module are included only when this flag is omitted; "
        "a subset build writes just the named modules.",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Also render a PNG thumbnail per output and a contact sheet grid",
    )
    parser.add_argument(
        "--force-download",
        action="store_true",
        help="Re-download Natural Earth data even if a same-size cached copy exists",
    )
    return parser.parse_args()


def _purge_stale_files(
    ctx: BuildContext, built: dict[str, gpd.GeoDataFrame], out_dir: str
) -> None:
    for name in purged_countries(ctx, built):
        stale_path = os.path.join(out_dir, f"{name.replace(' ', '_')}.geojson")
        if os.path.exists(stale_path):
            os.remove(stale_path)
            print(f"Purged {stale_path}: {name} has only one subdivision")


def _save_all(
    ctx: BuildContext,
    resolved: dict[str, gpd.GeoDataFrame],
    out_dir: str,
    preview: bool,
) -> list[dict[str, object]]:
    manifest: list[dict[str, object]] = []
    for name, gdf in sorted(resolved.items()):
        path = save_geojson(ctx, name, gdf, out_dir)
        entry = {
            "name": name,
            "geojson": os.path.relpath(path, out_dir),
            "subdivisions": int(gdf["iso_3166_2"].nunique()),
        }
        if preview:
            thumb_path = render_preview(gdf, name, out_dir)
            entry["thumbnail"] = os.path.relpath(thumb_path, out_dir)
        manifest.append(entry)
    return manifest


def main() -> None:
    args = _parse_args()
    os.makedirs(args.out_dir, exist_ok=True)

    selected = set(args.countries.split(",")) if args.countries else None
    modules = [m for m in REGISTRY if selected is None or m.NAME in selected]
    if not modules:
        raise SystemExit(f"No registered country modules matched: {args.countries}")

    print(f"Loading Natural Earth data into {args.data_dir}...")
    ctx = load_natural_earth(args.data_dir, skip_existing=not args.force_download)

    built: dict[str, gpd.GeoDataFrame] = {}
    for module in modules:
        print(f"Building {module.NAME}...")
        built.update(module.build(ctx))

    if selected is None:
        # Only meaningful once every module has run - a module missing
        # from a --countries subset would otherwise look "invalid".
        validate_catalog(ctx, built)
        _purge_stale_files(ctx, built, args.out_dir)

    resolved = resolve_all(ctx, built, include_plain=selected is None)
    print(f"Resolved {len(resolved)} maps to save")

    manifest = _save_all(ctx, resolved, args.out_dir, args.preview)

    manifest_path = os.path.join(args.out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"Wrote {len(manifest)} GeoJSON files, manifest at {manifest_path}")

    if selected is None:
        countries_combined = sorted(resolved.keys())
        os.makedirs(os.path.dirname(args.countries_ts_path) or ".", exist_ok=True)
        write_countries_ts(countries_combined, args.countries_ts_path)
        print(f"Wrote {args.countries_ts_path}")

        os.makedirs(os.path.dirname(args.docs_json_path) or ".", exist_ok=True)
        write_docs_json(countries_combined, args.docs_json_path)
        print(f"Wrote {args.docs_json_path}")
    else:
        print("Skipping countries.ts/docs-json write: --countries subset given")

    if args.preview:
        sheet_path = build_contact_sheet(manifest, args.out_dir)
        print(f"Contact sheet: {sheet_path}")


if __name__ == "__main__":
    main()
