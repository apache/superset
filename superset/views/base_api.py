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
from timeit import default_timer
from typing import Any, cast, Dict, Optional, Set, Tuple, Type, Union

from flask import request, Response
from flask_appbuilder import ModelRestApi
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.filters import BaseFilter, Filters
from flask_appbuilder.models.sqla.filters import FilterStartsWith
from sqlalchemy.exc import SQLAlchemyError

from superset.exceptions import SupersetSecurityException
from superset.views.base import check_ownership

logger = logging.getLogger(__name__)
get_related_schema = {
    "type": "object",
    "properties": {
        "page_size": {"type": "integer"},
        "page": {"type": "integer"},
        "filter": {"type": "string"},
    },
}


def statsd_incr(f):
    """
        Handle sending all statsd metrics from the REST API
    """

    def wraps(self, *args: Any, **kwargs: Any) -> Response:
        start = default_timer()
        response = f(self, *args, **kwargs)
        stop = default_timer()
        self.send_stats_metrics(response, f.__name__, stop - start)
        return response

    return functools.update_wrapper(wraps, f)


def check_ownership_and_item_exists(f):
    """
    A Decorator that checks if an object exists and is owned by the current user
    """

    def wraps(self, pk):
        item = self.datamodel.get(
            pk, self._base_filters  # pylint: disable=protected-access
        )
        if not item:
            return self.response_404()
        try:
            check_ownership(item)
        except SupersetSecurityException as ex:
            return self.response(403, message=str(ex))
        return f(self, item)

    return functools.update_wrapper(wraps, f)


class RelatedFieldFilter:
    # data class to specify what filter to use on a /related endpoint
    # pylint: disable=too-few-public-methods
    def __init__(self, field_name: str, filter_class: Type[BaseFilter]):
        self.field_name = field_name
        self.filter_class = filter_class


class BaseSupersetModelRestApi(ModelRestApi):
    """
    Extends FAB's ModelResApi to implement specific superset generic functionality
    """

    csrf_exempt = False
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
        "refresh": "edit",
        "data": "list",
    }

    order_rel_fields: Dict[str, Tuple[str, str]] = {}
    """
    Impose ordering on related fields query::

        order_rel_fields = {
            "<RELATED_FIELD>": ("<RELATED_FIELD_FIELD>", "<asc|desc>"),
             ...
        }
    """  # pylint: disable=pointless-string-statement
    related_field_filters: Dict[str, Union[RelatedFieldFilter, str]] = {}
    """
    Declare the filters for related fields::

        related_fields = {
            "<RELATED_FIELD>": <RelatedFieldFilter>)
        }
    """  # pylint: disable=pointless-string-statement
    filter_rel_fields: Dict[str, BaseFilter] = {}
    """
    Declare the related field base filter::

        filter_rel_fields_field = {
            "<RELATED_FIELD>": "<FILTER>")
        }
    """  # pylint: disable=pointless-string-statement
    allowed_rel_fields: Set[str] = set()

    def __init__(self):
        super().__init__()
        self.stats_logger = None

    def create_blueprint(self, appbuilder, *args, **kwargs):
        self.stats_logger = self.appbuilder.get_app.config["STATS_LOGGER"]
        return super().create_blueprint(appbuilder, *args, **kwargs)

    def _init_properties(self):
        model_id = self.datamodel.get_pk_name()
        if self.list_columns is None and not self.list_model_schema:
            self.list_columns = [model_id]
        if self.show_columns is None and not self.show_model_schema:
            self.show_columns = [model_id]
        if self.edit_columns is None and not self.edit_model_schema:
            self.edit_columns = [model_id]
        if self.add_columns is None and not self.add_model_schema:
            self.add_columns = [model_id]
        super()._init_properties()

    def _get_related_filter(self, datamodel, column_name: str, value: str) -> Filters:
        filter_field = self.related_field_filters.get(column_name)
        if isinstance(filter_field, str):
            filter_field = RelatedFieldFilter(cast(str, filter_field), FilterStartsWith)
        filter_field = cast(RelatedFieldFilter, filter_field)
        search_columns = [filter_field.field_name] if filter_field else None
        filters = datamodel.get_filters(search_columns)
        base_filters = self.filter_rel_fields.get(column_name)
        if base_filters:
            filters.add_filter_list(base_filters)
        if value and filter_field:
            filters.add_filter(
                filter_field.field_name, filter_field.filter_class, value
            )
        return filters

    def incr_stats(self, action: str, func_name: str) -> None:
        """
            Proxy function for statsd.incr to impose a key structure for REST API's
        :param action: String with an action name eg: error, success
        :param func_name: The function name
        """
        self.stats_logger.incr(f"{self.__class__.__name__}.{func_name}.{action}")

    def timing_stats(self, action: str, func_name: str, value: float) -> None:
        """
            Proxy function for statsd.incr to impose a key structure for REST API's
        :param action: String with an action name eg: error, success
        :param func_name: The function name
        :param value: A float with the time it took for the endpoint to execute
        """
        self.stats_logger.timing(
            f"{self.__class__.__name__}.{func_name}.{action}", value
        )

    def send_stats_metrics(
        self, response: Response, key: str, time_delta: Optional[float] = None
    ) -> None:
        """
            Helper function to handle sending statsd metrics
        :param response: flask response object, will evaluate if it was an error
        :param key: The function name
        :param time_delta: Optional time it took for the endpoint to execute
        """
        if 200 <= response.status_code < 400:
            self.incr_stats("success", key)
        else:
            self.incr_stats("error", key)
        if time_delta:
            self.timing_stats("time", key, time_delta)

    def info_headless(self, **kwargs) -> Response:
        """
            Add statsd metrics to builtin FAB _info endpoint
        """
        start = default_timer()
        response = super().info_headless(**kwargs)
        stop = default_timer()
        self.send_stats_metrics(response, self.info.__name__, stop - start)
        return response

    def get_headless(self, pk, **kwargs) -> Response:
        """
            Add statsd metrics to builtin FAB GET endpoint
        """
        start = default_timer()
        response = super().get_headless(pk, **kwargs)
        stop = default_timer()
        self.send_stats_metrics(response, self.get.__name__, stop - start)
        return response

    def get_list_headless(self, **kwargs) -> Response:
        """
            Add statsd metrics to builtin FAB GET list endpoint
        """
        start = default_timer()
        response = super().get_list_headless(**kwargs)
        stop = default_timer()
        self.send_stats_metrics(response, self.get_list.__name__, stop - start)
        return response

    @expose("/related/<column_name>", methods=["GET"])
    @protect()
    @safe
    @statsd_incr
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
        if column_name not in self.allowed_rel_fields:
            self.incr_stats("error", self.related.__name__)
            return self.response_404()
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
        except SQLAlchemyError as ex:
            logger.error(f"Error updating model {self.__class__.__name__}: {ex}")
            return self.response_422(message=str(ex))

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
        except SQLAlchemyError as ex:
            logger.error(f"Error creating model {self.__class__.__name__}: {ex}")
            return self.response_422(message=str(ex))

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
        except SQLAlchemyError as ex:
            logger.error(f"Error deleting model {self.__class__.__name__}: {ex}")
            return self.response_422(message=str(ex))
