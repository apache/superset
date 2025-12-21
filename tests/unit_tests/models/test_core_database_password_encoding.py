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

"""Unit tests for database password encoding in sqlalchemy_uri_decrypted."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.engine.url import make_url

from superset.models.core import Database


def _create_db_with_password(password: str | None) -> Database:
    """Helper to create a Database with a password."""
    return Database(
        database_name="test_db",
        sqlalchemy_uri="postgresql://user@localhost:5432/testdb",
        password=password,
    )


@patch("superset.models.core.has_app_context")
def test_password_with_percent_literal(mock_has_app_context: MagicMock) -> None:
    """Test password with literal percent character."""
    mock_has_app_context.return_value = False
    password = "pass%123"  # noqa: S105

    db = _create_db_with_password(password)
    decrypted_uri = db.sqlalchemy_uri_decrypted
    parsed = make_url(decrypted_uri)

    assert parsed.password == password


@patch("superset.models.core.has_app_context")
def test_password_with_single_percent(mock_has_app_context: MagicMock) -> None:
    """Test password with single percent."""
    mock_has_app_context.return_value = False
    password = "%"  # noqa: S105

    db = _create_db_with_password(password)
    decrypted_uri = db.sqlalchemy_uri_decrypted
    parsed = make_url(decrypted_uri)

    assert parsed.password == password


@patch("superset.models.core.has_app_context")
@pytest.mark.parametrize(
    "password",
    [
        "p@ss!word",  # noqa: S105
        "pass#word",  # noqa: S105
        "pass&word",  # noqa: S105
        "pass:word",  # noqa: S105
        "pass/word",  # noqa: S105
        "pass?word",  # noqa: S105
        "pass=word",  # noqa: S105
        "p@ss%w0rd",  # noqa: S105
        "p@ss%25",  # noqa: S105
    ],
)
def test_password_with_special_chars(
    mock_has_app_context: MagicMock, password: str
) -> None:
    """Test password with various special characters."""
    mock_has_app_context.return_value = False

    db = _create_db_with_password(password)
    decrypted_uri = db.sqlalchemy_uri_decrypted
    parsed = make_url(decrypted_uri)

    assert parsed.password == password


@patch("superset.models.core.has_app_context")
def test_password_empty(mock_has_app_context: MagicMock) -> None:
    """Test empty password handling."""
    mock_has_app_context.return_value = False
    db = _create_db_with_password("")
    decrypted_uri = db.sqlalchemy_uri_decrypted
    parsed = make_url(decrypted_uri)

    assert parsed.password in ("", None)


@patch("superset.models.core.has_app_context")
def test_password_none(mock_has_app_context: MagicMock) -> None:
    """Test None password handling."""
    mock_has_app_context.return_value = False
    db = _create_db_with_password(None)
    decrypted_uri = db.sqlalchemy_uri_decrypted
    parsed = make_url(decrypted_uri)

    assert parsed.password is None or parsed.password == ""


@patch("superset.models.core.has_app_context")
def test_roundtrip_invariant(mock_has_app_context: MagicMock) -> None:
    """Test password survives roundtrip."""
    mock_has_app_context.return_value = False
    original_password = "my%pass@host:8080"  # noqa: S105

    db = _create_db_with_password(original_password)
    decrypted_uri = db.sqlalchemy_uri_decrypted
    parsed = make_url(decrypted_uri)

    assert parsed.password == original_password


@patch("superset.models.core.has_app_context")
def test_uri_with_username_and_password(mock_has_app_context: MagicMock) -> None:
    """Test URI construction with username and password."""
    mock_has_app_context.return_value = False
    password = "pass%word"  # noqa: S105

    db = Database(
        database_name="test_db",
        sqlalchemy_uri="postgresql://user@localhost:5432/testdb",
        password=password,
    )

    decrypted_uri = db.sqlalchemy_uri_decrypted
    parsed = make_url(decrypted_uri)

    assert parsed.password == password
    assert parsed.username == "user"
    assert parsed.host == "localhost"
    assert parsed.database == "testdb"


@patch("superset.models.core.has_app_context")
@patch("superset.models.core.app")
def test_with_app_context_no_custom_store(
    mock_app: MagicMock, mock_has_app_context: MagicMock
) -> None:
    """Test password handling with app context, no custom store."""
    mock_has_app_context.return_value = True
    mock_app.config = {"SQLALCHEMY_CUSTOM_PASSWORD_STORE": None}

    password = "test%pass"  # noqa: S105
    db = Database(
        database_name="test_db",
        sqlalchemy_uri="postgresql://user@localhost:5432/testdb",
        password=password,
    )

    decrypted_uri = db.sqlalchemy_uri_decrypted
    parsed = make_url(decrypted_uri)

    assert parsed.password == password


@patch("superset.models.core.has_app_context")
@patch("superset.models.core.app")
def test_with_app_context_custom_store(
    mock_app: MagicMock, mock_has_app_context: MagicMock
) -> None:
    """Test password handling with custom password store callback."""
    mock_has_app_context.return_value = True

    def custom_store(url: object) -> str:
        return "custom_password"  # noqa: S105

    mock_app.config = {"SQLALCHEMY_CUSTOM_PASSWORD_STORE": custom_store}

    db = Database(
        database_name="test_db",
        sqlalchemy_uri="postgresql://user@localhost:5432/testdb",
        password="original_pass",  # noqa: S105, S106
    )

    decrypted_uri = db.sqlalchemy_uri_decrypted
    parsed = make_url(decrypted_uri)

    assert parsed.password == "custom_password"  # noqa: S105
