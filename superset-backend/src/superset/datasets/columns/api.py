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

from flask import Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.commands.dataset.columns.delete import DeleteDatasetColumnCommand
from superset.commands.dataset.columns.exceptions import (
    DatasetColumnDeleteFailedError,
    DatasetColumnForbiddenError,
    DatasetColumnNotFoundError,
)
from superset.connectors.sqla.models import TableColumn
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class DatasetColumnsRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(TableColumn)

    include_route_methods = {"delete"}
    class_permission_name = "Dataset"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    resource_name = "dataset"
    allow_browser_login = True

    openapi_spec_tag = "Datasets"

    @expose("/<int:pk>/column/<int:column_id>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("delete")
    def delete(  # pylint: disable=arguments-differ
        self, pk: int, column_id: int
    ) -> Response:
        """Delete a dataset column.
        ---
        delete:
          summary: Delete a dataset column
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
