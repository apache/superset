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
"""The baseline shadow-row probe classifies its failures the same way the
change-record listener does: the missing-table migration race stays
silent, everything else is logged and counted. These tests make the
classify-then-log branch deletion-proof — without them, removing the log
or the metric fails nothing."""

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

from sqlalchemy.exc import OperationalError

from superset.versioning.baseline import collection


def _session_raising(error: Exception) -> MagicMock:
    session = MagicMock()
    session.connection.side_effect = error
    return session


def _probe(session: MagicMock) -> Any:
    return collection.shadow_row_count(
        session, SimpleNamespace(id=7, uuid=uuid4()), version_table=MagicMock()
    )


def test_missing_table_probe_stays_silent(mocker: Any) -> None:
    log_spy = mocker.patch.object(collection.logger, "exception")
    metric_spy = mocker.patch.object(collection, "incr_capture_error")
    error = OperationalError("SELECT", {}, Exception("no such table: slices_version"))

    assert _probe(_session_raising(error)) is None
    log_spy.assert_not_called()
    metric_spy.assert_not_called()


def test_transient_probe_failure_is_logged_and_counted(mocker: Any) -> None:
    # A deadlock here returns None and the caller skips baseline capture
    # for the flush — that loss must be visible, not filed under the
    # migration race.
    log_spy = mocker.patch.object(collection.logger, "exception")
    metric_spy = mocker.patch.object(collection, "incr_capture_error")
    error = OperationalError("SELECT", {}, Exception("database is locked"))

    assert _probe(_session_raising(error)) is None
    log_spy.assert_called_once()
    metric_spy.assert_called_once_with("shadow_count")


def test_unexpected_probe_failure_is_logged_and_counted(mocker: Any) -> None:
    log_spy = mocker.patch.object(collection.logger, "exception")
    metric_spy = mocker.patch.object(collection, "incr_capture_error")

    assert _probe(_session_raising(RuntimeError("boom"))) is None
    log_spy.assert_called_once()
    metric_spy.assert_called_once_with("shadow_count")
