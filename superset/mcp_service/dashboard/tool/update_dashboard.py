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
    return (
        f"{get_superset_base_url()}/superset/dashboard/"
        f"{dashboard.slug or dashboard.id}/"
    )


def _find_and_authorize_dashboard(
    identifier: int | str,
) -> tuple[Any, UpdateDashboardResponse | DashboardError | None]:
    """Return (dashboard, None) on success or (None, error_response) on failure.

    Mirrors the helper in ``add_chart_to_existing_dashboard``: combines
    the not-found and forbidden cases so the main tool body has a single
    pre-condition branch. Returns ``DashboardError`` on not-found and
    ``UpdateDashboardResponse`` (with ``permission_denied=True``) on
    ownership failure — the two shapes carry different information for
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
    except (DashboardNotFoundError, SQLAlchemyError):
        return None, DashboardError(
            error=f"Dashboard not found: {identifier!r}",
            error_type="DashboardNotFound",
        )

    if dashboard is None:
        return None, DashboardError(
            error=f"Dashboard not found: {identifier!r}",
            error_type="DashboardNotFound",
        )

    try:
        security_manager.raise_for_ownership(dashboard)
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
            parsed = json.loads(dashboard.json_metadata)
            if isinstance(parsed, dict):
                existing = parsed
        except (ValueError, TypeError):
            pass
    existing.update(overrides)
    return json.dumps(existing)


def _apply_field_updates(dashboard: Any, request: UpdateDashboardRequest) -> list[str]:
    """Apply each explicitly-passed field to the dashboard.

    Returns the names of fields actually changed. Mutates ``dashboard``
    in place. ``json_metadata_overrides`` is merged shallowly with the
    existing ``json_metadata``; an empty string in ``slug`` or ``css``
    clears the underlying value.
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

    if request.json_metadata_overrides is not None:
        dashboard.json_metadata = _merge_json_metadata(
            dashboard, request.json_metadata_overrides
        )
        changed.append("json_metadata")

    if request.css is not None:
        dashboard.css = request.css or None
        changed.append("css")

    return changed


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update dashboard layout/theme/CSS",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
def update_dashboard(
    request: UpdateDashboardRequest, ctx: Context
) -> UpdateDashboardResponse | DashboardError:
    """Patch an existing dashboard's layout, theme, or styling.

    Companion to ``generate_dashboard`` for incremental edits. Accepts
    the same layout/theme/CSS fields that ``generate_dashboard`` does, so
    an LLM can:

      - Set or replace ``position_json`` after auto-generation
      - Apply brand ``label_colors`` and ``color_scheme`` via
        ``json_metadata_overrides``
      - Toggle ``cross_filters_enabled`` via ``json_metadata_overrides``
      - Inject ``css`` to hide chrome on print-ready dashboards
      - Update ``dashboard_title``, ``description``, ``slug``, ``published``

    Only the fields explicitly passed are applied; other fields are left
    unchanged. ``json_metadata_overrides`` is merged shallowly with the
    existing json_metadata — pass only the keys you want to change.

    Example::

        update_dashboard(request={
            "identifier": 42,
            "json_metadata_overrides": {
                "label_colors": {"Electronics": "#4C78A8"},
                "cross_filters_enabled": False,
            },
            "css": ".header-controls {display: none;}",
        })
    """
    ctx.info(f"Updating dashboard: identifier={request.identifier}")

    dashboard, auth_error = _find_and_authorize_dashboard(request.identifier)
    if auth_error is not None:
        return auth_error

    changed_fields: list[str] = []
    warnings: list[str] = list(request.sanitization_warnings)

    try:
        with event_logger.log_context(action="mcp.update_dashboard.apply"):
            changed_fields = _apply_field_updates(dashboard, request)

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
