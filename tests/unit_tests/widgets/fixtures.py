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
"""Shared fixtures for saved widget tests, built on real database rows."""

from collections.abc import Callable
from typing import Any

import pytest
from flask_appbuilder.security.sqla.models import Role, User
from sqlalchemy.orm.session import Session

from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.widgets.models import Widget

MakeUser = Callable[..., tuple[User, Subject]]
MakeWidget = Callable[..., Widget]
Login = Callable[[User], None]


@pytest.fixture
def tables(session: Session) -> Session:
    """Create every table in the in-memory database used by ``session``."""
    Widget.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    return session


@pytest.fixture
def make_user(tables: Session) -> MakeUser:
    """Create a user with the given roles, plus the user's USER-type subject."""

    def _make_user(username: str, *role_names: str) -> tuple[User, Subject]:
        roles = []
        for role_name in role_names:
            role = tables.query(Role).filter_by(name=role_name).one_or_none()
            roles.append(role or Role(name=role_name))
        user = User(
            username=username,
            first_name=username,
            last_name="User",
            email=f"{username}@example.com",
            active=True,
            roles=roles,
        )
        tables.add(user)
        tables.flush()
        subject = Subject(label=username, type=SubjectType.USER, user_id=user.id)
        tables.add(subject)
        tables.flush()
        return user, subject

    return _make_user


@pytest.fixture
def make_widget(tables: Session) -> MakeWidget:
    """Create a saved widget with the given editors and viewers."""

    def _make_widget(
        name: str,
        editors: list[Subject] | None = None,
        viewers: list[Subject] | None = None,
        **attributes: Any,
    ) -> Widget:
        widget = Widget(
            widget_type=attributes.pop("widget_type", "markdown"),
            name=name,
            props=attributes.pop("props", {"content": name}),
            editors=editors or [],
            viewers=viewers or [],
            **attributes,
        )
        tables.add(widget)
        tables.flush()
        return widget

    return _make_widget
