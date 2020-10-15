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
from typing import Any, Optional
from zipfile import ZipFile

from flask import g, request, Response, send_file
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext as _
from marshmallow import ValidationError
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import (
    NoSuchModuleError,
    NoSuchTableError,
    OperationalError,
    SQLAlchemyError,
)

from superset import event_logger
from superset.constants import RouteMethod
from superset.databases.commands.create import CreateDatabaseCommand
from superset.databases.commands.delete import DeleteDatabaseCommand
from superset.databases.commands.exceptions import (
    DatabaseCreateFailedError,
    DatabaseDeleteDatasetsExistFailedError,
    DatabaseDeleteFailedError,
    DatabaseInvalidError,
    DatabaseNotFoundError,
    DatabaseSecurityUnsafeError,
    DatabaseUpdateFailedError,
)
from superset.databases.commands.export import ExportDatabasesCommand
from superset.databases.commands.test_connection import TestConnectionDatabaseCommand
from superset.databases.commands.update import UpdateDatabaseCommand
from superset.databases.dao import DatabaseDAO
from superset.databases.decorators import check_datasource_access
from superset.databases.filters import DatabaseFilter
from superset.databases.schemas import (
    database_schemas_query_schema,
    DatabasePostSchema,
    DatabasePutSchema,
    DatabaseRelatedObjectsResponse,
    DatabaseTestConnectionSchema,
    get_export_ids_schema,
    SchemasResponseSchema,
    SelectStarResponseSchema,
    TableMetadataResponseSchema,
)
from superset.databases.utils import get_table_metadata
from superset.extensions import security_manager
from superset.models.core import Database
from superset.typing import FlaskResponse
from superset.utils.core import error_msg_from_exception
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class DatabaseRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Database)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        "table_metadata",
        "select_star",
        "schemas",
        "test_connection",
        "related_objects",
    }
    class_permission_name = "DatabaseView"
    resource_name = "database"
    allow_browser_login = True
    base_filters = [["id", DatabaseFilter, lambda: []]]
    show_columns = [
        "id",
        "database_name",
        "cache_timeout",
        "expose_in_sqllab",
        "allow_run_async",
        "allow_csv_upload",
        "allow_ctas",
        "allow_cvas",
        "allow_dml",
        "force_ctas_schema",
        "allow_multi_schema_metadata_fetch",
        "impersonate_user",
        "encrypted_extra",
        "extra",
        "server_cert",
        "sqlalchemy_uri",
    ]
    list_columns = [
        "allow_csv_upload",
        "allow_ctas",
        "allow_cvas",
        "allow_dml",
        "allow_multi_schema_metadata_fetch",
        "allow_run_async",
        "allows_cost_estimate",
        "allows_subquery",
        "allows_virtual_table_explore",
        "backend",
        "changed_on",
        "changed_on_delta_humanized",
        "created_by.first_name",
        "created_by.last_name",
        "database_name",
        "explore_database_id",
        "expose_in_sqllab",
        "force_ctas_schema",
        "function_names",
        "id",
    ]
    add_columns = [
        "database_name",
        "sqlalchemy_uri",
        "cache_timeout",
        "expose_in_sqllab",
        "allow_run_async",
        "allow_csv_upload",
        "allow_ctas",
        "allow_cvas",
        "allow_dml",
        "force_ctas_schema",
        "impersonate_user",
        "allow_multi_schema_metadata_fetch",
        "extra",
        "encrypted_extra",
        "server_cert",
    ]
    edit_columns = add_columns

    list_select_columns = list_columns + ["extra", "sqlalchemy_uri", "password"]
    order_columns = [
        "allow_csv_upload",
        "allow_dml",
        "allow_run_async",
        "changed_on",
        "changed_on_delta_humanized",
        "created_by.first_name",
        "database_name",
        "expose_in_sqllab",
    ]
    # Removes the local limit for the page size
    max_page_size = -1
    add_model_schema = DatabasePostSchema()
    edit_model_schema = DatabasePutSchema()

    apispec_parameter_schemas = {
        "database_schemas_query_schema": database_schemas_query_schema,
    }
    openapi_spec_tag = "Database"
    openapi_spec_component_schemas = (
        DatabaseRelatedObjectsResponse,
        TableMetadataResponseSchema,
        SelectStarResponseSchema,
        SchemasResponseSchema,
    )

    @expose("/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    def post(self) -> Response:
        """Creates a new Database
        ---
        post:
          description: >-
            Create a new Database.
          requestBody:
            description: Database schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Database added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
            302:
              description: Redirects to the current digest
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
            new_model = CreateDatabaseCommand(g.user, item).run()
            # Return censored version for sqlalchemy URI
            item["sqlalchemy_uri"] = new_model.sqlalchemy_uri
            return self.response(201, id=new_model.id, result=item)
        except DatabaseInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DatabaseCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s", self.__class__.__name__, str(ex)
            )
            return self.response_422(message=str(ex))

    @expose("/<int:pk>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    def put(  # pylint: disable=too-many-return-statements, arguments-differ
        self, pk: int
    ) -> Response:
        """Changes a Database
        ---
        put:
          description: >-
            Changes a Database.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Database schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Database changed
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
            422:
              $ref: '#/components/responses/422'
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
            changed_model = UpdateDatabaseCommand(g.user, pk, item).run()
            # Return censored version for sqlalchemy URI
            item["sqlalchemy_uri"] = changed_model.sqlalchemy_uri
            return self.response(200, id=changed_model.id, result=item)
        except DatabaseNotFoundError:
            return self.response_404()
        except DatabaseInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DatabaseUpdateFailedError as ex:
            logger.error(
                "Error updating model %s: %s", self.__class__.__name__, str(ex)
            )
            return self.response_422(message=str(ex))

    @expose("/<int:pk>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    def delete(self, pk: int) -> Response:  # pylint: disable=arguments-differ
        """Deletes a Database
        ---
        delete:
          description: >-
            Deletes a Database.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Database deleted
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
        try:
            DeleteDatabaseCommand(g.user, pk).run()
            return self.response(200, message="OK")
        except DatabaseNotFoundError:
            return self.response_404()
        except DatabaseDeleteDatasetsExistFailedError as ex:
            return self.response_422(message=str(ex))
        except DatabaseDeleteFailedError as ex:
            logger.error(
                "Error deleting model %s: %s", self.__class__.__name__, str(ex)
            )
            return self.response_422(message=str(ex))

    @expose("/<int:pk>/schemas/")
    @protect()
    @safe
    @rison(database_schemas_query_schema)
    @statsd_metrics
    def schemas(self, pk: int, **kwargs: Any) -> FlaskResponse:
        """Get all schemas from a database
        ---
        get:
          description: Get all schemas from a database
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The database id
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/database_schemas_query_schema'
          responses:
            200:
              description: A List of all schemas from the database
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/SchemasResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        database = self.datamodel.get(pk, self._base_filters)
        if not database:
            return self.response_404()
        try:
            schemas = database.get_all_schema_names(
                cache=database.schema_cache_enabled,
                cache_timeout=database.schema_cache_timeout,
                force=kwargs["rison"].get("force", False),
            )
            schemas = security_manager.get_schemas_accessible_by_user(database, schemas)
            return self.response(200, result=schemas)
        except OperationalError:
            return self.response(
                500, message="There was an error connecting to the database"
            )

    @expose("/<int:pk>/table/<table_name>/<schema_name>/", methods=["GET"])
    @protect()
    @check_datasource_access
    @safe
    @event_logger.log_this
    @statsd_metrics
    def table_metadata(
        self, database: Database, table_name: str, schema_name: str
    ) -> FlaskResponse:
        """Table schema info
        ---
        get:
          description: Get database table metadata
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The database id
          - in: path
            schema:
              type: string
            name: table_name
            description: Table name
          - in: path
            schema:
              type: string
            name: schema_name
            description: Table schema
          responses:
            200:
              description: Table metadata information
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/TableMetadataResponseSchema"
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
        self.incr_stats("init", self.table_metadata.__name__)
        try:
            table_info = get_table_metadata(database, table_name, schema_name)
        except SQLAlchemyError as ex:
            self.incr_stats("error", self.table_metadata.__name__)
            return self.response_422(error_msg_from_exception(ex))
        self.incr_stats("success", self.table_metadata.__name__)
        return self.response(200, **table_info)

    @expose("/<int:pk>/select_star/<table_name>/", methods=["GET"])
    @expose("/<int:pk>/select_star/<table_name>/<schema_name>/", methods=["GET"])
    @protect()
    @check_datasource_access
    @safe
    @event_logger.log_this
    @statsd_metrics
    def select_star(
        self, database: Database, table_name: str, schema_name: Optional[str] = None
    ) -> FlaskResponse:
        """Table schema info
        ---
        get:
          description: Get database select star for table
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The database id
          - in: path
            schema:
              type: string
            name: table_name
            description: Table name
          - in: path
            schema:
              type: string
            name: schema_name
            description: Table schema
          responses:
            200:
              description: SQL statement for a select star for table
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/SelectStarResponseSchema"
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
        self.incr_stats("init", self.select_star.__name__)
        try:
            result = database.select_star(
                table_name, schema_name, latest_partition=True, show_cols=True
            )
        except NoSuchTableError:
            self.incr_stats("error", self.select_star.__name__)
            return self.response(404, message="Table not found on the database")
        self.incr_stats("success", self.select_star.__name__)
        return self.response(200, result=result)

    @expose("/test_connection", methods=["POST"])
    @protect()
    @safe
    @event_logger.log_this
    @statsd_metrics
    def test_connection(  # pylint: disable=too-many-return-statements
        self,
    ) -> FlaskResponse:
        """Tests a database connection
        ---
        post:
          description: >-
            Tests a database connection
          requestBody:
            description: Database schema
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    encrypted_extra:
                      type: object
                    extras:
                      type: object
                    name:
                      type: string
                    server_cert:
                      type: string
          responses:
            200:
              description: Database Test Connection
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            400:
              $ref: '#/components/responses/400'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = DatabaseTestConnectionSchema().load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            TestConnectionDatabaseCommand(g.user, item).run()
            return self.response(200, message="OK")
        except (NoSuchModuleError, ModuleNotFoundError):
            logger.info("Invalid driver")
            driver_name = make_url(item.get("sqlalchemy_uri")).drivername
            return self.response(
                400,
                message=_("Could not load database driver: {}").format(driver_name),
                driver_name=driver_name,
            )
        except DatabaseSecurityUnsafeError as ex:
            return self.response_422(message=ex)
        except OperationalError:
            logger.warning("Connection failed")
            return self.response(
                500,
                message=_("Connection failed, please check your connection settings"),
            )
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Unexpected error %s", type(ex).__name__)
            return self.response_400(
                message=_(
                    "Unexpected error occurred, please check your logs for details"
                )
            )

    @expose("/<int:pk>/related_objects/", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    def related_objects(self, pk: int) -> Response:
        """Get charts and dashboards count associated to a database
        ---
        get:
          description:
            Get charts and dashboards count associated to a database
          parameters:
          - in: path
            name: pk
            schema:
              type: integer
          responses:
            200:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/DatabaseRelatedObjectsResponse"
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        dataset = DatabaseDAO.find_by_id(pk)
        if not dataset:
            return self.response_404()
        data = DatabaseDAO.get_related_objects(pk)
        charts = [
            {
                "id": chart.id,
                "slice_name": chart.slice_name,
                "viz_type": chart.viz_type,
            }
            for chart in data["charts"]
        ]
        dashboards = [
            {
                "id": dashboard.id,
                "json_metadata": dashboard.json_metadata,
                "slug": dashboard.slug,
                "title": dashboard.dashboard_title,
            }
            for dashboard in data["dashboards"]
        ]
        return self.response(
            200,
            charts={"count": len(charts), "result": charts},
            dashboards={"count": len(dashboards), "result": dashboards},
        )

    @expose("/export/", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_export_ids_schema)
    def export(self, **kwargs: Any) -> Response:
        """Export database(s) with associated datasets
        ---
        get:
          description: Download database(s) and associated dataset(s) as a zip file
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  type: array
                  items:
                    type: integer
          responses:
            200:
              description: A zip file with database(s) and dataset(s) as YAML
              content:
                application/zip:
                  schema:
                    type: string
                    format: binary
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        requested_ids = kwargs["rison"]
        timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
        root = f"database_export_{timestamp}"
        filename = f"{root}.zip"

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            try:
                for file_name, file_content in ExportDatabasesCommand(
                    requested_ids
                ).run():
                    with bundle.open(f"{root}/{file_name}", "w") as fp:
                        fp.write(file_content.encode())
            except DatabaseNotFoundError:
                return self.response_404()
        buf.seek(0)

        return send_file(
            buf,
            mimetype="application/zip",
            as_attachment=True,
            attachment_filename=filename,
        )
