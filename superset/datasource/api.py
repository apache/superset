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

from flask_appbuilder.api import BaseApi, expose, protect, safe

from superset import app, db, event_logger
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.dao.exceptions import DatasourceNotFound, DatasourceTypeNotSupportedError
from superset.datasource.dao import DatasourceDAO
from superset.exceptions import SupersetSecurityException
from superset.superset_typing import FlaskResponse
from superset.utils.core import apply_max_row_limit, DatasourceType

logger = logging.getLogger(__name__)


class DatasourceRestApi(BaseApi):
    include_route_methods = {"get_column_values"}
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    allow_browser_login = True
    class_permission_name = "Datasource"
    resource_name = "datasource"
    openapi_spec_tag = "Datasources"

    @expose(
        "/<datasource_type>/<int:datasource_id>/column/<column_name>/values/",
        methods=["GET"],
    )
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".get_column_values",
        log_to_statsd=False,
    )
    def get_column_values(
        self, datasource_type: str, datasource_id: int, column_name: str
    ) -> FlaskResponse:
        try:
            datasource = DatasourceDAO.get_datasource(
                db.session, DatasourceType(datasource_type), datasource_id
            )
            datasource.raise_for_access()
        except ValueError:
            return self.response(
                400, message=f"Invalid datasource type: {datasource_type}"
            )
        except DatasourceTypeNotSupportedError as ex:
            return self.response(400, message=ex.message)
        except DatasourceNotFound as ex:
            return self.response(404, message=ex.message)
        except SupersetSecurityException as ex:
            return self.response(403, message=ex.message)

        row_limit = apply_max_row_limit(app.config["FILTER_SELECT_ROW_LIMIT"])
        try:
            payload = datasource.values_for_column(
                column_name=column_name, limit=row_limit
            )
            return self.response(200, result=payload)
        except NotImplementedError:
            return self.response(
                400,
                message=(
                    "Unable to get column values for "
                    f"datasource type: {datasource_type}"
                )
            )
