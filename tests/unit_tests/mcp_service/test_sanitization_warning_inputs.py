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

"""Regression tests for server-only MCP sanitization warnings."""

from typing import Any

import pytest
from pydantic import TypeAdapter

from superset.mcp_service.chart.schemas import GenerateChartRequest
from superset.mcp_service.dashboard.schemas import (
    DuplicateDashboardRequest,
    GenerateDashboardRequest,
    UpdateDashboardRequest,
)
from superset.utils import json


@pytest.mark.parametrize(
    ("model", "payload", "title_field"),
    [
        (GenerateDashboardRequest, {"chart_ids": [1]}, "dashboard_title"),
        (UpdateDashboardRequest, {"identifier": 1}, "dashboard_title"),
        (DuplicateDashboardRequest, {"dashboard_id": 1}, "dashboard_title"),
        (
            GenerateChartRequest,
            {
                "dataset_id": 1,
                "config": {"chart_type": "table", "columns": [{"name": "a"}]},
            },
            "chart_name",
        ),
    ],
)
@pytest.mark.parametrize("title", ["Safe title", "Safe <b>title</b>"])
def test_sanitization_warnings_are_server_only(
    model: type[
        GenerateChartRequest
        | GenerateDashboardRequest
        | UpdateDashboardRequest
        | DuplicateDashboardRequest
    ],
    payload: dict[str, Any],
    title_field: str,
    title: str,
) -> None:
    """Hide internal warnings in schemas without losing sanitization notices."""
    assert "sanitization_warnings" not in json.dumps(model.model_json_schema())
    # Also cover the type-adapter schema used by tool integrations.
    assert "sanitization_warnings" not in json.dumps(TypeAdapter(model).json_schema())

    payload = {
        **payload,
        title_field: title,
        "sanitization_warnings": ["caller-controlled warning"],
    }
    request = model.model_validate_json(json.dumps(payload))
    warnings = request.sanitization_warnings
    assert getattr(request, title_field) == "Safe title"
    if "<b>" in title:
        assert len(warnings) == 1
        assert title_field in warnings[0]
        assert "caller-controlled" not in warnings[0]
    else:
        assert warnings == []
