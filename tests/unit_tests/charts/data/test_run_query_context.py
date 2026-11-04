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

from collections.abc import Iterator
from typing import Any
from unittest import mock

import pytest
from marshmallow import ValidationError
from superset_core.exports.types import ChartQueryResult, GenericDataType

from superset.charts.client_processing import apply_client_processing
from superset.charts.data.run_query_context import (
    can_export_dashboard,
    can_export_data,
    post_processed_rows,
    ROW_LABEL_COLUMN,
    run_query_context,
)
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.exceptions import SupersetSecurityException


@pytest.fixture
def mocks() -> Iterator[dict[str, mock.MagicMock]]:
    security_manager = mock.MagicMock()
    dashboard_dao = mock.MagicMock()
    with mock.patch.multiple(
        "superset.charts.data.run_query_context",
        ChartDataQueryContextSchema=mock.DEFAULT,
        ChartDataCommand=mock.DEFAULT,
        apply_client_processing=mock.DEFAULT,
        security_manager=security_manager,
        is_feature_enabled=mock.DEFAULT,
        DashboardDAO=dashboard_dao,
    ) as patched:
        patched["security_manager"] = security_manager
        patched["DashboardDAO"] = dashboard_dao
        patched["ChartDataCommand"].return_value.run.return_value = {"queries": []}
        yield patched


def _denied() -> SupersetSecurityException:
    return SupersetSecurityException(mock.MagicMock())


def test_validates_before_running(mocks: dict[str, mock.MagicMock]) -> None:
    run_query_context({"queries": [{}]})
    command = mocks["ChartDataCommand"].return_value
    assert command.method_calls[:2] == [mock.call.validate(), mock.call.run()]


def test_access_denied_propagates(mocks: dict[str, mock.MagicMock]) -> None:
    mocks["ChartDataCommand"].return_value.validate.side_effect = _denied()
    with pytest.raises(SupersetSecurityException):
        run_query_context({"queries": [{}]})
    mocks["ChartDataCommand"].return_value.run.assert_not_called()


def test_maps_each_query_to_chart_query_result(
    mocks: dict[str, mock.MagicMock],
) -> None:
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [
            {"colnames": ["a"], "coltypes": [0], "data": [{"a": 1}]},
            {"colnames": ["b"], "coltypes": [2], "data": []},
        ]
    }
    assert run_query_context({"queries": [{}, {}]}) == [
        ChartQueryResult(["a"], [GenericDataType.NUMERIC], [{"a": 1}]),
        ChartQueryResult(["b"], [GenericDataType.TEMPORAL], []),
    ]


def test_missing_keys_map_to_empty_lists(mocks: dict[str, mock.MagicMock]) -> None:
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [{"colnames": None, "data": None}]
    }
    assert run_query_context({"queries": [{}]}) == [ChartQueryResult([], [], [])]


def test_post_processed_applies_client_processing(
    mocks: dict[str, mock.MagicMock],
) -> None:
    mocks[
        "ChartDataQueryContextSchema"
    ].return_value.load.return_value.result_type = ChartDataResultType.POST_PROCESSED
    run_query_context({"queries": [{}], "form_data": {"viz_type": "pivot_table_v2"}})
    mocks["apply_client_processing"].assert_called_once()


def test_full_result_skips_client_processing(
    mocks: dict[str, mock.MagicMock],
) -> None:
    mocks[
        "ChartDataQueryContextSchema"
    ].return_value.load.return_value.result_type = ChartDataResultType.FULL
    run_query_context({"queries": [{}]})
    mocks["apply_client_processing"].assert_not_called()


def test_semantic_authorization_runs_before_metadata(
    mocks: dict[str, mock.MagicMock],
) -> None:
    run_query_context({"queries": [{}]})
    schema: Any = mocks["ChartDataQueryContextSchema"].return_value
    assert schema.query_context_factory._authorize_semantic_before_metadata is True


@pytest.mark.parametrize(
    "granular, perm", [(False, "can_csv"), (True, "can_export_data")]
)
def test_can_export_data_follows_granular_flag(
    mocks: dict[str, mock.MagicMock], granular: bool, perm: str
) -> None:
    mocks["is_feature_enabled"].return_value = granular
    can_export_data()
    mocks["security_manager"].can_access.assert_called_once_with(perm, "Superset")


def test_can_export_dashboard_with_access_and_export_permission(
    mocks: dict[str, mock.MagicMock],
) -> None:
    mocks["security_manager"].can_access.return_value = True
    assert can_export_dashboard(5) is True
    mocks["DashboardDAO"].find_by_id.assert_called_once_with(5)
    mocks["security_manager"].raise_for_access.assert_called_once_with(
        dashboard=mocks["DashboardDAO"].find_by_id.return_value
    )
    mocks["security_manager"].can_access.assert_called_with("can_export", "Dashboard")


def test_can_export_dashboard_without_export_permission(
    mocks: dict[str, mock.MagicMock],
) -> None:
    mocks["security_manager"].can_access.return_value = False
    assert can_export_dashboard(5) is False


def test_can_export_dashboard_without_dashboard_access(
    mocks: dict[str, mock.MagicMock],
) -> None:
    mocks["security_manager"].can_access.return_value = True
    mocks["security_manager"].raise_for_access.side_effect = _denied()
    assert can_export_dashboard(5) is False


def test_can_export_dashboard_missing_dashboard(
    mocks: dict[str, mock.MagicMock],
) -> None:
    mocks["DashboardDAO"].find_by_id.return_value = None
    assert can_export_dashboard(5) is False


def test_forces_json_on_a_copy_of_the_payload(
    mocks: dict[str, mock.MagicMock],
) -> None:
    payload = {"queries": [{}], "result_format": "csv"}
    run_query_context(payload)
    schema = mocks["ChartDataQueryContextSchema"].return_value
    assert schema.load.call_args.args[0]["result_format"] == "json"
    assert payload["result_format"] == "csv"


@pytest.mark.parametrize(
    "result_type",
    [
        ChartDataResultType.QUERY,
        ChartDataResultType.COLUMNS,
        ChartDataResultType.TIMEGRAINS,
    ],
)
def test_rejects_result_types_without_rows(
    mocks: dict[str, mock.MagicMock], result_type: ChartDataResultType
) -> None:
    with pytest.raises(ValueError, match=result_type.value):
        run_query_context({"queries": [{}], "result_type": result_type.value})
    mocks["ChartDataQueryContextSchema"].return_value.load.assert_not_called()
    mocks["ChartDataCommand"].assert_not_called()


def test_rejects_a_query_level_result_type_without_rows(
    mocks: dict[str, mock.MagicMock],
) -> None:
    with pytest.raises(ValueError, match="query"):
        run_query_context({"queries": [{"result_type": "query"}]})


@pytest.mark.parametrize(
    "result_type",
    [
        ChartDataResultType.FULL,
        ChartDataResultType.RESULTS,
        ChartDataResultType.POST_PROCESSED,
        ChartDataResultType.SAMPLES,
        ChartDataResultType.DRILL_DETAIL,
    ],
)
def test_accepts_result_types_with_rows(
    mocks: dict[str, mock.MagicMock], result_type: ChartDataResultType
) -> None:
    payload = {"queries": [{"result_type": result_type.value}]}
    assert run_query_context({**payload, "result_type": result_type.value}) == []


@pytest.mark.parametrize(
    "error, message",
    [(KeyError("datasource"), "Request is incorrect"), (ValueError("bad"), "bad")],
)
def test_load_errors_raise_validation_error(
    mocks: dict[str, mock.MagicMock], error: Exception, message: str
) -> None:
    mocks["ChartDataQueryContextSchema"].return_value.load.side_effect = error
    with pytest.raises(ValidationError, match=message):
        run_query_context({"queries": [{}]})


@pytest.mark.parametrize("payload_extra", [{}, {"form_data": None}])
def test_post_processed_without_form_data_passes_empty_dict(
    mocks: dict[str, mock.MagicMock], payload_extra: dict[str, Any]
) -> None:
    mocks[
        "ChartDataQueryContextSchema"
    ].return_value.load.return_value.result_type = ChartDataResultType.POST_PROCESSED
    run_query_context({"queries": [{}], **payload_extra})
    assert mocks["apply_client_processing"].call_args.args[1] == {}


def test_unknown_coltype_maps_to_string(mocks: dict[str, mock.MagicMock]) -> None:
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [{"colnames": ["a", "b"], "coltypes": [99, 0], "data": []}]
    }
    assert run_query_context({"queries": [{}]}) == [
        ChartQueryResult(
            ["a", "b"], [GenericDataType.STRING, GenericDataType.NUMERIC], []
        )
    ]


_SALES = [
    {"state": "CA", "gender": "boy", "num": 10},
    {"state": "CA", "gender": "girl", "num": 5},
    {"state": "NY", "gender": "boy", "num": 3},
]


def _post_process(form_data: dict[str, Any]) -> dict[str, Any]:
    result = {
        "queries": [{"result_format": ChartDataResultFormat.JSON, "data": list(_SALES)}]
    }
    return apply_client_processing(result, form_data)["queries"][0]


def _pivot_form_data(rows: list[str], columns: list[str]) -> dict[str, Any]:
    return {
        "viz_type": "pivot_table_v2",
        "groupbyRows": rows,
        "groupbyColumns": columns,
        "metrics": ["num"],
        "metricsLayout": "COLUMNS",
        "aggregateFunction": "Sum",
        "rowTotals": True,
        "colTotals": True,
    }


def test_post_processed_pivot_becomes_rows_with_row_labels() -> None:
    query = post_processed_rows(
        _post_process(_pivot_form_data(["state"], ["gender"])), row_labels=True
    )

    assert query["colnames"] == [
        ROW_LABEL_COLUMN,
        "num boy",
        "num girl",
        "num Subtotal",
        "Total (Sum)",
    ]
    assert all(isinstance(name, str) for name in query["colnames"])
    assert len(query["coltypes"]) == len(query["colnames"])
    assert [row[ROW_LABEL_COLUMN] for row in query["data"]] == [
        "CA",
        "NY",
        "Total (Sum)",
    ]
    assert query["data"][0] == {
        ROW_LABEL_COLUMN: "CA",
        "num boy": "10",
        "num girl": "5",
        "num Subtotal": "15",
        "Total (Sum)": "15",
    }


def test_post_processed_pivot_joins_multi_level_row_labels() -> None:
    query = post_processed_rows(
        _post_process(_pivot_form_data(["state", "gender"], [])), row_labels=True
    )

    assert query["colnames"] == [ROW_LABEL_COLUMN, "num", "Total (Sum)"]
    assert [row[ROW_LABEL_COLUMN] for row in query["data"]] == [
        "CA boy",
        "CA girl",
        "CA Subtotal",
        "NY boy",
        "NY Subtotal",
        "Total (Sum)",
    ]


def test_post_processed_table_drops_default_positions() -> None:
    query = post_processed_rows(_post_process({"viz_type": "table"}), row_labels=False)

    assert query["colnames"] == ["state", "gender", "num"]
    assert query["data"] == _SALES
    assert query["coltypes"] == [
        GenericDataType.STRING,
        GenericDataType.STRING,
        GenericDataType.NUMERIC,
    ]


def test_post_processed_rows_keeps_labels_that_look_like_positions() -> None:
    query = post_processed_rows({"data": {"num": {0: 5, 1: 7}}}, row_labels=True)

    assert query["data"] == [
        {ROW_LABEL_COLUMN: "0", "num": 5},
        {ROW_LABEL_COLUMN: "1", "num": 7},
    ]


@pytest.mark.parametrize(
    ("viz_type", "colnames"),
    [("table", ["num"]), ("pivot_table_v2", [ROW_LABEL_COLUMN, "num"])],
)
def test_row_labels_follow_the_viz_type(
    mocks: dict[str, mock.MagicMock], viz_type: str, colnames: list[str]
) -> None:
    mocks[
        "ChartDataQueryContextSchema"
    ].return_value.load.return_value.result_type = ChartDataResultType.POST_PROCESSED
    mocks["apply_client_processing"].return_value = {
        "queries": [{"data": {"num": {0: 5, 1: 7}}}]
    }

    [result] = run_query_context({"queries": [{}], "form_data": {"viz_type": viz_type}})

    assert result.colnames == colnames


def test_post_processed_rows_leaves_row_data_alone() -> None:
    query = {"colnames": ["a"], "coltypes": [0], "data": [{"a": 1}]}
    assert post_processed_rows(query, row_labels=True) is query


def test_post_processed_rows_flattens_tuple_columns_and_fills_gaps() -> None:
    query = post_processed_rows(
        {"data": {("m", "x"): {"r1": 1.5, "r2": 2.0}, "n": {"r1": True}}},
        row_labels=True,
    )

    assert query["colnames"] == [ROW_LABEL_COLUMN, "m x", "n"]
    assert query["data"] == [
        {ROW_LABEL_COLUMN: "r1", "m x": 1.5, "n": True},
        {ROW_LABEL_COLUMN: "r2", "m x": 2.0, "n": None},
    ]


def test_post_processed_result_is_returned_as_rows(
    mocks: dict[str, mock.MagicMock],
) -> None:
    mocks[
        "ChartDataQueryContextSchema"
    ].return_value.load.return_value.result_type = ChartDataResultType.POST_PROCESSED
    mocks["apply_client_processing"].return_value = {
        "queries": [
            {
                "colnames": [("num", "boy")],
                "coltypes": [1],
                "data": {"num boy": {"CA": 10, "NY": 3}},
            }
        ]
    }

    assert run_query_context({"queries": [{}]}) == [
        ChartQueryResult(
            [ROW_LABEL_COLUMN, "num boy"],
            [GenericDataType.STRING, GenericDataType.NUMERIC],
            [
                {ROW_LABEL_COLUMN: "CA", "num boy": 10},
                {ROW_LABEL_COLUMN: "NY", "num boy": 3},
            ],
        )
    ]
