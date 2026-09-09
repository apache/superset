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
from __future__ import annotations

import contextlib
import logging
import re
from datetime import datetime
from typing import Any, Callable, TYPE_CHECKING

from flask import current_app as app, make_response, request, Response
from flask_appbuilder.api import expose, protect
from flask_babel import gettext as _
from flask_caching.backends import NullCache
from marshmallow import ValidationError
from werkzeug.utils import secure_filename

from superset import is_feature_enabled, security_manager
from superset.charts.api import ChartRestApi
from superset.charts.client_processing import apply_client_processing
from superset.charts.data.dashboard_filter_context import (
    apply_dashboard_filter_context,
    DashboardFilterContext,
    get_dashboard_filter_context,
)
from superset.charts.data.form_data import set_form_data
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.commands.chart.data.streaming_export_command import (
    StreamingCSVExportCommand,
)
from superset.commands.chart.exceptions import (
    ChartDataCacheLoadError,
    ChartDataQueryFailedError,
)
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.chart_data_timing import ChartDataExecutionResult
from superset.connectors.sqla.models import BaseDatasource
from superset.constants import CACHE_DISABLED_TIMEOUT
from superset.daos.exceptions import DatasourceNotFound
from superset.exceptions import QueryObjectValidationError, SupersetSecurityException
from superset.extensions import cache_manager, event_logger
from superset.models.sql_lab import Query
from superset.tasks.async_queries import submit_chart_data_query_tasks
from superset.tasks.guest import get_current_guest_subscriber_key
from superset.utils import json
from superset.utils.core import (
    create_zip,
    DatasourceType,
    get_user_id,
)
from superset.utils.decorators import logs_context
from superset.utils.error_sanitization import sanitize_error_message
from superset.views.base import CsvResponse, generate_download_headers, XlsxResponse
from superset.views.base_api import statsd_metrics

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.models.slice import Slice

logger = logging.getLogger(__name__)


class ChartDataRestApi(ChartRestApi):
    include_route_methods = {"get_data", "data"}

    @expose("/<int:pk>/data/", methods=("GET",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.data",
        log_to_statsd=False,
        allow_extra_payload=True,
    )
    def get_data(  # noqa: C901
        self,
        pk: int,
        add_extra_log_payload: Callable[..., None] = lambda **kwargs: None,
    ) -> Response:
        """
        Take a chart ID and uses the query context stored when the chart was saved
        to return payload data response.
        ---
        get:
          summary: Return payload data response for a chart
          description: >-
            Takes a chart ID and uses the query context stored when the chart was saved
            to return payload data response. When filters_dashboard_id is provided,
            the chart's compiled SQL includes in scope dashboard filter
            default values.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The chart ID
          - in: query
            name: format
            description: The format in which the data should be returned
            schema:
              type: string
          - in: query
            name: type
            description: The type in which the data should be returned
            schema:
              type: string
          - in: query
            name: force
            description: Should the queries be forced to load from the source
            schema:
                type: boolean
          - in: query
            name: filters_dashboard_id
            description: >-
              Dashboard ID whose filter defaults should be applied to the
              chart's query context. The chart must belong to the specified dashboard.
              Only in scope filters with static default values are applied; filters that
              require a database query (I.E. defaultToFirstItem) or have no default are
              reported in the dashboard_filters response metadata.
            schema:
              type: integer
          responses:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataResponseSchema"
            202:
              description: Async job details
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataAsyncResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        chart = self.datamodel.get(pk, self._base_filters)
        if not chart:
            return self.response_404()

        try:
            json_body = json.loads(chart.query_context)
        except (TypeError, json.JSONDecodeError):
            json_body = None

        if json_body is None:
            return self.response_400(
                message=_(
                    "Chart has no query context saved. Please save the chart again."
                )
            )

        # override saved query context
        json_body["result_format"] = request.args.get(
            "format", ChartDataResultFormat.JSON
        )
        json_body["result_type"] = request.args.get("type", ChartDataResultType.FULL)
        json_body["force"] = request.args.get("force")

        # Apply dashboard filter context when filters_dashboard_id is provided
        dashboard_filter_context: DashboardFilterContext | None = None
        if "filters_dashboard_id" in request.args:
            raw = request.args.get("filters_dashboard_id")
            try:
                filters_dashboard_id = int(raw)
            except (ValueError, TypeError):
                return self.response_400(
                    message="filters_dashboard_id must be an integer"
                )
        else:
            filters_dashboard_id = None

        if filters_dashboard_id is not None:
            try:
                dashboard_filter_context = get_dashboard_filter_context(
                    dashboard_id=filters_dashboard_id,
                    chart_id=pk,
                )
            except ValueError as error:
                return self.response_400(message=str(error))
            except SupersetSecurityException:
                return self.response_403()

            if efd := dashboard_filter_context.extra_form_data:
                # Note: this helper currently mutates `json_body` and `efd` in place.
                # Changes won't persist as these are dicts detached from the ORM state,
                # but highlighting in case they're further used (mind the changes).
                apply_dashboard_filter_context(json_body, efd)

        # We need to apply the form data to the global context as jinja
        # templating pulls form data from the request globally, so this
        # fallback ensures it has the filters and extra_form_data applied
        # when used in get_sqla_query which constructs the final query.
        set_form_data(json_body)

        try:
            query_context = self._create_query_context_from_form(json_body)
            command = ChartDataCommand(query_context)
            command.validate()
        except DatasourceNotFound:
            return self.response_404()
        except SupersetSecurityException:
            return self.response_403()
        except QueryObjectValidationError as error:
            return self.response_400(message=error.message)
        except ValidationError as error:
            return self.response_400(
                message=_(
                    "Request is incorrect: %(error)s", error=error.normalized_messages()
                )
            )

        # TODO: support CSV, SQL query and other non-JSON types
        if self._should_run_async(json_body, query_context):
            return self._run_async(json_body, command, add_extra_log_payload)

        try:
            form_data = json.loads(chart.params)
        except (TypeError, json.JSONDecodeError):
            form_data = {}

        return self._get_data_response(
            command=command,
            form_data=form_data,
            datasource=query_context.datasource,
            add_extra_log_payload=add_extra_log_payload,
            dashboard_filter_context=dashboard_filter_context,
            slice_=chart,
        )

    @expose("/data", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.data",
        log_to_statsd=False,
        allow_extra_payload=True,
    )
    def data(  # noqa: C901
        self, add_extra_log_payload: Callable[..., None] = lambda **kwargs: None
    ) -> Response:
        """
        Take a query context constructed in the client and return payload
        data response for the given query
        ---
        post:
          summary: Return payload data response for the given query
          description: >-
            Takes a query context constructed in the client and returns payload data
            response for the given query.
          requestBody:
            description: >-
              A query context consists of a datasource from which to fetch data
              and one or many query objects.
            required: true
            content:
              application/json:
                schema:
                  $ref: "#/components/schemas/ChartDataQueryContextSchema"
          responses:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataResponseSchema"
            202:
              description: Async job details
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataAsyncResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        json_body = None
        if request.is_json:
            json_body = request.json
        elif request.form.get("form_data"):
            # CSV export submits regular form data
            with contextlib.suppress(TypeError, json.JSONDecodeError):
                json_body = json.loads(request.form["form_data"])
        if json_body is None:
            return self.response_400(message=_("Request is not JSON"))

        try:
            query_context = self._create_query_context_from_form(json_body)
            command = ChartDataCommand(query_context)
            command.validate()
        except DatasourceNotFound:
            return self.response_404()
        except SupersetSecurityException:
            return self.response_403()
        except QueryObjectValidationError as error:
            return self.response_400(message=error.message)
        except ValidationError as error:
            return self.response_400(
                message=_(
                    "Request is incorrect: %(error)s", error=error.normalized_messages()
                )
            )

        # TODO: support CSV, SQL query and other non-JSON types
        if self._should_run_async(json_body, query_context):
            return self._run_async(json_body, command, add_extra_log_payload)

        form_data = json_body.get("form_data")
        filename, expected_rows = self._extract_export_params_from_request()

        return self._get_data_response(
            command,
            form_data=form_data,
            datasource=query_context.datasource,
            add_extra_log_payload=add_extra_log_payload,
            filename=filename,
            expected_rows=expected_rows,
        )

    @staticmethod
    def _should_run_async(
        json_body: dict[str, Any],
        query_context: QueryContext,
    ) -> bool:
        """Whether this chart-data request should run asynchronously.

        Async is opt-in per request: the client sets ``async_mode`` (an absent flag
        is treated as synchronous, so programmatic API clients keep the synchronous
        200 flow). It is only available when ``GLOBAL_ASYNC_QUERIES`` is enabled, the
        result is a full JSON payload, and caching is on (async delivery reads the
        result back from the DATA cache).

        A ``NullCache`` DATA backend can never satisfy the read-back, so async is
        refused for it and the request runs synchronously — otherwise every chart
        would schedule tasks, succeed, and then loop on an uncacheable re-request.

        Async also requires a subscribe-able identity — an authenticated user or
        an embedded guest — because the task is observed/cancelled through a
        per-principal subscription (see ``superset.tasks.subscription``). A fully
        anonymous request (public dashboard viewed directly, no login and no guest
        token) has no principal, so it would schedule a task it could never poll
        or cancel; those requests run synchronously instead.

        The principal must also be able to *observe* task state: chart completion is
        read from ``GET /api/v1/task/status_changes``, which is gated by
        ``can_read Task`` (the websocket transport is likewise gated by
        ``can_read Realtime``). An authenticated Gamma user has ``Task`` by default;
        an embedded guest on the default ``Public`` role does not, so guest async
        works only when the operator grants the guest role ``can_read Task`` — and
        otherwise falls back to sync rather than returning a 202 the guest can never
        resolve. See ``UPDATING.md`` for the guest-role grants required to enable
        embedded async.

        The eligibility check reads :meth:`QueryContext.get_cache_timeout`, which
        only resolves the explicitly configured chart/dataset/database TTL. That is
        deliberately the un-floored value: only an explicit
        ``CACHE_DISABLED_TIMEOUT`` should refuse async, whereas the floored
        :meth:`QueryContextProcessor.get_cache_timeout` also folds in config
        fallbacks and the async minimum TTL that the scheduled task later applies.
        """
        return (
            bool(json_body.get("async_mode"))
            and is_feature_enabled("GLOBAL_ASYNC_QUERIES")
            and query_context.result_format == ChartDataResultFormat.JSON
            and query_context.result_type == ChartDataResultType.FULL
            and query_context.get_cache_timeout() != CACHE_DISABLED_TIMEOUT
            and not isinstance(cache_manager.data_cache.cache, NullCache)
            and (
                get_user_id() is not None
                or get_current_guest_subscriber_key() is not None
            )
            # The client must be able to read task status to observe completion;
            # otherwise the 202 is unresolvable (e.g. a guest on the default Public
            # role). Fall back to sync when it can't.
            and security_manager.can_access("can_read", "Task")
        )

    def _run_async(
        self,
        form_data: dict[str, Any],
        command: ChartDataCommand,
        add_extra_log_payload: Callable[..., None] | None = None,
    ) -> Response:
        """
        Execute command as an async query.
        """
        # First, look for the chart query results in the cache,
        # but only if we're not forcing a refresh.
        if not form_data.get("force"):
            try:
                result = command.execute(force_cached=True)
                if result is not None:
                    # Log is_cached if extra payload callback is provided.
                    # This indicates no async job was triggered - data was already
                    # cached and a synchronous response is being returned immediately.
                    self._log_is_cached(result.materialize(), add_extra_log_payload)
                    return self._send_chart_response(result)
            except ChartDataCacheLoadError:
                pass
        # Otherwise, kick off background GTF tasks (one per QueryObject) to run the
        # chart query. The client polls /api/v1/task/status_changes, aggregates the
        # tasks' statuses, and on success re-issues this same request — now served
        # synchronously from the per-query DATA cache the tasks populated.
        job = submit_chart_data_query_tasks(command.query_context, get_user_id())
        return self.response(202, **job)

    def _send_chart_response(  # noqa: C901
        self,
        result: dict[Any, Any] | ChartDataExecutionResult,
        form_data: dict[str, Any] | None = None,
        datasource: BaseDatasource | Query | None = None,
        filename: str | None = None,
        expected_rows: int | None = None,
        dashboard_filter_context: DashboardFilterContext | None = None,
        slice_: Slice | None = None,
    ) -> Response:
        if isinstance(result, ChartDataExecutionResult):
            execution_result: ChartDataExecutionResult | None = result
            materialized_result = result.materialize()
        else:
            execution_result = None
            materialized_result = result

        result_type = materialized_result["query_context"].result_type
        result_format = materialized_result["query_context"].result_format

        # Post-process the data so it matches the data presented in the chart.
        # This is needed for sending reports based on text charts that do the
        # post-processing of data, eg, the pivot table.
        if result_type == ChartDataResultType.POST_PROCESSED:
            materialized_result = apply_client_processing(
                materialized_result,
                form_data,
                datasource,
            )

        if result_format in ChartDataResultFormat.table_like():
            # Verify user has permission to export file
            if is_feature_enabled("GRANULAR_EXPORT_CONTROLS"):
                has_export_perm = security_manager.can_access(
                    "can_export_data", "Superset"
                )
            else:
                has_export_perm = security_manager.can_access("can_csv", "Superset")
            if not has_export_perm:
                return self.response_403()

            if not materialized_result["queries"]:
                return self.response_400(_("Empty query result"))

            is_csv_format = result_format == ChartDataResultFormat.CSV

            # A chart's saved query context rarely carries a slice_id in its
            # form data, so the query context factory can't resolve the slice
            # for it; routes that already hold the chart pass it explicitly
            # and the factory-resolved slice covers the rest.
            slice_ = slice_ or materialized_result["query_context"].slice_

            # Check if we should use streaming for large datasets
            if is_csv_format and self._should_use_streaming(
                materialized_result,
                form_data,
            ):
                return self._create_streaming_csv_response(
                    materialized_result,
                    form_data,
                    filename=filename,
                    expected_rows=expected_rows,
                    slice_=slice_,
                )

            export_filename = filename or self._get_default_export_filename(
                form_data, slice_
            )
            # `generate_download_headers` always appends the format extension,
            # so strip a matching one here to avoid doubled extensions (e.g.
            # "chart.csv.csv") if the caller already included it.
            export_filename = re.sub(
                r"\.(csv|xlsx|zip)$", "", export_filename, flags=re.IGNORECASE
            )

            if len(materialized_result["queries"]) == 1:
                # return single query results
                data = materialized_result["queries"][0]["data"]
                if is_csv_format:
                    return CsvResponse(
                        data, headers=generate_download_headers("csv", export_filename)
                    )

                return XlsxResponse(
                    data, headers=generate_download_headers("xlsx", export_filename)
                )

            # return multi-query results bundled as a zip file
            def _process_data(query_data: Any) -> Any:
                if result_format == ChartDataResultFormat.CSV:
                    # CSV data is already encoded to bytes by the query context
                    # processor, honoring the CSV_EXPORT encoding config.
                    if isinstance(query_data, str):
                        encoding = app.config["CSV_EXPORT"].get("encoding", "utf-8")
                        return query_data.encode(encoding)
                return query_data

            files = {
                f"query_{idx + 1}.{result_format}": _process_data(query["data"])
                for idx, query in enumerate(materialized_result["queries"])
            }
            return Response(
                create_zip(files),
                headers=generate_download_headers("zip", export_filename),
                mimetype="application/zip",
            )

        if result_format == ChartDataResultFormat.JSON:
            queries = materialized_result["queries"]
            if execution_result and app.config.get("CHART_DATA_INCLUDE_TIMING"):
                for query, query_result in zip(
                    queries, execution_result.queries, strict=True
                ):
                    query["timing"] = query_result.timing.as_public_dict()

            if security_manager.is_guest_user():
                # Guests may see the generated SQL only when the role attached to
                # their guest token has been granted "can view query on Dashboard",
                # mirroring the permission the frontend uses to expose the
                # "View query" action. Stacktraces and driver errors stay redacted
                # regardless, as those leak details of the deployment itself.
                can_view_query = security_manager.can_access(
                    "can_view_query", "Dashboard"
                )
                for query in queries:
                    if not can_view_query:
                        query.pop("query", None)
                    query.pop("stacktrace", None)
                    if query.get("error"):
                        query["error"] = sanitize_error_message(query["error"])

            payload: dict[str, Any] = {"result": queries}
            if dashboard_filter_context is not None:
                payload["dashboard_filters"] = dashboard_filter_context.to_dict()

            with event_logger.log_context(f"{self.__class__.__name__}.json_dumps"):
                response_data = json.dumps(
                    payload,
                    default=json.json_int_dttm_ser,
                    ignore_nan=True,
                )
            resp = make_response(response_data, 200)
            resp.headers["Content-Type"] = "application/json; charset=utf-8"
            return resp

        return self.response_400(message=f"Unsupported result_format: {result_format}")

    @staticmethod
    def _get_default_export_filename(
        form_data: dict[str, Any] | None,
        slice_: Slice | None = None,
    ) -> str:
        """
        Build a fallback export filename (without extension) from the chart's
        name so downloaded files are easy to identify, instead of the
        generic timestamp-only default used by ``generate_download_headers``.

        The name comes from the first usable candidate: an explicit
        ``slice_name`` in the form data, the name of the chart the export
        was requested for, the ``viz_type``, and finally a generic "export".

        Used whenever the client hasn't supplied an explicit filename, by
        both the streaming and non-streaming chart data export responses.
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        candidates = (
            form_data.get("slice_name") if form_data else None,
            slice_.slice_name if slice_ is not None else None,
            form_data.get("viz_type") if form_data else None,
        )

        chart_name = "export"
        for candidate in candidates:
            if not isinstance(candidate, str):
                continue
            # secure_filename strips a name written entirely in a non-latin
            # alphabet down to an empty string; skip such candidates so the
            # filename keeps a meaningful segment.
            if safe_candidate := secure_filename(candidate):
                chart_name = safe_candidate
                break

        # Chart names can be up to 250 characters; cap the name segment so
        # the whole filename (prefix, timestamp and extension included)
        # stays within the 255-character single-component limit common to
        # NTFS, ext4 and APFS.
        chart_name = chart_name[:150]

        return secure_filename(f"superset_{chart_name}_{timestamp}")

    def _log_is_cached(
        self,
        result: dict[str, Any],
        add_extra_log_payload: Callable[..., None] | None,
    ) -> None:
        """
        Log is_cached values from query results to event logger.

        Extracts is_cached from each query in the result and logs it.
        If there's a single query, logs the boolean value directly.
        If multiple queries, logs as a list.
        """
        if add_extra_log_payload and result and "queries" in result:
            is_cached_values = [query.get("is_cached") for query in result["queries"]]
            if len(is_cached_values) == 1:
                add_extra_log_payload(is_cached=is_cached_values[0])
            elif is_cached_values:
                add_extra_log_payload(is_cached=is_cached_values)

    @event_logger.log_this
    def _get_data_response(
        self,
        command: ChartDataCommand,
        force_cached: bool = False,
        form_data: dict[str, Any] | None = None,
        datasource: BaseDatasource | Query | None = None,
        filename: str | None = None,
        expected_rows: int | None = None,
        add_extra_log_payload: Callable[..., None] | None = None,
        dashboard_filter_context: DashboardFilterContext | None = None,
        slice_: Slice | None = None,
    ) -> Response:
        """Get data response and optionally log is_cached information."""
        try:
            result = command.execute(force_cached=force_cached)
        except ChartDataCacheLoadError as exc:
            return self.response_422(message=sanitize_error_message(exc.message))
        except ChartDataQueryFailedError as exc:
            return self.response_400(message=sanitize_error_message(exc.message))

            # Log is_cached if extra payload callback is provided
        materialized_result = result.materialize()
        if add_extra_log_payload and materialized_result.get("queries"):
            is_cached_values = [
                query.get("is_cached") for query in materialized_result["queries"]
            ]
            add_extra_log_payload(is_cached=is_cached_values)

        return self._send_chart_response(
            result,
            form_data,
            datasource,
            filename,
            expected_rows,
            dashboard_filter_context=dashboard_filter_context,
            slice_=slice_,
        )

    def _extract_export_params_from_request(self) -> tuple[str | None, int | None]:
        """Extract filename and expected_rows from request for streaming exports."""
        filename = request.form.get("filename")
        if filename:
            # Sanitize the user-supplied filename before it is used in the
            # Content-Disposition header (consistent with the generated-name
            # path). secure_filename may reduce a name consisting entirely of
            # unsupported characters to an empty string, in which case fall back
            # to the generated default downstream.
            filename = secure_filename(filename) or None
        if filename:
            logger.info("FRONTEND PROVIDED FILENAME: %s", filename)

        expected_rows = None
        if expected_rows_str := request.form.get("expected_rows"):
            try:
                expected_rows = int(expected_rows_str)
                logger.info("FRONTEND PROVIDED EXPECTED ROWS: %d", expected_rows)
            except (ValueError, TypeError):
                logger.warning("Invalid expected_rows value: %s", expected_rows_str)

        return filename, expected_rows

    def _map_form_data_datasource_to_dataset_id(
        self, form_data: dict[str, Any]
    ) -> dict[str, Any]:
        return {
            "dashboard_id": form_data.get("form_data", {}).get("dashboardId"),
            "dataset_id": (
                form_data.get("datasource", {}).get("id")
                if isinstance(form_data.get("datasource"), dict)
                and form_data.get("datasource", {}).get("type")
                == DatasourceType.TABLE.value
                else None
            ),
            "slice_id": form_data.get("form_data", {}).get("slice_id"),
        }

    @logs_context(context_func=_map_form_data_datasource_to_dataset_id)
    def _create_query_context_from_form(
        self, form_data: dict[str, Any]
    ) -> QueryContext:
        """
        Create the query context from the form data.

        :param form_data: The chart form data
        :returns: The query context
        :raises ValidationError: If the request is incorrect
        """

        try:
            return ChartDataQueryContextSchema().load(form_data)
        except KeyError as ex:
            raise ValidationError("Request is incorrect") from ex

    def _should_use_streaming(
        self, result: dict[Any, Any], form_data: dict[str, Any] | None = None
    ) -> bool:
        """Determine if streaming should be used based on actual row count threshold."""
        query_context = result["query_context"]
        result_format = query_context.result_format

        # Only support CSV streaming currently
        if result_format.lower() != "csv":
            return False

        # Get streaming threshold from config
        threshold = app.config.get("CSV_STREAMING_ROW_THRESHOLD", 100000)

        # Extract actual row count (same logic as frontend)
        actual_row_count: int | None = None
        viz_type = form_data.get("viz_type") if form_data else None

        # For table viz, try to get actual row count from query results
        if viz_type == "table" and result.get("queries"):
            # Check if we have rowcount in the second query result (like frontend does)
            queries = result.get("queries", [])
            if len(queries) > 1 and queries[1].get("data"):
                data = queries[1]["data"]
                if isinstance(data, list) and len(data) > 0:
                    rowcount = data[0].get("rowcount")
                    actual_row_count = int(rowcount) if rowcount else None

        # Fallback to row_limit if actual count not available
        if actual_row_count is None:
            if form_data and "row_limit" in form_data:
                row_limit = form_data.get("row_limit", 0)
                actual_row_count = int(row_limit) if row_limit else 0
            elif query_context.form_data and "row_limit" in query_context.form_data:
                row_limit = query_context.form_data.get("row_limit", 0)
                actual_row_count = int(row_limit) if row_limit else 0

        # Use streaming if row count meets or exceeds threshold
        return actual_row_count is not None and actual_row_count >= threshold

    def _create_streaming_csv_response(
        self,
        result: dict[Any, Any],
        form_data: dict[str, Any] | None = None,
        filename: str | None = None,
        expected_rows: int | None = None,
        slice_: Slice | None = None,
    ) -> Response:
        """Create a streaming CSV response for large datasets."""
        query_context = result["query_context"]

        # Use filename from frontend if provided, otherwise generate one
        if not filename:
            filename = f"{self._get_default_export_filename(form_data, slice_)}.csv"
        else:
            # Sanitize the client-provided filename before placing it in the
            # Content-Disposition header to avoid header/path injection.
            filename = secure_filename(filename) or "export.csv"

        logger.info("Creating streaming CSV response: %s", filename)
        if expected_rows:
            logger.info("Using expected_rows from frontend: %d", expected_rows)

        # Execute streaming command
        # TODO: Make chunk size configurable via SUPERSET_CONFIG
        chunk_size = 1024
        command = StreamingCSVExportCommand(query_context, chunk_size)
        command.validate()

        # Get the callable that returns the generator
        csv_generator_callable = command.run()

        # Get encoding from config
        encoding = app.config.get("CSV_EXPORT", {}).get("encoding", "utf-8")

        # Create response with streaming headers
        response = Response(
            csv_generator_callable(),  # Call the callable to get generator
            # Use content_type (not mimetype) so the charset is set verbatim;
            # passing a charset via mimetype makes Werkzeug append a second
            # charset, producing a malformed doubled Content-Type header.
            content_type=f"text/csv; charset={encoding}",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            },
            direct_passthrough=False,  # Flask must iterate generator
        )

        # Force chunked transfer encoding
        response.implicit_sequence_conversion = False

        return response
