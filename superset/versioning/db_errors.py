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
"""Classify database errors the versioning capture path swallows.

The capture listeners fail open — a versioning bug must never break a
user's save — and one failure is genuinely benign: the versioning tables
not existing yet, during the window between deploying the code and
running its migration. The listeners swallow that case silently.

But the exception classes that case raises (``OperationalError`` on
SQLite/MySQL, ``ProgrammingError`` on PostgreSQL) also cover deadlocks,
lock timeouts, and dropped connections. Swallowing the whole class turns
any of those into a silent capture drop: the user's save succeeds and its
version history quietly doesn't exist. :func:`is_missing_table_error`
separates the benign case from everything else, so the listeners can stay
quiet for the migration race and log-plus-count the rest.
"""

from __future__ import annotations

from sqlalchemy.exc import DBAPIError

#: MySQL/MariaDB deadlock and lock-wait-timeout error codes.
_MYSQL_LOCK_CONTENTION: tuple[int, ...] = (1213, 1205)

#: PostgreSQL SQLSTATEs: serialization_failure, deadlock_detected,
#: lock_not_available.
_PG_LOCK_CONTENTION: tuple[str, ...] = ("40001", "40P01", "55P03")

#: Contention phrases for drivers that carry no structured code at all
#: (SQLite). Matched against the DRIVER's own message only -- never a
#: SQLAlchemy wrapper's rendering, which appends the statement and its
#: bound parameters.
_LOCK_CONTENTION_PHRASES: tuple[str, ...] = (
    "deadlock",
    "lock wait timeout",
    "database is locked",
    "database table is locked",
)


def is_lock_contention_error(exc: BaseException | None) -> bool:
    """Whether *exc* is a database deadlock / lock-wait failure.

    A write that loses a lock race has, by definition, interleaved with a
    concurrent writer. It does NOT prove the caller's ``If-Match`` token
    stale, so response-mapping callers classify it as a retryable
    conflict (409, retry the same request) rather than a 500 -- or a 412,
    whose refetch-the-token guidance would be wrong here.

    Classification reads the DRIVER DIAGNOSTIC, never the SQLAlchemy
    wrapper's rendered text: ``str(DBAPIError)`` appends the failing
    statement and its bound parameters, so an unrelated failure whose
    SQL or values merely contain a lock word (a chart named "deadlock
    analysis", a filter on a column called ``lock_wait_timeout``) would
    be answered "retry the same request" forever.

    A structured code is AUTHORITATIVE where the driver supplies one: a
    MySQL errno or a PostgreSQL SQLSTATE that is not in the contention
    sets ends classification at ``False`` rather than falling through to
    a keyword match. Only code-less drivers reach the phrase check, and
    then only against their own message. Accepts ``None`` (an exception
    with no ``__cause__``) and errors with empty driver args without
    raising.
    """
    if exc is None:
        return False

    orig: object = getattr(exc, "orig", None)
    if orig is None:
        if isinstance(exc, DBAPIError):
            # A wrapper whose driver error was not preserved carries no
            # diagnostic to classify -- and its own text is the
            # statement-and-parameters rendering this function must not
            # read. Unclassifiable is not retryable.
            return False
        # Not a wrapper: a raw driver exception is its own diagnostic.
        diagnostic: object = exc
    else:
        diagnostic = orig

    args: tuple[object, ...] | None = getattr(diagnostic, "args", None)
    if args and isinstance(args[0], int):
        # MySQL-family errno: structured and therefore decisive.
        return args[0] in _MYSQL_LOCK_CONTENTION

    sqlstate: str | None = getattr(diagnostic, "pgcode", None) or getattr(
        diagnostic, "sqlstate", None
    )
    if sqlstate is not None:
        # PostgreSQL SQLSTATE: structured and therefore decisive.
        return sqlstate in _PG_LOCK_CONTENTION

    text: str = str(diagnostic).lower()
    return any(phrase in text for phrase in _LOCK_CONTENTION_PHRASES)


#: PostgreSQL SQLSTATE for "relation does not exist" (undefined_table).
_PG_UNDEFINED_TABLE = "42P01"

#: MySQL/MariaDB error code for "Table ... doesn't exist".
_MYSQL_NO_SUCH_TABLE = 1146


def is_missing_table_error(exc: DBAPIError) -> bool:
    """Whether *exc* is a "table does not exist" error on any supported
    metadata database, as raised during the pre-migration startup race.

    Checks driver error codes first (psycopg2's ``pgcode``, MySQL's
    numeric errno) and falls back to SQLite's message, which is the only
    signal that driver provides. Deliberately narrow: an ambiguous error
    should be logged by the caller, not swallowed — over-reporting is
    recoverable, a silent capture drop is not.
    """
    orig = getattr(exc, "orig", None)

    # PostgreSQL via psycopg2. (psycopg 3 spells it ``sqlstate``; checked
    # too so a driver swap doesn't silently widen the swallow.)
    pgcode = getattr(orig, "pgcode", None) or getattr(orig, "sqlstate", None)
    if pgcode is not None:
        return pgcode == _PG_UNDEFINED_TABLE

    # MySQL/MariaDB drivers put the numeric errno first in args.
    args = getattr(orig, "args", ())
    if args and isinstance(args[0], int):
        return args[0] == _MYSQL_NO_SUCH_TABLE

    # SQLite has no error codes on OperationalError; the message is the
    # documented, stable signal.
    return "no such table" in str(orig if orig is not None else exc).lower()
