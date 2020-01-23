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
import functools
import logging
from typing import Dict, Tuple

from flask import request
from flask_appbuilder import ModelRestApi
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.filters import Filters
from sqlalchemy.exc import SQLAlchemyError

from superset.exceptions import SupersetSecurityException
from superset.views.base import check_ownership

get_related_schema = {
    "type": "object",
    "properties": {
        "page_size": {"type": "integer"},
        "page": {"type": "integer"},
        "filter": {"type": "string"},
    },
}


def check_ownership_and_item_exists(f):
    """
    A Decorator that checks if an object exists and is owned by the current user
    """

    def wraps(self, pk):  # pylint: disable=invalid-name
        item = self.datamodel.get(
            pk, self._base_filters  # pylint: disable=protected-access
        )
        if not item:
            return self.response_404()
        try:
            check_ownership(item)
        except SupersetSecurityException as e:
            return self.response(403, message=str(e))
        return f(self, item)

    return functools.update_wrapper(wraps, f)


class BaseSupersetModelRestApi(ModelRestApi):
    """
    Extends FAB's ModelResApi to implement specific superset generic functionality
    """

    logger = logging.getLogger(__name__)
    method_permission_name = {
        "get_list": "list",
        "get": "show",
        "export": "mulexport",
        "post": "add",
        "put": "edit",
        "delete": "delete",
        "bulk_delete": "delete",
        "info": "list",
        "related": "list",
    }

    order_rel_fields: Dict[str, Tuple[str, str]] = {}
    """
    Impose ordering on related fields query::

        order_rel_fields = {
            "<RELATED_FIELD>": ("<RELATED_FIELD_FIELD>", "<asc|desc>"),
             ...
        }
    """  # pylint: disable=pointless-string-statement
    filter_rel_fields_field: Dict[str, str] = {}
    """
    Declare the related field field for filtering::

        filter_rel_fields_field = {
            "<RELATED_FIELD>": "<RELATED_FIELD_FIELD>", "<asc|desc>")
        }
    """  # pylint: disable=pointless-string-statement

    def _get_related_filter(self, datamodel, column_name: str, value: str) -> Filters:
        filter_field = self.filter_rel_fields_field.get(column_name)
        filters = datamodel.get_filters([filter_field])
        if value:
            filters.rest_add_filters(
                [{"opr": "sw", "col": filter_field, "value": value}]
            )
        return filters

    @expose("/related/<column_name>", methods=["GET"])
    @protect()
    @safe
    @rison(get_related_schema)
    def related(self, column_name: str, **kwargs):
        """Get related fields data
        ---
        get:
          parameters:
          - in: path
            schema:
              type: string
            name: column_name
          - in: query
            name: q
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    page_size:
                      type: integer
                    page:
                      type: integer
                    filter:
                      type: string
          responses:
            200:
              description: Related column data
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      count:
                        type: integer
                      result:
                        type: object
                        properties:
                          value:
                            type: integer
                          text:
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
        args = kwargs.get("rison", {})
        # handle pagination
        page, page_size = self._handle_page_args(args)
        try:
            datamodel = self.datamodel.get_related_interface(column_name)
        except KeyError:
            return self.response_404()
        page, page_size = self._sanitize_page_args(page, page_size)
        # handle ordering
        order_field = self.order_rel_fields.get(column_name)
        if order_field:
            order_column, order_direction = order_field
        else:
            order_column, order_direction = "", ""
        # handle filters
        filters = self._get_related_filter(datamodel, column_name, args.get("filter"))
        # Make the query
        count, values = datamodel.query(
            filters, order_column, order_direction, page=page, page_size=page_size
        )
        # produce response
        result = [
            {"value": datamodel.get_pk_value(value), "text": str(value)}
            for value in values
        ]
        return self.response(200, count=count, result=result)


class BaseOwnedModelRestApi(BaseSupersetModelRestApi):
    @expose("/<pk>", methods=["PUT"])
    @protect()
    @check_ownership_and_item_exists
    @safe
    def put(self, item):  # pylint: disable=arguments-differ
        """Changes a owned Model
        ---
        put:
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
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
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            self.response_400(message="Request is not JSON")
        item = self.edit_model_schema.load(request.json, instance=item)
        if item.errors:
            return self.response_422(message=item.errors)
        try:
            self.datamodel.edit(item.data, raise_exception=True)
            return self.response(
                200, result=self.edit_model_schema.dump(item.data, many=False).data
            )
        except SQLAlchemyError as e:
            self.logger.error(f"Error updating model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))

    @expose("/", methods=["POST"])
    @protect()
    @safe
    def post(self):
        """Creates a new owned Model
        ---
        post:
          requestBody:
            description: Model schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Model added
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
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        if item.errors:
            return self.response_422(message=item.errors)
        try:
            self.datamodel.add(item.data, raise_exception=True)
            return self.response(
                201,
                result=self.add_model_schema.dump(item.data, many=False).data,
                id=item.data.id,
            )
        except SQLAlchemyError as e:
            self.logger.error(f"Error creating model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))

    @expose("/<pk>", methods=["DELETE"])
    @protect()
    @check_ownership_and_item_exists
    @safe
    def delete(self, item):  # pylint: disable=arguments-differ
        """Deletes owned Model
        ---
        delete:
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Model delete
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
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            self.datamodel.delete(item, raise_exception=True)
            return self.response(200, message="OK")
        except SQLAlchemyError as e:
            self.logger.error(f"Error deleting model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))
