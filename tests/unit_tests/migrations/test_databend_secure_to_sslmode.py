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
"""Tests for migration ``c4a1b8e2d739_databend_secure_to_sslmode``.

Covers the query-parameter rewrite helper, the full upgrade() path over a
mixture of Databend and non-Databend connections, and the downgrade()
round trip.
"""

from __future__ import annotations

from importlib import import_module
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

migration = import_module(
    "superset.migrations.versions."
    "2026-08-06_00-00_c4a1b8e2d739_databend_secure_to_sslmode"
)

Database = migration.Database
_rewrite_query_parameters = migration._rewrite_query_parameters
_TO_SSLMODE = migration._TO_SSLMODE
_TO_SECURE = migration._TO_SECURE
_DEFAULT = ("sslmode", "disable")

# Superset stores the password as this mask rather than the real credential
MASK = "X" * 10


@pytest.fixture
def engine():
    engine = create_engine("sqlite:///:memory:", future=True)
    migration.Base.metadata.create_all(engine)
    return engine


def _run(migrate, conn) -> None:
    session = Session(bind=conn, future=True)
    with (
        patch.object(migration, "op") as mock_op,
        patch.object(migration, "db") as mock_db,
    ):
        mock_op.get_bind.return_value = conn
        mock_db.Session.return_value = session
        migrate()


@pytest.mark.parametrize(
    "uri,expected",
    [
        (
            f"databend://user:{MASK}@host:8000/db?secure=false",
            f"databend://user:{MASK}@host:8000/db?sslmode=disable",
        ),
        (
            f"databend://user:{MASK}@host:443/db?secure=true",
            f"databend://user:{MASK}@host:443/db?sslmode=require",
        ),
        # databend-py parsed the value as a boolean, so casing carried no meaning
        (
            f"databend://user:{MASK}@host:443/db?secure=True",
            f"databend://user:{MASK}@host:443/db?sslmode=require",
        ),
        # unrelated parameters keep their position and encoding
        (
            f"databend://user:{MASK}@host:8000/db?warehouse=wh&secure=false&presign=on",
            f"databend://user:{MASK}@host:8000/db?warehouse=wh&sslmode=disable&presign=on",
        ),
    ],
)
def test_rewrite_query_parameters_replaces_secure(uri: str, expected: str) -> None:
    assert _rewrite_query_parameters(uri, _TO_SSLMODE, _DEFAULT) == expected


@pytest.mark.parametrize(
    "uri",
    [
        # already migrated
        f"databend://user:{MASK}@host:8000/db?sslmode=disable",
        f"databend://user:{MASK}@host:443/db?sslmode=require",
        # an unrecognised value is left for a human rather than guessed at
        f"databend://user:{MASK}@host:8000/db?secure=maybe",
    ],
)
def test_rewrite_query_parameters_leaves_migrated_uris_alone(uri: str) -> None:
    assert _rewrite_query_parameters(uri, _TO_SSLMODE, _DEFAULT) is None


@pytest.mark.parametrize(
    "uri,expected",
    [
        (
            f"databend://user:{MASK}@host:8000/db",
            f"databend://user:{MASK}@host:8000/db?sslmode=disable",
        ),
        (
            f"databend://user:{MASK}@host:8000/db?warehouse=wh",
            f"databend://user:{MASK}@host:8000/db?warehouse=wh&sslmode=disable",
        ),
    ],
)
def test_rewrite_query_parameters_pins_plaintext_default(
    uri: str, expected: str
) -> None:
    """
    A URI with no TLS parameter was plaintext under databend-py's http default,
    so it needs sslmode=disable to keep behaving that way under the Rust core.
    """
    assert _rewrite_query_parameters(uri, _TO_SSLMODE, _DEFAULT) == expected


def test_rewrite_query_parameters_ignores_question_mark_in_credentials() -> None:
    """
    The credentials are not escaped for ``?``, so the query delimiter has to be
    located after them or the parameters are never found.
    """
    rewritten = _rewrite_query_parameters(
        "databend://user:pa?ss@host:8000/db?secure=false", _TO_SSLMODE, _DEFAULT
    )

    assert rewritten == "databend://user:pa?ss@host:8000/db?sslmode=disable"


def test_upgrade_rewrites_only_databend_connections(engine) -> None:
    with Session(engine, future=True) as seed:
        seed.add_all(
            [
                Database(
                    id=1,
                    sqlalchemy_uri=f"databend://user:{MASK}@host:8000/db?secure=false",
                ),
                Database(
                    id=2,
                    sqlalchemy_uri=f"databend://user:{MASK}@host:443/db?secure=true",
                ),
                # no TLS parameter: plaintext under the old client, so it must
                # be pinned rather than left to the new https default
                Database(id=3, sqlalchemy_uri=f"databend://user:{MASK}@host:8000/db"),
                # a different engine that happens to use the same parameter
                Database(
                    id=4,
                    sqlalchemy_uri=f"clickhousedb://user:{MASK}@host:8443/db?secure=true",
                ),
            ]
        )
        seed.commit()

    with engine.begin() as conn:
        _run(migration.upgrade, conn)

    with Session(engine, future=True) as verify:
        assert (
            verify.get(Database, 1).sqlalchemy_uri
            == f"databend://user:{MASK}@host:8000/db?sslmode=disable"
        )
        assert (
            verify.get(Database, 2).sqlalchemy_uri
            == f"databend://user:{MASK}@host:443/db?sslmode=require"
        )
        assert (
            verify.get(Database, 3).sqlalchemy_uri
            == f"databend://user:{MASK}@host:8000/db?sslmode=disable"
        )
        assert (
            verify.get(Database, 4).sqlalchemy_uri
            == f"clickhousedb://user:{MASK}@host:8443/db?secure=true"
        )


def test_upgrade_is_idempotent(engine) -> None:
    with Session(engine, future=True) as seed:
        seed.add(
            Database(
                id=1, sqlalchemy_uri=f"databend://user:{MASK}@host:8000/db?secure=false"
            )
        )
        seed.commit()

    for _ in range(2):
        with engine.begin() as conn:
            _run(migration.upgrade, conn)

    with Session(engine, future=True) as verify:
        assert (
            verify.get(Database, 1).sqlalchemy_uri
            == f"databend://user:{MASK}@host:8000/db?sslmode=disable"
        )


@pytest.mark.parametrize(
    "uri,expected",
    [
        (
            f"databend://user:{MASK}@host:8000/db?sslmode=disable",
            f"databend://user:{MASK}@host:8000/db?secure=false",
        ),
        (
            f"databend://user:{MASK}@host:443/db?sslmode=require",
            f"databend://user:{MASK}@host:443/db?secure=true",
        ),
        # the driver treats enable as an alias of require
        (
            f"databend://user:{MASK}@host:443/db?sslmode=enable",
            f"databend://user:{MASK}@host:443/db?secure=true",
        ),
    ],
)
def test_downgrade_restores_secure(uri: str, expected: str) -> None:
    assert _rewrite_query_parameters(uri, _TO_SECURE) == expected


def test_downgrade_does_not_add_a_parameter(engine) -> None:
    """
    Only upgrade pins a default; downgrade must leave a bare URI bare rather
    than inventing a secure parameter Superset never wrote.
    """
    assert (
        _rewrite_query_parameters(f"databend://user:{MASK}@host:8000/db", _TO_SECURE)
        is None
    )


def test_round_trip_through_upgrade_and_downgrade(engine) -> None:
    original = f"databend://user:{MASK}@host:8000/db?secure=false"
    with Session(engine, future=True) as seed:
        seed.add(Database(id=1, sqlalchemy_uri=original))
        seed.commit()

    with engine.begin() as conn:
        _run(migration.upgrade, conn)
    with engine.begin() as conn:
        _run(migration.downgrade, conn)

    with Session(engine, future=True) as verify:
        assert verify.get(Database, 1).sqlalchemy_uri == original
