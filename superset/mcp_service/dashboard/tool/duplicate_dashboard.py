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
MCP tool: duplicate_dashboard

Duplicates an existing dashboard, optionally deep-copying its charts.
Canonical workflow: clone a template dashboard, then edit the copy
(e.g. to create a regional or staging variant).
"""

import logging
from typing import Any

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.dashboard.schemas import (
    _sanitize_dashboard_info_for_llm_context,
    DashboardInfo,
    DuplicateDashboardRequest,
    DuplicateDashboardResponse,
    serialize_chart_summary,
)
from superset.mcp_service.privacy import user_can_view_data_model_metadata
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)


def _get_layout_chart_ids(positions: dict[str, Any]) -> frozenset[int]:
    """Return the set of chart IDs referenced in the layout.

    ``DashboardDAO.set_dash_metadata`` rebuilds the new dashboard's slice
    list solely from the chart IDs found in ``positions``.  If no IDs appear,
    or if all IDs are stale (not present in the source dashboard's slices),
    the copy will have no charts regardless of the source's ``slices``
    relationship.
    """
    return frozenset(
        value["meta"]["chartId"]
        for value in positions.values()
        if isinstance(value, dict)
        and value.get("type") == "CHART"
        and value.get("meta", {}).get("chartId")
    )


def _build_copy_payload(
    source: Any, dashboard_title: str, duplicate_slices: bool
) -> tuple[dict[str, Any], frozenset[int]]:
    """Build the data payload expected by ``CopyDashboardCommand``.

    Mirrors what the frontend "Save as" flow sends to the
    ``/api/v1/dashboard/<id>/copy/`` endpoint: the source dashboard's
    current ``json_metadata`` with a ``positions`` key holding the current
    layout (``position_json``). ``DashboardCopySchema`` requires
    ``json_metadata``, and ``DashboardDAO.copy_dashboard`` reads
    ``positions`` from it to remap chart IDs when ``duplicate_slices``
    is enabled.

    Returns the payload and the set of chart IDs in the layout, so the
    caller can detect an empty or stale layout before committing to the copy.

    Raises ``ValueError`` / ``json.JSONDecodeError`` if ``json_metadata``
    cannot be decoded — callers should surface this as a structured error.
    Silently proceeding with ``{}`` would produce a copy that loses the
    source's filter config, color scheme, and other dashboard settings.
    """
    # Let JSONDecodeError (a ValueError subclass) propagate: a dashboard with
    # unparseable json_metadata would silently lose all its filter/color
    # configuration in the copy, which is worse than a clear fail-fast error.
    metadata = json.loads(source.json_metadata or "{}")
    if not isinstance(metadata, dict):
        raise ValueError(
            "Dashboard json_metadata is not a JSON object; "
            "open and re-save the source dashboard to repair it."
        )

    try:
        positions = json.loads(source.position_json or "{}")
    except (json.JSONDecodeError, TypeError):
        positions = {}
    if not isinstance(positions, dict):
        positions = {}

    metadata["positions"] = positions

    payload = {
        "dashboard_title": dashboard_title,
        "css": source.css,
        "duplicate_slices": duplicate_slices,
        "json_metadata": json.dumps(metadata),
    }
    return payload, _get_layout_chart_ids(positions)


def _serialize_new_dashboard(dashboard: Any) -> tuple[DashboardInfo, str]:
    """Build the response ``DashboardInfo`` and URL for the new dashboard."""
    from superset.mcp_service.dashboard.schemas import serialize_tag_object

    dashboard_url = f"{get_superset_base_url()}/dashboard/{dashboard.id}/"
    include_data_model_metadata = user_can_view_data_model_metadata()
    info = DashboardInfo(
        id=dashboard.id,
        dashboard_title=dashboard.dashboard_title,
        slug=dashboard.slug,
        description=dashboard.description,
        published=dashboard.published,
        created_on=dashboard.created_on,
        changed_on=dashboard.changed_on,
        uuid=str(dashboard.uuid) if dashboard.uuid else None,
        url=dashboard_url,
        chart_count=len(dashboard.slices),
        tags=[
            obj
            for tag in getattr(dashboard, "tags", [])
            if (obj := serialize_tag_object(tag)) is not None
        ],
        charts=[
            obj
            for chart in getattr(dashboard, "slices", [])
            if (
                obj := serialize_chart_summary(
                    chart,
                    include_data_model_metadata=include_data_model_metadata,
                )
            )
            is not None
        ],
    )
    return _sanitize_dashboard_info_for_llm_context(info), dashboard_url


def _safe_rollback(context_label: str) -> None:
    """Roll back the current DB session, swallowing rollback failures.

    A failed operation can leave the shared session in an invalid
    transaction state; rolling back keeps later ORM use in the same request
    lifecycle from inheriting the broken transaction.
    """
    from superset import db

    try:
        db.session.rollback()  # pylint: disable=consider-using-transaction
    except SQLAlchemyError:
        logger.warning(
            "Database rollback failed during %s error handling",
            context_label,
            exc_info=True,
        )


def _refetch_and_serialize(
    new_dashboard: Any, dashboard_title: str
) -> tuple[DashboardInfo, str]:
    """Re-fetch the new dashboard with eager-loaded relationships.

    The eager load avoids lazy-loading on a session the command's commit may
    have invalidated. If the re-fetch fails, the failed transaction is rolled
    back and a minimal response is returned instead.
    """
    from sqlalchemy.orm import subqueryload

    from superset.daos.dashboard import DashboardDAO
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    try:
        dashboard = (
            DashboardDAO.find_by_id(
                new_dashboard.id,
                query_options=[
                    subqueryload(Dashboard.slices).subqueryload(Slice.tags),
                    subqueryload(Dashboard.tags),
                ],
            )
            or new_dashboard
        )
        return _serialize_new_dashboard(dashboard)
    except SQLAlchemyError:
        logger.warning(
            "Re-fetch of dashboard %s failed; returning minimal response",
            new_dashboard.id,
            exc_info=True,
        )
        _safe_rollback("dashboard re-fetch")
        dashboard_url = f"{get_superset_base_url()}/dashboard/{new_dashboard.id}/"
        info = _sanitize_dashboard_info_for_llm_context(
            DashboardInfo(
                id=new_dashboard.id,
                dashboard_title=dashboard_title,
                url=dashboard_url,
            )
        )
        return info, dashboard_url


async def _resolve_source(
    request: DuplicateDashboardRequest, ctx: Context
) -> tuple[Any, DuplicateDashboardResponse | None]:
    """Resolve and authorize the source dashboard.

    Returns ``(source, None)`` on success, or ``(None, error_response)`` when
    the dashboard is missing or inaccessible.
    """
    from superset.commands.dashboard.exceptions import (
        DashboardAccessDeniedError,
        DashboardNotFoundError,
    )
    from superset.daos.dashboard import DashboardDAO

    with event_logger.log_context(action="mcp.duplicate_dashboard.lookup"):
        try:
            return DashboardDAO.get_by_id_or_slug(str(request.dashboard_id)), None
        except DashboardNotFoundError:
            await ctx.warning(
                "Dashboard not found for duplication: dashboard_id=%s"
                % (request.dashboard_id,)
            )
            return None, DuplicateDashboardResponse(
                error=(
                    f"Dashboard '{request.dashboard_id}' not found. "
                    "Use list_dashboards to get valid dashboard IDs."
                ),
            )
        except DashboardAccessDeniedError:
            await ctx.warning(
                "Dashboard access denied for duplication: dashboard_id=%s"
                % (request.dashboard_id,)
            )
            return None, DuplicateDashboardResponse(
                error=(
                    f"You don't have access to dashboard "
                    f"'{request.dashboard_id}', so it cannot be duplicated."
                ),
            )
        except SQLAlchemyError:
            # Transient DB/session failures during lookup must surface as a
            # structured response, not a hard tool failure. The raw error is
            # logged with a traceback; the response stays generic because
            # ``str(exc)`` can leak table/column/constraint names.
            logger.error(
                "Database error resolving dashboard %s for duplication",
                request.dashboard_id,
                exc_info=True,
            )
            _safe_rollback("dashboard lookup")
            return None, DuplicateDashboardResponse(
                error=(
                    f"Dashboard '{request.dashboard_id}' could not be "
                    "duplicated due to a database error. Please try again."
                ),
            )


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Duplicate dashboard",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def duplicate_dashboard(
    request: DuplicateDashboardRequest, ctx: Context
) -> DuplicateDashboardResponse:
    """
    Duplicate an existing dashboard under a new title.

    By default the copy references the same charts as the source.
    Set duplicate_slices=true to also deep-copy every chart into new
    chart objects owned by you, so edits to the copies never affect
    the originals.

    The source dashboard can be identified by numeric ID, UUID, or slug.
    Returns the new dashboard's ID, title, and URL.
    """
    await ctx.info(
        "Duplicating dashboard: dashboard_id=%s, duplicate_slices=%s"
        % (request.dashboard_id, request.duplicate_slices)
    )

    from superset.commands.dashboard.copy import CopyDashboardCommand
    from superset.commands.dashboard.exceptions import (
        DashboardCopyError,
        DashboardForbiddenError,
        DashboardInvalidError,
    )

    try:
        source, error_response = await _resolve_source(request, ctx)
        if error_response is not None:
            return error_response

        data, layout_chart_ids = _build_copy_payload(
            source, request.dashboard_title, request.duplicate_slices
        )

        source_slice_ids = {s.id for s in getattr(source, "slices", []) or []}

        if source_slice_ids and not layout_chart_ids:
            await ctx.warning(
                "Source layout maps no charts; refusing to duplicate to "
                "avoid an empty copy: dashboard_id=%s" % (request.dashboard_id,)
            )
            return DuplicateDashboardResponse(
                error=(
                    f"Dashboard '{request.dashboard_id}' has charts but its "
                    "saved layout is missing or invalid, so duplicating it "
                    "would produce a dashboard with no charts. Open and "
                    "re-save the source dashboard to repair its layout, then "
                    "try again."
                ),
            )

        if (
            source_slice_ids
            and layout_chart_ids
            and not layout_chart_ids & source_slice_ids
        ):
            await ctx.warning(
                "Source layout references chart IDs that don't match any "
                "source slice; refusing to duplicate to avoid an empty copy: "
                "dashboard_id=%s" % (request.dashboard_id,)
            )
            return DuplicateDashboardResponse(
                error=(
                    f"Dashboard '{request.dashboard_id}' has charts but its "
                    "saved layout references chart IDs that don't match any "
                    "of its actual charts. The layout appears corrupted. Open "
                    "and re-save the source dashboard to repair its layout, "
                    "then try again."
                ),
            )

        with event_logger.log_context(action="mcp.duplicate_dashboard.copy"):
            new_dashboard = CopyDashboardCommand(source, data).run()

        info, dashboard_url = _refetch_and_serialize(
            new_dashboard, request.dashboard_title
        )

        logger.info(
            "Duplicated dashboard %s into dashboard %s (duplicate_slices=%s)",
            request.dashboard_id,
            new_dashboard.id,
            request.duplicate_slices,
        )

        return DuplicateDashboardResponse(
            dashboard=info,
            dashboard_url=dashboard_url,
            duplicated_slices=request.duplicate_slices,
            warnings=list(request.sanitization_warnings),
        )

    except DashboardForbiddenError:
        await ctx.error(
            "Dashboard duplication forbidden: dashboard_id=%s" % (request.dashboard_id,)
        )
        return DuplicateDashboardResponse(
            error=(
                f"You don't have permission to duplicate dashboard "
                f"'{request.dashboard_id}'."
            ),
        )
    except DashboardInvalidError:
        return DuplicateDashboardResponse(
            error=(
                "Dashboard duplication parameters were invalid. "
                "Provide a non-empty dashboard_title."
            ),
        )
    except DashboardCopyError as exc:
        _safe_rollback("dashboard duplication")
        await ctx.error("Dashboard duplication failed: %s" % (str(exc),))
        return DuplicateDashboardResponse(
            error=f"Failed to duplicate dashboard: {exc}",
        )
    except (ValueError, TypeError, KeyError) as exc:
        # Malformed stored metadata surfaces as a parse error from
        # _build_copy_payload (invalid json_metadata) or from
        # CopyDashboardCommand (invalid params/json_metadata re-read via
        # set_dash_metadata). The transaction handler only wraps
        # SQLAlchemyError, so ValueError/TypeError/KeyError escape unhandled.
        # Return a structured response instead of a hard tool failure.
        _safe_rollback("dashboard duplication")
        await ctx.error(
            "Dashboard duplication failed parsing source metadata for "
            "dashboard_id=%s: %s: %s"
            % (request.dashboard_id, type(exc).__name__, str(exc))
        )
        return DuplicateDashboardResponse(
            error=(
                f"Dashboard '{request.dashboard_id}' could not be duplicated "
                "because its stored metadata is invalid. Open and re-save the "
                "source dashboard to repair it, then try again."
            ),
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error duplicating dashboard: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
