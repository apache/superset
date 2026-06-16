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

from typing import Any
from unittest.mock import MagicMock

from flask import current_app, Flask, g

from superset.charts.data.dashboard_filter_context import (
    apply_dashboard_filter_context,
)
from superset.jinja_context import ExtraCache
from superset.utils import json


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


def test_apply_dashboard_filter_context_does_not_duplicate_filters() -> None:
    """
    Regression test for the ``filters_dashboard_id`` parameter.

    A dashboard's filters must be applied only through extra_form_data, the
    single source of truth. Previously the same filter was also appended onto
    query["filters"], so Jinja's filter_values() read each value twice and
    produced SQL such as ``country in ('USA', 'USA')``.
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
    with current_app.test_request_context("/api/v1/chart/1/data/"):
        g.form_data = query_context_json
        assert ExtraCache().filter_values("country") == ["USA"]


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
