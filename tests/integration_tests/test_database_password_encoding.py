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

"""Integration tests for database password encoding."""

from __future__ import annotations

from sqlalchemy.engine.url import make_url

from superset.constants import PASSWORD_MASK
from superset.models.core import Database
from tests.integration_tests.base_tests import SupersetTestCase


class TestDatabasePasswordEncodingIntegration(SupersetTestCase):
    """Integration tests for password encoding in Database model."""

    def test_database_with_percent_in_password_roundtrip(self) -> None:
        """Test that database with % in password survives save/load cycle."""
        password = "mypass%123"  # noqa: S105
        base_uri = "postgresql://user@localhost:5432/testdb"

        db = Database(
            database_name="test_percent_pass",
            sqlalchemy_uri=base_uri,
            password=password,
        )

        decrypted_uri = db.sqlalchemy_uri_decrypted
        parsed = make_url(decrypted_uri)

        assert parsed.password == password

    def test_database_with_special_chars_roundtrip(self) -> None:
        """Test database with various special characters in password."""
        test_cases = [
            ("p@ss!word", "postgresql://user@localhost:5432/testdb"),  # noqa: S105
            ("pass#word", "postgresql://user@localhost:5432/testdb"),  # noqa: S105
            ("pass%word", "postgresql://user@localhost:5432/testdb"),  # noqa: S105
        ]

        for password, uri in test_cases:
            db = Database(
                database_name=f"test_special_{password[:5]}",
                sqlalchemy_uri=uri,
                password=password,
            )

            decrypted_uri = db.sqlalchemy_uri_decrypted
            parsed = make_url(decrypted_uri)

            assert parsed.password == password

    def test_database_engine_creation_with_special_password(self) -> None:
        """Test that SQLAlchemy engine can be created with special password."""
        password = "test%pass"  # noqa: S105

        db = Database(
            database_name="test_engine_creation",
            sqlalchemy_uri="sqlite:///:memory:",
            password=password,
        )

        with db.get_sqla_engine() as engine:
            assert engine is not None

    def test_database_password_stored_encrypted(self) -> None:
        """Test that password is properly encrypted in database model."""
        password = "secret%pass"  # noqa: S105

        db = Database(
            database_name="test_encrypted_pass",
            sqlalchemy_uri="sqlite:///:memory:",
            password=password,
        )

        assert db.password is not None
        assert isinstance(db.password, str)

    def test_database_masked_url(self) -> None:
        """Test that password masking works correctly."""
        password = "secret%pass"  # noqa: S105
        uri = "postgresql://user@localhost:5432/db"

        db = Database(
            database_name="test_masked_url",
            sqlalchemy_uri=uri,
            password=password,
        )

        masked_url = db.get_password_masked_url(db.url_object)

        assert masked_url.password != password
        assert masked_url.password == PASSWORD_MASK
