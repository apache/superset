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
"""Tests for the saved widget access filters, using real database rows."""

from flask_appbuilder.security.sqla.models import Role
from flask_login import AnonymousUserMixin
from sqlalchemy.orm.session import Session

from superset.daos.widget import WidgetDAO
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.utils.core import override_user
from tests.unit_tests.widgets.fixtures import MakeUser, MakeWidget


def _visible_names() -> set[str]:
    return {widget.name for widget in WidgetDAO.find_all()}


def test_admin_sees_every_widget(make_user: MakeUser, make_widget: MakeWidget) -> None:
    admin, _ = make_user("admin", "Admin")
    _, alice = make_user("alice", "Gamma")
    make_widget("owned", editors=[alice])
    make_widget("unowned")

    with override_user(admin):
        assert _visible_names() == {"owned", "unowned"}


def test_editors_and_viewers_see_only_their_widgets(
    make_user: MakeUser, make_widget: MakeWidget
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    bob_user, bob = make_user("bob", "Gamma")
    carol_user, _ = make_user("carol", "Gamma")
    make_widget("edited by alice", editors=[alice])
    make_widget("viewed by bob", editors=[alice], viewers=[bob])

    with override_user(alice_user):
        assert _visible_names() == {"edited by alice", "viewed by bob"}
    with override_user(bob_user):
        assert _visible_names() == {"viewed by bob"}
    with override_user(carol_user):
        assert _visible_names() == set()


def test_role_subjects_grant_access(
    tables: Session, make_user: MakeUser, make_widget: MakeWidget
) -> None:
    analyst_user, _ = make_user("analyst", "Gamma", "analysts")
    analysts_role = tables.query(Role).filter_by(name="analysts").one()
    analysts = Subject(
        label="analysts", type=SubjectType.ROLE, role_id=analysts_role.id
    )
    tables.add(analysts)
    tables.flush()
    make_widget("shared with analysts", viewers=[analysts])

    with override_user(analyst_user):
        assert _visible_names() == {"shared with analysts"}


def test_anonymous_users_see_nothing(
    tables: Session, make_user: MakeUser, make_widget: MakeWidget
) -> None:
    # Anonymous users take the Public role, which every deployment has.
    tables.add(Role(name="Public"))
    _, alice = make_user("alice", "Gamma")
    make_widget("edited by alice", editors=[alice])

    with override_user(AnonymousUserMixin()):
        assert _visible_names() == set()
