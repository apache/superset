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
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access, permission_name
from superset_core.extensions.types import ManifestPage

from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP
from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView


class ExtensionsView(BaseSupersetView):
    route_base = "/extensions"
    class_permission_name = "Extensions"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    @expose("/list/")
    @has_access
    @permission_name("read")
    def list(self) -> FlaskResponse:
        return super().render_app_template()


def build_page_view(page: ManifestPage) -> type[BaseSupersetView]:
    """Build the view that serves the application shell for a contributed page.

    An extension's page is a client-side route, which only exists once the
    application is running. A cold load, a refresh, a bookmark, or any link
    from outside the app goes to Flask directly, so without a route here the
    page 404s -- the frontend half of the contribution works only for
    navigation that starts inside the app.

    Two routes are registered because the frontend matches a page's path as a
    prefix: ``/my-ext/queue/`` also serves ``/my-ext/queue/42/``, and the shell
    has to be served for both or a deep link breaks while the in-app
    navigation to the same URL works.

    Access is checked with ``@has_access`` against a permission the page
    declares, the same way every other page in Superset is guarded. The page
    names a permission it already owns -- the resource its own API registers --
    rather than the host inventing one per page, because a freshly invented
    permission is held by nobody until a role sync has run, and the page would
    403 for everyone including Admin.

    ``flask_login.login_required`` looks like the simpler option and is not
    one: Superset never sets ``login_manager.login_view``, so an
    unauthenticated request raises a BuildError and the page answers 500
    instead of redirecting to the login screen. That is why nothing in
    ``superset/views`` uses it.
    """
    prefix = page.path.rstrip("/")

    def index(self: BaseSupersetView) -> FlaskResponse:
        return self.render_app_template()

    def deep_link(self: BaseSupersetView, subpath: str) -> FlaskResponse:
        # `subpath` is not read: the page's own React code parses the URL. It
        # exists so the route matches at all.
        return self.render_app_template()

    return type(
        f"ExtensionPageView_{page.id.replace('.', '_').replace('-', '_')}",
        (BaseSupersetView,),
        {
            "route_base": prefix,
            "class_permission_name": page.permission.resource,
            "method_permission_name": {
                "index": page.permission.action,
                "deep_link": page.permission.action,
            },
            "index": has_access(expose("/")(index)),
            "deep_link": has_access(expose("/<path:subpath>")(deep_link)),
            # FAB links a menu entry to `default_view` and assumes it is
            # "list" when unset, which silently breaks every page that renders
            # the menu. These views carry no menu entry, but the attribute is
            # set anyway so adding one later cannot reintroduce that.
            "default_view": "index",
        },
    )
