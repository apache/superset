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
