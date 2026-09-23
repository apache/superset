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
from sqlalchemy.exc import DataError, OperationalError, ProgrammingError, StatementError

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


def _op_error(orig: BaseException | None) -> OperationalError:
    err: OperationalError = OperationalError("stmt", None, Exception("boom"))
    err.orig = orig
    return err


class _FakeLockDriverError(Exception):  # noqa: N818 — a driver error, not ours
    """A stand-in for a DBAPI driver error.

    A real driver error IS an exception carrying its own diagnostic, so
    the fake is one too: the classifier reads ``args`` / ``pgcode`` /
    ``sqlstate`` and, for code-less drivers, ``str()`` of THIS object —
    never of the SQLAlchemy wrapper around it.
    """

    def __init__(
        self,
        args: tuple[object, ...] = (),
        pgcode: str | None = None,
        sqlstate: str | None = None,
        message: str = "",
    ) -> None:
        super().__init__(*args)
        self.args: tuple[object, ...] = args
        self._message: str = message
        if pgcode is not None:
            self.pgcode: str = pgcode
        if sqlstate is not None:
            self.sqlstate: str = sqlstate

    def __str__(self) -> str:
        return self._message or super().__str__()


#: Statement prefix for the contamination fixtures; the lock phrase is
#: appended as a trailing SQL comment.
_CONTAMINATED_SQL: str = (
    "INSERT INTO slices (slice_name, description) "
    "VALUES (%(slice_name)s, %(description)s) -- "
)


def _contaminated_statement(phrase: str) -> tuple[str, dict[str, str]]:
    """SQL + bound parameters that merely CONTAIN a contention phrase.

    The realistic shape: a user naming a chart "deadlock analysis", or a
    column literally called ``lock_wait_timeout``. ``str()`` of a
    SQLAlchemy wrapper renders both, which is why the classifier must
    read the driver diagnostic instead.
    """
    # The phrase rides BOTH halves a wrapper renders: a trailing SQL
    # comment (stands in for a table or column whose name contains it)
    # and a bound parameter (a user-supplied chart name). Inert fixture
    # text — nothing here is ever executed.
    statement: str = _CONTAMINATED_SQL + phrase
    return statement, {"slice_name": f"{phrase} analysis", "description": phrase}


@pytest.mark.parametrize(
    "orig",
    [
        _FakeLockDriverError(args=(1213, "Deadlock found when trying to get lock")),
        _FakeLockDriverError(args=(1205, "Lock wait timeout exceeded")),
        _FakeLockDriverError(
            args=(1213, "Deadlock found when trying to get lock"), sqlstate="40001"
        ),
        _FakeLockDriverError(
            args=(1205, "Lock wait timeout exceeded"), sqlstate="HY000"
        ),
        _FakeLockDriverError(pgcode="40001"),
        _FakeLockDriverError(pgcode="40P01"),
        _FakeLockDriverError(pgcode="55P03"),
        _FakeLockDriverError(sqlstate="40P01"),
    ],
)
def test_lock_contention_positive(orig: _FakeLockDriverError) -> None:
    assert is_lock_contention_error(_op_error(orig)) is True


@pytest.mark.parametrize(
    "message",
    [
        "deadlock detected somewhere",
        "Lock wait timeout exceeded; try restarting transaction",
        # SQLite write contention carries no error code at all -- only
        # these message texts. The integration suite runs on SQLite, so
        # misclassifying them would route a genuine contention test to
        # the 500/422 paths instead of the 409.
        "database is locked",
        "database table is locked: table_versions",
    ],
)
def test_lock_contention_driver_message_fallback(message: str) -> None:
    """Code-less drivers are classified on THEIR OWN message.

    The message rides the driver error, not the wrapper's statement
    argument: that is the only place the classifier is allowed to look.
    """
    assert (
        is_lock_contention_error(_op_error(_FakeLockDriverError(message=message)))
        is True
    )


@pytest.mark.parametrize(
    "phrase", ["deadlock", "lock wait timeout", "database is locked"]
)
@pytest.mark.parametrize("wrapper_cls", [DataError, OperationalError])
def test_lock_phrase_in_sql_or_parameters_is_not_contention(
    phrase: str, wrapper_cls: type[StatementError]
) -> None:
    """A contention phrase in the SQL or bound parameters is not evidence.

    sc-120050 review (Richard Fogaça): ``str(DBAPIError)`` appends the
    statement and its parameters, so classifying on the wrapper turned an
    unrelated failure — a chart named "deadlock analysis" — into a 409
    telling the client to retry a request that can never succeed.
    """
    statement: str
    params: dict[str, str]
    statement, params = _contaminated_statement(phrase)
    err: StatementError = wrapper_cls(
        statement,
        params,
        _FakeLockDriverError(args=(1064, "You have an error in your SQL syntax")),
    )
    assert phrase in str(err).lower(), "fixture must contaminate the rendered text"
    assert is_lock_contention_error(err) is False


def test_structured_code_beats_a_contaminated_driver_message() -> None:
    """A non-contention structured code ENDS classification.

    Even when the driver's own message mentions a deadlock (e.g. a
    syntax error in a statement that references a table named
    ``deadlock_audit``), a decisive errno that is not a contention code
    means this is not a lock race.
    """
    orig: _FakeLockDriverError = _FakeLockDriverError(
        args=(1064, "syntax error near 'deadlock_audit'"),
        message="syntax error near 'deadlock_audit'",
    )
    assert is_lock_contention_error(_op_error(orig)) is False


def test_non_contention_sqlstate_beats_a_contaminated_driver_message() -> None:
    orig: _FakeLockDriverError = _FakeLockDriverError(
        pgcode="42P01", message='relation "deadlock_audit" does not exist'
    )
    assert is_lock_contention_error(_op_error(orig)) is False


def test_wrapper_without_a_driver_error_is_not_contention() -> None:
    """No driver diagnostic means nothing classifiable — and the
    wrapper's own text is exactly what must not be read."""
    err: OperationalError = OperationalError(
        "SELECT * FROM deadlock_audit", None, Exception()
    )
    err.orig = None
    assert is_lock_contention_error(err) is False


def test_raw_driver_error_is_classified_on_itself() -> None:
    """A bare driver exception (no SQLAlchemy wrapper) is its own
    diagnostic — the classifier accepts it unchanged."""
    assert (
        is_lock_contention_error(_FakeLockDriverError(args=(1213, "Deadlock found")))
        is True
    )
    assert (
        is_lock_contention_error(_FakeLockDriverError(message="database is locked"))
        is True
    )


@pytest.mark.parametrize(
    "orig",
    [
        _FakeLockDriverError(args=(1146, "Table does not exist")),
        _FakeLockDriverError(args=()),
        _FakeLockDriverError(pgcode="42P01"),
        None,
    ],
)
def test_lock_contention_negative(orig: BaseException | None) -> None:
    assert is_lock_contention_error(_op_error(orig)) is False


def test_lock_contention_none_input() -> None:
    assert is_lock_contention_error(None) is False
