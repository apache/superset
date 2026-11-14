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
import functools
import logging
from typing import Any, Callable, NamedTuple

from flask import current_app, Flask, redirect, render_template, request, url_for
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access, permission_name
from flask_login import current_user
from superset_core.extensions.types import Manifest
from werkzeug.exceptions import NotFound

from superset.constants import (
    EXTENSION_VIEW_MENU_PREFIX,
    MODEL_VIEW_RW_METHOD_PERMISSION_MAP,
)
from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView, get_spa_template_context

logger = logging.getLogger(__name__)

#: Prefix for the Flask endpoints these rules register under, so a page is
#: identifiable in the URL map and cannot collide with a view's endpoint name.
_ENDPOINT_PREFIX = "extension_page"

#: Key the page requirement table lives under on the Flask app. On the app
#: rather than this module so two apps in one process -- the test suite builds
#: several -- cannot read each other's pages.
_REQUIREMENTS = "superset_extension_page_requirements"


class PageRequirement(NamedTuple):
    """What a registered page requires before it may be opened.

    Two independent conditions, deliberately separate. A permission says
    *who*; a feature flag says *whether the feature is running at all*. A
    page whose flag is off must be hidden from everyone, including the
    administrator who holds every permission there is (QA-23).
    """

    permission: str | None = None
    feature_flag: str | None = None


def page_available(feature_flag: str | None) -> bool:
    """Whether a page's feature flag, if it declares one, is on."""
    if feature_flag is None:
        return True
    # Read per request, like ENABLE_EXTENSIONS above it: flipping a flag
    # takes effect without waiting for a restart.
    from superset import is_feature_enabled

    return bool(is_feature_enabled(feature_flag))


def owns_page(extension_id: str, page_id: str) -> bool:
    """Whether this extension is the one the page id names.

    A page id begins with its extension's own id -- `Page.id` says so, and
    the frontend already drops a registration that breaks the rule
    (`registerPageFor`). The server has to hold to it as well, because the
    server is what answers `/extensions/pages/<id>`: without this check, two
    extensions declaring the same id leave the route enforcing whichever
    manifest `get_extensions()` happened to return first, so an extension
    declaring `acme.tools.queue` with no permission and no flag could open a
    page that `acme.tools` gates behind one.
    """
    return page_id.startswith(f"{extension_id}.")


def _declared_requirement(
    page_id: str,
) -> tuple[str, PageRequirement] | None:
    """The extension declaring this page, and what it requires.

    Read from the manifests on the way in rather than written into a table at
    boot. There is no longer a per-page rule to hang that table off, and the
    extensions API already re-reads the bundle on every request -- so reading
    here is what keeps what is enforced and what is advertised from drifting
    apart, which two sources could not.

    ``None`` when no installed extension declares the id, which is not the
    same as a page that declares no permission: that one is open to any
    signed-in user, while this one is simply unknown to the server.

    A declaration the declaring extension does not own is skipped, so a
    second extension cannot answer for a page it only named.
    """
    from superset.extensions.utils import get_extensions

    for extension in get_extensions().values():
        manifest = extension.manifest
        for page in manifest.contributions.pages:
            if page.id == page_id and owns_page(manifest.id, page.id):
                return manifest.id, PageRequirement(
                    permission=page.permission,
                    feature_flag=page.featureFlag,
                )
    return None


def signed_in(f: Callable[..., FlaskResponse]) -> Callable[..., FlaskResponse]:
    """Require a session, and nothing more.

    ``@has_access`` is the usual decorator and the wrong one for a contributed
    page: on ``ExtensionsView`` it asks for ``can_read on Extensions``, which
    ``superset init`` grants to Admin alone. ``flask_login``'s
    ``login_required`` is the other obvious choice and cannot redirect here --
    FAB sets ``login_view`` to ``"login"`` while the endpoint it registers is
    ``AuthDBView.login``, so an anonymous request raises ``BuildError`` and
    becomes a 500 instead of reaching the form. Hence FAB's own redirect,
    without FAB's permission check.
    """

    @functools.wraps(f)
    def wrapper(self: Any, *args: Any, **kwargs: Any) -> FlaskResponse:
        if current_user and current_user.is_authenticated:
            return f(self, *args, **kwargs)
        return redirect(
            url_for(
                f"{self.appbuilder.sm.auth_view.__class__.__name__}.login",
                next=request.url,
            )
        )

    return wrapper


class ExtensionsView(BaseSupersetView):
    route_base = "/extensions"
    class_permission_name = "Extensions"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    @expose("/list/")
    @has_access
    @permission_name("read")
    def list(self) -> FlaskResponse:
        return super().render_app_template()

    @expose("/pages/<page_id>")
    # Registered again with the trailing slash rather than left to Flask's
    # redirect: a rule declared without one does not match with one, and
    # ``expose`` has no ``strict_slashes`` to pass through the way
    # ``add_url_rule`` did. Most Superset screens are linked with a trailing
    # slash -- the bell's "View all approvals" among them -- so the slashed
    # form has to be a rule in its own right or it hard-404s for everyone,
    # admin included.
    @expose("/pages/<page_id>/")
    # And again for anything the page routes to below its own address.
    # ``pages.useNavigate`` is part of the contract this view serves --
    # ``superset-core``'s ``pages`` module hands an extension
    # ``useSubPath()`` and ``useNavigate(subPath)`` and documents pushing
    # ``/42`` -- so the client puts sub-paths in the address bar whether or
    # not the server has a rule for them. Without this one it does not: the
    # page works until it is reloaded, bookmarked or shared, and then 404s.
    # ``sub_path`` is accepted and ignored, because the shell is the same
    # shell and the client router reads the rest off ``window.location``.
    @expose("/pages/<page_id>/<path:sub_path>")
    # Signed in, and nothing more. Deliberately not ``@has_access``, which on
    # this view asks for ``can_read on Extensions`` -- a permission ``superset
    # init`` grants to Admin alone, so every contributed page was admin-only
    # on any cold load (reload, bookmark, link) while opening fine by menu
    # click, which routes client-side and never asks the server. That is the
    # wrong question twice over: the shell carries no data, and the page's own
    # declared permission below is what decides who may open it -- a feature
    # whose point is non-admin editors cannot hang off an admin permission.
    @signed_in
    def page(self, page_id: str, sub_path: str | None = None) -> FlaskResponse:
        """The application shell for a contributed page.

        One route for every page there will ever be, because the address is
        the host's to form. It carries no data -- the extension's own REST
        endpoints are the security boundary and go through ``@protect()`` --
        so serving the shell for an id nothing registered is not a leak, and
        the client says "not found" once extensions have settled.

        The exception is a page whose manifest declares a permission the
        user does not hold, which is refused here rather than left for the
        page to discover one failed request at a time.
        """
        if (requirement := _declared_requirement(page_id)) is not None:
            extension_id, required = requirement
            if not page_available(required.feature_flag):
                raise NotFound()
            if not may_open(extension_id, required.permission):
                # The shell, with the status, rather than ``Forbidden``.
                # ``show_http_exception`` renders HTML for 404 and 500 only,
                # so raising answers a refresh or a bookmark of a gated page
                # with the raw ``GENERIC_BACKEND_ERROR`` JSON body. The
                # client already has a "Not authorized" screen for exactly
                # this case -- the page is absent from ``permitted``, which
                # is what tells it to render that -- so serving the shell
                # puts the reader in Superset rather than in a stack trace,
                # and the 403 keeps the answer honest to caches and crawlers.
                return _render_shell(), 403
        return _render_shell()


def _render_shell() -> str:
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


def _permission_problem(permission: str | None) -> str | None:
    """Why this permission cannot be used for a page, or None.

    Two sets of names carry meaning in Superset's role predicates, and a page
    naming one gets that meaning rather than the one it asked for.

    ``OBJECT_SPEC_PERMISSIONS`` is how ``_is_admin_pvm`` decides what Admin
    holds, by excluding exactly those. A page naming one would have its Admin
    grant stripped the next time ``superset init`` ran, leaving a page nobody
    could open and nothing in the logs to say why.

    ``ACCESSIBLE_PERMS`` is worse, because it defeats the restriction
    entirely. Both ``_is_alpha_pvm`` and ``_is_gamma_pvm`` end in
    ``... or self._is_accessible_to_all(pvm)``, evaluated *after* the
    ``_is_admin_only`` test that keeps extension permissions off those roles.
    A page declaring ``can_userinfo`` therefore lands on stock Gamma however
    the view menu is named -- the same defect the view-menu prefix was added
    to fix, reached through the other override set.

    Unlike a route, both sets are small, fixed and owned by Superset's own
    security model, so refusing names from them is a rule that stays true.
    """
    if permission is None:
        return None

    from superset.security.manager import SupersetSecurityManager

    if permission in SupersetSecurityManager.OBJECT_SPEC_PERMISSIONS:
        return (
            f"'{permission}' is reserved by Superset for object-level access "
            f"and cannot be used for a page"
        )
    if permission in SupersetSecurityManager.ACCESSIBLE_PERMS:
        return (
            f"'{permission}' is reserved by Superset as a permission every "
            f"role holds, so a page declaring it would be open to everyone"
        )
    return None


def _grant_to_admin(permission: str, extension_id: str, pvm: object) -> None:
    """Give the Admin role a page permission, if it does not already hold it.

    Not a policy this invents. ``sync_role_definitions`` builds the Admin
    role from every permission that is not one of the four object-level ones,
    so ``superset init`` would hand Admin this permission anyway. Doing it
    here means an administrator who installs an extension can open its pages
    without first running init and without granting themselves access to
    their own deployment.

    Granted only while *no role at all* holds the permission.

    Two failures pull in opposite directions here. Granting on every boot
    reinstates a grant an operator deliberately removed, so withholding it
    from Admin stops being something they can decide. Granting only on the
    boot that creates the permission leaves it ungranted forever if that boot
    had no Admin role yet, or lost the create race to another worker, or
    failed partway -- and nothing retries.

    A permission no role holds gates nothing and leaves the page unreachable
    by anyone, which is the state those failures produce and is not a state an
    operator can be aiming for. So it is repaired. An operator who moves the
    grant to a role of their own keeps it there: something holds it, and this
    does not touch it.

    The residual is narrow and deliberate: an operator who wants the page
    reachable by nobody has to remove the page, not the permission.
    """
    from superset import security_manager

    if getattr(pvm, "role", None):
        # Held by something -- Admin, or a role the operator chose instead.
        # Checked before looking up the role, so the ordinary boot, where a
        # role already holds every permission, reads nothing further.
        return

    view_menu = _view_menu(extension_id)
    role_name = current_app.config.get("AUTH_ROLE_ADMIN", "Admin")
    role = security_manager.find_role(role_name)
    if role is None:
        logger.warning(
            "No '%s' role to grant '%s' on '%s' to", role_name, permission, view_menu
        )
        return

    # Idempotent and self-committing in FAB. An ordinary boot does no write,
    # because by then a role holds it and the check above has returned.
    security_manager.add_permission_role(role, pvm)
    logger.info(
        "Granted '%s' on '%s' to the '%s' role",
        permission,
        view_menu,
        role_name,
    )


def ensure_page_permissions(app: Flask, manifest: Manifest) -> None:
    """Create the permissions this extension's pages require, and grant Admin.

    Created when the extension loads rather than by ``superset init``, because
    an extension can be installed long after a deployment was initialised and
    an administrator cannot grant a permission that does not exist yet.

    The permission is attached to a view menu named after the extension, so
    the Roles screen groups an extension's permissions together and reads as
    "can_review on extension:acme.reviews". Pages of the same
    extension may share a permission or declare different ones; this
    registers whatever set they name, and gives the Admin role each one it
    creates.

    Failures are logged and swallowed. Every worker runs this at boot, so two
    starting together can race between the lookup and the insert; the loser
    would otherwise take the whole worker down over a row the winner has
    already written. The permission check itself reads the database per
    request, so a worker that lost the race still enforces correctly.
    """
    if not current_app.config.get("EXTENSIONS_SYNC_PAGE_PERMISSIONS", True):
        # The operator provisions these out of band, or the metadata database
        # must not be written during start. Pages still load, and the checks
        # that enforce them still read whatever permissions exist.
        return

    from superset import security_manager

    # Every declared page, because every declared page has an address: the
    # host forms it, so there is no longer a refused page whose permission
    # would be a row an administrator has to reason about in the Roles
    # screen for a page that does not exist.
    # A permission Superset reserves is refused here rather than created.
    # These are the names that decide what Admin holds by being excluded from
    # it, and the ones every role holds already; a page naming either would
    # end up either ungrantable or open to everyone. Saying so at boot is the
    # last moment the author can still act on it.
    required = set()
    for page in manifest.contributions.pages:
        if not owns_page(manifest.id, page.id):
            # Said once, here, where the author sees it at load. The page is
            # ignored everywhere else too -- it is not advertised to the
            # frontend, the frontend would refuse to register it, and the
            # route does not answer for it -- so creating its permission
            # would leave a row in the Roles screen for a page that does not
            # exist.
            logger.error(
                "Extension '%s' declares a page '%s', which is not one of "
                "its own: a page id must begin with the extension's id, so "
                "that no extension can claim another's page. The page was "
                "ignored.",
                manifest.id,
                page.id,
            )
            continue
        if page.permission is None:
            continue
        if problem := _permission_problem(page.permission):
            logger.error(
                "Extension '%s' declares a page requiring '%s', which %s. "
                "The permission was not created, so the page is not openable; "
                "name a permission the extension's own API registers.",
                manifest.id,
                page.permission,
                problem,
            )
            continue
        required.add(page.permission)
    view_menu = _view_menu(manifest.id)
    for permission in sorted(required):
        try:
            if not security_manager.find_permission_view_menu(permission, view_menu):
                security_manager.add_permission_view_menu(permission, view_menu)
                logger.info(
                    "Created permission '%s' on '%s' for extension pages",
                    permission,
                    view_menu,
                )

            # Runs whether or not this boot created the permission, so a grant
            # that never happened -- no Admin role yet, a lost create race, a
            # failure partway -- is repaired rather than missing forever.
            # `_grant_to_admin` declines once any role holds it.
            # Re-read rather than reusing the lookup above, which may have
            # been None before the create. Passed in so the grant does not
            # repeat it.
            pvm = security_manager.find_permission_view_menu(permission, view_menu)
            if pvm is not None:
                _grant_to_admin(permission, manifest.id, pvm)
        except Exception:  # pylint: disable=broad-except
            # Most often a concurrent worker inserting the same row.
            logger.warning(
                "Could not create permission '%s' on '%s'; an administrator "
                "may need to run `superset init` before it can be granted",
                permission,
                view_menu,
                exc_info=True,
            )
            # Rolled back here rather than through `@transaction`, which
            # would wrap the whole loop: one permission that cannot be
            # written must not discard the ones already created.
            security_manager.session.rollback()  # pylint: disable=consider-using-transaction


def permitted_page_ids(manifest: Manifest) -> set[str]:
    """Ids of this extension's pages the current user may open.

    Used to decide what the frontend is told about. The server refuses an
    unpermitted page on its own, so this is not the enforcement -- it is what
    keeps a navigation entry from advertising a page that would answer 403.
    """
    return {
        page.id
        for page in manifest.contributions.pages
        if owns_page(manifest.id, page.id)
        and page_available(page.featureFlag)
        and may_open(manifest.id, page.permission)
    }
