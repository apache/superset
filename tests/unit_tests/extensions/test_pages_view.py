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

"""Page-path registration and the collision check that guards it.

Exercised against a bare Flask app rather than the Superset one: the thing
under test is how a declared path interacts with the URL map, and a bare app
lets each case state exactly which routes exist before the extension loads --
which is the whole question.
"""

import logging
from types import SimpleNamespace

import pytest
from flask import Flask, g
from pydantic import ValidationError
from superset_core.extensions.types import (
    Contributions,
    Manifest,
    ManifestFrontend,
    Page,
)
from werkzeug.exceptions import NotFound

from superset.constants import EXTENSION_VIEW_MENU_PREFIX
from superset.extensions import view
from superset.extensions.view import (
    _first_claimant,
    ensure_page_permissions,
    permitted_page_paths,
    register_extension_pages,
    registered_page_paths,
)

#: The view menu an extension's page permissions hang from.
VIEW_MENU = f"{EXTENSION_VIEW_MENU_PREFIX}acme.tools"


def manifest(
    *paths: str,
    extension_id: str = "acme.tools",
    permission: str | None = None,
) -> Manifest:
    publisher, name = extension_id.split(".", 1)
    return Manifest(
        publisher=publisher,
        name=name,
        displayName="Tools",
        # A page needs a bundle to supply its component, so a manifest that
        # contributes one always has a frontend. Fixtures say so too, or they
        # would be testing a shape the loader never produces.
        frontend=ManifestFrontend(
            remoteEntry="remoteEntry.js",
            moduleFederationName=f"{publisher}_{name.replace('-', '_')}",
        ),
        contributions=Contributions(
            pages=[Page(path=path, name=path, permission=permission) for path in paths]
        ),
    )


class FakeSecurityManager:
    """Stands in for the real one, recording what was asked and created."""

    def __init__(self, granted: set[tuple[str, str]] | None = None) -> None:
        self.granted = granted or set()
        self.existing: set[tuple[str, str]] = set()
        self.created: list[tuple[str, str]] = []
        self.asked: list[tuple[str, str]] = []
        self.rollbacks = 0
        self.admin_role = SimpleNamespace(name="Admin", permissions=[])
        self.roles: dict[str, SimpleNamespace] = {"Admin": self.admin_role}

    def can_access(self, permission: str, view: str) -> bool:
        self.asked.append((permission, view))
        return (permission, view) in self.granted

    def find_permission_view_menu(
        self, permission: str, view: str
    ) -> SimpleNamespace | None:
        if (permission, view) not in self.existing:
            return None
        # FAB's PermissionView carries `role`, the roles holding it. The
        # production code reads it, so the stand-in has to have it.
        return SimpleNamespace(
            permission=SimpleNamespace(name=permission),
            view_menu=SimpleNamespace(name=view),
            role=[
                role
                for role in self.roles.values()
                if (permission, view) in getattr(role, "permissions", [])
            ],
        )

    def add_permission_view_menu(self, permission: str, view: str) -> None:
        self.existing.add((permission, view))
        self.created.append((permission, view))

    def find_role(self, name: str) -> SimpleNamespace | None:
        return self.roles.get(name)

    def add_permission_role(
        self, role: SimpleNamespace, perm_view: SimpleNamespace
    ) -> None:
        # Stored as the (permission, view_menu) pair the rest of this file
        # asserts against, and the pair `find_permission_view_menu` derives
        # `role` from -- so a grant made here is visible to the next lookup.
        held = (perm_view.permission.name, perm_view.view_menu.name)
        if held not in role.permissions:
            role.permissions.append(held)

    # Named to match SupersetSecurityManager. A fake that invents its own
    # attribute names lets production code call something that is not there.
    @property
    def session(self) -> SimpleNamespace:
        return SimpleNamespace(rollback=self._record_rollback)

    def _record_rollback(self) -> None:
        # Counts the call, not the read of `session`. Code that takes the
        # session after a failed insert and never rolls back leaves the
        # dirty state in place, and has to fail the assertion.
        self.rollbacks += 1


@pytest.fixture
def security(monkeypatch: pytest.MonkeyPatch) -> FakeSecurityManager:
    import superset

    manager = FakeSecurityManager()
    monkeypatch.setattr(superset, "security_manager", manager, raising=False)
    return manager


def paths_in(app: Flask) -> set[str]:
    return {rule.rule for rule in app.url_map.iter_rules()}


@pytest.fixture
def app() -> Flask:
    return Flask(__name__)


def test_a_free_path_is_registered(app: Flask) -> None:
    register_extension_pages(app, manifest("/approvals"))

    assert "/approvals" in paths_in(app)
    # The page owns everything beneath it, so a deep link resolves on a cold
    # load instead of 404ing before the client router ever runs.
    assert "/approvals/<path:rest>" in paths_in(app)


def test_a_path_a_core_route_already_serves_is_refused(
    app: Flask, caplog: pytest.LogCaptureFixture
) -> None:
    app.add_url_rule("/welcome", endpoint="welcome", view_func=lambda: "")

    with caplog.at_level(logging.ERROR):
        register_extension_pages(app, manifest("/welcome"))

    assert "/welcome/<path:rest>" not in paths_in(app)
    assert "already served by welcome" in caplog.text


def test_a_parameterised_rule_is_recognised_as_the_claimant(
    app: Flask, caplog: pytest.LogCaptureFixture
) -> None:
    """The case a literal comparison against known routes gets wrong.

    ``/oauth-authorized/<provider>`` never string-matches the concrete path
    it would answer, so a denylist of route templates waves this through --
    which is how an extension could end up in front of an OAuth callback.
    """
    app.add_url_rule(
        "/oauth-authorized/<provider>", endpoint="oauth", view_func=lambda provider: ""
    )

    with caplog.at_level(logging.ERROR):
        register_extension_pages(app, manifest("/oauth-authorized/google"))

    assert "/oauth-authorized/google" not in paths_in(app)
    assert "already served by oauth" in caplog.text


def test_a_path_whose_descendants_are_taken_is_refused(
    app: Flask, caplog: pytest.LogCaptureFixture
) -> None:
    """A page at ``/x`` would shadow ``/x/list`` through its sub-path rule."""
    app.add_url_rule("/report/list", endpoint="report_list", view_func=lambda: "")

    with caplog.at_level(logging.ERROR):
        register_extension_pages(app, manifest("/report"))

    assert "/report" not in paths_in(app)


def test_a_rule_answering_other_methods_still_owns_the_path(app: Flask) -> None:
    app.add_url_rule(
        "/submit", endpoint="submit", view_func=lambda: "", methods=["POST"]
    )

    register_extension_pages(app, manifest("/submit"))

    assert "/submit/<path:rest>" not in paths_in(app)


def test_the_second_extension_to_claim_a_path_is_refused(
    app: Flask, caplog: pytest.LogCaptureFixture
) -> None:
    register_extension_pages(app, manifest("/approvals"))

    with caplog.at_level(logging.ERROR):
        register_extension_pages(app, manifest("/approvals", extension_id="other.ext"))

    assert "other.ext" in caplog.text
    # The first extension keeps the path; the loser is told, not silently
    # left with a component nothing routes to.
    assert len([r for r in app.url_map.iter_rules() if r.rule == "/approvals"]) == 1


def test_one_refused_page_does_not_stop_the_others(
    app: Flask, caplog: pytest.LogCaptureFixture
) -> None:
    app.add_url_rule("/welcome", endpoint="welcome", view_func=lambda: "")

    with caplog.at_level(logging.ERROR):
        register_extension_pages(app, manifest("/welcome", "/approvals"))

    assert "/approvals" in paths_in(app)


def test_an_extension_declaring_no_pages_registers_nothing(app: Flask) -> None:
    before = paths_in(app)

    register_extension_pages(app, manifest())

    assert paths_in(app) == before


@pytest.mark.parametrize(
    "path",
    [
        "review-queue",
        "/review-queue/",
        "/Review-Queue",
        "",
        "/review-queue/:id",
        "/-queue",
        "/a//b",
    ],
)
def test_a_malformed_path_is_rejected_by_the_manifest(path: str) -> None:
    """Rejected at parse time, so a bad path never reaches the URL map."""
    with pytest.raises(ValidationError, match="should match pattern"):
        Page(path=path, name="X")


def test_first_claimant_reports_a_redirect_as_taken(app: Flask) -> None:
    """``strict_slashes`` means ``/thing/`` already answers for ``/thing``."""
    app.add_url_rule("/thing/", endpoint="thing", view_func=lambda: "")

    assert _first_claimant(app, "/thing") is not None


def test_registered_page_paths_reports_only_what_was_accepted(app: Flask) -> None:
    app.add_url_rule("/welcome", endpoint="welcome", view_func=lambda: "")

    register_extension_pages(app, manifest("/welcome", "/approvals"))

    # The refused page is absent, so nothing downstream -- the menu, the
    # frontend's check on what an extension may register -- can offer a page
    # that has no route behind it.
    assert registered_page_paths(app, "acme.tools") == ["/approvals"]


def test_registered_page_paths_does_not_leak_across_extensions(app: Flask) -> None:
    register_extension_pages(app, manifest("/approvals"))
    register_extension_pages(app, manifest("/change-review", extension_id="other.ext"))

    assert registered_page_paths(app, "acme.tools") == ["/approvals"]
    assert registered_page_paths(app, "other.ext") == ["/change-review"]


def render_with(
    monkeypatch: pytest.MonkeyPatch,
    app: Flask,
    *,
    extensions_enabled: bool = True,
    user_id: int | None = 1,
    permission: str | None = None,
    granted: bool = False,
    recorded: bool = True,
    feature_flag: str | None = None,
    flag_on: bool = True,
) -> object:
    """Run one page view's guards without rendering a real template.

    The guards are the whole of the view; what it renders on success is
    ``spa.html`` unchanged, which the host's own screens already cover.

    ``recorded`` stands in for what registration does: the requirement is
    written to the app when the rule is added, and the view reads it on the
    way in. Pass ``False`` to exercise a rule whose page nothing registered.
    """
    import superset

    security = FakeSecurityManager(
        granted={(permission, VIEW_MENU)} if permission and granted else set()
    )
    monkeypatch.setattr(superset, "security_manager", security, raising=False)
    monkeypatch.setattr(
        superset,
        "is_feature_enabled",
        lambda flag: flag_on if flag == feature_flag else extensions_enabled,
    )
    monkeypatch.setattr(view, "get_user_id", lambda: user_id)
    monkeypatch.setattr(view, "_render_shell", lambda: "SHELL")
    monkeypatch.setattr(view, "redirect_to_login", lambda: "LOGIN")

    if recorded:
        view._requirements(app)[("acme.tools", "/approvals")] = (
            view.PageRequirement(permission=permission, feature_flag=feature_flag)
        )
    page_view = view._make_page_view("acme.tools", "/approvals")

    with app.test_request_context("/approvals"):
        g.user = object() if user_id else None
        return page_view()


def test_a_page_whose_feature_flag_is_off_is_not_served(
    monkeypatch: pytest.MonkeyPatch, app: Flask
) -> None:
    """A switched-off feature must not keep a page open (QA-23).

    404 rather than 403: with the flag off the feature is not running and
    there is no page, which is not a question about who the user is. An
    administrator holds every permission there is and must not see it
    either.
    """
    with pytest.raises(NotFound):
        render_with(
            monkeypatch,
            app,
            permission="can_review",
            granted=True,
            feature_flag="CHANGE_MANAGEMENT",
            flag_on=False,
        )


def test_a_page_whose_feature_flag_is_on_is_served(
    monkeypatch: pytest.MonkeyPatch, app: Flask
) -> None:
    assert (
        render_with(
            monkeypatch,
            app,
            permission="can_review",
            granted=True,
            feature_flag="CHANGE_MANAGEMENT",
            flag_on=True,
        )
        == "SHELL"
    )


def test_a_page_without_a_feature_flag_is_unaffected(
    monkeypatch: pytest.MonkeyPatch, app: Flask
) -> None:
    # The field is optional, and adding it must not change a page that does
    # not declare one.
    assert (
        render_with(monkeypatch, app, permission="can_review", granted=True) == "SHELL"
    )


def test_the_flag_is_checked_before_the_permission(
    monkeypatch: pytest.MonkeyPatch, app: Flask
) -> None:
    # Otherwise a user without the permission would learn, from a 403 rather
    # than a 404, that the page exists while the feature is off.
    with pytest.raises(NotFound):
        render_with(
            monkeypatch,
            app,
            permission="can_review",
            granted=False,
            feature_flag="CHANGE_MANAGEMENT",
            flag_on=False,
        )


def test_the_flag_decides_what_a_registered_page_answers(
    monkeypatch: pytest.MonkeyPatch, app: Flask
) -> None:
    """Read per request, so turning extensions off takes effect immediately.

    The rule stays in the URL map until the process restarts; the flag is
    what stops it serving, rather than leaving pages reachable in the window
    between flipping the flag and a restart.
    """
    with pytest.raises(NotFound):
        render_with(monkeypatch, app, extensions_enabled=False)


def test_an_anonymous_load_is_sent_to_login_not_404(
    monkeypatch: pytest.MonkeyPatch, app: Flask
) -> None:
    # 404 here would tell an anonymous visitor the page does not exist, and
    # send them nowhere useful; every other host screen redirects.
    assert render_with(monkeypatch, app, user_id=None) == "LOGIN"


def test_a_signed_in_load_gets_the_shell(
    monkeypatch: pytest.MonkeyPatch, app: Flask
) -> None:
    assert render_with(monkeypatch, app) == "SHELL"


def test_a_page_without_a_permission_is_open_to_any_signed_in_user(
    security: FakeSecurityManager,
) -> None:
    # The default has to stay open, or adding this field would lock users out
    # of pages that already worked.
    assert view.may_open("acme.tools", None) is True
    assert security.asked == []


def test_a_declared_permission_is_checked_against_the_extension(
    security: FakeSecurityManager,
) -> None:
    assert view.may_open("acme.tools", "can_review") is False

    # Granted on the extension, which is what the Roles screen shows.
    security.granted.add(("can_review", VIEW_MENU))
    assert view.may_open("acme.tools", "can_review") is True


def test_the_same_permission_on_another_extension_does_not_carry_over(
    security: FakeSecurityManager,
) -> None:
    security.granted.add(("can_review", VIEW_MENU))

    assert view.may_open("other.ext", "can_review") is False


def test_permissions_are_created_for_every_page_that_names_one(
    app: Flask, security: FakeSecurityManager
) -> None:
    register_extension_pages(app, manifest("/a", "/b", permission="can_review"))
    with app.app_context():
        ensure_page_permissions(app, manifest("/a", "/b", permission="can_review"))

    # One row, not one per page: pages of an extension may share a permission.
    assert security.created == [("can_review", VIEW_MENU)]


def test_a_created_permission_is_granted_to_admin(
    app: Flask, security: FakeSecurityManager
) -> None:
    """`superset init` would hand Admin this permission; this does it sooner.

    Without it an administrator who installs an extension cannot open its
    pages until they grant themselves access to their own deployment.
    """
    register_extension_pages(app, manifest("/a", permission="can_review"))
    with app.app_context():
        ensure_page_permissions(app, manifest("/a", permission="can_review"))

    assert security.admin_role.permissions == [("can_review", VIEW_MENU)]


def test_an_operator_who_moves_the_grant_keeps_it_where_they_put_it(
    app: Flask, security: FakeSecurityManager
) -> None:
    """Admin excluded, a role of the operator's own holding it instead.

    Re-granting to Admin here would overrule them silently, and withholding
    it from Admin would stop being something an operator can decide.
    """
    security.existing.add(("can_review", VIEW_MENU))
    reviewers = SimpleNamespace(
        name="Reviewers", permissions=[("can_review", VIEW_MENU)]
    )
    security.roles["Reviewers"] = reviewers

    register_extension_pages(app, manifest("/a", permission="can_review"))
    with app.app_context():
        ensure_page_permissions(app, manifest("/a", permission="can_review"))

    assert security.created == []
    assert security.admin_role.permissions == []
    assert reviewers.permissions == [("can_review", VIEW_MENU)]


def test_a_grant_that_never_happened_is_repaired_on_a_later_boot(
    app: Flask, security: FakeSecurityManager
) -> None:
    """No role holds it, which is what the failures this guards look like.

    The permission exists but was never granted -- the first boot had no
    Admin role yet, or lost the create race, or failed partway. Granting only
    on the boot that creates the permission would leave it ungranted forever,
    with nothing to retry it.
    """
    security.existing.add(("can_review", VIEW_MENU))

    register_extension_pages(app, manifest("/a", permission="can_review"))
    with app.app_context():
        ensure_page_permissions(app, manifest("/a", permission="can_review"))

    assert security.created == []
    assert security.admin_role.permissions == [("can_review", VIEW_MENU)]


def test_the_admin_role_is_read_from_configuration(
    app: Flask, security: FakeSecurityManager
) -> None:
    # A deployment may rename it; granting a hardcoded "Admin" would then
    # write to a role nobody holds.
    app.config["AUTH_ROLE_ADMIN"] = "Superuser"
    superuser = SimpleNamespace(name="Superuser", permissions=[])
    security.roles["Superuser"] = superuser

    register_extension_pages(app, manifest("/a", permission="can_review"))
    with app.app_context():
        ensure_page_permissions(app, manifest("/a", permission="can_review"))

    assert superuser.permissions == [("can_review", VIEW_MENU)]
    assert security.admin_role.permissions == []


def test_a_missing_admin_role_does_not_stop_the_boot(
    app: Flask, security: FakeSecurityManager
) -> None:
    security.roles.clear()

    register_extension_pages(app, manifest("/a", permission="can_review"))
    with app.app_context():
        ensure_page_permissions(app, manifest("/a", permission="can_review"))

    assert security.created == [("can_review", VIEW_MENU)]


def test_nothing_is_created_for_pages_without_permissions(
    app: Flask, security: FakeSecurityManager
) -> None:
    register_extension_pages(app, manifest("/a", "/b"))
    with app.app_context():
        ensure_page_permissions(app, manifest("/a", "/b"))

    assert security.created == []
    assert security.admin_role.permissions == []


def test_creating_permissions_is_idempotent(
    app: Flask, security: FakeSecurityManager
) -> None:
    # Every worker runs this at every boot.
    register_extension_pages(app, manifest("/a", permission="can_review"))
    with app.app_context():
        ensure_page_permissions(app, manifest("/a", permission="can_review"))
        ensure_page_permissions(app, manifest("/a", permission="can_review"))

    assert security.created == [("can_review", VIEW_MENU)]
    # Granted once, by the boot that created it -- not again afterwards.
    assert security.admin_role.permissions == [("can_review", VIEW_MENU)]


def test_a_failure_to_create_a_permission_does_not_stop_the_boot(
    monkeypatch: pytest.MonkeyPatch, app: Flask, security: FakeSecurityManager
) -> None:
    """Two workers starting together race between the lookup and the insert."""

    def explode(permission: str, view_menu: str) -> None:
        raise RuntimeError("duplicate key")

    monkeypatch.setattr(security, "add_permission_view_menu", explode)

    register_extension_pages(app, manifest("/a", permission="can_review"))
    with app.app_context():
        ensure_page_permissions(app, manifest("/a", permission="can_review"))

    # And the session was rolled back, so the next write on this worker is
    # not issued against a session left dirty by the failed insert.
    assert security.rollbacks == 1


def test_permitted_page_paths_reports_only_what_the_user_may_open(
    app: Flask, security: FakeSecurityManager
) -> None:
    register_extension_pages(app, manifest("/open"))
    register_extension_pages(app, manifest("/restricted", permission="can_review"))

    assert permitted_page_paths(app, manifest("/open")) == {"/open"}
    assert (
        permitted_page_paths(app, manifest("/restricted", permission="can_review"))
        == set()
    )

    security.granted.add(("can_review", VIEW_MENU))
    assert permitted_page_paths(
        app, manifest("/restricted", permission="can_review")
    ) == {"/restricted"}


def test_a_refused_page_is_never_reported_as_permitted(
    app: Flask, security: FakeSecurityManager
) -> None:
    """A page with no rule cannot be opened however the permissions read."""
    app.add_url_rule("/welcome", endpoint="welcome", view_func=lambda: "")
    security.granted.add(("can_review", VIEW_MENU))

    register_extension_pages(app, manifest("/welcome", permission="can_review"))

    assert (
        permitted_page_paths(app, manifest("/welcome", permission="can_review"))
        == set()
    )


def test_a_rule_with_no_recorded_requirement_is_refused(
    monkeypatch: pytest.MonkeyPatch, app: Flask
) -> None:
    """A live route whose page nothing registered does not serve.

    The requirement is what says a page exists and what it needs, so a rule
    with no entry against it has no page behind it. Refusing is the only safe
    reading: the alternative is that an unrecorded page requires nothing,
    which would make the pages nobody registered the most open ones there
    are. The permission is granted here, so the refusal can only come from
    the missing record.
    """
    with pytest.raises(NotFound):
        render_with(
            monkeypatch, app, permission="can_review", granted=True, recorded=False
        )


def test_the_api_reports_the_requirement_the_route_enforces(
    app: Flask, security: FakeSecurityManager
) -> None:
    """An edited manifest cannot move what is advertised away from what is
    enforced.

    `get_extensions` re-reads the bundle on every request, so the manifest
    reaching here is not necessarily the one the rule was registered with.
    The route enforces `can_review`; this manifest has since dropped it.
    Reading the requirement from the table rather than from the manifest
    beside it keeps the two answers the same -- the page stays hidden until
    the permission the route actually checks is granted.
    """
    register_extension_pages(app, manifest("/a", permission="can_review"))

    assert permitted_page_paths(app, manifest("/a")) == set()

    security.granted.add(("can_review", VIEW_MENU))
    assert permitted_page_paths(app, manifest("/a")) == {"/a"}


def test_a_manifest_claiming_more_than_the_route_enforces_does_not_hide_it(
    app: Flask, security: FakeSecurityManager
) -> None:
    """The other direction of the same drift.

    The route was registered open and admits any signed-in user; the manifest
    has since grown a permission it does not enforce. Believing the manifest
    would hide the entry from a navigation bar while the page itself stayed
    reachable, which is the worse way round to be wrong about it.
    """
    register_extension_pages(app, manifest("/a"))

    assert permitted_page_paths(app, manifest("/a", permission="can_review")) == {"/a"}
    assert security.asked == []


@pytest.mark.parametrize("permission", ["Can_Review", "can review", "can-review", ""])
def test_a_malformed_permission_is_rejected_by_the_manifest(permission: str) -> None:
    with pytest.raises(ValidationError, match="should match pattern"):
        Page(path="/a", name="A", permission=permission)


def test_a_signed_in_user_without_the_permission_gets_the_shell_with_403(
    monkeypatch: pytest.MonkeyPatch, app: Flask
) -> None:
    """Refused, but answered with a page rather than a JSON error body.

    ``show_http_exception`` renders HTML only for 404 and 500, so aborting
    here answered a browser with the generic "unexpected error" issue code.
    The shell at 403 gives a cold load the same "not authorized" screen the
    client shows when the user arrives in-app, and keeps the status honest.
    """
    assert render_with(monkeypatch, app, permission="can_review", granted=False) == (
        "SHELL",
        403,
    )


def test_a_signed_in_user_with_the_permission_gets_the_shell(
    monkeypatch: pytest.MonkeyPatch, app: Flask
) -> None:
    assert (
        render_with(monkeypatch, app, permission="can_review", granted=True) == "SHELL"
    )


def test_an_anonymous_user_is_sent_to_login_rather_than_refused(
    monkeypatch: pytest.MonkeyPatch, app: Flask
) -> None:
    """Login comes first, so a permissioned page does not 403 a visitor.

    403 would be both unhelpful and a disclosure: it says the page exists to
    someone who has not identified themselves.
    """
    assert (
        render_with(
            monkeypatch, app, permission="can_review", granted=False, user_id=None
        )
        == "LOGIN"
    )


def test_the_fake_security_manager_only_names_real_attributes() -> None:
    """Pins the stand-in above to the class it stands in for.

    Without this a fake can invent an attribute -- `get_session` rather than
    `session` -- and every test using it passes while the production call
    raises AttributeError on the real object, inside the except branch meant
    to keep a failed insert from stopping the boot.
    """
    from superset.security.manager import SupersetSecurityManager

    used_by_production_code = (
        "can_access",
        "find_permission_view_menu",
        "add_permission_view_menu",
        "find_role",
        "add_permission_role",
        "session",
    )
    missing = [
        name
        for name in used_by_production_code
        if not hasattr(SupersetSecurityManager, name)
    ]
    assert not missing, (
        f"FakeSecurityManager names attributes that do not exist: {missing}"
    )

    fake_surface = {
        name for name in vars(FakeSecurityManager) if not name.startswith("_")
    }
    assert fake_surface <= set(used_by_production_code)


@pytest.mark.parametrize(
    "permission",
    ["database_access", "catalog_access", "schema_access", "datasource_access"],
)
def test_a_page_naming_an_object_level_permission_is_refused(
    app: Flask, caplog: pytest.LogCaptureFixture, permission: str
) -> None:
    """These four decide what Admin holds, by being excluded from it.

    A page naming one would have its Admin grant stripped the next time
    `superset init` ran, leaving a page nobody could open. Refusing it at
    registration says so while the author can still act on it.
    """
    with caplog.at_level(logging.ERROR):
        register_extension_pages(app, manifest("/a", permission=permission))

    assert "/a" not in paths_in(app)
    assert "reserved by Superset" in caplog.text


def test_the_reserved_set_is_superset_s_own(app: Flask) -> None:
    """Pins the guard to the list it defends, rather than a copy of it."""
    from superset.security.manager import SupersetSecurityManager

    for permission in SupersetSecurityManager.OBJECT_SPEC_PERMISSIONS:
        assert view._permission_problem(permission) is not None

    assert view._permission_problem("can_review") is None
    assert view._permission_problem(None) is None


def test_a_converter_above_the_page_s_depth_claims_the_path(app: Flask) -> None:
    """The case a template-string comparison misses.

    ``/api/v1/datasource/<datasource_type>/...`` does not start with
    ``/api/v1/datasource/table/``, so comparing templates as strings accepts a
    page at ``/api/v1/datasource/table``. Werkzeug then prefers that page's
    static segment over the converter, and the page answers the app shell with
    HTTP 200 where a JSON API belongs -- the endpoint native filters use to
    populate value dropdowns.
    """
    app.add_url_rule(
        "/api/v1/datasource/<datasource_type>/<int:datasource_id>/column/"
        "<column_name>/values/",
        endpoint="datasource_values",
        view_func=lambda **_kwargs: "JSON",
    )

    register_extension_pages(app, manifest("/api/v1/datasource/table"))

    assert "/api/v1/datasource/table" not in paths_in(app)
    # And the core endpoint still answers its own URL.
    adapter = app.url_map.bind("localhost")
    endpoint, _args = adapter.match(
        "/api/v1/datasource/table/42/column/name/values/", method="GET"
    )
    assert endpoint == "datasource_values"


def test_a_converter_that_could_never_match_is_not_a_conflict(
    app: Flask,
) -> None:
    """`<int:slice_id>` cannot match `review`, so the page may have the path.

    The weaker version of this test used a differing static segment, which a
    plain string comparison also gets right -- it documented the intent
    without being able to catch a regression. This one fails under any check
    that treats every converter as matching anything.
    """
    app.add_url_rule(
        "/slice/<int:slice_id>/", endpoint="slice", view_func=lambda **_k: ""
    )

    register_extension_pages(app, manifest("/slice/review"))

    assert "/slice/review" in paths_in(app)
    # And the core rule still answers its own URLs.
    endpoint, _args = app.url_map.bind("localhost").match("/slice/42/")
    assert endpoint == "slice"


def test_a_converter_that_could_match_is_still_a_conflict(app: Flask) -> None:
    """The narrowing above must not become "any converter, no conflict"."""
    app.add_url_rule(
        "/slice/<slice_name>/", endpoint="slice", view_func=lambda **_k: ""
    )

    register_extension_pages(app, manifest("/slice/review"))

    assert "/slice/review" not in paths_in(app)


def test_a_converter_inside_a_segment_is_seen(app: Flask) -> None:
    """A converter need not occupy a whole segment.

    `/plugin/v<int:version>/data` splits into a segment `v<int:version>` that
    no comparison against `v1` recognises as dynamic, so a page at
    `/plugin/v1` would be accepted and would then take `/plugin/v1/data`.
    No core rule has this shape today, but operator blueprints and
    FLASK_APP_MUTATOR both run before extensions load.
    """
    app.add_url_rule(
        "/plugin/v<int:version>/data", endpoint="plugin", view_func=lambda **_k: ""
    )

    register_extension_pages(app, manifest("/plugin/v1"))

    assert "/plugin/v1" not in paths_in(app)


def test_a_path_converter_above_the_page_claims_the_whole_subtree(
    app: Flask,
) -> None:
    app.add_url_rule("/files/<path:rest>", endpoint="files", view_func=lambda **_k: "")

    register_extension_pages(app, manifest("/files/reports"))

    assert "/files/reports" not in paths_in(app)


def test_one_extension_cannot_read_back_another_s_pages(app: Flask) -> None:
    """Ids may contain hyphens, so the endpoint prefix needs a separator.

    Without it `acme.review` reads `acme.review-plus`'s rules as its own,
    which undoes a refusal: the reader concludes its page is registered, the
    API reports it as permitted, and the frontend accepts a component for
    another extension's path.
    """
    register_extension_pages(app, manifest("/queue", extension_id="acme.review-plus"))

    assert registered_page_paths(app, "acme.review-plus") == ["/queue"]
    assert registered_page_paths(app, "acme.review") == []


def test_a_page_is_reachable_with_or_without_a_trailing_slash(app: Flask) -> None:
    # Most Superset screens carry one, so a hard 404 here is a trap.
    register_extension_pages(app, manifest("/review-queue"))

    adapter = app.url_map.bind("localhost")
    for probe in ["/review-queue", "/review-queue/"]:
        endpoint, _args = adapter.match(probe, method="GET")
        assert endpoint.startswith("extension_page.")


def test_extension_page_permissions_are_kept_out_of_alpha_and_gamma() -> None:
    """`_is_gamma_pvm` is a denylist, so anything unrecognised reaches Gamma.

    Superset hit this with `UserRegistrationsRestAPI` and fixed it by listing
    the view menu in ADMIN_ONLY_VIEW_MENUS. An extension's view menu carries
    its id and so can never be listed; the prefix is what makes it
    recognisable instead. Without this a declared page permission would stop
    restricting anything the next time `superset init` ran.
    """
    from superset.security.manager import SupersetSecurityManager

    pvm = SimpleNamespace(
        permission=SimpleNamespace(name="can_review"),
        view_menu=SimpleNamespace(name=view._view_menu("acme.tools")),
    )

    # Built without __init__: these predicates read only class attributes,
    # and a real manager would need an initialised app.
    manager = SupersetSecurityManager.__new__(SupersetSecurityManager)

    assert manager._is_admin_only(pvm)
    assert not manager._is_gamma_pvm(pvm)
    assert not manager._is_alpha_pvm(pvm)
    # Admin still receives it.
    assert manager._is_admin_pvm(pvm)


def test_an_ordinary_permission_still_reaches_gamma() -> None:
    """Guards the change above against over-reaching."""
    from superset.security.manager import SupersetSecurityManager

    pvm = SimpleNamespace(
        permission=SimpleNamespace(name="can_read"),
        view_menu=SimpleNamespace(name="Dashboard"),
    )

    manager = SupersetSecurityManager.__new__(SupersetSecurityManager)

    assert manager._is_gamma_pvm(pvm)


def test_the_manifest_bounds_what_the_boot_check_has_to_scan() -> None:
    # Every declared path is compared against every rule in the URL map, so
    # neither the path nor the list can be unbounded.
    with pytest.raises(ValidationError):
        Page(path="/" + "a" * 300, name="x")

    with pytest.raises(ValidationError):
        Contributions(pages=[Page(path=f"/p{i}", name="x") for i in range(101)])


@pytest.mark.parametrize("permission", ["can_userinfo", "can_recent_activity"])
def test_a_page_naming_a_universally_held_permission_is_refused(
    app: Flask, caplog: pytest.LogCaptureFixture, permission: str
) -> None:
    """These defeat the restriction rather than merely misplacing it.

    `_is_alpha_pvm` and `_is_gamma_pvm` both end in
    `... or self._is_accessible_to_all(pvm)`, evaluated after the
    `_is_admin_only` test that keeps extension permissions off those roles.
    A page declaring one would be open to every role however its view menu is
    named -- the same defect the view-menu prefix fixed, through the other
    override set.
    """
    with caplog.at_level(logging.ERROR):
        register_extension_pages(app, manifest("/a", permission=permission))

    assert "/a" not in paths_in(app)
    assert "every role holds" in caplog.text


def test_the_reserved_sets_are_superset_s_own(app: Flask) -> None:
    """Pins both guards to the sets they defend, not to copies of them."""
    from superset.security.manager import SupersetSecurityManager

    reserved = (
        SupersetSecurityManager.OBJECT_SPEC_PERMISSIONS
        | SupersetSecurityManager.ACCESSIBLE_PERMS
    )
    for permission in reserved:
        assert view._permission_problem(permission) is not None

    assert view._permission_problem("can_review") is None
    assert view._permission_problem(None) is None


def test_a_refused_page_gets_no_permission_row(
    app: Flask, security: FakeSecurityManager
) -> None:
    """A page with no rule is unreachable, so its permission is noise.

    Creating it would leave a row -- and an Admin grant -- in the Roles
    screen for a page that does not exist.
    """
    app.add_url_rule("/welcome", endpoint="welcome", view_func=lambda: "")

    register_extension_pages(app, manifest("/welcome", permission="can_review"))
    with app.app_context():
        ensure_page_permissions(app, manifest("/welcome", permission="can_review"))

    assert security.created == []
    assert security.admin_role.permissions == []


def test_a_registered_page_still_gets_its_permission(
    app: Flask, security: FakeSecurityManager
) -> None:
    """Guards the filter above against refusing everything."""
    register_extension_pages(app, manifest("/approvals", permission="can_review"))
    with app.app_context():
        ensure_page_permissions(app, manifest("/approvals", permission="can_review"))

    assert security.created == [("can_review", VIEW_MENU)]


def test_the_rule_parse_werkzeug_exposes_is_the_shape_we_read() -> None:
    """`Rule._trace` is private, so a Werkzeug upgrade should fail loudly.

    Without this the parse would quietly become unreadable, the fallback
    would take over, and the only symptom would be pages refused for paths
    that are free -- which looks like a manifest mistake, not a regression.
    """
    from werkzeug.routing import Map, Rule

    url_map = Map()
    rule = Rule("/plugin/v<int:version>/data", endpoint="probe")
    url_map.add(rule)
    url_map.update()

    assert view._rule_segments(rule) == [
        ("plugin", []),
        ("v", ["version"]),
        ("data", []),
    ]
    assert "version" in getattr(rule, "_converters", {})


def test_permission_syncing_can_be_switched_off(
    app: Flask, security: FakeSecurityManager
) -> None:
    """For a deployment that must not write to the metadata database at start.

    Pages still register and are still enforced; the permissions have to
    exist already.
    """
    app.config["EXTENSIONS_SYNC_PAGE_PERMISSIONS"] = False

    register_extension_pages(app, manifest("/a", permission="can_review"))
    with app.app_context():
        ensure_page_permissions(app, manifest("/a", permission="can_review"))

    assert security.created == []
    assert security.admin_role.permissions == []
    # The page itself is unaffected.
    assert "/a" in paths_in(app)


def test_a_settled_deployment_does_not_look_up_the_role(
    app: Flask, security: FakeSecurityManager, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Every worker runs this at every start, so the quiet path stays quiet.

    Once a role holds the permission there is nothing to do, and finding that
    out should not cost a second lookup per permission per worker.
    """
    security.existing.add(("can_review", VIEW_MENU))
    security.admin_role.permissions.append(("can_review", VIEW_MENU))
    looked_up: list[str] = []

    def find_role(name: str) -> SimpleNamespace | None:
        looked_up.append(name)
        return security.roles.get(name)

    monkeypatch.setattr(security, "find_role", find_role)

    register_extension_pages(app, manifest("/a", permission="can_review"))
    with app.app_context():
        ensure_page_permissions(app, manifest("/a", permission="can_review"))

    assert security.created == []
    assert looked_up == []


def duplicate_manifest() -> Manifest:
    """One path declared twice, the second without the permission."""
    return Manifest(
        publisher="acme",
        name="tools",
        displayName="Tools",
        frontend=ManifestFrontend(
            remoteEntry="remoteEntry.js", moduleFederationName="acme_tools"
        ),
        contributions=Contributions(
            pages=[
                Page(path="/review-queue", name="Queue", permission="can_review"),
                Page(path="/review-queue", name="Queue again"),
            ]
        ),
    )


def test_a_duplicate_declaration_cannot_relax_the_permission(
    app: Flask, security: FakeSecurityManager
) -> None:
    """The second declaration is refused, and the first keeps the requirement.

    Registration takes the first claimant, so the looser duplicate never gets
    a rule. What the frontend is told has to agree with that: deriving it from
    the manifest row rather than from the rule's own requirement would let the
    unrestricted duplicate advertise a page the server answers 403 for.
    """
    manifest = duplicate_manifest()
    register_extension_pages(app, manifest)

    assert registered_page_paths(app, "acme.tools") == ["/review-queue"]
    assert view._requirements(app)[
        ("acme.tools", "/review-queue")
    ].permission == "can_review"

    with app.app_context():
        assert permitted_page_paths(app, manifest) == set()

    security.granted.add(("can_review", VIEW_MENU))
    with app.app_context():
        assert permitted_page_paths(app, manifest) == {"/review-queue"}


def test_a_page_shadowing_the_application_root_is_refused(
    app: Flask, caplog: pytest.LogCaptureFixture
) -> None:
    """Its real URL would be '/analytics/analytics/review'.

    The client cannot build that link: a path already starting with the root
    segment is indistinguishable from one that has been rooted already, so
    `ensureAppRoot` leaves it alone and the menu entry points somewhere that
    does not exist. Refused here, where the ambiguity is visible, rather than
    served as a page nothing can link to.
    """
    app.config["APPLICATION_ROOT"] = "/analytics"

    with caplog.at_level(logging.ERROR):
        register_extension_pages(app, manifest("/analytics/review"))

    assert registered_page_paths(app, "acme.tools") == []
    assert "application root" in caplog.text


def test_the_root_segment_is_matched_whole(app: Flask) -> None:
    """`/analytics-archive` only looks like it starts with `/analytics`."""
    app.config["APPLICATION_ROOT"] = "/analytics"

    register_extension_pages(app, manifest("/analytics-archive"))

    assert registered_page_paths(app, "acme.tools") == ["/analytics-archive"]


def test_the_default_root_refuses_nothing(app: Flask) -> None:
    """Most deployments serve from the domain root, where there is no clash."""
    app.config["APPLICATION_ROOT"] = "/"

    register_extension_pages(app, manifest("/review"))

    assert registered_page_paths(app, "acme.tools") == ["/review"]


def test_pages_from_a_manifest_with_no_frontend_are_refused(
    app: Flask, caplog: pytest.LogCaptureFixture
) -> None:
    """Nothing could ever register a component for them."""
    backend_only = manifest("/review")
    backend_only.frontend = None

    with caplog.at_level(logging.ERROR):
        register_extension_pages(app, backend_only)

    assert registered_page_paths(app, "acme.tools") == []
    assert "no frontend" in caplog.text
