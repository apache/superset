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
from typing import Any

from flask import current_app as app
from flask.wrappers import Response
from flask_appbuilder.api import BaseApi, expose, permission_name, protect, rison, safe
from flask_babel import lazy_gettext as _

from superset.advanced_data_type.schemas import (
    advanced_data_type_convert_schema,
    advanced_data_type_datasets_schema,
    AdvancedDataTypeSchema,
)
from superset import security_manager
from superset.advanced_data_type.types import AdvancedDataTypeResponse
from superset.connectors.sqla.models import TableColumn
from superset.datasets.dao import DatasetDAO
from superset.extensions import db, event_logger

config = app.config
ADVANCED_DATA_TYPES = config["ADVANCED_DATA_TYPES"]


class AdvancedDataTypeRestApi(BaseApi):
    """
    Advanced Data Type Rest API
    -Will return available AdvancedDataTypes when the /types endpoint is accessed
    -Will return a AdvancedDataTypeResponse object when the /convert endpoint is accessed
    and is passed in valid arguments
    """

    allow_browser_login = True
    include_route_methods = {"get", "get_types", "get_datasets"}
    resource_name = "advanced_data_type"
    class_permission_name = "AdvancedDataType"

    openapi_spec_tag = "Advanced Data Type"
    apispec_parameter_schemas = {
        "advanced_data_type_convert_schema": advanced_data_type_convert_schema,
        "advanced_data_type_datasets_schema": advanced_data_type_datasets_schema,
    }
    openapi_spec_component_schemas = (AdvancedDataTypeSchema,)

    @protect()
    @safe
    @expose("/convert", methods=["GET"])
    @permission_name("read")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,  # pylint: disable-arguments-renamed
    )
    @rison(advanced_data_type_convert_schema)
    def get(self, **kwargs: Any) -> Response:
        """Returns a AdvancedDataTypeResponse object populated with the passed in args
        ---
        get:
          summary: >-
            Returns a AdvancedDataTypeResponse object populated with the passed in args.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/advanced_data_type_convert_schema'
          responses:
            200:
              description: >-
                AdvancedDataTypeResponse object has been returned.
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/AdvancedDataTypeSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        item = kwargs["rison"]
        advanced_data_type = item["type"]
        values = item["values"]
        addon = ADVANCED_DATA_TYPES.get(advanced_data_type)
        if not addon:
            return self.response(
                400,
                message=_(
                    "Invalid advanced data type: %(advanced_data_type)s",
                    advanced_data_type=advanced_data_type,
                ),
            )
        bus_resp: AdvancedDataTypeResponse = addon.translate_type(
            {
                "values": values,
            }
        )
        return self.response(200, result=bus_resp)

    @protect()
    @safe
    @expose("/types", methods=["GET"])
    @permission_name("read")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,  # pylint: disable-arguments-renamed
    )
    def get_types(self) -> Response:
        """Returns a list of available advanced data types
        ---
        get:
          description: >-
            Returns a list of available advanced data types.
          responses:
            200:
              description: >-
                a successful return of the available
                advanced data types has taken place.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          type: string
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """

        return self.response(200, result=list(ADVANCED_DATA_TYPES.keys()))

    @protect()
    @safe
    @expose("/datasets", methods=["GET"])
    @permission_name("read")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,  # pylint: disable-arguments-renamed
    )
    @rison(advanced_data_type_datasets_schema)
    def get_datasets(self, **kwargs: Any) -> Response:
        """Get all datasets with a column of the specified advanced type
        ---
        get:
          description:
            Get all datasets with a column of the specified advanced type
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/advanced_data_type_datasets_schema'
          responses:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
                        properties:
                          table_id:
                            type: array
                            items:
                              type: integer
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        item = kwargs["rison"]
        advanced_data_type = item["type"]
        columns = (
            db.session.query(TableColumn.table_id, TableColumn.id)
            .filter(TableColumn.advanced_data_type == advanced_data_type)
            .all()
        )
        forbidden_datasets = []
        result = {}
        for column in columns:
            if column[0] in forbidden_datasets:
                continue
            if column[0] not in result:
                dataset = DatasetDAO.find_by_id(column[0])
                if dataset is None or not security_manager.can_access_datasource(
                    dataset
                ):
                    forbidden_datasets.append(column[0])
                else:
                    result[column[0]] = [column[1]]
            else:
                result[column[0]].append(column[1])

        return self.response(
            200,
            result=result,
        )
