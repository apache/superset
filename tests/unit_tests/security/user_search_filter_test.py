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
from collections.abc import Iterator

import pytest
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.sqla.models import User
from sqlalchemy import create_engine
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session, sessionmaker

from superset.security.manager import SupersetUserApi, UserSearchFilter


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite://")
    User.metadata.create_all(engine, tables=[User.__table__])
    session = sessionmaker(bind=engine)()
    session.add_all(
        [
            User(
                username="jsmith",
                first_name="Jane",
                last_name="Smith",
                email="jane@example.com",
                active=True,
            ),
            User(
                username="00f09b2e-f4fb-48a3-80fc-53ccd9528021",
                first_name="Bob",
                last_name="Jones",
                email="bob.jones@corp.example.org",
                active=True,
            ),
            User(
                username="svc_reporting",
                first_name="Service",
                last_name="Account",
                email="svc@example.com",
                active=True,
            ),
            User(
                username="pct%user",
                first_name="Percent",
                last_name="User",
                email="pct@example.com",
                active=True,
            ),
            User(
                username="back\\slash",
                first_name="Backslash",
                last_name="User",
                email="backslash@example.com",
                active=True,
            ),
            User(
                username="nnonesuch",
                first_name="Nora",
                last_name="Nonesuch",
                email="nora@example.com",
                active=True,
            ),
        ]
    )
    session.commit()
    yield session
    session.close()


def _search(session: Session, value: str) -> list[str]:
    filter_ = UserSearchFilter("username", SQLAInterface(User))
    query = filter_.apply(session.query(User), value)
    return sorted(user.username for user in query.all())


@pytest.mark.parametrize(
    "value, expected",
    [
        ("jsmi", ["jsmith"]),
        ("JANE", ["jsmith"]),
        ("jones", ["00f09b2e-f4fb-48a3-80fc-53ccd9528021"]),
        ("Bob Jo", ["00f09b2e-f4fb-48a3-80fc-53ccd9528021"]),
        ("corp.example", ["00f09b2e-f4fb-48a3-80fc-53ccd9528021"]),
        ("00f09b2e", ["00f09b2e-f4fb-48a3-80fc-53ccd9528021"]),
        ("  jane ", ["jsmith"]),
        ("nobody", []),
    ],
)
def test_user_search_filter_matches(
    session: Session, value: str, expected: list[str]
) -> None:
    """
    UserSearchFilter matches username, first/last name, full name and email.
    """
    assert _search(session, value) == expected


@pytest.mark.parametrize(
    "value, expected",
    [
        ("svc_reporting", ["svc_reporting"]),
        ("svc_", ["svc_reporting"]),
        ("_", ["svc_reporting"]),
        ("%", ["pct%user"]),
        ("pct%", ["pct%user"]),
        ("\\", ["back\\slash"]),
        ("back\\s", ["back\\slash"]),
        ("jane%", []),
    ],
)
def test_user_search_filter_treats_like_metacharacters_literally(
    session: Session, value: str, expected: list[str]
) -> None:
    """
    ``%``, ``_`` and ``\\`` in the search term are matched literally, so a
    lone wildcard character cannot turn the search into "match everyone",
    and a user whose username contains one is still found by it.
    """
    assert _search(session, value) == expected


@pytest.mark.parametrize("value", ["", "   "])
def test_user_search_filter_blank_value_matches_everyone(
    session: Session, value: str
) -> None:
    """
    A blank search term is a "contains nothing" match: every user qualifies.

    The frontend omits the filter entirely when the input is blank, so this
    only matters for direct API callers, where it mirrors FAB's ``ct``
    operator.
    """
    assert _search(session, value) == [
        "00f09b2e-f4fb-48a3-80fc-53ccd9528021",
        "back\\slash",
        "jsmith",
        "nnonesuch",
        "pct%user",
        "svc_reporting",
    ]


def test_user_search_filter_none_matches_nobody(session: Session) -> None:
    """
    ``None`` matches no rows, mirroring SQL's ``x LIKE NULL`` and the DAO
    LIKE operators, rather than degrading into an unfiltered listing or a
    search for the text "None" (which would find Nora Nonesuch).
    """
    assert _search(session, None) == []  # type: ignore[arg-type]


def test_user_search_filter_is_case_insensitive_on_postgres(session: Session) -> None:
    """
    Every column is matched with ``ILIKE`` on PostgreSQL.

    SQLite's ``LIKE`` is already case-insensitive, so the case-insensitive
    cases above would still pass if the filter used ``.like()``. Compiling
    against the PostgreSQL dialect pins the operator itself.
    """
    filter_ = UserSearchFilter("username", SQLAInterface(User))
    query = filter_.apply(session.query(User), "jane")
    sql = str(query.statement.compile(dialect=postgresql.dialect()))
    assert sql.count(" ILIKE ") == 5
    assert " LIKE " not in sql.replace(" ILIKE ", " ")


def test_superset_user_api_wires_user_search_filter() -> None:
    """
    A ``user_all_text`` filter on ``username`` resolves through FAB's wiring.

    FAB only attaches ``search_filters[col]`` when ``col`` is one of the API's
    ``search_columns``, so this goes through the same ``Filters`` object the
    list endpoint uses rather than asserting the class attribute alone.
    """
    api = SupersetUserApi()
    filters = api._filters  # pylint: disable=protected-access
    assert UserSearchFilter in filters.get_search_filters()["username"]

    filters.rest_add_filters(
        [{"col": "username", "opr": "user_all_text", "value": "jane"}]
    )
    assert isinstance(filters.filters[0], UserSearchFilter)
    assert filters.values == ["jane"]
