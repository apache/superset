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
from datetime import datetime
from io import BytesIO
from typing import Any, Callable
from zipfile import is_zipfile, ZipFile

from flask import request, Response, send_file
from flask_appbuilder.api import expose, protect, rison as parse_rison, safe
from flask_appbuilder.api.schemas import get_item_schema
from flask_appbuilder.const import API_RESULT_RES_KEY, API_SELECT_COLUMNS_RIS_KEY
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext
from jinja2.exceptions import TemplateSyntaxError
from marshmallow import ValidationError
from sqlalchemy.orm.exc import MultipleResultsFound

from superset import event_logger, is_feature_enabled, security_manager
from superset.commands.dataset.create import CreateDatasetCommand
from superset.commands.dataset.delete import DeleteDatasetCommand
from superset.commands.dataset.duplicate import DuplicateDatasetCommand
from superset.commands.dataset.exceptions import (
    DatasetCreateFailedError,
    DatasetDeleteFailedError,
    DatasetForbiddenError,
    DatasetInvalidError,
    DatasetLogicalDuplicateError,
    DatasetNotFoundError,
    DatasetRefreshFailedError,
    DatasetRestoreFailedError,
    DatasetSoftDeletedTwinExistsError,
    DatasetUpdateFailedError,
)
from superset.commands.dataset.export import ExportDatasetsCommand
from superset.commands.dataset.importers.dispatcher import ImportDatasetsCommand
from superset.commands.dataset.refresh import RefreshDatasetCommand
from superset.commands.dataset.restore import RestoreDatasetCommand
from superset.commands.dataset.update import UpdateDatasetCommand
from superset.commands.dataset.warm_up_cache import DatasetWarmUpCacheCommand
from superset.commands.exceptions import CommandException
from superset.commands.importers.exceptions import NoValidFilesFoundError
from superset.commands.importers.v1.utils import get_contents_from_bundle
from superset.connectors.sqla.models import SqlaTable
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.dashboard import DashboardDAO
from superset.daos.dataset import DatasetDAO
from superset.databases.filters import DatabaseFilter
from superset.datasets.filters import (
    DatasetCertifiedFilter,
    DatasetDeletedStateFilter,
    DatasetEditableFilter,
    DatasetIsNullOrEmptyFilter,
)
from superset.datasets.schemas import (
    DatasetCacheWarmUpRequestSchema,
    DatasetCacheWarmUpResponseSchema,
    DatasetDrillInfoSchema,
    DatasetDuplicateSchema,
    DatasetPostSchema,
    DatasetPutSchema,
    DatasetRelatedObjectsResponse,
    get_delete_ids_schema,
    get_drill_info_schema,
    get_export_ids_schema,
    GetOrCreateDatasetSchema,
    openapi_spec_methods_override,
)
from superset.exceptions import (
    SupersetSyntaxErrorException,
    SupersetTemplateException,
)
from superset.jinja_context import BaseTemplateProcessor, get_template_processor
from superset.subjects.filters import FilterRelatedSubjects, subject_type_filter
from superset.utils import json
from superset.utils.core import parse_boolean_string, sanitize_cookie_token
from superset.versioning.api_helpers import (
    current_entity_etag_uuid,
    current_entity_version_info,
    get_version_endpoint,
    list_versions_endpoint,
)
from superset.versioning.etag import set_version_etag
from superset.versioning.schemas import VersionListItemSchema
from superset.views.base import DatasourceFilter
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    requires_form_data,
    requires_json,
    statsd_metrics,
)
from superset.views.error_handling import handle_api_exception
from superset.views.filters import (
    BaseFilterRelatedUsers,
    FilterRelatedUsers,
    SoftDeleteApiMixin,
)

logger = logging.getLogger(__name__)


class DatasetRestApi(SoftDeleteApiMixin, BaseSupersetModelRestApi):
    datamodel = SQLAInterface(SqlaTable)
    base_filters = [["id", DatasourceFilter, lambda: []]]

    resource_name = "dataset"
    allow_browser_login = True
    class_permission_name = "Dataset"
    # Custom methods (``restore``) need an explicit entry; FAB's @protect()
    # decorator falls back to ``can_<method>_<class>`` (i.e.
    # ``can_restore_Dataset``) when the mapping is missing, which standard
    # roles don't carry. Mirrors the permission model documented for
    # ``DELETE`` / ``bulk_delete``: endpoint-level ``can_write`` plus
    # resource-level ``raise_for_editorship``. See themes/api.py for the
    # established pattern.
    method_permission_name = {
        **MODEL_API_RW_METHOD_PERMISSION_MAP,
        "restore": "write",
    }
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        RouteMethod.IMPORT,
        RouteMethod.RELATED,
        RouteMethod.DISTINCT,
        "bulk_delete",
        "restore",
        "refresh",
        "related_objects",
        "duplicate",
        "get_or_create_dataset",
        "warm_up_cache",
        "get_drill_info",
        "list_versions",
        "get_version",
    }
    list_columns = [
        "id",
        "uuid",
        "database.id",
        "database.database_name",
        "database.uuid",
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
        "editors.id",
        "editors.label",
        "editors.type",
        "catalog",
        "schema",
        "sql",
        "table_name",
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
        "database.uuid",
        "table_name",
        "sql",
        "filter_select_enabled",
        "fetch_values_predicate",
        "catalog",
        "schema",
        "description",
        "main_dttm_col",
        "currency_code_column",
        "normalize_columns",
        "always_filter_main_dttm",
        "offset",
        "default_endpoint",
        "cache_timeout",
        "is_sqllab_view",
        "template_params",
        "select_star",
        "editors.id",
        "editors.label",
        "editors.type",
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
        "metrics.uuid",
        "metrics.verbose_name",
        "metrics.warning_text",
        "folders",
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
        "uuid",
        "datasource_name",
        "name",
        "column_formats",
        "granularity_sqla",
        "time_grain_sqla",
        "order_by_choices",
        "verbose_map",
    ]
    add_model_schema = DatasetPostSchema()
    edit_model_schema = DatasetPutSchema()
    duplicate_model_schema = DatasetDuplicateSchema()
    add_columns = [
        "database",
        "catalog",
        "schema",
        "table_name",
        "sql",
        "editors",
    ]
    edit_columns = [
        "table_name",
        "sql",
        "filter_select_enabled",
        "fetch_values_predicate",
        "catalog",
        "schema",
        "description",
        "main_dttm_col",
        "currency_code_column",
        "normalize_columns",
        "always_filter_main_dttm",
        "offset",
        "default_endpoint",
        "cache_timeout",
        "is_sqllab_view",
        "template_params",
        "editors",
        "columns",
        "metrics",
        "extra",
    ]
    openapi_spec_tag = "Datasets"

    base_related_field_filters = {
        "changed_by": [["id", BaseFilterRelatedUsers, lambda: []]],
        "database": [["id", DatabaseFilter, lambda: []]],
        "editors": [
            [
                "type",
                subject_type_filter("SUBJECTS_RELATED_TYPES"),
                lambda: [],
            ]
        ],
    }
    related_field_filters = {
        "changed_by": RelatedFieldFilter("first_name", FilterRelatedUsers),
        "database": "database_name",
        "editors": RelatedFieldFilter("label", FilterRelatedSubjects),
    }
    text_field_rel_fields = {
        "editors": "label",
    }
    extra_fields_rel_fields = {
        "editors": ["type", "active", "secondary_label", "img"],
    }
    search_filters = {
        "sql": [DatasetIsNullOrEmptyFilter],
        "id": [
            DatasetCertifiedFilter,
            DatasetDeletedStateFilter,
            DatasetEditableFilter,
        ],
    }
    search_columns = [
        "id",
        "uuid",
        "database",
        "editors",
        "catalog",
        "schema",
        "sql",
        "table_name",
        "created_by",
        "changed_by",
        "uuid",
    ]
    allowed_rel_fields = {"database", "created_by", "changed_by", "editors"}
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
        VersionListItemSchema,
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
            return self.response(
                201,
                id=new_model.id,
                result=item,
                data=new_model.data,
                uuid=new_model.uuid,
            )
        except DatasetSoftDeletedTwinExistsError as ex:
            return self.response_422(message=str(ex))
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
                      old_version:
                        type: integer
                        nullable: true
                        description: >-
                          0-based version_number of the live row before this
                          update (null if the dataset had no prior history).
                          Matches the ``version_number`` field of the list
                          versions endpoint. Unstable under retention
                          pruning — see ``old_transaction_id`` for a stable
                          identifier.
                      new_version:
                        type: integer
                        nullable: true
                        description: >-
                          0-based version_number of the newly-live row after
                          this update. Can equal ``old_version`` when no
                          versioned column changed, or when retention
                          pruning dropped an older closed row in the same
                          commit.
                      old_transaction_id:
                        type: integer
                        nullable: true
                        description: >-
                          Continuum transaction_id of the live row before
                          this update. Stable across retention pruning.
                      new_transaction_id:
                        type: integer
                        nullable: true
                        description: >-
                          Continuum transaction_id of the live row after
                          this update. When this differs from
                          ``old_transaction_id`` the update produced a new
                          version row (regardless of whether ``new_version``
                          changed).
                      old_version_uuid:
                        type: string
                        format: uuid
                        nullable: true
                        description: >-
                          Deterministic version_uuid of the live row before
                          this update. Null when version capture is disabled
                          or the dataset has no version rows yet.
                      new_version_uuid:
                        type: string
                        format: uuid
                        nullable: true
                        description: >-
                          Deterministic version_uuid of the live row after
                          this update. Null when version capture is disabled.
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

        # Live version identifiers before the update (empty + query-free when
        # ``ENABLE_VERSIONING_CAPTURE`` is off).
        old_info = current_entity_version_info(SqlaTable, pk)

        try:
            # Two commands, two commits, two Continuum transactions for an
            # ``override_columns`` save — deliberately NOT merged into one
            # transaction. A single-transaction design was attempted and
            # reverted: ``DBEventLogger`` writes request logs through the
            # SHARED scoped session and calls ``commit()`` /
            # ``rollback()`` on it mid-request (superset/utils/log.py),
            # so any save held uncommitted across a logged sub-action can
            # be committed half-done (Postgres/MySQL) or rolled back
            # entirely on a transient logger failure (SQLite's
            # "database is locked"). Until the event logger gets its own
            # session, per-command commit boundaries are the only shape
            # whose failure modes are honest. Consequence the
            # version-history UI must tolerate: one logical save can
            # surface as two version transactions stamped the same second.
            changed_model = UpdateDatasetCommand(pk, item, override_columns).run()
            # Capture the post-update identifiers BEFORE the refresh:
            # RefreshDatasetCommand commits its own transaction, so reading
            # afterwards would attribute the refresh's version to the
            # user's update (and old→new would span two transactions).
            new_info = current_entity_version_info(
                SqlaTable, changed_model.id, changed_model.uuid
            )
            etag_version_uuid = new_info.version_uuid
            if override_columns:
                RefreshDatasetCommand(pk).run()
                # The ETag must reflect the entity's *current live* version,
                # which after the refresh is the refresh's transaction —
                # re-read it rather than reusing the pre-refresh uuid.
                etag_version_uuid = current_entity_etag_uuid(
                    SqlaTable, changed_model.id, changed_model.uuid
                )
            response = self.response(
                200,
                id=changed_model.id,
                result=item,
                old_version=old_info.version,
                new_version=new_info.version,
                old_transaction_id=old_info.transaction_id,
                new_transaction_id=new_info.transaction_id,
                old_version_uuid=old_info.version_uuid,
                new_version_uuid=new_info.version_uuid,
            )
            set_version_etag(response, etag_version_uuid)
        except DatasetNotFoundError:
            response = self.response_404()
        except DatasetForbiddenError:
            response = self.response_403()
        except DatasetInvalidError as ex:
            response = self.response_422(message=ex.normalized_messages())
        except DatasetRefreshFailedError as ex:
            logger.exception(
                "Error refreshing dataset during update %s: %s",
                self.__class__.__name__,
                str(ex),
            )
            response = self.response_422(message=str(ex))
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
        """Delete a dataset.

        When the ``SOFT_DELETE`` feature flag is enabled, marks the dataset
        as deleted (sets ``deleted_at``) and hides it from list/detail
        endpoints and relationship loads; the row is preserved and
        recoverable via ``POST /api/v1/dataset/<uuid>/restore`` by an editor
        or admin. With the flag disabled (the default), the dataset is
        permanently hard-deleted and is not recoverable.
        ---
        delete:
          summary: Delete a dataset (soft delete, recoverable via restore,
            when the SOFT_DELETE feature flag is enabled; permanent otherwise)
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
    @parse_rison(get_export_ids_schema)
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
        if token := sanitize_cookie_token(request.args.get("token")):
            response.set_cookie(token, "done", max_age=600)
        return response

    @expose("/duplicate", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.duplicate",
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
                message=(
                    ex.normalized_messages()
                    if isinstance(ex, ValidationError)
                    else str(ex)
                )
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
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.refresh",
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

    @expose("/<pk>/detect_datetime_formats", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.detect_datetime_formats"
        ),
        log_to_statsd=False,
    )
    def detect_datetime_formats(self, pk: int) -> Response:
        """Detect and store datetime formats for dataset columns.
        ---
        post:
          summary: Detect datetime formats for dataset columns
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: query
            schema:
              type: boolean
            name: force
            description: Force re-detection even if formats already exist
          responses:
            200:
              description: Datetime formats detected
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
                      formats:
                        type: object
                        additionalProperties:
                          type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        # pylint: disable=import-outside-toplevel
        from superset.datasets.datetime_format_detector import DatetimeFormatDetector

        try:
            # Get force parameter from query string
            force = parse_boolean_string(request.args.get("force", "false"))

            # Get dataset
            dataset = DatasetDAO.find_by_id(pk)
            if not dataset:
                return self.response_404()

            # Check editorship
            try:
                security_manager.raise_for_editorship(dataset)
            except Exception:  # pylint: disable=broad-except
                return self.response_403()

            # Detect formats
            detector = DatetimeFormatDetector()
            formats = detector.detect_all_formats(dataset, force=force)

            return self.response(
                200,
                message="Datetime formats detected successfully",
                formats=formats,
            )
        except Exception as ex:
            logger.exception(
                "Error detecting datetime formats for dataset %s: %s",
                pk,
                str(ex),
            )
            return self.response_500(message=str(ex))

    @expose("/<id_or_uuid>/related_objects", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.related_objects"
        ),
        log_to_statsd=False,
    )
    def related_objects(self, id_or_uuid: str) -> Response:
        """Get charts and dashboards count associated to a dataset.
        ---
        get:
          summary: Get charts and dashboards count associated to a dataset
          parameters:
          - in: path
            name: id_or_uuid
            schema:
              type: string
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
        dataset = DatasetDAO.find_by_id_or_uuid(id_or_uuid)
        if not dataset:
            return self.response_404()
        data = DatasetDAO.get_related_objects(dataset.id)
        charts = [
            {
                "id": chart.id,
                "slice_name": chart.slice_name,
                "viz_type": chart.viz_type,
            }
            for chart in data["charts"]
            if security_manager.can_access_chart(chart)
        ]
        dashboards = [
            {
                "id": dashboard.id,
                "json_metadata": dashboard.json_metadata,
                "slug": dashboard.slug,
                "title": dashboard.dashboard_title,
            }
            for dashboard in data["dashboards"]
            if security_manager.can_access_dashboard(dashboard)
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
    @parse_rison(get_delete_ids_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Bulk delete datasets.

        When the ``SOFT_DELETE`` feature flag is enabled, marks each dataset
        as deleted (sets ``deleted_at``) and hides it from list/detail
        endpoints and relationship loads; rows are preserved and recoverable
        via ``POST /api/v1/dataset/<uuid>/restore`` by an editor or admin.
        With the flag disabled (the default), the datasets are permanently
        hard-deleted and are not recoverable.
        ---
        delete:
          summary: Bulk delete datasets (soft delete, recoverable via restore,
            when the SOFT_DELETE feature flag is enabled; permanent otherwise)
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

    @expose("/<uuid>/restore", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.restore",
        log_to_statsd=False,
    )
    def restore(self, uuid: str) -> Response:
        """Restore a soft-deleted dataset.
        ---
        post:
          summary: Restore a soft-deleted dataset
          parameters:
          - in: path
            schema:
              type: string
              format: uuid
            name: uuid
          responses:
            200:
              description: Dataset restored
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
            RestoreDatasetCommand(uuid).run()
            return self.response(200, message="OK")
        except DatasetNotFoundError:
            return self.response_404()
        except DatasetForbiddenError:
            return self.response_403()
        except DatasetLogicalDuplicateError as ex:
            return self.response_422(message=str(ex))
        except DatasetRestoreFailedError as ex:
            logger.error(
                "Error restoring model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
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

        When the ``SOFT_DELETE`` feature flag is enabled and an imported
        dataset's UUID matches an existing **soft-deleted** dataset, the
        import restores that dataset and applies the upload's contents —
        **even when ``overwrite`` is not set**. Active datasets keep the
        usual contract (never mutated without ``overwrite=true``); a
        soft-deleted UUID match is treated as an explicit request to bring
        the dataset back. Requires ``can_write`` and editorship of the
        deleted row (or admin). See UPDATING.md for details.
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
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.get_or_create_dataset"
        ),
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
        # Dual-path lookup. When the caller specifies ``schema``, query the
        # full ``(database_id, catalog, schema, table_name)`` uniqueness key
        # — this is the path that fixes #30377 by disambiguating datasets
        # that share a ``table_name`` across schemas/catalogs. When the
        # caller omits ``schema``, fall back to the legacy schema-agnostic
        # ``get_table_by_name`` so external callers that relied on
        # schema-blind matching still find their dataset (typically a
        # physical Postgres/MySQL table stored with a non-NULL schema).
        # If two datasets share the ``table_name`` across schemas and the
        # caller omits ``schema``, surface a 400 with an actionable message
        # instead of the original 500 ``MultipleResultsFound``.
        # Catalog follows the same literal-pass rule: existing datasets
        # created before multi-catalog support landed are stored with
        # ``catalog=None``, so applying ``database.get_default_catalog()``
        # would miss them.
        schema = body.get("schema") or None
        catalog = body.get("catalog") or None
        if schema:
            table = DatasetDAO.get_table_by_catalog_schema_and_name(
                database_id, schema, table_name, catalog=catalog
            )
        else:
            try:
                table = DatasetDAO.get_table_by_name(database_id, table_name)
            except MultipleResultsFound:
                return self.response_400(
                    message=(
                        f"Multiple datasets named '{table_name}' exist in this "
                        "database across different schemas. Specify the "
                        "'schema' field to disambiguate."
                    )
                )
        if table:
            return self.response(200, result={"table_id": table.id})

        body["database"] = database_id
        try:
            tbl = CreateDatasetCommand(body).run()
            return self.response(200, result={"table_id": tbl.id})
        except DatasetSoftDeletedTwinExistsError as ex:
            # Targeted hidden-twin 422 (single-sourced in the exception):
            # names the twin's uuid and the restore endpoint.
            return self.response_422(message=str(ex))
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
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.warm_up_cache",
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
        """  # noqa: E501
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

    @expose("/<id_or_uuid>", methods=("GET",))
    @protect()
    @safe
    @parse_rison(get_item_schema)
    @statsd_metrics
    @handle_api_exception
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,
    )
    def get(self, id_or_uuid: str, **kwargs: Any) -> Response:
        """Get a dataset.
        ---
        get:
          summary: Get a dataset
          description: Get a dataset by ID
          parameters:
          - in: path
            schema:
              type: string
            description: Either the id of the dataset, or its uuid
            name: id_or_uuid
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_item_schema'
          - in: query
            name: include_rendered_sql
            description: >-
              Should Jinja macros from sql, metrics and columns be rendered
              and included in the response
            schema:
              type: boolean
          responses:
            200:
              description: Dataset object has been returned.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        description: The item id
                        type: string
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.get'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        table = DatasetDAO.find_by_id_or_uuid(id_or_uuid)
        if not table:
            return self.response_404()

        response: dict[str, Any] = {}
        args = kwargs.get("rison", {})
        select_cols = args.get(API_SELECT_COLUMNS_RIS_KEY, [])
        pruned_select_cols = [col for col in select_cols if col in self.show_columns]
        self.set_response_key_mappings(
            response,
            self.get,
            args,
            **{API_SELECT_COLUMNS_RIS_KEY: pruned_select_cols},
        )
        if pruned_select_cols:
            show_model_schema = self.model2schemaconverter.convert(pruned_select_cols)
        else:
            show_model_schema = self.show_model_schema

        response["id"] = table.id
        response[API_RESULT_RES_KEY] = show_model_schema.dump(table, many=False)

        # remove folders from resposne if `DATASET_FOLDERS` is disabled, so that it's
        # possible to inspect if the feature is supported or not
        if (
            not is_feature_enabled("DATASET_FOLDERS")
            and "folders" in response[API_RESULT_RES_KEY]
        ):
            del response[API_RESULT_RES_KEY]["folders"]

        if parse_boolean_string(request.args.get("include_rendered_sql")):
            try:
                processor = get_template_processor(database=table.database, table=table)
                response["result"] = self.render_dataset_fields(
                    response["result"], processor
                )
            except SupersetTemplateException as ex:
                return self.response(ex.status, message=str(ex))

        return set_version_etag(
            self.response(200, **response),
            current_entity_etag_uuid(SqlaTable, table.id, table.uuid),
        )

    @expose("/<int:pk>/drill_info/", methods=("GET",))
    @protect()
    @parse_rison(get_drill_info_schema)
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.get_drill_info"
        ),
        log_to_statsd=False,
    )
    def get_drill_info(self, pk: int, **kwargs: Any) -> Response:
        """Get dataset drill info.
        ---
        get:
          summary: Get dataset drill info
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The dataset ID
          responses:
            200:
              description: Dataset drill info
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
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
        dashboard_id = kwargs["rison"].get("dashboard_id")
        drill_info_select_columns = [
            "id",
            "table_name",
            "editors.label",
            "editors.type",
            "created_by.first_name",
            "created_by.last_name",
            "created_on_humanized",
            "changed_by.first_name",
            "changed_by.last_name",
            "changed_on_humanized",
            "columns.column_name",
            "columns.verbose_name",
            "columns.groupby",
        ]
        dataset_schema = DatasetDrillInfoSchema()

        # First try with regular access
        dataset: SqlaTable | None = self.datamodel.get(
            pk,
            self._base_filters,
            drill_info_select_columns,
            self.show_outer_default_load,
        )
        if dataset:
            return self.response(200, result=dataset_schema.dump(dataset))

        # Embedded user must pass a dash ID
        if not dashboard_id and security_manager.is_guest_user():
            return self.response_403()
        # RBAC user must pass a dash ID for fallback validation
        if not dashboard_id:
            return self.response_404()

        # Lazy load the dashboard and dataset for RBAC/embedded access check
        dashboard = DashboardDAO.find_by_id(dashboard_id, skip_base_filter=True)
        dataset_ = DatasetDAO.find_by_id(pk, skip_base_filter=True)
        if not (dashboard and dataset_):
            return self.response_404()
        if not security_manager.can_drill_dataset_via_dashboard_access(
            dataset_,
            dashboard,
        ):
            return self.response_403()
        # Load dataset again skipping base filters
        # We don't use `dataset_` to avoid lazy loading columns
        dataset = self.datamodel.get(
            pk,
            None,
            drill_info_select_columns,
            self.show_outer_default_load,
        )
        return self.response(200, result=dataset_schema.dump(dataset))

    @staticmethod
    def render_dataset_fields(
        data: dict[str, Any], processor: BaseTemplateProcessor
    ) -> dict[str, Any]:
        """
        Renders Jinja macros in the ``sql``, ``metrics`` and ``columns`` fields.

        :param data: Dataset info to be rendered
        :param processor: A ``TemplateProcessor`` instance
        :return: Rendered dataset data
        """

        def render_item_list(item_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
            return [
                (
                    {
                        **item,
                        "rendered_expression": processor.process_template(
                            item["expression"]
                        ),
                    }
                    if item.get("expression")
                    else item
                )
                for item in item_list
            ]

        items: list[tuple[str, str, str, Callable[[Any], Any]]] = [
            ("query", "sql", "rendered_sql", processor.process_template),
            ("metric", "metrics", "metrics", render_item_list),
            ("calculated column", "columns", "columns", render_item_list),
        ]
        for item_type, key, new_key, func in items:
            if not data.get(key):
                continue

            try:
                data[new_key] = func(data[key])
            except (TemplateSyntaxError, SupersetSyntaxErrorException) as ex:
                template_exception = SupersetTemplateException(
                    f"Unable to render expression from dataset {item_type}.",
                )
                raise template_exception from ex

        return data

    @expose("/<uuid_str>/versions/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.list_versions",
        log_to_statsd=False,
    )
    def list_versions(self, uuid_str: str) -> Response:
        """List version history for a dataset.
        ---
        get:
          summary: Return the version history for a dataset
          parameters:
          - in: path
            schema:
              type: string
              format: uuid
            name: uuid_str
            description: Dataset UUID
          responses:
            200:
              description: Version history ordered by oldest first
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/VersionListItemSchema'
                      count:
                        type: integer
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        return list_versions_endpoint(
            self, SqlaTable, uuid_str, access_kwarg="datasource"
        )

    @expose(
        "/<uuid_str>/versions/<version_uuid_str>/",
        methods=("GET",),
    )
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_version",  # noqa: E501
        log_to_statsd=False,
    )
    def get_version(self, uuid_str: str, version_uuid_str: str) -> Response:
        """Return the dataset's state at a specific version.
        ---
        get:
          summary: Read-only snapshot of the dataset at a given version
          description: >-
            Returns the dataset's scalar fields plus reconstructed
            ``columns`` and ``metrics`` lists as they were at the target
            version. Does not modify live state.
          parameters:
          - in: path
            schema:
              type: string
              format: uuid
            name: uuid_str
            description: Dataset UUID
          - in: path
            schema:
              type: string
              format: uuid
            name: version_uuid_str
            description: Version UUID as returned by the list endpoint
          responses:
            200:
              description: Snapshot of the dataset at the target version
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
                        description: >-
                          The dataset's scalar fields at the target version
                          (entity-specific keys), plus `columns` / `metrics`
                          as they were at that version, plus a `_version`
                          block with the version-level metadata.
                        properties:
                          _version:
                            $ref: '#/components/schemas/VersionListItemSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        return get_version_endpoint(
            self, SqlaTable, uuid_str, version_uuid_str, access_kwarg="datasource"
        )
