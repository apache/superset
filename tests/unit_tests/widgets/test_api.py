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

"""Tests for ``WidgetControlsRestApi.validate`` — the REST boundary the
Dashboard V2 Inspector's form and JSON editor commit through (see
``controlValueValidation.ts``). It is a thin wrapper over
``Widget.validate_control_values``, the same call ``set_widget_control_values``
(the MCP write tool) commits through, so a frontend edit and an MCP edit are
validated by one implementation reached by two routes, not two rule sets that
can drift apart."""

from __future__ import annotations

from unittest.mock import Mock, patch

import pytest

from superset.utils import json

# The widget API is registered with the canvas, behind its feature flag.
pytestmark = pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"CANVAS": True}}], indirect=True
)


CONFIG = "superset.canvas.definition.registry.current_app.config"


def _listed(client) -> set[str]:
    response = client.get("/api/v1/widgets/types")
    assert response.status_code == 200
    return {widget_type["id"] for widget_type in response.get_json()["result"]}


def test_types_leave_out_the_types_turned_off(client, full_api_access) -> None:
    every_type = _listed(client)
    with patch.dict(CONFIG, {"CANVAS_DISABLED_WIDGET_TYPES": frozenset({"markdown"})}):
        enabled = _listed(client)

    assert "markdown" in every_type
    assert every_type - enabled == {"markdown"}


def test_the_per_request_check_is_asked_on_every_request(
    client, full_api_access
) -> None:
    # A host serving several workspaces from one process answers per request.
    answers = iter([False, True])
    enabled = Mock(
        side_effect=lambda widget_type: widget_type != "markdown" or next(answers)
    )

    with patch.dict(
        CONFIG,
        {
            "CANVAS_WIDGET_TYPE_ENABLED_FUNC": enabled,
            # Ignored while the check is set.
            "CANVAS_DISABLED_WIDGET_TYPES": frozenset({"metric-tile"}),
        },
    ):
        first, second = _listed(client), _listed(client)

    assert "markdown" not in first
    assert "markdown" in second
    assert "metric-tile" in first
    assert [call.args for call in enabled.call_args_list].count(("markdown",)) == 2


def test_a_check_that_raises_turns_the_type_off(client, full_api_access) -> None:
    def enabled(widget_type: str) -> bool:
        if widget_type == "markdown":
            raise RuntimeError("flag service unavailable")
        return True

    with patch.dict(CONFIG, {"CANVAS_WIDGET_TYPE_ENABLED_FUNC": enabled}):
        listed = _listed(client)

    assert "markdown" not in listed
    assert "metric-tile" in listed


def test_a_type_turned_off_has_no_schema_and_no_validation(
    client, full_api_access
) -> None:
    schema = "/api/v1/widgets/type/metric-tile/control-schema"
    validate = "/api/v1/widgets/type/metric-tile/validate"
    body = json.dumps({"control_values": {}})

    assert client.get(schema).status_code == 200
    with patch.dict(
        CONFIG, {"CANVAS_DISABLED_WIDGET_TYPES": frozenset({"metric-tile"})}
    ):
        assert client.get(schema).status_code == 404
        assert (
            client.post(validate, data=body, content_type="application/json")
        ).status_code == 404


def test_validate_accepts_valid_control_values(client, full_api_access) -> None:
    resp = client.post(
        "/api/v1/widgets/type/metric-tile/validate",
        data=json.dumps(
            {
                "control_values": {
                    "dataBinding": {"datasetId": 1, "metrics": ["count"]},
                }
            }
        ),
        content_type="application/json",
    )

    assert resp.status_code == 200
    assert resp.get_json()["result"]["errors"] == []


def test_validate_rejects_invalid_control_values(client, full_api_access) -> None:
    resp = client.post(
        "/api/v1/widgets/type/metric-tile/validate",
        data=json.dumps({"control_values": {"decimals": "not-an-int"}}),
        content_type="application/json",
    )

    assert resp.status_code == 200
    errors = resp.get_json()["result"]["errors"]
    locs = [tuple(error["loc"]) for error in errors]
    # Missing the required dataBinding, and decimals is the wrong type: both
    # of the widget's own model rules, not something this route invents.
    assert ("dataBinding",) in locs
    assert ("decimals",) in locs


def test_validate_unknown_widget_type_is_404(client, full_api_access) -> None:
    resp = client.post(
        "/api/v1/widgets/type/not-a-real-widget-type/validate",
        data=json.dumps({"control_values": {}}),
        content_type="application/json",
    )

    assert resp.status_code == 404


def test_validate_is_a_thin_wrapper_over_the_widget_s_own_validator(
    client, full_api_access
) -> None:
    """The route's result must equal calling the widget's
    ``validate_control_values`` directly with the same input — proving the
    REST boundary and the MCP ``set_widget_control_values`` tool (which also
    calls ``validate_control_values`` directly) run through the identical
    implementation rather than parallel copies of it."""
    from superset.widgets.registry import registry

    control_values = {"decimals": "not-an-int"}
    widget = registry.get("metric-tile")
    assert widget is not None
    direct_errors = widget.validate_control_values(control_values)

    resp = client.post(
        "/api/v1/widgets/type/metric-tile/validate",
        data=json.dumps({"control_values": control_values}),
        content_type="application/json",
    )

    assert resp.status_code == 200
    assert resp.get_json()["result"]["errors"] == direct_errors


def test_control_schema_is_json_in_model_field_order(client, full_api_access) -> None:
    from superset.widgets.registry import registry

    resp = client.post(
        "/api/v1/widgets/type/metric-tile/control-schema",
        data=json.dumps({"control_values": {"label": "<script>x</script>"}}),
        content_type="application/json",
    )

    assert resp.status_code == 200
    assert resp.mimetype == "application/json"
    controls = registry["metric-tile"].controls_class
    expected = [field.alias or name for name, field in controls.model_fields.items()]
    assert list(resp.get_json()["result"]["properties"]) == expected


def test_human_filter_schema_keeps_enriched_dropdowns(client, full_api_access) -> None:
    dataset = Mock(id=13, filterable_column_names=["country", "region"])
    dataset.name = "Orders"
    with (
        patch("superset.widgets.builtin.DatasetDAO.list", return_value=([dataset], -1)),
        patch("superset.widgets.builtin.DatasetDAO.find_by_id", return_value=dataset),
    ):
        response = client.post(
            "/api/v1/widgets/type/filter.select/control-schema",
            json={"control_values": {"datasetId": 13, "column": "country"}},
        )

    assert response.status_code == 200
    properties = response.get_json()["result"]["properties"]
    assert properties["datasetId"]["enum"] == [13]
    assert properties["datasetId"]["x-enumNames"] == ["Orders"]
    assert properties["column"]["enum"] == ["country", "region"]
    dataset.raise_for_access.assert_called_once()
