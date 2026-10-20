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
from flask import abort, g
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access, permission_name
from superset_core.extensions.constants import (
    PUBLISHER_PATTERN,
    TECHNICAL_NAME_PATTERN,
)

from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP
from superset.superset_typing import FlaskResponse
from superset.utils.core import get_user_id
from superset.views.base import BaseSupersetView
from superset.views.utils import redirect_to_login


class ExtensionsView(BaseSupersetView):
    route_base = "/extensions"
    class_permission_name = "Extensions"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    @expose("/list/")
    @has_access
    @permission_name("read")
    def list(self) -> FlaskResponse:
        return super().render_app_template()


#: An extension's composite id (``publisher.name``) as one path segment, built
#: from the same patterns the manifest validates against, minus their anchors.
#: A dot cannot appear in either half, which is what keeps this rule from ever
#: matching the ``/extensions/<publisher>/<name>/...`` routes that
#: extension-contributed REST APIs register -- there the publisher is a literal
#: segment of its own.
EXTENSION_ID_REGEX = (
    f"{PUBLISHER_PATTERN.strip('^$')}\\.{TECHNICAL_NAME_PATTERN.strip('^$')}"
)


class ExtensionPagesView(BaseSupersetView):
    """Serves the application shell for every page an extension contributes.

    One rule covers every extension and every page inside it. The alternative
    -- a Flask view per declared page -- ties the URL map to whichever
    extensions happen to be on disk, so two workers with different filesystem
    state answer differently, and it needs collision detection and path
    validation for author-supplied paths that this does not.

    ``rest`` is never read. It reaches the server only so the URL resolves; the
    page it denotes is decided by the React router once the extension's bundle
    has registered its component. The path is therefore not a value to be
    trusted or validated here, because nothing here acts on it.

    Deliberately no ``class_permission_name`` and no ``@has_access``: this is a
    separate class from ``ExtensionsView`` precisely so its ``Extensions``
    permission -- which is admin-only -- cannot reach these routes.
    """

    route_base = ""
    # FAB links a menu entry to `default_view` and assumes "list" when unset.
    # These routes carry no menu entry, but the attribute is set so adding one
    # later cannot silently break every page that renders the menu.
    default_view = "page"

    @expose(f'/extensions/<regex("{EXTENSION_ID_REGEX}"):extension_id>/')
    @expose(f'/extensions/<regex("{EXTENSION_ID_REGEX}"):extension_id>/<path:rest>')
    def page(self, extension_id: str, rest: str = "") -> FlaskResponse:
        """Render the shell, or 404 when extensions are switched off.

        Guarded by a login check rather than a permission, matching
        ``Superset.welcome``: the payload this returns is a pure function of
        the requesting user and is byte-identical to the one ``/welcome/``
        serves. It names no extension, carries no page data, and every API the
        page then calls is separately authorised. A permission here would gate
        the frame around the data, not the data.
        """
        # Imported here rather than at module scope: the flag is read per
        # request, and the route is registered unconditionally so that the URL
        # map does not vary with configuration.
        from superset import is_feature_enabled

        if not is_feature_enabled("ENABLE_EXTENSIONS"):
            abort(404)
        if not g.user or not get_user_id():
            return redirect_to_login()
        return super().render_app_template()
