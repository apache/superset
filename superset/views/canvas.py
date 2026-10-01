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
from flask import abort
from flask_appbuilder import expose, has_access
from flask_appbuilder.security.decorators import permission_name

from superset.extensions import feature_flag_manager
from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView


class CanvasView(BaseSupersetView):
    """Serves the SPA for the canvas list and canvas pages."""

    route_base = "/canvas"
    class_permission_name = "Canvas"
    default_view = "list"

    @expose("/list/")
    @has_access
    @permission_name("read")
    def list(self) -> FlaskResponse:
        if not feature_flag_manager.is_feature_enabled("CANVAS"):
            return abort(404)
        return super().render_app_template()

    @expose("/<id_or_slug>/")
    @has_access
    @permission_name("read")
    def show(self, id_or_slug: str) -> FlaskResponse:  # pylint: disable=unused-argument
        if not feature_flag_manager.is_feature_enabled("CANVAS"):
            return abort(404)
        return super().render_app_template()
