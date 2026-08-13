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
MCP tool: render_dynamic_dashboard

Renders a Dynamic dashboard in a headless browser via Playwright and returns
the rendered HTML and any errors, giving the agent a feedback loop.
"""

import base64
import logging
import os
from typing import Optional

from fastmcp import Context
from pydantic import BaseModel, Field
from superset_core.mcp.decorators import tool, ToolAnnotations


logger = logging.getLogger(__name__)

_RENDER_TIMEOUT_MS = 30_000
_DYNAMIC_COMPONENT_SELECTOR = '[data-test="dashboard-component-chart-holder"]'


class _RenderRequest(BaseModel):
    dashboard_id: int = Field(description="ID of the Dynamic dashboard to render")
    capture_screenshot: bool = Field(
        default=False,
        description="If true, capture a screenshot as base64 PNG",
    )


class _RenderResponse(BaseModel):
    dashboard_id: int
    rendered_html: Optional[str] = None
    error_text: Optional[str] = None
    screenshot_base64: Optional[str] = None
    page_title: Optional[str] = None
    render_time_ms: Optional[int] = None
    error: Optional[str] = None


@tool(
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Render Dynamic dashboard",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
def render_dynamic_dashboard(
    request: _RenderRequest, ctx: Context
) -> _RenderResponse:
    """Render a Dynamic dashboard in a headless browser and return the result.

    Opens the dashboard in headless Chromium, waits for the HandlebarsDashboard
    component to finish rendering, and returns:
    - rendered_html: the inner HTML of the rendered DYNAMIC component
    - error_text: any error message visible on the page
    - screenshot_base64: optional base64 PNG screenshot

    Use this after create_dynamic_dashboard or update_dynamic_dashboard to
    verify the template renders correctly. If you see errors, fix and retry.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return _RenderResponse(
            dashboard_id=request.dashboard_id,
            error="Playwright not installed. Run: pip install playwright && playwright install chromium",
        )

    import time as _time

    start_time = _time.time()
    base_url = os.environ.get("SUPERSET_BASE_URL", "http://localhost:8088").rstrip("/")
    dashboard_url = f"{base_url}/superset/dashboard/{request.dashboard_id}/"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Authenticate using the same mechanism as reports/screenshots:
            # MachineAuthProvider generates a valid session cookie via Flask's
            # login_user() inside a test request context — no form submission needed.
            from flask import g
            from superset.extensions import machine_auth_provider_factory, security_manager

            username = "admin"
            user = security_manager.find_user(username=username)
            if not user:
                return _RenderResponse(
                    dashboard_id=request.dashboard_id,
                    error=f"User '{username}' not found",
                )

            machine_auth_provider_factory.instance.authenticate_browser_context(
                context, user
            )

            logger.info("Rendering dashboard %s at %s", request.dashboard_id, dashboard_url)
            page.goto(dashboard_url, wait_until="domcontentloaded", timeout=_RENDER_TIMEOUT_MS)

            # Wait for the DYNAMIC component to appear and have content
            try:
                page.wait_for_selector(
                    _DYNAMIC_COMPONENT_SELECTOR,
                    timeout=_RENDER_TIMEOUT_MS,
                )
                # Wait until the component has actual content (not empty, not just "Loading...")
                page.wait_for_function(
                    """(selector) => {
                        const el = document.querySelector(selector);
                        if (!el) return false;
                        const text = el.textContent || '';
                        return text.length > 0 && text.trim() !== 'Loading...';
                    }""",
                    arg=_DYNAMIC_COMPONENT_SELECTOR,
                    timeout=_RENDER_TIMEOUT_MS,
                )
            except Exception:
                pass

            # Extra settle time for rendering
            page.wait_for_timeout(3000)

            # Capture content
            rendered_html = None
            error_text = None

            # Check for errors in <pre> tags within the component
            error_elements = page.query_selector_all(f"{_DYNAMIC_COMPONENT_SELECTOR} pre")
            if error_elements:
                error_texts = [el.text_content() or "" for el in error_elements]
                error_text = "\n".join(t for t in error_texts if t.strip())

            # Get rendered HTML
            component = page.query_selector(_DYNAMIC_COMPONENT_SELECTOR)
            if component:
                rendered_html = component.inner_html()

            # Screenshot if requested
            screenshot_base64 = None
            if request.capture_screenshot:
                screenshot_bytes = page.screenshot(full_page=True)
                screenshot_base64 = base64.b64encode(screenshot_bytes).decode("utf-8")

            page_title = page.title()

            context.close()
            browser.close()

            return _RenderResponse(
                dashboard_id=request.dashboard_id,
                rendered_html=rendered_html,
                error_text=error_text if error_text else None,
                screenshot_base64=screenshot_base64,
                page_title=page_title,
                render_time_ms=int((_time.time() - start_time) * 1000),
            )

    except Exception as e:
        logger.error("Failed to render dashboard %s: %s", request.dashboard_id, e, exc_info=True)
        return _RenderResponse(
            dashboard_id=request.dashboard_id,
            error=f"Render failed: {e}",
        )
