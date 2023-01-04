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

from flask import Blueprint, request, Response
from flask_appbuilder import AppBuilder, Model, ModelRestApi
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.filters import BaseFilter, Filters
from flask_appbuilder.models.sqla.filters import FilterStartsWith
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _
from marshmallow import fields, Schema
from sqlalchemy import and_, distinct, func
from sqlalchemy.orm.query import Query

from superset.exceptions import InvalidPayloadFormatError
from superset.extensions import db, event_logger, security_manager
from superset.models.core import FavStar
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.schemas import error_payload_content
from superset.sql_lab import Query as SqllabQuery
from superset.stats_logger import BaseStatsLogger
from superset.superset_typing import FlaskResponse
from superset.utils.core import get_user_id, time_function
from superset.views.base import handle_api_exception

logger = logging.getLogger(__name__)
get_related_schema = {
    "type": "object",
    "properties": {
        "page_size": {"type": "integer"},
        "page": {"type": "integer"},
        "include_ids": {"type": "array", "items": {"type": "integer"}},
        "filter": {"type": "string"},
    },
}


class RelatedResultResponseSchema(Schema):
    value = fields.Integer(description="The related item identifier")
    text = fields.String(description="The related item string representation")
    extra = fields.Dict(description="The extra metadata for related item")


class RelatedResponseSchema(Schema):
    count = fields.Integer(description="The total number of related values")
    result = fields.List(fields.Nested(RelatedResultResponseSchema))


class DistinctResultResponseSchema(Schema):
    text = fields.String(description="The distinct item")


class DistincResponseSchema(Schema):
    count = fields.Integer(description="The total number of distinct values")
    result = fields.List(fields.Nested(DistinctResultResponseSchema))


def requires_json(f: Callable[..., Any]) -> Callable[..., Any]:
    """
    Require JSON-like formatted request to the REST API
    """

    def wraps(self: "BaseSupersetModelRestApi", *args: Any, **kwargs: Any) -> Response:
        if not request.is_json:
            raise InvalidPayloadFormatError(message="Request is not JSON")
        return f(self, *args, **kwargs)

    return functools.update_wrapper(wraps, f)


def requires_form_data(f: Callable[..., Any]) -> Callable[..., Any]:
    """
    Require 'multipart/form-data' as request MIME type
    """

    def wraps(self: "BaseSupersetModelRestApi", *args: Any, **kwargs: Any) -> Response:
        if not request.mimetype == "multipart/form-data":
            raise InvalidPayloadFormatError(
                message="Request MIME type is not 'multipart/form-data'"
            )
        return f(self, *args, **kwargs)

    return functools.update_wrapper(wraps, f)


def statsd_metrics(f: Callable[..., Any]) -> Callable[..., Any]:
    """
    Handle sending all statsd metrics from the REST API
    """

    def wraps(self: "BaseSupersetModelRestApi", *args: Any, **kwargs: Any) -> Response:
        try:
            duration, response = time_function(f, self, *args, **kwargs)
        except Exception as ex:
            self.incr_stats("error", f.__name__)
            raise ex

        self.send_stats_metrics(response, f.__name__, duration)
        return response

    return functools.update_wrapper(wraps, f)


class RelatedFieldFilter:
    # data class to specify what filter to use on a /related endpoint
    # pylint: disable=too-few-public-methods
    def __init__(self, field_name: str, filter_class: Type[BaseFilter]):
        self.field_name = field_name
        self.filter_class = filter_class


class BaseFavoriteFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Base Custom filter for the GET list that filters all dashboards, slices
    that a user has favored or not
    """

    name = _("Is favorite")
    arg_name = ""
    class_name = ""
    """ The FavStar class_name to user """
    model: Type[Union[Dashboard, Slice, SqllabQuery]] = Dashboard
    """ The SQLAlchemy model """

    def apply(self, query: Query, value: Any) -> Query:
        # If anonymous user filter nothing
        if security_manager.current_user is None:
            return query
        users_favorite_query = db.session.query(FavStar.obj_id).filter(
            and_(
                FavStar.user_id == get_user_id(),
                FavStar.class_name == self.class_name,
            )
        )
        if value:
            return query.filter(and_(self.model.id.in_(users_favorite_query)))
        return query.filter(and_(~self.model.id.in_(users_favorite_query)))


class BaseSupersetModelRestApi(ModelRestApi):
    """
    Extends FAB's ModelResApi to implement specific superset generic functionality
    """

    csrf_exempt = False
    method_permission_name = {
        "bulk_delete": "delete",
        "data": "list",
        "data_from_cache": "list",
        "delete": "delete",
        "distinct": "list",
        "export": "mulexport",
        "import_": "add",
        "get": "show",
        "get_list": "list",
        "info": "list",
        "post": "add",
        "put": "edit",
        "refresh": "edit",
        "related": "list",
        "related_objects": "list",
        "schemas": "list",
        "select_star": "list",
        "table_metadata": "list",
        "test_connection": "post",
        "thumbnail": "list",
        "viz_types": "list",
    }

    order_rel_fields: Dict[str, Tuple[str, str]] = {}
    """
    Impose ordering on related fields query::

        order_rel_fields = {
            "<RELATED_FIELD>": ("<RELATED_FIELD_FIELD>", "<asc|desc>"),
             ...
        }
    """

    related_field_filters: Dict[str, Union[RelatedFieldFilter, str]] = {}
    """
    Declare the filters for related fields::

        related_fields = {
            "<RELATED_FIELD>": <RelatedFieldFilter>)
        }
    """

    filter_rel_fields: Dict[str, BaseFilter] = {}
    """
    Declare the related field base filter::

        filter_rel_fields_field = {
            "<RELATED_FIELD>": "<FILTER>")
        }
    """
    allowed_rel_fields: Set[str] = set()
    # Declare a set of allowed related fields that the `related` endpoint supports.

    text_field_rel_fields: Dict[str, str] = {}
    """
    Declare an alternative for the human readable representation of the Model object::

        text_field_rel_fields = {
            "<RELATED_FIELD>": "<RELATED_OBJECT_FIELD>"
        }
    """

    extra_fields_rel_fields: Dict[str, List[str]] = {"owners": ["email", "active"]}
    """
    Declare extra fields for the representation of the Model object::

        extra_fields_rel_fields = {
            "<RELATED_FIELD>": "[<RELATED_OBJECT_FIELD_1>, <RELATED_OBJECT_FIELD_2>]"
        }
    """

    allowed_distinct_fields: Set[str] = set()

    add_columns: List[str]
    edit_columns: List[str]
    list_columns: List[str]
    show_columns: List[str]

    responses = {
        "400": {"description": "Bad request", "content": error_payload_content},
        "401": {"description": "Unauthorized", "content": error_payload_content},
        "403": {"description": "Forbidden", "content": error_payload_content},
        "404": {"description": "Not found", "content": error_payload_content},
        "422": {
            "description": "Could not process entity",
            "content": error_payload_content,
        },
        "500": {"description": "Fatal error", "content": error_payload_content},
    }

    def __init__(self) -> None:
        super().__init__()
        # Setup statsd
        self.stats_logger = BaseStatsLogger()
        # Add base API spec base query parameter schemas
        if self.apispec_parameter_schemas is None:  # type: ignore
            self.apispec_parameter_schemas = {}
        self.apispec_parameter_schemas["get_related_schema"] = get_related_schema
        self.openapi_spec_component_schemas: Tuple[
            Type[Schema], ...
        ] = self.openapi_spec_component_schemas + (
            RelatedResponseSchema,
            DistincResponseSchema,
        )

    def create_blueprint(
        self, appbuilder: AppBuilder, *args: Any, **kwargs: Any
    ) -> Blueprint:
        self.stats_logger = self.appbuilder.get_app.config["STATS_LOGGER"]
        return super().create_blueprint(appbuilder, *args, **kwargs)

    def _init_properties(self) -> None:
        """
        Lock down initial not configured REST API columns. We want to just expose
        model ids, if something is misconfigured. By default FAB exposes all available
        columns on a Model
        """
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

    def _get_text_for_model(self, model: Model, column_name: str) -> str:
        if column_name in self.text_field_rel_fields:
            model_column_name = self.text_field_rel_fields.get(column_name)
            if model_column_name:
                return getattr(model, model_column_name)
        return str(model)

    def _get_extra_field_for_model(
        self, model: Model, column_name: str
    ) -> Dict[str, str]:
        ret = {}
        if column_name in self.extra_fields_rel_fields:
            model_column_names = self.extra_fields_rel_fields.get(column_name)
            if model_column_names:
                for key in model_column_names:
                    ret[key] = getattr(model, key)
        return ret

    def _get_result_from_rows(
        self, datamodel: SQLAInterface, rows: List[Model], column_name: str
    ) -> List[Dict[str, Any]]:
        return [
            {
                "value": datamodel.get_pk_value(row),
                "text": self._get_text_for_model(row, column_name),
                "extra": self._get_extra_field_for_model(row, column_name),
            }
            for row in rows
        ]

    def _add_extra_ids_to_result(
        self,
        datamodel: SQLAInterface,
        column_name: str,
        ids: List[int],
        result: List[Dict[str, Any]],
    ) -> None:
        if ids:
            # Filter out already present values on the result
            values = [row["value"] for row in result]
            ids = [id_ for id_ in ids if id_ not in values]
            pk_col = datamodel.get_pk()
            # Fetch requested values from ids
            extra_rows = db.session.query(datamodel.obj).filter(pk_col.in_(ids)).all()
            result += self._get_result_from_rows(datamodel, extra_rows, column_name)

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

    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.info",
        object_ref=False,
        log_to_statsd=False,
    )
    @handle_api_exception
    def info_headless(self, **kwargs: Any) -> Response:
        """
        Add statsd metrics to builtin FAB _info endpoint
        """
        duration, response = time_function(super().info_headless, **kwargs)
        self.send_stats_metrics(response, self.info.__name__, duration)
        return response

    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        object_ref=False,
        log_to_statsd=False,
    )
    @handle_api_exception
    def get_headless(self, pk: int, **kwargs: Any) -> Response:
        """
        Add statsd metrics to builtin FAB GET endpoint
        """
        duration, response = time_function(super().get_headless, pk, **kwargs)
        self.send_stats_metrics(response, self.get.__name__, duration)
        return response

    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_list",
        object_ref=False,
        log_to_statsd=False,
    )
    @handle_api_exception
    def get_list_headless(self, **kwargs: Any) -> Response:
        """
        Add statsd metrics to builtin FAB GET list endpoint
        """
        duration, response = time_function(super().get_list_headless, **kwargs)
        self.send_stats_metrics(response, self.get_list.__name__, duration)
        return response

    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        object_ref=False,
        log_to_statsd=False,
    )
    @handle_api_exception
    def post_headless(self) -> Response:
        """
        Add statsd metrics to builtin FAB POST endpoint
        """
        duration, response = time_function(super().post_headless)
        self.send_stats_metrics(response, self.post.__name__, duration)
        return response

    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        object_ref=False,
        log_to_statsd=False,
    )
    @handle_api_exception
    def put_headless(self, pk: int) -> Response:
        """
        Add statsd metrics to builtin FAB PUT endpoint
        """
        duration, response = time_function(super().put_headless, pk)
        self.send_stats_metrics(response, self.put.__name__, duration)
        return response

    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        object_ref=False,
        log_to_statsd=False,
    )
    @handle_api_exception
    def delete_headless(self, pk: int) -> Response:
        """
        Add statsd metrics to builtin FAB DELETE endpoint
        """
        duration, response = time_function(super().delete_headless, pk)
        self.send_stats_metrics(response, self.delete.__name__, duration)
        return response

    @expose("/related/<column_name>", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_related_schema)
    @handle_api_exception
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

        ids = args.get("include_ids")
        if page and ids:
            # pagination with forced ids is not supported
            return self.response_422()

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
        total_rows, rows = datamodel.query(
            filters, order_column, order_direction, page=page, page_size=page_size
        )

        # produce response
        result = self._get_result_from_rows(datamodel, rows, column_name)

        # If ids are specified make sure we fetch and include them on the response
        if ids:
            self._add_extra_ids_to_result(datamodel, column_name, ids, result)
            total_rows = len(result)

        return self.response(200, count=total_rows, result=result)

    @expose("/distinct/<column_name>", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_related_schema)
    @handle_api_exception
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
