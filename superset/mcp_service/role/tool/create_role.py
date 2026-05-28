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
from superset.mcp_service.role.schemas import CreateRoleRequest, CreateRoleResponse

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="security",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create a new role",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_role(request: CreateRoleRequest, ctx: Context) -> CreateRoleResponse:
    """Create a new FAB role, optionally assigning PermissionView IDs.

    Admin-only. Use this when you need to provision a new role in Superset's
    role-based access control system. The created role starts with no
    permissions unless ``permission_ids`` are supplied.

    Workflow:
    1. Call this tool with a unique role name
    2. Optionally supply ``permission_ids`` to pre-assign permissions
    3. Use the returned ``id`` to reference the role in downstream operations
    """
    await ctx.info(
        "Creating role: name=%r, permission_ids=%s"
        % (request.name, request.permission_ids)
    )

    try:
        # Reject creation if role already exists
        existing = security_manager.find_role(request.name)
        if existing is not None:
            await ctx.warning("Role already exists: name=%r" % (request.name,))
            return CreateRoleResponse(
                error=f"Role '{request.name}' already exists (id={existing.id})."
            )

        with event_logger.log_context(action="mcp.create_role.create"):
            role = security_manager.add_role(request.name)

        if request.permission_ids:
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

            with event_logger.log_context(action="mcp.create_role.assign_permissions"):
                role.permissions = pvms
                db.session.commit()

        await ctx.info("Role created: id=%s, name=%r" % (role.id, role.name))
        return CreateRoleResponse(id=role.id, name=role.name)

    except Exception as exc:
        await ctx.error(
            "Unexpected error creating role: %s: %s" % (type(exc).__name__, str(exc))
        )
        raise
