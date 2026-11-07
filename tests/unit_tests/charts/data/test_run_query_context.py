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
from flask import g
from marshmallow import ValidationError
from superset_core.exports.types import ChartQueryResult, GenericDataType

from superset.charts.client_processing import apply_client_processing
from superset.charts.data.run_query_context import (
    can_export_dashboard,
    can_export_data,
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
        patched["ChartDataCommand"].return_value.run.return_value = {"queries": [{}]}
        patched["apply_client_processing"].return_value = {"queries": [{}]}
        loaded = patched["ChartDataQueryContextSchema"].return_value.load.return_value
        loaded.result_type = ChartDataResultType.FULL
        loaded.queries = [mock.Mock(result_type=None)]
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
    mocks["ChartDataQueryContextSchema"].return_value.load.return_value.queries = [
        mock.Mock(result_type=None),
        mock.Mock(result_type=None),
    ]
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
    assert mocks["apply_client_processing"].call_args.kwargs == {"json_records": True}


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
    loaded = mocks["ChartDataQueryContextSchema"].return_value.load.return_value
    loaded.result_type = result_type
    with pytest.raises(ValueError, match=result_type.value):
        run_query_context({"queries": [{}]})
    mocks["ChartDataCommand"].assert_not_called()


def test_rejects_a_query_level_result_type_without_rows(
    mocks: dict[str, mock.MagicMock],
) -> None:
    loaded = mocks["ChartDataQueryContextSchema"].return_value.load.return_value
    loaded.queries = [mock.Mock(result_type=ChartDataResultType.QUERY)]
    with pytest.raises(ValueError, match="query"):
        run_query_context({"queries": [{}]})


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
    loaded = mocks["ChartDataQueryContextSchema"].return_value.load.return_value
    loaded.result_type = result_type
    loaded.queries = [mock.Mock(result_type=result_type)]
    assert run_query_context({"queries": [{}]}) == [ChartQueryResult([], [], [])]


@pytest.mark.parametrize("queries", [1, True])
def test_malformed_queries_raise_validation_error(
    app_context: None, queries: Any
) -> None:
    with pytest.raises(ValidationError):
        run_query_context(
            {"datasource": {"id": 1, "type": "table"}, "queries": queries}
        )


def test_payload_is_the_jinja_form_data_while_running(
    app_context: None, mocks: dict[str, mock.MagicMock]
) -> None:
    seen: list[Any] = []

    def run() -> dict[str, Any]:
        seen.append(g.form_data)
        return {"queries": [{}]}

    mocks["ChartDataCommand"].return_value.run.side_effect = run
    g.form_data = {"previous": True}

    run_query_context({"queries": [{"url_params": {"country": "CA"}}]})

    assert seen[0]["queries"] == [{"url_params": {"country": "CA"}}]
    assert g.form_data == {"previous": True}


def test_form_data_cleared_after_running_without_prior_context(
    app_context: None, mocks: dict[str, mock.MagicMock]
) -> None:
    g.pop("form_data", None)
    run_query_context({"queries": [{}]})
    assert "form_data" not in g


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
    """Run real client processing with records serialized before display labels."""
    result = {
        "queries": [{"result_format": ChartDataResultFormat.JSON, "data": list(_SALES)}]
    }
    return apply_client_processing(result, form_data, json_records=True)["queries"][0]


def _pivot_form_data(rows: list[str], columns: list[str]) -> dict[str, Any]:
    """Build a pivot request with totals and a single numeric metric."""
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
    """Keep a single pivot row dimension under the CSV-style blank header."""
    query = _post_process(_pivot_form_data(["state"], ["gender"]))

    assert query["colnames"] == [
        "",
        "num boy",
        "num girl",
        "num Subtotal",
        "Total (Sum)",
    ]
    assert all(isinstance(name, str) for name in query["colnames"])
    assert len(query["coltypes"]) == len(query["colnames"])
    assert [row[""] for row in query["data"]] == [
        "CA",
        "NY",
        "Total (Sum)",
    ]
    assert query["data"][0] == {
        "": "CA",
        "num boy": 10.0,
        "num girl": 5.0,
        "num Subtotal": 15.0,
        "Total (Sum)": 15.0,
    }


def test_post_processed_pivot_preserves_each_row_dimension() -> None:
    """Export each named pivot row dimension as a separate leading field."""
    query = _post_process(
        {
            **_pivot_form_data(["state", "gender"], []),
            "rowTotals": False,
            "colTotals": False,
        }
    )

    assert query["colnames"] == ["state", "gender", "num"]
    assert [(row["state"], row["gender"]) for row in query["data"]] == [
        ("CA", "boy"),
        ("CA", "girl"),
        ("NY", "boy"),
    ]
    assert query["rowcount"] == len(query["data"])
    assert len(query["coltypes"]) == len(query["colnames"])


def test_post_processed_table_drops_default_positions() -> None:
    """Omit the default table index when serializing record-oriented JSON."""
    query = _post_process({"viz_type": "table"})

    assert query["colnames"] == ["state", "gender", "num"]
    assert query["data"] == _SALES
    assert query["coltypes"] == [
        GenericDataType.STRING,
        GenericDataType.STRING,
        GenericDataType.NUMERIC,
    ]


def test_post_processed_runner_preserves_colliding_multi_level_row_labels(
    mocks: dict[str, mock.MagicMock],
) -> None:
    """Run real pivot processing without collapsing distinct rows to one label."""
    loaded = mocks["ChartDataQueryContextSchema"].return_value.load.return_value
    loaded.result_type = ChartDataResultType.POST_PROCESSED
    loaded.datasource = None
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [
            {
                "result_format": ChartDataResultFormat.JSON,
                "data": [
                    {"first": "Mary Ann", "last": "Smith", "num": 120},
                    {"first": "Mary", "last": "Ann Smith", "num": 350},
                ],
            }
        ]
    }
    mocks["apply_client_processing"].side_effect = apply_client_processing
    form_data = {
        **_pivot_form_data(["first", "last"], []),
        "rowTotals": False,
        "colTotals": False,
    }

    [result] = run_query_context({"queries": [{}], "form_data": form_data})

    assert result.colnames == ["first", "last", "num"]
    assert len(result.data) == 2
    assert {(row["first"], row["last"], row["num"]) for row in result.data} == {
        ("Mary Ann", "Smith", 120),
        ("Mary", "Ann Smith", 350),
    }
    assert result.coltypes == [
        GenericDataType.STRING,
        GenericDataType.STRING,
        GenericDataType.NUMERIC,
    ]
    assert all(list(row) == result.colnames for row in result.data)
