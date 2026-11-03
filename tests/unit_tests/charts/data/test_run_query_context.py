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
from superset_core.exports.types import ChartQueryResult, GenericDataType

from superset.charts.data.run_query_context import (
    can_export_dashboard,
    can_export_data,
    run_query_context,
)
from superset.common.chart_data import ChartDataResultType
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


def test_can_export_dashboard_needs_access_and_export_permission(
    mocks: dict[str, mock.MagicMock],
) -> None:
    mocks["security_manager"].can_access.return_value = True
    assert can_export_dashboard(5) is True
    mocks["security_manager"].can_access.assert_called_with("can_export", "Dashboard")
    mocks["security_manager"].can_access.return_value = False
    assert can_export_dashboard(5) is False
    mocks["security_manager"].can_access.return_value = True
    mocks["security_manager"].raise_for_access.side_effect = _denied()
    assert can_export_dashboard(5) is False


def test_can_export_dashboard_missing_dashboard(
    mocks: dict[str, mock.MagicMock],
) -> None:
    mocks["DashboardDAO"].find_by_id.return_value = None
    assert can_export_dashboard(5) is False
