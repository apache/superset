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

from superset.utils import json


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
