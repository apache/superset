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
"""Data-level access for a chart is checked against the chart's own datasource."""

from types import SimpleNamespace

import pytest
from pytest_mock import MockerFixture

from superset.mcp_service.auth import check_chart_data_access
from superset.mcp_service.chart.chart_utils import DatasetValidationResult
from superset.utils.core import DatasourceType


def _result(is_valid: bool) -> DatasetValidationResult:
    """A dataset-path result, valid or reporting a missing dataset."""
    return DatasetValidationResult(
        is_valid=is_valid,
        dataset_id=5,
        dataset_name="orders" if is_valid else None,
        warnings=[],
        error=None if is_valid else "Dataset (ID: 5) has been deleted",
    )


@pytest.mark.parametrize("can_access_view", [False, True])
def test_semantic_view_chart_is_checked_against_the_view(
    mocker: MockerFixture, can_access_view: bool
) -> None:
    """A semantic-view chart is decided by the view, never a same-id dataset."""
    view: SimpleNamespace = SimpleNamespace(id=5, name="orders view")
    chart: SimpleNamespace = SimpleNamespace(
        datasource_type=DatasourceType.SEMANTIC_VIEW.value,
        datasource_id=5,
        semantic_view=view,
    )
    # The same id resolves to an accessible SQL dataset when looked up as one.
    dataset_check = mocker.patch(
        "superset.mcp_service.chart.chart_utils.validate_chart_dataset",
        return_value=_result(True),
    )
    can_access = mocker.patch(
        "superset.mcp_service.auth.security_manager.can_access_datasource",
        return_value=can_access_view,
    )

    result: DatasetValidationResult = check_chart_data_access(chart)

    assert result.is_valid is can_access_view
    can_access.assert_called_once_with(view)
    dataset_check.assert_not_called()


def test_semantic_view_chart_without_its_view_is_refused(
    mocker: MockerFixture,
) -> None:
    """A semantic-view chart whose view is gone fails closed."""
    chart: SimpleNamespace = SimpleNamespace(
        datasource_type=DatasourceType.SEMANTIC_VIEW.value,
        datasource_id=5,
        semantic_view=None,
    )
    dataset_check = mocker.patch(
        "superset.mcp_service.chart.chart_utils.validate_chart_dataset",
        return_value=_result(True),
    )

    result: DatasetValidationResult = check_chart_data_access(chart)

    assert result.is_valid is False
    dataset_check.assert_not_called()


def test_unknown_datasource_type_is_refused(mocker: MockerFixture) -> None:
    """Only datasource kinds this check understands can pass it."""
    chart: SimpleNamespace = SimpleNamespace(
        datasource_type="query", datasource_id=5, semantic_view=None
    )
    mocker.patch(
        "superset.mcp_service.chart.chart_utils.validate_chart_dataset",
        return_value=_result(True),
    )

    result: DatasetValidationResult = check_chart_data_access(chart)

    assert result.is_valid is False


@pytest.mark.parametrize("dataset_valid", [False, True])
def test_table_chart_keeps_the_dataset_check(
    mocker: MockerFixture, dataset_valid: bool
) -> None:
    """SQL dataset charts are validated exactly as before."""
    chart: SimpleNamespace = SimpleNamespace(
        datasource_type=DatasourceType.TABLE.value, datasource_id=5
    )
    expected: DatasetValidationResult = _result(dataset_valid)
    dataset_check = mocker.patch(
        "superset.mcp_service.chart.chart_utils.validate_chart_dataset",
        return_value=expected,
    )

    assert check_chart_data_access(chart) is expected
    dataset_check.assert_called_once_with(5, check_access=True)
