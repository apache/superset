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

# Throwaway: sc-107283 activity-view debug UI. This Flask view exists
# only to serve the React shell on a fresh page-load of
# /activity-debug/<resource>/<uuid>. Without it, Flask returns its
# API-style 404 because the SPA doesn't have a true catch-all — each
# React route needs a corresponding render_app_template call. Delete
# this file + the AppBuilder registration in
# ``superset.initialization`` when the activity-view feature ships
# (or when you no longer need the debug UI).

from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access

from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView


class ActivityDebugView(BaseSupersetView):
    """Serves the React shell for the throwaway activity-view debug page.
    The React router (see ``superset-frontend/src/views/routes.tsx``)
    handles the actual rendering."""

    route_base = "/activity-debug"
    class_permission_name = "Database"

    @expose("/<resource>/<uuid>/")
    @expose("/<resource>/<uuid>")
    @has_access
    def show(self, resource: str, uuid: str) -> FlaskResponse:  # noqa: ARG002
        return super().render_app_template()
