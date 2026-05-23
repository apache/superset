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

"""
Country Map build pipeline — Natural Earth → GeoJSON.

Replaces the legacy Jupyter notebook. Reads YAML configs from config/,
downloads pinned Natural Earth shapefiles, applies declarative transforms,
optionally runs procedural escape-hatch scripts, and writes per-worldview
GeoJSON outputs to output/.

Run with: ./build.sh  (which is just `python3 build.py` with sensible env)

This is the POC version — currently implements:
  - NE shapefile download + cache (pinned to v5.1.2)
  - Shapefile → GeoJSON conversion via mapshaper CLI
  - name_overrides.yaml application
  - One worldview (UA) at Admin 0

Future commits will add: multiple worldviews, Admin 1, flying_islands,
territory_assignments, regional_aggregations, composite_maps, simplification,
procedural/ orchestration.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Any

import yaml

# ----------------------------------------------------------------------
# Constants / paths
# ----------------------------------------------------------------------

NE_REPO = "nvkelso/natural-earth-vector"
NE_PINNED_TAG = "v5.1.2"
NE_PINNED_SHA = "f1890d9f152c896d250a77557a5751a93d494776"
NE_RAW_URL = f"https://raw.githubusercontent.com/{NE_REPO}/{NE_PINNED_SHA}/10m_cultural"

# Mapshaper pinned version — outputs are not byte-deterministic across
# major mapshaper revisions (different simplification quantization),
# so we pin via npx for both local + CI runs.
MAPSHAPER_VERSION = "0.7.15"

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_DIR = SCRIPT_DIR / "config"
CACHE_DIR = SCRIPT_DIR / ".cache"

# Outputs ship into Superset's Flask static directory so the chart can
# fetch them at runtime without webpack involvement. The path that
# Flask serves them at is `/static/assets/country-maps/<file>`.
#
# The repo path is computed relative to this script; supports running
# from anywhere in the source tree.
# parents[0]=plugin-chart-country-map, [1]=plugins, [2]=superset-frontend, [3]=repo root
REPO_ROOT = SCRIPT_DIR.parents[3]
OUTPUT_DIR = REPO_ROOT / "superset" / "static" / "assets" / "country-maps"

SHAPEFILE_EXTS = ["shp", "shx", "dbf", "prj", "cpg"]

# Worldview codes shipped by Natural Earth as filename suffixes on the
# Admin 0 layer. Empty string = NE's "Default" editorial; every other
# entry maps 1-to-1 to a file `ne_10m_admin_0_countries_<code>.shp`
# published at the pinned NE tag. Adding a code here is all it takes to
# expose a new worldview in the chart's dropdown — provided NE actually
# publishes that suffix at the pinned version.
#
# Admin 1 (subdivisions within a country) is published by NE as a single
# global file with no worldview variants, so subdivision boundaries
# don't change with the worldview choice. That means we build Admin 1
# once (under the "ukr" name for back-compat with earlier output) and
# the frontend always points Admin 1 URLs at that shared output.
WORLDVIEWS_ADMIN_0 = [
    "",  # Default — NE's ungrouped editorial baseline
    "arg",  # Argentina
    "bdg",  # Bangladesh (NE uses bdg, ISO code is BGD)
    "bra",  # Brazil
    "chn",  # China
    "deu",  # Germany
    "egy",  # Egypt
    "esp",  # Spain
    "fra",  # France
    "gbr",  # United Kingdom
    "grc",  # Greece
    "idn",  # Indonesia
    "ind",  # India
    "iso",  # ISO 3166-1 (neutral / UN-style boundaries)
    "isr",  # Israel
    "ita",  # Italy
    "jpn",  # Japan
    "kor",  # South Korea
    "mar",  # Morocco
    "nep",  # Nepal
    "nld",  # Netherlands
    "pak",  # Pakistan
    "pol",  # Poland
    "prt",  # Portugal
    "pse",  # Palestine
    "rus",  # Russia
    "sau",  # Saudi Arabia
    "swe",  # Sweden
    "tur",  # Türkiye
    "twn",  # Taiwan
    "ukr",  # Ukraine — Superset's documented default
    "usa",  # United States
    "vnm",  # Vietnam
]


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


# ----------------------------------------------------------------------
# NE download
# ----------------------------------------------------------------------


def fetch_ne_shapefile(admin_level: int, worldview: str = "") -> Path:
    """Download (or use cached) shapefile components for one NE layer.

    Returns the path to the `.shp` file; sibling `.shx`/`.dbf`/`.prj`/`.cpg`
    files live alongside as mapshaper requires.
    """
    if admin_level == 0:
        suffix = f"_{worldview}" if worldview else ""
        basename = f"ne_10m_admin_0_countries{suffix}"
    elif admin_level == 1:
        # NE only publishes worldview-specific files at Admin 0. Admin 1
        # uses a single file with per-feature `WORLDVIEW` attributes.
        basename = "ne_10m_admin_1_states_provinces"
    else:
        raise ValueError(f"Unsupported admin_level={admin_level}")

    target_shp = CACHE_DIR / f"{basename}.shp"
    if target_shp.exists():
        return target_shp

    CACHE_DIR.mkdir(exist_ok=True)
    log(f"Downloading NE {basename} (worldview={worldview or 'default'})…")
    for ext in SHAPEFILE_EXTS:
        url = f"{NE_RAW_URL}/{basename}.{ext}"
        dest = CACHE_DIR / f"{basename}.{ext}"
        try:
            urllib.request.urlretrieve(url, dest)
        except urllib.error.HTTPError as e:
            if ext == "cpg" and e.code == 404:
                # .cpg is optional in shapefile bundles
                continue
            raise

    return target_shp


# ----------------------------------------------------------------------
# Shapefile → GeoJSON via mapshaper CLI
# ----------------------------------------------------------------------


def shp_to_geojson(shp: Path, output: Path) -> None:
    """Convert a shapefile to GeoJSON FeatureCollection.

    Also normalizes property names to lowercase: NE ships Admin 0 with
    uppercase field names (ADM0_A3, NAME_EN, ...) and Admin 1 with
    lowercase (adm0_a3, name_en, ...). All transforms downstream assume
    lowercase, so we normalize at conversion time.
    """
    if shutil.which("npx") is None:
        raise RuntimeError(
            "npx not found in PATH; mapshaper is required for shapefile conversion"
        )
    log(f"  mapshaper: {shp.name} → {output.name}")
    subprocess.run(
        [
            "npx",
            "--yes",
            "mapshaper@" + MAPSHAPER_VERSION,
            str(shp),
            "-o",
            str(output),
            "format=geojson",
        ],
        check=True,
        stderr=subprocess.DEVNULL,
    )
    _normalize_property_keys(output)


def _normalize_property_keys(geojson_path: Path) -> None:
    """Lowercase all feature property keys in-place."""
    geo = json.loads(geojson_path.read_text())
    for f in geo.get("features", []):
        props = f.get("properties") or {}
        f["properties"] = {k.lower(): v for k, v in props.items()}
    geojson_path.write_text(json.dumps(geo))


def simplify_geojson(src: Path, dst: Path, percentage: float = 5.0) -> None:
    """Run mapshaper -simplify to reduce file size with topology preserved.

    Default 5% keeps recognizable country shapes while shrinking typical
    Admin 1 output ~10x. `keep-shapes` prevents tiny features (small
    islands) from being dropped entirely.
    """
    log(f"  mapshaper -simplify {percentage}% keep-shapes: {src.name} → {dst.name}")
    subprocess.run(
        [
            "npx",
            "--yes",
            "mapshaper@" + MAPSHAPER_VERSION,
            str(src),
            "-simplify",
            f"{percentage}%",
            "keep-shapes",
            "-o",
            str(dst),
            "format=geojson",
        ],
        check=True,
        stderr=subprocess.DEVNULL,
    )


# ----------------------------------------------------------------------
# Match helpers
# ----------------------------------------------------------------------


def _matches(props: dict[str, Any], conditions: dict[str, Any]) -> bool:
    """Check whether a feature's properties satisfy all conditions in match.

    Supports two value forms:
      - scalar: exact equality
      - {in: [...]}: membership in a list
    """
    for k, want in conditions.items():
        got = props.get(k)
        if isinstance(want, dict) and "in" in want:
            if got not in want["in"]:
                return False
        else:
            if got != want:
                return False
    return True


# ----------------------------------------------------------------------
# Transforms
# ----------------------------------------------------------------------


def apply_name_overrides(
    geo: dict[str, Any], overrides: list[dict[str, Any]]
) -> dict[str, Any]:
    """Apply attribute overrides from name_overrides.yaml."""
    n_applied = 0
    for entry in overrides:
        match = entry["match"]
        new_values = entry["set"]
        for feature in geo["features"]:
            props = feature["properties"]
            if _matches(props, match):
                props.update(new_values)
                n_applied += 1
    log(
        f"  name_overrides: applied {n_applied} field updates "
        f"across {len(overrides)} entries"
    )
    return geo


def _collect_coords(geom: dict[str, Any], xs: list[float], ys: list[float]) -> None:
    """Walk a Polygon/MultiPolygon and collect all x/y values."""

    def walk(c: Any) -> None:
        if isinstance(c[0], (int, float)):
            xs.append(c[0])
            ys.append(c[1])
        else:
            for sub in c:
                walk(sub)

    walk(geom["coordinates"])


def _bbox_center(geom: dict[str, Any]) -> tuple[float, float]:
    xs: list[float] = []
    ys: list[float] = []
    _collect_coords(geom, xs, ys)
    return ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)


def _translate_and_scale_with_pivot(
    geom: dict[str, Any],
    offset: list[float],
    scale: float,
    pivot: tuple[float, float],
) -> dict[str, Any]:
    """Translate + scale a geometry around an explicit pivot point.

    Pure-Python — no shapely. Operates on Polygon/MultiPolygon coords
    (the only types in NE Admin 0/1 country geometries).
    """
    cx, cy = pivot
    dx, dy = offset

    def transform_pt(p: list[float]) -> list[float]:
        return [(p[0] - cx) * scale + cx + dx, (p[1] - cy) * scale + cy + dy]

    def walk(c: Any) -> Any:
        if isinstance(c[0], (int, float)):
            return transform_pt(c)
        return [walk(sub) for sub in c]

    geom["coordinates"] = walk(geom["coordinates"])
    return geom


def _translate_and_scale(
    geom: dict[str, Any],
    offset: list[float],
    scale: float = 1.0,
) -> dict[str, Any]:
    """Translate + scale around the geometry's own bbox center."""
    return _translate_and_scale_with_pivot(geom, offset, scale, _bbox_center(geom))


def _drop_parts(geom: dict[str, Any], indices: list[int]) -> dict[str, Any]:
    """Drop specific sub-polygon indices from a MultiPolygon (no-op for Polygon)."""
    if geom["type"] != "MultiPolygon":
        return geom
    drop_set = set(indices)
    kept = [p for i, p in enumerate(geom["coordinates"]) if i not in drop_set]
    return {"type": "MultiPolygon", "coordinates": kept}


def _bbox_contains(geom: dict[str, Any], nw: list[float], se: list[float]) -> bool:
    """Whether the geometry's bbox is fully contained within the [nw, se] box."""
    xs: list[float] = []
    ys: list[float] = []

    def _walk(c: Any) -> None:
        if isinstance(c[0], (int, float)):
            xs.append(c[0])
            ys.append(c[1])
        else:
            for sub in c:
                _walk(sub)

    _walk(geom["coordinates"])
    if not xs:
        return False
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    # nw = (lon_west, lat_north); se = (lon_east, lat_south)
    return x_min >= nw[0] and x_max <= se[0] and y_min >= se[1] and y_max <= nw[1]


def apply_composite_maps(
    base_admin1: dict[str, Any],
    config: dict[str, Any],
    worldview: str,
    simplify_pct: float = 5.0,
) -> list[Path]:
    """Build one composite GeoJSON per entry in composite_maps.yaml.

    A composite combines a base country's Admin 1 features with
    repositions + features pulled from sibling Admin 0 records' Admin 1
    subdivisions, all into one map. Used for France-with-Overseas
    (pulls Windward Islands from PYF Admin 1, Kerguelen from ATF
    Admin 1, etc.).

    `base_admin1` is the post-name_overrides global Admin 1 geo, which
    contains ALL countries' subdivisions (NE Admin 1 is one global
    dataset, not per-worldview). Composites do their own repositioning
    and don't depend on flying_islands state.

    Returns list of output paths created.
    """
    composites = config.get("composites", {})
    if not composites:
        log("  composite_maps: nothing to apply (config empty)")
        return []

    outputs: list[Path] = []
    wv_label = worldview or "default"

    for composite_id, cdef in composites.items():
        base_a3 = cdef["base"]["adm0_a3"]

        # Start with base country's Admin 1 features (deep copy)
        composite_features: list[dict[str, Any]] = [
            json.loads(json.dumps(f))
            for f in base_admin1["features"]
            if f["properties"].get("adm0_a3") == base_a3
        ]

        # ---- base_repositions ------------------------------------------
        for entry in cdef.get("base_repositions", []):
            match = entry["match"]
            offset = entry["offset"]
            scale = entry.get("scale", 1.0)
            group = entry.get("group", False)
            drop_parts = entry.get("drop_parts")

            matched = [
                f for f in composite_features if _matches(f["properties"], match)
            ]
            if not matched:
                log(
                    f"    WARN: composite {composite_id} base_reposition matched 0 features for {match}"
                )
                continue

            if group and len(matched) > 1:
                # Compute shared pivot across all matched features so they
                # transform as one body (Paris + petite couronne case).
                xs: list[float] = []
                ys: list[float] = []
                for f in matched:
                    _collect_coords(f["geometry"], xs, ys)
                pivot = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)
                for f in matched:
                    if drop_parts:
                        f["geometry"] = _drop_parts(f["geometry"], drop_parts)
                    _translate_and_scale_with_pivot(
                        f["geometry"], offset=offset, scale=scale, pivot=pivot
                    )
            else:
                for f in matched:
                    if drop_parts:
                        f["geometry"] = _drop_parts(f["geometry"], drop_parts)
                    _translate_and_scale(f["geometry"], offset=offset, scale=scale)

        # ---- additions -------------------------------------------------
        for add in cdef.get("additions", []):
            from_spec = add["from"]
            source_a3 = from_spec["adm0_a3"]
            source_match = from_spec.get("match", {})
            dissolve = from_spec.get("dissolve", False)
            drop_parts = add.get("drop_parts")
            reposition = add["reposition"]
            offset = reposition["offset"]
            scale = reposition.get("scale", 1.0)
            set_fields = add.get("set", {})

            # All current additions pull from Admin 1 features of a
            # sibling Admin 0 record (Windward Islands from PYF Admin 1,
            # Kerguelen from ATF Admin 1, etc.). Admin 1 is one global
            # dataset shared across worldviews.
            matched_source = [
                json.loads(json.dumps(f))
                for f in base_admin1["features"]
                if f["properties"].get("adm0_a3") == source_a3
                and (not source_match or _matches(f["properties"], source_match))
            ]

            if not matched_source:
                log(
                    f"    WARN: composite {composite_id} addition for "
                    f"adm0_a3={source_a3} match={source_match} found 0 features"
                )
                continue

            # If dissolve=true and multiple matched, merge via mapshaper
            if dissolve and len(matched_source) > 1:
                inter = (
                    OUTPUT_DIR
                    / f"_composite_pre_dissolve_{composite_id}_{source_a3}.geo.json"
                )
                inter.write_text(
                    json.dumps(
                        {
                            "type": "FeatureCollection",
                            "features": matched_source,
                        }
                    )
                )
                dissolved_path = (
                    OUTPUT_DIR
                    / f"_composite_dissolved_{composite_id}_{source_a3}.geo.json"
                )
                subprocess.run(
                    [
                        "npx",
                        "--yes",
                        "mapshaper@" + MAPSHAPER_VERSION,
                        str(inter),
                        "-each",
                        "this.properties._x = 1",
                        "-dissolve",
                        "_x",
                        "-o",
                        str(dissolved_path),
                        "format=geojson",
                    ],
                    check=True,
                    stderr=subprocess.DEVNULL,
                )
                dissolved = json.loads(dissolved_path.read_text())
                inter.unlink()
                dissolved_path.unlink()
                added = [
                    {
                        "type": "Feature",
                        "geometry": dissolved["features"][0]["geometry"],
                        "properties": {},
                    }
                ]
            else:
                added = matched_source[:1]

            # Drop parts → reposition → attribute set → reattach to base country
            for f in added:
                if drop_parts:
                    f["geometry"] = _drop_parts(f["geometry"], drop_parts)
                _translate_and_scale(f["geometry"], offset=offset, scale=scale)
                f["properties"]["adm0_a3"] = base_a3
                f["properties"].update(set_fields)
                composite_features.append(f)

        # ---- write + simplify ------------------------------------------
        composite_geo = {
            "type": "FeatureCollection",
            "features": composite_features,
        }
        inter = (
            OUTPUT_DIR / f"_composite_pre_simplify_{composite_id}_{wv_label}.geo.json"
        )
        inter.write_text(json.dumps(composite_geo))

        output = OUTPUT_DIR / f"composite_{composite_id}_{wv_label}.geo.json"
        subprocess.run(
            [
                "npx",
                "--yes",
                "mapshaper@" + MAPSHAPER_VERSION,
                str(inter),
                "-simplify",
                f"{simplify_pct}%",
                "keep-shapes",
                "-o",
                str(output),
                "format=geojson",
            ],
            check=True,
            stderr=subprocess.DEVNULL,
        )
        inter.unlink()

        log(
            f"    {composite_id}: {len(composite_features)} features → "
            f"{output.name} ({output.stat().st_size:,} bytes)"
        )
        outputs.append(output)

    return outputs


def apply_regional_aggregations(
    geo: dict[str, Any],
    config: dict[str, Any],
    worldview: str,
    simplify_pct: float = 5.0,
) -> list[Path]:
    """Build one dissolved GeoJSON per (country, region_set).

    For each region_set in the config:
      1. Filter Admin 1 features to the destination country
      2. Tag each with a derived `_region_code` (and `_region_name`)
         based on either an explicit_mapping or grouping_field
      3. Write to intermediate file; mapshaper -dissolve merges by
         `_region_code` in one pass
      4. Rename `_region_code` → `iso_3166_2`, `_region_name` → `name`
         on the dissolved output

    Returns list of output paths created.
    """
    countries = config.get("countries", {})
    if not countries:
        log("  regional_aggregations: nothing to apply (config empty)")
        return []

    outputs: list[Path] = []
    wv_label = worldview or "default"

    for country_a3, rules in countries.items():
        for set_name, set_def in rules.get("region_sets", {}).items():
            country_features = [
                f
                for f in geo["features"]
                if f["properties"].get("adm0_a3") == country_a3
            ]

            tagged: list[dict[str, Any]] = []
            if "explicit_mapping" in set_def:
                em = set_def["explicit_mapping"]
                # iso_3166_2 → (region_code, region_name)
                reverse: dict[str, tuple[str, str]] = {
                    member: (rcode, rdef["name"])
                    for rcode, rdef in em.items()
                    for member in rdef["members"]
                }
                for f in country_features:
                    iso = f["properties"].get("iso_3166_2")
                    if iso in reverse:
                        rcode, rname = reverse[iso]
                        # deep copy so we don't mutate the upstream geo
                        nf = json.loads(json.dumps(f))
                        nf["properties"]["_region_code"] = rcode
                        nf["properties"]["_region_name"] = rname
                        tagged.append(nf)
            elif "grouping_field" in set_def:
                gf = set_def["grouping_field"]
                for f in country_features:
                    val = f["properties"].get(gf)
                    if val:
                        nf = json.loads(json.dumps(f))
                        nf["properties"]["_region_code"] = str(val)
                        # display name same as code unless we add a separate
                        # display-name field later (e.g. region_cod_name on NE)
                        nf["properties"]["_region_name"] = str(val)
                        tagged.append(nf)
            else:
                log(
                    f"    {country_a3}/{set_name}: no explicit_mapping or grouping_field — skipping"
                )
                continue

            if not tagged:
                log(
                    f"    {country_a3}/{set_name}: no features matched mapping — skipping"
                )
                continue

            n_groups = len({f["properties"]["_region_code"] for f in tagged})

            inter = (
                OUTPUT_DIR
                / f"_pre_dissolve_{country_a3}_{set_name}_{wv_label}.geo.json"
            )
            inter.write_text(
                json.dumps({"type": "FeatureCollection", "features": tagged})
            )

            output = (
                OUTPUT_DIR / f"regional_{country_a3}_{set_name}_{wv_label}.geo.json"
            )
            subprocess.run(
                [
                    "npx",
                    "--yes",
                    "mapshaper@" + MAPSHAPER_VERSION,
                    str(inter),
                    "-dissolve",
                    "_region_code",
                    "copy-fields=_region_name,adm0_a3",
                    "-simplify",
                    f"{simplify_pct}%",
                    "keep-shapes",
                    "-o",
                    str(output),
                    "format=geojson",
                ],
                check=True,
                stderr=subprocess.DEVNULL,
            )
            inter.unlink()

            # Rename derived fields → standard names on the dissolved output
            dissolved = json.loads(output.read_text())
            for f in dissolved["features"]:
                p = f["properties"]
                if "_region_code" in p:
                    p["iso_3166_2"] = p.pop("_region_code")
                if "_region_name" in p:
                    p["name"] = p.pop("_region_name")
            output.write_text(json.dumps(dissolved))

            log(
                f"    {country_a3}/{set_name}: {len(tagged)} subdivisions → "
                f"{n_groups} regions → {output.name} "
                f"({output.stat().st_size:,} bytes)"
            )
            outputs.append(output)

    return outputs


def apply_territory_assignments(
    geo: dict[str, Any],
    config: dict[str, Any],
    admin0_geo: dict[str, Any],
) -> dict[str, Any]:
    """Pull features from sibling Admin 0 records into a destination country.

    Operates on Admin 1 outputs only — the use cases (China + SARs,
    Finland + Åland) all pull from Admin 0 records of one country and
    add them as single Admin 1 subdivisions of another.

    `admin0_geo` must already be loaded by the caller — passed in to
    avoid re-downloading.
    """
    countries = config.get("countries", {})
    if not countries:
        log("  territory_assignments: nothing to apply (config empty)")
        return geo

    n_added = 0
    for dest_a3, rules in countries.items():
        for entry in rules.get("additions", []):
            from_spec = entry["from"]
            source_a3 = from_spec["adm0_a3"]
            source_match = from_spec.get("match", {})

            for f in admin0_geo["features"]:
                p = f["properties"]
                if p.get("adm0_a3") != source_a3:
                    continue
                if source_match and not _matches(p, source_match):
                    continue

                # Deep copy; reattach to destination country
                new_feature = json.loads(json.dumps(f))
                new_feature["properties"]["adm0_a3"] = dest_a3
                if "set" in entry:
                    new_feature["properties"].update(entry["set"])
                geo["features"].append(new_feature)
                n_added += 1
                break  # take first match per addition entry

    log(
        f"  territory_assignments: added {n_added} features from sibling Admin 0 records"
    )
    return geo


def apply_flying_islands(
    geo: dict[str, Any],
    config: dict[str, Any],
    country_a3: str | None,
    admin_level: int,
) -> dict[str, Any]:
    """Apply flying_islands.yaml transforms.

    For Admin 0 outputs, `country_a3` is None and we apply each country's
    rules to features matching that adm0_a3.

    For Admin 1 outputs (per-country), `country_a3` scopes the application
    to just that country's rules.
    """
    countries = config.get("countries", {})

    n_repos = 0
    n_dropped = 0

    for a3, rules in countries.items():
        if country_a3 is not None and a3 != country_a3:
            continue

        # Repositions
        for entry in rules.get("repositions", []):
            match = entry["match"]
            offset = entry["offset"]
            scale = entry.get("scale", 1.0)
            for f in geo["features"]:
                props = f["properties"]
                if props.get("adm0_a3") != a3:
                    continue
                if not _matches(props, match):
                    continue
                f["geometry"] = _translate_and_scale(
                    f["geometry"], offset=offset, scale=scale
                )
                # Tag the feature so the frontend can drop it at runtime
                # via the "Show flying islands" toggle. Without this tag
                # the toggle would have nothing to filter on.
                props["_flying"] = True
                n_repos += 1

        # Drop outside bbox — only meaningful at Admin 1 (where each
        # feature is a single subdivision). At Admin 0 a country's
        # multi-polygon often extends to overseas territories, so the
        # bbox check would drop entire countries.
        drop = rules.get("drop_outside_bbox") if admin_level == 1 else None
        if drop:
            nw, se = drop["nw"], drop["se"]
            kept: list[dict[str, Any]] = []
            for f in geo["features"]:
                if f["properties"].get("adm0_a3") != a3:
                    kept.append(f)
                    continue
                if _bbox_contains(f["geometry"], nw, se):
                    kept.append(f)
                else:
                    n_dropped += 1
            geo["features"] = kept

    log(
        f"  flying_islands: repositioned {n_repos} features, "
        f"dropped {n_dropped} (outside-bbox)"
    )
    return geo


# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------


def build_one(
    worldview: str,
    admin_level: int,
    name_overrides: list[dict[str, Any]],
    flying_islands: dict[str, Any],
    territory_assignments: dict[str, Any],
    regional_aggregations: dict[str, Any],
    composite_maps: dict[str, Any],
) -> Path:
    """Build one (worldview, admin_level) GeoJSON. Returns the output path."""
    log(f"\nBuilding worldview={worldview or 'default'} admin_level={admin_level}")
    shp = fetch_ne_shapefile(admin_level, worldview)
    raw = OUTPUT_DIR / f"_raw_{worldview or 'default'}_admin{admin_level}.geo.json"
    shp_to_geojson(shp, raw)

    geo = json.loads(raw.read_text())
    log(f"  loaded {len(geo['features'])} features")

    geo = apply_name_overrides(geo, name_overrides)
    geo = apply_flying_islands(
        geo, flying_islands, country_a3=None, admin_level=admin_level
    )

    # territory_assignments only makes sense at Admin 1 — the additions
    # (China+SARs, Finland+Åland) inject Admin-0-sized features as
    # single subdivisions of a destination country.
    if admin_level == 1 and territory_assignments.get("countries"):
        admin0_shp = fetch_ne_shapefile(0, worldview)
        admin0_path = (
            OUTPUT_DIR / f"_admin0_for_assignments_{worldview or 'default'}.geo.json"
        )
        if not admin0_path.exists():
            shp_to_geojson(admin0_shp, admin0_path)
        admin0_geo = json.loads(admin0_path.read_text())
        geo = apply_territory_assignments(geo, territory_assignments, admin0_geo)
        admin0_path.unlink(missing_ok=True)

    # regional_aggregations runs at Admin 1; emits its own per-(country,set)
    # output files separate from the main worldview output.
    if admin_level == 1:
        apply_regional_aggregations(geo, regional_aggregations, worldview)

    # composite_maps also runs at Admin 1 and emits per-composite output
    # files. Operates on the post-name-override Admin 1 geo — does its
    # own repositioning, doesn't depend on flying_islands state.
    if admin_level == 1 and composite_maps.get("composites"):
        apply_composite_maps(geo, composite_maps, worldview)

    # TODO(future): procedural/

    wv_label = worldview or "default"

    if admin_level == 1:
        # Per-country split: each chart loads only its country's data
        # (~50KB-1MB) instead of the full ~15MB global Admin 1 layer.
        country_outputs = _write_admin1_per_country(geo, wv_label, simplify_pct=5.0)
        log(
            f"  wrote {len(country_outputs)} per-country Admin 1 files "
            f"(total {sum(p.stat().st_size for p in country_outputs):,} bytes)"
        )
        raw.unlink()
        return country_outputs[0] if country_outputs else raw  # placeholder return

    # Admin 0: single global file (one feature per country = small enough)
    transformed = OUTPUT_DIR / f"_transformed_{wv_label}_admin{admin_level}.geo.json"
    transformed.write_text(json.dumps(geo))
    final = OUTPUT_DIR / f"{wv_label}_admin{admin_level}.geo.json"
    simplify_geojson(transformed, final, percentage=5.0)
    log(
        f"  wrote {final.name} ({final.stat().st_size:,} bytes, "
        f"{len(geo['features'])} features)"
    )
    raw.unlink()
    transformed.unlink()
    return final


def _write_admin1_per_country(
    geo: dict[str, Any],
    wv_label: str,
    simplify_pct: float = 5.0,
) -> list[Path]:
    """Split global Admin 1 into one GeoJSON per country, each simplified."""
    from collections import defaultdict

    by_country: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for f in geo["features"]:
        a3 = f["properties"].get("adm0_a3")
        if a3:
            by_country[a3].append(f)

    outputs: list[Path] = []
    for a3, features in sorted(by_country.items()):
        if len(features) < 2:
            # Single-subdivision countries are useless as choropleths.
            continue
        country_geo = {"type": "FeatureCollection", "features": features}
        inter = OUTPUT_DIR / f"_admin1_{a3}_{wv_label}_pre.geo.json"
        inter.write_text(json.dumps(country_geo))
        out = OUTPUT_DIR / f"{wv_label}_admin1_{a3}.geo.json"
        subprocess.run(
            [
                "npx",
                "--yes",
                "mapshaper@" + MAPSHAPER_VERSION,
                str(inter),
                "-simplify",
                f"{simplify_pct}%",
                "keep-shapes",
                "-o",
                str(out),
                "format=geojson",
            ],
            check=True,
            stderr=subprocess.DEVNULL,
        )
        inter.unlink()
        outputs.append(out)
    return outputs


def write_manifest(
    targets: list[tuple[str, int]],
    composite_maps: dict[str, Any] | None = None,
) -> Path:
    """Emit manifest.json describing what the build produced.

    The plugin's control panel reads this at runtime to populate
    worldview / country / region-set / composite dropdowns dynamically,
    so adding a new entry to the YAML configs doesn't require a plugin
    code change.

    Manifest is intentionally byte-deterministic given the same inputs
    (no build timestamps, no environment-specific data) so the regen
    CI workflow can drift-detect against the committed snapshot.
    """
    # Walk the OUTPUT_DIR for everything we wrote
    worldviews = sorted({wv or "default" for wv, _ in targets})
    admin_levels = sorted({al for _, al in targets})

    countries_by_wv: dict[str, list[str]] = {wv: [] for wv in worldviews}
    regional_sets: list[dict[str, Any]] = []
    composites: list[dict[str, Any]] = []

    for path in sorted(OUTPUT_DIR.glob("*.geo.json")):
        name = path.stem.replace(".geo", "")
        # ukr_admin1_FRA → worldview=ukr, admin1=FRA
        for wv in worldviews:
            prefix = f"{wv}_admin1_"
            if name.startswith(prefix):
                countries_by_wv[wv].append(name[len(prefix) :])
        # regional_TUR_nuts_1_ukr
        if name.startswith("regional_"):
            parts = name.split("_")
            wv = parts[-1]
            country = parts[1]
            set_name = "_".join(parts[2:-1])
            regional_sets.append(
                {
                    "country": country,
                    "set_id": set_name,
                    "worldview": wv,
                    "size_bytes": path.stat().st_size,
                }
            )
        # composite_france_overseas_ukr
        elif name.startswith("composite_"):
            parts = name.split("_")
            wv = parts[-1]
            cid = "_".join(parts[1:-1])
            entry: dict[str, Any] = {
                "id": cid,
                "worldview": wv,
                "size_bytes": path.stat().st_size,
            }
            # Anchor country comes from the composite's `base.adm0_a3`
            # in composite_maps.yaml. Carrying it in the manifest lets
            # the frontend hide irrelevant composites once the user
            # picks a country (e.g. don't show france_overseas under
            # country=USA).
            if composite_maps:
                cdef = (composite_maps.get("composites", {}) or {}).get(cid, {})
                base_country = (cdef.get("base") or {}).get("adm0_a3")
                if base_country:
                    entry["country"] = base_country
            composites.append(entry)

    manifest = {
        "ne_pinned_tag": NE_PINNED_TAG,
        "ne_pinned_sha": NE_PINNED_SHA,
        "worldviews": worldviews,
        "admin_levels": admin_levels,
        "countries_by_worldview": {
            wv: sorted(set(codes)) for wv, codes in countries_by_wv.items()
        },
        "regional_aggregations": regional_sets,
        "composites": composites,
    }

    manifest_text = json.dumps(manifest, indent=2) + "\n"
    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest_path.write_text(manifest_text)

    # Also write a copy into the plugin source tree so the control
    # panel can `import manifest from '../data/manifest.json'` without
    # an async fetch at chart-edit time.
    plugin_data_dir = SCRIPT_DIR.parent / "src" / "data"
    plugin_data_dir.mkdir(parents=True, exist_ok=True)
    (plugin_data_dir / "manifest.json").write_text(manifest_text)
    log(
        f"\nWrote manifest.json — {len(worldviews)} worldview(s), "
        f"{sum(len(v) for v in countries_by_wv.values())} country files, "
        f"{len(regional_sets)} regional sets, {len(composites)} composites"
    )
    return manifest_path


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    log(f"Country Map build — pinned to NE {NE_PINNED_TAG} ({NE_PINNED_SHA[:8]})")

    # Load configs
    name_overrides = yaml.safe_load((CONFIG_DIR / "name_overrides.yaml").read_text())[
        "overrides"
    ]
    flying_islands = yaml.safe_load((CONFIG_DIR / "flying_islands.yaml").read_text())
    territory_assignments = yaml.safe_load(
        (CONFIG_DIR / "territory_assignments.yaml").read_text()
    )
    regional_aggregations = yaml.safe_load(
        (CONFIG_DIR / "regional_aggregations.yaml").read_text()
    )
    composite_maps = yaml.safe_load((CONFIG_DIR / "composite_maps.yaml").read_text())
    log(f"Loaded {len(name_overrides)} name override entries")
    log(
        f"Loaded flying_islands rules for {len(flying_islands.get('countries', {}))} countries"
    )
    log(
        f"Loaded territory_assignments rules for "
        f"{len(territory_assignments.get('countries', {}))} countries"
    )
    n_region_sets = sum(
        len(c.get("region_sets", {}))
        for c in regional_aggregations.get("countries", {}).values()
    )
    log(
        f"Loaded regional_aggregations: {n_region_sets} region-sets across "
        f"{len(regional_aggregations.get('countries', {}))} countries"
    )
    log(
        f"Loaded composite_maps: {len(composite_maps.get('composites', {}))} composites"
    )

    # Build Admin 0 for every NE-published worldview, plus Admin 1 only
    # for the documented default ("ukr"). NE's Admin 1 layer has no
    # worldview variants, so subdivisions are worldview-agnostic and the
    # frontend always references the ukr_admin1_<country> files.
    targets: list[tuple[str, int]] = [(wv, 0) for wv in WORLDVIEWS_ADMIN_0]
    targets.append(("ukr", 1))

    for worldview, admin_level in targets:
        build_one(
            worldview,
            admin_level,
            name_overrides,
            flying_islands,
            territory_assignments,
            regional_aggregations,
            composite_maps,
        )

    write_manifest(targets, composite_maps=composite_maps)

    # Pre-commit's end-of-file-fixer requires every text file to end with
    # a newline. mapshaper does not add one to its JSON output, so post-
    # process all geo.json outputs to guarantee a trailing newline.
    for p in OUTPUT_DIR.glob("*.geo.json"):
        b = p.read_bytes()
        if not b.endswith(b"\n"):
            p.write_bytes(b + b"\n")

    log("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
