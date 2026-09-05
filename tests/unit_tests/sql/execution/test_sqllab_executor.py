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
# pylint: disable=unused-argument

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.exceptions import SupersetErrorException
from superset.sql.execution.sqllab_executor import execute_sql_lab_query
from tests.conftest import with_config

_MODULE = "superset.sql.execution.sqllab_executor"


class _FailingBackend:  # pylint: disable=too-few-public-methods
    """A results backend whose write always fails (truthy object, ``set`` False)."""

    def set(self, *args: object, **kwargs: object) -> bool:
        return False


_CONFIG = {
    "SQLLAB_PAYLOAD_MAX_MB": 50,
    "DISALLOWED_SQL_FUNCTIONS": {},
    "DISALLOWED_SQL_TABLES": {},
    "SQLLAB_CTAS_NO_LIMIT": False,
    "SQL_MAX_ROW": 100000,
    "QUERY_LOGGER": None,
    "TROUBLESHOOTING_LINK": None,
    "STATS_LOGGER": MagicMock(),
}


def _make_query(mocker: MockerFixture) -> MagicMock:
    """A mocked SQL Lab Query row + database wired for the happy path."""
    query = mocker.MagicMock()
    query.id = 1
    query.limit = 1
    query.select_as_cta = False
    query.status = "running"
    query.database.cache_timeout = 100
    query.database.allow_run_async = True
    query.database.allow_dml = False
    return query


@with_config(_CONFIG)
def test_execute_sql_lab_query_exceeds_payload_limit(
    mocker: MockerFixture, app
) -> None:
    """``execute_sql_lab_query`` raises when the serialized payload is too large."""
    query = _make_query(mocker)
    mocker.patch(f"{_MODULE}.sys.getsizeof", return_value=100_000_000)  # 100 MB
    mocker.patch(
        f"{_MODULE}._serialize_payload", side_effect=lambda payload, use_msgpack: "blob"
    )
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)

    with pytest.raises(SupersetErrorException):
        execute_sql_lab_query(
            query,
            "SELECT 42 AS answer",
            return_results=True,
            store_results=True,
            expand_data=False,
        )


@with_config(_CONFIG)
def test_execute_sql_lab_query_within_payload_limit(mocker: MockerFixture, app) -> None:
    """``execute_sql_lab_query`` runs cleanly when the payload is within the limit."""
    query = _make_query(mocker)
    mocker.patch(f"{_MODULE}.sys.getsizeof", return_value=10_000_000)  # 10 MB
    mocker.patch(
        f"{_MODULE}._serialize_payload", side_effect=lambda payload, use_msgpack: "blob"
    )
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)

    try:
        execute_sql_lab_query(
            query,
            "SELECT 42 AS answer",
            return_results=True,
            store_results=True,
            expand_data=False,
        )
    except SupersetErrorException:
        pytest.fail("payload within the limit must not raise")


@with_config(_CONFIG)
def test_execute_sql_lab_query_returns_stopped_when_query_stopped(
    mocker: MockerFixture, app
) -> None:
    """A query stopped out-of-band returns a STOPPED payload, not a result."""
    from superset.common.db_query_status import QueryStatus

    query = _make_query(mocker)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)

    # The cooperative-stop check refreshes the row and sees STOPPED before the
    # first block runs, so the entry returns early with a STOPPED payload.
    def _refresh(_obj: object) -> None:
        query.status = QueryStatus.STOPPED

    mocker.patch(f"{_MODULE}.db.session.refresh", side_effect=_refresh)

    payload = execute_sql_lab_query(
        query,
        "SELECT 42 AS answer",
        return_results=True,
        store_results=False,
        expand_data=False,
    )
    assert payload is not None
    assert payload["status"] == QueryStatus.STOPPED


@with_config(_CONFIG)
def test_inline_results_backend_write_failure_still_returns_results(
    mocker: MockerFixture, app
) -> None:
    """An inline query whose results-backend write fails still returns its data
    (results_key cleared, query not failed) — regression guard."""
    from superset.common.db_query_status import QueryStatus

    query = _make_query(mocker)
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(
        f"{_MODULE}._serialize_payload", side_effect=lambda payload, use_msgpack: "blob"
    )
    mocker.patch(f"{_MODULE}.results_backend", _FailingBackend())

    payload = execute_sql_lab_query(
        query,
        "SELECT 42 AS answer",
        return_results=True,
        store_results=True,
        expand_data=False,
    )
    assert payload is not None
    assert payload["status"] == QueryStatus.SUCCESS
    assert query.results_key is None
    assert query.status != QueryStatus.FAILED


@with_config(_CONFIG)
def test_async_results_backend_write_failure_fails_query(
    mocker: MockerFixture, app
) -> None:
    """An async query (no inline results) whose backend write fails is failed and
    raises, since the result would otherwise be unreachable."""
    from superset.common.db_query_status import QueryStatus

    query = _make_query(mocker)
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(
        f"{_MODULE}._serialize_payload", side_effect=lambda payload, use_msgpack: "blob"
    )
    mocker.patch(f"{_MODULE}.results_backend", _FailingBackend())

    with pytest.raises(SupersetErrorException):
        execute_sql_lab_query(
            query,
            "SELECT 42 AS answer",
            return_results=False,
            store_results=True,
            expand_data=False,
        )
    assert query.status == QueryStatus.FAILED


@with_config(_CONFIG)
def test_empty_sql_raises_clean_error(mocker: MockerFixture, app) -> None:
    """SQL that yields no executable blocks fails cleanly rather than raising an
    UnboundLocalError from the unassigned result set."""
    query = _make_query(mocker)
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)
    # Force the "no executable statements" case (e.g. comment-only SQL under
    # certain engine × MUTATE_AFTER_SPLIT combinations).
    mocker.patch(f"{_MODULE}.build_statement_blocks", return_value=(MagicMock(), []))

    with pytest.raises(SupersetErrorException):
        execute_sql_lab_query(
            query,
            "-- just a comment",
            return_results=True,
            store_results=False,
            expand_data=False,
        )


@with_config(_CONFIG)
def test_cancel_hook_invoked_when_engine_cancel_id_captured(
    mocker: MockerFixture, app
) -> None:
    """The cancel hook is called with (database_id, cancel_id) once captured."""
    query = _make_query(mocker)
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)
    hook = mocker.MagicMock()

    execute_sql_lab_query(
        query,
        "SELECT 42 AS answer",
        return_results=False,
        store_results=False,
        expand_data=False,
        cancel_hook=hook,
    )
    hook.assert_called_once()


@with_config(_CONFIG)
def test_cancel_hook_failure_is_swallowed(mocker: MockerFixture, app) -> None:
    """A raising cancel hook only forfeits cancellability; execution proceeds."""
    query = _make_query(mocker)
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)
    hook = mocker.MagicMock(side_effect=RuntimeError("hook boom"))

    # Must not raise despite the hook failing.
    execute_sql_lab_query(
        query,
        "SELECT 42 AS answer",
        return_results=False,
        store_results=False,
        expand_data=False,
        cancel_hook=hook,
    )
    hook.assert_called_once()
