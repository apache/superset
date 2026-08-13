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
MCP tool: render_handlebars_sidecar

Renders a Dynamic dashboard's Handlebars template server-side via the
Node.js sidecar, without needing a browser. Returns compiled HTML so
the agent can verify the template works before the user sees it.
"""

import logging
from typing import Any, Optional

import requests
from fastmcp import Context
from flask import current_app
from pydantic import BaseModel, Field
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import db
from superset.utils import json

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 15


class _RenderSidecarRequest(BaseModel):
    dashboard_id: int = Field(description="ID of the Dynamic dashboard to render")
    capture_screenshot: bool = Field(
        default=False,
        description="If true, capture a screenshot as base64 PNG",
    )


class _RenderSidecarResponse(BaseModel):
    dashboard_id: int
    rendered_html: Optional[str] = None
    screenshot_base64: Optional[str] = None
    render_time_ms: Optional[int] = None
    error: Optional[str] = None


def _get_sidecar_url() -> str:
    return current_app.config.get(
        "HANDLEBARS_SIDECAR_URL", "http://localhost:3031"
    )


@tool(
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Render Dynamic dashboard (sidecar)",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
def render_handlebars_sidecar(
    request: _RenderSidecarRequest, ctx: Context
) -> _RenderSidecarResponse:
    """Render a Dynamic dashboard template server-side via the Node.js sidecar.

    Compiles the Handlebars template with the same helpers the frontend uses
    and returns the rendered HTML. Use this to verify templates compile
    correctly before the user sees them.

    Note: this does NOT apply HTML sanitization or CSS — it returns the raw
    compiled output. Use render_dynamic_dashboard (Playwright) for full
    browser rendering with sanitization.
    """
    try:
        from superset.models.dynamic_dashboard import DynamicDashboardConfig

        # Load the config from DB
        config = (
            db.session.query(DynamicDashboardConfig)
            .filter_by(dashboard_id=request.dashboard_id)
            .first()
        )
        if not config:
            return _RenderSidecarResponse(
                dashboard_id=request.dashboard_id,
                error=f"No Dynamic dashboard config for dashboard {request.dashboard_id}",
            )

        slots_data = json.loads(config.slots) if config.slots else []

        # Execute each slot's query to get real data, same as the frontend.
        from superset.mcp_service.chart.chart_helpers import (
            build_query_context_from_form_data,
        )

        slot_errors = []
        sidecar_slots = []
        for slot in slots_data:
            slot_data: list = []
            slot_columns: list = []
            try:
                form_data = slot.get("formData", {})
                qc = build_query_context_from_form_data(form_data, row_limit=100)
                # Execute the query context directly
                payload = qc.get_payload()
                if payload and len(payload["queries"]) > 0:
                    query_result = payload["queries"][0]
                    slot_data = query_result.get("data", [])
                    slot_columns = query_result.get("colnames", [])
            except Exception as slot_err:
                error_msg = f"Slot '{slot.get('name')}': {slot_err}"
                logger.warning("Failed to fetch data for slot: %s", error_msg)
                slot_errors.append(error_msg)

            sidecar_slots.append({
                "name": slot["name"],
                "data": slot_data,
                "columns": slot_columns,
                "template": slot.get("template", ""),
            })

        sidecar_url = _get_sidecar_url()

        # Pass the sanitization schema overrides from config so the
        # sidecar applies the same rules as the browser.
        schema_overrides = current_app.config.get(
            "HTML_SANITIZATION_SCHEMA_EXTENSIONS", {}
        )

        try:
            resp = requests.post(
                f"{sidecar_url}/api/v1/render-handlebars",
                json={
                    "template": config.template,
                    "slots": sidecar_slots,
                    "capture_screenshot": request.capture_screenshot,
                    "sanitization_schema_overrides": schema_overrides,
                },
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        except requests.exceptions.ConnectionError:
            return _RenderSidecarResponse(
                dashboard_id=request.dashboard_id,
                error="Handlebars sidecar unavailable. Is it running on port 3031?",
            )
        except requests.exceptions.Timeout:
            return _RenderSidecarResponse(
                dashboard_id=request.dashboard_id,
                error="Handlebars sidecar request timed out",
            )

        if resp.status_code != 200:
            return _RenderSidecarResponse(
                dashboard_id=request.dashboard_id,
                error=f"Sidecar returned status {resp.status_code}: {resp.text[:500]}",
            )

        result = resp.json()
        sidecar_error = result.get("error")
        if slot_errors and not sidecar_error:
            sidecar_error = "Slot data errors: " + "; ".join(slot_errors)
        return _RenderSidecarResponse(
            dashboard_id=request.dashboard_id,
            rendered_html=result.get("rendered_html"),
            screenshot_base64=result.get("screenshot_base64"),
            render_time_ms=result.get("render_time_ms"),
            error=sidecar_error,
        )

    except Exception as e:
        logger.error("Failed to render via sidecar: %s", e, exc_info=True)
        return _RenderSidecarResponse(
            dashboard_id=request.dashboard_id,
            error=str(e),
        )
