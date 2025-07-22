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
from datetime import datetime
from io import BytesIO
from typing import Any
from zipfile import ZipFile

from flask import request, Response, send_file
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext
from marshmallow import ValidationError

from superset.commands.theme.delete import DeleteThemeCommand
from superset.commands.theme.exceptions import (
    SystemThemeProtectedError,
    ThemeDeleteFailedError,
    ThemeNotFoundError,
)
from superset.commands.theme.export import ExportThemesCommand
from superset.commands.theme.update import UpdateThemeCommand
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.extensions import event_logger
from superset.models.core import Theme
from superset.themes.filters import ThemeAllTextFilter
from superset.themes.schemas import (
    get_delete_ids_schema,
    get_export_ids_schema,
    openapi_spec_methods_override,
    ThemePostSchema,
    ThemePutSchema,
)
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    statsd_metrics,
)
from superset.views.filters import BaseFilterRelatedUsers, FilterRelatedOwners

logger = logging.getLogger(__name__)


class ThemeRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Theme)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        RouteMethod.IMPORT,
        RouteMethod.RELATED,
        "bulk_delete",  # not using RouteMethod since locally defined
    }
    class_permission_name = "Theme"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    resource_name = "theme"
    allow_browser_login = True

    show_columns = [
        "changed_on_delta_humanized",
        "changed_by.first_name",
        "changed_by.id",
        "changed_by.last_name",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "json_data",
        "id",
        "is_system",
        "theme_name",
        "uuid",
    ]
    list_columns = [
        "changed_on_delta_humanized",
        "changed_by.first_name",
        "changed_by.id",
        "changed_by.last_name",
        "changed_by_name",
        "created_on",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "json_data",
        "id",
        "is_system",
        "theme_name",
        "uuid",
    ]

    list_select_columns = list_columns + ["changed_on", "created_on", "changed_by_fk"]
    add_columns = ["json_data", "theme_name"]
    edit_columns = add_columns
    order_columns = ["theme_name"]

    add_model_schema = ThemePostSchema()
    edit_model_schema = ThemePutSchema()

    search_filters = {"theme_name": [ThemeAllTextFilter]}
    allowed_rel_fields = {"created_by", "changed_by"}

    apispec_parameter_schemas = {
        "get_delete_ids_schema": get_delete_ids_schema,
        "get_export_ids_schema": get_export_ids_schema,
    }
    openapi_spec_tag = "Themes"
    openapi_spec_methods = openapi_spec_methods_override

    related_field_filters = {
        "changed_by": RelatedFieldFilter("first_name", FilterRelatedOwners),
    }
    base_related_field_filters = {
        "changed_by": [["id", BaseFilterRelatedUsers, lambda: []]],
    }

    @expose("/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    @rison(get_delete_ids_schema)
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Bulk delete themes.
        ---
        delete:
          summary: Bulk delete themes
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: Themes bulk delete
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item_ids = kwargs["rison"]
        try:
            DeleteThemeCommand(item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d theme",
                    "Deleted %(num)d themes",
                    num=len(item_ids),
                ),
            )
        except ThemeNotFoundError:
            return self.response_404()
        except SystemThemeProtectedError as ex:
            return self.response_403(message=str(ex))
        except ThemeDeleteFailedError as ex:
            return self.response_422(message=str(ex))

    @expose("/<int:pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    def put(self, pk: int) -> Response:
        """Update a theme.
        ---
        put:
          summary: Update a theme
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Theme schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ThemeRestApi.put'
          responses:
            200:
              description: Theme updated
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/ThemeRestApi.put'
            400:
              $ref: '#/components/responses/400'
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
        try:
            item = self.edit_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            changed_model = UpdateThemeCommand(pk, item).run()
            return self.response(200, id=changed_model.id, result=item)
        except ThemeNotFoundError:
            return self.response_404()
        except SystemThemeProtectedError as ex:
            return self.response_403(message=str(ex))
        except Exception as ex:
            return self.response_422(message=str(ex))

    @expose("/export/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_export_ids_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.export",
        log_to_statsd=False,
    )
    def export(self, **kwargs: Any) -> Response:
        """Download multiple themes as YAML files.
        ---
        get:
          summary: Download multiple themes as YAML files
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_export_ids_schema'
          responses:
            200:
              description: Theme export
              content:
                application/zip:
                  schema:
                    type: string
                    format: binary
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        requested_ids = kwargs["rison"]

        timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
        root = f"theme_export_{timestamp}"
        filename = f"{root}.zip"

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            try:
                for file_name, file_content in ExportThemesCommand(requested_ids).run():
                    with bundle.open(f"{root}/{file_name}", "w") as fp:
                        fp.write(file_content().encode())
            except ThemeNotFoundError:
                return self.response_404()
        buf.seek(0)

        response = send_file(
            buf,
            mimetype="application/zip",
            as_attachment=True,
            download_name=filename,
        )
        if token := request.args.get("token"):
            response.set_cookie(token, "done", max_age=600)
        return response
