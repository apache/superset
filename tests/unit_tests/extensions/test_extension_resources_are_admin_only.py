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
"""An extension's permissions must not reach stock Gamma and Alpha.

`_is_gamma_pvm` is a denylist: it recognises the host's own resources and
hands anything else to Gamma and Alpha on the next `superset init`. An
extension's resources are always "anything else", so every permission an
extension registered was granted to every signed-in user the first time an
operator ran init -- and a page gated on one quietly stopped being gated.

Measured, not assumed: an extension seeded `can_configure` to Admin alone,
and the next `superset init` handed it to Alpha and Gamma.

Default-deny, per SIP-235 section 6: a resource registered under an
extension context is recorded as the API class is registered, and role sync
classifies its permissions admin-only. An extension that wants a permission
to reach everyone in a workflow grants it to a role of its own, which role
sync does not rebuild.
"""

from types import SimpleNamespace

import pytest
from pytest_mock import MockerFixture

from superset import db
from superset.extensions import permissions
from superset.key_value.types import SharedKey
from superset.security.manager import SupersetSecurityManager


@pytest.fixture(autouse=True)
def _clean_registry():
    """Module state, so one test must not leak into the next."""
    before = set(permissions._extension_resources)  # noqa: SLF001
    permissions.clear_extension_resources()
    yield
    permissions.clear_extension_resources()
    permissions._extension_resources.update(before)  # noqa: SLF001


def _pvm(permission: str, resource: str) -> SimpleNamespace:
    return SimpleNamespace(
        permission=SimpleNamespace(name=permission),
        view_menu=SimpleNamespace(name=resource),
    )


class _HostView:
    """A view in the host's own package, as `_host_claims_resource` reads one.

    Its *module* is what marks it as the host's. Defined here rather than
    with `SimpleNamespace` because that lives in `types`, and a stub whose
    module is not `superset.` is exactly what an extension's view looks
    like -- which is the distinction under test.
    """

    _api_metadata: dict[str, object] = {"is_extension": False}

    def __init__(self, resource: str) -> None:
        self.class_permission_name = resource


class _ExtensionView:
    """A view an extension registered, marked by `api_impl`."""

    _api_metadata: dict[str, object] = {"is_extension": True}

    def __init__(self, resource: str) -> None:
        self.class_permission_name = resource


class _UnmarkedExtensionView:
    """An extension view registered with `appbuilder.add_api` directly.

    No `_api_metadata` at all, because only the `@api` decorator sets it. It
    is the host's own registration shape, so what separates it from a host
    view is the package it is defined in -- which is why the check asks that
    and not whether metadata is present.
    """

    def __init__(self, resource: str) -> None:
        self.class_permission_name = resource


# What marks a host view is the package it is defined in, so the stub says
# so outright rather than relying on where this test file happens to live.
_HostView.__module__ = "superset.views.core"


def _view(resource: str, *, is_extension: bool):
    return (_ExtensionView if is_extension else _HostView)(resource)


def _manager(*views: SimpleNamespace) -> SupersetSecurityManager:
    manager = SupersetSecurityManager.__new__(SupersetSecurityManager)
    # The host check reads the app's registered views, because Superset's own
    # REST APIs never pass through the `@api` decorator -- they are added with
    # `appbuilder.add_api(...)`, so anything fed from that decorator is empty
    # in production.
    manager.appbuilder = SimpleNamespace(baseviews=list(views))
    return manager


def test_an_unrecorded_resource_still_reaches_the_stock_roles():
    """The behaviour being corrected, pinned so the correction means something.

    This is what a host resource the denylist does not recognise does, and
    it is why the recording has to happen at registration rather than being
    left to each extension to remember.
    """
    manager = _manager()

    assert manager._is_admin_only(_pvm("can_read", "AcmeThing")) is False
    assert manager._is_gamma_pvm(_pvm("can_read", "AcmeThing")) is True


def test_every_permission_on_a_recorded_resource_is_admin_only():
    """Not just the one a page names -- the whole resource.

    SIP-235 section 6 fixes this for every extension permission rather than
    per contribution, so `can_read` is as restricted as `can_configure`.
    """
    permissions.register_extension_resource("AcmeThing")
    manager = _manager()

    for name in ("can_read", "can_write", "can_configure"):
        assert manager._is_admin_only(_pvm(name, "AcmeThing")) is True
        assert manager._is_gamma_pvm(_pvm(name, "AcmeThing")) is False
        assert manager._is_alpha_pvm(_pvm(name, "AcmeThing")) is False


def test_the_host_s_own_resources_are_untouched():
    """Recording one extension resource must not disturb anything else."""
    permissions.register_extension_resource("AcmeThing")
    manager = _manager()

    assert manager._is_gamma_pvm(_pvm("can_read", "Dashboard")) is True
    assert manager._is_admin_only(_pvm("can_read", "Dashboard")) is False


def test_recording_is_per_resource():
    permissions.register_extension_resource("AcmeThing")
    manager = _manager()

    assert manager._is_admin_only(_pvm("can_read", "OtherThing")) is False


def test_recording_twice_is_harmless():
    permissions.register_extension_resource("AcmeThing")
    permissions.register_extension_resource("AcmeThing")

    assert permissions.is_extension_resource("AcmeThing")


def test_nothing_is_granted_by_recording():
    """The classification only narrows; it is not a grant.

    Admin alone until an operator grants it, which is why a page can refuse
    an administrator until `superset init` has run.
    """
    permissions.register_extension_resource("AcmeThing")

    assert permissions.is_extension_resource("AcmeThing")
    assert not permissions.is_extension_resource("Dashboard")


def test_an_extension_cannot_claim_a_host_resource():
    """The hazard the guard exists for.

    SIP-235 allows an extension to gate on a host permission -- its own
    example is `{classPermissionName: 'Dashboard'}` -- so an extension `@api`
    class may carry a host resource's name. Without the guard that would
    classify the host's `Dashboard` as the extension's and strip every Gamma
    and Alpha permission on it at the next `superset init`.
    """
    permissions.register_extension_resource("Dashboard")
    manager = _manager(_view("Dashboard", is_extension=False))

    assert manager._is_admin_only(_pvm("can_read", "Dashboard")) is False
    assert manager._is_gamma_pvm(_pvm("can_read", "Dashboard")) is True


def test_host_claim_is_read_from_registered_views():
    """The check reads `appbuilder.baseviews`, which is what the app has.

    It has to be the registry the app actually populates. The host registers
    its own APIs with `appbuilder.add_api(...)` rather than through the `@api`
    decorator -- there are no `@api` applications under `superset/` -- so a
    check that consulted the decorator instead would see nothing in
    production and never fire.
    """
    permissions.register_extension_resource("Chart")
    manager = _manager(_view("Chart", is_extension=False))

    assert manager._host_claims_resource("Chart") is True
    assert manager._is_admin_only(_pvm("can_read", "Chart")) is False


def test_an_extension_s_own_resource_is_unaffected_by_the_guard():
    """The guard must not stop the thing the recording is for.

    The extension's view is registered too, but marked as an extension's, so
    it does not count as the host claiming the name.
    """
    permissions.register_extension_resource("AcmeThing")
    manager = _manager(
        _view("Dashboard", is_extension=False),
        _view("AcmeThing", is_extension=True),
    )

    assert manager._host_claims_resource("AcmeThing") is False
    assert manager._is_admin_only(_pvm("can_configure", "AcmeThing")) is True


def test_a_resource_no_view_claims_is_still_the_extension_s():
    """A recorded resource with nothing in `baseviews` stays admin-only.

    `baseviews` is read to find a *host* claim; its absence is not a reason
    to hand the permission back to Gamma.
    """
    permissions.register_extension_resource("AcmeThing")
    manager = _manager()

    assert manager._is_admin_only(_pvm("can_configure", "AcmeThing")) is True


def test_an_extension_view_registered_without_the_decorator_still_counts():
    """The shape that turned the whole classification off.

    An extension may register with `appbuilder.add_api(...)` rather than the
    `@api` decorator, so its view carries no `_api_metadata`. Reading that
    absence as "the host owns this" classified the extension's own resource
    as the host's, and `superset init` went on widening its permissions to
    Alpha and Gamma. A host claim now needs a view from the host's own
    package.
    """
    permissions.register_extension_resource("AcmeThing")
    manager = _manager(_UnmarkedExtensionView("AcmeThing"))

    assert manager._host_claims_resource("AcmeThing") is False
    assert manager._is_admin_only(_pvm("can_configure", "AcmeThing")) is True


def test_a_resource_recorded_by_an_earlier_process_is_still_admin_only(
    mocker: MockerFixture,
) -> None:
    """The fail-closed case: `superset init` with no extension loaded.

    A feature flag turned off, discovery failing, an entrypoint raising, or
    an extension uninstalled while its permissions remain -- in any of them
    nothing calls `register_extension_resource` in this process, so the
    in-memory set is empty and the denylist would hand every permission on
    the resource to the stock Gamma and Alpha roles.

    The recorded set is read from the metadata database, so a run that loads
    no extension still recognises what an earlier run registered.
    """
    mocker.patch.object(
        permissions,
        "_persisted",
        return_value={"AcmeThing"},
    )
    manager = _manager(_view("Dashboard", is_extension=False))

    assert permissions.is_extension_resource("AcmeThing") is True
    assert manager._is_admin_only(_pvm("can_configure", "AcmeThing")) is True
    assert manager._is_gamma_pvm(_pvm("can_configure", "AcmeThing")) is False


def test_a_store_that_cannot_be_read_does_not_break_role_sync(
    mocker: MockerFixture,
) -> None:
    """Degrading, not failing.

    Role sync runs inside `superset init`, which must not be taken down by a
    metadata database that is mid-migration or otherwise unreadable. The
    answer falls back to what this process knows.
    """
    mocker.patch(
        "superset.key_value.shared_entries.get_shared_value",
        side_effect=RuntimeError("no table"),
    )

    assert permissions.is_extension_resource("AcmeThing") is False

    permissions.register_extension_resource("AcmeThing")
    assert permissions.is_extension_resource("AcmeThing") is True


def test_recording_a_resource_writes_it_where_a_later_run_will_look(
    mocker: MockerFixture,
) -> None:
    """What makes the case above possible."""
    upsert = mocker.patch(
        "superset.key_value.shared_entries.upsert_shared_value",
    )
    mocker.patch(
        "superset.key_value.shared_entries.get_shared_value",
        return_value=[],
    )

    permissions.register_extension_resource("AcmeThing")

    assert upsert.called
    key, value = upsert.call_args[0]
    assert key == SharedKey.EXTENSION_RESOURCES
    assert "AcmeThing" in value


def test_the_recorded_set_is_read_once_not_once_per_permission(
    mocker: MockerFixture,
) -> None:
    """`sync_role_definitions` asks about every permission in the database.

    The answer comes from a transactional read, so asking the store each
    time would turn one role sync into as many round trips as there are
    permissions.
    """
    get_value = mocker.patch(
        "superset.key_value.shared_entries.get_shared_value",
        return_value=["AcmeThing"],
    )

    for _ in range(50):
        assert permissions.is_extension_resource("AcmeThing") is True

    assert get_value.call_count == 1


def test_a_permission_the_host_shares_with_everyone_is_still_admin_only():
    """The classification must not have a hole named after a host permission.

    `_is_accessible_to_all` is a *trailing* disjunct in both role
    predicates -- `not (... or _is_admin_only(pvm) ...) or
    _is_accessible_to_all(pvm)` -- so a permission it admits reaches Alpha
    and Gamma whatever the admin-only classification decided.
    `ACCESSIBLE_PERMS` names permissions the host puts on its own
    user-facing views, and an extension's API class carrying a method of the
    same name produced that permission on the extension's own resource.
    Measured before the fix: `_is_admin_only` said True and `_is_gamma_pvm`
    said True alongside it.
    """
    manager = _manager(_view("ChangeRequest", is_extension=True))
    permissions.register_extension_resource("ChangeRequest")

    for permission in SupersetSecurityManager.ACCESSIBLE_PERMS:
        pvm = _pvm(permission, "ChangeRequest")
        assert manager._is_admin_only(pvm) is True  # noqa: SLF001
        assert manager._is_accessible_to_all(pvm) is False  # noqa: SLF001
        assert manager._is_alpha_pvm(pvm) is False  # noqa: SLF001
        assert manager._is_gamma_pvm(pvm) is False  # noqa: SLF001


def test_the_host_keeps_the_permissions_it_shares_with_everyone():
    """The other side of the hole: closing it must not narrow the host.

    `can_userinfo` and `can_recent_activity` on the host's own views are
    what `ACCESSIBLE_PERMS` is for -- every signed-in user needs them -- so
    they must keep reaching Alpha and Gamma.
    """
    manager = _manager(_view("UserDBModelView", is_extension=False))
    permissions.register_extension_resource("ChangeRequest")

    for permission in SupersetSecurityManager.ACCESSIBLE_PERMS:
        pvm = _pvm(permission, "UserDBModelView")
        assert manager._is_accessible_to_all(pvm) is True  # noqa: SLF001
        assert manager._is_alpha_pvm(pvm) is True  # noqa: SLF001
        assert manager._is_gamma_pvm(pvm) is True  # noqa: SLF001


def test_an_extension_reusing_a_host_resource_keeps_the_host_s_grants():
    """SIP-235 lets an extension gate on a host permission.

    The host's `Dashboard` must keep `can_userinfo` reaching everyone even
    while an extension has registered a class carrying that resource name,
    for the same reason the admin-only classification defers to the host.
    """
    manager = _manager(
        _view("Dashboard", is_extension=False),
        _view("Dashboard", is_extension=True),
    )
    permissions.register_extension_resource("Dashboard")

    pvm = _pvm("can_userinfo", "Dashboard")
    assert manager._is_accessible_to_all(pvm) is True  # noqa: SLF001
    assert manager._is_gamma_pvm(pvm) is True  # noqa: SLF001


def test_a_failed_read_does_not_poison_the_enclosing_transaction(
    mocker: MockerFixture,
) -> None:
    """Swallowing the exception was not enough to degrade.

    `superset init` is itself `@transaction()`, and role sync asks about
    every permission from inside it. `transaction` only rolls back a
    transaction it opened -- a nested call sees `g.in_transaction` and runs
    the body bare -- so a failed statement left the session dirty however
    well the caller caught it. On PostgreSQL the enclosing transaction is
    then aborted and every later statement in the init run, its commit
    included, fails with `InFailedSqlTransaction`: the opposite of degrading.

    Asserted as "the statement ran inside a SAVEPOINT that was rolled back",
    because that is the mechanism that keeps the enclosing transaction
    usable, and the abort it prevents is specific to PostgreSQL -- SQLite
    would let the unprotected read through and report nothing.
    """
    begin_nested = mocker.spy(db.session, "begin_nested")
    mocker.patch(
        "superset.key_value.shared_entries.get_shared_value",
        side_effect=RuntimeError('relation "key_value" does not exist'),
    )

    assert permissions.is_extension_resource("AcmeThing") is False

    assert begin_nested.called, "the read must be isolated by a savepoint"
    assert db.session.is_active


def test_a_failed_write_is_attempted_again_on_the_next_registration(
    mocker: MockerFixture,
) -> None:
    """The durable record is what the fail-closed case reads.

    Returning early once the name was in this process's set meant a write
    that failed -- a metadata database briefly unreachable, or not yet
    migrated -- was never attempted again. The name then lived only in a
    process that is gone by the time it matters, and the `superset init` run
    with no extension loaded handed every permission on the resource back to
    the stock roles.
    """
    mocker.patch(
        "superset.key_value.shared_entries.get_shared_value",
        return_value=[],
    )
    upsert = mocker.patch(
        "superset.key_value.shared_entries.upsert_shared_value",
        side_effect=RuntimeError("unreachable"),
    )

    permissions.register_extension_resource("AcmeThing")
    assert upsert.call_count == 1

    upsert.side_effect = None
    permissions.register_extension_resource("AcmeThing")

    assert upsert.call_count == 2, "a failed write must be retried"
    assert "AcmeThing" in upsert.call_args[0][1]


def test_a_resource_recorded_by_another_process_is_not_written_over(
    mocker: MockerFixture,
) -> None:
    """The entry is shared by every process pointed at this database.

    Two booting concurrently -- a rolling deploy, or one deployment's
    workers starting beside another's -- each wrote the names they knew over
    whatever was there, so whichever wrote last dropped the other's
    resource. A later `superset init` that loaded no extension would then
    not recognise the dropped name.

    The two reads here are that interleaving: this process reads an empty
    store, another records `BetaThing`, and this process then writes.
    """
    mocker.patch(
        "superset.key_value.shared_entries.get_shared_value",
        side_effect=[[], ["BetaThing"]],
    )
    upsert = mocker.patch(
        "superset.key_value.shared_entries.upsert_shared_value",
    )

    permissions.register_extension_resource("AcmeThing")

    key, value = upsert.call_args[0]
    assert key == SharedKey.EXTENSION_RESOURCES
    assert set(value) == {"AcmeThing", "BetaThing"}


def test_the_other_roles_role_sync_builds_do_not_pick_up_the_resource():
    """`sync_role_definitions` builds four roles, not two.

    Alpha and Gamma are the pair that leaked, because they are the ones
    decided by a denylist. `sql_lab` and `Public` are allowlists -- literal
    sets of permission/resource pairs -- so an extension's resource cannot
    match one, and Admin is where these permissions are meant to land.
    Asserted rather than argued, so a later change from an allowlist to a
    denylist does not reopen this quietly.
    """
    manager = _manager(_view("ChangeRequest", is_extension=True))
    permissions.register_extension_resource("ChangeRequest")

    for permission in ("can_read", "can_write", "can_userinfo"):
        pvm = _pvm(permission, "ChangeRequest")
        assert manager._is_sql_lab_pvm(pvm) is False  # noqa: SLF001
        assert manager._is_public_pvm(pvm) is False  # noqa: SLF001
        # Admin is the role the classification routes them to.
        assert manager._is_admin_pvm(pvm) is True  # noqa: SLF001
