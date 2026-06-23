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

"""
MCP Resources for schema discovery.

These resources provide static metadata about available columns, filters,
and sorting options for chart, dataset, and dashboard models.
LLM clients can use these resources to understand what parameters are valid
without making API calls.
"""

import logging
from typing import Any

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook

logger = logging.getLogger(__name__)


def _build_schema_resource(model_type: str) -> dict[str, Any]:
    """Build schema resource data for a model type."""
    from superset.mcp_service.common.schema_discovery import (
        CHART_DEFAULT_COLUMNS,
        CHART_SEARCH_COLUMNS,
        CHART_SORTABLE_COLUMNS,
        DASHBOARD_DEFAULT_COLUMNS,
        DASHBOARD_SEARCH_COLUMNS,
        DASHBOARD_SORTABLE_COLUMNS,
        DATASET_DEFAULT_COLUMNS,
        DATASET_SEARCH_COLUMNS,
        DATASET_SORTABLE_COLUMNS,
        get_all_column_names,
        get_chart_columns,
        get_dashboard_columns,
        get_dataset_columns,
    )

    def _safe_col_dict(col: Any) -> dict[str, Any]:
        """Safely extract column metadata for JSON serialization."""
        return {
            "name": str(getattr(col, "name", "")),
            "description": str(getattr(col, "description", "") or ""),
            "type": str(getattr(col, "type", "") or ""),
        }

    # Get columns dynamically from models
    chart_columns = get_chart_columns()
    dataset_columns = get_dataset_columns()
    dashboard_columns = get_dashboard_columns()

    schemas = {
        "chart": {
            "model_type": "chart",
            "select_columns": [_safe_col_dict(col) for col in chart_columns],
            "all_column_names": get_all_column_names(chart_columns),
            "default_columns": CHART_DEFAULT_COLUMNS,
            "sortable_columns": CHART_SORTABLE_COLUMNS,
            "search_columns": CHART_SEARCH_COLUMNS,
            "default_sort": "changed_on",
            "default_sort_direction": "desc",
        },
        "dataset": {
            "model_type": "dataset",
            "select_columns": [_safe_col_dict(col) for col in dataset_columns],
            "all_column_names": get_all_column_names(dataset_columns),
            "default_columns": DATASET_DEFAULT_COLUMNS,
            "sortable_columns": DATASET_SORTABLE_COLUMNS,
            "search_columns": DATASET_SEARCH_COLUMNS,
            "default_sort": "changed_on",
            "default_sort_direction": "desc",
        },
        "dashboard": {
            "model_type": "dashboard",
            "select_columns": [_safe_col_dict(col) for col in dashboard_columns],
            "all_column_names": get_all_column_names(dashboard_columns),
            "default_columns": DASHBOARD_DEFAULT_COLUMNS,
            "sortable_columns": DASHBOARD_SORTABLE_COLUMNS,
            "search_columns": DASHBOARD_SEARCH_COLUMNS,
            "default_sort": "changed_on",
            "default_sort_direction": "desc",
        },
    }

    return schemas.get(model_type, {})


@mcp.resource("superset://schema/chart")
@mcp_auth_hook
def get_chart_schema_resource() -> str:
    """
    Schema metadata for chart model.

    Returns comprehensive information about:
    - Available columns for select_columns parameter
    - Default columns returned when select_columns is not specified
    - Sortable columns for order_column parameter
    - Search columns used by the search parameter

    Use this resource to understand what columns are valid for chart queries.
    """
    from superset.utils import json

    return json.dumps(_build_schema_resource("chart"), indent=2)


@mcp.resource("superset://schema/dataset")
@mcp_auth_hook
def get_dataset_schema_resource() -> str:
    """
    Schema metadata for dataset model.

    Returns comprehensive information about:
    - Available columns for select_columns parameter
    - Default columns returned when select_columns is not specified
    - Sortable columns for order_column parameter
    - Search columns used by the search parameter

    Use this resource to understand what columns are valid for dataset queries.
    """
    from superset.utils import json

    return json.dumps(_build_schema_resource("dataset"), indent=2)


@mcp.resource("superset://schema/dashboard")
@mcp_auth_hook
def get_dashboard_schema_resource() -> str:
    """
    Schema metadata for dashboard model.

    Returns comprehensive information about:
    - Available columns for select_columns parameter
    - Default columns returned when select_columns is not specified
    - Sortable columns for order_column parameter
    - Search columns used by the search parameter

    Use this resource to understand what columns are valid for dashboard queries.
    """
    from superset.utils import json

    return json.dumps(_build_schema_resource("dashboard"), indent=2)


@mcp.resource("superset://schema/all")
@mcp_auth_hook
def get_all_schemas_resource() -> str:
    """
    Combined schema metadata for all model types (chart, dataset, dashboard).

    Returns comprehensive information in a single resource, reducing the need
    for multiple resource fetches. Includes:
    - Available columns for select_columns parameter
    - Default columns returned when select_columns is not specified
    - Sortable columns for order_column parameter
    - Search columns used by the search parameter

    Use this resource when you need schema info for multiple model types.
    """
    from superset.utils import json

    all_schemas = {
        "chart": _build_schema_resource("chart"),
        "dataset": _build_schema_resource("dataset"),
        "dashboard": _build_schema_resource("dashboard"),
        "metadata": {
            "description": "Schema discovery metadata for Superset MCP service",
            "usage": {
                "select_columns": "Use these column names in the select_columns "
                "parameter to control which fields are returned",
                "sortable_columns": "Use these column names in the order_column "
                "parameter to sort results",
                "search_columns": "These columns are searched when using the search "
                "parameter",
                "default_columns": "These columns are returned when select_columns "
                "is not specified",
            },
        },
    }

    return json.dumps(all_schemas, indent=2)
