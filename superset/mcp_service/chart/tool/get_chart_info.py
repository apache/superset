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
MCP tool: get_chart_info
"""

import logging
from typing import Annotated, Any, cast

from fastmcp import Context
from marshmallow import ValidationError
from pydantic import Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import subqueryload
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.commands.exceptions import CommandException, ForbiddenError
from superset.exceptions import (
    SupersetParseError,
    SupersetSecurityException,
    SupersetTemplateException,
)
from superset.explore.permalink.types import ExplorePermalinkValue
from superset.extensions import event_logger
from superset.mcp_service.chart.chart_helpers import (
    build_applied_dashboard_filters,
    ChartNotOnDashboardError,
    get_cached_form_data,
)
from superset.mcp_service.chart.chart_utils import validate_chart_dataset
from superset.mcp_service.chart.schemas import (
    ChartError,
    ChartFiltersInfo,
    ChartInfo,
    extract_filters_from_form_data,
    GetChartInfoRequest,
    serialize_chart_object,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.privacy import (
    redact_chart_data_model_fields,
    user_can_view_data_model_metadata,
)
from superset.utils.core import DatasourceType

logger = logging.getLogger(__name__)


def _build_unsaved_chart_info(form_data_key: str) -> ChartInfo | ChartError:
    """Build a ChartInfo from cached form_data when no chart identifier exists."""
    from superset.utils import json as utils_json

    cached_form_data = get_cached_form_data(form_data_key)
    if not cached_form_data:
        return ChartError(
            error="No cached chart data found for form_data_key. "
            "The cache may have expired.",
            error_type="NotFound",
        )
    try:
        form_data = utils_json.loads(cached_form_data)
    except (TypeError, ValueError) as e:
        return ChartError(
            error=f"Failed to parse cached form_data: {e}",
            error_type="ParseError",
        )
    if not isinstance(form_data, dict):
        return ChartError(
            error="Cached form_data is not a valid JSON object.",
            error_type="ParseError",
        )
    return ChartInfo(
        viz_type=form_data.get("viz_type"),
        datasource_name=form_data.get("datasource_name"),
        datasource_type=form_data.get("datasource_type"),
        filters=extract_filters_from_form_data(form_data),
        form_data=form_data,
        form_data_key=form_data_key,
        is_unsaved_state=True,
    )


def _get_explore_permalink(
    permalink_key: str,
) -> ExplorePermalinkValue | ChartError:
    """Read an Explore permalink, enforcing the same access checks as Explore.

    ``GetExplorePermalinkCommand`` checks access to the permalink's datasource
    and, when it references a saved chart, to that chart.
    """
    from superset.commands.explore.permalink.get import GetExplorePermalinkCommand

    try:
        value = GetExplorePermalinkCommand(permalink_key).run()
    except (ForbiddenError, SupersetSecurityException):
        # Tables raise ForbiddenError subclasses; SQL Lab queries go through
        # security_manager.raise_for_access, which raises
        # SupersetSecurityException.
        return ChartError(
            error="You do not have access to the chart or dataset in this permalink.",
            error_type="PermalinkAccessDenied",
        )
    except (SupersetTemplateException, SupersetParseError) as ex:
        # The access check renders a SQL Lab query's Jinja and parses the
        # result to find its tables; if either fails, access cannot be checked
        # at all. The message stays generic: parser errors quote the SQL.
        logger.warning("Failed to render or parse explore permalink query: %s", ex)
        return ChartError(
            error=(
                "The SQL of the SQL Lab query behind this permalink could not be "
                "rendered or parsed, so access to it could not be checked."
            ),
            error_type="InvalidPermalink",
        )
    except (CommandException, SQLAlchemyError, ValidationError, ValueError) as ex:
        # ValidationError: the permalink's datasource no longer exists or has an
        # invalid type (raised by the access check).
        logger.warning("Failed to read explore permalink: %s", ex)
        return ChartError(
            error="The explore permalink could not be read. Check the key.",
            error_type="InvalidPermalink",
        )
    if not value:
        return ChartError(
            error="No explore permalink found for permalink_key.",
            error_type="NotFound",
        )
    return value


def _permalink_chart_id(permalink: ExplorePermalinkValue) -> int | None:
    """Return the saved chart a permalink was created from, if any.

    ``chartId`` is copied from the client-supplied ``formData.slice_id``, so
    it is not guaranteed to be an int.
    """
    try:
        return int(permalink.get("chartId") or 0) or None
    except (TypeError, ValueError):
        return None


def _permalink_form_data(permalink: ExplorePermalinkValue) -> dict[str, Any]:
    state = permalink.get("state")
    form_data = state.get("formData") if isinstance(state, dict) else None
    return dict(form_data) if isinstance(form_data, dict) else {}


def _permalink_datasource(
    permalink: ExplorePermalinkValue,
) -> tuple[str | None, str | None]:
    """Return the (name, type) of the datasource a permalink was built on.

    A permalink's form_data carries the datasource as an opaque "<id>__<type>"
    string, so the name has to be resolved from the ids the permalink stores
    alongside it. Access to that datasource was already checked by
    ``GetExplorePermalinkCommand``.
    """
    datasource_type = permalink.get("datasourceType") or DatasourceType.TABLE.value
    datasource_id = permalink.get("datasourceId") or permalink.get("datasetId")
    if not datasource_id:
        return None, str(datasource_type)
    try:
        from superset.daos.datasource import DatasourceDAO

        datasource = DatasourceDAO.get_datasource(
            datasource_type=DatasourceType(datasource_type),
            database_id_or_uuid=datasource_id,
        )
    except Exception:  # noqa: BLE001
        # A deleted or unsupported datasource must not sink the whole read;
        # the rest of the permalink state is still worth returning.
        logger.warning(
            "Could not resolve permalink datasource %s of type %s",
            datasource_id,
            datasource_type,
        )
        return None, str(datasource_type)
    # A SQL Lab query labels itself with ``name``; datasets use
    # ``datasource_name``.
    name = getattr(datasource, "datasource_name", None) or getattr(
        datasource, "name", None
    )
    return name, str(datasource_type)


def _build_permalink_chart_info(
    permalink_key: str, permalink: ExplorePermalinkValue, form_data: dict[str, Any]
) -> ChartInfo:
    """Build a ChartInfo from a permalink that is not tied to a saved chart."""
    datasource_name, datasource_type = _permalink_datasource(permalink)
    result = ChartInfo(
        datasource_name=datasource_name,
        datasource_type=datasource_type,
        form_data=form_data,
        permalink_key=permalink_key,
        is_permalink_state=True,
    )
    _update_fields_from_form_data(result)
    return result


async def _validate_chart_dataset_access(
    result: ChartInfo, ctx: Context
) -> ChartError | None:
    """Validate that the chart's dataset is accessible to the current user.

    Returns a ChartError if the dataset is not accessible, otherwise None.
    Logs any non-fatal warnings (e.g., virtual dataset warnings) via ctx.
    """
    from superset.daos.chart import ChartDAO
    from superset.mcp_service import guest_scope

    if not result.id:
        return None
    # Guests read via the dashboard context, not dataset RBAC; skip the perm-check.
    if guest_scope.is_guest_read():
        return None
    chart = ChartDAO.find_by_id(result.id)
    if not chart:
        return None
    validation_result = validate_chart_dataset(chart.datasource_id, check_access=True)
    if not validation_result.is_valid:
        await ctx.warning(
            "Chart found but dataset is not accessible: %s" % (validation_result.error,)
        )
        return ChartError(
            error=validation_result.error or "Chart's dataset is not accessible",
            error_type="DatasetNotAccessible",
        )
    for warning in validation_result.warnings:
        await ctx.warning("Dataset warning: %s" % (warning,))
    return None


async def _attach_dashboard_filters(
    result: ChartInfo, dashboard_id: int, ctx: Context
) -> ChartError | None:
    """Resolve dashboard-scoped native filters and attach them to result.filters.

    Returns a ChartError to surface to the caller on validation / access
    failures, or None on success (including the no-filters case).
    """
    if not result.id:
        return None
    with event_logger.log_context(action="mcp.get_chart_info.dashboard_filters"):
        try:
            dashboard_filters = build_applied_dashboard_filters(dashboard_id, result.id)
        except DashboardNotFoundError as exc:
            await ctx.warning("Dashboard not found: %s" % (str(exc),))
            return ChartError(error=str(exc), error_type="DashboardNotFound")
        except ChartNotOnDashboardError as exc:
            await ctx.warning("Chart not on dashboard: %s" % (str(exc),))
            return ChartError(error=str(exc), error_type="ChartNotOnDashboard")
        except SupersetSecurityException as exc:
            await ctx.warning("Dashboard not accessible: %s" % (str(exc),))
            return ChartError(error=str(exc), error_type="DashboardNotAccessible")

        if dashboard_filters:
            if result.filters is None:
                result.filters = ChartFiltersInfo(dashboard_filters=dashboard_filters)
            else:
                result.filters.dashboard_filters = dashboard_filters
    return None


def _attach_active_filters(result: ChartInfo, extra_form_data: dict[str, Any]) -> None:
    """Surface the user's live dashboard filters (forwarded as extra_form_data)
    under result.filters, so a metadata caller reports the chart as it is currently
    viewed rather than as the full unfiltered dataset. Column-based and adhoc
    filters go to active_filters and a time-range filter to active_time_range. No
    query is run; the values are echoed for awareness."""
    active: list[dict[str, Any]] = [
        clause
        for clause in (extra_form_data.get("filters") or [])
        if isinstance(clause, dict)
    ]
    active += [
        clause
        for clause in (extra_form_data.get("adhoc_filters") or [])
        if isinstance(clause, dict)
    ]
    time_range = extra_form_data.get("time_range")
    if not active and not time_range:
        return
    if result.filters is None:
        result.filters = ChartFiltersInfo()
    if active:
        result.filters.active_filters = active
    if time_range:
        result.filters.active_time_range = time_range


def _update_fields_from_form_data(result: ChartInfo) -> None:
    """Refresh viz_type, its display name and filters from result.form_data."""
    if result.form_data and "viz_type" in result.form_data:
        result.viz_type = result.form_data["viz_type"]
        if result.viz_type:
            try:
                from superset.mcp_service.chart.registry import (
                    display_name_for_viz_type,
                )

                result.chart_type_display_name = display_name_for_viz_type(
                    result.viz_type
                )
            except Exception as exc:  # noqa: BLE001
                logger.debug(
                    "Failed to resolve display name for viz_type=%r: %s",
                    result.viz_type,
                    exc,
                )

    result.filters = extract_filters_from_form_data(result.form_data)


def _apply_unsaved_state_override(result: ChartInfo, form_data_key: str) -> None:
    """Override a ChartInfo's form_data with cached unsaved state."""
    from superset.utils import json as utils_json

    if cached_form_data := get_cached_form_data(form_data_key):
        try:
            result.form_data = utils_json.loads(cached_form_data)
            result.form_data_key = form_data_key
            result.is_unsaved_state = True
            _update_fields_from_form_data(result)
        except (TypeError, ValueError) as e:
            logger.warning(
                "Failed to parse cached form_data: %s. "
                "Using saved chart configuration.",
                e,
            )
    else:
        logger.warning(
            "form_data_key provided but no cached data found. "
            "The cache may have expired. Using saved chart configuration."
        )


def _apply_permalink_state_override(
    result: ChartInfo, permalink_key: str, form_data: dict[str, Any]
) -> None:
    """Override a saved chart's form_data with the state of a permalink."""
    result.form_data = form_data
    result.permalink_key = permalink_key
    result.is_permalink_state = True
    _update_fields_from_form_data(result)


async def _load_permalink(
    permalink_key: str, ctx: Context
) -> ExplorePermalinkValue | ChartError:
    """Load an Explore permalink for get_chart_info."""
    from superset.mcp_service import guest_scope

    # Guests read through a dashboard context; an arbitrary permalink is
    # outside it.
    if guest_scope.is_guest_read():
        return ChartError(
            error="permalink_key is not supported for embedded guest access.",
            error_type="PermalinkAccessDenied",
        )
    with event_logger.log_context(action="mcp.get_chart_info.permalink"):
        permalink = _get_explore_permalink(permalink_key)
    if isinstance(permalink, ChartError):
        await ctx.warning(
            "Explore permalink lookup failed: %s" % (permalink.error_type,)
        )
    return permalink


def _merge_permalink_state(
    result: ChartInfo, permalink_key: str, permalink: ExplorePermalinkValue
) -> ChartError | None:
    """Apply a permalink's state to the saved chart it was created from."""
    permalink_chart_id = _permalink_chart_id(permalink)
    if permalink_chart_id != result.id:
        # Merging another chart's (or an unsaved session's) form_data into
        # this chart would describe a chart that does not exist.
        owner = (
            f"chart {permalink_chart_id}"
            if permalink_chart_id
            else "an unsaved Explore session"
        )
        return ChartError(
            error=(
                f"The permalink belongs to {owner}, not chart {result.id}. "
                "Omit identifier to read the permalink."
            ),
            error_type="PermalinkChartMismatch",
        )
    with event_logger.log_context(action="mcp.get_chart_info.permalink_state_override"):
        _apply_permalink_state_override(
            result, permalink_key, _permalink_form_data(permalink)
        )
    return None


def _dump_chart_info(
    result: ChartInfo, request: GetChartInfoRequest, can_view_data_model_metadata: bool
) -> ChartInfo:
    if not can_view_data_model_metadata:
        result = redact_chart_data_model_fields(result)
    if request.extra_form_data:
        _attach_active_filters(result, request.extra_form_data)
    return cast(
        ChartInfo,
        result.model_dump(
            mode="json",
            context={"select_columns": request.select_columns},
        ),
    )


@tool(
    tags=["discovery"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="Get chart info",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def get_chart_info(  # noqa: C901
    request: Annotated[
        GetChartInfoRequest,
        Field(
            description=(
                'Wrap as {"request": {"identifier": 123}}. '
                "Use ID/UUID, NOT chart name; discover IDs with list_charts. "
                "form_data_key reads unsaved state; permalink_key reads shared "
                "Explore state and makes identifier optional."
            )
        ),
    ],
    ctx: Context,
) -> ChartInfo | ChartError:
    """Get chart metadata by ID or UUID.

    IMPORTANT FOR LLM CLIENTS:
    - URL field links to the chart's explore page in Superset
    - Use numeric ID or UUID string (NOT chart name)
    - To find a chart ID, use the list_charts tool first
    - When form_data_key is provided, returns the unsaved chart configuration
      (what the user sees in Explore) instead of the saved version
    - When permalink_key is provided, returns the chart state captured in an
      Explore permalink (/explore/p/<key>/), e.g. a link a user shared or one
      returned by generate_explore_link. The chart is resolved from the
      permalink, so identifier is optional

    Example usage:
    ```json
    {
        "identifier": 123
    }
    ```

    Or with UUID:
    ```json
    {
        "identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
    }
    ```

    With unsaved state (form_data_key from Explore URL):
    ```json
    {
        "identifier": 123,
        "form_data_key": "abc123def456"
    }
    ```

    With an Explore permalink (key or full URL):
    ```json
    {
        "permalink_key": "https://superset.example.com/explore/p/abc123/"
    }
    ```

    With dashboard context to resolve applied dashboard-level filters:
    ```json
    {
        "identifier": 123,
        "dashboard_id": 45
    }
    ```
    When dashboard_id is provided, the response's filters.dashboard_filters
    lists native filters (with column, operator, and value) that are in scope
    for this chart on that dashboard.

    Returns chart details including name, type, and URL.
    """
    from superset.daos.chart import ChartDAO
    from superset.models.slice import Slice

    await ctx.info(
        "Retrieving chart information: identifier=%s, form_data_key=%s, "
        "permalink_key=%s"
        % (request.identifier, request.form_data_key, request.permalink_key)
    )
    can_view_data_model_metadata = user_can_view_data_model_metadata()

    # Handle unsaved chart (form_data_key only, no identifier)
    if not request.identifier and request.form_data_key:
        with event_logger.log_context(
            action="mcp.get_chart_info.unsaved_chart_from_cache"
        ):
            await ctx.info(
                "No chart identifier provided - retrieving unsaved chart from cache: "
                "form_data_key=%s" % (request.form_data_key,)
            )
            result = _build_unsaved_chart_info(request.form_data_key)
            if isinstance(result, ChartError):
                return result
            return _dump_chart_info(result, request, can_view_data_model_metadata)

    identifier = request.identifier
    permalink: ExplorePermalinkValue | None = None
    if request.permalink_key:
        loaded = await _load_permalink(request.permalink_key, ctx)
        if isinstance(loaded, ChartError):
            return loaded
        permalink = loaded
        if not identifier and not _permalink_chart_id(permalink):
            # The permalink captures an Explore session that was never saved as
            # a chart, so there is no saved chart to merge it into.
            return _dump_chart_info(
                _build_permalink_chart_info(
                    request.permalink_key, permalink, _permalink_form_data(permalink)
                ),
                request,
                can_view_data_model_metadata,
            )
        identifier = identifier or _permalink_chart_id(permalink)

    # At this point identifier must be set (validator ensures at least one of
    # identifier/form_data_key/permalink_key is provided, and the branches
    # without a chart returned above).
    assert identifier is not None

    # Eager load editors and tags to avoid N+1 queries during serialization
    eager_options = [
        subqueryload(Slice.editors),
        subqueryload(Slice.tags),
    ]

    with event_logger.log_context(action="mcp.get_chart_info.lookup"):
        # Resolution is guest-scoped by ChartFilter; the dataset perm-check below
        # skips guests internally.
        tool = ModelGetInfoCore(
            dao_class=ChartDAO,
            output_schema=ChartInfo,
            error_schema=ChartError,
            serializer=serialize_chart_object,
            supports_slug=False,  # Charts don't have slugs
            logger=logger,
            query_options=eager_options,
        )
        result = tool.run_tool(identifier)

    if isinstance(result, ChartInfo):
        if permalink is not None and request.permalink_key:
            if error := _merge_permalink_state(
                result, request.permalink_key, permalink
            ):
                return error
        # If form_data_key is provided, override form_data with cached version
        elif request.form_data_key:
            with event_logger.log_context(
                action="mcp.get_chart_info.unsaved_state_override"
            ):
                await ctx.info(
                    "Retrieving unsaved chart state from cache: form_data_key=%s"
                    % (request.form_data_key,)
                )
                _apply_unsaved_state_override(result, request.form_data_key)

        if not can_view_data_model_metadata:
            result = redact_chart_data_model_fields(result)

        await ctx.info(
            "Chart information retrieved successfully: chart_name=%s, "
            "is_unsaved_state=%s, is_permalink_state=%s"
            % (result.slice_name, result.is_unsaved_state, result.is_permalink_state)
        )

        # Validate the chart's dataset is accessible (skips guests internally).
        dataset_error = await _validate_chart_dataset_access(result, ctx)
        if dataset_error is not None:
            return dataset_error

        if request.dashboard_id:
            error = await _attach_dashboard_filters(result, request.dashboard_id, ctx)
            if error is not None:
                return error

        if request.extra_form_data:
            _attach_active_filters(result, request.extra_form_data)

        return cast(
            ChartInfo,
            result.model_dump(
                mode="json",
                context={"select_columns": request.select_columns},
            ),
        )
    else:
        await ctx.warning("Chart retrieval failed: error=%s" % (str(result),))

    return result
