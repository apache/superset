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
"""``DatabaseWidgetResolver`` against real widget rows and users."""

from pytest_mock import MockerFixture

from superset import security_manager
from superset.canvas.widgets import DatabaseWidgetResolver
from superset.utils.core import override_user
from tests.unit_tests.widgets.fixtures import MakeUser, MakeWidget


def test_placeable_is_what_the_caller_can_read(
    make_user: MakeUser, make_widget: MakeWidget
) -> None:
    admin, _ = make_user("admin", "Admin")
    alice_user, alice = make_user("alice", "Gamma")
    bob_user, bob = make_user("bob", "Gamma")
    carol_user, _ = make_user("carol", "Gamma")
    edited = str(make_widget("edited", editors=[alice]).uuid)
    viewed = str(make_widget("viewed", editors=[alice], viewers=[bob]).uuid)
    unshared = str(make_widget("unshared").uuid)
    asked = {edited, viewed, unshared, "not-a-uuid"}
    resolver = DatabaseWidgetResolver()

    with override_user(admin):
        assert resolver.placeable(asked) == {edited, viewed, unshared}
    with override_user(alice_user):
        assert resolver.placeable(asked) == {edited, viewed}
    with override_user(bob_user):
        assert resolver.placeable(asked) == {viewed}
    with override_user(carol_user):
        assert resolver.placeable(asked) == set()


def test_guests_can_place_nothing(
    make_user: MakeUser, make_widget: MakeWidget, mocker: MockerFixture
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    widget = str(make_widget("edited", editors=[alice]).uuid)
    mocker.patch.object(security_manager, "is_guest_user", return_value=True)

    with override_user(alice_user):
        assert DatabaseWidgetResolver().placeable({widget}) == set()


def test_rendering_lookups_are_not_filtered(
    make_user: MakeUser, make_widget: MakeWidget
) -> None:
    """
    Types and content resolve for any widget id: they are only asked for
    placements of a canvas the caller already reads, and a canvas grants read
    on what it places.
    """
    carol_user, _ = make_user("carol", "Gamma")
    row = make_widget("unshared", widget_type="metric-tile", props={"title": "Revenue"})
    widget = str(row.uuid)
    resolver = DatabaseWidgetResolver()

    with override_user(carol_user):
        assert resolver.placeable({widget}) == set()
        assert resolver.widget_types({widget, "not-a-uuid"}) == {widget: "metric-tile"}
        stored = resolver.widgets({widget})[widget]
    assert (stored.widget_type, stored.name, stored.props, stored.revision) == (
        "metric-tile",
        "unshared",
        {"title": "Revenue"},
        row.revision,
    )


def test_editable_is_editors_and_admins_only(
    make_user: MakeUser, make_widget: MakeWidget
) -> None:
    admin, _ = make_user("admin", "Admin")
    alice_user, alice = make_user("alice", "Gamma")
    bob_user, bob = make_user("bob", "Gamma")
    widget = str(make_widget("shared", editors=[alice], viewers=[bob]).uuid)
    resolver = DatabaseWidgetResolver()

    with override_user(admin):
        assert resolver.editable({widget}) == {widget}
    with override_user(alice_user):
        assert resolver.editable({widget}) == {widget}
    with override_user(bob_user):
        assert resolver.editable({widget}) == set()
