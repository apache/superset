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

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import (
    db,
    event_logger,
    security_manager,  # avoids superset.__init__ → create_app bootstrap
)
from superset.mcp_service.user.schemas import CreateUserRequest, CreateUserResponse


@tool(
    tags=["mutate"],
    class_permission_name="User",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create a new user account",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_user(request: CreateUserRequest, ctx: Context) -> CreateUserResponse:
    """Create a new Superset user account. Admin access is required.

    Use this tool to provision a new user with a username, name, email,
    password, and one or more roles. After creation, the user can log in
    with the supplied credentials.

    To discover available role IDs, query the Superset REST API:
    ``GET /api/v1/security/roles/``

    Note: in deployments where user identity is managed by an external
    provider (e.g. SSO / SCIM), role assignments may be overridden when
    the user next authenticates through that provider.
    """
    await ctx.info(
        "Creating user: username=%r, role_ids=%s" % (request.username, request.role_ids)
    )

    try:
        # Resolve role objects from the supplied IDs
        with event_logger.log_context(action="mcp.create_user.resolve_roles"):
            roles = []
            missing_ids = []
            for role_id in request.role_ids:
                role = db.session.get(security_manager.role_model, role_id)
                if role is None:
                    missing_ids.append(role_id)
                else:
                    roles.append(role)

            if missing_ids:
                await ctx.warning("Role IDs not found: %s" % (missing_ids,))
                return CreateUserResponse(
                    error="Role IDs not found: %s. "
                    "Valid role IDs are available from GET /api/v1/security/roles/"
                    % (missing_ids,)
                )

        # Create the user via FAB security manager
        with event_logger.log_context(action="mcp.create_user.create"):
            user = security_manager.add_user(
                username=request.username,
                first_name=request.first_name,
                last_name=request.last_name,
                email=request.email,
                role=roles,
                password=request.password,
            )

        if not user:
            await ctx.error(
                "User creation failed for username=%r — "
                "security_manager.add_user returned False" % (request.username,)
            )
            return CreateUserResponse(
                error="Failed to create user. "
                "The username or email may already be in use."
            )

        await ctx.info("User created: id=%s, username=%r" % (user.id, user.username))

        # Return only non-sensitive fields (no email, password, roles)
        return CreateUserResponse(
            id=user.id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
        )

    except Exception as exc:
        await ctx.error(
            "Unexpected error creating user: %s: %s" % (type(exc).__name__, str(exc))
        )
        raise
