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
import contextlib

import simplejson as json
from flask import request
from flask_appbuilder.api import expose

from superset import event_logger
from superset.superset_typing import FlaskResponse

from .base import BaseSupersetView


class ExportView(BaseSupersetView):
    route_base = "/export"

    @expose("/dashboard/<string:dashboard_id>/google-sheets/", methods=("GET",))
    @event_logger.log_this
    def google_sheets(
        self, dashboard_id: int  # pylint: disable=unused-argument
    ) -> FlaskResponse:
        payload = {}
        if form_data := request.form.get("form_data"):
            with contextlib.suppress(json.JSONDecodeError):
                payload["requested_query"] = json.loads(form_data)
        return self.render_app_template(payload)