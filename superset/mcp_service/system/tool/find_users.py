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

"""find_users MCP tool: resolve a person's name to user IDs for filtering."""

import logging

from fastmcp import Context
from sqlalchemy import or_
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import db, event_logger, security_manager
from superset.mcp_service.system.schemas import (
    FindUsersRequest,
    FindUsersResponse,
    UserMatch,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["core"],
    annotations=ToolAnnotations(
        title="Find users",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def find_users(request: FindUsersRequest, ctx: Context) -> FindUsersResponse:
    """Resolve a person's name to user IDs so they can be used as filter values.

    Use this when the caller asks "show me <person>'s dashboards/charts/datasets"
    or "what is <person> working on". Take the matching user.id and pass it as
    the value for a created_by_fk or changed_by_fk filter on list_dashboards,
    list_charts, or list_datasets.

    Matches case-insensitively against username, first_name, last_name, and
    email. The query is required and non-empty; this tool does not enumerate
    the full user directory.

    Privacy: returning a user's identity here is sanctioned only for resolving
    filter values. Do not use the response to answer "who owns X", "who can
    access X", or any access-list question — those remain off-limits per the
    server instructions.
    """
    await ctx.info(
        "Resolving user query: query=%s, page_size=%s"
        % (request.query, request.page_size)
    )

    user_model = security_manager.user_model
    needle = f"%{request.query.strip()}%"

    with event_logger.log_context(action="mcp.find_users.query"):
        query = (
            db.session.query(user_model)
            .filter(
                or_(
                    user_model.username.ilike(needle),
                    user_model.first_name.ilike(needle),
                    user_model.last_name.ilike(needle),
                    user_model.email.ilike(needle),
                )
            )
            .order_by(user_model.username.asc())
        )
        # Fetch one extra row to detect truncation without a separate count query.
        rows = query.limit(request.page_size + 1).all()

    truncated = len(rows) > request.page_size
    rows = rows[: request.page_size]

    users: list[UserMatch] = [
        UserMatch(
            id=getattr(row, "id", None),
            username=getattr(row, "username", None),
            first_name=getattr(row, "first_name", None),
            last_name=getattr(row, "last_name", None),
        )
        for row in rows
    ]

    await ctx.info(
        "Resolved user query: matches=%s, truncated=%s" % (len(users), truncated)
    )
    return FindUsersResponse(users=users, count=len(users), truncated=truncated)
