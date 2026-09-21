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
"""MCP tool: get_widget_data"""

from __future__ import annotations

from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.mcp_service.widgets.data_utils import jsonable, widget_tool_error
from superset.mcp_service.widgets.schemas import (
    GetWidgetDataRequest,
    WidgetDataResponse,
    WidgetToolError,
)


def _get_widget_data_impl(
    request: GetWidgetDataRequest,
) -> WidgetDataResponse | WidgetToolError:
    # pylint: disable=import-outside-toplevel
    from superset.commands.widget.data import WidgetDataCommand

    try:
        result = WidgetDataCommand(
            request.selector(),
            [resolved.model_dump() for resolved in request.filters],
        ).run()
    except Exception as ex:  # pylint: disable=broad-except
        return widget_tool_error(ex)

    payload = jsonable(result)
    return WidgetDataResponse(
        columns=payload.get("columns") or [],
        rows=payload.get("rows") or [],
    )


@tool(
    tags=["data"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="Get widget data",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
def get_widget_data(
    request: GetWidgetDataRequest,
) -> WidgetDataResponse | WidgetToolError:
    """Run a widget's query and return its rows, as the calling user.

    Pass exactly one of ``widget`` (an inline definition, validated against
    the widget type's control schema) or ``id`` (a saved widget uuid). The
    query is built server-side from the widget's props; ``filters`` can only
    narrow it. Dataset permissions and row-level security apply.

    Example:
    ```json
    {
        "widget": {
            "type": "echarts",
            "props": {
                "chartType": "bar",
                "dataBinding": {
                    "datasetId": 17,
                    "metrics": ["sum__num"],
                    "dimensions": ["state"],
                    "rowLimit": 10
                }
            }
        },
        "filters": [{"column": "state", "operator": "IN", "value": ["CA", "NY"]}]
    }
    ```

    Returns ``{"columns": [...], "rows": [{...}]}``, or an error with
    ``error_type`` NotFound, Forbidden or ValidationError.
    """
    return _get_widget_data_impl(request)
