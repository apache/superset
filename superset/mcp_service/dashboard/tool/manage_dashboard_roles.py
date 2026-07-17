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

Adds/removes role-based dashboard access via explicit operations. Companion
to ``manage_dashboard_owners`` — dashboard access roles are dropped from the
generic ``update_dashboard`` tool because a full-replacement access-control
list silently widens or narrows who can see a dashboard.

"Roles" are modeled as ROLE-type entries in the dashboard's Subject-based
``viewers`` list (apache/superset#38831 replaced the legacy
``roles``/``DASHBOARD_RBAC`` relationship with a unified Subject model
covering User/Role/Group, gated by the ``ENABLE_VIEWERS`` feature flag
instead of ``DASHBOARD_RBAC``). Any USER- or GROUP-type viewers already on
the dashboard are preserved untouched by this tool.
"""

import logging
from typing import TYPE_CHECKING

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import db, event_logger
from superset.mcp_service.dashboard.schemas import (
    ManageDashboardRolesRequest,
    ManageDashboardRolesResponse,
)
from superset.mcp_service.dashboard.tool.governance_utils import (
    dashboard_url,
    find_and_authorize_dashboard,
)
from superset.mcp_service.system.schemas import serialize_subject_object
from superset.subjects.types import SubjectType

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard
    from superset.subjects.models import Subject

logger: logging.Logger = logging.getLogger(__name__)


def _viewer_role_ids(dashboard: "Dashboard") -> list[int]:
    """Role IDs behind the dashboard's ROLE-type viewer subjects."""
    return [
        subject.role_id
        for subject in dashboard.viewers
        if subject.type == SubjectType.ROLE
    ]


def _other_viewers(dashboard: "Dashboard") -> list["Subject"]:
    """Non-ROLE-type viewers (USER/GROUP subjects), preserved untouched."""
    return [
        subject for subject in dashboard.viewers if subject.type != SubjectType.ROLE
    ]


def _compute_new_role_ids(
    dashboard: "Dashboard", request: ManageDashboardRolesRequest, viewers_enabled: bool
) -> tuple[list[int] | None, list[int] | None, ManageDashboardRolesResponse | None]:
    """Load current viewer roles and apply add/remove operations.

    Returns ``(current_role_ids, new_role_ids, None)`` on success or
    ``(None, None, error_response)`` when the initial lazy-load fails or a
    removal targets an unassigned role. The pre-call ``current_role_ids``
    is returned so the caller can report true added/removed deltas.
    """
    try:
        current_role_ids = _viewer_role_ids(dashboard)
    except SQLAlchemyError as db_err:
        logger.error(
            "Failed to load roles for dashboard %s: %s",
            request.identifier,
            db_err,
            exc_info=True,
        )
        return (
            None,
            None,
            ManageDashboardRolesResponse(
                viewers_enabled=viewers_enabled,
                error="Failed to load dashboard roles due to a database error.",
            ),
        )

    unknown_removals = sorted(set(request.remove_role_ids) - set(current_role_ids))
    if unknown_removals:
        return (
            None,
            None,
            ManageDashboardRolesResponse(
                viewers_enabled=viewers_enabled,
                error=(
                    f"Cannot remove role IDs that are not currently assigned: "
                    f"{unknown_removals}. Current role IDs: "
                    f"{sorted(current_role_ids)}."
                ),
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

    return current_role_ids, new_role_ids, None


def _resolve_role_subjects(
    new_role_ids: list[int],
) -> tuple[list["Subject"], list[int]]:
    """Resolve role IDs to ROLE-type Subjects, one at a time.

    Mirrors the owners tool's ``get_or_create_user_subject`` loop: a role
    that exists but has no synced Subject row yet is synced on demand
    instead of being misreported as nonexistent. Returns
    ``(resolved_subjects, missing_role_ids)`` where the latter contains
    only IDs with no matching role at all.
    """
    from superset.subjects.utils import get_or_create_role_subject

    resolved_role_subjects: list["Subject"] = []
    missing_role_ids: list[int] = []
    for role_id in new_role_ids:
        subject = get_or_create_role_subject(role_id)
        if subject is None:
            missing_role_ids.append(role_id)
        else:
            resolved_role_subjects.append(subject)
    return resolved_role_subjects, missing_role_ids


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
    Add or remove dashboard access roles with explicit operations.

    Dashboard access roles restrict who can view a dashboard to members of
    the listed roles, on top of normal Superset permissions. An empty roles
    list means "no role restriction" — the dashboard is visible per standard
    permissions instead. This only takes effect when the ``ENABLE_VIEWERS``
    feature flag is enabled; the response's ``viewers_enabled`` field
    reports whether it is, and ``warnings`` notes when a change was applied
    but has no live effect.

    Roles are the ROLE-type entries in the dashboard's Subject-based
    ``viewers`` list. Any USER- or GROUP-type viewers already on the
    dashboard are left untouched.

    Unlike ``update_dashboard``'s dropped ``roles`` field, this tool never
    accepts a full-replacement list — only
    ``add_role_ids``/``remove_role_ids``.

    Privacy: the returned ``roles`` list is sanctioned only as confirmation
    of the add/remove operation the caller explicitly requested on this
    dashboard. Do not use it to answer "who can access X" for a dashboard
    the caller did not ask to modify, and do not call this tool merely to
    look up current roles — those remain off-limits per the server
    instructions. A request that has no effective change (e.g. "adding" a
    role that is already assigned) returns an empty ``roles`` list rather
    than the full current set, so this tool cannot be used as a disguised
    directory lookup.

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

    dashboard, auth_error = find_and_authorize_dashboard(
        request.identifier, ManageDashboardRolesResponse
    )
    if auth_error is not None:
        return auth_error
    assert dashboard is not None  # narrows for mypy

    viewers_enabled = is_feature_enabled("ENABLE_VIEWERS")
    warnings: list[str] = []
    if not viewers_enabled:
        warnings.append(
            "The ENABLE_VIEWERS feature flag is disabled on this instance; "
            "dashboard viewers will be stored but have no effect on access "
            "control until it is enabled."
        )

    current_role_ids, new_role_ids, compute_error = _compute_new_role_ids(
        dashboard, request, viewers_enabled
    )
    if compute_error is not None:
        return compute_error
    assert current_role_ids is not None  # narrows for mypy
    assert new_role_ids is not None  # narrows for mypy

    # No-op short-circuit: skip the DB write and, more importantly, the
    # full roles list in the response — mirrors manage_dashboard_owners.
    # The roles list is only sanctioned as confirmation of an actual change
    # (see docstring); returning it for a request that changes nothing
    # would let a caller enumerate access roles via a disguised no-op
    # (e.g. "add" a role that is already assigned).
    if set(new_role_ids) == set(current_role_ids):
        ctx.info(f"Dashboard {dashboard.id} roles unchanged; no-op request.")
        return ManageDashboardRolesResponse(
            dashboard_url=dashboard_url(dashboard),
            viewers_enabled=viewers_enabled,
            warnings=warnings
            + ["No effective change: requested roles already match the current state."],
        )

    try:
        with event_logger.log_context(action="mcp.manage_dashboard_roles.apply"):
            other_viewers = _other_viewers(dashboard)

            resolved_role_subjects, missing_role_ids = _resolve_role_subjects(
                new_role_ids
            )
            if missing_role_ids:
                # Roll back any Subject rows _resolve_role_subjects already
                # flushed for earlier, valid role IDs so this all-or-nothing
                # request never leaves an uncommitted partial sync behind.
                db.session.rollback()  # pylint: disable=consider-using-transaction
                return ManageDashboardRolesResponse(
                    viewers_enabled=viewers_enabled,
                    error=(
                        f"One or more role IDs do not exist: "
                        f"{sorted(missing_role_ids)}. Use list_roles to "
                        "resolve valid role IDs."
                    ),
                )

            # Captured before commit so the final response never has to
            # dereference `dashboard.viewers` post-commit: SQLAlchemy
            # expires ORM attributes on commit, and a failed `refresh()`
            # below would otherwise leave a later `dashboard.viewers` read
            # free to raise an unhandled `SQLAlchemyError` from a broken
            # session.
            final_role_ids = {subject.role_id for subject in resolved_role_subjects}
            roles_response = [
                info
                for subject in resolved_role_subjects
                if (info := serialize_subject_object(subject)) is not None
            ]

            dashboard.viewers = other_viewers + resolved_role_subjects
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
            viewers_enabled=viewers_enabled,
            error="Failed to update dashboard roles due to a database error.",
        )

    ctx.info(f"Dashboard {dashboard.id} roles updated: {sorted(final_role_ids)}")

    return ManageDashboardRolesResponse(
        roles=roles_response,
        dashboard_url=dashboard_url(dashboard),
        # True deltas against the PRE-call state — not just membership in
        # the request — so a role that was already assigned (or already
        # absent) is never misreported as added/removed.
        added_role_ids=sorted(
            (final_role_ids & set(request.add_role_ids)) - set(current_role_ids)
        ),
        removed_role_ids=sorted(
            (set(request.remove_role_ids) & set(current_role_ids)) - final_role_ids
        ),
        viewers_enabled=viewers_enabled,
        warnings=warnings,
    )
