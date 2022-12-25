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

from superset.connectors.sqla.models import TableColumn
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.datamanage.metrics.commands.delete import DeleteDatamanageMetricCommand
from superset.datamanage.metrics.commands.exceptions import (
    DatamanageMetricDeleteFailedError,
    DatamanageMetricForbiddenError,
    DatamanageMetricNotFoundError,
)
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class DatamanageMetricRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(TableColumn)

    include_route_methods = {"delete"}
    class_permission_name = "Datamanage"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    resource_name = "datamanage"
    allow_browser_login = True

    openapi_spec_tag = "datamanage"

    @expose("/<int:pk>/metric/<int:metric_id>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @permission_name("delete")
    def delete(  # pylint: disable=arguments-differ
        self, pk: int, metric_id: int
    ) -> Response:
        """Deletes a Datamanage metric
        ---
        delete:
          description: >-
            Delete a Datamanage metric
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The datamanage pk for this column
          - in: path
            schema:
              type: integer
            name: metric_id
            description: The metric id for this datamanage
          responses:
            200:
              description: Metric deleted
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
            DeleteDatamanageMetricCommand(pk, metric_id).run()
            return self.response(200, message="OK")
        except DatamanageMetricNotFoundError:
            return self.response_404()
        except DatamanageMetricForbiddenError:
            return self.response_403()
        except DatamanageMetricDeleteFailedError as ex:
            logger.error(
                "Error deleting datamanage column %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
