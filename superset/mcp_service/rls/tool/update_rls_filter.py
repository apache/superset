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
from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.rls.schemas import (
    RLSFilterResponse,
    UpdateRLSFilterRequest,
)

logger = logging.getLogger(__name__)


def _build_update_properties(
    request: UpdateRLSFilterRequest, existing: Any
) -> dict[str, object]:
    """Build the properties dict for UpdateRLSRuleCommand from a partial request.

    Omitted fields default to their current values from ``existing`` so the
    caller only needs to specify what changed.
    """
    set_fields = request.model_fields_set
    properties: dict[str, object] = {}

    for field in ("name", "filter_type", "clause"):
        value = getattr(request, field)
        if field in set_fields and value is not None:
            properties[field] = value

    for field in ("group_key", "description"):
        if field in set_fields:
            properties[field] = getattr(request, field)

    if "tables" in set_fields and request.tables is not None:
        properties["tables"] = request.tables
    else:
        properties["tables"] = [t.id for t in getattr(existing, "tables", [])]

    if "roles" in set_fields and request.roles is not None:
        properties["roles"] = request.roles
    else:
        properties["roles"] = [r.id for r in getattr(existing, "roles", [])]

    return properties


@tool(
    tags=["mutate"],
    class_permission_name="Row Level Security",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update RLS filter",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
async def update_rls_filter(
    request: UpdateRLSFilterRequest, ctx: Context
) -> RLSFilterResponse:
    """Update an existing row-level security (RLS) filter rule.

    Only the fields you provide are updated; omitted fields retain their
    current values. To explicitly clear a list field, pass an empty list
    (e.g. tables=[] removes all table associations).

    Use create_rls_filter to create a new rule, or find the rule id from
    the Row Level Security admin page.
    """
    await ctx.info("Updating RLS filter: id=%s" % (request.id,))

    try:
        from superset.commands.exceptions import (
            DatasourceNotFoundValidationError,
            RolesNotFoundValidationError,
        )
        from superset.commands.security.exceptions import RLSRuleNotFoundError
        from superset.commands.security.update import UpdateRLSRuleCommand
        from superset.daos.security import RLSDAO

        existing = RLSDAO.find_by_id(request.id)
        if not existing:
            await ctx.warning("RLS filter not found: id=%s" % (request.id,))
            return RLSFilterResponse(
                id=None,
                error=f"RLS filter with id={request.id} not found.",
            )

        properties = _build_update_properties(request, existing)

        with event_logger.log_context(action="mcp.update_rls_filter.update"):
            rls_rule = UpdateRLSRuleCommand(request.id, properties).run()

        table_ids = [t.id for t in getattr(rls_rule, "tables", [])]
        role_ids = [r.id for r in getattr(rls_rule, "roles", [])]

        await ctx.info(
            "RLS filter updated: id=%s, name=%r" % (rls_rule.id, rls_rule.name)
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

    except RLSRuleNotFoundError:
        await ctx.warning("RLS filter not found: id=%s" % (request.id,))
        return RLSFilterResponse(
            id=None,
            error=f"RLS filter with id={request.id} not found.",
        )
    except RolesNotFoundValidationError as exc:
        await ctx.warning("Role not found while updating RLS filter: %s" % (str(exc),))
        return RLSFilterResponse(id=None, error=str(exc))
    except DatasourceNotFoundValidationError as exc:
        await ctx.warning("Table not found while updating RLS filter: %s" % (str(exc),))
        return RLSFilterResponse(id=None, error=str(exc))
    except Exception as exc:
        await ctx.error(
            "Unexpected error updating RLS filter: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
