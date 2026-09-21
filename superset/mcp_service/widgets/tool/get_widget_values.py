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
"""MCP tool: get_widget_values"""

from __future__ import annotations

from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.mcp_service.widgets.data_utils import jsonable, widget_tool_error
from superset.mcp_service.widgets.schemas import (
    GetWidgetValuesRequest,
    WidgetToolError,
    WidgetValuesResponse,
)


def _get_widget_values_impl(
    request: GetWidgetValuesRequest,
) -> WidgetValuesResponse | WidgetToolError:
    # pylint: disable=import-outside-toplevel
    from superset.commands.widget.data import WidgetValuesCommand

    try:
        values = WidgetValuesCommand(request.selector()).run()
    except Exception as ex:  # pylint: disable=broad-except
        return widget_tool_error(ex)

    return WidgetValuesResponse(values=jsonable(values) or [])


@tool(
    tags=["data"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="Get widget values",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
def get_widget_values(
    request: GetWidgetValuesRequest,
) -> WidgetValuesResponse | WidgetToolError:
    """List the selectable values of a filter widget, as the calling user.

    Pass exactly one of ``widget`` (inline, e.g. a ``filter.select``) or
    ``id`` (a saved widget uuid). Only filter-like widget types have values.

    Example:
    ```json
    {
        "widget": {
            "type": "filter.select",
            "props": {"datasetId": 17, "column": "gender"}
        }
    }
    ```

    Returns ``{"values": [...]}``, or an error with ``error_type`` NotFound,
    Forbidden or ValidationError.
    """
    return _get_widget_values_impl(request)
