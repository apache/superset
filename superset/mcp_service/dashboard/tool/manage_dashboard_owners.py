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
Manage dashboard owners FastMCP tool

Adds/removes dashboard owners via explicit operations, guarding against the
"empty owners" footgun that the generic ``update_dashboard`` tool
deliberately does not expose (a full-replacement ``owners``/``editors`` list
has no "keep >=1 owner" guard of its own — ``populate_subject_list``'s
``ensure_no_lockout`` only re-adds the CALLER, it does not prevent an admin
from emptying the list outright).

"Owners" are modeled as USER-type entries in the dashboard's Subject-based
``editors`` list (apache/superset#38831 replaced the legacy ``owners``
relationship with a unified Subject model covering User/Role/Group). Any
ROLE- or GROUP-type editors already on the dashboard are preserved
untouched by this tool.
"""

import logging
from typing import Any

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.exceptions import SupersetSecurityException
from superset.extensions import db, event_logger
from superset.mcp_service.dashboard.schemas import (
    ManageDashboardOwnersRequest,
    ManageDashboardOwnersResponse,
)
from superset.mcp_service.system.schemas import serialize_subject_object
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.subjects.exceptions import SubjectsNotFoundValidationError
from superset.subjects.types import SubjectType

logger = logging.getLogger(__name__)


def _find_and_authorize_dashboard(
    identifier: int | str,
) -> tuple[Any, ManageDashboardOwnersResponse | None]:
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
        return None, ManageDashboardOwnersResponse(
            error=f"Dashboard not found: {identifier!r}",
        )

    if dashboard is None:
        return None, ManageDashboardOwnersResponse(
            error=f"Dashboard not found: {identifier!r}",
        )

    try:
        security_manager.raise_for_editorship(dashboard)
    except SupersetSecurityException:
        return None, ManageDashboardOwnersResponse(
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


def _owner_user_ids(dashboard: Any) -> list[int]:
    """User IDs behind the dashboard's USER-type editor subjects."""
    return [
        subject.user_id
        for subject in dashboard.editors
        if subject.type == SubjectType.USER
    ]


def _other_editors(dashboard: Any) -> list[Any]:
    """Non-USER-type editors (ROLE/GROUP subjects), preserved untouched."""
    return [
        subject for subject in dashboard.editors if subject.type != SubjectType.USER
    ]


def _compute_new_owner_ids(
    current_owner_ids: list[int], request: ManageDashboardOwnersRequest
) -> tuple[list[int] | None, ManageDashboardOwnersResponse | None]:
    """Apply add/remove operations and validate the result.

    Returns ``(new_owner_ids, None)`` on success or ``(None, error_response)``
    when a removal targets a non-owner or the result would be empty.
    """
    unknown_removals = sorted(set(request.remove_owner_ids) - set(current_owner_ids))
    if unknown_removals:
        return None, ManageDashboardOwnersResponse(
            error=(
                f"Cannot remove user IDs that are not currently owners: "
                f"{unknown_removals}. Current owner IDs: "
                f"{sorted(current_owner_ids)}."
            ),
        )

    new_owner_ids = [
        owner_id
        for owner_id in current_owner_ids
        if owner_id not in request.remove_owner_ids
    ]
    for owner_id in request.add_owner_ids:
        if owner_id not in new_owner_ids:
            new_owner_ids.append(owner_id)

    if not new_owner_ids:
        return None, ManageDashboardOwnersResponse(
            error=(
                "Cannot remove all owners; a dashboard must have at least "
                "one owner. To transfer ownership, add the new owner in the "
                "same call as removing the last existing one."
            ),
        )

    return new_owner_ids, None


def _apply_owner_change(
    dashboard: Any, new_owner_ids: list[int]
) -> ManageDashboardOwnersResponse | None:
    """Resolve the new owner user IDs to USER-type Subjects and persist.

    Mutates ``dashboard.editors`` in place on success — replacing the
    USER-type entries while preserving any ROLE/GROUP-type editors. Returns
    an error response on failure, or ``None`` on success.
    """
    from superset.commands.utils import populate_subject_list
    from superset.subjects.utils import get_or_create_user_subject

    try:
        with event_logger.log_context(action="mcp.manage_dashboard_owners.apply"):
            other_editors = _other_editors(dashboard)

            new_subject_ids: list[int] = []
            for user_id in new_owner_ids:
                subject = get_or_create_user_subject(user_id)
                if subject is None:
                    return ManageDashboardOwnersResponse(
                        error=(
                            f"User ID {user_id} does not exist. Use "
                            "find_users to resolve valid user IDs."
                        ),
                    )
                new_subject_ids.append(subject.id)

            try:
                resolved_owner_subjects = populate_subject_list(
                    new_subject_ids,
                    default_to_user=False,
                    ensure_no_lockout=True,
                    field_name="editors",
                )
            except SubjectsNotFoundValidationError:
                return ManageDashboardOwnersResponse(
                    error=(
                        "One or more user IDs could not be resolved to "
                        "owners. Use find_users to resolve valid user IDs."
                    ),
                )

            dashboard.editors = other_editors + resolved_owner_subjects
            db.session.commit()  # pylint: disable=consider-using-transaction
            try:
                db.session.refresh(dashboard)
            except SQLAlchemyError:
                logger.warning(
                    "Dashboard %s owners updated but refresh failed; "
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
        logger.error("Dashboard owners update failed: %s", db_err, exc_info=True)
        return ManageDashboardOwnersResponse(
            error="Failed to update dashboard owners due to a database error.",
        )

    return None


def _build_owner_warnings(
    final_owner_ids: set[int], new_owner_ids: list[int]
) -> list[str]:
    """Flag when the resolver re-added an ID that was not requested.

    Happens when a non-admin caller tries to remove themselves —
    ``populate_subject_list``'s ``ensure_no_lockout`` self-protection
    re-adds their USER subject.
    """
    auto_added = final_owner_ids - set(new_owner_ids)
    if not auto_added:
        return []
    return [
        f"User ID(s) {sorted(auto_added)} were automatically re-added as "
        "owner(s): non-admin callers cannot remove themselves from the "
        "owners list."
    ]


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Manage dashboard owners",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
def manage_dashboard_owners(
    request: ManageDashboardOwnersRequest, ctx: Context
) -> ManageDashboardOwnersResponse:
    """
    Add or remove dashboard owners with explicit, safe operations.

    Owners can edit the dashboard, manage its charts, and delete it. Unlike
    ``update_dashboard``'s dropped ``owners`` field, this tool never accepts
    a full-replacement list — only ``add_owner_ids``/``remove_owner_ids`` —
    and rejects any change that would leave the dashboard with zero owners.

    Owners are the USER-type entries in the dashboard's Subject-based
    ``editors`` list. Any ROLE- or GROUP-type editors already on the
    dashboard are left untouched.

    A non-admin caller who removes themselves is automatically re-added
    (mirrors the same self-protection ``update_dashboard``'s editorship
    check relies on) unless an ``EXTRA_EDITORS_RESOLVER`` is configured on
    the instance; the response's ``warnings`` reports when this happens.

    Privacy: the returned ``owners`` list is sanctioned only as confirmation
    of the add/remove operation the caller explicitly requested on this
    dashboard. Do not use it to answer "who owns X" for a dashboard the
    caller did not ask to modify, and do not call this tool merely to look
    up current owners — those remain off-limits per the server instructions.
    A request that has no effective change (e.g. "adding" an ID that is
    already an owner) returns an empty ``owners`` list rather than the full
    current set, so this tool cannot be used as a disguised directory
    lookup.

    Example::

        manage_dashboard_owners(request={
            "identifier": 42,
            "add_owner_ids": [7],
            "remove_owner_ids": [3],
        })
    """
    ctx.info(
        f"Managing dashboard owners: identifier={request.identifier} "
        f"add={request.add_owner_ids} remove={request.remove_owner_ids}"
    )

    dashboard, auth_error = _find_and_authorize_dashboard(request.identifier)
    if auth_error is not None:
        return auth_error

    try:
        current_owner_ids = _owner_user_ids(dashboard)
    except SQLAlchemyError as db_err:
        logger.error(
            "Failed to load owners for dashboard %s: %s",
            request.identifier,
            db_err,
            exc_info=True,
        )
        return ManageDashboardOwnersResponse(
            error="Failed to load dashboard owners due to a database error.",
        )

    new_owner_ids, compute_error = _compute_new_owner_ids(current_owner_ids, request)
    if compute_error is not None:
        return compute_error
    assert new_owner_ids is not None  # narrows for mypy; empty list errors above

    # No-op short-circuit: skip the DB write and, more importantly, the full
    # owners list in the response. The owners list is only sanctioned as
    # confirmation of an actual change (see docstring); returning it for a
    # request that changes nothing would let a caller enumerate owners via
    # a disguised no-op (e.g. "add" an ID that is already an owner).
    if set(new_owner_ids) == set(current_owner_ids):
        ctx.info(f"Dashboard {dashboard.id} owners unchanged; no-op request.")
        return ManageDashboardOwnersResponse(
            dashboard_url=_dashboard_url(dashboard),
            warnings=[
                "No effective change: requested owners already match the current state."
            ],
        )

    if (apply_error := _apply_owner_change(dashboard, new_owner_ids)) is not None:
        return apply_error

    final_owner_ids = set(_owner_user_ids(dashboard))
    warnings = _build_owner_warnings(final_owner_ids, new_owner_ids)

    # True deltas against the PRE-call state — not just membership in the
    # request — so a redundant add/remove (already-satisfied, or reverted by
    # ensure_no_lockout self-protection) is never reported or disclosed as a
    # change.
    added_owner_ids = sorted(
        (final_owner_ids & set(request.add_owner_ids)) - set(current_owner_ids)
    )
    removed_owner_ids = sorted(
        (set(request.remove_owner_ids) & set(current_owner_ids)) - final_owner_ids
    )

    if not added_owner_ids and not removed_owner_ids:
        warnings.append(
            "No effective change: the requested owners already matched the "
            "final state after resolution."
        )
        ctx.info(f"Dashboard {dashboard.id} owners unchanged after resolution.")
        return ManageDashboardOwnersResponse(
            dashboard_url=_dashboard_url(dashboard),
            warnings=warnings,
        )

    ctx.info(f"Dashboard {dashboard.id} owners updated: {sorted(final_owner_ids)}")

    return ManageDashboardOwnersResponse(
        owners=[
            info
            for subject in dashboard.editors
            if subject.type == SubjectType.USER
            and (info := serialize_subject_object(subject)) is not None
        ],
        dashboard_url=_dashboard_url(dashboard),
        added_owner_ids=added_owner_ids,
        removed_owner_ids=removed_owner_ids,
        warnings=warnings,
    )
