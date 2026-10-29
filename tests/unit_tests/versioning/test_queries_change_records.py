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
"""The change-record read path fails open to an empty dict, but only the
missing-table migration race may do so silently — a transient failure
renders every affected save as an empty change list and must leave a log
line. These tests make that branch deletion-proof."""

from typing import Any
from unittest.mock import MagicMock

import sqlalchemy as sa

from superset.versioning import queries


def _db_raising(mocker: Any, error: Exception) -> None:
    db_mock = MagicMock()
    db_mock.session.connection.side_effect = error
    mocker.patch.object(queries, "db", db_mock)


def test_missing_table_read_stays_silent(mocker: Any) -> None:
    log_spy = mocker.patch.object(queries.logger, "exception")
    _db_raising(
        mocker,
        sa.exc.OperationalError(
            "SELECT", {}, Exception("no such table: version_changes")
        ),
    )

    result = queries.list_change_records_batch("chart", 1, [10, 11])
    assert result == {}
    log_spy.assert_not_called()


def test_transient_read_failure_is_logged(mocker: Any) -> None:
    # Recoverable on refresh, but it must not masquerade as the
    # migration race.
    log_spy = mocker.patch.object(queries.logger, "exception")
    _db_raising(
        mocker,
        sa.exc.OperationalError("SELECT", {}, Exception("database is locked")),
    )

    result = queries.list_change_records_batch("chart", 1, [10, 11])
    assert result == {}
    log_spy.assert_called_once()
