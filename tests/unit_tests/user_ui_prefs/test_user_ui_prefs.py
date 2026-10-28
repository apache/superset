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
"""Unit tests for user UI preference validators, DAO, and API."""

from __future__ import annotations

from typing import Any

import pytest
from flask_appbuilder.security.sqla.models import User
from pytest_mock import MockerFixture

from superset import db
from superset.daos.user_ui_prefs import UserUiPrefDAO
from superset.models.user_ui_prefs import UserUiPref
from superset.user_ui_prefs.validators import (
    MAX_UI_PREF_VALUE_BYTES,
    validate_ui_pref_key,
    validate_ui_pref_value,
)


@pytest.mark.parametrize(
    "key,expected",
    [
        ("dashboard_workspace_sidebar", None),
        ("a", None),
        ("a" * 64, None),
        ("Bad-Key", "Invalid preference key."),
        ("", "Invalid preference key."),
        ("a" * 65, "Invalid preference key."),
    ],
)
def test_validate_ui_pref_key(key: str, expected: str | None) -> None:
    assert validate_ui_pref_key(key) == expected


def test_validate_ui_pref_value_rejects_non_dict() -> None:
    assert validate_ui_pref_value([]) == "Preference value must be a JSON object."
    assert validate_ui_pref_value("text") == "Preference value must be a JSON object."


def test_validate_ui_pref_value_rejects_oversized_dict() -> None:
    blob = {"x": "y" * MAX_UI_PREF_VALUE_BYTES}
    assert validate_ui_pref_value(blob) == "Preference value exceeds maximum size."


def test_validate_ui_pref_value_accepts_small_dict() -> None:
    assert validate_ui_pref_value({"order": [], "width": 240, "collapsed": False}) is None


@pytest.fixture
def user_ui_prefs_tables(session_engine: Any, get_session: Any) -> None:
    UserUiPref.metadata.create_all(session_engine)  # pylint: disable=no-member
    get_session()


def test_dao_isolation_between_users(
    user_ui_prefs_tables: None,
    get_session: Any,
) -> None:
    get_session()
    value_a = {"order": ["a"], "width": 200, "collapsed": False}
    value_b = {"order": ["b"], "width": 300, "collapsed": True}
    UserUiPrefDAO.upsert_for_user(1, "dashboard_workspace_sidebar", value_a)
    UserUiPrefDAO.upsert_for_user(2, "dashboard_workspace_sidebar", value_b)
    db.session.commit()

    row_a = UserUiPrefDAO.get_for_user(1, "dashboard_workspace_sidebar")
    row_b = UserUiPrefDAO.get_for_user(2, "dashboard_workspace_sidebar")
    assert row_a is not None and row_a.value == value_a
    assert row_b is not None and row_b.value == value_b

    assert UserUiPrefDAO.get_for_user(1, "missing_key") is None


def test_get_pref_returns_null_value(
    client: Any,
    app_context: None,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.user_ui_prefs.api.UserUiPrefDAO.get_for_user",
        return_value=None,
    )
    mocker.patch("superset.user_ui_prefs.api.g").user = User(id=7, username="gamma")

    response = client.get("/api/v1/user_ui_prefs/dashboard_workspace_sidebar")
    assert response.status_code == 200
    assert response.json == {
        "key": "dashboard_workspace_sidebar",
        "value": None,
    }


def test_get_pref_invalid_key(
    client: Any,
    app_context: None,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    mocker.patch("superset.user_ui_prefs.api.g").user = User(id=7, username="gamma")
    response = client.get("/api/v1/user_ui_prefs/not-valid!")
    assert response.status_code == 400


def test_put_pref_persists_value(
    client: Any,
    app_context: None,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    def upsert(user_id: int, key: str, value: dict[str, Any]) -> UserUiPref:
        return UserUiPref(user_id=user_id, key=key, value=value)

    mocker.patch(
        "superset.user_ui_prefs.api.UserUiPrefDAO.upsert_for_user",
        side_effect=upsert,
    )
    mocker.patch("superset.user_ui_prefs.api.g").user = User(id=7, username="gamma")

    body = {"value": {"order": ["d1"], "width": 280, "collapsed": False}}
    response = client.put(
        "/api/v1/user_ui_prefs/dashboard_workspace_sidebar",
        json=body,
    )
    assert response.status_code == 200
    assert response.json == {"key": "dashboard_workspace_sidebar", **body}
