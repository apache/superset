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
"""A service account is never offered as an approver, and never is one (S-07).

SOW 5.4 asks for hidden and machine users to be kept out of the approver
list. Superset has no notion of a machine user, so the instance names one:
whichever role it puts its service accounts in.

The other half matters more than the list. ``eligible_approvers`` filtered on
``active`` and ``can_approve`` did not, so a deactivated editor never appeared
as an option yet could still approve through the API. Both now read one
predicate, and that is what these tests hold in place.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import eligibility
from pytest_mock import MockerFixture
from sqlalchemy import update
from sqlalchemy.orm.session import Session


def _users(session: Session) -> list[Any]:
    """Four accounts covering every answer the predicate can give."""
    from flask_appbuilder.security.sqla.models import Role, User

    User.metadata.create_all(session.get_bind())
    robots = Role(name="Robots")
    people = Role(name="Editors")
    accounts = [
        User(
            username="alex",
            first_name="Alex",
            last_name="Diaz",
            email="alex@example.com",
            active=True,
            roles=[people],
        ),
        User(
            username="priya",
            first_name="Priya",
            last_name="Rao",
            email="priya@example.com",
            roles=[people],
        ),
        User(
            username="sam_left",
            first_name="Sam",
            last_name="Lee",
            email="sam@example.com",
            active=False,
            roles=[people],
        ),
        User(
            username="svc_bot",
            first_name="Service",
            last_name="Bot",
            email="bot@example.com",
            active=True,
            roles=[robots],
        ),
    ]
    session.add_all(accounts)
    session.flush()
    # ``active`` is nullable with a Python-side default of True, so the ORM
    # cannot produce a null: one only arrives from a direct write or an
    # older schema. Written that way here, because what a null means is a
    # decision this code has to make either way.
    session.execute(
        update(User.__table__)
        .where(User.__table__.c.username == "priya")
        .values(active=None)
    )
    session.expire_all()
    return accounts


@pytest.fixture
def robots_are_machines(mocker: MockerFixture) -> None:
    """One source for both paths, which is the point of the fixture."""
    mocker.patch.object(eligibility, "machine_user_roles", return_value={"Robots"})


def test_the_list_and_the_check_give_the_same_answer(
    mocker: MockerFixture, session: Session, robots_are_machines: None
) -> None:
    """The SQL filter and the Python predicate must not drift apart.

    One is what the request dialog lists; the other is what the approve route
    enforces. A difference between them is either an approver who cannot be
    chosen or one who was never offered and can act anyway.
    """
    from flask_appbuilder.security.sqla.models import User

    _users(session)

    by_filter = {
        user.username
        for user in eligibility.only_eligible_accounts(session.query(User)).all()
    }
    by_predicate = {
        user.username
        for user in session.query(User).all()
        if eligibility.is_eligible_approver(user)
    }

    assert by_filter == by_predicate == {"alex"}


def test_with_no_machine_roles_configured_only_active_is_asked(
    mocker: MockerFixture, session: Session
) -> None:
    """The shipped default keeps today's behaviour: active, and nothing else."""
    from flask_appbuilder.security.sqla.models import User

    mocker.patch.object(eligibility, "machine_user_roles", return_value=set())
    _users(session)

    assert {
        user.username
        for user in eligibility.only_eligible_accounts(session.query(User)).all()
    } == {"alex", "svc_bot"}


# --------------------------------------------------------- can_approve itself


def _approver(mocker: MockerFixture, user: Any) -> None:
    """Everything can_approve asks, other than the account's own state."""
    mocker.patch.object(
        eligibility, "security_manager", SimpleNamespace(is_guest_user=lambda: False)
    )
    mocker.patch.object(eligibility, "is_strict_editor", return_value=True)
    mocker.patch.object(eligibility, "holds_approval_permission", return_value=True)
    mocker.patch.object(eligibility, "load_user", return_value=user)


@pytest.mark.parametrize(
    "active,roles,approves",
    [
        (True, ["Editors"], True),
        (None, ["Editors"], False),
        (False, ["Editors"], False),
        (True, ["Robots"], False),
        (True, ["Editors", "Robots"], False),
    ],
)
def test_the_approve_path_asks_the_same_two_questions(
    mocker: MockerFixture,
    robots_are_machines: None,
    active: bool | None,
    roles: list[str],
    approves: bool,
) -> None:
    user = SimpleNamespace(
        id=9, active=active, roles=[SimpleNamespace(name=name) for name in roles]
    )
    _approver(mocker, user)
    request = SimpleNamespace(id=1, author_fk=7, command_args={})

    assert (
        eligibility.can_approve(request, SimpleNamespace(id=42), 9) is approves
    )


def test_a_user_who_has_gone_away_cannot_approve(
    mocker: MockerFixture, robots_are_machines: None
) -> None:
    """A deleted account is refused rather than treated as a stranger."""
    _approver(mocker, None)
    request = SimpleNamespace(id=1, author_fk=7, command_args={})

    assert eligibility.can_approve(request, SimpleNamespace(id=42), 9) is False


# ------------------------------------------------------------- reading config


def test_the_roles_come_from_config(mocker: MockerFixture) -> None:
    mocker.patch(
        "flask.current_app",
        SimpleNamespace(
            config={eligibility.MACHINE_USER_ROLES_CONFIG: ["Robots", " Daemons "]}
        ),
    )

    assert eligibility.machine_user_roles() == {"Robots", "Daemons"}


@pytest.mark.parametrize("configured", [None, [], ["", "  "]])
def test_nothing_configured_names_no_machine_roles(
    mocker: MockerFixture, configured: Any
) -> None:
    mocker.patch(
        "flask.current_app",
        SimpleNamespace(config={eligibility.MACHINE_USER_ROLES_CONFIG: configured}),
    )

    assert eligibility.machine_user_roles() == set()
