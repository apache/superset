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

from typing import Any
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


_QUERY_LOGGER = MagicMock()
_CONFIG_WITH_LOGGER = {**_CONFIG, "QUERY_LOGGER": _QUERY_LOGGER}


def _patch_script(
    mocker: MockerFixture,
    *,
    has_mutation: bool = False,
    valid_ctas: bool = True,
    valid_cvas: bool = True,
) -> tuple[MagicMock, MagicMock]:
    """Patch ``SQLScript`` with a controllable parsed-script mock."""
    script = MagicMock()
    statement = MagicMock()
    # ``apply_limit`` runs on each statement; a mutating statement short-circuits
    # it so the mocked statement needs no limit-related wiring.
    statement.is_mutating.return_value = True
    script.statements = [statement]
    script.has_mutation.return_value = has_mutation
    script.is_valid_ctas.return_value = valid_ctas
    script.is_valid_cvas.return_value = valid_cvas
    script.check_functions_present.return_value = False
    script.get_disallowed_tables.return_value = set()
    mocker.patch(f"{_MODULE}.SQLScript", return_value=script)
    return script, statement


@with_config(_CONFIG_WITH_LOGGER)
def test_query_logger_invoked(mocker: MockerFixture, app) -> None:
    """A configured ``QUERY_LOGGER`` callable is invoked during execution."""
    query = _make_query(mocker)
    _QUERY_LOGGER.reset_mock()
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)

    execute_sql_lab_query(
        query,
        "SELECT 42 AS answer",
        return_results=False,
        store_results=False,
    )
    _QUERY_LOGGER.assert_called_once()


@with_config(_CONFIG)
def test_result_trimmed_when_more_rows_than_limit(mocker: MockerFixture, app) -> None:
    """When more rows than the limit are fetched, the probe row is dropped."""
    query = _make_query(mocker)  # limit == 1
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)

    data = MagicMock()
    data.__len__.return_value = 2  # exceeds the limit of 1
    query.database.db_engine_spec.fetch_data.return_value = data

    execute_sql_lab_query(
        query,
        "SELECT 42 AS answer",
        return_results=False,
        store_results=False,
    )


@with_config(_CONFIG)
def test_soft_time_limit_raises_superset_error(mocker: MockerFixture, app) -> None:
    """A Celery soft-timeout maps to a SQL Lab timeout error."""
    from celery.exceptions import SoftTimeLimitExceeded

    from superset.common.db_query_status import QueryStatus

    query = _make_query(mocker)
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)
    query.database.db_engine_spec.execute_with_cursor.side_effect = (
        SoftTimeLimitExceeded()
    )

    with pytest.raises(SupersetErrorException):
        execute_sql_lab_query(
            query,
            "SELECT 42 AS answer",
            return_results=False,
            store_results=False,
        )
    assert query.status == QueryStatus.TIMED_OUT


@with_config(_CONFIG)
def test_oauth2_redirect_error_propagates(mocker: MockerFixture, app) -> None:
    """An ``OAuth2RedirectError`` is re-raised untouched for the caller."""
    from superset.exceptions import OAuth2RedirectError

    query = _make_query(mocker)
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)
    query.database.db_engine_spec.execute_with_cursor.side_effect = OAuth2RedirectError(
        "http://example.com", "tab-id", "http://example.com"
    )

    with pytest.raises(OAuth2RedirectError):
        execute_sql_lab_query(
            query,
            "SELECT 42 AS answer",
            return_results=False,
            store_results=False,
        )


@with_config(_CONFIG)
def test_cooperative_stop_during_execution_returns_stopped(
    mocker: MockerFixture, app
) -> None:
    """An engine error raised after an out-of-band STOP is reinterpreted as a
    clean stop and returns a STOPPED payload."""
    from superset.common.db_query_status import QueryStatus

    query = _make_query(mocker)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)

    state = {"executed": False}

    def _execute(*args: object, **kwargs: object) -> None:
        state["executed"] = True
        raise RuntimeError("session killed")

    query.database.db_engine_spec.execute_with_cursor.side_effect = _execute

    def _refresh(_obj: object) -> None:
        # Only report STOPPED once the engine has raised, so the pre-execution
        # cooperative-stop check does not short-circuit first.
        if state["executed"]:
            query.status = QueryStatus.STOPPED

    mocker.patch(f"{_MODULE}.db.session.refresh", side_effect=_refresh)

    payload = execute_sql_lab_query(
        query,
        "SELECT 42 AS answer",
        return_results=True,
        store_results=False,
    )
    assert payload is not None
    assert payload["status"] == QueryStatus.STOPPED


@with_config(_CONFIG)
def test_engine_error_raises_sqllab_exception(mocker: MockerFixture, app) -> None:
    """A generic engine error on a still-running query surfaces as a
    ``SqlLabException``."""
    from superset.sql_lab import SqlLabException

    query = _make_query(mocker)
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)
    query.database.db_engine_spec.execute_with_cursor.side_effect = RuntimeError("boom")
    query.database.db_engine_spec.extract_error_message.return_value = "boom"

    with pytest.raises(SqlLabException):
        execute_sql_lab_query(
            query,
            "SELECT 42 AS answer",
            return_results=False,
            store_results=False,
        )


def test_serialize_payload_msgpack_and_json() -> None:
    """``_serialize_payload`` yields bytes for msgpack and a str for JSON."""
    from superset.sql.execution.sqllab_executor import _serialize_payload

    assert isinstance(_serialize_payload({"answer": 42}, use_msgpack=True), bytes)
    assert isinstance(_serialize_payload({"answer": 42}, use_msgpack=False), str)


def test_serialize_and_expand_data_msgpack_without_app_context(
    mocker: MockerFixture,
) -> None:
    """The msgpack path skips stats timing when there is no app context."""
    from superset.sql.execution.sqllab_executor import _serialize_and_expand_data

    result_set = MagicMock()
    result_set.columns = [{"name": "a"}]
    mocker.patch(f"{_MODULE}.has_app_context", return_value=False)
    mocker.patch(
        f"{_MODULE}.write_ipc_buffer",
        return_value=MagicMock(to_pybytes=lambda: b"buf"),
    )

    data, selected, all_columns, expanded = _serialize_and_expand_data(
        result_set, MagicMock(), use_msgpack=True, expand_data=False
    )
    assert data == b"buf"
    assert expanded == []
    assert all_columns == result_set.columns


def test_serialize_and_expand_data_expands_nested_columns(
    mocker: MockerFixture,
) -> None:
    """``expand_data=True`` delegates to the engine spec's ``expand_data``."""
    from superset.sql.execution.sqllab_executor import _serialize_and_expand_data

    result_set = MagicMock()
    result_set.columns = [{"name": "a"}]
    mocker.patch(f"{_MODULE}.df_to_records", return_value=[{"a": 1}])
    db_engine_spec = MagicMock()
    db_engine_spec.expand_data.return_value = (["a", "b"], [{"a": 1, "b": 2}], ["b"])

    data, selected, all_columns, expanded = _serialize_and_expand_data(
        result_set, db_engine_spec, use_msgpack=False, expand_data=True
    )
    assert all_columns == ["a", "b"]
    assert expanded == ["b"]
    db_engine_spec.expand_data.assert_called_once()


@with_config(_CONFIG)
def test_store_results_uses_default_cache_timeout_and_pending_timing(
    mocker: MockerFixture, app
) -> None:
    """With no per-database cache timeout, the default is used; a ``start_time``
    records the pending-time stat."""
    query = _make_query(mocker)
    query.database.cache_timeout = None
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(
        f"{_MODULE}._serialize_payload", side_effect=lambda payload, use_msgpack: "blob"
    )
    mocker.patch(f"{_MODULE}.sys.getsizeof", return_value=10)
    backend = MagicMock()
    backend.set.return_value = True
    mocker.patch(f"{_MODULE}.results_backend", backend)

    execute_sql_lab_query(
        query,
        "SELECT 42 AS answer",
        return_results=False,
        store_results=True,
        start_time=123.0,
    )
    assert query.results_key is not None
    backend.set.assert_called_once()


@with_config({**_CONFIG, "SQLLAB_PAYLOAD_MAX_MB": 0})
def test_check_payload_size_skips_when_unset(app) -> None:
    """``_check_payload_size`` is a no-op when ``SQLLAB_PAYLOAD_MAX_MB`` is unset."""
    from superset.sql.execution.sqllab_executor import _check_payload_size

    # Must not raise regardless of size when the limit is falsy.
    _check_payload_size("a very large blob" * 1000)


@with_config(_CONFIG)
def test_missing_results_backend_for_async_raises(mocker: MockerFixture, app) -> None:
    """An async-capable database with no results backend fails fast."""
    from superset.exceptions import SupersetResultsBackendNotConfigureException

    query = _make_query(mocker)  # allow_run_async == True
    mocker.patch(f"{_MODULE}.results_backend", None)

    with pytest.raises(SupersetResultsBackendNotConfigureException):
        execute_sql_lab_query(
            query,
            "SELECT 42 AS answer",
            return_results=True,
            store_results=False,
        )


@with_config({**_CONFIG, "DISALLOWED_SQL_FUNCTIONS": {"postgresql": {"now"}}})
def test_disallowed_function_raises(mocker: MockerFixture, app) -> None:
    """A disallowed SQL function is rejected before execution."""
    from superset.exceptions import SupersetDisallowedSQLFunctionException

    query = _make_query(mocker)
    query.database.db_engine_spec.engine = "postgresql"
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)

    with pytest.raises(SupersetDisallowedSQLFunctionException):
        execute_sql_lab_query(
            query,
            "SELECT now()",
            return_results=False,
            store_results=False,
        )


@with_config({**_CONFIG, "DISALLOWED_SQL_TABLES": {"postgresql": {"secret"}}})
def test_disallowed_table_raises(mocker: MockerFixture, app) -> None:
    """A disallowed SQL table is rejected before execution."""
    from superset.exceptions import SupersetDisallowedSQLTableException

    query = _make_query(mocker)
    query.database.db_engine_spec.engine = "postgresql"
    query.database.get_default_schema_for_query.return_value = "public"
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)

    with pytest.raises(SupersetDisallowedSQLTableException):
        execute_sql_lab_query(
            query,
            "SELECT * FROM secret",
            return_results=False,
            store_results=False,
        )


@with_config(_CONFIG)
def test_dml_not_allowed_raises(mocker: MockerFixture, app) -> None:
    """A mutating statement is rejected when the database disallows DML."""
    from superset.exceptions import SupersetDMLNotAllowedException

    query = _make_query(mocker)  # allow_dml == False
    query.database.db_engine_spec.engine = "postgresql"
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)

    with pytest.raises(SupersetDMLNotAllowedException):
        execute_sql_lab_query(
            query,
            "INSERT INTO t VALUES (1)",
            return_results=False,
            store_results=False,
        )


@with_config(_CONFIG)
def test_rls_applied_when_feature_enabled(mocker: MockerFixture, app) -> None:
    """RLS is injected into each statement when ``RLS_IN_SQLLAB`` is enabled."""
    query = _make_query(mocker)
    query.database.get_default_schema_for_query.return_value = "public"
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)
    mocker.patch(f"{_MODULE}.is_feature_enabled", return_value=True)
    apply_rls = mocker.patch(f"{_MODULE}.apply_rls")

    execute_sql_lab_query(
        query,
        "SELECT 42 AS answer",
        return_results=False,
        store_results=False,
    )
    apply_rls.assert_called()


@with_config(_CONFIG)
def test_invalid_ctas_raises(mocker: MockerFixture, app) -> None:
    """An invalid ``CREATE TABLE AS`` request is rejected."""
    from superset.exceptions import SupersetInvalidCTASException

    query = _make_query(mocker)
    query.select_as_cta = True
    query.ctas_method = "TABLE"
    _patch_script(mocker, valid_ctas=False)
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)

    with pytest.raises(SupersetInvalidCTASException):
        execute_sql_lab_query(
            query,
            "SELECT 42 AS answer",
            return_results=False,
            store_results=False,
        )


@with_config(_CONFIG)
def test_invalid_cvas_raises(mocker: MockerFixture, app) -> None:
    """An invalid ``CREATE VIEW AS`` request is rejected."""
    from superset.exceptions import SupersetInvalidCVASException

    query = _make_query(mocker)
    query.select_as_cta = True
    query.ctas_method = "VIEW"
    _patch_script(mocker, valid_cvas=False)
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)

    with pytest.raises(SupersetInvalidCVASException):
        execute_sql_lab_query(
            query,
            "SELECT 42 AS answer",
            return_results=False,
            store_results=False,
        )


@with_config(_CONFIG)
def test_valid_ctas_rewrites_and_commits(mocker: MockerFixture, app) -> None:
    """A valid CTAS rewrites the final statement, commits, and sets ``select_sql``."""
    query = _make_query(mocker)
    query.select_as_cta = True
    query.ctas_method = "TABLE"
    query.tmp_table_name = "tmp"  # already set: skips name generation in apply_ctas
    script, statement = _patch_script(mocker, valid_ctas=True)
    mocker.patch(
        f"{_MODULE}.build_statement_blocks", return_value=(script, ["SELECT 1"])
    )
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)

    execute_sql_lab_query(
        query,
        "SELECT 42 AS answer",
        return_results=False,
        store_results=False,
    )
    assert query.select_as_cta_used is True
    statement.as_create_table.assert_called_once()
    assert query.select_sql is query.database.select_star.return_value


@with_config(_CONFIG)
def test_no_cancel_id_captured(mocker: MockerFixture, app) -> None:
    """When the engine exposes no cancel id, the capture/hook block is skipped."""
    query = _make_query(mocker)
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)
    query.database.db_engine_spec.get_cancel_query_id.return_value = None
    hook = mocker.MagicMock()

    execute_sql_lab_query(
        query,
        "SELECT 42 AS answer",
        return_results=False,
        store_results=False,
        cancel_hook=hook,
    )
    hook.assert_not_called()


@with_config(_CONFIG)
def test_final_status_preserved_when_failed(mocker: MockerFixture, app) -> None:
    """A query already marked FAILED is not overwritten to SUCCESS at the end."""
    from superset.common.db_query_status import QueryStatus

    query = _make_query(mocker)
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)
    mocker.patch(
        f"{_MODULE}._serialize_payload", side_effect=lambda payload, use_msgpack: "blob"
    )
    mocker.patch(f"{_MODULE}.sys.getsizeof", return_value=10)

    def _serialize(
        result_set: object,
        db_engine_spec: object,
        use_msgpack: bool = False,
        expand_data: bool = False,
    ) -> tuple[list[Any], list[Any], list[Any], list[Any]]:
        query.status = QueryStatus.FAILED
        return ([], [], [], [])

    mocker.patch(f"{_MODULE}._serialize_and_expand_data", side_effect=_serialize)

    payload = execute_sql_lab_query(
        query,
        "SELECT 42 AS answer",
        return_results=True,
        store_results=False,
    )
    assert payload is not None
    assert query.status == QueryStatus.FAILED


@with_config({**_CONFIG, "DISALLOWED_SQL_TABLES": {"postgresql": {"secret"}}})
def test_disallowed_tables_configured_but_query_clean(
    mocker: MockerFixture, app
) -> None:
    """A denylist is configured but the query touches none of the listed tables,
    so execution proceeds."""
    query = _make_query(mocker)
    query.database.db_engine_spec.engine = "postgresql"
    query.database.get_default_schema_for_query.return_value = "public"
    mocker.patch(f"{_MODULE}.db.session.refresh", return_value=None)
    mocker.patch(f"{_MODULE}.results_backend", return_value=True)

    execute_sql_lab_query(
        query,
        "SELECT * FROM allowed_table",
        return_results=False,
        store_results=False,
    )
