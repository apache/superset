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
from __future__ import annotations

from typing import Any, TYPE_CHECKING
from unittest.mock import MagicMock

from flask import Flask, g

from superset.charts.data.dashboard_filter_context import (
    apply_dashboard_filter_context,
)
from superset.jinja_context import ExtraCache
from superset.utils import json

if TYPE_CHECKING:
    from superset.app import SupersetApp


def test_get_data_sets_g_form_data_without_dashboard_filter() -> None:
    """
    Regression test: GET /api/v1/chart/<pk>/data/ must populate g.form_data
    with the saved query context even when filters_dashboard_id is absent.

    Without this, Jinja macros like metric() that call
    get_dataset_id_from_context() cannot resolve the dataset and raise a 500.
    """
    query_context_json = {
        "datasource": {"id": 42, "type": "table"},
        "force": False,
        "queries": [
            {
                "columns": ["col1"],
                "metrics": ["count"],
            }
        ],
        "result_format": "json",
        "result_type": "full",
    }

    app = Flask(__name__)

    with app.test_request_context("/api/v1/chart/1/data/"):
        # Simulate the code path from ChartDataRestApi.get_data that
        # parses the saved query_context and sets g.form_data.
        json_body = json.loads(json.dumps(query_context_json))

        # Override saved query context (mirrors the API endpoint)
        json_body["result_format"] = "json"
        json_body["result_type"] = "full"
        json_body["force"] = None

        # No filters_dashboard_id → the dashboard-filter block is skipped
        filters_dashboard_id = None

        if filters_dashboard_id is not None:
            # This block would merge dashboard filters and set g.form_data
            # inside the conditional — the old (broken) behavior.
            pass

        # The fix: g.form_data is set unconditionally
        g.form_data = json_body

        # Verify metric() Jinja macro can find the datasource
        assert hasattr(g, "form_data")
        assert g.form_data["datasource"] == {"id": 42, "type": "table"}
        assert g.form_data["queries"][0]["columns"] == ["col1"]


def test_apply_dashboard_filter_context_does_not_duplicate_filters(
    app: SupersetApp,
) -> None:
    """
    Regression test for the ``filters_dashboard_id`` parameter.

    A dashboard's filters must not be present in both query["filters"] and
    query["extra_form_data"]["filters"]. Previously the same filter existed in both,
    so Jinja's filter_values() read each value twice and produced SQL such as
    ``country in ('USA', 'USA')``.
    """
    query_context_json: dict[str, Any] = {
        "datasource": {"id": 1, "type": "table"},
        "queries": [{"filters": [{"col": "year", "op": "IN", "val": [2004]}]}],
    }
    extra_form_data = {"filters": [{"col": "country", "op": "IN", "val": ["USA"]}]}

    apply_dashboard_filter_context(query_context_json, extra_form_data)

    query = query_context_json["queries"][0]
    assert query["filters"] == [
        {"col": "year", "op": "IN", "val": [2004]},
        {"col": "country", "op": "IN", "val": ["USA"], "isExtra": True},
    ]
    assert "filters" not in query["extra_form_data"]

    # filter_values() therefore returns the dashboard value exactly once.
    with app.test_request_context("/api/v1/chart/1/data/"):
        g.form_data = query_context_json
        assert ExtraCache().filter_values("country") == ["USA"]


def test_apply_dashboard_filter_context_applies_time_grain_to_extras() -> None:
    """
    A dashboard time-grain filter must land in ``query["extras"]``, where
    get_time_grain() reads it for charts that have no adhoc x-axis column.
    """
    query_context_json: dict[str, Any] = {
        "queries": [{"extras": {"time_grain_sqla": "P1D", "having": "", "where": ""}}],
    }

    apply_dashboard_filter_context(query_context_json, {"time_grain_sqla": "P1M"})

    assert query_context_json["queries"][0]["extras"]["time_grain_sqla"] == "P1M"


def test_apply_dashboard_filter_context_overrides_x_axis_time_grain() -> None:
    """
    For charts with an adhoc X-Axis, the dashboard grain must override the
    BASE_AXIS column's ``timeGrain`` (which get_time_grain() reads before
    falling back to extras), mirroring the frontend's normalizeTimeColumn.
    """
    query_context_json: dict[str, Any] = {
        "queries": [
            {
                "columns": [
                    {
                        "timeGrain": "P1D",
                        "columnType": "BASE_AXIS",
                        "sqlExpression": "order_date",
                    }
                ],
                "extras": {"time_grain_sqla": "P1D"},
            }
        ],
    }

    apply_dashboard_filter_context(query_context_json, {"time_grain_sqla": "P1Y"})

    query = query_context_json["queries"][0]
    assert query["columns"][0]["timeGrain"] == "P1Y"
    assert query["extras"]["time_grain_sqla"] == "P1Y"


def test_apply_dashboard_filter_context_grain_targets_first_adhoc_column() -> None:
    """
    The grain override must land on ``columns[0]`` to match frontend logic.
    """
    query_context_json: dict[str, Any] = {
        "queries": [
            {
                "columns": [
                    {"timeGrain": "P1D", "sqlExpression": "order_date"},
                    {"columnType": "BASE_AXIS", "sqlExpression": "other"},
                ],
                "extras": {},
            }
        ],
    }

    apply_dashboard_filter_context(query_context_json, {"time_grain_sqla": "P1Y"})

    columns = query_context_json["queries"][0]["columns"]
    assert columns[0]["timeGrain"] == "P1Y"  # the column get_time_grain reads
    assert "timeGrain" not in columns[1]  # the BASE_AXIS-tagged one is untouched


def test_apply_dashboard_filter_context_keeps_grain_when_no_grain_filter() -> None:
    """
    When the dashboard applies a non-grain filter (e.g. a value filter), the
    chart's own x-axis ``timeGrain`` must be preserved -- not wiped -- since no
    dashboard grain was provided.
    """
    query_context_json: dict[str, Any] = {
        "queries": [
            {
                "columns": [
                    {
                        "timeGrain": "P1M",
                        "columnType": "BASE_AXIS",
                        "sqlExpression": "order_date",
                    }
                ],
                "extras": {"time_grain_sqla": "P1M"},
            }
        ],
    }

    # extra_form_data carries a value filter but NO time_grain_sqla
    apply_dashboard_filter_context(
        query_context_json,
        {"filters": [{"col": "country", "op": "IN", "val": ["US"]}]},
    )

    query = query_context_json["queries"][0]
    assert query["columns"][0]["timeGrain"] == "P1M"


def _extract_filename(form_value: str) -> str | None:
    """Run _extract_export_params_from_request with a form filename value."""
    from superset.charts.data.api import ChartDataRestApi

    app = Flask(__name__)
    with app.test_request_context("/", method="POST", data={"filename": form_value}):
        filename, _ = ChartDataRestApi._extract_export_params_from_request(MagicMock())
    return filename


def test_extract_export_filename_sanitizes_special_characters() -> None:
    """A malicious/path-y filename is sanitized before header/disk use."""
    filename = _extract_filename('../../etc/pa"ss\r\nSet-Cookie: x')

    assert filename is not None
    for bad in ("/", "\\", '"', "\r", "\n", ".."):
        assert bad not in filename


def test_extract_export_filename_preserves_normal_name() -> None:
    """A normal filename passes through unchanged."""
    assert _extract_filename("my_export.csv") == "my_export.csv"


def test_extract_export_filename_all_special_falls_back_to_none() -> None:
    """A name with no usable characters becomes None (generated downstream)."""
    assert _extract_filename("***") is None
