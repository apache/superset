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
aggregate_canvas = placement_data_test.aggregate_canvas
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
    definition: dict[str, Any] = {
        "root": {"layout": {"columns": 24}, "children": ["chart"]},
        "nodes": {
            "chart": {
                "widgetType": "echarts",
                "props": {
                    "dataBinding": binding,
                    "chartType": "bar",
                },
            }
        },
    }
    # Canvas resolution is outside this datasource/query classification test.
    dao = mocker.patch(f"{MODULE}.CanvasDAO")
    dao.find_by_id_or_uuid.return_value = Canvas(id=7, slug="sales")
    dao.load.return_value = definition
    render = mocker.patch(f"{MODULE}._render", return_value={"option": {}})
    mocker.patch(f"{MODULE}._pixel_size", return_value=(640, 320))

    result, image = _preview_widget_impl(7, "chart", False)
    payload = PreviewWidgetResponse.model_validate(result).model_dump()

    validate.assert_called_once()
    assert access.call_count >= 1
    assert payload["url"] == f"{BASE_URL}/canvas/sales/"
    assert payload["canvas_id"] == 7
    assert image is None
    if case == "query":
        render.assert_called_once()
        assert render.call_args.args[1] == definition["nodes"]["chart"]["props"]
        assert render.call_args.args[2] == payload["sample_rows"]
        assert payload["rendered"] is True
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
        render.assert_not_called()
        assert (
            not {"row_count", "sample_rows", "query", "columns", "option", "image"}
            & payload.keys()
        )
        if case == "subquery":
            run.assert_called_once()
            assert payload["error_type"] == "QueryError"
            assert payload["error"] == (
                "The widget's query was refused (ADHOC_SUBQUERY_NOT_ALLOWED_ERROR)."
            )
            error = run.spy_exception
            assert isinstance(error, SupersetSecurityException)
            assert (
                error.error.error_type
                == SupersetErrorType.ADHOC_SUBQUERY_NOT_ALLOWED_ERROR
            )
        else:
            run.assert_not_called()
            assert payload["error_type"] == "DatasetNotAccessible"
            # A fixed refusal: the exception's message names the datasource.
            assert payload["error"] == (
                "The widget's dataset does not exist, or you have no access to it."
            )
            assert aggregate_table.table_name not in payload["error"]
            error = validate.spy_exception
            assert isinstance(error, SupersetSecurityException)
            assert (
                error.error.error_type
                == SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR
            )


@pytest.mark.parametrize("failure", ["transport", "http", "decode", "error", "shape"])
def test_renderer_transport_and_malformed_results_keep_fixed_diagnostics(
    app: SupersetApp, mocker: MockerFixture, failure: str
) -> None:
    """Transport exceptions and invalid response shapes are not repair hints."""
    import requests

    from superset.mcp_service.canvas.tool.preview_widget import (
        _with_render,
        RENDERER_FAILURE_MESSAGE,
    )

    private = "private-renderer-url-response-or-exception"
    render = mocker.patch(f"{MODULE}._render")
    if failure == "transport":
        render.side_effect = requests.RequestException(private)
    elif failure == "http":
        render.side_effect = requests.HTTPError(private)
    elif failure == "decode":
        render.side_effect = ValueError(private)
    elif failure == "shape":
        render.return_value = [private]
    else:
        render.return_value = {
            "error" if failure == "error" else "warnings": [private],
            "png": private,
            "option": {"private": private},
        }
    log = mocker.patch(f"{MODULE}.logger.warning")
    result: dict[str, Any] = {}
    image = _with_render(result, "http://renderer", {}, [], {}, (640, 320), False)
    assert image is None
    assert result["rendered"] is False
    assert result["warnings"] == [RENDERER_FAILURE_MESSAGE]
    assert "option" not in result
    assert "image" not in result
    assert private not in str(result)
    assert private not in str(log.call_args_list)
    assert "error_type" not in result


@pytest.mark.parametrize("option", [{"series": [{"type": "invalid"}]}, "bad shape"])
def test_renderer_error_keeps_bounded_repair_hint_and_resolved_option(
    app: SupersetApp, mocker: MockerFixture, option: Any
) -> None:
    from superset.mcp_service.canvas.tool.preview_widget import _with_render

    diagnostic = "Unknown series type: " + "x" * 600
    mocker.patch(
        f"{MODULE}._render",
        return_value={
            "error": diagnostic,
            "option": option,
            "warnings": ["duplicate renderer warning"],
            "png": "unverified-image",
        },
    )
    result: dict[str, Any] = {}
    image = _with_render(result, "http://renderer", {}, [], {}, (640, 320), False)
    assert image is None
    assert result["rendered"] is False
    assert result["error"] == diagnostic[:500]
    assert result["error_type"] == "RendererError"
    assert result["warnings"] == []
    assert "image" not in result
    if isinstance(option, dict):
        assert result["option"] == option
    else:
        assert "option" not in result


@pytest.mark.parametrize(
    "error_payload",
    [
        {},
        {"error": None},
        {"error": ""},
        {"error": False},
        {"error": 0},
        {"error": []},
        {"error": {}},
    ],
    ids=[
        "missing",
        "null",
        "empty-string",
        "false",
        "zero",
        "empty-list",
        "empty-object",
    ],
)
def test_falsey_renderer_error_keeps_successful_image_and_repair_hints(
    app: SupersetApp, mocker: MockerFixture, error_payload: dict[str, Any]
) -> None:
    from superset.mcp_service.canvas.tool.preview_widget import _with_render

    option = {"series": [{"type": "bar", "data": [1, 2]}]}
    mocker.patch(
        f"{MODULE}._render",
        return_value={
            "png": "aGk=",
            "width": 640,
            "height": 320,
            "option": option,
            "warnings": ["Review the axis labels"],
            **error_payload,
        },
    )
    result: dict[str, Any] = {}
    image = _with_render(result, "http://renderer", {}, [], {}, (640, 320), False)
    assert image == "aGk="
    assert result == {
        "rendered": True,
        "image": "attached, 640x320 PNG",
        "option": option,
        "warnings": ["Review the axis labels"],
    }


@pytest.mark.parametrize("error", ["   ", True, 1, ["invalid"], {"invalid": 1}])
def test_malformed_renderer_error_is_not_reported_as_visual_success(
    app: SupersetApp, mocker: MockerFixture, error: Any
) -> None:
    from superset.mcp_service.canvas.tool.preview_widget import (
        _with_render,
        RENDERER_FAILURE_MESSAGE,
    )

    mocker.patch(f"{MODULE}._render", return_value={"error": error, "png": "image"})
    result: dict[str, Any] = {}
    assert (
        _with_render(result, "http://renderer", {}, [], {}, (640, 320), False) is None
    )
    assert result == {"rendered": False, "warnings": [RENDERER_FAILURE_MESSAGE]}


@pytest.mark.parametrize(
    "expression,diagnostic",
    [
        (
            "{{ 'SUM(amount); SELECT 1' }}",
            "Custom SQL fields cannot be parsed as a single SQL statement.",
        ),
        (
            "{{ 'SUM(amount) UNION SELECT 1' }}",
            "Custom SQL fields cannot contain set operations.",
        ),
        (
            "SUM(amount)",
            "Custom SQL fields cannot be safely rewritten with RLS filters.",
        ),
    ],
    ids=["saved-parse", "saved-set-operation", "saved-rls-rewrite"],
)
def test_saved_expression_diagnostics_are_preserved_without_dataset_mutation(
    app: SupersetApp,
    aggregate_table: SqlaTable,
    mocker: MockerFixture,
    expression: str,
    diagnostic: str,
) -> None:
    """Real stored-expression validation feeds the query and preview transports."""
    from superset.canvas.query_errors import canvas_query_error
    from superset.exceptions import SupersetParseError

    app.config["FEATURE_FLAGS"]["ENABLE_TEMPLATE_PROCESSING"] = True
    g.user = User(id=701, username="canvas-reader", roles=[])
    mocker.patch.object(security_manager, "can_access", return_value=True)
    metric = aggregate_table.metrics[0]
    metric.expression = expression
    before = [(item.metric_name, item.expression) for item in aggregate_table.metrics]
    if diagnostic.endswith("RLS filters."):
        # Exercise the real fallback validator with a dialect parse limitation
        # and a base-dialect rewrite; do not mock its resulting exception.
        mocker.patch(
            "superset.models.helpers.validate_adhoc_subquery",
            side_effect=[
                SupersetParseError("dialect parse limitation"),
                SupersetParseError("dialect parse limitation"),
                "SELECT SUM(amount) WHERE protected_rls = 1",
            ],
        )
    dao = mocker.patch(f"{MODULE}.CanvasDAO")
    dao.find_by_id_or_uuid.return_value = Canvas(id=7, slug="sales")
    dao.load.return_value = {
        "nodes": {
            "chart": {
                "widgetType": "echarts",
                "props": {
                    "chartType": "bar",
                    "dataBinding": {
                        "datasetId": aggregate_table.id,
                        "metrics": ["total_amount"],
                        "dimensions": ["category"],
                    },
                },
            }
        }
    }
    query = mocker.spy(ChartDataCommand, "run")
    render = mocker.patch(f"{MODULE}._render")
    result, image = _preview_widget_impl(7, "chart", False)
    assert result["error_type"] == "QueryError"
    assert result["error"] == f"The widget's query failed: Error: {diagnostic}"
    assert canvas_query_error(query.spy_exception).status == 400
    assert canvas_query_error(query.spy_exception).message == f"Error: {diagnostic}"
    assert image is None
    render.assert_not_called()
    assert [
        (item.metric_name, item.expression) for item in aggregate_table.metrics
    ] == before


@pytest.mark.parametrize("case", ["subquery", "column", "metric", "custom-sql"])
def test_widget_query_input_can_be_repaired_in_a_draft(
    app: SupersetApp,
    aggregate_table: SqlaTable,
    aggregate_canvas: Canvas,
    mocker: MockerFixture,
    case: str,
) -> None:
    """Repair widget input through draft commands, without editing saved assets."""
    from copy import deepcopy
    from types import SimpleNamespace

    from superset.canvas.definition.schemas import DraftOperationsRequest
    from superset.commands.canvas.draft import (
        ApplyCanvasDraftOperationsCommand,
        CreateCanvasDraftCommand,
    )
    from superset.utils import json
    from tests.unit_tests.canvas.draft_test import Store

    g.user = User(id=701, username="canvas-editor", roles=[])
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(security_manager, "raise_for_editorship")
    mocker.patch(
        "superset.commands.canvas.draft.cache_manager",
        new=SimpleNamespace(explore_form_data_cache=Store()),
    )
    good_binding: dict[str, Any] = {
        "datasetId": aggregate_table.id,
        "metrics": ["total_amount"],
        "dimensions": ["category"],
    }
    bad_binding = deepcopy(good_binding)
    if case == "subquery":
        bad_binding["filters"] = [
            {
                "expressionType": "SQL",
                "sqlExpression": "amount > (SELECT AVG(amount) FROM amounts)",
            }
        ]
        diagnostic = "ADHOC_SUBQUERY_NOT_ALLOWED_ERROR"
    elif case == "column":
        bad_binding["dimensions"] = ["missing_column"]
        diagnostic = "Columns missing in dataset"
    elif case == "metric":
        bad_binding["metrics"] = ["missing_metric"]
        diagnostic = "does not exist"
    else:
        bad_binding["metrics"] = [
            {
                "expressionType": "SQL",
                "sqlExpression": "SUM(missing_column)",
                "label": "broken_sql",
            }
        ]
        diagnostic = "no such column"
    published_definition = aggregate_canvas.definition
    dataset_before = [
        (metric.metric_name, metric.expression) for metric in aggregate_table.metrics
    ]
    draft = CreateCanvasDraftCommand(aggregate_canvas.id).run()
    widget_id = json.loads(published_definition)["nodes"]["amounts"]["widgetId"]
    saved_widget = draft.resolver().widgets({widget_id})[widget_id]
    saved_props = deepcopy(saved_widget.props)

    def change(binding: dict[str, Any], revision: int) -> None:
        request = DraftOperationsRequest.model_validate(
            {
                "revision": revision,
                "ops": [
                    {
                        "op": "set_props",
                        "id": "amounts",
                        "props": {**saved_props, "dataBinding": binding},
                    }
                ],
            }
        )
        ApplyCanvasDraftOperationsCommand(
            draft.token, request.revision, request.ops
        ).run()

    change(bad_binding, 0)
    failed, _ = _preview_widget_impl(
        aggregate_canvas.id, "amounts", False, draft_token=draft.token
    )
    assert failed["error_type"] == "QueryError"
    assert diagnostic in failed["error"]
    change(good_binding, 1)
    repaired, _ = _preview_widget_impl(
        aggregate_canvas.id, "amounts", False, draft_token=draft.token
    )
    assert "error" not in repaired
    assert repaired["row_count"] == 7
    assert sum(row["total_amount"] for row in repaired["sample_rows"]) == 390
    assert aggregate_canvas.definition == published_definition
    assert draft.resolver().base.widgets({widget_id})[widget_id].props == saved_props
    assert [
        (metric.metric_name, metric.expression) for metric in aggregate_table.metrics
    ] == dataset_before


@pytest.mark.parametrize(
    "warnings",
    [
        ["Tooltip prints [object Object]"],
        ["x" * 1000] * 20,
        [None, {"unexpected": "object"}, 3, "Useful hint"],
        [None] * 10 + [f"Useful hint {i}" for i in range(11)],
        "not a list",
    ],
)
def test_successful_renderer_warnings_are_bounded_and_keep_image(
    app: SupersetApp, mocker: MockerFixture, warnings: Any
) -> None:
    from superset.mcp_service.canvas.tool.preview_widget import _with_render

    mocker.patch(
        f"{MODULE}._render",
        return_value={"warnings": warnings, "png": "aGk=", "option": {"series": []}},
    )
    result: dict[str, Any] = {}
    image = _with_render(result, "http://renderer", {}, [], {}, (640, 320), False)
    assert image == "aGk="
    assert result["rendered"] is True
    assert result["option"] == {"series": []}
    assert "error" not in result
    expected = (
        [warning[:500] for warning in warnings if isinstance(warning, str) and warning][
            :10
        ]
        if isinstance(warnings, list)
        else []
    )
    assert result["warnings"] == expected


def test_real_chart_validation_wrapper_keeps_rest_and_preview_repairable(
    client: Any,
    full_api_access: None,
    aggregate_table: SqlaTable,
    aggregate_canvas: Canvas,
    mocker: MockerFixture,
) -> None:
    """A stored subquery traverses the real validation marker and command wrapper."""
    from superset.commands.chart.exceptions import ChartDataQueryValidationError
    from superset.exceptions import QueryObjectValidationError

    mocker.patch.object(security_manager, "can_access", return_value=True)
    aggregate_table.metrics[0].expression = "SUM(amount) + (SELECT 1)"
    query = mocker.spy(ChartDataCommand, "run")
    render = mocker.patch(f"{MODULE}._render")

    response = client.post(
        f"/api/v1/canvas/{aggregate_canvas.id}/placement/amounts/data", json={}
    )
    assert response.status_code == 400
    assert response.json["error_type"] == "QueryError"
    assert "cannot contain sub-queries" in response.json["message"]
    error = query.spy_exception
    assert isinstance(error, ChartDataQueryValidationError)
    assert isinstance(error.__cause__, QueryObjectValidationError)
    assert isinstance(error.__cause__.__cause__, SupersetSecurityException)

    preview, image = _preview_widget_impl(aggregate_canvas.id, "amounts", False)
    assert preview["error_type"] == "QueryError"
    assert preview["error"] == f"The widget's query failed: {response.json['message']}"
    assert isinstance(query.spy_exception, ChartDataQueryValidationError)
    assert image is None
    render.assert_not_called()


def test_a_draft_token_previews_only_the_canvas_it_belongs_to(
    app: SupersetApp,
    session: Any,
    aggregate_canvas: Canvas,
    mocker: MockerFixture,
) -> None:
    """Naming another canvas with this canvas's draft token is refused, as the
    REST placement-data route refuses it, rather than previewing the draft."""
    from superset.canvas.definition.schemas import empty_definition
    from superset.commands.canvas.draft import CreateCanvasDraftCommand
    from superset.utils import json

    g.user = User(id=701, username="canvas-editor", roles=[])
    other = Canvas(
        title="Other",
        slug="other",
        definition=json.dumps(empty_definition()),
        definition_version=1,
        revision=1,
    )
    session.add(other)
    session.commit()
    draft = CreateCanvasDraftCommand(aggregate_canvas.id).run()

    result, image = _preview_widget_impl(
        other.id, "amounts", False, draft_token=draft.token
    )

    assert image is None
    assert result["error_type"] == "DraftUnavailable"
    own, _ = _preview_widget_impl(
        aggregate_canvas.id, "amounts", False, draft_token=draft.token
    )
    assert own["canvas_id"] == aggregate_canvas.id
