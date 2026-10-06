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
from typing import Optional

import pytest
from sqlalchemy.engine.url import make_url

from superset.exceptions import SupersetSecurityException
from superset.security.analytics_db_safety import check_sqlalchemy_uri
from tests.integration_tests.test_app import app


@pytest.fixture
def allowed_dialects():
    """Temporarily override ALLOWED_UNSAFE_DB_DIALECTS, restoring it afterwards."""

    def _set(dialects: set[str]):
        app.config["ALLOWED_UNSAFE_DB_DIALECTS"] = dialects

    sentinel = object()
    original = app.config.get("ALLOWED_UNSAFE_DB_DIALECTS", sentinel)
    try:
        with app.app_context():
            yield _set
    finally:
        if original is sentinel:
            app.config.pop("ALLOWED_UNSAFE_DB_DIALECTS", None)
        else:
            app.config["ALLOWED_UNSAFE_DB_DIALECTS"] = original


@pytest.mark.parametrize(
    "sqlalchemy_uri, error, error_message",
    [
        ("postgres://user:password@test.com", False, None),
        (
            "sqlite:///home/superset/bad.db",
            True,
            "SQLiteDialect_pysqlite cannot be used as a data source for security reasons.",  # noqa: E501
        ),
        (
            "sqlite+pysqlite:///home/superset/bad.db",
            True,
            "SQLiteDialect_pysqlite cannot be used as a data source for security reasons.",  # noqa: E501
        ),
        (
            "sqlite+aiosqlite:///home/superset/bad.db",
            True,
            "SQLiteDialect_pysqlite cannot be used as a data source for security reasons.",  # noqa: E501
        ),
        (
            "sqlite+pysqlcipher:///home/superset/bad.db",
            True,
            "SQLiteDialect_pysqlite cannot be used as a data source for security reasons.",  # noqa: E501
        ),
        (
            "sqlite+:///home/superset/bad.db",
            True,
            "SQLiteDialect_pysqlite cannot be used as a data source for security reasons.",  # noqa: E501
        ),
        (
            "sqlite+new+driver:///home/superset/bad.db",
            True,
            "SQLiteDialect_pysqlite cannot be used as a data source for security reasons.",  # noqa: E501
        ),
        (
            "sqlite+new+:///home/superset/bad.db",
            True,
            "SQLiteDialect_pysqlite cannot be used as a data source for security reasons.",  # noqa: E501
        ),
        (
            "shillelagh:///home/superset/bad.db",
            True,
            "shillelagh cannot be used as a data source for security reasons.",
        ),
        (
            "shillelagh+apsw:///home/superset/bad.db",
            True,
            "shillelagh cannot be used as a data source for security reasons.",
        ),
        (
            "shillelagh+:///home/superset/bad.db",
            True,
            "shillelagh cannot be used as a data source for security reasons.",
        ),
        (
            "shillelagh+something:///home/superset/bad.db",
            True,
            "shillelagh cannot be used as a data source for security reasons.",
        ),
        (
            "shillelagh+csv:///etc/passwd",
            True,
            "shillelagh cannot be used as a data source for security reasons.",
        ),
        (
            "shillelagh+json:///etc/passwd",
            True,
            "shillelagh cannot be used as a data source for security reasons.",
        ),
        (
            "shillelagh+gsheets:///",
            True,
            "shillelagh cannot be used as a data source for security reasons.",
        ),
        (
            "duckdb:///:memory:",
            True,
            "duckdb cannot be used as a data source for security reasons.",
        ),
        (
            "duckdb:////tmp/local.db",
            True,
            "duckdb cannot be used as a data source for security reasons.",
        ),
        (
            "duckdb+duckdb_engine:////tmp/local.db",
            True,
            "duckdb cannot be used as a data source for security reasons.",
        ),
        (
            "duckdb:///md:my_db?motherduck_token=tok",
            True,
            "duckdb cannot be used as a data source for security reasons.",
        ),
    ],
)
def test_check_sqlalchemy_uri(
    sqlalchemy_uri: str, error: bool, error_message: Optional[str]
):
    with app.app_context():
        if error:
            with pytest.raises(SupersetSecurityException) as excinfo:  # noqa: PT012
                check_sqlalchemy_uri(make_url(sqlalchemy_uri))
                assert str(excinfo.value) == error_message
        else:
            check_sqlalchemy_uri(make_url(sqlalchemy_uri))


@pytest.mark.parametrize(
    "sqlalchemy_uri",
    [
        "duckdb:///:memory:",
        "duckdb:////tmp/local.db",
        "duckdb:///md:my_db?motherduck_token=tok",
        "duckdb+duckdb_engine:////tmp/local.db",
    ],
)
def test_allowed_dialect_permits_otherwise_blocked_uri(
    allowed_dialects, sqlalchemy_uri: str
):
    """A dialect added to ALLOWED_UNSAFE_DB_DIALECTS is accepted, including the
    MotherDuck cloud variant and alternative drivers via the base-dialect split."""
    allowed_dialects({"duckdb"})
    check_sqlalchemy_uri(make_url(sqlalchemy_uri))


@pytest.mark.parametrize(
    "sqlalchemy_uri",
    [
        "sqlite:///home/superset/bad.db",
        "shillelagh:///home/superset/bad.db",
    ],
)
def test_allowlist_is_per_dialect(allowed_dialects, sqlalchemy_uri: str):
    """Allowing one dialect does not re-enable the others in the blocklist."""
    allowed_dialects({"duckdb"})
    with pytest.raises(SupersetSecurityException):
        check_sqlalchemy_uri(make_url(sqlalchemy_uri))


def test_empty_allowlist_matches_default_behavior(allowed_dialects):
    """The default (empty) allowlist preserves today's behavior: duckdb is blocked."""
    allowed_dialects(set())
    with pytest.raises(SupersetSecurityException):
        check_sqlalchemy_uri(make_url("duckdb:///:memory:"))


@pytest.mark.parametrize(
    "allowed_entry",
    [
        "DuckDB",  # different case
        "duckdb+duckdb_engine",  # an operator-supplied "+driver" suffix
        "  duckdb  ",  # stray whitespace
    ],
)
def test_allowlist_entry_is_normalized(allowed_dialects, allowed_entry: str):
    """An operator entry opts the dialect in regardless of case, a "+driver"
    suffix or surrounding whitespace, matching how the blocklist treats them."""
    allowed_dialects({allowed_entry})
    check_sqlalchemy_uri(make_url("duckdb:///md:my_db?motherduck_token=tok"))


def test_none_allowlist_matches_default_behavior(allowed_dialects):
    """A ``None`` value is treated as no allowlist rather than erroring."""
    allowed_dialects(None)
    with pytest.raises(SupersetSecurityException):
        check_sqlalchemy_uri(make_url("duckdb:///:memory:"))


def test_allowlist_cannot_relax_superset_meta_db_block(allowed_dialects):
    """The feature-flag-gated ``superset`` meta-database block is not
    allowlistable: listing it must not bypass ENABLE_SUPERSET_META_DB (which is
    off by default in the test app, so the ``superset`` block is active)."""
    allowed_dialects({"superset"})
    with pytest.raises(SupersetSecurityException):
        check_sqlalchemy_uri(make_url("superset://"))
