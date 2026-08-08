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

from flask import abort, g
from flask_appbuilder import expose

from superset import is_feature_enabled, security_manager
from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView
from superset.views.utils import redirect_to_login

logger = logging.getLogger(__name__)

#: The FAB resources whose read permission admits a viewer to the shell.
#: Must stay in step with ARCHIVED_TYPES on the client, which offers each
#: viewer only the types they can read.
_ADMITTING_RESOURCES = ("Chart", "Dashboard", "Dataset")


class ArchivedAssetsView(BaseSupersetView):
    """Serves the SPA shell for the Archive (Recently-Archived) view.

    The page itself is a thin shell; the per-type archive data is fetched
    through the chart/dashboard/dataset list APIs, which enforce their own
    access control, and restore and purge are gated per object by the
    per-type endpoints.

    Admission mirrors what the shell fronts: any viewer holding ``can_read``
    on **any** of the three archived types may open the page (the client then
    offers only the types they can read). ``@has_access`` cannot express
    "any of three resources" -- it binds one ``class_permission_name`` -- so
    the gate is explicit: unauthenticated requests get the same redirect to
    login that ``@has_access`` would issue, and an authenticated viewer with
    none of the three read permissions gets 403.
    """

    route_base = "/archived"

    @expose("/")
    def list(self) -> FlaskResponse:
        if not is_feature_enabled("SOFT_DELETE"):
            abort(404)
        if not g.user or g.user.is_anonymous:
            return redirect_to_login()
        if not any(
            security_manager.can_access("can_read", resource)
            for resource in _ADMITTING_RESOURCES
        ):
            abort(403)
        return super().render_app_template()
