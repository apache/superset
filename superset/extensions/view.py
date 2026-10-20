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

from flask import abort, Flask, g, render_template
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access, permission_name
from superset_core.extensions.types import Manifest
from werkzeug.exceptions import MethodNotAllowed, NotFound
from werkzeug.routing import RequestRedirect

from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP
from superset.superset_typing import FlaskResponse
from superset.utils.core import get_user_id
from superset.views.base import BaseSupersetView, get_spa_template_context
from superset.views.utils import redirect_to_login

logger = logging.getLogger(__name__)

#: Prefix for the Flask endpoints these rules register under, so a page is
#: identifiable in the URL map and cannot collide with a view's endpoint name.
_ENDPOINT_PREFIX = "extension_page"


class ExtensionsView(BaseSupersetView):
    route_base = "/extensions"
    class_permission_name = "Extensions"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    @expose("/list/")
    @has_access
    @permission_name("read")
    def list(self) -> FlaskResponse:
        return super().render_app_template()


def _render_page(**_kwargs: str) -> FlaskResponse:
    """Render the application shell for a contributed page.

    ``_kwargs`` absorbs the trailing path of the sub-path rule and is never
    read. It reaches the server only so the URL resolves; which page it
    denotes is decided by the React router once the extension's bundle has
    registered its component. The path is therefore not a value to be trusted
    or validated here, because nothing here acts on it.

    Guarded by a login check rather than a permission, matching
    ``Superset.welcome``: the payload is a pure function of the requesting
    user and is byte-identical to the one ``/welcome/`` serves. It names no
    extension, carries no page data, and every API the page then calls is
    separately authorised. A permission here would gate the frame around the
    data, not the data.
    """
    from superset import is_feature_enabled

    if not is_feature_enabled("ENABLE_EXTENSIONS"):
        abort(404)
    if not g.user or not get_user_id():
        return redirect_to_login()
    return render_template("superset/spa.html", **get_spa_template_context())


def _first_claimant(app: Flask, path: str) -> str | None:
    """The endpoint already answering ``path`` or anything under it.

    Two checks, because they catch different things and neither subsumes the
    other.

    Matching ``path`` against the live URL map catches a rule that answers it
    without resembling it. A literal comparison is what let an earlier
    revision of this code wave through ``/oauth-authorized/google/``: the rule
    is registered as ``/oauth-authorized/<provider>`` and never string-matches
    the request it would answer. A redirect counts as taken --
    ``strict_slashes`` raises ``RequestRedirect`` for a rule that exists under
    a different trailing slash -- and so does a method mismatch, since a rule
    answering only POST still owns the path.

    Scanning rule templates for the same prefix catches the opposite case: a
    page takes everything beneath its path through its ``<path:rest>`` rule,
    so a page at ``/report`` would shadow a core ``/report/list``. Matching
    cannot find that one -- there is no single URL to probe that a static
    descendant is guaranteed to answer -- so the templates are read directly.
    """
    adapter = app.url_map.bind("localhost")
    try:
        endpoint, _args = adapter.match(path, method="GET")
    except NotFound:
        pass
    except RequestRedirect as redirect:
        return f"a rule redirecting to {redirect.new_url}"
    except MethodNotAllowed:
        return "a rule accepting other methods"
    else:
        return endpoint

    prefix = f"{path}/"
    for rule in app.url_map.iter_rules():
        if rule.rule.startswith(prefix):
            return f"{rule.endpoint} (at {rule.rule}, which this page would shadow)"

    return None


def register_extension_pages(app: Flask, manifest: Manifest) -> None:
    """Register one URL rule per page an extension declares.

    Called once per extension during initialisation, after operator
    blueprints, the FAB auth views and every core view are already in the URL
    map -- so the check below sees the complete set of routes this deployment
    actually serves, not a list of the ones that existed when the extension
    was written.

    Re-running it on every boot is the point. A route Superset only registers
    under some configurations -- ``/oauth-authorized/<provider>`` exists only
    when ``AUTH_TYPE`` is ``AUTH_OAUTH`` -- is absent from the map in a
    deployment that has the feature switched off, so a page may legitimately
    take that path there. Turning the feature on later puts the real rule in
    the map first, and the next boot refuses the page loudly instead of
    silently leaving the extension in front of the callback.

    A refused page is skipped, not fatal: one extension claiming a taken path
    should not stop the server from starting.
    """
    for page in manifest.contributions.pages:
        if claimed := _first_claimant(app, page.path):
            logger.error(
                "Extension '%s' declares a page at '%s', which is already "
                "served by %s. The page has not been registered and will not "
                "load. Give it a different path in its manifest.",
                manifest.id,
                page.path,
                claimed,
            )
            continue

        endpoint = f"{_ENDPOINT_PREFIX}.{manifest.id}{page.path}"
        app.add_url_rule(
            page.path,
            endpoint=endpoint,
            view_func=_render_page,
            methods=["GET"],
        )
        app.add_url_rule(
            f"{page.path}/<path:rest>",
            endpoint=f"{endpoint}/*",
            view_func=_render_page,
            methods=["GET"],
        )
        logger.info("Extension '%s' serves a page at '%s'", manifest.id, page.path)


def registered_page_paths(app: Flask, extension_id: str) -> list[str]:
    """The paths this extension actually has a URL rule for.

    Read back from the URL map rather than remembered from registration, so
    there is one answer to "does this page exist" and it is the routing
    table's. A page the check above refused has no rule, and so is absent
    here -- which is what keeps the frontend from offering a menu entry, or
    accepting a component, for a page that would 404 on a cold load.
    """
    prefix = f"{_ENDPOINT_PREFIX}.{extension_id}"
    return [
        rule.rule
        for rule in app.url_map.iter_rules()
        if rule.endpoint.startswith(prefix) and not rule.endpoint.endswith("/*")
    ]
