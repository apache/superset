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
Benchmark: JSON vs. Arrow IPC payload size for chart-data-shaped DataFrames.

Standalone by design (no Flask app context, no running Superset instance):
it loads real example-dataset fixtures already checked into the repo under
``superset/examples/*/data.parquet`` and times/sizes the two serialization
paths this PR's Arrow wire format sits alongside. This avoids needing a
running dev server with example data loaded, which may not be available in
every environment this script is run in.

Both paths reuse the real production serialization code rather than
hand-rolling a different encoding:

- JSON: ``superset.dataframe.df_to_records`` (the same conversion
  ``QueryContextProcessor.get_data`` calls for the JSON/table-like result
  formats) + ``superset.utils.json.dumps(..., default=json_int_dttm_ser,
  ignore_nan=True)`` (the same call ``ChartDataRestApi._send_chart_response``
  makes for the JSON branch).
- Arrow: the exact two-line body of
  ``QueryContextProcessor._to_arrow_ipc`` (superset/common/query_context_processor.py),
  inlined here rather than imported, because importing that module pulls in
  ``superset.models.core`` (encrypted columns, etc.), which requires a Flask
  app context this script deliberately doesn't start. The logic itself is
  not duplicated/reinvented: it is copied verbatim and is a 2-line
  ``pa.Table.from_pandas`` + IPC stream write with no sanitization step.

Usage:
    PYTHONPATH="$(pwd):$(pwd)/superset-core/src" \\
        python scripts/benchmark_arrow_vs_json.py
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
import pyarrow as pa

from superset.dataframe import df_to_records
from superset.utils import json as superset_json

REPO_ROOT = Path(__file__).resolve().parent.parent
EXAMPLES_DIR = REPO_ROOT / "superset" / "examples"


def to_arrow_ipc(df: pd.DataFrame) -> bytes:
    """Verbatim copy of QueryContextProcessor._to_arrow_ipc's body."""
    table = pa.Table.from_pandas(df, preserve_index=False)
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    return sink.getvalue().to_pybytes()


def json_payload_size(df: pd.DataFrame) -> int:
    """Same conversion + same json.dumps call _send_chart_response makes for
    the JSON result format, sized as UTF-8 bytes (what actually goes over
    the wire)."""
    records = df_to_records(df)
    payload = superset_json.dumps(
        records,
        default=superset_json.json_int_dttm_ser,
        ignore_nan=True,
    )
    return len(payload.encode("utf-8"))


def arrow_payload_size(df: pd.DataFrame) -> int:
    return len(to_arrow_ipc(df))


@dataclass
class Scenario:
    label: str
    df: pd.DataFrame


def load_scenarios() -> list[Scenario]:
    """Representative DataFrames shaped like real example-dataset query
    results, at a couple of row counts each to show how the gap scales.
    Real fixtures (not synthetic) are used because they're already checked
    into the repo and give a genuinely representative column/type mix."""
    video_game_sales = pd.read_parquet(
        EXAMPLES_DIR / "video_game_sales" / "data.parquet"
    )
    usa_births_names = pd.read_parquet(
        EXAMPLES_DIR / "usa_births_names" / "data.parquet"
    )
    world_health = pd.read_parquet(EXAMPLES_DIR / "world_health" / "data.parquet")

    scenarios = []
    for n in (500, 5000):
        scenarios.append(
            Scenario(
                f"mixed string+numeric (video_game_sales, {n} rows)",
                video_game_sales.head(n),
            )
        )
        scenarios.append(
            Scenario(
                f"datetime-heavy (usa_births_names, {n} rows)",
                usa_births_names.head(n),
            )
        )
        scenarios.append(
            Scenario(
                f"numeric-heavy, 328 cols (world_health, {n} rows)",
                world_health.head(n),
            )
        )
    return scenarios


def main() -> None:
    scenarios = load_scenarios()
    rows = []
    for scenario in scenarios:
        json_bytes = json_payload_size(scenario.df)
        arrow_bytes = arrow_payload_size(scenario.df)
        pct_change = (arrow_bytes - json_bytes) / json_bytes * 100
        rows.append((scenario.label, json_bytes, arrow_bytes, pct_change))

    label_width = max(len(r[0]) for r in rows) + 2
    header = (
        f"{'scenario':<{label_width}}"
        f"{'json bytes':>14}{'arrow bytes':>14}{'arrow vs json':>16}"
    )
    print(header)
    print("-" * len(header))
    for label, json_bytes, arrow_bytes, pct_change in rows:
        sign = "+" if pct_change >= 0 else ""
        print(
            f"{label:<{label_width}}"
            f"{json_bytes:>14,}{arrow_bytes:>14,}{sign}{pct_change:>14.1f}%"
        )


if __name__ == "__main__":
    if not os.environ.get("PYTHONPATH"):
        print(
            "Warning: PYTHONPATH not set; run with "
            'PYTHONPATH="$(pwd):$(pwd)/superset-core/src" to ensure the '
            "in-repo superset_core package resolves."
        )
    main()
