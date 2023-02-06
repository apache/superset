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

from flask import g, request, Response
from flask_appbuilder.api import expose, protect, safe

from superset.charts.commands.exceptions import ChartNotFoundError
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.explore.commands.get import GetExploreCommand
from superset.explore.commands.parameters import CommandParameters
from superset.explore.exceptions import DatasetAccessDeniedError, WrongEndpointError
from superset.explore.permalink.exceptions import ExplorePermalinkGetFailedError
from superset.explore.schemas import ExploreContextSchema
from superset.extensions import event_logger
from superset.temporary_cache.commands.exceptions import (
    TemporaryCacheAccessDeniedError,
    TemporaryCacheResourceNotFoundError,
)
from superset.views.base_api import BaseSupersetApi, statsd_metrics

logger = logging.getLogger(__name__)


class ExploreRestApi(BaseSupersetApi):
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    allow_browser_login = True
    class_permission_name = "Explore"
    resource_name = "explore"
    openapi_spec_tag = "Explore"
    openapi_spec_component_schemas = (ExploreContextSchema,)

    @expose("/", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=True,
    )
    def get(self) -> Response:
        """Assembles Explore related information (form_data, slice, dataset)
         in a single endpoint.
        ---
        get:
          summary: >-
            Assembles Explore related information (form_data, slice, dataset)
             in a single endpoint.
          description: >-
            Assembles Explore related information (form_data, slice, dataset)
             in a single endpoint.<br/><br/>
            The information can be assembled from:<br/>
            - The cache using a form_data_key<br/>
            - The metadata database using a permalink_key<br/>
            - Build from scratch using dataset or slice identifiers.
          parameters:
          - in: query
            schema:
              type: string
            name: form_data_key
          - in: query
            schema:
              type: string
            name: permalink_key
          - in: query
            schema:
              type: integer
            name: slice_id
          - in: query
            schema:
              type: integer
            name: datasource_id
          - in: query
            schema:
              type: string
            name: datasource_type
          responses:
            200:
              description: Returns the initial context.
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/ExploreContextSchema'
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
        try:
            params = CommandParameters(
                actor=g.user,
                permalink_key=request.args.get("permalink_key", type=str),
                form_data_key=request.args.get("form_data_key", type=str),
                datasource_id=request.args.get("datasource_id", type=int),
                datasource_type=request.args.get("datasource_type", type=str),
                slice_id=request.args.get("slice_id", type=int),
            )
            result = GetExploreCommand(params).run()
            if not result:
                return self.response_404()
            return self.response(200, result=result)
        except ValueError as ex:
            return self.response(400, message=str(ex))
        except DatasetAccessDeniedError as ex:
            return self.response(
                403,
                message=ex.message,
                datasource_id=ex.datasource_id,
                datasource_type=ex.datasource_type,
            )
        except (ChartNotFoundError, ExplorePermalinkGetFailedError) as ex:
            return self.response(404, message=str(ex))
        except WrongEndpointError as ex:
            return self.response(302, redirect=ex.redirect)
        except TemporaryCacheAccessDeniedError as ex:
            return self.response(403, message=str(ex))
        except TemporaryCacheResourceNotFoundError as ex:
            return self.response(404, message=str(ex))
