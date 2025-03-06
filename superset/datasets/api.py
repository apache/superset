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
import logging
from datetime import datetime
from io import BytesIO
from typing import Any
from zipfile import is_zipfile, ZipFile

from flask import request, Response, send_file
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext
from marshmallow import ValidationError

from superset import event_logger
from superset.commands.dataset.create import CreateDatasetCommand
from superset.commands.dataset.delete import DeleteDatasetCommand
from superset.commands.dataset.duplicate import DuplicateDatasetCommand
from superset.commands.dataset.exceptions import (
    DatasetCreateFailedError,
    DatasetDeleteFailedError,
    DatasetForbiddenError,
    DatasetInvalidError,
    DatasetNotFoundError,
    DatasetRefreshFailedError,
    DatasetUpdateFailedError,
)
from superset.commands.dataset.export import ExportDatasetsCommand
from superset.commands.dataset.importers.dispatcher import ImportDatasetsCommand
from superset.commands.dataset.refresh import RefreshDatasetCommand
from superset.commands.dataset.update import UpdateDatasetCommand
from superset.commands.dataset.warm_up_cache import DatasetWarmUpCacheCommand
from superset.commands.exceptions import CommandException
from superset.commands.importers.exceptions import NoValidFilesFoundError
from superset.commands.importers.v1.utils import get_contents_from_bundle
from superset.connectors.sqla.models import SqlaTable
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.dataset import DatasetDAO
from superset.databases.filters import DatabaseFilter
from superset.datasets.filters import DatasetCertifiedFilter, DatasetIsNullOrEmptyFilter
from superset.datasets.schemas import (
    DatasetCacheWarmUpRequestSchema,
    DatasetCacheWarmUpResponseSchema,
    DatasetDuplicateSchema,
    DatasetPostSchema,
    DatasetPutSchema,
    DatasetRelatedObjectsResponse,
    get_delete_ids_schema,
    get_export_ids_schema,
    GetOrCreateDatasetSchema,
    openapi_spec_methods_override,
)
from superset.utils import json
from superset.utils.core import parse_boolean_string
from superset.views.base import DatasourceFilter
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    requires_form_data,
    requires_json,
    statsd_metrics,
)
from superset.views.filters import BaseFilterRelatedUsers, FilterRelatedOwners

logger = logging.getLogger(__name__)


class DatasetRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(SqlaTable)
    base_filters = [["id", DatasourceFilter, lambda: []]]

    resource_name = "dataset"
    allow_browser_login = True
    class_permission_name = "Dataset"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        RouteMethod.IMPORT,
        RouteMethod.RELATED,
        RouteMethod.DISTINCT,
        "bulk_delete",
        "refresh",
        "related_objects",
        "duplicate",
        "get_or_create_dataset",
        "warm_up_cache",
    }
    list_columns = [
        "id",
        "database.id",
        "database.database_name",
        "changed_by_name",
        "changed_by.first_name",
        "changed_by.last_name",
        "changed_by.id",
        "changed_on_utc",
        "changed_on_delta_humanized",
        "default_endpoint",
        "description",
        "datasource_type",
        "explore_url",
        "extra",
        "kind",
        "owners.id",
        "owners.first_name",
        "owners.last_name",
        "catalog",
        "schema",
        "sql",
        "table_name",
        "uuid",
    ]
    list_select_columns = list_columns + ["changed_on", "changed_by_fk"]
    order_columns = [
        "table_name",
        "catalog",
        "schema",
        "changed_by.first_name",
        "changed_on_delta_humanized",
        "database.database_name",
    ]
    show_select_columns = [
        "id",
        "database.database_name",
        "database.id",
        "table_name",
        "sql",
        "filter_select_enabled",
        "fetch_values_predicate",
        "catalog",
        "schema",
        "description",
        "main_dttm_col",
        "normalize_columns",
        "always_filter_main_dttm",
        "offset",
        "default_endpoint",
        "cache_timeout",
        "is_sqllab_view",
        "template_params",
        "select_star",
        "owners.id",
        "owners.first_name",
        "owners.last_name",
        "columns.advanced_data_type",
        "columns.changed_on",
        "columns.column_name",
        "columns.created_on",
        "columns.description",
        "columns.expression",
        "columns.filterable",
        "columns.groupby",
        "columns.id",
        "columns.is_active",
        "columns.extra",
        "columns.is_dttm",
        "columns.python_date_format",
        "columns.type",
        "columns.uuid",
        "columns.verbose_name",
        "metrics.changed_on",
        "metrics.created_on",
        "metrics.d3format",
        "metrics.currency",
        "metrics.description",
        "metrics.expression",
        "metrics.extra",
        "metrics.id",
        "metrics.metric_name",
        "metrics.metric_type",
        "metrics.verbose_name",
        "metrics.warning_text",
        "datasource_type",
        "url",
        "extra",
        "kind",
        "created_on",
        "created_on_humanized",
        "created_by.first_name",
        "created_by.last_name",
        "changed_on",
        "changed_on_humanized",
        "changed_by.first_name",
        "changed_by.last_name",
    ]
    show_columns = show_select_columns + [
        "columns.type_generic",
        "database.backend",
        "database.allow_multi_catalog",
        "columns.advanced_data_type",
        "is_managed_externally",
        "uid",
        "datasource_name",
        "name",
        "column_formats",
        "currency_formats",
        "granularity_sqla",
        "time_grain_sqla",
        "order_by_choices",
        "verbose_map",
    ]
    add_model_schema = DatasetPostSchema()
    edit_model_schema = DatasetPutSchema()
    duplicate_model_schema = DatasetDuplicateSchema()
    add_columns = ["database", "catalog", "schema", "table_name", "sql", "owners"]
    edit_columns = [
        "table_name",
        "sql",
        "filter_select_enabled",
        "fetch_values_predicate",
        "catalog",
        "schema",
        "description",
        "main_dttm_col",
        "normalize_columns",
        "always_filter_main_dttm",
        "offset",
        "default_endpoint",
        "cache_timeout",
        "is_sqllab_view",
        "template_params",
        "owners",
        "columns",
        "metrics",
        "extra",
    ]
    openapi_spec_tag = "Datasets"

    base_related_field_filters = {
        "owners": [["id", BaseFilterRelatedUsers, lambda: []]],
        "changed_by": [["id", BaseFilterRelatedUsers, lambda: []]],
        "database": [["id", DatabaseFilter, lambda: []]],
    }
    related_field_filters = {
        "owners": RelatedFieldFilter("first_name", FilterRelatedOwners),
        "changed_by": RelatedFieldFilter("first_name", FilterRelatedOwners),
        "database": "database_name",
    }
    search_filters = {
        "sql": [DatasetIsNullOrEmptyFilter],
        "id": [DatasetCertifiedFilter],
    }
    search_columns = [
        "id",
        "database",
        "owners",
        "catalog",
        "schema",
        "sql",
        "table_name",
        "created_by",
        "changed_by",
    ]
    allowed_rel_fields = {"database", "owners", "created_by", "changed_by"}
    allowed_distinct_fields = {"catalog", "schema"}

    apispec_parameter_schemas = {
        "get_export_ids_schema": get_export_ids_schema,
    }
    openapi_spec_component_schemas = (
        DatasetCacheWarmUpRequestSchema,
        DatasetCacheWarmUpResponseSchema,
        DatasetRelatedObjectsResponse,
        DatasetDuplicateSchema,
        GetOrCreateDatasetSchema,
    )

    openapi_spec_methods = openapi_spec_methods_override
    """ Overrides GET methods OpenApi descriptions """

    list_outer_default_load = True
    show_outer_default_load = True

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    @requires_json
    def post(self) -> Response:
        """Create a new dataset.
        ---
        post:
          summary: Create a new dataset
          requestBody:
            description: Dataset schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Dataset added
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
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            new_model = CreateDatasetCommand(item).run()
            return self.response(201, id=new_model.id, result=item, data=new_model.data)
        except DatasetInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DatasetCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<pk>", methods=("PUT",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @requires_json
    def put(self, pk: int) -> Response:
        """Update a dataset.
        ---
        put:
          summary: Update a dataset
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: query
            schema:
              type: boolean
            name: override_columns
          requestBody:
            description: Dataset schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Dataset changed
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
        override_columns = (
            parse_boolean_string(request.args["override_columns"])
            if "override_columns" in request.args
            else False
        )
        try:
            item = self.edit_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            changed_model = UpdateDatasetCommand(pk, item, override_columns).run()
            if override_columns:
                RefreshDatasetCommand(pk).run()
            response = self.response(200, id=changed_model.id, result=item)
        except DatasetNotFoundError:
            response = self.response_404()
        except DatasetForbiddenError:
            response = self.response_403()
        except DatasetInvalidError as ex:
            response = self.response_422(message=ex.normalized_messages())
        except DatasetUpdateFailedError as ex:
            logger.error(
                "Error updating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            response = self.response_422(message=str(ex))
        return response

    @expose("/<pk>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, pk: int) -> Response:
        """Delete a Dataset.
        ---
        delete:
          summary: Delete a dataset
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Dataset delete
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
            DeleteDatasetCommand([pk]).run()
            return self.response(200, message="OK")
        except DatasetNotFoundError:
            return self.response_404()
        except DatasetForbiddenError:
            return self.response_403()
        except DatasetDeleteFailedError as ex:
            logger.error(
                "Error deleting model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
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
        """Download multiple datasets as YAML files.
        ---
        get:
          summary: Download multiple datasets as YAML files
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_export_ids_schema'
          responses:
            200:
              description: Dataset export
              content:
                text/plain:
                  schema:
                    type: string
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
        root = f"dataset_export_{timestamp}"
        filename = f"{root}.zip"

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            try:
                for file_name, file_content in ExportDatasetsCommand(
                    requested_ids
                ).run():
                    with bundle.open(f"{root}/{file_name}", "w") as fp:
                        fp.write(file_content().encode())
            except DatasetNotFoundError:
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

    @expose("/duplicate", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}" f".duplicate",
        log_to_statsd=False,
    )
    @requires_json
    def duplicate(self) -> Response:
        """Duplicate a dataset.
        ---
        post:
          summary: Duplicate a dataset
          requestBody:
            description: Dataset schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/DatasetDuplicateSchema'
          responses:
            201:
              description: Dataset duplicated
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/DatasetDuplicateSchema'
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
            item = self.duplicate_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            new_model = DuplicateDatasetCommand(item).run()
            return self.response(201, id=new_model.id, result=item)
        except DatasetInvalidError as ex:
            return self.response_422(
                message=ex.normalized_messages()
                if isinstance(ex, ValidationError)
                else str(ex)
            )
        except DatasetCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<pk>/refresh", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}" f".refresh",
        log_to_statsd=False,
    )
    def refresh(self, pk: int) -> Response:
        """Refresh and update columns of a dataset.
        ---
        put:
          summary: Refresh and update columns of a dataset
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Dataset delete
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
            RefreshDatasetCommand(pk).run()
            return self.response(200, message="OK")
        except DatasetNotFoundError:
            return self.response_404()
        except DatasetForbiddenError:
            return self.response_403()
        except DatasetRefreshFailedError as ex:
            logger.error(
                "Error refreshing dataset %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<pk>/related_objects", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".related_objects",
        log_to_statsd=False,
    )
    def related_objects(self, pk: int) -> Response:
        """Get charts and dashboards count associated to a dataset.
        ---
        get:
          summary: Get charts and dashboards count associated to a dataset
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
                    $ref: "#/components/schemas/DatasetRelatedObjectsResponse"
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        dataset = DatasetDAO.find_by_id(pk)
        if not dataset:
            return self.response_404()
        data = DatasetDAO.get_related_objects(pk)
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

    @expose("/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_delete_ids_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Bulk delete datasets.
        ---
        delete:
          summary: Bulk delete datasets
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: Dataset bulk delete
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
            DeleteDatasetCommand(item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d dataset",
                    "Deleted %(num)d datasets",
                    num=len(item_ids),
                ),
            )
        except DatasetNotFoundError:
            return self.response_404()
        except DatasetForbiddenError:
            return self.response_403()
        except DatasetDeleteFailedError as ex:
            return self.response_422(message=str(ex))

    @expose("/import/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.import_",
        log_to_statsd=False,
    )
    @requires_form_data
    def import_(self) -> Response:
        """Import dataset(s) with associated databases.
        ---
        post:
          summary: Import dataset(s) with associated databases
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  type: object
                  properties:
                    formData:
                      description: upload file (ZIP or YAML)
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
                      description: overwrite existing datasets?
                      type: boolean
                    sync_columns:
                      description: sync columns?
                      type: boolean
                    sync_metrics:
                      description: sync metrics?
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
              description: Dataset import result
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
        if is_zipfile(upload):
            with ZipFile(upload) as bundle:
                contents = get_contents_from_bundle(bundle)
        else:
            upload.seek(0)
            contents = {upload.filename: upload.read()}

        if not contents:
            raise NoValidFilesFoundError()

        passwords = (
            json.loads(request.form["passwords"])
            if "passwords" in request.form
            else None
        )
        overwrite = request.form.get("overwrite") == "true"
        sync_columns = request.form.get("sync_columns") == "true"
        sync_metrics = request.form.get("sync_metrics") == "true"
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

        command = ImportDatasetsCommand(
            contents,
            passwords=passwords,
            overwrite=overwrite,
            sync_columns=sync_columns,
            sync_metrics=sync_metrics,
            ssh_tunnel_passwords=ssh_tunnel_passwords,
            ssh_tunnel_private_keys=ssh_tunnel_private_keys,
            ssh_tunnel_priv_key_passwords=ssh_tunnel_priv_key_passwords,
        )
        command.run()
        return self.response(200, message="OK")

    @expose("/get_or_create/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".get_or_create_dataset",
        log_to_statsd=False,
    )
    def get_or_create_dataset(self) -> Response:
        """Retrieve a dataset by name, or create it if it does not exist.
        ---
        post:
          summary: Retrieve a table by name, or create it if it does not exist
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/GetOrCreateDatasetSchema'
          responses:
            200:
              description: The ID of the table
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
                        properties:
                          table_id:
                            type: integer
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            body = GetOrCreateDatasetSchema().load(request.json)
        except ValidationError as ex:
            return self.response(400, message=ex.messages)
        table_name = body["table_name"]
        database_id = body["database_id"]
        if table := DatasetDAO.get_table_by_name(database_id, table_name):
            return self.response(200, result={"table_id": table.id})

        body["database"] = database_id
        try:
            tbl = CreateDatasetCommand(body).run()
            return self.response(200, result={"table_id": tbl.id})
        except DatasetInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DatasetCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=ex.message)

    @expose("/warm_up_cache", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".warm_up_cache",
        log_to_statsd=False,
    )
    def warm_up_cache(self) -> Response:
        """Warm up the cache for each chart powered by the given table.
        ---
        put:
          summary: Warm up the cache for each chart powered by the given table
          description: >-
            Warms up the cache for the table.
            Note for slices a force refresh occurs.
            In terms of the `extra_filters` these can be obtained from records in the JSON
            encoded `logs.json` column associated with the `explore_json` action.
          requestBody:
            description: >-
              Identifies the database and table to warm up cache for, and any
              additional dashboard or filter context to use.
            required: true
            content:
              application/json:
                schema:
                  $ref: "#/components/schemas/DatasetCacheWarmUpRequestSchema"
          responses:
            200:
              description: Each chart's warmup status
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/DatasetCacheWarmUpResponseSchema"
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            body = DatasetCacheWarmUpRequestSchema().load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            result = DatasetWarmUpCacheCommand(
                body["db_name"],
                body["table_name"],
                body.get("dashboard_id"),
                body.get("extra_filters"),
            ).run()
            return self.response(200, result=result)
        except CommandException as ex:
            return self.response(ex.status, message=ex.message)
