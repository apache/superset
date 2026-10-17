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
"""Example bundles must not confuse semantic-view IDs with table IDs."""

from collections.abc import Callable
from typing import Any
from unittest.mock import Mock
from uuid import UUID

import pytest
import yaml
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from werkzeug.test import TestResponse

from superset.commands.dashboard import export_example
from superset.commands.dashboard.export_example import (
    ExportExampleCommand,
    ExportExampleSemanticViewError,
)
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.semantic_layers.models import SemanticView
from superset.utils import json


@pytest.fixture
def example_dashboard(mocker: MockerFixture) -> Dashboard:
    """Build real model objects; only the command's DAO lookup is replaced."""
    table: SqlaTable = SqlaTable(
        id=7,
        uuid=UUID("00000000-0000-0000-0000-000000000007"),
        table_name="ordinary_table",
        database=Database(sqlalchemy_uri="sqlite://"),
    )
    chart: Slice = Slice(
        id=1,
        uuid=UUID("00000000-0000-0000-0000-000000000001"),
        slice_name="Table chart",
        datasource_type="table",
        datasource_id=7,
        table=table,
        params="{}",
        viz_type="table",
    )
    dashboard: Dashboard = Dashboard(
        id=1,
        uuid=UUID("00000000-0000-0000-0000-000000000010"),
        dashboard_title="Example",
        slug="example",
        position_json="{}",
        json_metadata=json.dumps(
            {
                "native_filter_configuration": [
                    {"targets": [{"datasetId": 7, "column": {"name": "country"}}]}
                ]
            }
        ),
        slices=[chart],
    )
    mocker.patch(
        "superset.commands.dashboard.export_example.DashboardDAO.find_by_id",
        return_value=dashboard,
    )
    return dashboard


def add_semantic_assets(dashboard: Dashboard, asset: str) -> None:
    """Use the same numeric ID in two datasource namespaces."""
    view: SemanticView = SemanticView(
        id=7,
        uuid=UUID("00000000-0000-0000-0000-000000000077"),
        name="semantic",
    )
    if asset in {"collision", "chart", "orphan_chart"}:
        chart: Slice = Slice(
            id=2,
            uuid=UUID("00000000-0000-0000-0000-000000000002"),
            slice_name="Semantic chart",
            datasource_type="semantic_view",
            datasource_id=7,
            semantic_view=None if asset == "orphan_chart" else view,
            params="{}",
            viz_type="table",
        )
        assert chart.datasource is None
        dashboard.slices.insert(0, chart)
    if asset in {"collision", "filter"}:
        dashboard.json_metadata = json.dumps(
            {
                "native_filter_configuration": [
                    {
                        "targets": [
                            {
                                "datasetId": 7,
                                "datasourceType": "semantic_view",
                                "column": {"name": "country"},
                            }
                        ]
                    }
                ]
            }
        )


@pytest.mark.parametrize("asset", ["collision", "chart", "filter", "orphan_chart"])
def test_example_export_rejects_semantic_assets(
    example_dashboard: Dashboard,
    asset: str,
    mocker: MockerFixture,
) -> None:
    """Reject before producing the first bundle entry, including orphan charts."""
    add_semantic_assets(example_dashboard, asset)
    dataset_builder: Mock = mocker.spy(export_example, "export_dataset_yaml")
    chart_builder: Mock = mocker.spy(export_example, "export_chart")
    dashboard_builder: Mock = mocker.spy(export_example, "export_dashboard_yaml")
    with pytest.raises(ExportExampleSemanticViewError, match="semantic views"):
        next(ExportExampleCommand(1, export_data=False).run())
    dataset_builder.assert_not_called()
    chart_builder.assert_not_called()
    dashboard_builder.assert_not_called()


def test_table_only_example_bundle_is_unchanged(example_dashboard: Dashboard) -> None:
    """Keep the ordinary dataset/chart/filter UUID mapping and bundle layout."""
    files: dict[str, Callable[[], bytes]] = dict(
        ExportExampleCommand(1, export_data=False).run()
    )
    assert set(files) == {"dataset.yaml", "charts/Table_chart.yaml", "dashboard.yaml"}
    dataset: dict[str, Any] = yaml.safe_load(files["dataset.yaml"]())
    chart: dict[str, Any] = yaml.safe_load(files["charts/Table_chart.yaml"]())
    dashboard: dict[str, Any] = yaml.safe_load(files["dashboard.yaml"]())
    assert (
        dataset["uuid"]
        == chart["dataset_uuid"]
        == str(example_dashboard.slices[0].table.uuid)
    )
    assert dashboard["metadata"]["native_filter_configuration"][0]["targets"] == [
        {"datasetUuid": dataset["uuid"], "column": {"name": "country"}}
    ]


@pytest.mark.parametrize("asset", ["collision", "chart", "filter", "orphan_chart"])
def test_example_route_rejects_semantic_assets(
    example_dashboard: Dashboard,
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    asset: str,
) -> None:
    """The real command's rejection reaches the client as 422 rather than a ZIP."""
    add_semantic_assets(example_dashboard, asset)
    mocker.patch("superset.dashboards.api.get_user_id", return_value=1)
    response: TestResponse = client.get(
        "/api/v1/dashboard/1/export_as_example/?export_data=false"
    )
    assert response.status_code == 422
    assert response.is_json
    assert "semantic views" in response.json["message"]
