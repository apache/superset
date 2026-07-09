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
Manage dashboard access roles FastMCP tool

Adds/removes DASHBOARD_RBAC access roles via explicit operations. Companion
to ``manage_dashboard_owners`` — dashboard roles are dropped from the
generic ``update_dashboard`` tool because a full-replacement access-control
list silently widens or narrows who can see a dashboard.
"""

import logging
from typing import Any

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.commands.exceptions import RolesNotFoundValidationError
from superset.exceptions import SupersetSecurityException
from superset.extensions import db, event_logger
from superset.mcp_service.dashboard.schemas import (
    ManageDashboardRolesRequest,
    ManageDashboardRolesResponse,
    serialize_role_object,
)
from superset.mcp_service.utils.url_utils import get_superset_base_url

logger = logging.getLogger(__name__)


def _find_and_authorize_dashboard(
    identifier: int | str,
) -> tuple[Any, ManageDashboardRolesResponse | None]:
    """Return (dashboard, None) on success or (None, error_response) on failure.

    Mirrors the helper in ``update_dashboard``: avoids ImportError before
    Flask app initialisation by co-locating the imports it needs with the
    call site rather than importing them at module load time.
    """
    from superset import security_manager
    from superset.daos.dashboard import DashboardDAO

    try:
        dashboard = DashboardDAO.get_by_id_or_slug(identifier)
    except (DashboardNotFoundError, SQLAlchemyError):
        return None, ManageDashboardRolesResponse(
            error=f"Dashboard not found: {identifier!r}",
        )

    if dashboard is None:
        return None, ManageDashboardRolesResponse(
            error=f"Dashboard not found: {identifier!r}",
        )

    try:
        security_manager.raise_for_ownership(dashboard)
    except SupersetSecurityException:
        return None, ManageDashboardRolesResponse(
            permission_denied=True,
            error=(
                f"You don't have permission to edit dashboard "
                f"'{dashboard.dashboard_title}' (ID: {dashboard.id})."
            ),
        )

    return dashboard, None


def _dashboard_url(dashboard: Any) -> str:
    """Build the user-facing dashboard URL, preferring slug over id."""
    return (
        f"{get_superset_base_url()}/superset/dashboard/"
        f"{dashboard.slug or dashboard.id}/"
    )


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Manage dashboard access roles",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
def manage_dashboard_roles(
    request: ManageDashboardRolesRequest, ctx: Context
) -> ManageDashboardRolesResponse:
    """
    Add or remove dashboard RBAC access roles with explicit operations.

    Dashboard roles (DASHBOARD_RBAC) restrict who can view a dashboard to
    members of the listed roles, on top of normal Superset permissions. An
    empty roles list means "no role restriction" — the dashboard is visible
    per standard permissions instead. This only takes effect when the
    ``DASHBOARD_RBAC`` feature flag is enabled; the response's
    ``dashboard_rbac_enabled`` field reports whether it is, and ``warnings``
    notes when a change was applied but has no live effect.

    Unlike ``update_dashboard``'s dropped ``roles`` field, this tool never
    accepts a full-replacement list — only
    ``add_role_ids``/``remove_role_ids``.

    Privacy: the returned ``roles`` list is sanctioned only as confirmation
    of the add/remove operation the caller explicitly requested on this
    dashboard. Do not use it to answer "who can access X" for a dashboard
    the caller did not ask to modify, and do not call this tool merely to
    look up current roles — those remain off-limits per the server
    instructions.

    Example::

        manage_dashboard_roles(request={
            "identifier": 42,
            "add_role_ids": [5],
        })
    """
    from superset import is_feature_enabled

    ctx.info(
        f"Managing dashboard roles: identifier={request.identifier} "
        f"add={request.add_role_ids} remove={request.remove_role_ids}"
    )

    dashboard, auth_error = _find_and_authorize_dashboard(request.identifier)
    if auth_error is not None:
        return auth_error

    dashboard_rbac_enabled = is_feature_enabled("DASHBOARD_RBAC")
    warnings: list[str] = []
    if not dashboard_rbac_enabled:
        warnings.append(
            "The DASHBOARD_RBAC feature flag is disabled on this instance; "
            "dashboard roles will be stored but have no effect on access "
            "control until it is enabled."
        )

    current_role_ids = [role.id for role in dashboard.roles]

    unknown_removals = sorted(set(request.remove_role_ids) - set(current_role_ids))
    if unknown_removals:
        return ManageDashboardRolesResponse(
            dashboard_rbac_enabled=dashboard_rbac_enabled,
            error=(
                f"Cannot remove role IDs that are not currently assigned: "
                f"{unknown_removals}. Current role IDs: "
                f"{sorted(current_role_ids)}."
            ),
        )

    new_role_ids = [
        role_id
        for role_id in current_role_ids
        if role_id not in request.remove_role_ids
    ]
    for role_id in request.add_role_ids:
        if role_id not in new_role_ids:
            new_role_ids.append(role_id)

    try:
        with event_logger.log_context(action="mcp.manage_dashboard_roles.apply"):
            from superset.commands.utils import populate_roles

            try:
                resolved_roles = populate_roles(new_role_ids)
            except RolesNotFoundValidationError:
                return ManageDashboardRolesResponse(
                    dashboard_rbac_enabled=dashboard_rbac_enabled,
                    error=(
                        f"One or more role IDs do not exist: "
                        f"{request.add_role_ids}. Use list_roles to resolve "
                        "valid role IDs."
                    ),
                )

            dashboard.roles = resolved_roles
            db.session.commit()  # pylint: disable=consider-using-transaction
            try:
                db.session.refresh(dashboard)
            except SQLAlchemyError:
                logger.warning(
                    "Dashboard %s roles updated but refresh failed; "
                    "continuing with current values",
                    dashboard.id,
                    exc_info=True,
                )

    except SQLAlchemyError as db_err:
        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning(
                "Database rollback failed during error handling",
                exc_info=True,
            )
        logger.error("Dashboard roles update failed: %s", db_err, exc_info=True)
        return ManageDashboardRolesResponse(
            dashboard_rbac_enabled=dashboard_rbac_enabled,
            error="Failed to update dashboard roles due to a database error.",
        )

    final_role_ids = {role.id for role in dashboard.roles}
    ctx.info(f"Dashboard {dashboard.id} roles updated: {sorted(final_role_ids)}")

    return ManageDashboardRolesResponse(
        roles=[
            info
            for role in dashboard.roles
            if (info := serialize_role_object(role)) is not None
        ],
        dashboard_url=_dashboard_url(dashboard),
        added_role_ids=sorted(final_role_ids & set(request.add_role_ids)),
        removed_role_ids=[
            role_id
            for role_id in request.remove_role_ids
            if role_id not in final_role_ids
        ],
        dashboard_rbac_enabled=dashboard_rbac_enabled,
        warnings=warnings,
    )
