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
from typing import Callable

from flask import abort, Flask, g, render_template
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access, permission_name
from superset_core.extensions.types import Manifest, Page
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


def _render_shell() -> FlaskResponse:
    """The application shell, identical to the one ``/welcome/`` serves."""
    return render_template("superset/spa.html", **get_spa_template_context())


def may_open(extension_id: str, permission: str | None) -> bool:
    """Whether the current user may open a page with this permission.

    A page without a declared permission is open to any signed-in user, which
    is what every contributed page was before permissions existed. Keeping
    that the default means adding this field cannot lock anyone out of a page
    that already worked.
    """
    if permission is None:
        return True
    from superset import security_manager

    return security_manager.can_access(permission, extension_id)


def _make_page_view(extension_id: str, page: Page) -> Callable[..., FlaskResponse]:
    """Build the view for one page, closing over what that page requires.

    A view per page rather than one shared view read from the request: the
    permission a page requires is part of the route, not something to re-derive
    from the URL on the way in.
    """

    def view(**_kwargs: str) -> FlaskResponse:
        """Render the shell, or refuse.

        ``_kwargs`` absorbs the trailing path of the sub-path rule and is
        never read. It reaches the server only so the URL resolves; which
        screen it denotes is decided by the React router once the extension's
        bundle has registered its component. The path is therefore not a value
        to be trusted or validated here, because nothing here acts on it.

        A signed-in user without the permission gets 403 rather than FAB's
        ``has_access`` redirect to the login page. They are already signed in;
        sending them to log in again says nothing true and leaves them
        somewhere they cannot act on. 403 goes through Superset's own
        ``HTTPException`` handler like any other refusal.
        """
        # Imported here rather than at module scope: the flag is read per
        # request, so turning extensions off takes effect without waiting for
        # the rules to disappear at the next restart.
        from superset import is_feature_enabled

        if not is_feature_enabled("ENABLE_EXTENSIONS"):
            abort(404)
        if not g.user or not get_user_id():
            return redirect_to_login()
        if not may_open(extension_id, page.permission):
            logger.warning(
                "User %s was refused the page '%s' of extension '%s', which "
                "requires '%s'",
                get_user_id(),
                page.path,
                extension_id,
                page.permission,
            )
            abort(403)
        return _render_shell()

    return view


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
        view = _make_page_view(manifest.id, page)
        app.add_url_rule(
            page.path,
            endpoint=endpoint,
            view_func=view,
            methods=["GET"],
        )
        app.add_url_rule(
            f"{page.path}/<path:rest>",
            endpoint=f"{endpoint}/*",
            view_func=view,
            methods=["GET"],
        )
        logger.info(
            "Extension '%s' serves a page at '%s'%s",
            manifest.id,
            page.path,
            f", requiring '{page.permission}'" if page.permission else "",
        )


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


def ensure_page_permissions(manifest: Manifest) -> None:
    """Create the permissions this extension's pages require, if missing.

    Created when the extension loads rather than by ``superset init``, because
    an extension can be installed long after a deployment was initialised and
    an administrator cannot grant a permission that does not exist yet.

    The permission is attached to a view menu named after the extension, so
    the Roles screen groups an extension's permissions together and reads as
    "can_review on preset.asset-approval". Pages of the same extension may
    share a permission or declare different ones; this registers whatever set
    they name.

    Failures are logged and swallowed. Every worker runs this at boot, so two
    starting together can race between the lookup and the insert; the loser
    would otherwise take the whole worker down over a row the winner has
    already written. The permission check itself reads the database per
    request, so a worker that lost the race still enforces correctly.
    """
    from superset import security_manager

    required = {
        page.permission
        for page in manifest.contributions.pages
        if page.permission is not None
    }
    for permission in sorted(required):
        try:
            if security_manager.find_permission_view_menu(permission, manifest.id):
                continue
            security_manager.add_permission_view_menu(permission, manifest.id)
            logger.info(
                "Created permission '%s' on '%s' for extension pages",
                permission,
                manifest.id,
            )
        except Exception:  # pylint: disable=broad-except
            # Most often a concurrent worker inserting the same row.
            logger.warning(
                "Could not create permission '%s' on '%s'; an administrator "
                "may need to run `superset init` before it can be granted",
                permission,
                manifest.id,
                exc_info=True,
            )
            security_manager.session.rollback()


def permitted_page_paths(app: Flask, manifest: Manifest) -> set[str]:
    """Paths of this extension's pages the current user may open.

    Used to decide what the frontend is told about. The server refuses an
    unpermitted page on its own, so this is not the enforcement -- it is what
    keeps a navigation entry from advertising a page that would answer 403.
    """
    registered = set(registered_page_paths(app, manifest.id))
    return {
        page.path
        for page in manifest.contributions.pages
        if page.path in registered and may_open(manifest.id, page.permission)
    }
