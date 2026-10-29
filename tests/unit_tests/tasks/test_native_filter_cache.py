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
    dashboard: mock.MagicMock = mock.MagicMock()
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
    filter_select: dict[str, Any] = _filter_config(filter_id="select")
    metadata: dict[str, Any] = {
        "native_filter_configuration": [
            filter_select,
            _filter_config(filter_id="range", filter_type="filter_range"),
            _filter_config(filter_id="divider", entry_type="DIVIDER"),
        ]
    }

    result: list[dict[str, Any]] = get_eligible_native_filters(
        _dashboard(json.dumps(metadata))
    )

    assert result == [filter_select]


def test_get_eligible_native_filters_skips_non_dict_entries() -> None:
    valid_filter: dict[str, Any] = _filter_config(filter_id="valid")
    metadata: dict[str, Any] = {
        "native_filter_configuration": [
            "not-a-filter",
            valid_filter,
            None,
            ["also", "not", "a", "filter"],
        ]
    }

    result: list[dict[str, Any]] = get_eligible_native_filters(
        _dashboard(json.dumps(metadata))
    )

    assert result == [valid_filter]


def test_get_eligible_native_filters_skips_missing_target() -> None:
    metadata: dict[str, Any] = {
        "native_filter_configuration": [
            _filter_config(targets=[]),
        ]
    }

    result: list[dict[str, Any]] = get_eligible_native_filters(
        _dashboard(json.dumps(metadata))
    )

    assert result == []


def test_get_eligible_native_filters_skips_missing_column() -> None:
    metadata: dict[str, Any] = {
        "native_filter_configuration": [
            _filter_config(targets=[{"datasetId": 10, "column": {}}]),
        ]
    }

    result: list[dict[str, Any]] = get_eligible_native_filters(
        _dashboard(json.dumps(metadata))
    )

    assert result == []


def test_get_eligible_native_filters_malformed_json_metadata() -> None:
    result: list[dict[str, Any]] = get_eligible_native_filters(_dashboard("{"))

    assert result == []


def test_get_eligible_native_filters_missing_native_filter_configuration() -> None:
    result: list[dict[str, Any]] = get_eligible_native_filters(
        _dashboard(json.dumps({"label": "dash"}))
    )

    assert result == []


def test_build_native_filter_option_form_data_correct_shape() -> None:
    dashboard: mock.MagicMock = _dashboard(json_metadata=None, dashboard_id=42)
    filter_config: dict[str, Any] = {
        **_filter_config(filter_id="native-filter-1"),
        "adhoc_filters": [{"expressionType": "SIMPLE"}],
        "controlValues": {"sortAscending": False},
        "sortMetric": "sum__value",
    }

    result: dict[str, Any] | None = build_native_filter_option_form_data(
        dashboard, filter_config
    )

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


def test_build_native_filter_option_form_data_uses_filter_level_prefilters() -> None:
    filter_config: dict[str, Any] = {
        **_filter_config(),
        "time_range": "Last week",
        "granularity_sqla": "ds",
    }

    result: dict[str, Any] | None = build_native_filter_option_form_data(
        _dashboard(json_metadata=None),
        filter_config,
    )

    assert result is not None
    assert result["time_range"] == "Last week"
    assert result["granularity_sqla"] == "ds"


def test_build_native_filter_option_form_data_falls_back_to_default_time_range() -> (
    None
):
    result: dict[str, Any] | None = build_native_filter_option_form_data(
        _dashboard(json_metadata=None),
        _filter_config(),
    )

    assert result is not None
    assert result["time_range"] == "No filter"


def test_build_native_filter_option_form_data_missing_dataset_id() -> None:
    result: dict[str, Any] | None = build_native_filter_option_form_data(
        _dashboard(json_metadata=None),
        _filter_config(targets=[{"column": {"name": "country"}}]),
    )

    assert result is None


def test_build_native_filter_option_form_data_missing_column_name() -> None:
    result: dict[str, Any] | None = build_native_filter_option_form_data(
        _dashboard(json_metadata=None),
        _filter_config(targets=[{"datasetId": 10, "column": {}}]),
    )

    assert result is None


def test_build_native_filter_option_query_context_returns_query_context() -> None:
    form_data: dict[str, Any] | None = build_native_filter_option_form_data(
        _dashboard(json_metadata=None),
        _filter_config(),
    )
    datasource: mock.MagicMock = mock.MagicMock()
    datasource.cache_timeout = None
    datasource.type = "table"
    datasource.data = {"id": 10}
    datasource.uid = "10__table"
    datasource.column_names = ["country"]

    expected: QueryContext = QueryContext(
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
        result: QueryContext | None = build_native_filter_option_query_context(
            form_data or {}
        )

    assert isinstance(result, QueryContext)
    assert result == expected
    schema_class.return_value.load.assert_called_once()


def test_build_native_filter_option_query_context_groupby_in_payload() -> None:
    form_data: dict[str, Any] | None = build_native_filter_option_form_data(
        _dashboard(json_metadata=None),
        {
            **_filter_config(),
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "clause": "WHERE",
                    "subject": "region",
                    "operator": "==",
                    "comparator": "EMEA",
                }
            ],
        },
    )
    expected: mock.MagicMock = mock.MagicMock(spec=QueryContext)

    with (
        mock.patch(
            "superset.tasks.native_filter_cache.ChartDataQueryContextSchema"
        ) as schema_class,
        mock.patch(
            "superset.tasks.native_filter_cache._resolve_datasource_engine",
            return_value="postgresql",
        ) as mock_resolve_engine,
    ):
        schema_class.return_value.load.return_value = expected
        result: QueryContext | None = build_native_filter_option_query_context(
            form_data or {}
        )

    mock_resolve_engine.assert_not_called()
    assert result == expected
    payload: dict[str, Any] = schema_class.return_value.load.call_args.args[0]
    query: dict[str, Any] = payload["queries"][0]
    assert query["groupby"] == ["country"]
    assert "columns" not in query
    assert query["filters"] == [{"col": "region", "op": "==", "val": "EMEA"}]
    assert "adhoc_filters" not in query


def test_build_native_filter_option_query_context_with_adhoc_filters() -> None:
    adhoc_filters: list[dict[str, Any]] = [
        {
            "expressionType": "SIMPLE",
            "clause": "WHERE",
            "subject": "region",
            "operator": "IN",
            "comparator": ["EMEA", "APAC"],
        }
    ]
    form_data: dict[str, Any] | None = build_native_filter_option_form_data(
        _dashboard(json_metadata=None),
        {
            **_filter_config(),
            "adhoc_filters": adhoc_filters,
        },
    )
    expected: mock.MagicMock = mock.MagicMock(spec=QueryContext)

    with (
        mock.patch(
            "superset.tasks.native_filter_cache.ChartDataQueryContextSchema"
        ) as schema_class,
        mock.patch(
            "superset.tasks.native_filter_cache._resolve_datasource_engine",
            return_value="postgresql",
        ) as mock_resolve_engine,
    ):
        schema_class.return_value.load.return_value = expected
        result: QueryContext | None = build_native_filter_option_query_context(
            form_data or {}
        )

    mock_resolve_engine.assert_not_called()
    assert result == expected
    payload: dict[str, Any] = schema_class.return_value.load.call_args.args[0]
    query: dict[str, Any] = payload["queries"][0]
    assert query["filters"] == [{"col": "region", "op": "IN", "val": ["EMEA", "APAC"]}]
    assert "adhoc_filters" not in query


def test_resolve_datasource_engine_only_called_for_sql_filters() -> None:
    simple_form_data: dict[str, Any] | None = build_native_filter_option_form_data(
        _dashboard(json_metadata=None),
        {
            **_filter_config(),
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "clause": "WHERE",
                    "subject": "region",
                    "operator": "==",
                    "comparator": "EMEA",
                }
            ],
        },
    )
    sql_form_data: dict[str, Any] | None = build_native_filter_option_form_data(
        _dashboard(json_metadata=None),
        {
            **_filter_config(),
            "adhoc_filters": [
                {
                    "expressionType": "SQL",
                    "clause": "WHERE",
                    "sqlExpression": "region = 'EMEA'",
                }
            ],
        },
    )
    expected: mock.MagicMock = mock.MagicMock(spec=QueryContext)

    with (
        mock.patch(
            "superset.tasks.native_filter_cache.ChartDataQueryContextSchema"
        ) as schema_class,
        mock.patch(
            "superset.tasks.native_filter_cache._resolve_datasource_engine",
            return_value="postgresql",
        ) as mock_resolve_engine,
    ):
        schema_class.return_value.load.return_value = expected

        build_native_filter_option_query_context(simple_form_data or {})
        mock_resolve_engine.assert_not_called()

        build_native_filter_option_query_context(sql_form_data or {})
        mock_resolve_engine.assert_called_once_with(10)


def test_build_native_filter_option_query_context_missing_groupby() -> None:
    result: QueryContext | None = build_native_filter_option_query_context(
        {"datasource": "10__table"}
    )

    assert result is None


def test_build_native_filter_option_query_context_malformed_groupby() -> None:
    malformed_groupby_values: list[Any] = [
        "country",
        [{"label": "country"}],
        [None],
        [],
    ]

    for groupby in malformed_groupby_values:
        result: QueryContext | None = build_native_filter_option_query_context(
            {
                "datasource": "10__table",
                "groupby": groupby,
            }
        )

        assert result is None
