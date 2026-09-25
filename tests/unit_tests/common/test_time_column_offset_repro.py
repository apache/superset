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
"""Regression test for SC-111332.

When a chart has a Time Comparison (time offset, e.g. ``1 year ago``) and the
Time Column driving the temporal x-axis is overridden on a dashboard to a
non-default column, the chart used to collapse into a single data point.

Root cause: overriding the Time Column funnels through
``QueryContextFactory._apply_granularity`` (this is the single convergence point
for *both* dashboard entry points — the native "Time Column" filter and the
Display Controls "Time Column" dropdown; both emit ``granularity_sqla`` via
``extra_form_data``). That method used to rewrite the x-axis BASE_AXIS column's
``label`` to the overridden column name. The result dataframe was then keyed
under the *overridden* column name, but the offset join, the post-processing
pivot ``index`` and the frontend all look the x-axis up by the *original* saved
label. With a Time Comparison offset in play that desynchronization collapses
the series into a single point.

The fix keeps the x-axis column's original label and only swaps the underlying
expression, so every consumer keeps referencing the same label.
"""

from __future__ import annotations

import sqlite3
from typing import Any, cast

import pandas as pd

from superset.common.query_context_factory import QueryContextFactory
from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.models.core import Database
from superset.superset_typing import Column

X_AXIS_LABEL = "wedding_date"
OVERRIDE_COLUMN = "purchase_date"
OFFSET_METRIC = "sum_revenue__1 year ago"


def _make_dataset(db_path: str) -> SqlaTable:
    """Build the reporter's dataset (monthly wedding/purchase dates)."""
    uri = f"sqlite:///{db_path}"

    rows = []
    d = pd.Timestamp("2024-01-01")
    while d <= pd.Timestamp("2026-04-01"):
        rows.append(
            {
                "wedding_date": d.date().isoformat(),
                # aligned but distinct from wedding_date
                "purchase_date": (d + pd.Timedelta(days=14)).date().isoformat(),
                "revenue": 100 + d.month * 10,
            }
        )
        d = d + pd.DateOffset(months=1)

    con = sqlite3.connect(db_path)
    pd.DataFrame(rows).to_sql("weddings", con, index=False, if_exists="replace")
    con.commit()
    con.close()

    database = Database(database_name="repro_db", sqlalchemy_uri=uri)
    table = SqlaTable(table_name="weddings", database=database)
    table.columns = [
        TableColumn(column_name="wedding_date", is_dttm=True, type="DATETIME"),
        TableColumn(column_name="purchase_date", is_dttm=True, type="DATETIME"),
        TableColumn(column_name="revenue", type="INTEGER"),
    ]
    table.metrics = [
        SqlMetric(metric_name="sum_revenue", expression="SUM(revenue)"),
    ]
    return table


def _x_axis(col: str) -> dict[str, Any]:
    return {
        "label": col,
        "sqlExpression": col,
        "expressionType": "SQL",
        "columnType": "BASE_AXIS",
        "timeGrain": "P1M",
        "isColumnReference": True,
    }


def _pivot_post_processing() -> list[dict[str, Any]]:
    """The pivot/flatten the frontend emits for a time-comparison line chart.

    The pivot ``index`` is keyed on the *saved* x-axis label, mirroring
    ``timeComparePivotOperator``.
    """
    return [
        {
            "operation": "pivot",
            "options": {
                "index": [X_AXIS_LABEL],
                "columns": [],
                "drop_missing_columns": False,
                "aggregates": {
                    "sum_revenue": {"operator": "mean"},
                    OFFSET_METRIC: {"operator": "mean"},
                },
            },
        },
        {"operation": "flatten"},
    ]


def _build_query_object(
    *, db_path: str, time_column_override: str | None
) -> QueryObject:
    """Build the query object for a saved chart, optionally overriding the
    Time Column the way a dashboard's ``extra_form_data`` (granularity_sqla)
    does."""
    table = _make_dataset(db_path)
    query_object = QueryObject(
        datasource=table,
        columns=cast("list[Column]", [_x_axis(X_AXIS_LABEL)]),
        metrics=["sum_revenue"],
        # A dashboard Time Column override sets granularity_sqla -> granularity.
        granularity=time_column_override or X_AXIS_LABEL,
        is_timeseries=False,
        row_limit=10000,
        time_offsets=["1 year ago"],
        time_range="2025-01-01 : 2026-01-01",
        from_dttm=pd.Timestamp("2025-01-01").to_pydatetime(),
        to_dttm=pd.Timestamp("2026-01-01").to_pydatetime(),
        filters=[
            {
                "col": X_AXIS_LABEL,
                "op": "TEMPORAL_RANGE",
                "val": "2025-01-01 : 2026-01-01",
            }
        ],
        post_processing=cast("list[dict[str, Any] | None]", _pivot_post_processing()),
        extras={"time_grain_sqla": "P1M"},
    )
    if time_column_override:
        # Both the native "Time Column" filter and the Display Controls dropdown
        # converge here: extra_form_data.granularity_sqla -> granularity, then
        # _apply_granularity re-points the x-axis at the overridden column.
        QueryContextFactory()._apply_granularity(
            query_object, {"x_axis": X_AXIS_LABEL}, table
        )
    return query_object


def _run(query_object: QueryObject) -> pd.DataFrame:
    # ``get_query_result`` already runs the offset join and post-processing
    # (pivot/flatten), returning the production-shaped dataframe the chart
    # consumes.
    table = cast(SqlaTable, query_object.datasource)
    return table.get_query_result(query_object).df


def test_default_time_column_plots_across_range(app_context, tmp_path):
    """Sanity check: without an override the chart plots across the range."""
    db_path = str(tmp_path / "weddings.db")
    df = _run(_build_query_object(db_path=db_path, time_column_override=None))
    assert X_AXIS_LABEL in df.columns
    assert df[X_AXIS_LABEL].nunique() > 1
    assert OFFSET_METRIC in df.columns


def test_overridden_time_column_does_not_collapse(app_context, tmp_path):
    """The reported bug: overriding the Time Column collapsed the chart into a
    single point. After the fix the temporal x-axis is still returned under the
    original label and plots across the full range with a populated offset."""
    db_path = str(tmp_path / "weddings.db")
    df = _run(
        _build_query_object(db_path=db_path, time_column_override=OVERRIDE_COLUMN)
    )

    # The frontend (and the offset join / pivot) look the x-axis up by the
    # *original* saved label; it must not be renamed to the overridden column.
    assert X_AXIS_LABEL in df.columns, (
        f"x-axis must stay under its original label; got {list(df.columns)}"
    )
    assert OVERRIDE_COLUMN not in df.columns

    # Multiple points across the range instead of a single collapsed point.
    assert df[X_AXIS_LABEL].nunique() > 1, "chart collapsed into a single point"
    assert len(df) == 12

    # The overridden column's data is what actually drives the series, and the
    # time-comparison offset is populated (not all-NaN / single value).
    assert OFFSET_METRIC in df.columns
    assert df[OFFSET_METRIC].notna().sum() > 1
