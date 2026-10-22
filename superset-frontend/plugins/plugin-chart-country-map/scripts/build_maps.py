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
"""Prototype orchestrator for the per-country map build scripts under
`maps/countries/`. Does NOT yet cover the ~190 plain countries that
don't need special-casing, nor write countries.ts / docs/data/countries.json
- this is scoped to proving the per-country script + orchestrator +
preview pattern on a handful of converted countries before committing to
converting the rest and retiring the notebook.

Usage:
    python3 build_maps.py --out-dir /tmp/maps-out --preview
    python3 build_maps.py --countries morocco,usa --out-dir /tmp/maps-out
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from maps.countries import REGISTRY  # noqa: E402
from maps.data import load_natural_earth  # noqa: E402
from maps.output import save_geojson  # noqa: E402
from maps.preview import build_contact_sheet, render_preview  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default=os.path.expanduser("~/Downloads"))
    parser.add_argument(
        "--out-dir",
        default=os.path.join(
            os.path.dirname(os.path.abspath(__file__)), ".build-output"
        ),
    )
    parser.add_argument(
        "--countries",
        help="Comma-separated subset of registered module NAMEs to run "
        "(default: all registered)",
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
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    selected = set(args.countries.split(",")) if args.countries else None
    modules = [m for m in REGISTRY if selected is None or m.NAME in selected]
    if not modules:
        raise SystemExit(f"No registered country modules matched: {args.countries}")

    print(f"Loading Natural Earth data into {args.data_dir}...")
    ctx = load_natural_earth(args.data_dir, skip_existing=not args.force_download)

    manifest = []
    for module in modules:
        print(f"Building {module.NAME}...")
        outputs = module.build(ctx)
        for name, gdf in outputs.items():
            path = save_geojson(ctx, name, gdf, args.out_dir)
            entry = {
                "name": name,
                "geojson": os.path.relpath(path, args.out_dir),
                "subdivisions": int(gdf["iso_3166_2"].nunique()),
            }
            if args.preview:
                thumb_path = render_preview(gdf, name, args.out_dir)
                entry["thumbnail"] = os.path.relpath(thumb_path, args.out_dir)
            manifest.append(entry)
            print(f"  -> {entry}")

    manifest_path = os.path.join(args.out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"Wrote {len(manifest)} entries to {manifest_path}")

    if args.preview:
        sheet_path = build_contact_sheet(manifest, args.out_dir)
        print(f"Contact sheet: {sheet_path}")


if __name__ == "__main__":
    main()
