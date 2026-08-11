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

"""REST API for Dynamic Dashboard configuration."""

from __future__ import annotations

import logging
from typing import Any

from flask import Response
from flask_appbuilder.api import BaseApi, expose

from superset import db
from superset.models.dynamic_dashboard import DynamicDashboardConfig
from superset.utils import json

logger = logging.getLogger(__name__)


class DynamicDashboardConfigApi(BaseApi):
    route_base = "/api/v1/dynamic-dashboard"
    resource_name = "dynamic_dashboard_config"

    @expose("/<int:dashboard_id>/config", methods=("GET",))
    def get_config(self, dashboard_id: int) -> Response:
        """Return the Handlebars config for a dashboard."""
        config: DynamicDashboardConfig | None = (
            db.session.query(DynamicDashboardConfig)
            .filter_by(dashboard_id=dashboard_id)
            .first()
        )
        if not config:
            return self.response(
                404,
                error=f"No dynamic dashboard config for dashboard {dashboard_id}",
            )

        slots: list[dict[str, Any]] = json.loads(config.slots) if config.slots else []
        drill_down: dict[str, Any] | None = (
            json.loads(config.drill_down_config) if config.drill_down_config else None
        )

        return self.response(
            200,
            dashboard_id=dashboard_id,
            dashboard_template=config.template,
            slots=slots,
            drill_down_config=drill_down,
            version=config.version,
        )
