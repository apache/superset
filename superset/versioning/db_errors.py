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
