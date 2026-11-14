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

"""What guards a contributed page, and the permissions behind it.

There is no path collision to check any more: the host forms a page's
address from its id, so nothing a manifest declares can land on a route
Superset already serves. What is left is who may open a page -- a
permission and a feature flag -- and the rows an extension's permissions
need before an administrator can grant them.
"""

import logging
from types import SimpleNamespace

import pytest
from flask import Flask
from pydantic import ValidationError
from superset_core.extensions.types import (
    Contributions,
    Manifest,
    ManifestFrontend,
    Page,
)

from superset.constants import EXTENSION_VIEW_MENU_PREFIX
from superset.extensions import view
from superset.extensions.view import (
    _declared_requirement,
    ensure_page_permissions,
    page_available,
    permitted_page_ids,
)

#: The view menu an extension's page permissions hang from.
VIEW_MENU = f"{EXTENSION_VIEW_MENU_PREFIX}acme.tools"


def manifest(
    *page_ids: str,
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
            pages=[
                Page(id=page_id, name=page_id, permission=permission)
                for page_id in page_ids
            ]
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


@pytest.fixture
def app() -> Flask:
    return Flask(__name__)


@pytest.mark.parametrize("permission", ["Can_Review", "can review", "can-review", ""])
def test_a_malformed_permission_is_rejected_by_the_manifest(permission: str) -> None:
    # `id`, not the removed `path`: with a missing required field pydantic
    # reports that too, and `match` would pass on the permission pattern
    # whether or not the permission pattern still worked.
    with pytest.raises(ValidationError, match="should match pattern"):
        Page(id="acme.tools.a", name="A", permission=permission)


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


def test_the_reserved_set_is_superset_s_own(app: Flask) -> None:
    """Pins the guard to the list it defends, rather than a copy of it."""
    from superset.security.manager import SupersetSecurityManager

    for permission in SupersetSecurityManager.OBJECT_SPEC_PERMISSIONS:
        assert view._permission_problem(permission) is not None

    assert view._permission_problem("can_review") is None
    assert view._permission_problem(None) is None


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


@pytest.mark.parametrize(
    "permission",
    ["database_access", "catalog_access", "schema_access", "datasource_access"],
)
def test_a_page_naming_an_object_level_permission_is_refused(
    app: Flask,
    caplog: pytest.LogCaptureFixture,
    permission: str,
    security: FakeSecurityManager,
) -> None:
    """These four decide what Admin holds, by being excluded from it.

    A page naming one would have its Admin grant stripped the next time
    `superset init` ran, leaving a page nobody could open. Refusing to create it
    says so while the author can still act on it.
    """
    with caplog.at_level(logging.ERROR):
        ensure_page_permissions(app, manifest("acme.tools.a", permission=permission))

    assert security.created == []
    assert "reserved by Superset" in caplog.text


@pytest.mark.parametrize("permission", ["can_userinfo", "can_recent_activity"])
def test_a_page_naming_a_universally_held_permission_is_refused(
    app: Flask,
    caplog: pytest.LogCaptureFixture,
    permission: str,
    security: FakeSecurityManager,
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
        ensure_page_permissions(app, manifest("acme.tools.a", permission=permission))

    assert security.created == []
    assert "every role holds" in caplog.text


def test_the_admin_role_is_read_from_configuration(
    app: Flask, security: FakeSecurityManager
) -> None:
    # A deployment may rename it; granting a hardcoded "Admin" would then
    # write to a role nobody holds.
    app.config["AUTH_ROLE_ADMIN"] = "Superuser"
    superuser = SimpleNamespace(name="Superuser", permissions=[])
    security.roles["Superuser"] = superuser

    with app.app_context():
        ensure_page_permissions(app, manifest("acme.tools.a", permission="can_review"))

    assert superuser.permissions == [("can_review", VIEW_MENU)]
    assert security.admin_role.permissions == []


def test_a_missing_admin_role_does_not_stop_the_boot(
    app: Flask, security: FakeSecurityManager
) -> None:
    security.roles.clear()

    with app.app_context():
        ensure_page_permissions(app, manifest("acme.tools.a", permission="can_review"))

    assert security.created == [("can_review", VIEW_MENU)]


def test_creating_permissions_is_idempotent(
    app: Flask, security: FakeSecurityManager
) -> None:
    # Every worker runs this at every boot.
    with app.app_context():
        ensure_page_permissions(app, manifest("acme.tools.a", permission="can_review"))
        ensure_page_permissions(app, manifest("acme.tools.a", permission="can_review"))

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

    with app.app_context():
        ensure_page_permissions(app, manifest("acme.tools.a", permission="can_review"))

    # And the session was rolled back, so the next write on this worker is
    # not issued against a session left dirty by the failed insert.
    assert security.rollbacks == 1


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

    with app.app_context():
        ensure_page_permissions(app, manifest("acme.tools.a", permission="can_review"))

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

    with app.app_context():
        ensure_page_permissions(app, manifest("acme.tools.a", permission="can_review"))

    assert security.created == []
    assert security.admin_role.permissions == [("can_review", VIEW_MENU)]


def test_permission_syncing_can_be_switched_off(
    app: Flask, security: FakeSecurityManager
) -> None:
    """For a deployment that must not write to the metadata database at start.

    Pages still register and are still enforced; the permissions have to
    exist already.
    """
    app.config["EXTENSIONS_SYNC_PAGE_PERMISSIONS"] = False

    with app.app_context():
        ensure_page_permissions(app, manifest("acme.tools.a", permission="can_review"))

    assert security.created == []
    assert security.admin_role.permissions == []


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

    with app.app_context():
        ensure_page_permissions(app, manifest("acme.tools.a", permission="can_review"))

    assert security.created == []
    assert looked_up == []


def test_permissions_are_created_for_every_page_that_names_one(
    app: Flask, security: FakeSecurityManager
) -> None:
    with app.app_context():
        ensure_page_permissions(
            app, manifest("acme.tools.a", "acme.tools.b", permission="can_review")
        )

    # One row, not one per page: pages of an extension may share a permission.
    assert security.created == [("can_review", VIEW_MENU)]


def test_a_created_permission_is_granted_to_admin(
    app: Flask, security: FakeSecurityManager
) -> None:
    """`superset init` would hand Admin this permission; this does it sooner.

    Without it an administrator who installs an extension cannot open its
    pages until they grant themselves access to their own deployment.
    """
    with app.app_context():
        ensure_page_permissions(app, manifest("acme.tools.a", permission="can_review"))

    assert security.admin_role.permissions == [("can_review", VIEW_MENU)]


def test_nothing_is_created_for_pages_without_permissions(
    app: Flask, security: FakeSecurityManager
) -> None:
    with app.app_context():
        ensure_page_permissions(app, manifest("acme.tools.a", "acme.tools.b"))

    assert security.created == []
    assert security.admin_role.permissions == []


def test_permitted_page_ids_reports_only_what_the_user_may_open(
    security: FakeSecurityManager,
) -> None:
    security.granted.add(("can_review", VIEW_MENU))

    permitted = permitted_page_ids(
        manifest("acme.tools.queue", permission="can_review")
    )

    assert permitted == {"acme.tools.queue"}


def test_a_page_the_user_may_not_open_is_not_reported(
    security: FakeSecurityManager,
) -> None:
    permitted = permitted_page_ids(
        manifest("acme.tools.queue", permission="can_review")
    )

    assert permitted == set()


def test_a_page_without_a_permission_is_open_to_any_signed_in_user(
    security: FakeSecurityManager,
) -> None:
    # The default every contributed page had before permissions existed.
    # Keeping it means adding the field cannot lock anyone out of a page
    # that already worked.
    assert permitted_page_ids(manifest("acme.tools.queue")) == {"acme.tools.queue"}
    assert security.asked == []


def test_a_permission_is_scoped_to_the_extension_that_declares_it(
    security: FakeSecurityManager,
) -> None:
    # Holding `can_review` on one extension says nothing about another
    # extension's page of the same name.
    security.granted.add(("can_review", f"{EXTENSION_VIEW_MENU_PREFIX}other.ext"))

    permitted = permitted_page_ids(
        manifest("acme.tools.queue", permission="can_review")
    )

    assert permitted == set()


def test_a_page_whose_feature_flag_is_off_is_not_reported(
    security: FakeSecurityManager, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A flag says whether the feature runs at all, so a page behind one that
    # is off is hidden from everyone -- including an administrator holding
    # every permission there is.
    import superset

    monkeypatch.setattr(superset, "is_feature_enabled", lambda _: False, raising=False)
    security.granted.add(("can_review", VIEW_MENU))

    declared = manifest("acme.tools.queue", permission="can_review")
    declared.contributions.pages[0].featureFlag = "CHANGE_MANAGEMENT"

    assert permitted_page_ids(declared) == set()


def test_a_manifest_feature_flag_reaches_what_guards_the_route(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The route reads the flag through a different path than the nav does.

    `permitted_page_ids` reads `page.featureFlag` straight off the manifest,
    so the test above covers the navigation. What guards the route is
    `_declared_requirement`, which copies the flag onto a `PageRequirement`
    that the view then puts through `page_available`. Dropping that one
    assignment leaves the page hidden from the nav exactly as it should be
    and its URL wide open, and every other test here stays green -- the flag
    tests build their `PageRequirement` by hand and never cross the join.
    """
    declared = manifest("acme.tools.queue")
    declared.contributions.pages[0].featureFlag = "CHANGE_MANAGEMENT"

    loaded = SimpleNamespace(manifest=declared)
    monkeypatch.setattr(
        "superset.extensions.utils.get_extensions",
        lambda: {"acme.tools": loaded},
        raising=False,
    )

    found = _declared_requirement("acme.tools.queue")
    assert found is not None
    extension_id, requirement = found
    assert extension_id == "acme.tools"
    # The flag the manifest declared, not None: this is what the route then
    # puts through `page_available` to decide 404.
    assert requirement.feature_flag == "CHANGE_MANAGEMENT"

    import superset

    monkeypatch.setattr(superset, "is_feature_enabled", lambda _: False, raising=False)
    assert page_available(requirement.feature_flag) is False
    monkeypatch.setattr(superset, "is_feature_enabled", lambda _: True, raising=False)
    assert page_available(requirement.feature_flag) is True


def test_a_page_without_a_feature_flag_is_unaffected_by_one() -> None:
    assert page_available(None) is True


def test_the_owning_extension_is_the_one_that_guards_a_page(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A squatter cannot answer for a page it only named.

    Nothing stops two manifests declaring the same page id -- the id pattern
    does not know whose extension it is in -- so without an ownership check
    the route enforces whichever manifest `get_extensions()` returns first.
    Here the squatter is first and declares neither a permission nor a flag,
    so taking it would leave `acme.tools`'s gated page open to anyone signed
    in. The owning extension's requirement is the one that must come back.
    """
    squatter = SimpleNamespace(
        manifest=manifest("acme.tools.queue", extension_id="other.ext")
    )
    owner = SimpleNamespace(
        manifest=manifest("acme.tools.queue", permission="can_review")
    )
    monkeypatch.setattr(
        "superset.extensions.utils.get_extensions",
        # Insertion-ordered, squatter first: the order a dict preserves is
        # the order this used to trust.
        lambda: {"other.ext": squatter, "acme.tools": owner},
        raising=False,
    )

    found = _declared_requirement("acme.tools.queue")
    assert found is not None
    extension_id, requirement = found
    assert extension_id == "acme.tools"
    assert requirement.permission == "can_review"


def test_a_page_an_extension_does_not_own_is_not_advertised() -> None:
    """The frontend would refuse to register it, so it must not be offered.

    `registerPageFor` drops a page whose id does not begin with the
    extension's own id. A nav entry for one would point at an address that
    renders "page not found".
    """
    squatter = manifest("acme.tools.queue", extension_id="other.ext")

    assert permitted_page_ids(squatter) == set()


def test_nothing_is_created_for_a_page_an_extension_does_not_own(
    app: Flask,
    security: FakeSecurityManager,
    caplog: pytest.LogCaptureFixture,
) -> None:
    squatter = manifest(
        "acme.tools.queue", extension_id="other.ext", permission="can_review"
    )

    with app.app_context(), caplog.at_level(logging.ERROR):
        ensure_page_permissions(app, squatter)

    assert security.created == []
    assert "not one of its own" in caplog.text


@pytest.fixture
def served(monkeypatch: pytest.MonkeyPatch) -> Flask:
    """An app serving the page route, with the shell stubbed.

    What these cases are about is the status and the body Flask ends up
    sending, which is where ``Forbidden`` and ``return shell, 403`` differ
    and where every other test in this file stops short: they call the
    helpers. ``ExtensionsView.page`` is bound onto a bare app rather than
    registered through FAB, because the only thing the view needs of itself
    is ``self.appbuilder``, and only on the anonymous branch of
    ``@signed_in``, which a signed-in stub never takes.
    """
    monkeypatch.setattr(view, "_render_shell", lambda: "<shell/>")
    monkeypatch.setattr(view, "current_user", SimpleNamespace(is_authenticated=True))

    app = Flask(__name__)
    app.add_url_rule(
        "/extensions/pages/<page_id>/",
        "page",
        lambda page_id: view.ExtensionsView.page(SimpleNamespace(), page_id),
    )
    return app


def _installed(monkeypatch: pytest.MonkeyPatch, declared: Manifest) -> None:
    monkeypatch.setattr(
        "superset.extensions.utils.get_extensions",
        lambda: {declared.id: SimpleNamespace(manifest=declared)},
        raising=False,
    )


def test_an_ungated_page_is_served_the_shell(
    served: Flask, monkeypatch: pytest.MonkeyPatch
) -> None:
    _installed(monkeypatch, manifest("acme.tools.queue"))

    response = served.test_client().get("/extensions/pages/acme.tools.queue/")

    assert response.status_code == 200
    assert response.get_data(as_text=True) == "<shell/>"


def test_a_page_whose_feature_flag_is_off_is_not_served(
    served: Flask, monkeypatch: pytest.MonkeyPatch
) -> None:
    declared = manifest("acme.tools.queue")
    declared.contributions.pages[0].featureFlag = "ACME_REVIEWS"
    _installed(monkeypatch, declared)

    import superset

    monkeypatch.setattr(superset, "is_feature_enabled", lambda _: False)

    response = served.test_client().get("/extensions/pages/acme.tools.queue/")

    assert response.status_code == 404


def test_a_gated_page_answers_403_with_the_shell_not_a_json_error(
    served: Flask,
    security: FakeSecurityManager,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The reader lands in Superset's own "Not authorized" screen.

    ``show_http_exception`` renders HTML for 404 and 500 only, so raising
    ``Forbidden`` here answered a refresh or a bookmark of a gated page with
    the ``GENERIC_BACKEND_ERROR`` JSON body -- a stack-trace shape where the
    client already has a screen for exactly this case. The status still has
    to be 403: it is what a cache or a crawler reads.
    """
    _installed(monkeypatch, manifest("acme.tools.queue", permission="can_review"))

    response = served.test_client().get("/extensions/pages/acme.tools.queue/")

    assert response.status_code == 403
    assert response.get_data(as_text=True) == "<shell/>"
    assert security.asked == [("can_review", VIEW_MENU)]
