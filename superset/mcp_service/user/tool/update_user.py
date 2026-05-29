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
from flask import current_app
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.exc import NoResultFound
from superset_core.mcp.decorators import tool, ToolAnnotations
from werkzeug.security import generate_password_hash

from superset.daos.user import UserDAO
from superset.extensions import (
    db,
    event_logger,
    security_manager,  # avoids superset.__init__ → create_app bootstrap
)
from superset.mcp_service.user.schemas import UpdateUserRequest, UpdateUserResponse


def _apply_field_updates(user: User, request: UpdateUserRequest) -> None:
    """Apply optional scalar field updates to the user model object."""
    if request.first_name is not None:
        user.first_name = request.first_name
    if request.last_name is not None:
        user.last_name = request.last_name
    if request.email is not None:
        user.email = request.email
    if request.active is not None:
        user.active = request.active
    if request.password is not None:
        user.password = generate_password_hash(
            password=request.password,
            method=current_app.config.get("FAB_PASSWORD_HASH_METHOD", "scrypt"),
            salt_length=current_app.config.get("FAB_PASSWORD_HASH_SALT_LENGTH", 16),
        )


@tool(
    tags=["mutate"],
    class_permission_name="User",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update an existing user account",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def update_user(request: UpdateUserRequest, ctx: Context) -> UpdateUserResponse:
    """Update an existing Superset user account. Admin access is required.

    Use this tool to modify a user's name, email, password, role assignments,
    or active status. Only the fields you supply are changed; omitted fields
    remain as-is.

    To discover available role IDs, query the Superset REST API:
    ``GET /api/v1/security/roles/``

    Note: in deployments where user identity is managed by an external
    provider (e.g. SSO / SCIM), role assignments may be overridden when
    the user next authenticates through that provider.
    """
    await ctx.info("Updating user: id=%d" % request.id)

    try:
        # Fetch the existing user record
        with event_logger.log_context(action="mcp.update_user.fetch"):
            try:
                user = UserDAO.get_by_id(request.id)
            except NoResultFound:
                await ctx.warning("User not found: id=%d" % request.id)
                return UpdateUserResponse(
                    error="User with id=%d not found." % request.id
                )

        # Resolve new roles if role_ids was supplied
        if request.role_ids is not None:
            with event_logger.log_context(action="mcp.update_user.resolve_roles"):
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
                    return UpdateUserResponse(
                        error="Role IDs not found: %s. "
                        "Valid role IDs are available from GET /api/v1/security/roles/"
                        % (missing_ids,)
                    )
            user.roles = roles

        _apply_field_updates(user, request)

        # Commit via FAB security manager to fire pre/post-commit signals
        with event_logger.log_context(action="mcp.update_user.update"):
            result = security_manager.update_user(user)

        if result is False:
            await ctx.error(
                "User update failed for id=%d — "
                "security_manager.update_user returned False" % request.id
            )
            return UpdateUserResponse(
                error="Failed to update user. "
                "The email may already be in use by another account."
            )

        await ctx.info("User updated: id=%s, username=%r" % (user.id, user.username))

        return UpdateUserResponse(
            id=user.id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
        )

    except Exception as exc:
        await ctx.error(
            "Unexpected error updating user: %s: %s" % (type(exc).__name__, str(exc))
        )
        raise
