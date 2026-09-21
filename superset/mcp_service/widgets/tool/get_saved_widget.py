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
"""MCP tool: get_saved_widget"""

from __future__ import annotations

from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.mcp_service.widgets.data_utils import widget_tool_error
from superset.mcp_service.widgets.schemas import (
    GetSavedWidgetRequest,
    SavedWidgetResponse,
    WidgetToolError,
)


def _get_saved_widget_impl(
    request: GetSavedWidgetRequest,
) -> SavedWidgetResponse | WidgetToolError:
    # pylint: disable=import-outside-toplevel
    from superset.commands.widget.saved import GetSavedWidgetCommand
    from superset.commands.widget.utils import serialize_saved_widget

    try:
        widget = GetSavedWidgetCommand(request.id).run()
    except Exception as ex:  # pylint: disable=broad-except
        return widget_tool_error(ex)

    return SavedWidgetResponse(**serialize_saved_widget(widget))


@tool(
    tags=["discovery"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="Get saved widget",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
def get_saved_widget(
    request: GetSavedWidgetRequest,
) -> SavedWidgetResponse | WidgetToolError:
    """Get a saved widget's definition: its type, props and dataset.

    Example:
    ```json
    {"id": "cedf0501-fa36-4e19-9f84-e9da6d657dcc"}
    ```

    Returns ``{"uuid", "widget_type", "title", "props", "dataset_id",
    "changed_on"}``, or an error with ``error_type`` NotFound or Forbidden.
    Use ``get_widget_data`` with the same ``id`` to fetch its rows.
    """
    return _get_saved_widget_impl(request)
