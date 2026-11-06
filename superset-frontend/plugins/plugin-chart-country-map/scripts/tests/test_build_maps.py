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
"""Exercises `build_maps.main()` end to end against small synthetic
Natural Earth fixtures (no network), guarding the CLI's output-scoping
behavior: a `--countries` subset must never rewrite maps or index files
it didn't build, and bare-filename output paths must not crash.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from types import SimpleNamespace

import geopandas as gpd
import pandas as pd
import pytest
from shapely.geometry import box

_SCRIPTS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_SCRIPTS_DIR))

import build_maps  # noqa: E402
from maps.catalog import COUNTRIES, COUNTRY_NAME_ALIASES  # noqa: E402
from maps.context import BuildContext  # noqa: E402

_SENTINEL = "untouched fixture content\n"


def _subdivisions(admin: str, prefix: str, count: int = 2) -> gpd.GeoDataFrame:
    """Tiny, non-overlapping square subdivisions for one admin name."""
    return gpd.GeoDataFrame(
        {
            "admin": [admin] * count,
            "iso_3166_2": [f"{prefix}-{i}" for i in range(count)],
            "name": [f"{admin} {i}" for i in range(count)],
            "geometry": [box(i, 0, i + 0.5, 0.5) for i in range(count)],
        },
        crs="EPSG:4326",
    )


def _fake_context() -> BuildContext:
    """A Natural Earth stand-in where every plain catalog entry resolves
    to two subdivisions, so a full build validates and keeps them all.
    """
    frames = [
        _subdivisions(COUNTRY_NAME_ALIASES.get(name, name), f"X{idx}")
        for idx, name in enumerate(COUNTRIES)
    ]
    df = gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs="EPSG:4326")
    empty = df.iloc[0:0]
    return BuildContext(df=df, df_10m=df, df_50m=empty, df_admin0_10m=empty)


def _fake_module(name: str) -> SimpleNamespace:
    return SimpleNamespace(
        NAME=name,
        build=lambda ctx: {name: _subdivisions(name, name.upper()[:2])},
    )


@pytest.fixture
def patched_build(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        build_maps, "load_natural_earth", lambda *a, **kw: _fake_context()
    )
    monkeypatch.setattr(
        build_maps, "REGISTRY", [_fake_module("france"), _fake_module("usa")]
    )


def _run_main(monkeypatch: pytest.MonkeyPatch, *argv: str) -> None:
    monkeypatch.setattr(sys, "argv", ["build_maps.py", *argv])
    build_maps.main()


def test_countries_subset_leaves_unselected_outputs_untouched(
    patched_build: None, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    out_dir = tmp_path / "countries"
    out_dir.mkdir()
    usa_path = out_dir / "usa.geojson"
    ts_path = tmp_path / "countries.ts"
    docs_path = tmp_path / "countries.json"
    for path in (usa_path, ts_path, docs_path):
        path.write_text(_SENTINEL, encoding="utf-8")

    _run_main(
        monkeypatch,
        "--countries",
        "france",
        "--data-dir",
        str(tmp_path / "data"),
        "--out-dir",
        str(out_dir),
        "--countries-ts-path",
        str(ts_path),
        "--docs-json-path",
        str(docs_path),
    )

    assert (out_dir / "france.geojson").exists()
    # "usa" is both a plain catalog entry and a registered module; a
    # subset build that re-resolved plain entries would overwrite the
    # corrected map with raw Natural Earth data.
    assert usa_path.read_text(encoding="utf-8") == _SENTINEL
    assert ts_path.read_text(encoding="utf-8") == _SENTINEL
    assert docs_path.read_text(encoding="utf-8") == _SENTINEL
    built = sorted(p.name for p in out_dir.glob("*.geojson"))
    assert built == ["france.geojson", "usa.geojson"]


def test_bare_filename_output_paths_write_to_cwd(
    patched_build: None, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.chdir(tmp_path)

    _run_main(
        monkeypatch,
        "--data-dir",
        "data",
        "--out-dir",
        "countries",
        "--countries-ts-path",
        "countries.ts",
        "--docs-json-path",
        "countries.json",
    )

    assert os.path.isfile(tmp_path / "countries.ts")
    assert os.path.isfile(tmp_path / "countries.json")
    assert (tmp_path / "countries" / "france.geojson").exists()
