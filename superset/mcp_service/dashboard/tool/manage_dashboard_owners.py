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
deliberately does not expose (a full-replacement ``owners`` list has no
"keep >=1 owner" guard in ``UpdateDashboardCommand``).
"""

import logging
from typing import Any

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.commands.exceptions import OwnersNotFoundValidationError
from superset.exceptions import SupersetSecurityException
from superset.extensions import db, event_logger
from superset.mcp_service.dashboard.schemas import (
    ManageDashboardOwnersRequest,
    ManageDashboardOwnersResponse,
)
from superset.mcp_service.user.schemas import serialize_user_object
from superset.mcp_service.utils.url_utils import get_superset_base_url

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
        security_manager.raise_for_ownership(dashboard)
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
    """Resolve and persist the new owner list.

    Mutates ``dashboard.owners`` in place on success. Returns an error
    response on failure, or ``None`` on success.
    """
    from superset.commands.utils import populate_owner_list

    try:
        with event_logger.log_context(action="mcp.manage_dashboard_owners.apply"):
            try:
                resolved_owners = populate_owner_list(
                    new_owner_ids, default_to_user=False
                )
            except OwnersNotFoundValidationError:
                return ManageDashboardOwnersResponse(
                    error=(
                        "One or more user IDs do not exist. Use find_users "
                        "to resolve valid user IDs."
                    ),
                )

            dashboard.owners = resolved_owners
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
    ``populate_owner_list``'s self-protection re-adds them.
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

    A non-admin caller who removes themselves is automatically re-added
    (mirrors the REST ``UpdateDashboardCommand`` self-protection) unless an
    ``EXTRA_OWNERS_RESOLVER`` is configured on the instance; the response's
    ``warnings`` reports when this happens.

    Privacy: the returned ``owners`` list is sanctioned only as confirmation
    of the add/remove operation the caller explicitly requested on this
    dashboard. Do not use it to answer "who owns X" for a dashboard the
    caller did not ask to modify, and do not call this tool merely to look
    up current owners — those remain off-limits per the server instructions.

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

    current_owner_ids = [owner.id for owner in dashboard.owners]
    new_owner_ids, compute_error = _compute_new_owner_ids(current_owner_ids, request)
    if compute_error is not None:
        return compute_error
    assert new_owner_ids is not None  # narrows for mypy; empty list errors above

    if (apply_error := _apply_owner_change(dashboard, new_owner_ids)) is not None:
        return apply_error

    final_owner_ids = {owner.id for owner in dashboard.owners}
    warnings = _build_owner_warnings(final_owner_ids, new_owner_ids)

    ctx.info(f"Dashboard {dashboard.id} owners updated: {sorted(final_owner_ids)}")

    return ManageDashboardOwnersResponse(
        owners=[
            info
            for owner in dashboard.owners
            if (info := serialize_user_object(owner, include_sensitive=False))
            is not None
        ],
        dashboard_url=_dashboard_url(dashboard),
        added_owner_ids=sorted(final_owner_ids & set(request.add_owner_ids)),
        removed_owner_ids=[
            owner_id
            for owner_id in request.remove_owner_ids
            if owner_id not in final_owner_ids
        ],
        warnings=warnings,
    )
