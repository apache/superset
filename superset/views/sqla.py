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
"""Views used by the SqlAlchemy connector"""

from flask_appbuilder import expose
from flask_appbuilder.security.decorators import (
    has_access,
    permission_name,
)

from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP
from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView


class RowLevelSecurityView(BaseSupersetView):
    route_base = "/rowlevelsecurity"
    class_permission_name = "RowLevelSecurity"

    @expose("/list/")
    @has_access
    @permission_name("read")
    def list(self) -> FlaskResponse:
        return super().render_app_template()


class TableModelView(BaseSupersetView):
    class_permission_name = "Dataset"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    @expose("/list/")
    @has_access
    def list(self) -> FlaskResponse:
        return super().render_app_template()
