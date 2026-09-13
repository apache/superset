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

"""Ensure published MCP chart examples remain parseable."""

from unittest.mock import Mock, patch

import pytest
from pydantic import TypeAdapter

from superset.mcp_service.chart.schemas import ChartConfig
from superset.mcp_service.chart.tool.get_chart_type_schema import _CHART_EXAMPLES
from superset.utils import json


@pytest.mark.parametrize(
    "example",
    [example for examples in _CHART_EXAMPLES.values() for example in examples],
)
def test_chart_type_schema_example_parses(example: dict[str, object]) -> None:
    """Validate every schema-tool example against the discriminated union."""
    TypeAdapter(ChartConfig).validate_python(example)


def test_chart_configs_resource_examples_parse() -> None:
    """Validate published resource examples with authentication isolated."""
    from superset.mcp_service.chart.resources.chart_configs import (
        get_chart_configs_resource,
    )

    with patch(
        "superset.mcp_service.auth.get_user_from_request",
        return_value=Mock(id=1, username="admin"),
    ):
        resource = json.loads(get_chart_configs_resource())
    count = 0
    for examples in resource.values():
        if not isinstance(examples, dict):
            continue
        for example in examples.values():
            if isinstance(example, dict) and "config" in example:
                TypeAdapter(ChartConfig).validate_python(example["config"])
                count += 1
    assert count > 0
    assert "project_schedule" in resource["gantt_chart_configs"]
