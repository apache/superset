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
MCP tool: get_chart_sql
"""

import logging
from typing import Any, TYPE_CHECKING

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

if TYPE_CHECKING:
    from superset.models.slice import Slice

from superset.commands.exceptions import CommandException
from superset.commands.explore.form_data.parameters import CommandParameters
from superset.exceptions import SupersetException
from superset.extensions import event_logger
from superset.mcp_service.chart.chart_utils import validate_chart_dataset
from superset.mcp_service.chart.schemas import (
    ChartError,
    ChartSql,
    GetChartSqlRequest,
)
from superset.mcp_service.utils.schema_utils import parse_request

logger = logging.getLogger(__name__)


def _get_cached_form_data(form_data_key: str) -> str | None:
    """Retrieve form_data from cache using form_data_key.

    Returns the JSON string of form_data if found, None otherwise.
    """
    from superset.commands.explore.form_data.get import GetFormDataCommand

    try:
        cmd_params = CommandParameters(key=form_data_key)
        return GetFormDataCommand(cmd_params).run()
    except (KeyError, ValueError, CommandException) as e:
        logger.warning("Failed to retrieve form_data from cache: %s", e)
        return None


def _build_query_context_from_form_data(
    form_data: dict[str, Any],
    chart: "Slice | None" = None,
) -> Any:
    """Build a QueryContext from form_data with result_type=QUERY.

    This constructs a query context that will return the rendered SQL
    instead of executing the query.
    """
    from superset.common.chart_data import ChartDataResultType
    from superset.common.query_context_factory import QueryContextFactory

    factory = QueryContextFactory()

    datasource_id = form_data.get("datasource_id")
    datasource_type = form_data.get("datasource_type")

    # Unsaved Explore state often stores datasource as a combined field
    # like "123__table" instead of separate datasource_id/datasource_type.
    if not datasource_id and (combined := form_data.get("datasource")):
        if isinstance(combined, str) and "__" in combined:
            parts = combined.split("__", 1)
            datasource_id = int(parts[0]) if parts[0].isdigit() else parts[0]
            datasource_type = parts[1] if len(parts) > 1 else None

    if not datasource_id and chart:
        datasource_id = getattr(chart, "datasource_id", None)
    if not datasource_type and chart:
        datasource_type = getattr(chart, "datasource_type", None)

    viz_type = form_data.get(
        "viz_type", getattr(chart, "viz_type", "") if chart else ""
    )

    singular_metric_no_groupby = (
        "big_number",
        "big_number_total",
        "pop_kpi",
    )
    if viz_type in singular_metric_no_groupby:
        metrics = [metric] if (metric := form_data.get("metric")) else []
        groupby: list[str] = []
    else:
        metrics = form_data.get("metrics", [])
        groupby = list(form_data.get("groupby") or [])

    query_dict: dict[str, Any] = {
        "filters": form_data.get("filters", []),
        "columns": groupby,
        "metrics": metrics,
        "order_desc": form_data.get("order_desc", True),
    }

    if (row_limit := form_data.get("row_limit")) is not None:
        query_dict["row_limit"] = row_limit

    if adhoc := form_data.get("adhoc_filters"):
        query_dict["adhoc_filters"] = adhoc

    # Ensure datasource fields satisfy DatasourceDict typing requirements.
    # datasource_id must be int | str; datasource_type must be str.
    if not isinstance(datasource_id, (int, str)):
        raise ValueError(
            "Cannot determine datasource ID from form_data. "
            "Provide a chart identifier or ensure form_data contains "
            "'datasource_id' or 'datasource'."
        )
    resolved_id: int | str = datasource_id
    resolved_type: str = (
        datasource_type if isinstance(datasource_type, str) else "table"
    )

    return factory.create(
        datasource={"id": resolved_id, "type": resolved_type},
        queries=[query_dict],
        form_data=form_data,
        result_type=ChartDataResultType.QUERY,
        force=False,
    )


def _find_chart_by_identifier(
    identifier: int | str,
) -> "Slice | None":
    """Look up a chart by numeric ID or UUID string."""
    from superset.daos.chart import ChartDAO

    if isinstance(identifier, int) or (
        isinstance(identifier, str) and identifier.isdigit()
    ):
        chart_id = int(identifier) if isinstance(identifier, str) else identifier
        return ChartDAO.find_by_id(chart_id)
    if isinstance(identifier, str):
        return ChartDAO.find_by_id(identifier, id_column="uuid")
    return None


def _resolve_effective_form_data(
    chart: "Slice",
    form_data_key: str | None,
) -> tuple[dict[str, Any], bool]:
    """Resolve the effective form_data for a chart.

    Returns (form_data_dict, using_unsaved_state).
    """
    from superset.utils import json as utils_json

    if form_data_key:
        if cached_raw := _get_cached_form_data(form_data_key):
            try:
                parsed = utils_json.loads(cached_raw)
                if isinstance(parsed, dict):
                    return parsed, True
            except (TypeError, ValueError):
                pass

    try:
        saved = utils_json.loads(chart.params) if chart.params else {}
    except (TypeError, ValueError):
        saved = {}
    return saved if isinstance(saved, dict) else {}, False


def _sql_from_saved_query_context(
    chart: "Slice",
) -> ChartSql | ChartError | None:
    """Try to extract SQL from a chart's saved query_context.

    Returns None if the chart has no query_context or parsing fails.
    """
    from superset.charts.schemas import ChartDataQueryContextSchema
    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.common.chart_data import ChartDataResultType
    from superset.utils import json as utils_json

    if not chart.query_context:
        return None

    try:
        qc_json = utils_json.loads(chart.query_context)
        qc_json["result_type"] = ChartDataResultType.QUERY
        qc_json["force"] = False

        query_context = ChartDataQueryContextSchema().load(qc_json)
        query_context.result_type = ChartDataResultType.QUERY

        command = ChartDataCommand(query_context)
        command.validate()
        result = command.run()

        return _extract_sql_from_result(
            result, chart.id, chart.slice_name, chart.datasource_name
        )
    except (SupersetException, CommandException, TypeError, ValueError):
        return None


def _sql_from_form_data(
    form_data: dict[str, Any],
    chart: "Slice | None",
) -> ChartSql | ChartError:
    """Build SQL from form_data (fallback path)."""
    from superset.commands.chart.data.get_data_command import ChartDataCommand

    query_context = _build_query_context_from_form_data(form_data, chart)
    command = ChartDataCommand(query_context)
    command.validate()
    result = command.run()

    return _extract_sql_from_result(
        result,
        chart_id=getattr(chart, "id", None),
        chart_name=getattr(chart, "slice_name", None),
        datasource_name=getattr(chart, "datasource_name", None),
    )


def _extract_sql_from_result(
    result: dict[str, Any],
    chart_id: int | None,
    chart_name: str | None,
    datasource_name: str | None,
) -> ChartSql | ChartError:
    """Extract SQL query string from the ChartDataCommand result."""
    queries = result.get("queries", [])
    if not queries:
        return ChartError(
            error=(
                "No query results returned. The chart may have an empty configuration."
            ),
            error_type="EmptyQuery",
        )

    query_result = queries[0]
    sql = query_result.get("query", "")
    language = query_result.get("language", "sql")
    error = query_result.get("error")

    if not sql and error:
        return ChartError(
            error=f"SQL generation failed: {error}",
            error_type="QueryGenerationFailed",
        )

    return ChartSql(
        chart_id=chart_id,
        chart_name=chart_name,
        sql=sql,
        language=language,
        datasource_name=datasource_name,
        error=error,
    )


@tool(
    tags=["data"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="Get chart SQL",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
@parse_request(GetChartSqlRequest)
async def get_chart_sql(
    request: GetChartSqlRequest, ctx: Context
) -> ChartSql | ChartError:
    """Get the rendered SQL query for a chart without executing it.

    Returns the SQL that a chart would execute, similar to the "View Query"
    feature in the Superset UI. Useful for understanding, debugging, or
    auditing the SQL generated by a chart's configuration.

    Supports:
    - Numeric ID or UUID lookup
    - form_data_key: get SQL for unsaved chart state from Explore view

    Example usage:
    ```json
    {
        "identifier": 123
    }
    ```

    Returns the SQL query string and metadata about the chart.
    """
    await ctx.info(
        "Starting chart SQL retrieval: identifier=%s, form_data_key=%s"
        % (request.identifier, request.form_data_key)
    )

    try:
        return await _handle_chart_sql_request(request, ctx)
    except SupersetException as e:
        logger.exception("Superset error in get_chart_sql")
        return ChartError(
            error=f"Superset error: {e}",
            error_type="SupersetError",
        )


async def _handle_chart_sql_request(
    request: GetChartSqlRequest, ctx: Context
) -> ChartSql | ChartError:
    """Core logic for get_chart_sql, extracted for complexity."""
    # Handle unsaved chart (form_data_key only, no identifier)
    if not request.identifier and request.form_data_key:
        return await _handle_unsaved_chart_sql(request.form_data_key, ctx)

    # Find the chart by identifier
    if request.identifier is None:
        return ChartError(
            error="Chart identifier is required.",
            error_type="ValidationError",
        )
    with event_logger.log_context(action="mcp.get_chart_sql.chart_lookup"):
        chart = _find_chart_by_identifier(request.identifier)

    if not chart:
        return ChartError(
            error=f"No chart found with identifier: {request.identifier}",
            error_type="NotFound",
        )

    await ctx.info(
        "Chart found: chart_id=%s, chart_name=%s, viz_type=%s"
        % (chart.id, chart.slice_name, chart.viz_type)
    )

    # Validate the chart's dataset is accessible
    validation_result = validate_chart_dataset(chart, check_access=True)
    if not validation_result.is_valid:
        await ctx.warning(
            "Chart found but dataset is not accessible: %s" % (validation_result.error,)
        )
        return ChartError(
            error=validation_result.error or "Chart's dataset is not accessible.",
            error_type="DatasetNotAccessible",
        )
    for warning in validation_result.warnings:
        await ctx.warning("Dataset warning: %s" % (warning,))

    # Resolve effective form_data
    effective_form_data, using_unsaved_state = _resolve_effective_form_data(
        chart, request.form_data_key
    )

    # Try saved query_context first (faster, more accurate)
    with event_logger.log_context(action="mcp.get_chart_sql.build_query"):
        if not using_unsaved_state:
            saved_result = _sql_from_saved_query_context(chart)
            if saved_result is not None:
                return saved_result
            await ctx.warning(
                "Could not extract SQL from saved query_context. "
                "Falling back to form_data."
            )

        # Fallback: build query context from form_data
        try:
            return _sql_from_form_data(effective_form_data, chart)
        except (SupersetException, CommandException, ValueError) as e:
            await ctx.warning("Failed to build SQL from form_data: %s" % str(e))
            return ChartError(
                error="Failed to generate SQL for chart %s: %s" % (chart.id, e),
                error_type="QueryGenerationFailed",
            )


async def _handle_unsaved_chart_sql(
    form_data_key: str, ctx: Context
) -> ChartSql | ChartError:
    """Handle SQL retrieval for unsaved charts (form_data_key only)."""
    from superset.utils import json as utils_json

    with event_logger.log_context(action="mcp.get_chart_sql.unsaved_chart_from_cache"):
        await ctx.info(
            "No chart identifier - getting SQL from unsaved chart cache: "
            "form_data_key=%s" % (form_data_key,)
        )
        cached_form_data = _get_cached_form_data(form_data_key)
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

        try:
            return _sql_from_form_data(form_data, chart=None)
        except (SupersetException, CommandException, ValueError) as e:
            await ctx.warning("Failed to generate SQL from form_data: %s" % str(e))
            return ChartError(
                error="Failed to generate SQL from cached form_data: %s" % str(e),
                error_type="QueryGenerationFailed",
            )
