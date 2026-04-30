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

"""Generate bug report tool for MCP service."""

import datetime
import logging
import platform

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.system.schemas import (
    GenerateBugReportRequest,
    GenerateBugReportResponse,
)
from superset.utils.version import get_version_metadata

logger = logging.getLogger(__name__)


@tool(
    tags=["core"],
    annotations=ToolAnnotations(
        title="Generate bug report",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def generate_bug_report(
    request: GenerateBugReportRequest, ctx: Context
) -> GenerateBugReportResponse:
    """
    Generate a formatted bug report for the Superset MCP service.

    Produces a structured bug report including system information,
    user-provided details, and optionally an mcp_call_id for
    server-side log correlation.
    """
    await ctx.info("Generating bug report: summary=%s" % (request.summary,))

    with event_logger.log_context(action="mcp.generate_bug_report"):
        version_metadata = get_version_metadata()
        version = version_metadata.get("version_string", "unknown")

        sections = [
            "## Bug Report",
            "",
            f"**Date**: {datetime.datetime.now(tz=datetime.timezone.utc).isoformat()}",
            f"**Superset Version**: {version}",
            f"**Python Version**: {platform.python_version()}",
            f"**Platform**: {platform.system()}",
        ]

        if request.mcp_call_id:
            sections.append(f"**MCP Call ID**: {request.mcp_call_id}")

        sections.extend(
            [
                "",
                "### Summary",
                request.summary,
                "",
                "### Steps to Reproduce",
                request.steps_to_reproduce,
                "",
                "### Expected Behavior",
                request.expected_behavior,
                "",
                "### Actual Behavior",
                request.actual_behavior,
            ]
        )

        report = "\n".join(sections)

    return GenerateBugReportResponse(
        report=report,
        mcp_call_id=request.mcp_call_id,
    )
