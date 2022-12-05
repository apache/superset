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
from typing import Any

from flask import Response
from flask_appbuilder.api import expose, permission_name, protect, rison, safe
from flask_appbuilder.api.schemas import get_list_schema
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.connectors.sqla.models import TableColumn
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.datasets.columns.commands.delete import DeleteDatasetColumnCommand
from superset.datasets.columns.commands.exceptions import (
    DatasetColumnDeleteFailedError,
    DatasetColumnForbiddenError,
    DatasetColumnNotFoundError,
)
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class DatasetColumnsRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(TableColumn)

    allow_browser_login = True
    class_permission_name = "Dataset"
    include_route_methods = {RouteMethod.DELETE, RouteMethod.GET_LIST}
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    list_columns = [  # See DatasetRestApi.show_select_columns.
        "advanced_data_type",
        "changed_on",
        "column_name",
        "created_on",
        "description",
        "expression",
        "filterable",
        "groupby",
        "id",
        "is_active",
        "extra",
        "is_dttm",
        "python_date_format",
        "type",
        "uuid",
        "verbose_name",
    ]
    search_columns = ["table_id"]
    max_page_size = -1
    openapi_spec_tag = "Datasets"
    resource_name = "dataset"

    @expose("/<int:pk>/column", methods=["GET"])
    @protect()
    @safe
    @permission_name("get")
    @rison(get_list_schema)
    def get_list(  # pylint: disable=arguments-differ
        self,
        pk: int,
        **kwargs: Any,
    ) -> Response:
        """Get a list of dataset columns
        ---
        get:
          description: >-
            Get a list of dataset columns
          parameters:
          - in: path
            schema:
              type: integer
            description: The dataset id for these columns
            name: pk
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_list_schema'
          responses:
            200:
              description: Columns from dataset
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      ids:
                        description: >-
                          A list of column ids
                        type: array
                        items:
                          type: string
                      count:
                        description: >-
                          The total record count on the backend
                        type: number
                      result:
                        description: >-
                          The result from the get list query
                        type: array
                        items:
                          $ref: '#/components/schemas/{{self.__class__.__name__}}.get_list'  # pylint: disable=line-too-long
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """

        rison_data = kwargs.setdefault("rison", {})
        rison_data.setdefault("filters", [])
        rison_data["filters"].append({"col": "table_id", "opr": "eq", "value": pk})
        rison_data["page_size"] = -1
        return self.get_list_headless(**kwargs)

    @expose("/<int:pk>/column/<int:column_id>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @permission_name("delete")
    def delete(  # pylint: disable=arguments-differ
        self, pk: int, column_id: int
    ) -> Response:
        """Deletes a Dataset column
        ---
        delete:
          description: >-
            Delete a Dataset column
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The dataset pk for this column
          - in: path
            schema:
              type: integer
            name: column_id
            description: The column id for this dataset
          responses:
            200:
              description: Column deleted
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
            DeleteDatasetColumnCommand(pk, column_id).run()
            return self.response(200, message="OK")
        except DatasetColumnNotFoundError:
            return self.response_404()
        except DatasetColumnForbiddenError:
            return self.response_403()
        except DatasetColumnDeleteFailedError as ex:
            logger.error(
                "Error deleting dataset column %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
