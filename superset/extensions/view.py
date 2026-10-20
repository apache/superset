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

from flask import abort, current_app, Flask, g, render_template
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access, permission_name
from superset_core.extensions.types import Manifest, Page
from werkzeug.exceptions import MethodNotAllowed, NotFound
from werkzeug.routing import RequestRedirect

from superset.constants import (
    EXTENSION_VIEW_MENU_PREFIX,
    MODEL_VIEW_RW_METHOD_PERMISSION_MAP,
)
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


def _view_menu(extension_id: str) -> str:
    """The FAB view menu an extension's page permissions hang from.

    Prefixed so the security manager can tell these apart from a core view's
    permissions without keeping a registry of installed extensions. See
    ``SupersetSecurityManager._is_admin_only``.
    """
    return f"{EXTENSION_VIEW_MENU_PREFIX}{extension_id}"


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

    return security_manager.can_access(permission, _view_menu(extension_id))


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


def _segments(path: str) -> list[str]:
    """A rule or page path as its path segments, ignoring trailing slashes."""
    return [segment for segment in path.split("/") if segment]


def _rule_reaches_into(page_path: str, rule_path: str) -> bool:
    """Whether ``rule_path`` can serve a URL at or beneath ``page_path``.

    Compared segment by segment, because a converter matches text that does
    not resemble it. Comparing the templates as strings misses the case this
    exists for: ``/api/v1/datasource/<datasource_type>/...`` does not start
    with ``/api/v1/datasource/table/``, yet it answers
    ``/api/v1/datasource/table/42``. A page at ``/api/v1/datasource/table``
    would be accepted by a string comparison and would then take that request,
    answering the app shell with HTTP 200 where a JSON API belongs.

    A ``path`` converter spans every remaining segment, so a rule carrying one
    above the page's depth reaches the whole subtree.

    A page owns its path and everything beneath it exclusively, so any rule
    reaching into that subtree is a conflict -- even one Werkzeug's precedence
    would have resolved in the host's favour. The alternative is to reimplement
    that precedence here and be wrong about it in a way nobody notices;
    "this path is already in use, pick another" is a better error than a route
    that works until the arithmetic shifts.
    """
    page_parts = _segments(page_path)
    rule_parts = _segments(rule_path)

    for index, page_part in enumerate(page_parts):
        if index >= len(rule_parts):
            # The rule ran out of segments without a `path` converter, so it
            # serves URLs above the page rather than inside it.
            return False
        rule_part = rule_parts[index]
        if rule_part.startswith("<"):
            if rule_part.startswith("<path:"):
                return True
            continue
        if rule_part != page_part:
            return False
    return True


def _first_claimant(app: Flask, path: str) -> str | None:
    """The endpoint already answering ``path`` or anything beneath it.

    Two checks, because they catch different things and neither subsumes the
    other.

    Matching ``path`` against the live URL map catches a rule that answers it
    without resembling it, and catches what matching alone can report: a
    redirect counts as taken -- ``strict_slashes`` raises ``RequestRedirect``
    for a rule that exists under a different trailing slash -- and so does a
    method mismatch, since a rule answering only POST still owns the path.

    Then every rule is compared segment-wise, which is what finds a rule that
    reaches *into* the page's subtree. Matching cannot find those: there is no
    single URL to probe that an arbitrary descendant is guaranteed to answer.
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

    for rule in app.url_map.iter_rules():
        if _rule_reaches_into(path, rule.rule):
            return f"{rule.endpoint} (at {rule.rule}, which this page would shadow)"

    return None


def _permission_problem(permission: str | None) -> str | None:
    """Why this permission cannot be used for a page, or None.

    Superset reserves four permission names for object-level access, and
    decides what the Admin role holds by excluding exactly those. A page
    naming one would have its Admin grant stripped the next time
    ``superset init`` ran, leaving a page nobody could open and nothing in
    the logs to say why.

    Unlike a route, this set is small, fixed and owned by Superset's own
    security model, so refusing names from it is a rule that stays true.
    """
    if permission is None:
        return None

    from superset.security.manager import SupersetSecurityManager

    if permission in SupersetSecurityManager.OBJECT_SPEC_PERMISSIONS:
        return (
            f"'{permission}' is reserved by Superset for object-level access "
            f"and cannot be used for a page"
        )
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
        if problem := _permission_problem(page.permission):
            logger.error(
                "Extension '%s' declares a page at '%s' requiring a "
                "permission that cannot be used: %s. The page has not been "
                "registered and will not load.",
                manifest.id,
                page.path,
                problem,
            )
            continue

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
            # Most Superset screens are reached with a trailing slash, so a
            # page declared without one would hard-404 on `/review-queue/`
            # rather than redirect.
            strict_slashes=False,
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
    # The trailing slash is load-bearing. Extension ids may contain hyphens,
    # so without a separator `acme.review` is a prefix of `acme.review-plus`
    # and would read back that extension's pages as its own -- undoing a
    # refusal, and letting one extension's component be accepted for another
    # extension's path.
    prefix = f"{_ENDPOINT_PREFIX}.{extension_id}/"
    return [
        rule.rule
        for rule in app.url_map.iter_rules()
        if rule.endpoint.startswith(prefix) and not rule.endpoint.endswith("/*")
    ]


def _grant_to_admin(permission: str, extension_id: str) -> None:
    """Give the Admin role a page permission, if it does not already hold it.

    Not a policy this invents. ``sync_role_definitions`` builds the Admin
    role from every permission that is not one of the four object-level ones,
    so ``superset init`` would hand Admin this permission anyway. Doing it
    here means an administrator who installs an extension can open its pages
    without first running init and without granting themselves access to
    their own deployment.

    Called only on the boot that creates the permission. Re-granting on every
    boot would silently reinstate a grant an operator had deliberately
    removed; withholding it from Admin has to remain something an operator
    can decide.
    """
    from superset import security_manager

    role_name = current_app.config.get("AUTH_ROLE_ADMIN", "Admin")
    role = security_manager.find_role(role_name)
    if role is None:
        logger.warning(
            "No '%s' role to grant '%s' on '%s' to", role_name, permission, extension_id
        )
        return

    pvm = security_manager.find_permission_view_menu(
        permission, _view_menu(extension_id)
    )
    if pvm is None:
        return

    if pvm not in role.permissions:
        # Idempotent and self-committing in FAB; called only when absent so
        # that an ordinary boot does no write at all.
        security_manager.add_permission_role(role, pvm)
        logger.info(
            "Granted '%s' on '%s' to the '%s' role",
            permission,
            extension_id,
            role_name,
        )


def ensure_page_permissions(manifest: Manifest) -> None:
    """Create the permissions this extension's pages require, and grant Admin.

    Created when the extension loads rather than by ``superset init``, because
    an extension can be installed long after a deployment was initialised and
    an administrator cannot grant a permission that does not exist yet.

    The permission is attached to a view menu named after the extension, so
    the Roles screen groups an extension's permissions together and reads as
    "can_review on preset.asset-approval". Pages of the same extension may
    share a permission or declare different ones; this registers whatever set
    they name, and gives the Admin role each one it creates.

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
            view_menu = _view_menu(manifest.id)
            if security_manager.find_permission_view_menu(permission, view_menu):
                continue

            security_manager.add_permission_view_menu(permission, view_menu)
            logger.info(
                "Created permission '%s' on '%s' for extension pages",
                permission,
                view_menu,
            )
            # Only here, on the boot that created it. Re-granting on every
            # boot would silently reinstate a grant an operator had
            # deliberately removed, which is not a decision this gets to
            # overrule -- an operator who wants Admin to keep it can grant it
            # back in the Roles screen, or run `superset init`.
            _grant_to_admin(permission, manifest.id)
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
