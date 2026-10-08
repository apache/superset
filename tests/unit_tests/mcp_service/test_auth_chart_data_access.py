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
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm import Session

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
    dataset_check: MagicMock = mocker.patch(
        "superset.mcp_service.chart.chart_utils.validate_chart_dataset",
        return_value=_result(True),
    )
    can_access: MagicMock = mocker.patch(
        "superset.mcp_service.auth.has_dataset_access",
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
    dataset_check: MagicMock = mocker.patch(
        "superset.mcp_service.chart.chart_utils.validate_chart_dataset",
        return_value=_result(True),
    )

    result: DatasetValidationResult = check_chart_data_access(chart)

    assert result.is_valid is False
    dataset_check.assert_not_called()


@pytest.mark.parametrize("datasource_type", ["query", None])
def test_unknown_datasource_type_is_refused(
    mocker: MockerFixture, datasource_type: str | None
) -> None:
    """Only datasource kinds this check understands can pass it."""
    chart: SimpleNamespace = SimpleNamespace(
        datasource_type=datasource_type, datasource_id=5, semantic_view=None
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
    dataset_check: MagicMock = mocker.patch(
        "superset.mcp_service.chart.chart_utils.validate_chart_dataset",
        return_value=expected,
    )

    assert check_chart_data_access(chart) is expected
    dataset_check.assert_called_once_with(5, check_access=True)


@pytest.mark.parametrize(
    ("granted", "expected_valid"),
    [("table", False), ("view", True)],
    ids=["grant-on-colliding-dataset", "grant-on-view"],
)
def test_real_rows_resolve_the_chart_to_its_own_view(
    mocker: MockerFixture,
    session: Session,
    granted: str,
    expected_valid: bool,
) -> None:
    """With a dataset and a view sharing an id, only the view's grant counts."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.slice import Slice
    from superset.semantic_layers.models import SemanticLayer, SemanticView

    shared_id: int = 702
    SqlaTable.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    database: Database = Database(database_name="db", sqlalchemy_uri="sqlite://")
    table: SqlaTable = SqlaTable(
        id=shared_id, table_name="orders_table", schema="public", database=database
    )
    layer: SemanticLayer = SemanticLayer(name="demo", type="demo", configuration={})
    view: SemanticView = SemanticView(
        id=shared_id, name="orders", semantic_layer=layer, configuration={}
    )
    chart: Slice = Slice(
        slice_name="On the view",
        datasource_type=DatasourceType.SEMANTIC_VIEW.value,
        datasource_id=shared_id,
        datasource_name="orders",
        viz_type="table",
        params="{}",
    )
    session.add_all([database, table, layer, view, chart])
    session.flush()
    session.expire_all()

    granted_type: type = SqlaTable if granted == "table" else SemanticView
    mocker.patch(
        "superset.mcp_service.auth.g", SimpleNamespace(user=SimpleNamespace(id=1))
    )
    can_access: MagicMock = mocker.patch(
        "superset.mcp_service.auth.security_manager.can_access_datasource",
        side_effect=lambda datasource: isinstance(datasource, granted_type),
    )

    result: DatasetValidationResult = check_chart_data_access(chart)

    assert result.is_valid is expected_valid
    checked_datasources: list[object] = [
        call.kwargs["datasource"] for call in can_access.call_args_list
    ]
    assert len(checked_datasources) == 1
    checked: object = checked_datasources[0]
    assert isinstance(checked, SemanticView)
    assert checked.id == shared_id
