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
"""The capture path stays quiet only for the pre-migration missing-table
race; every other operational failure must classify as loggable. These
tests pin the driver-specific shapes the predicate reads, per supported
metadata database."""

from typing import Any

import pytest
from sqlalchemy.exc import OperationalError, ProgrammingError

from superset.versioning.db_errors import (
    is_lock_contention_error,
    is_missing_table_error,
)


class _FakeDriverError(Exception):
    """Stands in for a DBAPI driver exception, carrying whichever
    attributes the real driver would set."""

    def __init__(self, *args: Any, **attrs: Any) -> None:
        super().__init__(*args)
        for name, value in attrs.items():
            setattr(self, name, value)


def _wrap(
    exc_cls: type, driver_error: Exception
) -> OperationalError | ProgrammingError:
    return exc_cls("SELECT 1", {}, driver_error)


def test_postgres_undefined_table_is_missing_table() -> None:
    # psycopg2 stamps pgcode; UndefinedTable is SQLSTATE 42P01.
    error = _wrap(
        ProgrammingError,
        _FakeDriverError('relation "version_changes" does not exist', pgcode="42P01"),
    )
    assert is_missing_table_error(error) is True


def test_postgres_deadlock_is_not_missing_table() -> None:
    # Deadlock is SQLSTATE 40P01 — same OperationalError class on the
    # SQLAlchemy side, and the case the old class-based swallow lost.
    error = _wrap(
        OperationalError,
        _FakeDriverError("deadlock detected", pgcode="40P01"),
    )
    assert is_missing_table_error(error) is False


def test_psycopg3_sqlstate_spelling_is_recognized() -> None:
    # psycopg 3 exposes the code as `sqlstate`, not `pgcode`; a driver
    # swap must not silently widen the swallow back to the whole class.
    error = _wrap(
        ProgrammingError,
        _FakeDriverError('relation "version_changes" does not exist', sqlstate="42P01"),
    )
    assert is_missing_table_error(error) is True


def test_mysql_no_such_table_is_missing_table() -> None:
    # mysqlclient raises with (errno, message) args; 1146 is
    # "Table ... doesn't exist".
    error = _wrap(
        ProgrammingError,
        _FakeDriverError(1146, "Table 'superset.version_changes' doesn't exist"),
    )
    assert is_missing_table_error(error) is True


def test_mysql_lock_wait_timeout_is_not_missing_table() -> None:
    error = _wrap(
        OperationalError,
        _FakeDriverError(1205, "Lock wait timeout exceeded"),
    )
    assert is_missing_table_error(error) is False


def test_sqlite_no_such_table_is_missing_table() -> None:
    # SQLite's OperationalError carries no code; the message is the signal.
    error = _wrap(OperationalError, _FakeDriverError("no such table: version_changes"))
    assert is_missing_table_error(error) is True


def test_sqlite_locked_database_is_not_missing_table() -> None:
    error = _wrap(OperationalError, _FakeDriverError("database is locked"))
    assert is_missing_table_error(error) is False


def test_connection_drop_with_no_code_is_not_missing_table() -> None:
    # A dropped connection often surfaces with no driver code at all.
    error = _wrap(
        OperationalError,
        _FakeDriverError("server closed the connection unexpectedly"),
    )
    assert is_missing_table_error(error) is False


# ---------------------------------------------------------------------------
# is_lock_contention_error (sc-120050)
# ---------------------------------------------------------------------------


def _op_error(orig: object) -> OperationalError:
    err = OperationalError("stmt", None, Exception("boom"))
    err.orig = orig
    return err


class _Orig:
    def __init__(self, args=(), pgcode=None, sqlstate=None):
        self.args = args
        if pgcode is not None:
            self.pgcode = pgcode
        if sqlstate is not None:
            self.sqlstate = sqlstate


@pytest.mark.parametrize(
    "orig",
    [
        _Orig(args=(1213, "Deadlock found when trying to get lock")),
        _Orig(args=(1205, "Lock wait timeout exceeded")),
        _Orig(pgcode="40001"),
        _Orig(pgcode="40P01"),
        _Orig(pgcode="55P03"),
        _Orig(sqlstate="40P01"),
    ],
)
def test_lock_contention_positive(orig: _Orig) -> None:
    assert is_lock_contention_error(_op_error(orig)) is True


def test_lock_contention_text_fallback() -> None:
    err = OperationalError("deadlock detected somewhere", None, Exception())
    err.orig = None
    assert is_lock_contention_error(err) is True


@pytest.mark.parametrize(
    "orig",
    [
        _Orig(args=(1146, "Table does not exist")),
        _Orig(args=()),
        _Orig(pgcode="42P01"),
        None,
    ],
)
def test_lock_contention_negative(orig: object) -> None:
    assert is_lock_contention_error(_op_error(orig)) is False


def test_lock_contention_none_input() -> None:
    assert is_lock_contention_error(None) is False
