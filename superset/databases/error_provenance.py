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

"""Helpers for identifying SQLAlchemy errors from Database model engines.

The listener covers connection failures and errors raised through SQLAlchemy
Core. Superset executes queries on raw DB-API cursors, so query execution errors
do not pass through this listener.
"""

from __future__ import annotations

from contextlib import suppress

from sqlalchemy.engine import ExceptionContext

_DATABASE_ENGINE_ERROR_MARKER = "_superset_database_engine_error"


def is_database_engine_error(exception: BaseException) -> bool:
    """Return whether SQLAlchemy marked this Database model engine exception.

    A later ``handle_error`` listener may replace the marked exception. Such a
    replacement has its own provenance and is not marked by this helper.
    """

    return getattr(exception, _DATABASE_ENGINE_ERROR_MARKER, False) is True


def mark_database_engine_error(context: ExceptionContext) -> None:
    """Mark the SQLAlchemy exception emitted by a Database model engine."""

    exception = context.sqlalchemy_exception
    if exception is None:
        exception = context.original_exception
    with suppress(Exception):
        setattr(exception, _DATABASE_ENGINE_ERROR_MARKER, True)
