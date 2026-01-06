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

from superset.mcp_service.auth import has_dataset_access
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


@tool(tags=["core"])
@parse_request(GetEmbeddableChartRequest)
async def get_embeddable_chart(
    request: GetEmbeddableChartRequest,
    ctx: Context,
) -> GetEmbeddableChartResponse:
    """Create an embeddable chart iframe URL with guest token authentication.

    This tool creates an ephemeral chart visualization that can be embedded
    in external applications via iframe. The chart is configured via form_data
    and stored as a permalink with TTL.

    IMPORTANT:
    - The iframe_html can be directly embedded in web pages
    - Guest token must be passed to the iframe for authentication
    - Chart expires after ttl_minutes (default: 60 minutes)

    Example usage:
    ```json
    {
        "datasource_id": 123,
        "viz_type": "echarts_timeseries_line",
        "form_data": {
            "metrics": ["count"],
            "groupby": ["category"],
            "time_range": "Last 7 days"
        },
        "ttl_minutes": 120,
        "height": 500
    }
    ```

    Returns iframe_url, guest_token, and ready-to-use iframe_html snippet.
    """
    await ctx.info(
        f"Creating embeddable chart: datasource_id={request.datasource_id}, "
        f"viz_type={request.viz_type}"
    )

    try:
        # Import here to avoid circular imports
        from superset.commands.explore.permalink.create import (
            CreateExplorePermalinkCommand,
        )
        from superset.daos.dataset import DatasetDAO
        from superset.extensions import security_manager
        from superset.security.guest_token import GuestTokenResourceType

        # Resolve dataset
        dataset = None
        if isinstance(request.datasource_id, int) or (
            isinstance(request.datasource_id, str) and request.datasource_id.isdigit()
        ):
            dataset_id = (
                int(request.datasource_id)
                if isinstance(request.datasource_id, str)
                else request.datasource_id
            )
            dataset = DatasetDAO.find_by_id(dataset_id)
        else:
            # Try UUID lookup
            dataset = DatasetDAO.find_by_id(request.datasource_id, id_column="uuid")

        if not dataset:
            await ctx.error(f"Dataset not found: {request.datasource_id}")
            return GetEmbeddableChartResponse(
                success=False,
                error=f"Dataset not found: {request.datasource_id}",
            )

        # Check access
        if not has_dataset_access(dataset):
            await ctx.error("Access denied to dataset")
            return GetEmbeddableChartResponse(
                success=False,
                error="Access denied to dataset",
            )

        # Build complete form_data
        form_data = {
            **request.form_data,
            "viz_type": request.viz_type,
            "datasource": f"{dataset.id}__table",
        }

        # Apply overrides if provided
        if request.form_data_overrides:
            form_data.update(request.form_data_overrides)

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
        iframe_html = f"""<iframe
    src="{iframe_url}"
    width="100%"
    height="{request.height}px"
    frameborder="0"
    data-guest-token="{guest_token}"
    sandbox="allow-scripts allow-same-origin allow-popups"
></iframe>
<script>
    // Pass guest token to iframe on load
    (function() {{
        var iframe = document.currentScript.previousElementSibling;
        iframe.addEventListener('load', function() {{
            var channel = new MessageChannel();
            iframe.contentWindow.postMessage({{
                type: '__embedded_comms__',
                handshake: 'port transfer'
            }}, '{base_url}', [channel.port2]);
            channel.port1.onmessage = function(event) {{
                if (event.data && event.data.type === 'guestToken') {{
                    channel.port1.postMessage({{
                        type: 'guestToken',
                        guestToken: '{guest_token}'
                    }});
                }}
            }};
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
