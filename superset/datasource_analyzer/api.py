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

from flask import request, Response
from flask_appbuilder.api import expose, protect, safe
from marshmallow import ValidationError

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.datasource_analyzer.commands.initiate import (
    InitiateDatasourceAnalyzerCommand,
)
from superset.datasource_analyzer.exceptions import (
    DatasourceAnalyzerAccessDeniedError,
    DatasourceAnalyzerDatabaseNotFoundError,
    DatasourceAnalyzerInvalidError,
    DatasourceAnalyzerSchemaNotFoundError,
)
from superset.datasource_analyzer.schemas import (
    DatasourceAnalyzerPostSchema,
    DatasourceAnalyzerResponseSchema,
)
from superset.extensions import event_logger
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics

logger = logging.getLogger(__name__)


class DatasourceAnalyzerRestApi(BaseSupersetApi):
    """REST API for datasource analyzer operations."""

    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    allow_browser_login = True
    class_permission_name = "DatasourceAnalyzer"
    resource_name = "datasource_analyzer"
    openapi_spec_tag = "Datasource Analyzer"
    openapi_spec_component_schemas = (
        DatasourceAnalyzerPostSchema,
        DatasourceAnalyzerResponseSchema,
    )

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=True,
    )
    def post(self) -> Response:
        """Initiate a datasource analysis job.
        ---
        post:
          summary: Initiate datasource analysis
          description: >-
            Initiates a background job to analyze a database schema.
            Returns a run_id that can be used to track the job status.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/DatasourceAnalyzerPostSchema'
          responses:
            200:
              description: Analysis job initiated successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/DatasourceAnalyzerResponseSchema'
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
        try:
            schema = DatasourceAnalyzerPostSchema()
            data = schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            command = InitiateDatasourceAnalyzerCommand(
                database_id=data["database_id"],
                schema_name=data["schema_name"],
                catalog_name=data.get("catalog_name"),
            )
            result = command.run()
            return self.response(200, result=result)
        except (
            DatasourceAnalyzerDatabaseNotFoundError,
            DatasourceAnalyzerSchemaNotFoundError,
        ):
            return self.response_404()
        except DatasourceAnalyzerAccessDeniedError:
            return self.response_403()
        except DatasourceAnalyzerInvalidError as ex:
            return self.response_422(message=str(ex))
