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
import logging
from typing import Any

from flask import g, request, Response
from flask_appbuilder.api import expose, permission_name, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext
from marshmallow import ValidationError

from superset.charts.filters import ChartFilter
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.dashboards.filters import DashboardFilter
from superset.databases.filters import DatabaseFilter
from superset.models.reports import ReportSchedule
from superset.reports.commands.bulk_delete import BulkDeleteReportScheduleCommand
from superset.reports.commands.create import CreateReportScheduleCommand
from superset.reports.commands.delete import DeleteReportScheduleCommand
from superset.reports.commands.exceptions import (
    ReportScheduleBulkDeleteFailedError,
    ReportScheduleCreateFailedError,
    ReportScheduleDeleteFailedError,
    ReportScheduleForbiddenError,
    ReportScheduleInvalidError,
    ReportScheduleNotFoundError,
    ReportScheduleUpdateFailedError,
)
from superset.reports.commands.update import UpdateReportScheduleCommand
from superset.reports.filters import ReportScheduleAllTextFilter
from superset.reports.schemas import (
    get_delete_ids_schema,
    openapi_spec_methods_override,
    ReportSchedulePostSchema,
    ReportSchedulePutSchema,
)
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    statsd_metrics,
)
from superset.views.filters import FilterRelatedOwners

logger = logging.getLogger(__name__)


class ReportScheduleRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(ReportSchedule)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.RELATED,
        "bulk_delete",  # not using RouteMethod since locally defined
    }
    class_permission_name = "ReportSchedule"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    resource_name = "report"
    allow_browser_login = True

    show_columns = [
        "id",
        "active",
        "chart.id",
        "chart.slice_name",
        "context_markdown",
        "crontab",
        "dashboard.dashboard_title",
        "dashboard.id",
        "database.database_name",
        "database.id",
        "description",
        "grace_period",
        "last_eval_dttm",
        "last_state",
        "last_value",
        "last_value_row_json",
        "log_retention",
        "name",
        "owners.first_name",
        "owners.id",
        "owners.last_name",
        "recipients.id",
        "recipients.recipient_config_json",
        "recipients.type",
        "report_format",
        "sql",
        "type",
        "validator_config_json",
        "validator_type",
        "working_timeout",
    ]
    show_select_columns = show_columns + [
        "chart.datasource_id",
        "chart.datasource_type",
    ]
    list_columns = [
        "active",
        "changed_by.first_name",
        "changed_by.last_name",
        "changed_on",
        "changed_on_delta_humanized",
        "created_by.first_name",
        "created_by.last_name",
        "created_on",
        "crontab",
        "crontab_humanized",
        "id",
        "last_eval_dttm",
        "last_state",
        "name",
        "owners.first_name",
        "owners.id",
        "owners.last_name",
        "recipients.id",
        "recipients.type",
        "type",
    ]
    add_columns = [
        "active",
        "chart",
        "context_markdown",
        "crontab",
        "dashboard",
        "database",
        "description",
        "grace_period",
        "log_retention",
        "name",
        "owners",
        "recipients",
        "report_format",
        "sql",
        "type",
        "validator_config_json",
        "validator_type",
        "working_timeout",
    ]
    edit_columns = add_columns
    add_model_schema = ReportSchedulePostSchema()
    edit_model_schema = ReportSchedulePutSchema()

    order_columns = [
        "active",
        "created_by.first_name",
        "changed_by.first_name",
        "changed_on",
        "changed_on_delta_humanized",
        "created_on",
        "crontab",
        "last_eval_dttm",
        "name",
        "type",
        "crontab_humanized",
    ]
    search_columns = ["name", "active", "created_by", "type", "last_state"]
    search_filters = {"name": [ReportScheduleAllTextFilter]}
    allowed_rel_fields = {"owners", "chart", "dashboard", "database", "created_by"}
    filter_rel_fields = {
        "chart": [["id", ChartFilter, lambda: []]],
        "dashboard": [["id", DashboardFilter, lambda: []]],
        "database": [["id", DatabaseFilter, lambda: []]],
    }
    text_field_rel_fields = {
        "dashboard": "dashboard_title",
        "chart": "slice_name",
        "database": "database_name",
    }
    related_field_filters = {
        "dashboard": "dashboard_title",
        "chart": "slice_name",
        "database": "database_name",
        "owners": RelatedFieldFilter("first_name", FilterRelatedOwners),
    }

    apispec_parameter_schemas = {
        "get_delete_ids_schema": get_delete_ids_schema,
    }
    openapi_spec_tag = "Report Schedules"
    openapi_spec_methods = openapi_spec_methods_override

    @expose("/<int:pk>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @permission_name("delete")
    def delete(self, pk: int) -> Response:
        """Delete a Report Schedule
        ---
        delete:
          description: >-
            Delete a Report Schedule
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The report schedule pk
          responses:
            200:
              description: Item deleted
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            DeleteReportScheduleCommand(g.user, pk).run()
            return self.response(200, message="OK")
        except ReportScheduleNotFoundError:
            return self.response_404()
        except ReportScheduleForbiddenError:
            return self.response_403()
        except ReportScheduleDeleteFailedError as ex:
            logger.error(
                "Error deleting report schedule %s: %s",
                self.__class__.__name__,
                str(ex),
            )
            return self.response_422(message=str(ex))

    @expose("/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @permission_name("post")
    def post(self) -> Response:
        """Creates a new Report Schedule
        ---
        post:
          description: >-
            Create a new Report Schedule
          requestBody:
            description: Report Schedule schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Report schedule added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            new_model = CreateReportScheduleCommand(g.user, item).run()
            return self.response(201, id=new_model.id, result=item)
        except ReportScheduleNotFoundError as ex:
            return self.response_400(message=str(ex))
        except ReportScheduleInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except ReportScheduleCreateFailedError as ex:
            logger.error(
                "Error creating report schedule %s: %s",
                self.__class__.__name__,
                str(ex),
            )
            return self.response_422(message=str(ex))

    @expose("/<int:pk>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @permission_name("put")
    def put(self, pk: int) -> Response:  # pylint: disable=too-many-return-statements
        """Updates an Report Schedule
        ---
        put:
          description: >-
            Updates a Report Schedule
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The Report Schedule pk
          requestBody:
            description: Report Schedule schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Report Schedule changed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
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
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.edit_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            new_model = UpdateReportScheduleCommand(g.user, pk, item).run()
            return self.response(200, id=new_model.id, result=item)
        except ReportScheduleNotFoundError:
            return self.response_404()
        except ReportScheduleInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except ReportScheduleForbiddenError:
            return self.response_403()
        except ReportScheduleUpdateFailedError as ex:
            logger.error(
                "Error updating report %s: %s", self.__class__.__name__, str(ex)
            )
            return self.response_422(message=str(ex))

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_delete_ids_schema)
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Delete bulk Report Schedule layers
        ---
        delete:
          description: >-
            Deletes multiple report schedules in a bulk operation.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: Report Schedule bulk delete
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item_ids = kwargs["rison"]
        try:
            BulkDeleteReportScheduleCommand(g.user, item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d report schedule",
                    "Deleted %(num)d report schedules",
                    num=len(item_ids),
                ),
            )
        except ReportScheduleNotFoundError:
            return self.response_404()
        except ReportScheduleForbiddenError:
            return self.response_403()
        except ReportScheduleBulkDeleteFailedError as ex:
            return self.response_422(message=str(ex))
