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

import logging

from flask import abort
from flask_appbuilder import expose, has_access

from superset import is_feature_enabled
from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP
from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView

logger = logging.getLogger(__name__)


class DeletedAssetsView(BaseSupersetView):
    """Serves the SPA shell for the Recently-Deleted (Archive) view.

    The page itself is a thin shell; the per-type archive data is fetched
    through the chart/dashboard/dataset list APIs, which enforce their own
    access control, and restore is gated per object by the per-type
    ``/restore`` endpoints. Access to the shell mirrors the chart list page
    (``can_read`` on ``Chart`` via ``MODEL_VIEW_RW_METHOD_PERMISSION_MAP``).
    """

    route_base = "/deleted"
    class_permission_name = "Chart"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    @has_access
    @expose("/")
    def list(self) -> FlaskResponse:
        if not is_feature_enabled("SOFT_DELETE"):
            abort(404)
        return super().render_app_template()
