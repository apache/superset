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
from flask_appbuilder.security.sqla.models import PermissionView
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import security_manager
from superset.extensions import db, event_logger
from superset.mcp_service.role.schemas import UpdateRoleRequest, UpdateRoleResponse

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="security",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update an existing role",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
async def update_role(request: UpdateRoleRequest, ctx: Context) -> UpdateRoleResponse:
    """Update an existing FAB role's name and/or permission assignments.

    Admin-only. Use this when you need to rename a role or change its
    PermissionView assignments. When ``permission_ids`` is supplied it
    replaces the full existing permission set — partial updates are not
    supported.

    Workflow:
    1. Call with the role ``id`` to update
    2. Supply ``name`` to rename the role (must be unique)
    3. Supply ``permission_ids`` to replace all existing permissions
    4. Omit a field to leave it unchanged
    """
    await ctx.info(
        "Updating role: id=%s, name=%r, permission_ids=%s"
        % (request.id, request.name, request.permission_ids)
    )

    try:
        roles = security_manager.find_roles_by_id([request.id])
        if not roles:
            await ctx.warning("Role not found: id=%s" % (request.id,))
            return UpdateRoleResponse(error=f"Role with id={request.id} not found.")

        role = roles[0]

        if request.name is not None:
            existing = security_manager.find_role(request.name)
            if existing is not None and existing.id != role.id:
                await ctx.warning("Role name already in use: name=%r" % (request.name,))
                return UpdateRoleResponse(
                    error=(
                        f"Role name '{request.name}' is already in use"
                        f" (id={existing.id})."
                    )
                )
            role.name = request.name

        if request.permission_ids is not None:
            pvms = (
                db.session.query(PermissionView)
                .filter(PermissionView.id.in_(request.permission_ids))
                .all()
            )
            found_ids = {pvm.id for pvm in pvms}
            missing = set(request.permission_ids) - found_ids
            if missing:
                await ctx.warning(
                    "Some permission_ids not found and will be skipped: %s"
                    % sorted(missing)
                )
            role.permissions = pvms

        with event_logger.log_context(action="mcp.update_role.commit"):
            db.session.commit()  # pylint: disable=consider-using-transaction

        await ctx.info("Role updated: id=%s, name=%r" % (role.id, role.name))
        return UpdateRoleResponse(id=role.id, name=role.name)

    except Exception as exc:
        await ctx.error(
            "Unexpected error updating role: %s: %s" % (type(exc).__name__, str(exc))
        )
        raise
