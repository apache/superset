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
from flask_appbuilder.api import expose
from flask_appbuilder.baseviews import expose_api
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import (
    has_access,
    has_access_api,
    permission_name,
)

from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.models import core as models
from superset.superset_typing import FlaskResponse
from superset.views.base import DeleteMixin, deprecated, SupersetModelView


class CssTemplateModelView(  # pylint: disable=too-many-ancestors
    SupersetModelView,
    DeleteMixin,
):
    datamodel = SQLAInterface(models.CssTemplate)
    include_route_methods = RouteMethod.LIST

    class_permission_name = "CssTemplate"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    @expose("/list/")
    @has_access
    def list(self) -> FlaskResponse:
        return super().render_app_template()


class CssTemplateAsyncModelView(  # pylint: disable=too-many-ancestors
    CssTemplateModelView
):
    include_route_methods = RouteMethod.API_READ
    class_permission_name = "CssTemplate"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    list_columns = ["template_name", "css"]

    @expose_api(name="read", url="/api/read", methods=["GET"])
    @has_access_api
    @permission_name("list")
    @deprecated(eol_version="5.0.0")
    def api_read(self) -> FlaskResponse:
        return super().api_read()
