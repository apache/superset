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
MCP tool: add_native_filter

This tool adds a native filter to an existing dashboard by updating
the dashboard's json_metadata.native_filter_configuration.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal

from fastmcp import Context
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.exceptions import CommandException
from superset.extensions import event_logger
from superset.mcp_service.dashboard.schemas import (
    DashboardError,
    DashboardInfo,
    NativeFilterSummary,
)
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class AddNativeFilterRequest(BaseModel):
    """Request schema for adding a native filter to a dashboard."""

    dashboard_id: int = Field(
        ..., description="ID of the dashboard to add the filter to"
    )
    filter_name: str = Field(
        ...,
        description="Display name for the filter (e.g. 'Ngành hàng', 'Thị trường')",
    )
    filter_type: Literal[
        "filter_select",
        "filter_range",
        "filter_time",
        "filter_timecolumn",
        "filter_timegrain",
    ] = Field(
        ...,
        description=(
            "Type of native filter to create. "
            "filter_select: dropdown/multi-select for categorical columns. "
            "filter_range: numeric range slider. "
            "filter_time: date/time range picker. "
            "filter_timecolumn: select which time column to use. "
            "filter_timegrain: select time grain (day/week/month)."
        ),
    )
    dataset_id: int = Field(
        ..., description="ID of the dataset the filter targets"
    )
    column_name: str = Field(
        ...,
        description="Name of the column in the dataset to filter on",
    )
    default_value: Any = Field(
        default=None,
        description=(
            "Default selected value(s) for the filter. "
            "For filter_select with multiple_select=True, use a list. "
            "For filter_range, use a dict like {'min': 0, 'max': 100}."
        ),
    )
    parent_filter_ids: List[str] = Field(
        default_factory=list,
        description=(
            "List of parent native filter IDs for cascading filters. "
            "The parent filters must already exist on the dashboard."
        ),
    )
    scope_type: Literal["full", "specific"] = Field(
        default="full",
        description=(
            "Filter scope. 'full' applies the filter to all charts on the "
            "dashboard (default). 'specific' applies only to charts NOT in "
            "excluded_chart_ids."
        ),
    )
    excluded_chart_ids: List[int] = Field(
        default_factory=list,
        description=(
            "Chart IDs to exclude from this filter's scope. "
            "Only used when scope_type='specific'."
        ),
    )
    enable_search: bool = Field(
        default=True,
        description="Enable search in select filter dropdown (filter_select only)",
    )
    multiple_select: bool = Field(
        default=True,
        description="Allow selecting multiple values (filter_select only)",
    )


class AddNativeFilterResponse(BaseModel):
    """Response schema for adding a native filter."""

    filter_id: str | None = Field(
        None, description="ID of the newly created native filter"
    )
    filter_name: str | None = Field(
        None, description="Display name of the created filter"
    )
    filter_type: str | None = Field(
        None, description="Type of the created filter"
    )
    native_filters: List[NativeFilterSummary] = Field(
        default_factory=list,
        description="Updated list of all native filters on the dashboard",
    )
    dashboard_id: int | None = Field(
        None, description="ID of the updated dashboard"
    )
    dashboard_url: str | None = Field(
        None, description="URL to view the updated dashboard"
    )
    error: str | None = Field(
        None, description="Error message if operation failed"
    )


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _generate_filter_id() -> str:
    """Generate a unique native filter ID matching Superset's frontend format."""
    return f"NATIVE_FILTER-{uuid.uuid4().hex[:20]}"


def _build_scope(
    scope_type: str,
    excluded_chart_ids: List[int],
) -> Dict[str, Any]:
    """Build the scope object for a native filter.

    Args:
        scope_type: 'full' for all charts, 'specific' for excluding some.
        excluded_chart_ids: Chart IDs to exclude when scope_type='specific'.

    Returns:
        Scope dict compatible with Superset's native filter format.
    """
    if scope_type == "specific" and excluded_chart_ids:
        return {
            "rootPath": ["ROOT_ID"],
            "excluded": excluded_chart_ids,
        }
    # Default: apply to all charts
    return {
        "rootPath": ["ROOT_ID"],
        "excluded": [0],
    }


def _build_control_values(
    filter_type: str,
    enable_search: bool,
    multiple_select: bool,
) -> Dict[str, Any]:
    """Build controlValues for the filter based on its type."""
    if filter_type == "filter_select":
        return {
            "enableEmptyFilter": False,
            "defaultToFirstItem": False,
            "multiSelect": multiple_select,
            "searchAllOptions": enable_search,
            "inverseSelection": False,
        }
    elif filter_type == "filter_range":
        return {
            "enableEmptyFilter": False,
        }
    elif filter_type in ("filter_time", "filter_timecolumn", "filter_timegrain"):
        return {}
    return {}


def _build_default_data_mask(
    filter_type: str,
    default_value: Any,
) -> Dict[str, Any]:
    """Build defaultDataMask for the filter."""
    if default_value is None:
        return {
            "filterState": {},
            "extraFormData": {},
        }

    if filter_type == "filter_select":
        # default_value should be a list or single value
        values = default_value if isinstance(default_value, list) else [default_value]
        return {
            "filterState": {"value": values},
            "extraFormData": {
                "filters": [
                    {
                        "col": None,  # Will be set by Superset frontend
                        "op": "IN",
                        "val": values,
                    }
                ]
            },
        }
    elif filter_type == "filter_range":
        # default_value should be dict with min/max
        filter_state = {}
        if isinstance(default_value, dict):
            filter_state = {"value": [default_value.get("min"), default_value.get("max")]}
        return {
            "filterState": filter_state,
            "extraFormData": {},
        }
    elif filter_type == "filter_time":
        return {
            "filterState": {"value": default_value},
            "extraFormData": {"time_range": default_value},
        }
    return {
        "filterState": {},
        "extraFormData": {},
    }


def _build_native_filter_config(
    request: AddNativeFilterRequest,
    filter_id: str,
) -> Dict[str, Any]:
    """Build the complete native filter configuration dict."""
    return {
        "id": filter_id,
        "name": request.filter_name,
        "filterType": request.filter_type,
        "targets": [
            {
                "datasetId": request.dataset_id,
                "column": {"name": request.column_name},
            }
        ],
        "scope": _build_scope(request.scope_type, request.excluded_chart_ids),
        "controlValues": _build_control_values(
            request.filter_type, request.enable_search, request.multiple_select
        ),
        "defaultDataMask": _build_default_data_mask(
            request.filter_type, request.default_value
        ),
        "cascadeParentIds": list(request.parent_filter_ids),
        "type": "NATIVE_FILTER",
        "description": "",
        "chartsInScope": [],
        "tabsInScope": [],
    }


def _extract_native_filter_summaries(
    native_filter_configuration: List[Dict[str, Any]],
) -> List[NativeFilterSummary]:
    """Convert raw native filter configs to NativeFilterSummary objects."""
    summaries = []
    for f in native_filter_configuration:
        if not isinstance(f, dict):
            continue
        raw_targets = f.get("targets", [])
        if not isinstance(raw_targets, list):
            raw_targets = []
        targets = [t for t in raw_targets if isinstance(t, dict)]
        summaries.append(
            NativeFilterSummary(
                id=f.get("id"),
                name=f.get("name"),
                filter_type=f.get("filterType"),
                targets=targets,
            )
        )
    return summaries


# ---------------------------------------------------------------------------
# MCP Tool
# ---------------------------------------------------------------------------


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Add native filter to dashboard",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def add_native_filter(
    request: AddNativeFilterRequest, ctx: Context
) -> AddNativeFilterResponse:
    """Add a native filter to an existing dashboard.

    Creates a new native filter (dropdown, range slider, time picker, etc.)
    on the specified dashboard. The filter targets a specific column in a
    dataset and can be scoped to all charts or specific charts.

    Supported filter types:
    - filter_select: Dropdown/multi-select for categorical columns
    - filter_range: Numeric range slider
    - filter_time: Date/time range picker
    - filter_timecolumn: Select which time column to use
    - filter_timegrain: Select time grain (day/week/month)

    Example usage:
    ```json
    {
        "dashboard_id": 2,
        "filter_name": "Ngành hàng",
        "filter_type": "filter_select",
        "dataset_id": 38,
        "column_name": "nganh_hang"
    }
    ```

    With cascading filters:
    ```json
    {
        "dashboard_id": 2,
        "filter_name": "Thị trường",
        "filter_type": "filter_select",
        "dataset_id": 38,
        "column_name": "market_type",
        "parent_filter_ids": ["NATIVE_FILTER-abc123"]
    }
    ```
    """
    logger.info(
        "Adding native filter to dashboard: dashboard_id=%s, filter_name=%s, "
        "filter_type=%s, dataset_id=%s, column=%s",
        request.dashboard_id,
        request.filter_name,
        request.filter_type,
        request.dataset_id,
        request.column_name,
    )

    try:
        from superset import db, security_manager
        from superset.commands.dashboard.update import UpdateDashboardCommand
        from superset.daos.dashboard import DashboardDAO
        from superset.exceptions import SupersetSecurityException

        # --- Step 1: Validate dashboard exists and user has permission ---
        with event_logger.log_context(action="mcp.add_native_filter.validation"):
            dashboard = DashboardDAO.find_by_id(request.dashboard_id)
            if not dashboard:
                return AddNativeFilterResponse(
                    error=f"Dashboard with ID {request.dashboard_id} not found"
                )

            try:
                security_manager.raise_for_ownership(dashboard)
            except SupersetSecurityException:
                return AddNativeFilterResponse(
                    error=(
                        f"You don't have permission to edit dashboard "
                        f"'{dashboard.dashboard_title}' (ID: {request.dashboard_id}). "
                        "Only dashboard owners can add filters."
                    )
                )

            # --- Step 2: Validate dataset exists ---
            from superset.models.slice import Slice
            from superset.connectors.sqla.models import SqlaTable

            dataset = db.session.get(SqlaTable, request.dataset_id)
            if not dataset:
                return AddNativeFilterResponse(
                    error=f"Dataset with ID {request.dataset_id} not found"
                )

        # --- Step 3: Generate filter ID and build config ---
        with event_logger.log_context(action="mcp.add_native_filter.build"):
            filter_id = _generate_filter_id()

            logger.info("Generated filter ID: %s", filter_id)

            filter_config = _build_native_filter_config(request, filter_id)

            # Read existing json_metadata
            existing_metadata = json.loads(dashboard.json_metadata or "{}")
            native_filter_configuration = existing_metadata.get(
                "native_filter_configuration", []
            )

            # Validate parent filter IDs exist
            if request.parent_filter_ids:
                existing_filter_ids = {
                    f.get("id")
                    for f in native_filter_configuration
                    if isinstance(f, dict) and f.get("id")
                }
                missing_parents = [
                    pid
                    for pid in request.parent_filter_ids
                    if pid not in existing_filter_ids
                ]
                if missing_parents:
                    return AddNativeFilterResponse(
                        error=(
                            f"Parent filter IDs not found on dashboard: "
                            f"{', '.join(missing_parents)}. "
                            "Parent filters must already exist on the dashboard."
                        )
                    )

            # Append new filter
            native_filter_configuration.append(filter_config)
            existing_metadata["native_filter_configuration"] = native_filter_configuration

        # --- Step 4: Persist changes via UpdateDashboardCommand ---
        with event_logger.log_context(action="mcp.add_native_filter.db_write"):
            update_data = {
                "json_metadata": json.dumps(existing_metadata),
            }

            command = UpdateDashboardCommand(request.dashboard_id, update_data)
            updated_dashboard = command.run()

            logger.info(
                "Native filter '%s' added successfully to dashboard %s",
                request.filter_name, request.dashboard_id
            )

        # --- Step 5: Build response ---
        # Use the metadata we just saved to return accurate summaries,
        # avoiding accessing updated_dashboard which may be detached from the session.
        updated_filters = existing_metadata.get("native_filter_configuration", [])

        dashboard_url = (
            f"{get_superset_base_url()}/superset/dashboard/{request.dashboard_id}/"
        )

        return AddNativeFilterResponse(
            filter_id=filter_id,
            filter_name=request.filter_name,
            filter_type=request.filter_type,
            native_filters=_extract_native_filter_summaries(updated_filters),
            dashboard_id=request.dashboard_id,
            dashboard_url=dashboard_url,
            error=None,
        )

    except (CommandException, SQLAlchemyError, KeyError, ValueError) as e:
        from superset import db

        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning(
                "Database rollback failed during error handling", exc_info=True
            )
        logger.error("Error adding native filter to dashboard: %s", e)
        return AddNativeFilterResponse(
            error=f"Failed to add native filter: {str(e)}"
        )
    except Exception as e:
        logger.error(
            "Unexpected error adding native filter: dashboard_id=%s, error=%s, "
            "error_type=%s", request.dashboard_id, str(e), type(e).__name__
        )
        return AddNativeFilterResponse(
            error=f"Failed to add native filter: {str(e)}"
        )
