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
from flask import g
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access, permission_name

from superset import event_logger
from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP
from superset.superset_typing import FlaskResponse
from superset.utils.core import get_user_id
from superset.views.base import BaseSupersetView, common_bootstrap_payload
from superset.views.utils import bootstrap_user_data, redirect_to_login


class ExtensionsView(BaseSupersetView):
    route_base = "/extensions"
    class_permission_name = "Extensions"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    @expose("/list/")
    @has_access
    @permission_name("read")
    def list(self) -> FlaskResponse:
        return super().render_app_template()

    @event_logger.log_this
    @expose("/pages/<page_id>")
    @expose("/pages/<page_id>/")
    @expose("/pages/<page_id>/<path:sub_path>")
    def pages(self, page_id: str, sub_path: str | None = None) -> FlaskResponse:
        """
        Shell for an extension-owned page (a view registered at ``global.page``),
        resolved client-side by ``src/pages/ExtensionPage``.

        Exists only so a direct hit on the URL (a bookmark, a refresh, a link
        opened in a new tab) renders the SPA instead of 404ing. Neither
        ``page_id`` nor ``sub_path`` is interpreted here: the server can't
        know which page ids an extension registers at runtime, so an unknown
        id still gets the shell and the client shows "not found". It returns
        no data, so it isn't a security boundary; the extension's own
        ``@protect()``ed endpoints are.

        Login-gated like ``welcome`` rather than ``@has_access``: the
        ``Extensions`` view menu is admin-only, which would hide every
        extension page from Gamma and Alpha. A page that should be restricted
        declares a permission on ``registerView``, checked client-side.
        """
        if not g.user or not get_user_id():
            return redirect_to_login()

        payload = {
            "user": bootstrap_user_data(g.user, include_perms=True),
            "common": common_bootstrap_payload(),
        }
        return self.render_app_template(extra_bootstrap_data=payload)
