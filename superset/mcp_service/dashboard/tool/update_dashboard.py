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
Update dashboard FastMCP tool

This module contains the FastMCP tool for updating an existing dashboard's
layout, theme, and styling. Companion to ``generate_dashboard`` for
incremental edits without re-creating the dashboard.
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
    dashboard_serializer,
    DashboardError,
    UpdateDashboardRequest,
    UpdateDashboardResponse,
)
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)


def _build_dashboard_url(dashboard: Any) -> str:
    """Build the user-facing dashboard URL, preferring slug over id."""
    return f"{get_superset_base_url()}/dashboard/{dashboard.slug or dashboard.id}/"


def _find_and_authorize_dashboard(
    identifier: int | str,
) -> tuple[Any, UpdateDashboardResponse | DashboardError | None]:
    """Return (dashboard, None) on success or (None, error_response) on failure.

    Mirrors the helper in ``add_chart_to_existing_dashboard``: combines
    the not-found and forbidden cases so the main tool body has a single
    pre-condition branch. Returns ``DashboardError`` on not-found and
    ``UpdateDashboardResponse`` (with ``permission_denied=True``) on
    editorship failure; the two shapes carry different information for
    the caller.
    """
    # avoids ImportError before Flask app initialisation:
    # `Exception: App not initialized yet. Please call init_app first`
    # raised from superset.utils.encrypt when DashboardDAO is imported
    # (via Slice's encrypted Column types). `security_manager` is a
    # LocalProxy that needs the same app context to resolve at call
    # time, so it is co-located with the DAO it accompanies.
    from superset import security_manager
    from superset.daos.dashboard import DashboardDAO

    try:
        dashboard = DashboardDAO.get_by_id_or_slug(identifier)
    except DashboardNotFoundError:
        return None, DashboardError(
            error=f"Dashboard not found: {identifier!r}",
            error_type="DashboardNotFound",
        )
    except SQLAlchemyError:
        # ``str(exc)`` on SQLAlchemyError frequently contains table/column/
        # constraint names that should not leak to the MCP response. The raw
        # exception is captured here via ``logger.exception``; the response
        # surfaces a generic message (mirrors generate_dashboard.py's
        # rollback/error handling).
        logger.exception("Database error looking up dashboard %r", identifier)
        return None, DashboardError(
            error="Failed to look up dashboard due to a database error.",
            error_type="DatabaseError",
        )

    if dashboard is None:
        return None, DashboardError(
            error=f"Dashboard not found: {identifier!r}",
            error_type="DashboardNotFound",
        )

    try:
        security_manager.raise_for_editorship(dashboard)
    except SupersetSecurityException:
        return None, UpdateDashboardResponse(
            permission_denied=True,
            error=(
                f"You don't have permission to edit dashboard "
                f"'{dashboard.dashboard_title}' (ID: {dashboard.id})."
            ),
        )

    return dashboard, None


def _merge_json_metadata(dashboard: Any, overrides: dict[str, Any]) -> str:
    """Shallow-merge ``overrides`` onto the dashboard's existing metadata.

    Parses defensively: a row may carry malformed JSON or a non-object
    payload (e.g. ``"[]"``) from an older migration or manual edit. Either
    would raise out of the caller's ``SQLAlchemyError`` handler, so fall
    back to an empty object and overlay the overrides on top.
    """
    existing: dict[str, Any] = {}
    if dashboard.json_metadata:
        try:
            if isinstance(parsed := json.loads(dashboard.json_metadata), dict):
                existing = parsed
        except (ValueError, TypeError):
            pass
    existing.update(overrides)
    return json.dumps(existing)


# Typed json_metadata convenience fields. Each maps 1:1 to a json_metadata
# key but is exposed as a validated field so an LLM does not have to hand-build
# the raw ``json_metadata_overrides`` dict for common toggles.
_TYPED_METADATA_FIELDS: tuple[str, ...] = (
    "cross_filters_enabled",
    "refresh_frequency",
    "filter_bar_orientation",
)


def _collect_metadata_overrides(request: UpdateDashboardRequest) -> dict[str, Any]:
    """Combine the generic ``json_metadata_overrides`` with the typed fields.

    A key set via both a typed field and the generic dict is ambiguous, so a
    collision raises ``ValueError``. Otherwise the typed fields are layered on
    top of the generic overrides. The generic dict stays as an escape hatch for
    keys without a typed field.
    """
    overrides: dict[str, Any] = dict(request.json_metadata_overrides or {})
    typed: dict[str, Any] = {
        field: value
        for field in _TYPED_METADATA_FIELDS
        if (value := getattr(request, field)) is not None
    }
    if clashes := sorted(set(overrides) & set(typed)):
        raise ValueError(
            "Conflicting metadata for "
            + ", ".join(clashes)
            + ": set via both a typed field and json_metadata_overrides. "
            + "Pass each key only once."
        )
    overrides.update(typed)
    return overrides


def _resolve_owners(owner_ids: list[int]) -> tuple[list[Any], list[int]]:
    """Resolve owner user IDs to user objects.

    Returns ``(users, missing_ids)``, deduplicating IDs while preserving the
    caller's order. ``security_manager`` is imported lazily for the same
    app-context reason as ``_find_and_authorize_dashboard``.
    """
    from superset import security_manager

    users: list[Any] = []
    missing: list[int] = []
    seen: set[int] = set()
    for uid in owner_ids:
        if uid in seen:
            continue
        seen.add(uid)
        user = security_manager.get_user_by_id(uid)
        if user is None:
            missing.append(uid)
        else:
            users.append(user)
    return users, missing


def _resolve_and_validate_owners(
    request: UpdateDashboardRequest,
) -> tuple[list[Any] | None, DashboardError | None]:
    """Resolve the requested owners exactly once, returning ``(users, error)``.

    A ``None`` users result means the request left owners unchanged; an empty
    list is a valid "clear all owners" request. Resolving here once (rather
    than again at mutation time) closes the window where a user removed between
    validation and the write would be silently dropped. Unknown IDs and DB
    errors are surfaced as structured ``DashboardError`` responses, matching the
    other pre-flight validations.
    """
    if request.owners is None:
        return None, None

    try:
        users, missing = _resolve_owners(request.owners)
    except SQLAlchemyError:
        logger.warning("Database error during owner validation", exc_info=True)
        return None, DashboardError(
            error="Failed to validate owners due to a database error.",
            error_type="DatabaseError",
        )

    if missing:
        return None, DashboardError(
            error=(
                "Unknown owner user IDs: "
                + ", ".join(str(m) for m in missing)
                + ". Find valid IDs with list_users."
            ),
            error_type="OwnersNotFound",
        )

    return users, None


def _apply_field_updates(
    dashboard: Any,
    request: UpdateDashboardRequest,
    resolved_owners: list[Any] | None,
) -> list[str]:
    """Apply each explicitly-passed field to the dashboard.

    Returns the names of fields actually changed. Mutates ``dashboard``
    in place. ``json_metadata_overrides`` (plus the typed metadata fields) is
    merged shallowly with the existing ``json_metadata``; an empty string in
    ``slug`` or ``css`` clears the underlying value; ``tags`` fully replaces the
    dashboard's custom tags. ``resolved_owners`` is the already-resolved,
    already-validated owner list from ``_resolve_and_validate_owners`` (used
    only when ``request.owners`` is set). Inputs are assumed pre-validated by
    ``_validate_update_request``.
    """
    changed: list[str] = []

    if request.dashboard_title is not None:
        dashboard.dashboard_title = request.dashboard_title
        changed.append("dashboard_title")

    if request.description is not None:
        dashboard.description = request.description
        changed.append("description")

    if request.slug is not None:
        dashboard.slug = request.slug or None
        changed.append("slug")

    if request.published is not None:
        dashboard.published = request.published
        changed.append("published")

    if request.position_json is not None:
        dashboard.position_json = json.dumps(request.position_json)
        changed.append("position_json")

    metadata_overrides: dict[str, Any] = _collect_metadata_overrides(request)
    if metadata_overrides:
        dashboard.json_metadata = _merge_json_metadata(dashboard, metadata_overrides)
        changed.append("json_metadata")

    if request.css is not None:
        dashboard.css = request.css or None
        changed.append("css")

    if request.tags is not None:
        # Reuse the same helper the REST UpdateDashboardCommand uses so tag
        # association semantics (custom-tag full replacement) stay identical.
        from superset.commands.utils import update_tags
        from superset.tags.models import ObjectType

        update_tags(ObjectType.dashboard, dashboard.id, dashboard.tags, request.tags)
        changed.append("tags")

    if request.owners is not None:
        # Full replacement of owners (empty list clears them). The owners were
        # resolved and validated exactly once by _resolve_and_validate_owners,
        # so there is no second lookup here that could silently drop a user
        # removed between validation and this write.
        dashboard.owners = resolved_owners or []
        changed.append("owners")

    return changed


def _validate_update_request(
    dashboard: Any, request: UpdateDashboardRequest
) -> DashboardError | None:
    """Pre-flight validation mirroring the REST update path.

    Runs before any mutation so the tool rejects the same payloads the REST
    ``DashboardPutSchema`` / ``UpdateDashboardCommand`` would — invalid CSS,
    conflicting metadata keys, and unauthorized or unknown tag IDs — returning a
    structured error instead of failing deep inside the commit.
    """
    from marshmallow import ValidationError as MarshmallowValidationError

    from superset.commands.exceptions import (
        TagForbiddenError,
        TagNotFoundValidationError,
    )
    from superset.commands.utils import validate_tags
    from superset.dashboards.schemas import validate_css
    from superset.tags.models import ObjectType

    # Empty string clears CSS (no validation needed); only validate real content.
    if request.css:
        try:
            validate_css(request.css)
        except MarshmallowValidationError as ex:
            detail = (
                "; ".join(str(m) for m in ex.messages)
                if isinstance(ex.messages, list)
                else str(ex.messages)
            )
            return DashboardError(
                error=f"Dashboard CSS is invalid: {detail}",
                error_type="InvalidCSS",
            )

    try:
        _collect_metadata_overrides(request)
    except ValueError as ex:
        return DashboardError(error=str(ex), error_type="InvalidRequest")

    if request.tags is not None:
        try:
            validate_tags(ObjectType.dashboard, dashboard.tags, request.tags)
        except TagForbiddenError as ex:
            return DashboardError(error=str(ex), error_type="TagForbidden")
        except TagNotFoundValidationError as ex:
            return DashboardError(error=str(ex), error_type="TagNotFound")
        except SQLAlchemyError:
            logger.warning("Database error during tag validation", exc_info=True)
            return DashboardError(
                error="Failed to validate tags due to a database error.",
                error_type="DatabaseError",
            )

    # Owners are resolved and validated separately by
    # _resolve_and_validate_owners so the resolution can be reused for the
    # write without a second lookup.
    return None


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update dashboard layout/theme/CSS/metadata",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
def update_dashboard(
    request: UpdateDashboardRequest, ctx: Context
) -> UpdateDashboardResponse | DashboardError:
    """Patch an existing dashboard's layout, theme, styling, or metadata.

    Companion to ``generate_dashboard`` for incremental edits. An LLM can:

      - Set or replace ``position_json`` after auto-generation
      - Apply brand ``label_colors`` and ``color_scheme`` via
        ``json_metadata_overrides``
      - Inject ``css`` to hide chrome on print-ready dashboards
      - Update ``dashboard_title``, ``description``, ``slug``, ``published``
      - Replace the dashboard's ``tags`` (FULL list of IDs; find them with
        ``list_tags``)
      - Replace the dashboard's ``owners`` (FULL list of user IDs; find them
        with ``list_users``). Requires editorship (owner or Admin).
      - Toggle ``cross_filters_enabled``, ``refresh_frequency``, or
        ``filter_bar_orientation`` via typed fields (no need to hand-build
        ``json_metadata_overrides``)

    Only the fields explicitly passed are applied; other fields are left
    unchanged. ``json_metadata_overrides`` is merged shallowly with the
    existing json_metadata — pass only the keys you want to change. A key may
    not be set via both a typed field and ``json_metadata_overrides``.

    Example::

        update_dashboard(request={
            "identifier": 42,
            "tags": [3, 7],
            "refresh_frequency": 300,
            "css": ".header-controls {display: none;}",
        })
    """
    ctx.info(f"Updating dashboard: identifier={request.identifier}")

    dashboard, auth_error = _find_and_authorize_dashboard(request.identifier)
    if auth_error is not None:
        return auth_error

    validation_error: DashboardError | None = _validate_update_request(
        dashboard, request
    )
    if validation_error is not None:
        return validation_error

    # Resolve owners once up front so the same list is used for validation and
    # the write (no second lookup that could drop a concurrently-removed user).
    resolved_owners, owners_error = _resolve_and_validate_owners(request)
    if owners_error is not None:
        return owners_error

    changed_fields: list[str] = []
    warnings: list[str] = list(request.sanitization_warnings)

    try:
        with event_logger.log_context(action="mcp.update_dashboard.apply"):
            changed_fields = _apply_field_updates(dashboard, request, resolved_owners)

            if not changed_fields:
                warnings.append("No fields provided; dashboard unchanged.")
                return UpdateDashboardResponse(
                    dashboard=dashboard_serializer(dashboard),
                    dashboard_url=_build_dashboard_url(dashboard),
                    error=None,
                    changed_fields=[],
                    warnings=warnings,
                )

            db.session.commit()  # pylint: disable=consider-using-transaction
            try:
                db.session.refresh(dashboard)
            except SQLAlchemyError:
                logger.warning(
                    "Dashboard %s updated but refresh failed; "
                    "continuing with current values",
                    dashboard.id,
                    exc_info=True,
                )
                warnings.append(
                    "Dashboard updated but post-update refresh failed; "
                    "returned values may not reflect database state."
                )

    except SQLAlchemyError as db_err:
        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning(
                "Database rollback failed during error handling",
                exc_info=True,
            )
        logger.error("Dashboard update failed: %s", db_err, exc_info=True)
        return DashboardError(
            error="Failed to update dashboard due to a database error.",
            error_type="DatabaseError",
        )

    ctx.info(f"Dashboard {dashboard.id} updated: changed={changed_fields}")

    return UpdateDashboardResponse(
        dashboard=dashboard_serializer(dashboard),
        dashboard_url=_build_dashboard_url(dashboard),
        error=None,
        changed_fields=changed_fields,
        warnings=warnings,
    )
