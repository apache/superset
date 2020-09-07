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
from typing import Any, Callable, cast, Dict, List, Optional, Set, Tuple, Type, Union

from apispec import APISpec
from apispec.exceptions import DuplicateComponentNameError
from flask import Blueprint, Response
from flask_appbuilder import AppBuilder, ModelRestApi
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.filters import BaseFilter, Filters
from flask_appbuilder.models.sqla.filters import FilterStartsWith
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import fields, Schema
from sqlalchemy import distinct, func

from superset.stats_logger import BaseStatsLogger
from superset.typing import FlaskResponse
from superset.utils.core import time_function

logger = logging.getLogger(__name__)
get_related_schema = {
    "type": "object",
    "properties": {
        "page_size": {"type": "integer"},
        "page": {"type": "integer"},
        "filter": {"type": "string"},
    },
}


class RelatedResultResponseSchema(Schema):
    value = fields.Integer(description="The related item identifier")
    text = fields.String(description="The related item string representation")


class RelatedResponseSchema(Schema):
    count = fields.Integer(description="The total number of related values")
    result = fields.List(fields.Nested(RelatedResultResponseSchema))


class DistinctResultResponseSchema(Schema):
    text = fields.String(description="The distinct item")


class DistincResponseSchema(Schema):
    count = fields.Integer(description="The total number of distinct values")
    result = fields.List(fields.Nested(DistinctResultResponseSchema))


def statsd_metrics(f: Callable[..., Any]) -> Callable[..., Any]:
    """
    Handle sending all statsd metrics from the REST API
    """

    def wraps(self: "BaseSupersetModelRestApi", *args: Any, **kwargs: Any) -> Response:
        duration, response = time_function(f, self, *args, **kwargs)
        self.send_stats_metrics(response, f.__name__, duration)
        return response

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
        "distinct": "list",
        "thumbnail": "list",
        "refresh": "edit",
        "data": "list",
        "viz_types": "list",
        "related_objects": "list",
        "table_metadata": "list",
        "select_star": "list",
        "schemas": "list",
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

    allowed_distinct_fields: Set[str] = set()

    openapi_spec_component_schemas: Tuple[Type[Schema], ...] = tuple()
    """
    Add extra schemas to the OpenAPI component schemas section
    """  # pylint: disable=pointless-string-statement

    add_columns: List[str]
    edit_columns: List[str]
    list_columns: List[str]
    show_columns: List[str]

    def __init__(self) -> None:
        # Setup statsd
        self.stats_logger = BaseStatsLogger()
        # Add base API spec base query parameter schemas
        if self.apispec_parameter_schemas is None:  # type: ignore
            self.apispec_parameter_schemas = {}
        self.apispec_parameter_schemas["get_related_schema"] = get_related_schema
        if self.openapi_spec_component_schemas is None:
            self.openapi_spec_component_schemas = ()
        self.openapi_spec_component_schemas = self.openapi_spec_component_schemas + (
            RelatedResponseSchema,
            DistincResponseSchema,
        )
        super().__init__()

    def add_apispec_components(self, api_spec: APISpec) -> None:

        for schema in self.openapi_spec_component_schemas:
            try:
                api_spec.components.schema(
                    schema.__name__, schema=schema,
                )
            except DuplicateComponentNameError:
                pass
        super().add_apispec_components(api_spec)

    def create_blueprint(
        self, appbuilder: AppBuilder, *args: Any, **kwargs: Any
    ) -> Blueprint:
        self.stats_logger = self.appbuilder.get_app.config["STATS_LOGGER"]
        return super().create_blueprint(appbuilder, *args, **kwargs)

    def _init_properties(self) -> None:
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

    def _get_related_filter(
        self, datamodel: SQLAInterface, column_name: str, value: str
    ) -> Filters:
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

    def _get_distinct_filter(self, column_name: str, value: str) -> Filters:
        filter_field = RelatedFieldFilter(column_name, FilterStartsWith)
        filter_field = cast(RelatedFieldFilter, filter_field)
        search_columns = [filter_field.field_name] if filter_field else None
        filters = self.datamodel.get_filters(search_columns)
        filters.add_filter_list(self.base_filters)
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

    def info_headless(self, **kwargs: Any) -> Response:
        """
        Add statsd metrics to builtin FAB _info endpoint
        """
        duration, response = time_function(super().info_headless, **kwargs)
        self.send_stats_metrics(response, self.info.__name__, duration)
        return response

    def get_headless(self, pk: int, **kwargs: Any) -> Response:
        """
        Add statsd metrics to builtin FAB GET endpoint
        """
        duration, response = time_function(super().get_headless, pk, **kwargs)
        self.send_stats_metrics(response, self.get.__name__, duration)
        return response

    def get_list_headless(self, **kwargs: Any) -> Response:
        """
        Add statsd metrics to builtin FAB GET list endpoint
        """
        duration, response = time_function(super().get_list_headless, **kwargs)
        self.send_stats_metrics(response, self.get_list.__name__, duration)
        return response

    @expose("/related/<column_name>", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_related_schema)
    def related(self, column_name: str, **kwargs: Any) -> FlaskResponse:
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
                  $ref: '#/components/schemas/get_related_schema'
          responses:
            200:
              description: Related column data
              content:
                application/json:
                  schema:
                  schema:
                    $ref: "#/components/schemas/RelatedResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
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

    @expose("/distinct/<column_name>", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_related_schema)
    def distinct(self, column_name: str, **kwargs: Any) -> FlaskResponse:
        """Get distinct values from field data
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
                  $ref: '#/components/schemas/get_related_schema'
          responses:
            200:
              description: Distinct field data
              content:
                application/json:
                  schema:
                  schema:
                    $ref: "#/components/schemas/DistincResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        if column_name not in self.allowed_distinct_fields:
            self.incr_stats("error", self.related.__name__)
            return self.response_404()
        args = kwargs.get("rison", {})
        # handle pagination
        page, page_size = self._sanitize_page_args(*self._handle_page_args(args))
        # Create generic base filters with added request filter
        filters = self._get_distinct_filter(column_name, args.get("filter"))
        # Make the query
        query_count = self.appbuilder.get_session.query(
            func.count(distinct(getattr(self.datamodel.obj, column_name)))
        )
        count = self.datamodel.apply_filters(query_count, filters).scalar()
        if count == 0:
            return self.response(200, count=count, result=[])
        query = self.appbuilder.get_session.query(
            distinct(getattr(self.datamodel.obj, column_name))
        )
        # Apply generic base filters with added request filter
        query = self.datamodel.apply_filters(query, filters)
        # Apply sort
        query = self.datamodel.apply_order_by(query, column_name, "asc")
        # Apply pagination
        result = self.datamodel.apply_pagination(query, page, page_size).all()
        # produce response
        result = [
            {"text": item[0], "value": item[0]}
            for item in result
            if item[0] is not None
        ]
        return self.response(200, count=count, result=result)
