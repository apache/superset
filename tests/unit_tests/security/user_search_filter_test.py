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


def test_user_search_filter_empty_value_returns_query_unchanged(
    session: Session,
) -> None:
    """
    An empty search leaves the query unfiltered.
    """
    filter_ = UserSearchFilter("username", SQLAInterface(User))
    query = session.query(User)
    assert filter_.apply(query, "") is query


def test_superset_user_api_registers_user_search_filter() -> None:
    """
    The users list API exposes the search filter on the username column.
    """
    assert SupersetUserApi.search_filters == {"username": [UserSearchFilter]}
