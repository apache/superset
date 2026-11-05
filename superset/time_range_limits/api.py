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

import dataclasses
import logging
from datetime import datetime
from typing import Any, TYPE_CHECKING

from flask import g, request, Response
from flask_appbuilder.api import expose, protect, safe
from flask_babel import gettext as _
from marshmallow import ValidationError
from werkzeug.exceptions import HTTPException

from superset import security_manager
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.commands.exceptions import CommandException, CommandInvalidError
from superset.daos.exceptions import DatasourceNotFound
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    QueryObjectValidationError,
    SupersetErrorException,
    SupersetErrorsException,
)
from superset.extensions import event_logger
from superset.time_range_limits.enforcement import (
    request_date_ranges,
    RequestRanges,
    SourcedRange,
)
from superset.time_range_limits.notice import acknowledge_editor_notice
from superset.time_range_limits.policy import (
    FEATURE_FLAG,
    global_limits_payload,
    midnight,
    server_timezone,
    TimeRangeLimitsUnavailableError,
    unavailable_error,
    without_stored_value,
)
from superset.time_range_limits.schemas import (
    ChartRangesRequestSchema,
    ChartRangesResponseSchema,
    TimeRangeLimitsResponseSchema,
)
from superset.utils.core import DatasourceType, error_msg_from_exception, get_user_id
from superset.utils.error_sanitization import sanitize_superset_errors
from superset.views.base_api import (
    BaseSupersetApi,
    statsd_metrics,
    validate_feature_flags,
)
from superset.views.error_handling import (
    get_error_level_from_status,
    json_error_response,
)

if TYPE_CHECKING:
    from superset.explorables.base import Explorable

logger = logging.getLogger(__name__)


class TimeRangeLimitsRestApi(BaseSupersetApi):
    method_permission_name = {"get": "read"}
    allow_browser_login = True
    class_permission_name = "TimeRangeLimits"
    resource_name = "time_range_limits"
    openapi_spec_tag = "Time Range Limits"
    openapi_spec_component_schemas = (TimeRangeLimitsResponseSchema,)

    @expose("/", methods=("GET",))
    @validate_feature_flags([FEATURE_FLAG])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=True,
    )
    def get(self) -> Response:
        """
        Get the global time range limits and the time grains a rule may use.
        ---
        get:
          summary: Get the global time range limits
          responses:
            200:
              description: The global time range limits
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/TimeRangeLimitsResponseSchema'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            503:
              $ref: '#/components/responses/503'
        """
        try:
            return self.response(200, result=global_limits_payload())
        except TimeRangeLimitsUnavailableError as ex:
            return json_error_response([ex.error], status=ex.status)


def _errors(errors: list[SupersetError]) -> dict[str, Any]:
    return {
        "errors": [
            dataclasses.asdict(error) for error in sanitize_superset_errors(errors)
        ]
    }


def _chart_data_error(ex: Exception) -> tuple[int, dict[str, Any]]:
    """
    The status and JSON body ``POST /api/v1/chart/data`` answers when building or
    checking its query context raises ``ex``: its own mapping, then the JSON of
    the app's error handlers.
    """
    if isinstance(ex, DatasourceNotFound):
        return 404, {"message": "Not found"}
    if isinstance(ex, QueryObjectValidationError):
        return 400, {"message": ex.message}
    if isinstance(ex, ValidationError):
        return 400, {
            "message": _(
                "Request is incorrect: %(error)s", error=ex.normalized_messages()
            )
        }
    if isinstance(ex, SupersetErrorException):
        return ex.status, _errors([ex.error])
    if isinstance(ex, SupersetErrorsException):
        return ex.status, _errors(ex.errors)
    if isinstance(ex, CommandException):
        return ex.status, _errors(
            [
                SupersetError(
                    message=ex.message,
                    error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                    level=get_error_level_from_status(ex.status),
                    extra=ex.normalized_messages()
                    if isinstance(ex, CommandInvalidError)
                    else {},
                )
            ]
        )
    status = (ex.code or 500) if isinstance(ex, HTTPException) else 500
    return status, _errors(
        [
            SupersetError(
                message=error_msg_from_exception(ex),
                error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
                level=ErrorLevel.ERROR,
            )
        ]
    )


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _range(query_index: int, sourced: SourcedRange) -> dict[str, Any]:
    since, until, offset, origins = sourced
    return {
        "since": _iso(since),
        "until": _iso(until),
        "time_offset": offset,
        "source": [
            {"kind": kind, "query_index": query_index, "index": index}
            for kind, index in origins
        ]
        or None,
    }


def _answer(key: Any, found: RequestRanges, datasource: Explorable) -> dict[str, Any]:
    if found.dashboard_unreadable:
        return _error_answer(
            key,
            503,
            _errors([unavailable_error(source="dashboard", field="dashboardId")]),
        )
    return {
        "key": key,
        "status": "ok",
        "ranges": [_range(index, sourced) for index, sourced in found.ranges],
        "dataset_id": datasource.id
        if datasource.type == DatasourceType.TABLE
        else None,
        "dashboard_id": found.dashboard.id if found.dashboard is not None else None,
    }


def _error_answer(key: Any, status: int, body: dict[str, Any]) -> dict[str, Any]:
    return {"key": key, "status": "error", "error": {"status": status, "body": body}}


def _modern_ranges(key: Any, body: Any) -> dict[str, Any]:
    """
    One modern chart's answer: its query context built and its access checked
    as ``POST /api/v1/chart/data`` does (``QueryContextProcessor.raise_for_access``
    up to the time range limits check), then its ranges.
    """
    try:
        try:
            query_context = ChartDataQueryContextSchema().load(body)
        except KeyError as ex:
            raise ValidationError("Request is incorrect") from ex
        datasource = query_context.datasource
        if datasource.type == DatasourceType.QUERY:
            security_manager.raise_for_access(query=datasource, allow_editorship=False)
        else:
            security_manager.raise_for_access(query_context=query_context)
        for query in query_context.queries:
            query.validate()
        found = request_date_ranges(query_context)
    except Exception as ex:  # pylint: disable=broad-except
        logger.info("Chart ranges of %s not read", key, exc_info=True)
        return _error_answer(key, *_chart_data_error(ex))
    return _answer(key, found, datasource)


class ChartRangesRestApi(BaseSupersetApi):
    """The time ranges chart data requests will be checked against, on the
    chart data route's own permission."""

    method_permission_name = {"chart_ranges": "read"}
    allow_browser_login = True
    class_permission_name = "Chart"
    resource_name = "time_range_limits"
    openapi_spec_tag = "Time Range Limits"
    openapi_spec_component_schemas = (
        ChartRangesRequestSchema,
        ChartRangesResponseSchema,
    )

    @expose("/chart_ranges/", methods=("POST",))
    @validate_feature_flags([FEATURE_FLAG])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.chart_ranges",
        log_to_statsd=False,
    )
    def chart_ranges(self) -> Response:
        """
        Get the time ranges each chart's data request will be checked against.
        ---
        post:
          summary: Get the time ranges of chart data requests, without running them
          description: >-
            Each entry is the body a chart sends to its data route. Each chart
            gets its ranges, as the time range limits check of that route
            reads them, or the status and body that route answers with. No
            query runs.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ChartRangesRequestSchema'
          responses:
            200:
              description: Each chart's ranges or error, and the server clock
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/ChartRangesResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        body = request.get_json(silent=True)
        if body is None:
            return self.response_400(message=_("Request is not JSON"))
        try:
            charts = ChartRangesRequestSchema().load(body)["charts"]
        except ValidationError as error:
            return self.response_400(message=error.messages)
        answers = []
        for entry in charts:
            entry = entry if isinstance(entry, dict) else {}
            answers.append(_modern_ranges(entry.get("key"), entry.get("query_context")))
        # Read after every range is built, as the query check reads it after its
        # ranges, so the call's own run time never breaks a look-forward bound.
        now = datetime.now()
        return self.response(
            200,
            result={
                "now": now.isoformat(),
                "today": midnight(now).isoformat(),
                "timezone": server_timezone(now),
                "charts": answers,
            },
        )


class EditorNoticeRestApi(BaseSupersetApi):
    """Acknowledge the time range limits notice, on the dashboard read
    permission every dashboard editor has."""

    method_permission_name = {"put_notice": "read"}
    allow_browser_login = True
    class_permission_name = "Dashboard"
    resource_name = "time_range_limits"
    openapi_spec_tag = "Time Range Limits"

    @expose("/notice/", methods=("PUT",))
    @validate_feature_flags([FEATURE_FLAG])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put_notice",
        log_to_statsd=False,
    )
    def put_notice(self) -> Response:
        """
        Acknowledge the time range limits notice.
        ---
        put:
          summary: Acknowledge the time range limits notice
          description: >-
            Stores the current global time range limits as the ones the
            current user acknowledged, so their editor notice hides until the
            limits get stricter. The request body is ignored.
          responses:
            200:
              description: The limits are acknowledged
              content:
                application/json:
                  schema:
                    type: object
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            503:
              $ref: '#/components/responses/503'
        """
        user_id = get_user_id()
        if security_manager.is_guest_user() or g.user.is_anonymous or user_id is None:
            return self.response_403()
        try:
            acknowledge_editor_notice(user_id)
        except TimeRangeLimitsUnavailableError as ex:
            return json_error_response(
                [without_stored_value(ex.error)], status=ex.status
            )
        return self.response(200)
