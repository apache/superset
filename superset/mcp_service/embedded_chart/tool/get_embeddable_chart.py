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
MCP tool: get_embeddable_chart

Creates an embeddable chart iframe with guest token authentication.
This enables AI agents to generate charts that can be displayed in
external applications via iframe.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastmcp import Context
from flask import g
from superset_core.mcp import tool

from superset.mcp_service.chart.chart_utils import (
    map_config_to_form_data,
    resolve_dataset,
)
from superset.mcp_service.embedded_chart.schemas import (
    GetEmbeddableChartRequest,
    GetEmbeddableChartResponse,
)
from superset.mcp_service.utils.schema_utils import parse_request
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.security.guest_token import (
    GuestTokenResource,
    GuestTokenRlsRule,
    GuestTokenUser,
)

logger = logging.getLogger(__name__)

# Minimum read permissions the guest role needs for embedded charts to work.
# Same requirement as embedded dashboards — the guest role must be able to
# read chart metadata and query chart data.
_REQUIRED_GUEST_PERMISSIONS: list[tuple[str, str]] = [
    ("can_read", "Chart"),
    ("can_read", "Dataset"),
    ("can_read", "CurrentUserRestApi"),
    ("can_read", "ChartDataRestApi"),
]


def _ensure_guest_role_permissions() -> list[str]:
    """Ensure the guest role has minimum permissions for embedded charts.

    Checks the role configured by GUEST_ROLE_NAME (defaults to "Public")
    and adds any missing read permissions. This is idempotent — already
    present permissions are skipped.

    Returns a list of permissions that were added (empty if none needed).
    """
    from flask import current_app

    from superset.extensions import db, security_manager

    role_name = current_app.config.get("GUEST_ROLE_NAME", "Public")
    role = security_manager.find_role(role_name)
    if role is None:
        logger.warning(
            "Guest role '%s' not found, skipping permission setup", role_name
        )
        return []

    added: list[str] = []
    for perm_name, view_name in _REQUIRED_GUEST_PERMISSIONS:
        pv = security_manager.find_permission_view_menu(perm_name, view_name)
        if pv is None:
            security_manager.add_permission_view_menu(perm_name, view_name)
            pv = security_manager.find_permission_view_menu(perm_name, view_name)
        if pv and pv not in role.permissions:
            security_manager.add_permission_role(role, pv)
            added.append(f"{perm_name} on {view_name}")

    if added:
        db.session.commit()
        logger.info(
            "Added %d permissions to guest role '%s': %s",
            len(added),
            role_name,
            ", ".join(added),
        )

    return added


@tool(tags=["core"])
@parse_request(GetEmbeddableChartRequest)
async def get_embeddable_chart(
    request: GetEmbeddableChartRequest,
    ctx: Context,
) -> GetEmbeddableChartResponse:
    """Create an embeddable chart iframe URL with guest token authentication.

    This tool creates an ephemeral chart visualization that can be embedded
    in external applications via iframe. Uses the same simplified ChartConfig
    schema as generate_chart for consistency.

    Config Types:
    - chart_type='xy': For line, bar, area, scatter charts
    - chart_type='table': For tabular data display

    Example 1 - Bar chart (sales by genre):
    ```json
    {
        "datasource_id": 22,
        "config": {
            "chart_type": "xy",
            "x": {"name": "genre"},
            "y": [{"name": "sales", "aggregate": "SUM"}],
            "kind": "bar"
        }
    }
    ```

    Example 2 - Line chart (time series):
    ```json
    {
        "datasource_id": 123,
        "config": {
            "chart_type": "xy",
            "x": {"name": "created_at"},
            "y": [{"name": "count", "aggregate": "COUNT"}],
            "kind": "line"
        }
    }
    ```

    Example 3 - Table chart:
    ```json
    {
        "datasource_id": 22,
        "config": {
            "chart_type": "table",
            "columns": [
                {"name": "genre"},
                {"name": "sales", "aggregate": "SUM"}
            ]
        }
    }
    ```

    Returns iframe_url, guest_token, and ready-to-use iframe_html snippet.
    """
    await ctx.info(
        f"Creating embeddable chart: datasource_id={request.datasource_id}, "
        f"chart_type={request.config.chart_type}"
    )

    try:
        # Import here to avoid circular imports
        from superset.commands.explore.permalink.create import (
            CreateExplorePermalinkCommand,
        )
        from superset.extensions import security_manager
        from superset.security.guest_token import GuestTokenResourceType

        # Ensure the guest role has minimum permissions for embedded charts
        added_perms = _ensure_guest_role_permissions()
        if added_perms:
            await ctx.info(
                f"Auto-configured guest role with {len(added_perms)} permissions: "
                f"{', '.join(added_perms)}"
            )

        # Resolve dataset using shared utility
        dataset, error = resolve_dataset(request.datasource_id)
        if error or dataset is None:
            error_msg = error or f"Dataset not found: {request.datasource_id}"
            await ctx.error(error_msg)
            return GetEmbeddableChartResponse(success=False, error=error_msg)

        # Map simplified config to Superset form_data (same as generate_chart)
        form_data = map_config_to_form_data(request.config)
        form_data["datasource"] = f"{dataset.id}__table"

        # Create permalink with allowed_domains for referrer validation
        state = {
            "formData": form_data,
            "allowedDomains": request.allowed_domains,
        }
        permalink_key = CreateExplorePermalinkCommand(state).run()

        await ctx.debug(f"Created permalink: {permalink_key}")

        # Calculate expiration
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=request.ttl_minutes)

        # Generate guest token
        username = g.user.username if hasattr(g, "user") and g.user else "anonymous"
        guest_user: GuestTokenUser = {
            "username": f"mcp_embed_{username}",
            "first_name": "MCP",
            "last_name": "Embed User",
        }

        resources: list[GuestTokenResource] = [
            {
                "type": GuestTokenResourceType.CHART_PERMALINK,
                "id": permalink_key,
            }
        ]

        # Convert request rls_rules to GuestTokenRlsRule format
        rls_rules: list[GuestTokenRlsRule] = [
            {"dataset": rule.get("dataset"), "clause": rule.get("clause", "")}
            for rule in request.rls_rules
        ]

        guest_token_result = security_manager.create_guest_access_token(
            user=guest_user,
            resources=resources,
            rls=rls_rules,
        )

        # Handle both bytes (older PyJWT) and string (PyJWT 2.0+)
        guest_token = (
            guest_token_result.decode("utf-8")
            if isinstance(guest_token_result, bytes)
            else guest_token_result
        )

        # Build URLs
        base_url = get_superset_base_url()
        iframe_url = f"{base_url}/embedded/chart/?permalink_key={permalink_key}"

        # Generate iframe HTML snippet
        # Embedded charts use direct postMessage (not MessageChannel handshake)
        iframe_html = f"""<iframe
    src="{iframe_url}"
    width="100%"
    height="{request.height}px"
    frameborder="0"
    data-guest-token="{guest_token}"
    sandbox="allow-scripts allow-same-origin allow-popups"
></iframe>
<script>
    // Send guest token to embedded chart iframe on load
    (function() {{
        var iframe = document.currentScript.previousElementSibling;
        iframe.addEventListener('load', function() {{
            iframe.contentWindow.postMessage({{
                type: '__embedded_comms__',
                guestToken: '{guest_token}'
            }}, '{base_url}');
        }});
    }})();
</script>"""

        await ctx.info(f"Embeddable chart created successfully: {permalink_key}")

        return GetEmbeddableChartResponse(
            success=True,
            iframe_url=iframe_url,
            guest_token=guest_token,
            iframe_html=iframe_html,
            permalink_key=permalink_key,
            expires_at=expires_at,
        )

    except Exception as ex:
        logger.exception("Failed to create embeddable chart: %s", ex)
        await ctx.error(f"Failed to create embeddable chart: {ex}")
        return GetEmbeddableChartResponse(
            success=False,
            error=str(ex),
        )
