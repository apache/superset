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

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.rls.schemas import (
    CreateRLSFilterRequest,
    RLSFilterResponse,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Row Level Security",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create RLS filter",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_rls_filter(
    request: CreateRLSFilterRequest, ctx: Context
) -> RLSFilterResponse:
    """Create a row-level security (RLS) filter rule.

    RLS filters restrict which rows users can see based on their role membership.
    Use this to enforce data access policies at the row level.

    Filter types:
    - "Regular": Applies the clause only to users with the specified roles
      (those roles see only matching rows; all other users see all rows).
    - "Base": Applies the clause to ALL users EXCEPT users with the specified
      roles (those roles bypass the filter and see all rows).

    Workflow:
    1. Use list_datasets to find the table IDs to protect.
    2. Look up role IDs from the Superset Roles admin page (/roles/list/).
    3. Call this tool with the SQL WHERE clause to enforce.
    """
    await ctx.info(
        "Creating RLS filter: name=%r, filter_type=%r, tables=%s"
        % (request.name, request.filter_type, request.tables)
    )

    try:
        from superset.commands.exceptions import (
            DatasourceNotFoundValidationError,
            RolesNotFoundValidationError,
        )
        from superset.commands.security.create import CreateRLSRuleCommand

        properties: dict[str, object] = {
            "name": request.name,
            "filter_type": request.filter_type,
            "tables": request.tables,
            "roles": request.roles,
            "clause": request.clause,
        }
        if request.group_key is not None:
            properties["group_key"] = request.group_key
        if request.description is not None:
            properties["description"] = request.description

        with event_logger.log_context(action="mcp.create_rls_filter.create"):
            rls_rule = CreateRLSRuleCommand(properties).run()

        table_ids = [t.id for t in getattr(rls_rule, "tables", [])]
        role_ids = [r.id for r in getattr(rls_rule, "roles", [])]

        await ctx.info(
            "RLS filter created: id=%s, name=%r" % (rls_rule.id, rls_rule.name)
        )

        return RLSFilterResponse(
            id=rls_rule.id,
            name=rls_rule.name,
            filter_type=rls_rule.filter_type,
            clause=rls_rule.clause,
            tables=table_ids,
            roles=role_ids,
            group_key=getattr(rls_rule, "group_key", None),
            description=getattr(rls_rule, "description", None),
        )

    except RolesNotFoundValidationError as exc:
        await ctx.warning("Role not found while creating RLS filter: %s" % (str(exc),))
        return RLSFilterResponse(
            id=None,
            name=request.name,
            filter_type=request.filter_type,
            clause=request.clause,
            tables=request.tables,
            roles=request.roles,
            error=str(exc),
        )
    except DatasourceNotFoundValidationError as exc:
        await ctx.warning("Table not found while creating RLS filter: %s" % (str(exc),))
        return RLSFilterResponse(
            id=None,
            name=request.name,
            filter_type=request.filter_type,
            clause=request.clause,
            tables=request.tables,
            roles=request.roles,
            error=str(exc),
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error creating RLS filter: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
