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
MCP tools for Dynamic (Handlebars) dashboards.

create_dynamic_dashboard: create a dashboard with a DYNAMIC Handlebars component.
get_dynamic_dashboard_config: read the Handlebars template and slots.
update_dynamic_dashboard: update the template, slots, or title.
"""

import logging
from typing import Any, Optional

from fastmcp import Context
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import db
from superset.mcp_service.dashboard.constants import generate_id
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)

_DEFAULT_COMPONENT_WIDTH = 12
_DEFAULT_COMPONENT_HEIGHT = 50


class _SlotConfig(BaseModel):
    name: str = Field(description="Handlebars partial name and context key")
    formData: dict[str, Any] = Field(description="Superset chart form_data for this slot's query")
    template: str = Field(description="Handlebars partial template string")


class _CreateRequest(BaseModel):
    dashboard_title: str = Field(description="Title for the new dashboard")
    dashboard_template: str = Field(description="Root Handlebars template")
    slots: list[_SlotConfig] = Field(
        description="Dataset slots with name, formData, and partial template"
    )
    json_metadata: Optional[dict[str, Any]] = Field(
        default=None, description="Optional dashboard json_metadata"
    )


class _CreateResponse(BaseModel):
    dashboard_id: Optional[int] = None
    dashboard_url: Optional[str] = None
    error: Optional[str] = None


def _build_layout(dyn_id: str, row_id: str) -> dict[str, Any]:
    return {
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
        "GRID_ID": {
            "type": "GRID", "id": "GRID_ID",
            "children": [row_id], "parents": ["ROOT_ID"],
        },
        row_id: {
            "type": "ROW", "id": row_id,
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
            "children": [dyn_id], "parents": ["ROOT_ID", "GRID_ID"],
        },
        dyn_id: {
            "type": "DYNAMIC", "id": dyn_id,
            "meta": {
                "componentKey": "handlebars-dashboard",
                "width": _DEFAULT_COMPONENT_WIDTH,
                "height": _DEFAULT_COMPONENT_HEIGHT,
            },
            "children": [], "parents": ["ROOT_ID", "GRID_ID", row_id],
        },
        "DASHBOARD_VERSION_KEY": "v2",
    }


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Create Dynamic dashboard",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
def create_dynamic_dashboard(
    request: _CreateRequest, ctx: Context
) -> _CreateResponse:
    """Create a dashboard with a Handlebars DYNAMIC component.

    The dashboardTemplate can reference slots via {{> slotName}} partials and
    {{slotName.data}} context.

    Available helpers:
        {{formatNumber value}}, {{eq a b}}, {{ne a b}}, {{gt a b}}, {{gte a b}},
        {{lt a b}}, {{lte a b}}, {{and a b}}, {{or a b}}, {{not a}},
        {{add a b}}, {{subtract a b}}, {{multiply a b}}

    HTML sanitization strips <script>, <button>, onclick. Use CSS for interactivity.
    Every id='x' becomes id='user-content-x' in the DOM.
    """
    try:
        from flask import g
        from superset.models.dashboard import Dashboard
        from superset.models.dynamic_dashboard import DynamicDashboardConfig

        dyn_id = generate_id("DYNAMIC")
        row_id = generate_id("ROW")
        layout = _build_layout(dyn_id, row_id)

        default_metadata: dict[str, Any] = {
            "filter_scopes": {},
            "expanded_slices": {},
            "refresh_frequency": 0,
            "color_scheme": None,
            "cross_filters_enabled": False,
            "native_filter_configuration": [],
            "chart_configuration": {},
        }
        json_metadata_str = json.dumps(
            request.json_metadata if request.json_metadata is not None else default_metadata
        )

        dashboard = Dashboard()
        dashboard.dashboard_title = request.dashboard_title
        dashboard.json_metadata = json_metadata_str
        dashboard.position_json = json.dumps(layout)
        dashboard.published = True

        # Assign current user as owner
        if getattr(g, "user", None) and hasattr(g.user, "id"):
            dashboard.owners = [g.user]

        db.session.add(dashboard)
        db.session.flush()

        config = DynamicDashboardConfig(
            dashboard_id=dashboard.id,
            template=request.dashboard_template,
            slots=json.dumps([s.model_dump() for s in request.slots]),
        )
        db.session.add(config)
        db.session.commit()

        url = f"{get_superset_base_url()}/superset/dashboard/{dashboard.id}/"
        logger.info("Created Dynamic dashboard %s", dashboard.id)
        return _CreateResponse(dashboard_id=dashboard.id, dashboard_url=url)

    except SQLAlchemyError as e:
        try:
            db.session.rollback()
        except SQLAlchemyError:
            pass
        logger.error("Failed to create Dynamic dashboard: %s", e, exc_info=True)
        return _CreateResponse(error="Database error. See server logs.")


# ---------------------------------------------------------------------------
# get_dynamic_dashboard_config
# ---------------------------------------------------------------------------


class _GetRequest(BaseModel):
    dashboard_id: int = Field(description="ID of the Dynamic dashboard")


class _GetResponse(BaseModel):
    dashboard_id: Optional[int] = None
    dashboard_title: Optional[str] = None
    dashboard_template: Optional[str] = None
    slots: Optional[list[dict[str, Any]]] = None
    version: Optional[int] = None
    error: Optional[str] = None


@tool(
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Get Dynamic dashboard config",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
def get_dynamic_dashboard_config(
    request: _GetRequest, ctx: Context
) -> _GetResponse:
    """Return the Handlebars template and slot configuration of a Dynamic dashboard."""
    try:
        from superset.models.dashboard import Dashboard
        from superset.models.dynamic_dashboard import DynamicDashboardConfig

        dashboard = db.session.query(Dashboard).filter_by(id=request.dashboard_id).first()
        if not dashboard:
            return _GetResponse(error=f"Dashboard {request.dashboard_id} not found")

        config = (
            db.session.query(DynamicDashboardConfig)
            .filter_by(dashboard_id=request.dashboard_id)
            .first()
        )
        if not config:
            return _GetResponse(error=f"Dashboard {request.dashboard_id} has no Dynamic config")

        slots = json.loads(config.slots) if config.slots else []
        return _GetResponse(
            dashboard_id=dashboard.id,
            dashboard_title=dashboard.dashboard_title,
            dashboard_template=config.template,
            slots=slots,
            version=config.version,
        )
    except Exception as e:
        logger.error("Failed to get config: %s", e, exc_info=True)
        return _GetResponse(error=str(e))


# ---------------------------------------------------------------------------
# update_dynamic_dashboard
# ---------------------------------------------------------------------------


class _UpdateRequest(BaseModel):
    dashboard_id: int = Field(description="ID of the Dynamic dashboard to update")
    dashboard_title: Optional[str] = Field(default=None, description="New title")
    dashboard_template: Optional[str] = Field(default=None, description="New template")
    slots: Optional[list[_SlotConfig]] = Field(default=None, description="New slots")


class _UpdateResponse(BaseModel):
    dashboard_id: Optional[int] = None
    dashboard_url: Optional[str] = None
    version: Optional[int] = None
    error: Optional[str] = None


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Update Dynamic dashboard",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
def update_dynamic_dashboard(
    request: _UpdateRequest, ctx: Context
) -> _UpdateResponse:
    """Update the template, slots, or title of a Dynamic dashboard.

    All fields are optional — only provided fields are changed.
    """
    try:
        from superset.models.dashboard import Dashboard
        from superset.models.dynamic_dashboard import DynamicDashboardConfig

        dashboard = db.session.query(Dashboard).filter_by(id=request.dashboard_id).first()
        if not dashboard:
            return _UpdateResponse(error=f"Dashboard {request.dashboard_id} not found")

        config = (
            db.session.query(DynamicDashboardConfig)
            .filter_by(dashboard_id=request.dashboard_id)
            .first()
        )
        if not config:
            return _UpdateResponse(error=f"Dashboard {request.dashboard_id} has no Dynamic config")

        if request.dashboard_title is not None:
            dashboard.dashboard_title = request.dashboard_title
        if request.dashboard_template is not None:
            config.template = request.dashboard_template
        if request.slots is not None:
            config.slots = json.dumps([s.model_dump() for s in request.slots])

        config.version = config.version + 1
        db.session.commit()

        url = f"{get_superset_base_url()}/superset/dashboard/{dashboard.id}/"
        logger.info("Updated Dynamic dashboard %s (v%s)", dashboard.id, config.version)
        return _UpdateResponse(
            dashboard_id=dashboard.id, dashboard_url=url, version=config.version
        )
    except SQLAlchemyError as e:
        try:
            db.session.rollback()
        except SQLAlchemyError:
            pass
        logger.error("Failed to update: %s", e, exc_info=True)
        return _UpdateResponse(error="Database error. See server logs.")
