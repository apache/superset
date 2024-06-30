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
# pylint: disable=too-many-lines

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from io import BytesIO
from typing import Any, cast
from zipfile import is_zipfile, ZipFile

from deprecation import deprecated
from flask import make_response, render_template, request, Response, send_file
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError
from sqlalchemy.exc import NoSuchTableError, OperationalError, SQLAlchemyError

from superset import app, event_logger
from superset.commands.database.create import CreateDatabaseCommand
from superset.commands.database.delete import DeleteDatabaseCommand
from superset.commands.database.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseCreateFailedError,
    DatabaseDeleteDatasetsExistFailedError,
    DatabaseDeleteFailedError,
    DatabaseInvalidError,
    DatabaseNotFoundError,
    DatabaseTablesUnexpectedError,
    DatabaseUpdateFailedError,
    InvalidParametersError,
)
from superset.commands.database.export import ExportDatabasesCommand
from superset.commands.database.importers.dispatcher import ImportDatabasesCommand
from superset.commands.database.ssh_tunnel.delete import DeleteSSHTunnelCommand
from superset.commands.database.ssh_tunnel.exceptions import (
    SSHTunnelDatabasePortError,
    SSHTunnelDeleteFailedError,
    SSHTunnelingNotEnabledError,
)
from superset.commands.database.tables import TablesDatabaseCommand
from superset.commands.database.test_connection import TestConnectionDatabaseCommand
from superset.commands.database.update import UpdateDatabaseCommand
from superset.commands.database.uploaders.base import UploadCommand
from superset.commands.database.uploaders.columnar_reader import ColumnarReader
from superset.commands.database.uploaders.csv_reader import CSVReader
from superset.commands.database.uploaders.excel_reader import ExcelReader
from superset.commands.database.validate import ValidateDatabaseParametersCommand
from superset.commands.database.validate_sql import ValidateSQLCommand
from superset.commands.importers.exceptions import (
    IncorrectFormatError,
    NoValidFilesFoundError,
)
from superset.commands.importers.v1.utils import get_contents_from_bundle
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.database import DatabaseDAO, DatabaseUserOAuth2TokensDAO
from superset.databases.decorators import check_table_access
from superset.databases.filters import DatabaseFilter, DatabaseUploadEnabledFilter
from superset.databases.schemas import (
    CatalogsResponseSchema,
    ColumnarMetadataUploadFilePostSchema,
    ColumnarUploadPostSchema,
    CSVMetadataUploadFilePostSchema,
    CSVUploadPostSchema,
    database_catalogs_query_schema,
    database_schemas_query_schema,
    database_tables_query_schema,
    DatabaseConnectionSchema,
    DatabaseFunctionNamesResponse,
    DatabasePostSchema,
    DatabasePutSchema,
    DatabaseRelatedObjectsResponse,
    DatabaseSchemaAccessForFileUploadResponse,
    DatabaseTablesResponse,
    DatabaseTestConnectionSchema,
    DatabaseValidateParametersSchema,
    ExcelMetadataUploadFilePostSchema,
    ExcelUploadPostSchema,
    get_export_ids_schema,
    OAuth2ProviderResponseSchema,
    openapi_spec_methods_override,
    QualifiedTableSchema,
    SchemasResponseSchema,
    SelectStarResponseSchema,
    TableExtraMetadataResponseSchema,
    TableMetadataResponseSchema,
    UploadFileMetadata,
    ValidateSQLRequest,
    ValidateSQLResponse,
)
from superset.databases.utils import get_table_metadata
from superset.db_engine_specs import get_available_engine_specs
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    DatabaseNotFoundException,
    InvalidPayloadSchemaError,
    OAuth2Error,
    SupersetErrorsException,
    SupersetException,
    SupersetSecurityException,
    TableNotFoundException,
)
from superset.extensions import security_manager
from superset.models.core import Database
from superset.sql_parse import Table
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.utils.core import error_msg_from_exception, parse_js_uri_path_item
from superset.utils.oauth2 import decode_oauth2_state
from superset.utils.ssh_tunnel import mask_password_info
from superset.views.base import json_errors_response
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    requires_form_data,
    requires_json,
    statsd_metrics,
)

logger = logging.getLogger(__name__)


# pylint: disable=too-many-public-methods
class DatabaseRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Database)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        RouteMethod.IMPORT,
        RouteMethod.RELATED,
        "tables",
        "table_metadata",
        "table_metadata_deprecated",
        "table_extra_metadata",
        "table_extra_metadata_deprecated",
        "select_star",
        "catalogs",
        "schemas",
        "test_connection",
        "related_objects",
        "function_names",
        "available",
        "validate_parameters",
        "validate_sql",
        "delete_ssh_tunnel",
        "schemas_access_for_file_upload",
        "get_connection",
        "csv_upload",
        "csv_metadata",
        "excel_upload",
        "excel_metadata",
        "columnar_upload",
        "columnar_metadata",
        "oauth2",
    }

    resource_name = "database"
    class_permission_name = "Database"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    allow_browser_login = True
    base_filters = [["id", DatabaseFilter, lambda: []]]
    show_columns = [
        "id",
        "uuid",
        "database_name",
        "cache_timeout",
        "expose_in_sqllab",
        "allow_run_async",
        "allow_file_upload",
        "configuration_method",
        "allow_ctas",
        "allow_cvas",
        "allow_dml",
        "backend",
        "driver",
        "force_ctas_schema",
        "impersonate_user",
        "is_managed_externally",
        "engine_information",
    ]
    list_columns = [
        "allow_file_upload",
        "allow_ctas",
        "allow_cvas",
        "allow_dml",
        "allow_run_async",
        "allows_cost_estimate",
        "allows_subquery",
        "allows_virtual_table_explore",
        "backend",
        "changed_on",
        "changed_on_delta_humanized",
        "changed_by.first_name",
        "changed_by.last_name",
        "created_by.first_name",
        "created_by.last_name",
        "database_name",
        "explore_database_id",
        "expose_in_sqllab",
        "extra",
        "force_ctas_schema",
        "id",
        "uuid",
        "disable_data_preview",
        "disable_drill_to_detail",
        "allow_multi_catalog",
        "engine_information",
    ]
    add_columns = [
        "database_name",
        "sqlalchemy_uri",
        "cache_timeout",
        "expose_in_sqllab",
        "allow_run_async",
        "allow_file_upload",
        "allow_ctas",
        "allow_cvas",
        "allow_dml",
        "configuration_method",
        "force_ctas_schema",
        "impersonate_user",
        "extra",
        "encrypted_extra",
        "server_cert",
    ]

    edit_columns = add_columns

    search_columns = [
        "allow_file_upload",
        "allow_dml",
        "allow_run_async",
        "created_by",
        "changed_by",
        "database_name",
        "expose_in_sqllab",
        "uuid",
    ]
    search_filters = {"allow_file_upload": [DatabaseUploadEnabledFilter]}
    allowed_rel_fields = {"changed_by", "created_by"}

    list_select_columns = list_columns + ["extra", "sqlalchemy_uri", "password"]
    order_columns = [
        "allow_file_upload",
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
        "database_catalogs_query_schema": database_catalogs_query_schema,
        "database_schemas_query_schema": database_schemas_query_schema,
        "database_tables_query_schema": database_tables_query_schema,
        "get_export_ids_schema": get_export_ids_schema,
    }

    openapi_spec_tag = "Database"
    openapi_spec_component_schemas = (
        CatalogsResponseSchema,
        ColumnarUploadPostSchema,
        CSVUploadPostSchema,
        DatabaseConnectionSchema,
        DatabaseFunctionNamesResponse,
        DatabaseSchemaAccessForFileUploadResponse,
        DatabaseRelatedObjectsResponse,
        DatabaseTablesResponse,
        DatabaseTestConnectionSchema,
        DatabaseValidateParametersSchema,
        ExcelUploadPostSchema,
        TableExtraMetadataResponseSchema,
        TableMetadataResponseSchema,
        SelectStarResponseSchema,
        SchemasResponseSchema,
        CSVMetadataUploadFilePostSchema,
        ExcelMetadataUploadFilePostSchema,
        ColumnarMetadataUploadFilePostSchema,
        UploadFileMetadata,
        ValidateSQLRequest,
        ValidateSQLResponse,
    )

    openapi_spec_methods = openapi_spec_methods_override
    """ Overrides GET methods OpenApi descriptions """

    @expose("/<int:pk>/connection", methods=("GET",))
    @protect()
    @safe
    def get_connection(self, pk: int) -> Response:
        """Get database connection info.
        ---
        get:
          summary: Get a database connection info
          parameters:
          - in: path
            schema:
              type: integer
            description: The database id
            name: pk
          responses:
            200:
              description: Database with connection info
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/DatabaseConnectionSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        database = DatabaseDAO.find_by_id(pk)
        database_connection_schema = DatabaseConnectionSchema()
        response = {
            "id": pk,
            "result": database_connection_schema.dump(database, many=False),
        }
        try:
            if ssh_tunnel := DatabaseDAO.get_ssh_tunnel(pk):
                response["result"]["ssh_tunnel"] = ssh_tunnel.data
            return self.response(200, **response)
        except SupersetException as ex:
            return self.response(ex.status, message=ex.message)

    @expose("/<int:pk>", methods=("GET",))
    @protect()
    @safe
    def get(self, pk: int, **kwargs: Any) -> Response:
        """Get a database.
        ---
        get:
          summary: Get a database
          parameters:
          - in: path
            schema:
              type: integer
            description: The database id
            name: pk
          responses:
            200:
              description: Database
              content:
                application/json:
                  schema:
                    type: object
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        data = self.get_headless(pk, **kwargs)
        try:
            if ssh_tunnel := DatabaseDAO.get_ssh_tunnel(pk):
                payload = data.json
                payload["result"]["ssh_tunnel"] = ssh_tunnel.data
                return payload
            return data
        except SupersetException as ex:
            return self.response(ex.status, message=ex.message)

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    @requires_json
    def post(self) -> FlaskResponse:
        """Create a new database.
        ---
        post:
          summary: Create a new database
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
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            new_model = CreateDatabaseCommand(item).run()
            item["uuid"] = new_model.uuid
            # Return censored version for sqlalchemy URI
            item["sqlalchemy_uri"] = new_model.sqlalchemy_uri
            item["expose_in_sqllab"] = new_model.expose_in_sqllab

            # If parameters are available return them in the payload
            if new_model.parameters:
                item["parameters"] = new_model.parameters

            if new_model.driver:
                item["driver"] = new_model.driver

            # Return SSH Tunnel and hide passwords if any
            if item.get("ssh_tunnel"):
                item["ssh_tunnel"] = mask_password_info(new_model.ssh_tunnel)

            return self.response(201, id=new_model.id, result=item)
        except DatabaseInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DatabaseConnectionFailedError as ex:
            return self.response_422(message=str(ex))
        except SupersetErrorsException as ex:
            return json_errors_response(errors=ex.errors, status=ex.status)
        except DatabaseCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
        except (SSHTunnelingNotEnabledError, SSHTunnelDatabasePortError) as ex:
            return self.response_400(message=str(ex))
        except SupersetException as ex:
            return self.response(ex.status, message=ex.message)

    @expose("/<int:pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @requires_json
    def put(self, pk: int) -> Response:
        """Update a database.
        ---
        put:
          summary: Change a database
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
        try:
            item = self.edit_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            changed_model = UpdateDatabaseCommand(pk, item).run()
            # Return censored version for sqlalchemy URI
            item["sqlalchemy_uri"] = changed_model.sqlalchemy_uri
            if changed_model.parameters:
                item["parameters"] = changed_model.parameters
            # Return SSH Tunnel and hide passwords if any
            if item.get("ssh_tunnel"):
                item["ssh_tunnel"] = mask_password_info(changed_model.ssh_tunnel)
            return self.response(200, id=changed_model.id, result=item)
        except DatabaseNotFoundError:
            return self.response_404()
        except DatabaseInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DatabaseConnectionFailedError as ex:
            return self.response_422(message=str(ex))
        except DatabaseUpdateFailedError as ex:
            logger.error(
                "Error updating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
        except (SSHTunnelingNotEnabledError, SSHTunnelDatabasePortError) as ex:
            return self.response_400(message=str(ex))

    @expose("/<int:pk>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}" f".delete",
        log_to_statsd=False,
    )
    def delete(self, pk: int) -> Response:
        """Delete a database.
        ---
        delete:
          summary: Delete a database
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
            DeleteDatabaseCommand(pk).run()
            return self.response(200, message="OK")
        except DatabaseNotFoundError:
            return self.response_404()
        except DatabaseDeleteDatasetsExistFailedError as ex:
            return self.response_422(message=str(ex))
        except DatabaseDeleteFailedError as ex:
            logger.error(
                "Error deleting model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<int:pk>/catalogs/")
    @protect()
    @safe
    @rison(database_catalogs_query_schema)
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}" f".catalogs",
        log_to_statsd=False,
    )
    def catalogs(self, pk: int, **kwargs: Any) -> FlaskResponse:
        """Get all catalogs from a database.
        ---
        get:
          summary: Get all catalogs from a database
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
                  $ref: '#/components/schemas/database_catalogs_query_schema'
          responses:
            200:
              description: A List of all catalogs from the database
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/CatalogsResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        database = DatabaseDAO.find_by_id(pk)
        if not database:
            return self.response_404()
        try:
            catalogs = database.get_all_catalog_names(
                cache=database.catalog_cache_enabled,
                cache_timeout=database.catalog_cache_timeout or None,
                force=kwargs["rison"].get("force", False),
            )
            catalogs = security_manager.get_catalogs_accessible_by_user(
                database,
                catalogs,
            )
            return self.response(200, result=list(catalogs))
        except OperationalError:
            return self.response(
                500,
                message="There was an error connecting to the database",
            )
        except SupersetException as ex:
            return self.response(ex.status, message=ex.message)

    @expose("/<int:pk>/schemas/")
    @protect()
    @safe
    @rison(database_schemas_query_schema)
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}" f".schemas",
        log_to_statsd=False,
    )
    def schemas(self, pk: int, **kwargs: Any) -> FlaskResponse:
        """Get all schemas from a database.
        ---
        get:
          summary: Get all schemas from a database
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
            catalog = kwargs["rison"].get("catalog")
            schemas = database.get_all_schema_names(
                catalog=catalog,
                cache=database.schema_cache_enabled,
                cache_timeout=database.schema_cache_timeout or None,
                force=kwargs["rison"].get("force", False),
            )
            schemas = security_manager.get_schemas_accessible_by_user(
                database,
                catalog,
                schemas,
            )
            return self.response(200, result=list(schemas))
        except OperationalError:
            return self.response(
                500, message="There was an error connecting to the database"
            )
        except SupersetException as ex:
            return self.response(ex.status, message=ex.message)

    @expose("/<int:pk>/tables/")
    @protect()
    @safe
    @rison(database_tables_query_schema)
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}" f".tables",
        log_to_statsd=False,
    )
    def tables(self, pk: int, **kwargs: Any) -> FlaskResponse:
        """Get a list of tables for given database.
        ---
        get:
          summary: Get a list of tables for given database
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
                  $ref: '#/components/schemas/database_tables_query_schema'
          responses:
            200:
              description: Tables list
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      count:
                        type: integer
                      result:
                        description: >-
                          A List of tables for given database
                        type: array
                        items:
                          $ref: '#/components/schemas/DatabaseTablesResponse'
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
        force = kwargs["rison"].get("force", False)
        catalog_name = kwargs["rison"].get("catalog_name")
        schema_name = kwargs["rison"].get("schema_name", "")

        try:
            command = TablesDatabaseCommand(pk, catalog_name, schema_name, force)
            payload = command.run()
            return self.response(200, **payload)
        except DatabaseNotFoundError:
            return self.response_404()
        except SupersetException as ex:
            return self.response(ex.status, message=ex.message)
        except DatabaseTablesUnexpectedError as ex:
            return self.response_422(ex.message)

    @expose("/<int:pk>/table/<path:table_name>/<schema_name>/", methods=("GET",))
    @protect()
    @check_table_access
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".table_metadata_deprecated",
        log_to_statsd=False,
    )
    def table_metadata_deprecated(
        self, database: Database, table_name: str, schema_name: str
    ) -> FlaskResponse:
        """Get database table metadata.
        ---
        get:
          summary: Get database table metadata
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
        self.incr_stats("init", self.table_metadata_deprecated.__name__)
        try:
            table_info = get_table_metadata(database, Table(table_name, schema_name))
        except SQLAlchemyError as ex:
            self.incr_stats("error", self.table_metadata_deprecated.__name__)
            return self.response_422(error_msg_from_exception(ex))
        except SupersetException as ex:
            return self.response(ex.status, message=ex.message)

        self.incr_stats("success", self.table_metadata_deprecated.__name__)
        return self.response(200, **table_info)

    @expose("/<int:pk>/table_extra/<path:table_name>/<schema_name>/", methods=("GET",))
    @protect()
    @check_table_access
    @safe
    @statsd_metrics
    @deprecated(deprecated_in="4.0", removed_in="5.0")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".table_extra_metadata_deprecated",
        log_to_statsd=False,
    )
    def table_extra_metadata_deprecated(
        self, database: Database, table_name: str, schema_name: str
    ) -> FlaskResponse:
        """Get table extra metadata.

        A newer API was introduced between 4.0 and 5.0, with support for catalogs for
        SIP-95. This method was kept to prevent breaking API integrations, but will be
        removed in 5.0.
        ---
        get:
          summary: Get table extra metadata
          description: >-
            Response depends on each DB engine spec normally focused on partitions.
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
              description: Table extra metadata information
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/TableExtraMetadataResponseSchema"
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
        self.incr_stats("init", self.table_extra_metadata_deprecated.__name__)

        parsed_schema = parse_js_uri_path_item(schema_name, eval_undefined=True)
        table_name = cast(str, parse_js_uri_path_item(table_name))
        table = Table(table_name, parsed_schema)
        payload = database.db_engine_spec.get_extra_table_metadata(database, table)
        return self.response(200, **payload)

    @expose("/<int:pk>/table_metadata/", methods=["GET"])
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".table_metadata",
        log_to_statsd=False,
    )
    def table_metadata(self, pk: int) -> FlaskResponse:
        """
        Get metadata for a given table.

        Optionally, a schema and a catalog can be passed, if different from the default
        ones.
        ---
        get:
          summary: Get table metadata
          description: >-
            Metadata associated with the table (columns, indexes, etc.)
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The database id
          - in: query
            schema:
              type: string
            name: table
            required: true
            description: Table name
          - in: query
            schema:
              type: string
            name: schema
            description: >-
              Optional table schema, if not passed default schema will be used
          - in: query
            schema:
              type: string
            name: catalog
            description: >-
              Optional table catalog, if not passed default catalog will be used
          responses:
            200:
              description: Table metadata information
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/TableExtraMetadataResponseSchema"
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        self.incr_stats("init", self.table_metadata.__name__)

        database = DatabaseDAO.find_by_id(pk)
        if database is None:
            raise DatabaseNotFoundException("No such database")

        try:
            parameters = QualifiedTableSchema().load(request.args)
        except ValidationError as ex:
            raise InvalidPayloadSchemaError(ex) from ex

        table = Table(parameters["name"], parameters["schema"], parameters["catalog"])
        try:
            security_manager.raise_for_access(database=database, table=table)
        except SupersetSecurityException as ex:
            # instead of raising 403, raise 404 to hide table existence
            raise TableNotFoundException("No such table") from ex

        payload = database.db_engine_spec.get_table_metadata(database, table)

        return self.response(200, **payload)

    @expose("/<int:pk>/table_metadata/extra/", methods=["GET"])
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".table_extra_metadata",
        log_to_statsd=False,
    )
    def table_extra_metadata(self, pk: int) -> FlaskResponse:
        """
        Get extra metadata for a given table.

        Optionally, a schema and a catalog can be passed, if different from the default
        ones.
        ---
        get:
          summary: Get table extra metadata
          description: >-
            Extra metadata associated with the table (partitions, description, etc.)
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The database id
          - in: query
            schema:
              type: string
            name: name
            required: true
            description: Table name
          - in: query
            schema:
              type: string
            name: schema
            description: >-
              Optional table schema, if not passed the schema configured in the database
              will be used
          - in: query
            schema:
              type: string
            name: catalog
            description: >-
              Optional table catalog, if not passed the catalog configured in the
              database will be used
          responses:
            200:
              description: Table extra metadata information
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/TableExtraMetadataResponseSchema"
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        self.incr_stats("init", self.table_extra_metadata.__name__)

        if not (database := DatabaseDAO.find_by_id(pk)):
            raise DatabaseNotFoundException("No such database")

        try:
            parameters = QualifiedTableSchema().load(request.args)
        except ValidationError as ex:
            raise InvalidPayloadSchemaError(ex) from ex

        table = Table(parameters["name"], parameters["schema"], parameters["catalog"])
        try:
            security_manager.raise_for_access(database=database, table=table)
        except SupersetSecurityException as ex:
            # instead of raising 403, raise 404 to hide table existence
            raise TableNotFoundException("No such table") from ex

        payload = database.db_engine_spec.get_extra_table_metadata(database, table)

        return self.response(200, **payload)

    @expose("/<int:pk>/select_star/<path:table_name>/", methods=("GET",))
    @expose("/<int:pk>/select_star/<path:table_name>/<schema_name>/", methods=("GET",))
    @protect()
    @check_table_access
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.select_star",
        log_to_statsd=False,
    )
    def select_star(
        self, database: Database, table_name: str, schema_name: str | None = None
    ) -> FlaskResponse:
        """Get database select star for table.
        ---
        get:
          summary: Get database select star for table
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
                Table(table_name, schema_name),
                latest_partition=True,
            )
        except NoSuchTableError:
            self.incr_stats("error", self.select_star.__name__)
            return self.response(404, message="Table not found on the database")
        self.incr_stats("success", self.select_star.__name__)
        return self.response(200, result=result)

    @expose("/test_connection/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".test_connection",
        log_to_statsd=False,
    )
    @requires_json
    def test_connection(self) -> FlaskResponse:
        """Test a database connection.
        ---
        post:
          summary: Test a database connection
          requestBody:
            description: Database schema
            required: true
            content:
              application/json:
                schema:
                  $ref: "#/components/schemas/DatabaseTestConnectionSchema"
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
        try:
            item = DatabaseTestConnectionSchema().load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            TestConnectionDatabaseCommand(item).run()
            return self.response(200, message="OK")
        except (SSHTunnelingNotEnabledError, SSHTunnelDatabasePortError) as ex:
            return self.response_400(message=str(ex))

    @expose("/<int:pk>/related_objects/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".related_objects",
        log_to_statsd=False,
    )
    def related_objects(self, pk: int) -> Response:
        """Get charts and dashboards count associated to a database.
        ---
        get:
          summary: Get charts and dashboards count associated to a database
          parameters:
          - in: path
            name: pk
            schema:
              type: integer
          responses:
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
        database = DatabaseDAO.find_by_id(pk)
        if not database:
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
        sqllab_tab_states = [
            {"id": tab_state.id, "label": tab_state.label, "active": tab_state.active}
            for tab_state in data["sqllab_tab_states"]
        ]
        return self.response(
            200,
            charts={"count": len(charts), "result": charts},
            dashboards={"count": len(dashboards), "result": dashboards},
            sqllab_tab_states={
                "count": len(sqllab_tab_states),
                "result": sqllab_tab_states,
            },
        )

    @expose("/<int:pk>/validate_sql/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.validate_sql",
        log_to_statsd=False,
    )
    def validate_sql(self, pk: int) -> FlaskResponse:
        """Validate that arbitrary SQL is acceptable for the given database.
        ---
        post:
          summary: Validate arbitrary SQL
          description: >-
            Validates that arbitrary SQL is acceptable for the given database.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Validate SQL request
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ValidateSQLRequest'
          responses:
            200:
              description: Validation result
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        description: >-
                          A List of SQL errors found on the statement
                        type: array
                        items:
                          $ref: '#/components/schemas/ValidateSQLResponse'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            sql_request = ValidateSQLRequest().load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            validator_errors = ValidateSQLCommand(pk, sql_request).run()
            return self.response(200, result=validator_errors)
        except DatabaseNotFoundError:
            return self.response_404()

    @expose("/oauth2/", methods=["GET"])
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.oauth2",
        log_to_statsd=True,
    )
    def oauth2(self) -> FlaskResponse:
        """
        ---
        get:
          summary: >-
            Receive personal access tokens from OAuth2
          description: ->
            Receive and store personal access tokens from OAuth for user-level
            authorization
          parameters:
          - in: query
            name: state
            schema:
              type: string
          - in: query
            name: code
            schema:
              type: string
          - in: query
            name: scope
            schema:
              type: string
          - in: query
            name: error
            schema:
              type: string
          responses:
            200:
              description: A dummy self-closing HTML page
              content:
                text/html:
                  schema:
                    type: string
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        parameters = OAuth2ProviderResponseSchema().load(request.args)

        if "error" in parameters:
            raise OAuth2Error(parameters["error"])

        # note that when decoding the state we will perform JWT validation, preventing a
        # malicious payload that would insert a bogus database token, or delete an
        # existing one.
        state = decode_oauth2_state(parameters["state"])

        # exchange code for access/refresh tokens
        database = DatabaseDAO.find_by_id(state["database_id"])
        if database is None:
            return self.response_404()

        oauth2_config = database.get_oauth2_config()
        if oauth2_config is None:
            raise OAuth2Error("No configuration found for OAuth2")

        token_response = database.db_engine_spec.get_oauth2_token(
            oauth2_config,
            parameters["code"],
        )

        # delete old tokens
        existing = DatabaseUserOAuth2TokensDAO.find_one_or_none(
            user_id=state["user_id"],
            database_id=state["database_id"],
        )
        if existing:
            DatabaseUserOAuth2TokensDAO.delete([existing])

        # store tokens
        expiration = datetime.now() + timedelta(seconds=token_response["expires_in"])
        DatabaseUserOAuth2TokensDAO.create(
            attributes={
                "user_id": state["user_id"],
                "database_id": state["database_id"],
                "access_token": token_response["access_token"],
                "access_token_expiration": expiration,
                "refresh_token": token_response.get("refresh_token"),
            },
        )

        # return blank page that closes itself
        return make_response(
            render_template("superset/oauth2.html", tab_id=state["tab_id"]),
            200,
        )

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
        """Download database(s) and associated dataset(s) as a zip file.
        ---
        get:
          summary: Download database(s) and associated dataset(s) as a zip file
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_export_ids_schema'
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
                        fp.write(file_content().encode())
            except DatabaseNotFoundError:
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
        """Import database(s) with associated datasets.
        ---
        post:
          summary: Import database(s) with associated datasets
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
                      description: overwrite existing databases?
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
              description: Database import result
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

        command = ImportDatabasesCommand(
            contents,
            passwords=passwords,
            overwrite=overwrite,
            ssh_tunnel_passwords=ssh_tunnel_passwords,
            ssh_tunnel_private_keys=ssh_tunnel_private_keys,
            ssh_tunnel_priv_key_passwords=ssh_tunnel_priv_key_passwords,
        )
        command.run()
        return self.response(200, message="OK")

    @expose("/csv_metadata/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=(
            lambda self, *args, **kwargs: f"{self.__class__.__name__}" ".csv_metadata"
        ),
        log_to_statsd=False,
    )
    @requires_form_data
    def csv_metadata(self) -> Response:
        """Upload an CSV file and returns file metadata.
        ---
        post:
          summary: Upload an CSV file and returns file metadata
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  $ref: '#/components/schemas/CSVMetadataUploadFilePostSchema'
          responses:
            200:
              description: Columnar upload response
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/UploadFileMetadata'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            request_form = request.form.to_dict()
            request_form["file"] = request.files.get("file")
            parameters = CSVMetadataUploadFilePostSchema().load(request_form)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        metadata = CSVReader(parameters).file_metadata(parameters["file"])
        return self.response(200, result=UploadFileMetadata().dump(metadata))

    @expose("/<int:pk>/csv_upload/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.csv_upload",
        log_to_statsd=False,
    )
    @requires_form_data
    def csv_upload(self, pk: int) -> Response:
        """Upload a CSV file into a database.
        ---
        post:
          summary: Upload a CSV file to a database table
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  $ref: '#/components/schemas/CSVUploadPostSchema'
          responses:
            201:
              description: CSV upload response
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
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            request_form = request.form.to_dict()
            request_form["file"] = request.files.get("file")
            parameters = CSVUploadPostSchema().load(request_form)
            UploadCommand(
                pk,
                parameters["table_name"],
                parameters["file"],
                parameters.get("schema"),
                CSVReader(parameters),
            ).run()
        except ValidationError as error:
            return self.response_400(message=error.messages)
        return self.response(201, message="OK")

    @expose("/excel_metadata/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=(
            lambda self, *args, **kwargs: f"{self.__class__.__name__}" ".excel_metadata"
        ),
        log_to_statsd=False,
    )
    @requires_form_data
    def excel_metadata(self) -> Response:
        """Upload an Excel file and returns file metadata.
        ---
        post:
          summary: Upload an Excel file and returns file metadata
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  $ref: '#/components/schemas/ExcelMetadataUploadFilePostSchema'
          responses:
            200:
              description: Columnar upload response
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/UploadFileMetadata'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            request_form = request.form.to_dict()
            request_form["file"] = request.files.get("file")
            parameters = ExcelMetadataUploadFilePostSchema().load(request_form)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        metadata = ExcelReader().file_metadata(parameters["file"])
        return self.response(200, result=UploadFileMetadata().dump(metadata))

    @expose("/<int:pk>/excel_upload/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.excel_upload",
        log_to_statsd=False,
    )
    @requires_form_data
    def excel_upload(self, pk: int) -> Response:
        """Upload an Excel file into a database.
        ---
        post:
          summary: Upload an Excel file to a database table
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  $ref: '#/components/schemas/ExcelUploadPostSchema'
          responses:
            201:
              description: Excel upload response
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
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            request_form = request.form.to_dict()
            request_form["file"] = request.files.get("file")
            parameters = ExcelUploadPostSchema().load(request_form)
            UploadCommand(
                pk,
                parameters["table_name"],
                parameters["file"],
                parameters.get("schema"),
                ExcelReader(parameters),
            ).run()
        except ValidationError as error:
            return self.response_400(message=error.messages)
        return self.response(201, message="OK")

    @expose("/columnar_metadata/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        ".columnar_metadata",
        log_to_statsd=False,
    )
    @requires_form_data
    def columnar_metadata(self) -> Response:
        """Upload a Columnar file and returns file metadata.
        ---
        post:
          summary: Upload a Columnar file and returns file metadata
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  $ref: '#/components/schemas/ColumnarMetadataUploadFilePostSchema'
          responses:
            200:
              description: Columnar upload response
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/UploadFileMetadata'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            request_form = request.form.to_dict()
            request_form["file"] = request.files.get("file")
            parameters = ColumnarMetadataUploadFilePostSchema().load(request_form)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        metadata = ColumnarReader().file_metadata(parameters["file"])
        return self.response(200, result=UploadFileMetadata().dump(metadata))

    @expose("/<int:pk>/columnar_upload/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self,
        *args,
        **kwargs: f"{self.__class__.__name__}.columnar_upload",
        log_to_statsd=False,
    )
    @requires_form_data
    def columnar_upload(self, pk: int) -> Response:
        """Upload a Columnar file into a database.
        ---
        post:
          summary: Upload a Columnar file to a database table
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  $ref: '#/components/schemas/ColumnarUploadPostSchema'
          responses:
            201:
              description: Columnar upload response
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
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            request_form = request.form.to_dict()
            request_form["file"] = request.files.get("file")
            parameters = ColumnarUploadPostSchema().load(request_form)
            UploadCommand(
                pk,
                parameters["table_name"],
                parameters["file"],
                parameters.get("schema"),
                ColumnarReader(parameters),
            ).run()
        except ValidationError as error:
            return self.response_400(message=error.messages)
        return self.response(201, message="OK")

    @expose("/<int:pk>/function_names/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".function_names",
        log_to_statsd=False,
    )
    def function_names(self, pk: int) -> Response:
        """Get function names supported by a database.
        ---
        get:
          summary: Get function names supported by a database
          parameters:
          - in: path
            name: pk
            schema:
              type: integer
          responses:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/DatabaseFunctionNamesResponse"
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        database = DatabaseDAO.find_by_id(pk)
        if not database:
            return self.response_404()
        return self.response(
            200,
            function_names=database.function_names,
        )

    @expose("/available/", methods=("GET",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}" f".available",
        log_to_statsd=False,
    )
    def available(self) -> Response:
        """Get names of databases currently available.
        ---
        get:
          summary: Get names of databases currently available
          responses:
            200:
              description: Database names
              content:
                application/json:
                  schema:
                    type: array
                    items:
                      type: object
                      properties:
                        name:
                          description: Name of the database
                          type: string
                        engine:
                          description: Name of the SQLAlchemy engine
                          type: string
                        available_drivers:
                          description: Installed drivers for the engine
                          type: array
                          items:
                            type: string
                        sqlalchemy_uri_placeholder:
                          description: Placeholder for the SQLAlchemy URI
                          type: string
                        default_driver:
                          description: Default driver for the engine
                          type: string
                        preferred:
                          description: Is the database preferred?
                          type: boolean
                        sqlalchemy_uri_placeholder:
                          description: Example placeholder for the SQLAlchemy URI
                          type: string
                        parameters:
                          description: JSON schema defining the needed parameters
                          type: object
                        engine_information:
                          description: Dict with public properties form the DB Engine
                          type: object
                          properties:
                            supports_file_upload:
                              description: Whether the engine supports file uploads
                              type: boolean
                            disable_ssh_tunneling:
                              description: Whether the engine supports SSH Tunnels
                              type: boolean
            400:
              $ref: '#/components/responses/400'
            500:
              $ref: '#/components/responses/500'
        """
        preferred_databases: list[str] = app.config.get("PREFERRED_DATABASES", [])
        available_databases = []
        for engine_spec, drivers in get_available_engine_specs().items():
            if not drivers:
                continue

            payload: dict[str, Any] = {
                "name": engine_spec.engine_name,
                "engine": engine_spec.engine,
                "available_drivers": sorted(drivers),
                "sqlalchemy_uri_placeholder": engine_spec.sqlalchemy_uri_placeholder,
                "preferred": engine_spec.engine_name in preferred_databases,
                "engine_information": engine_spec.get_public_information(),
            }

            if engine_spec.default_driver:
                payload["default_driver"] = engine_spec.default_driver

            # show configuration parameters for DBs that support it
            if (
                hasattr(engine_spec, "parameters_json_schema")
                and hasattr(engine_spec, "sqlalchemy_uri_placeholder")
                and getattr(engine_spec, "default_driver") in drivers
            ):
                payload["parameters"] = engine_spec.parameters_json_schema()
                payload["sqlalchemy_uri_placeholder"] = (
                    engine_spec.sqlalchemy_uri_placeholder
                )

            available_databases.append(payload)

        # sort preferred first
        response = sorted(
            (payload for payload in available_databases if payload["preferred"]),
            key=lambda payload: preferred_databases.index(payload["name"]),
        )

        # add others
        response.extend(
            sorted(
                (
                    payload
                    for payload in available_databases
                    if not payload["preferred"]
                ),
                key=lambda payload: payload["name"],
            )
        )

        return self.response(200, databases=response)

    @expose("/validate_parameters/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".validate_parameters",
        log_to_statsd=False,
    )
    @requires_json
    def validate_parameters(self) -> FlaskResponse:
        """Validate database connection parameters.
        ---
        post:
          summary: Validate database connection parameters
          requestBody:
            description: DB-specific parameters
            required: true
            content:
              application/json:
                schema:
                  $ref: "#/components/schemas/DatabaseValidateParametersSchema"
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
        try:
            payload = DatabaseValidateParametersSchema().load(request.json)
        except ValidationError as ex:
            errors = [
                SupersetError(
                    message="\n".join(messages),
                    error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
                    level=ErrorLevel.ERROR,
                    extra={"invalid": [attribute]},
                )
                for attribute, messages in ex.messages.items()
            ]
            raise InvalidParametersError(errors) from ex

        command = ValidateDatabaseParametersCommand(payload)
        command.run()
        return self.response(200, message="OK")

    @expose("/<int:pk>/ssh_tunnel/", methods=("DELETE",))
    @protect()
    @statsd_metrics
    @deprecated(deprecated_in="4.0")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".delete_ssh_tunnel",
        log_to_statsd=False,
    )
    def delete_ssh_tunnel(self, pk: int) -> Response:
        """Delete a SSH tunnel.
        ---
        delete:
          summary: Delete a SSH tunnel
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: SSH Tunnel deleted
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

        database = DatabaseDAO.find_by_id(pk)
        if not database:
            return self.response_404()
        try:
            existing_ssh_tunnel_model = database.ssh_tunnels
            if existing_ssh_tunnel_model:
                DeleteSSHTunnelCommand(existing_ssh_tunnel_model.id).run()
                return self.response(200, message="OK")
            return self.response_404()
        except SSHTunnelDeleteFailedError as ex:
            logger.error(
                "Error deleting SSH Tunnel %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
        except SSHTunnelingNotEnabledError as ex:
            logger.error(
                "Error deleting SSH Tunnel %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_400(message=str(ex))

    @expose("/<int:pk>/schemas_access_for_file_upload/")
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".schemas_access_for_file_upload",
        log_to_statsd=False,
    )
    def schemas_access_for_file_upload(self, pk: int) -> Response:
        """The list of the database schemas where to upload information.
        ---
        get:
          summary: The list of the database schemas where to upload information
          parameters:
          - in: path
            name: pk
            schema:
              type: integer
          responses:
            200:
              description: The list of the database schemas where to upload information
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/DatabaseSchemaAccessForFileUploadResponse"
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        database = DatabaseDAO.find_by_id(pk)
        if not database:
            return self.response_404()

        schemas_allowed = database.get_schema_access_for_file_upload()
        # the list schemas_allowed should not be empty here
        # and the list schemas_allowed_processed returned from security_manager
        # should not be empty either,
        # otherwise the database should have been filtered out
        # in CsvToDatabaseForm
        schemas_allowed_processed = security_manager.get_schemas_accessible_by_user(
            database, schemas_allowed, True
        )
        return self.response(200, schemas=schemas_allowed_processed)
