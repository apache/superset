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
"""Views for the Datasource Connector feature"""

from flask import redirect, request
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access, permission_name

from superset import db
from superset.models.dashboard import Dashboard
from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView


class DatasourceConnectorView(BaseSupersetView):
    route_base = "/datasource-connector"
    class_permission_name = "Dashboard"

    def _is_valid_template_dashboard(self, dashboard_id: str | None) -> bool:
        """Check if the dashboard_id is valid and refers to a template dashboard."""
        if not dashboard_id:
            return False

        try:
            dashboard_id_int = int(dashboard_id)
        except (ValueError, TypeError):
            return False

        dashboard = db.session.query(Dashboard).filter_by(id=dashboard_id_int).first()
        if not dashboard:
            return False

        # Check if the dashboard is a template (is_template in json_metadata)
        metadata = dashboard.params_dict
        return metadata.get("is_template", False)

    @expose("/")
    @has_access
    @permission_name("read")
    def root(self) -> FlaskResponse:
        dashboard_id = request.args.get("dashboard_id")

        if not self._is_valid_template_dashboard(dashboard_id):
            return redirect("/dashboard/templates/")

        return super().render_app_template()

    @expose("/loading/<run_id>")
    @has_access
    @permission_name("read")
    def loading(self, run_id: str) -> FlaskResponse:
        return super().render_app_template()
