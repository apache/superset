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

"""Preview error categories through the actual SQLite chart-data pipeline."""

from typing import Any

import pytest
from flask import g
from flask_appbuilder.security.sqla.models import User
from pytest_mock import MockerFixture

from superset import security_manager
from superset.app import SupersetApp
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.connectors.sqla.models import SqlaTable
from superset.errors import SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.canvas.schemas import PreviewWidgetResponse
from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl
from superset.models.canvas import Canvas
from tests.unit_tests.canvas import placement_data_test

pytestmark = pytest.mark.parametrize(
    "app",
    [{"FEATURE_FLAGS": {"CANVAS": True, "ALLOW_ADHOC_SUBQUERY": False}}],
    indirect=True,
)
aggregate_table = placement_data_test.aggregate_table
MODULE = "superset.mcp_service.canvas.tool.preview_widget"
BASE_URL = "https://workspace.example/prefix"


@pytest.mark.parametrize("case", ["query", "subquery", "denied"])
def test_preview_distinguishes_query_validation_from_dataset_access(
    app: SupersetApp,
    aggregate_table: SqlaTable,
    mocker: MockerFixture,
    case: str,
) -> None:
    """Keep real command/access/SQL validation; vary only grants and input."""
    app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = BASE_URL
    app.config["CANVAS_WIDGET_RENDERER_URL"] = "http://renderer"
    g.user = User(id=701, username="canvas-reader", roles=[])
    # Inject the caller's grants, not the access check or its exception.
    mocker.patch.object(security_manager, "can_access", return_value=case != "denied")
    access = mocker.spy(security_manager, "raise_for_access")
    validate = mocker.spy(ChartDataCommand, "validate")
    run = mocker.spy(ChartDataCommand, "run")
    binding: dict[str, Any] = {
        "datasetId": aggregate_table.id,
        "metrics": ["total_amount"],
        "dimensions": ["category"],
    }
    if case == "subquery":
        binding["filters"] = [
            {
                "expressionType": "SQL",
                "sqlExpression": "amount > (SELECT AVG(amount) FROM amounts)",
            }
        ]
    definition = {
        "root": {"layout": {"columns": 24}, "children": ["chart"]},
        "nodes": {
            "chart": {
                "widgetType": "ag-grid-table",
                "props": {
                    "dataBinding": binding,
                },
            }
        },
    }
    # Canvas resolution is outside this datasource/query classification test.
    dao = mocker.patch(f"{MODULE}.CanvasDAO")
    dao.find_by_id_or_uuid.return_value = Canvas(id=7, slug="sales")
    dao.load.return_value = definition
    render = mocker.patch(f"{MODULE}._render")

    result, image = _preview_widget_impl(7, "chart", False)
    payload = PreviewWidgetResponse.model_validate(result).model_dump()

    validate.assert_called_once()
    assert access.call_count >= 1
    assert payload["url"] == f"{BASE_URL}/canvas/sales/"
    assert payload["canvas_id"] == 7
    assert image is None
    render.assert_not_called()
    if case == "query":
        run.assert_called_once()
        assert "error_type" not in payload
        assert payload["row_count"] == 7
        assert {
            row["category"]: row["total_amount"] for row in payload["sample_rows"]
        } == {
            "A": 40,
            "B": 100,
            "C": 20,
            "D": 70,
            "E": 10,
            "F": 90,
            "G": 60,
        }
    else:
        assert (
            not {"row_count", "sample_rows", "query", "columns", "option", "image"}
            & payload.keys()
        )
        if case == "subquery":
            run.assert_called_once()
            assert payload["error_type"] == "QueryError"
            assert "Custom SQL fields cannot contain sub-queries" in payload["error"]
            error = run.spy_exception
            assert isinstance(error, SupersetSecurityException)
            assert (
                error.error.error_type
                == SupersetErrorType.ADHOC_SUBQUERY_NOT_ALLOWED_ERROR
            )
        else:
            run.assert_not_called()
            assert payload["error_type"] == "DatasetNotAccessible"
            error = validate.spy_exception
            assert isinstance(error, SupersetSecurityException)
            assert (
                error.error.error_type
                == SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR
            )
