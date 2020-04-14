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
from typing import cast, Dict, Set, Tuple, Type, Union

from flask_appbuilder import ModelRestApi
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.filters import BaseFilter, Filters
from flask_appbuilder.models.sqla.filters import FilterStartsWith

logger = logging.getLogger(__name__)
get_related_schema = {
    "type": "object",
    "properties": {
        "page_size": {"type": "integer"},
        "page": {"type": "integer"},
        "filter": {"type": "string"},
    },
}


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
        self.stats_logger.incr(f"{self.__class__.__name__}.{func_name}.{action}")

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
        if column_name not in self.allowed_rel_fields:
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
