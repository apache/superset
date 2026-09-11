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
from flask_appbuilder import permission_name
from flask_appbuilder.api import expose
from flask_appbuilder.security.decorators import has_access
from superset import event_logger
from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView


class FolderView(BaseSupersetView):
    """Serves the SPA for the folder-based Analytics page."""

    route_base = "/analytics"
    class_permission_name = "Folder"
    method_permission_name = {
        "root": "read",
        "folder": "read",
    }

    @has_access
    @permission_name("read")
    @expose("/")
    @event_logger.log_this
    def root(self) -> FlaskResponse:
        return super().render_app_template()

    @has_access
    @permission_name("read")
    @expose("/<folder_uuid>/")
    @event_logger.log_this
    def folder(self, folder_uuid: str) -> FlaskResponse:
        return super().render_app_template()
