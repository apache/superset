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
import re
from typing import Callable

from flask import abort, current_app, Flask, g, render_template
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access, permission_name
from superset_core.extensions.types import Manifest
from werkzeug.exceptions import MethodNotAllowed, NotFound
from werkzeug.routing import PathConverter, RequestRedirect, Rule

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

#: Key the page requirement table lives under on the Flask app. On the app
#: rather than this module so two apps in one process -- the test suite builds
#: several -- cannot read each other's pages.
_REQUIREMENTS = "superset_extension_page_requirements"


def _requirements(app: Flask) -> dict[tuple[str, str], str | None]:
    """What each registered page requires, keyed by extension and path.

    Written when a page's rule is registered and read on the way in to it, so
    that what is enforced and what the API advertises come from one place.
    They used to come from two: the view closed over the permission its
    manifest declared at boot, while the API re-read the manifest per request
    -- and `get_extensions` really does re-read the bundle every time. An
    edited manifest therefore moved what was advertised while the rule went on
    enforcing what it was built with. The drift fails open on the side that
    matters: a page that gains a permission without a restart is hidden from
    the navigation while its route still admits anyone.
    """
    return app.extensions.setdefault(_REQUIREMENTS, {})


def _page_requirement(
    app: Flask, extension_id: str, path: str
) -> tuple[bool, str | None]:
    """Whether this page is registered, and what it requires if so.

    Two answers rather than one, because `None` is a real requirement -- a
    page may declare no permission and be open to any signed-in user -- and
    must not be what an unregistered page reads as. Collapsing them would
    make a page nobody registered the most permissive kind there is.
    """
    requirements = _requirements(app)
    key = (extension_id, path)
    if key not in requirements:
        return False, None
    return True, requirements[key]


class ExtensionsView(BaseSupersetView):
    route_base = "/extensions"
    class_permission_name = "Extensions"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    @expose("/list/")
    @has_access
    @permission_name("read")
    def list(self) -> FlaskResponse:
        return super().render_app_template()


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


def _make_page_view(extension_id: str, path: str) -> Callable[..., FlaskResponse]:
    """Build the view for one page, closing over which page it is.

    Which page is part of the route; what that page requires is looked up as
    the request comes in, from the table written when the rule was
    registered. Closing over the requirement instead would freeze it at boot
    while the API went on re-reading the manifest, which is the drift
    `_requirements` describes.
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
        somewhere they cannot act on.

        The refusal renders the shell with a 403 status rather than aborting.
        ``show_http_exception`` only serves an HTML page for 404 and 500, so
        ``abort(403)`` answered a browser with a JSON error body carrying the
        generic "unexpected error" issue code -- for a refusal that is neither
        unexpected nor a backend fault. Rendering the shell gives a cold load
        or a bookmark the same "not authorized" screen the client already
        shows when the user arrives in-app, and keeps the status honest.
        """
        # Imported here rather than at module scope: the flag is read per
        # request, so turning extensions off takes effect without waiting for
        # the rules to disappear at the next restart.
        from superset import is_feature_enabled

        if not is_feature_enabled("ENABLE_EXTENSIONS"):
            abort(404)
        if not g.user or not get_user_id():
            return redirect_to_login()

        registered, permission = _page_requirement(current_app, extension_id, path)
        if not registered:
            # No requirement recorded means no page: a rule exists for a path
            # nothing registered. Refused rather than served, because the
            # alternative reads as "requires nothing", which is the one answer
            # that must never be reached by default.
            abort(404)
        if not may_open(extension_id, permission):
            logger.warning(
                "User %s was refused the page '%s' of extension '%s', which "
                "requires '%s'",
                get_user_id(),
                path,
                extension_id,
                permission,
            )
            return _render_shell(), 403
        return _render_shell()

    return view


def _segments(path: str) -> list[str]:
    """A page path as its path segments, ignoring trailing slashes."""
    return [segment for segment in path.split("/") if segment]


def _rule_segments(rule: Rule) -> list[tuple[str, list[str]]] | None:
    """Each segment of a rule as its static text and its converter arguments.

    Read from the rule's own parse rather than by splitting its text, because
    a converter need not occupy a whole segment. ``/plugin/v<int:version>``
    splits into a segment ``v<int:version>``, which no comparison against
    ``v1`` recognises as dynamic -- and the page would then take
    ``/plugin/v1/data`` from it.

    Returns ``None`` when the rule cannot be read, so the caller falls back to
    comparing text. That over-refuses, which is the safe direction.
    """
    try:
        trace = rule._trace  # noqa: SLF001
    except AttributeError:  # pragma: no cover - guards a Werkzeug change
        return None

    segments: list[tuple[str, list[str]]] = []
    literals: list[str] = []
    arguments: list[str] = []
    started = False

    for is_dynamic, data in trace:
        if not is_dynamic and data == "|":
            continue
        if not is_dynamic and data == "/":
            if started:
                segments.append(("".join(literals), arguments))
            literals, arguments = [], []
            started = True
            continue
        if is_dynamic:
            arguments.append(data)
        else:
            literals.append(data)

    if started:
        segments.append(("".join(literals), arguments))

    # A trailing slash leaves an empty final segment; it denotes no position.
    return [segment for segment in segments if segment[0] or segment[1]]


def _converter_can_match(rule: Rule, argument: str, text: str) -> bool:
    """Whether a converter could ever match this literal segment.

    Asked of the converter's own pattern, so it holds for the custom ones
    Superset registers as well as Werkzeug's. Anything unreadable is treated
    as able to match, which keeps an unfamiliar converter on the refusing
    side.
    """
    converter = getattr(rule, "_converters", {}).get(argument)
    pattern = getattr(converter, "regex", None)
    if not pattern:
        return True
    try:
        return re.fullmatch(pattern, text) is not None
    except re.error:  # pragma: no cover - a converter with a broken pattern
        return True


def _is_path_converter(rule: Rule, argument: str) -> bool:
    converter = getattr(rule, "_converters", {}).get(argument)
    return isinstance(converter, PathConverter)


def _text_reaches_into(page_path: str, rule_path: str) -> bool:
    """The fallback when a rule's parse cannot be read: compare the text.

    Treats any segment containing ``<`` as dynamic, which is coarse in both
    directions but never accepts a page a converter could reach.
    """
    page_parts = _segments(page_path)
    rule_parts = _segments(rule_path)
    for index, page_part in enumerate(page_parts):
        if index >= len(rule_parts):
            return False
        rule_part = rule_parts[index]
        if "<" in rule_part:
            if "<path:" in rule_part:
                return True
            continue
        if rule_part != page_part:
            return False
    return True


def _rule_reaches_into(page_path: str, rule: Rule) -> bool:
    """Whether ``rule`` can serve a URL at or beneath ``page_path``.

    Compared segment by segment, because a converter matches text that does
    not resemble it. Comparing templates as strings misses the case this
    exists for: ``/api/v1/datasource/<datasource_type>/...`` does not start
    with ``/api/v1/datasource/table/``, yet it answers
    ``/api/v1/datasource/table/42``. A page at ``/api/v1/datasource/table``
    accepted by a string comparison would then take that request, answering
    the app shell with HTTP 200 where a JSON API belongs.

    A ``path`` converter spans every remaining segment, so a rule carrying one
    above the page's depth reaches the whole subtree.

    Where a segment is exactly one converter, its own pattern decides: an
    ``<int:slice_id>`` can never match ``review``, so a page at
    ``/slice/review`` does not conflict with ``/slice/<int:slice_id>/``.
    Refusing it would cost paths that can never collide and widen the set of
    pages a future core route breaks. A segment mixing text and a converter is
    treated as able to match, since proving otherwise would mean composing the
    pattern with the surrounding text for no practical gain.

    Otherwise a page owns its subtree exclusively, so any rule reaching into
    it is a conflict -- including one Werkzeug's precedence would have
    resolved in the host's favour. Reimplementing that precedence here would
    be wrong in a way nobody notices, and "this path is in use, pick another"
    is a better error than a route that works until the arithmetic shifts.
    """
    rule_parts = _rule_segments(rule)
    if rule_parts is None:
        return _text_reaches_into(page_path, rule.rule)

    for index, page_part in enumerate(_segments(page_path)):
        if index >= len(rule_parts):
            # The rule ran out of segments without a `path` converter, so it
            # serves URLs above the page rather than inside it.
            return False

        literal, arguments = rule_parts[index]

        if not arguments:
            if literal != page_part:
                return False
            continue

        if any(_is_path_converter(rule, argument) for argument in arguments):
            return True

        if literal or len(arguments) > 1:
            # Mixed segment: assume it could match.
            continue

        if not _converter_can_match(rule, arguments[0], page_part):
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
        if _rule_reaches_into(path, rule):
            return f"{rule.endpoint} (at {rule.rule}, which this page would shadow)"

    return None


def _shadows_app_root(app: Flask, path: str) -> str | None:
    """Why this path is ambiguous under the deployment's root, or None.

    A page path is router-relative: the server mounts the rule below the
    application root, and the client's router re-adds the root on navigation.
    Both ends therefore apply the root exactly once -- except to a path whose
    own first segment *is* the root, where "already rooted" and "starts with
    the root segment" become indistinguishable.

    `ensureAppRoot` resolves that ambiguity the only way it can, by leaving
    such a path alone, so the menu entry points at the path without the root
    while the rule really serves it below the root. The entry then misses the
    page registry, degrades from an SPA link to a plain one, and answers 404.

    The frontend cannot tell the two apart, so the path is refused here
    instead. Deployment-dependent, like the route check below it: a manifest
    that is fine at the domain root is refused under a subdirectory, which is
    the same trade `register_extension_pages` already makes.
    """
    root = (app.config.get("APPLICATION_ROOT") or "/").rstrip("/")
    if not root:
        return None
    if path == root or path.startswith(f"{root}/"):
        return (
            f"its first segment is the application root '{root}', which makes "
            f"the page's real URL '{root}{path}'"
        )
    return None


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


def register_extension_pages(app: Flask, manifest: Manifest) -> None:
    """Register one URL rule per page an extension declares.

    Called once per extension during initialisation, after operator
    blueprints, the FAB auth views and every core view are already in the URL
    map -- so the check below reads the routes this deployment actually
    serves rather than a list of the ones that existed when the extension was
    written.

    It sees what is in the map at that moment, which is not quite everything:
    a blueprint registered later, by an extension loaded after this one or by
    code running after initialisation, is not there to be found. Extensions
    are checked in load order, so the first to claim a path keeps it.

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
    # Recorded, never cleared. A Flask rule cannot be unregistered, so a page
    # that was registered keeps being served for the life of the process, and
    # its requirement has to last exactly as long: dropping it would leave a
    # live route with nothing recorded against it, which the view refuses. A
    # page re-registered with a different permission overwrites its own entry,
    # so the last registration wins, as it does for the rule.
    requirements = _requirements(app)
    if manifest.contributions.pages and manifest.frontend is None:
        # A page is half a contribution: the manifest declares the path and
        # the bundle supplies the component. Without a frontend there is no
        # remote entry, so nothing can ever register one, and registering the
        # rules anyway would advertise pages in the nav that answer the shell
        # and then resolve to nothing. Refused as a set, because the cause is
        # the manifest rather than any one path.
        logger.error(
            "Extension '%s' declares %d page(s) but has no frontend, so no "
            "component can be registered for them. None has been registered. "
            "Remove the pages, or build the extension with a frontend.",
            manifest.id,
            len(manifest.contributions.pages),
        )
        return

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

        if problem := _shadows_app_root(app, page.path):
            logger.error(
                "Extension '%s' declares a page at '%s' that cannot be "
                "addressed: %s. The page has not been registered and will "
                "not load. Give it a different path in its manifest.",
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
        requirements[(manifest.id, page.path)] = page.permission
        view = _make_page_view(manifest.id, page.path)
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
    "can_review on extension:preset.asset-approval". Pages of the same
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

    # Only pages that actually got a rule. A refused page is not reachable,
    # so creating its permission would leave a row -- and an Admin grant --
    # for a page that does not exist, which an administrator then has to
    # reason about in the Roles screen.
    registered = set(registered_page_paths(app, manifest.id))
    required = {
        page.permission
        for page in manifest.contributions.pages
        if page.permission is not None and page.path in registered
    }
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


def permitted_page_paths(app: Flask, manifest: Manifest) -> set[str]:
    """Paths of this extension's pages the current user may open.

    Used to decide what the frontend is told about. The server refuses an
    unpermitted page on its own, so this is not the enforcement -- it is what
    keeps a navigation entry from advertising a page that would answer 403.
    """
    has_rule = set(registered_page_paths(app, manifest.id))
    permitted = set()
    for page in manifest.contributions.pages:
        if page.path not in has_rule:
            continue
        # The requirement comes from the table the rule was registered with,
        # not from `page.permission` beside it: this manifest was read on this
        # request and may say something the live route does not enforce.
        recorded, permission = _page_requirement(app, manifest.id, page.path)
        if recorded and may_open(manifest.id, permission):
            permitted.add(page.path)
    return permitted
