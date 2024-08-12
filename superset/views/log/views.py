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
from flask import current_app as app
from flask_appbuilder.hooks import before_request
from flask_appbuilder.models.sqla.interface import SQLAInterface
from werkzeug.exceptions import NotFound

import superset.models.core as models
from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.views.base import SupersetModelView

from . import LogMixin


class LogModelView(  # pylint: disable=too-many-ancestors
    LogMixin,
    SupersetModelView,
):
    datamodel = SQLAInterface(models.Log)
    include_route_methods = {RouteMethod.LIST, RouteMethod.SHOW}
    class_permission_name = "Log"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    @staticmethod
    def is_enabled() -> bool:
        return app.config["FAB_ADD_SECURITY_VIEWS"] and app.config["SUPERSET_LOG_VIEW"]

    @before_request
    def ensure_enabled(self) -> None:
        if not self.is_enabled():
            raise NotFound()
