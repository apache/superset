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
import json
import logging
from datetime import datetime
from io import BytesIO
from typing import Any
from zipfile import is_zipfile, ZipFile

from flask import g, request, Response, send_file
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext

from superset import is_feature_enabled
from superset.commands.importers.exceptions import (
    IncorrectFormatError,
    NoValidFilesFoundError,
)
from superset.commands.importers.v1.utils import get_contents_from_bundle
from superset.commands.query.delete import DeleteSavedQueryCommand
from superset.commands.query.exceptions import (
    SavedQueryDeleteFailedError,
    SavedQueryNotFoundError,
)
from superset.commands.query.export import ExportSavedQueriesCommand
from superset.commands.query.importers.dispatcher import ImportSavedQueriesCommand
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.databases.filters import DatabaseFilter
from superset.extensions import event_logger
from superset.models.sql_lab import SavedQuery
from superset.queries.saved_queries.filters import (
    SavedQueryAllTextFilter,
    SavedQueryFavoriteFilter,
    SavedQueryFilter,
    SavedQueryTagFilter,
)
from superset.queries.saved_queries.schemas import (
    get_delete_ids_schema,
    get_export_ids_schema,
    openapi_spec_methods_override,
)
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    requires_form_data,
    statsd_metrics,
)

logger = logging.getLogger(__name__)


class SavedQueryRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(SavedQuery)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        RouteMethod.RELATED,
        RouteMethod.DISTINCT,
        RouteMethod.IMPORT,
        "bulk_delete",  # not using RouteMethod since locally defined
    }
    class_permission_name = "SavedQuery"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    resource_name = "saved_query"
    allow_browser_login = True

    base_filters = [["id", SavedQueryFilter, lambda: []]]

    show_columns = [
        "changed_on_delta_humanized",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "database.database_name",
        "database.id",
        "description",
        "id",
        "label",
        "schema",
        "sql",
        "sql_tables",
        "template_parameters",
    ]
    list_columns = [
        "changed_on_delta_humanized",
        "created_on",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "database.database_name",
        "database.id",
        "db_id",
        "description",
        "extra",
        "id",
        "label",
        "last_run_delta_humanized",
        "rows",
        "schema",
        "sql",
        "sql_tables",
    ]
    if is_feature_enabled("TAGGING_SYSTEM"):
        list_columns += ["tags.id", "tags.name", "tags.type"]
    list_select_columns = list_columns + ["changed_by_fk", "changed_on"]
    add_columns = [
        "db_id",
        "description",
        "label",
        "schema",
        "sql",
        "template_parameters",
    ]
    edit_columns = add_columns
    order_columns = [
        "schema",
        "label",
        "description",
        "sql",
        "rows",
        "created_by.first_name",
        "database.database_name",
        "created_on",
        "changed_on_delta_humanized",
        "last_run_delta_humanized",
    ]

    search_columns = ["id", "database", "label", "schema", "created_by"]
    if is_feature_enabled("TAGGING_SYSTEM"):
        search_columns += ["tags"]
    search_filters = {
        "id": [SavedQueryFavoriteFilter],
        "label": [SavedQueryAllTextFilter],
    }
    if is_feature_enabled("TAGGING_SYSTEM"):
        search_filters["tags"] = [SavedQueryTagFilter]

    apispec_parameter_schemas = {
        "get_delete_ids_schema": get_delete_ids_schema,
        "get_export_ids_schema": get_export_ids_schema,
    }
    openapi_spec_tag = "Queries"
    openapi_spec_methods = openapi_spec_methods_override

    related_field_filters = {
        "database": "database_name",
    }
    base_related_field_filters = {"database": [["id", DatabaseFilter, lambda: []]]}
    allowed_rel_fields = {"database"}
    allowed_distinct_fields = {"schema"}

    def pre_add(self, item: SavedQuery) -> None:
        item.user = g.user

    def pre_update(self, item: SavedQuery) -> None:
        self.pre_add(item)

    @expose("/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_delete_ids_schema)
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Bulk delete saved queries.
        ---
        delete:
          summary: Bulk delete saved queries
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: Saved queries bulk delete
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
            DeleteSavedQueryCommand(item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d saved query",
                    "Deleted %(num)d saved queries",
                    num=len(item_ids),
                ),
            )
        except SavedQueryNotFoundError:
            return self.response_404()
        except SavedQueryDeleteFailedError as ex:
            return self.response_422(message=str(ex))

    @expose("/export/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_export_ids_schema)
    def export(self, **kwargs: Any) -> Response:
        """Download multiple saved queries as YAML files.
        ---
        get:
          summary: Download multiple saved queries as YAML files
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_export_ids_schema'
          responses:
            200:
              description: A zip file with saved query(ies) and database(s) as YAML
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
            500:
              $ref: '#/components/responses/500'
        """
        requested_ids = kwargs["rison"]
        timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
        root = f"saved_query_export_{timestamp}"
        filename = f"{root}.zip"

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            try:
                for file_name, file_content in ExportSavedQueriesCommand(
                    requested_ids
                ).run():
                    with bundle.open(f"{root}/{file_name}", "w") as fp:
                        fp.write(file_content.encode())
            except SavedQueryNotFoundError:
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

    @expose("/import/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.import_",
        log_to_statsd=False,
    )
    @requires_form_data
    def import_(self) -> Response:
        """Import saved queries with associated databases.
        ---
        post:
          summary: Import saved queries with associated databases
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  type: object
                  properties:
                    formData:
                      description: upload file (ZIP)
                      type: string
                      format: binary
                    passwords:
                      description: >-
                        JSON map of passwords for each featured database in the
                        ZIP file. If the ZIP includes a database config in the path
                        `databases/MyDatabase.yaml`, the password should be provided
                        in the following format:
                        `{"databases/MyDatabase.yaml": "my_password"}`.
                      type: string
                    overwrite:
                      description: overwrite existing saved queries?
                      type: boolean
                    ssh_tunnel_passwords:
                      description: >-
                        JSON map of passwords for each ssh_tunnel associated to a
                        featured database in the ZIP file. If the ZIP includes a
                        ssh_tunnel config in the path `databases/MyDatabase.yaml`,
                        the password should be provided in the following format:
                        `{"databases/MyDatabase.yaml": "my_password"}`.
                      type: string
                    ssh_tunnel_private_keys:
                      description: >-
                        JSON map of private_keys for each ssh_tunnel associated to a
                        featured database in the ZIP file. If the ZIP includes a
                        ssh_tunnel config in the path `databases/MyDatabase.yaml`,
                        the private_key should be provided in the following format:
                        `{"databases/MyDatabase.yaml": "my_private_key"}`.
                      type: string
                    ssh_tunnel_private_key_passwords:
                      description: >-
                        JSON map of private_key_passwords for each ssh_tunnel associated
                        to a featured database in the ZIP file. If the ZIP includes a
                        ssh_tunnel config in the path `databases/MyDatabase.yaml`,
                        the private_key should be provided in the following format:
                        `{"databases/MyDatabase.yaml": "my_private_key_password"}`.
                      type: string
          responses:
            200:
              description: Saved Query import result
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        upload = request.files.get("formData")
        if not upload:
            return self.response_400()
        if not is_zipfile(upload):
            raise IncorrectFormatError("Not a ZIP file")
        with ZipFile(upload) as bundle:
            contents = get_contents_from_bundle(bundle)

        if not contents:
            raise NoValidFilesFoundError()

        passwords = (
            json.loads(request.form["passwords"])
            if "passwords" in request.form
            else None
        )
        overwrite = request.form.get("overwrite") == "true"
        ssh_tunnel_passwords = (
            json.loads(request.form["ssh_tunnel_passwords"])
            if "ssh_tunnel_passwords" in request.form
            else None
        )
        ssh_tunnel_private_keys = (
            json.loads(request.form["ssh_tunnel_private_keys"])
            if "ssh_tunnel_private_keys" in request.form
            else None
        )
        ssh_tunnel_priv_key_passwords = (
            json.loads(request.form["ssh_tunnel_private_key_passwords"])
            if "ssh_tunnel_private_key_passwords" in request.form
            else None
        )

        command = ImportSavedQueriesCommand(
            contents,
            passwords=passwords,
            overwrite=overwrite,
            ssh_tunnel_passwords=ssh_tunnel_passwords,
            ssh_tunnel_private_keys=ssh_tunnel_private_keys,
            ssh_tunnel_priv_key_passwords=ssh_tunnel_priv_key_passwords,
        )
        command.run()
        return self.response(200, message="OK")
