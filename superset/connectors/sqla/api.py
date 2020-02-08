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
from typing import Dict, List

from flask import g, request, Response
from flask_appbuilder import permission_name
from flask_appbuilder.api import (
    expose,
    get_item_schema,
    get_list_schema,
    protect,
    rison,
    safe,
)
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import fields, post_load, ValidationError
from marshmallow.validate import Length

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.connectors.sqla.validators import (
    validate_database,
    validate_python_date_format,
    validate_table_exists,
    validate_table_uniqueness,
    validate_table_column_name,
)
from superset.constants import RouteMethod
from superset.exceptions import SupersetSecurityException
from superset.views.base import check_ownership, DatasourceFilter
from superset.views.base_api import BaseOwnedModelRestApi, BaseSupersetModelRestApi
from superset.views.base_schemas import BaseOwnedSchema, validate_owner

logger = logging.getLogger(__name__)


class DatasetPostSchema(BaseOwnedSchema):
    __class_model__ = SqlaTable

    database = fields.Integer(required=True, validate=validate_database)
    schema = fields.String()
    table_name = fields.String(
        required=True, allow_none=False, validate=Length(1, 250)
    )
    owners = fields.List(fields.Integer(validate=validate_owner))

    @post_load
    def make_object(self, data: Dict, discard: List[str] = None) -> SqlaTable:
        instance = super().make_object(data, discard=["database"])
        instance.database = g.tmp_database
        return instance


class DatasetPutSchema(BaseOwnedSchema):
    __class_model__ = SqlaTable

    table_name = fields.String(allow_none=True, validate=Length(1, 250))
    sql = fields.String(allow_none=True)
    filter_select_enabled = fields.Boolean(allow_none=True)
    fetch_values_predicate = fields.String(allow_none=True, validate=Length(0, 1000))
    schema = fields.String(allow_none=True, validate=Length(1, 255))
    description = fields.String(allow_none=True)
    main_dttm_col = fields.String(allow_none=True)
    offset = fields.Integer(allow_none=True)
    default_endpoint = fields.String(allow_none=True)
    cache_timeout = fields.Integer(allow_none=True)
    is_sqllab_view = fields.Boolean(allow_none=True)
    template_params = fields.String(allow_none=True)
    owners = fields.List(fields.Integer(validate=validate_owner))


class DatasetRestApi(BaseOwnedModelRestApi):
    datamodel = SQLAInterface(SqlaTable)
    base_filters = [["id", DatasourceFilter, lambda: []]]

    resource_name = "dataset"
    allow_browser_login = True

    class_permission_name = "TableModelView"
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {RouteMethod.RELATED}

    list_columns = [
        "database_name",
        "changed_by.username",
        "changed_on",
        "table_name",
        "schema",
    ]
    show_columns = [
        "database.database_name",
        "database.id",
        "table_name",
        "sql",
        "filter_select_enabled",
        "fetch_values_predicate",
        "schema",
        "description",
        "main_dttm_col",
        "offset",
        "default_endpoint",
        "cache_timeout",
        "is_sqllab_view",
        "template_params",
        "owners.id",
        "owners.username",
    ]
    add_model_schema = DatasetPostSchema()
    edit_model_schema = DatasetPutSchema()
    add_columns = ["database", "schema", "table_name", "owners"]
    edit_columns = [
        "table_name",
        "sql",
        "filter_select_enabled",
        "fetch_values_predicate",
        "schema",
        "description",
        "main_dttm_col",
        "offset",
        "default_endpoint",
        "cache_timeout",
        "is_sqllab_view",
        "template_params",
        "owners",
    ]
    openapi_spec_tag = "Datasets"

    def pre_add(self, item):
        try:
            validate_table_uniqueness(item.data)
        except ValidationError as e:
            item.errors.update(e.normalized_messages())
        try:
            validate_table_exists(item.data)
        except ValidationError as e:
            item.errors.update(e.normalized_messages())

    def pre_update(self, item):
        try:
            validate_table_exists(item.data)
        except ValidationError as e:
            item.errors.update(e.normalized_messages())


class DatasetColumnRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(TableColumn)

    resource_name = "dataset"
    allow_browser_login = True
    class_permission_name = "TableColumnInlineView"
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {RouteMethod.RELATED}
    openapi_spec_tag = "Datasets"

    list_columns = [
        "column_name",
        "verbose_name",
        "type",
        "groupby",
        "filterable",
        "is_dttm",
    ]

    show_columns = [
        "column_name",
        "verbose_name",
        "description",
        "type",
        "groupby",
        "filterable",
        "expression",
        "is_dttm",
        "python_date_format",
    ]
    add_columns = show_columns + ["table"]
    edit_columns = show_columns + ["table"]

    validators_columns = {
        "column_name": validate_table_column_name,
        "python_date_format": validate_python_date_format
    }

    def check_dataset_exists(self, dataset_id: int) -> SqlaTable:
        """
            Checks if a dataset exists by id and filtering be it's base filter
            takes into account security
        """
        datamodel = SQLAInterface(SqlaTable, self.datamodel.session)
        filters = datamodel.get_filters().add_filter_list(
            DatasetRestApi.base_filters
        )
        return datamodel.get(dataset_id, filters)

    @expose("/<pk>/column/", methods=["GET"])
    @protect()
    @safe
    @permission_name("get")
    @rison(get_list_schema)
    def get_list(self, pk: int, **kwargs):  # pylint: disable=arguments-differ
        """Get list of columns from a dataset
        ---
        get:
          description: >-
            Query columns from a dataset, accepts filters, ordering and pagination
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The dataset id
            required: true
          - $ref: '#/components/parameters/get_list_schema'
          responses:
            200:
              description: Items from Model
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      ids:
                        type: array
                        items:
                          type: string
                      result:
                          type: array
                          items:
                            $ref:
                              '#/components/schemas/{{self.__class__.__name__}}.get_list'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item = self.check_dataset_exists(pk)
        if not item:
            return self.response_404()
        filters = kwargs["rison"].get("filters", [])
        filters.append({"col": "table", "opr": "rel_o_m", "value": pk})
        kwargs["rison"]["filters"] = filters
        return super().get_list_headless(**kwargs)

    @expose("/<int:pk>/column/<column_id>", methods=["GET"])
    @protect()
    @safe
    @permission_name("get")
    @rison(get_item_schema)
    def get(
        self, pk: int, column_id: int, **kwargs
    ):  # pylint: disable=arguments-differ
        """Get column from a dataset
        ---
        get:
          description: >-
            Get a column from a dataset
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The dataset id
            required: true
          - in: path
            schema:
              type: integer
            name: column_id
          - $ref: '#/components/parameters/get_item_schema'
          responses:
            200:
              description: Items from Model
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      ids:
                        type: array
                        items:
                          type: string
                      result:
                          type: array
                          items:
                            $ref: '#/components/schemas/{{self.__class__.__name__}}.get'  # noqa
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item = self.check_dataset_exists(pk)
        if not item:
            return self.response_404()
        return super().get_headless(column_id, **kwargs)

    @expose("/<int:pk>/column/", methods=["POST"])
    @protect()
    @safe
    @permission_name("post")
    def post(self, pk):  # pylint: disable=arguments-differ
        """Add a column to a dataset
        ---
        post:
          description: >-
            Add a column to a dataset
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The dataset id
          requestBody:
            description: Model schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Item inserted
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: string
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item = self.check_dataset_exists(pk)
        if not item:
            return self.response_404()
        try:
            check_ownership(item)
        except SupersetSecurityException as e:
            return self.response(403, message=str(e))
        request.json["table"] = pk
        return self.post_headless()

    @expose("/<int:pk>/column/<column_id>", methods=["PUT"])
    @protect()
    @safe
    @permission_name("put")
    def put(self, pk: int, column_id: int):  # pylint: disable=arguments-differ
        """Change a column from a dataset
        ---
        put:
          description: >-
            Change a column from a dataset
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The dataset id
          - in: path
            schema:
              type: integer
            name: column_id
            description: The column id
          requestBody:
            description: Model schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Item changed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
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
        item = self.check_dataset_exists(pk)
        if not item:
            return self.response_404()
        try:
            check_ownership(item)
        except SupersetSecurityException as e:
            return self.response(403, message=str(e))
        request.json["table"] = pk
        return self.put_headless(column_id)

    @expose("/<int:pk>/column/<column_id>", methods=["DELETE"])
    @protect()
    @safe
    @permission_name("delete")
    def delete(
        self, pk: int, column_id: int  # pylint: disable=arguments-differ
    ) -> Response:
        """Delete a column from a dataset
        ---
        delete:
          description: >-
            Delete a column from a dataset
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
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
        item = self.check_dataset_exists(pk)
        if not item:
            return self.response_404()
        try:
            check_ownership(item)
        except SupersetSecurityException as e:
            return self.response(403, message=str(e))
        return self.delete_headless(column_id)
