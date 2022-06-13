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
from flask_appbuilder import permission_name
from flask_appbuilder.api import expose
from flask_appbuilder.security.decorators import has_access

from superset import is_feature_enabled
from superset.superset_typing import FlaskResponse

from .base import BaseSupersetView

# TODO: access control rules for this module


class BaseAlertReportView(BaseSupersetView):
    route_base = "/report"
    class_permission_name = "ReportSchedule"

    @expose("/list/")
    @has_access
    @permission_name("read")
    def list(self) -> FlaskResponse:
        if not is_feature_enabled("ALERT_REPORTS"):
            return abort(404)
        return super().render_app_template()

    @expose("/<pk>/log/", methods=["GET"])
    @has_access
    @permission_name("read")
    def log(self, pk: int) -> FlaskResponse:  # pylint: disable=unused-argument
        if not is_feature_enabled("ALERT_REPORTS"):
            return abort(404)

        return super().render_app_template()


class AlertView(BaseAlertReportView):
    route_base = "/alert"
    class_permission_name = "ReportSchedule"


class ReportView(BaseAlertReportView):
    route_base = "/report"
    class_permission_name = "ReportSchedule"
