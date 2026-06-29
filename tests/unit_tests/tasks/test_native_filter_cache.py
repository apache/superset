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
from unittest import mock

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.tasks.native_filter_cache import (
    build_native_filter_option_form_data,
    build_native_filter_option_query_context,
    get_eligible_native_filters,
)
from superset.utils import json


def _dashboard(json_metadata: str | None, dashboard_id: int = 1) -> mock.MagicMock:
    dashboard = mock.MagicMock()
    dashboard.id = dashboard_id
    dashboard.json_metadata = json_metadata
    return dashboard


def _filter_config(
    filter_id: str = "filter-1",
    filter_type: str = "filter_select",
    entry_type: str = "NATIVE_FILTER",
    targets: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "id": filter_id,
        "filterType": filter_type,
        "type": entry_type,
        "targets": targets
        if targets is not None
        else [{"datasetId": 10, "column": {"name": "country"}}],
    }


def test_get_eligible_native_filters_returns_only_filter_select() -> None:
    filter_select = _filter_config(filter_id="select")
    metadata = {
        "native_filter_configuration": [
            filter_select,
            _filter_config(filter_id="range", filter_type="filter_range"),
            _filter_config(filter_id="divider", entry_type="DIVIDER"),
        ]
    }

    result = get_eligible_native_filters(_dashboard(json.dumps(metadata)))

    assert result == [filter_select]


def test_get_eligible_native_filters_skips_missing_target() -> None:
    metadata = {
        "native_filter_configuration": [
            _filter_config(targets=[]),
        ]
    }

    result = get_eligible_native_filters(_dashboard(json.dumps(metadata)))

    assert result == []


def test_get_eligible_native_filters_skips_missing_column() -> None:
    metadata = {
        "native_filter_configuration": [
            _filter_config(targets=[{"datasetId": 10, "column": {}}]),
        ]
    }

    result = get_eligible_native_filters(_dashboard(json.dumps(metadata)))

    assert result == []


def test_get_eligible_native_filters_malformed_json_metadata() -> None:
    result = get_eligible_native_filters(_dashboard("{"))

    assert result == []


def test_get_eligible_native_filters_missing_native_filter_configuration() -> None:
    result = get_eligible_native_filters(_dashboard(json.dumps({"label": "dash"})))

    assert result == []


def test_build_native_filter_option_form_data_correct_shape() -> None:
    dashboard = _dashboard(json_metadata=None, dashboard_id=42)
    filter_config = {
        **_filter_config(filter_id="native-filter-1"),
        "adhocFilters": [{"expressionType": "SIMPLE"}],
        "controlValues": {"sortAscending": False},
        "sortMetric": "sum__value",
    }

    result = build_native_filter_option_form_data(dashboard, filter_config)

    assert result == {
        "datasource": "10__table",
        "viz_type": "filter_select",
        "type": "NATIVE_FILTER",
        "native_filter_id": "native-filter-1",
        "dashboardId": 42,
        "groupby": ["country"],
        "adhoc_filters": [{"expressionType": "SIMPLE"}],
        "extra_filters": [],
        "extra_form_data": {},
        "metrics": ["count"],
        "row_limit": 1000,
        "time_range": "No filter",
        "granularity_sqla": None,
        "showSearch": True,
        "sortAscending": False,
        "sortMetric": "sum__value",
    }


def test_build_native_filter_option_form_data_missing_dataset_id() -> None:
    result = build_native_filter_option_form_data(
        _dashboard(json_metadata=None),
        _filter_config(targets=[{"column": {"name": "country"}}]),
    )

    assert result is None


def test_build_native_filter_option_form_data_missing_column_name() -> None:
    result = build_native_filter_option_form_data(
        _dashboard(json_metadata=None),
        _filter_config(targets=[{"datasetId": 10, "column": {}}]),
    )

    assert result is None


def test_build_native_filter_option_query_context_returns_query_context() -> None:
    form_data = build_native_filter_option_form_data(
        _dashboard(json_metadata=None),
        _filter_config(),
    )
    datasource = mock.MagicMock()
    datasource.cache_timeout = None
    datasource.type = "table"
    datasource.data = {"id": 10}
    datasource.uid = "10__table"
    datasource.column_names = ["country"]

    expected = QueryContext(
        datasource=datasource,
        queries=[],
        slice_=None,
        form_data=form_data,
        result_type=ChartDataResultType.FULL,
        result_format=ChartDataResultFormat.JSON,
        force=False,
        custom_cache_timeout=None,
        cache_values={},
    )

    with mock.patch(
        "superset.tasks.native_filter_cache.ChartDataQueryContextSchema"
    ) as schema_class:
        schema_class.return_value.load.return_value = expected
        result = build_native_filter_option_query_context(form_data or {})

    assert isinstance(result, QueryContext)
    assert result == expected
    schema_class.return_value.load.assert_called_once()


def test_build_native_filter_option_query_context_groupby_in_payload() -> None:
    form_data = build_native_filter_option_form_data(
        _dashboard(json_metadata=None),
        {
            **_filter_config(),
            "adhocFilters": [{"col": "region", "op": "==", "val": "EMEA"}],
        },
    )
    expected = mock.MagicMock(spec=QueryContext)

    with mock.patch(
        "superset.tasks.native_filter_cache.ChartDataQueryContextSchema"
    ) as schema_class:
        schema_class.return_value.load.return_value = expected
        result = build_native_filter_option_query_context(form_data or {})

    assert result == expected
    payload = schema_class.return_value.load.call_args.args[0]
    query = payload["queries"][0]
    assert query["groupby"] == ["country"]
    assert "columns" not in query
    assert query["filters"] == [{"col": "region", "op": "==", "val": "EMEA"}]


def test_build_native_filter_option_query_context_missing_groupby() -> None:
    result = build_native_filter_option_query_context({"datasource": "10__table"})

    assert result is None
