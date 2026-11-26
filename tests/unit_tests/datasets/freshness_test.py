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
# pylint: disable=import-outside-toplevel, redefined-outer-name
from __future__ import annotations

import logging
import sqlite3
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import numpy as np
import pytest
from pytest_mock import MockerFixture
from sqlalchemy.sql import text

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.datasets.freshness import (
    authorize_freshness_sql,
    freshness_time_columns,
    FreshnessConfig,
    FreshnessValidationError,
    get_dashboard_freshness,
    get_dataset_freshness,
    is_stale,
    parse_freshness_config,
    to_utc_datetime,
    validate_freshness_extra,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.models.core import Database
from superset.utils import json

UTC = timezone.utc


class FakeCache:
    """A dict-backed stand-in for ``cache_manager.data_cache``."""

    def __init__(self) -> None:
        self.store: dict[str, Any] = {}
        self.timeouts: dict[str, int | None] = {}

    def get(self, key: str) -> Any:
        return self.store.get(key)

    def set(self, key: str, value: Any, timeout: int | None = None) -> None:
        self.store[key] = value
        self.timeouts[key] = timeout


@pytest.fixture
def cache(mocker: MockerFixture) -> FakeCache:
    fake = FakeCache()
    mocker.patch(
        "superset.datasets.freshness.cache_manager", MagicMock(data_cache=fake)
    )
    return fake


@pytest.fixture
def sqlite_path(tmp_path: Path) -> Path:
    path = tmp_path / "warehouse.db"
    with sqlite3.connect(path) as conn:
        conn.execute("CREATE TABLE invoices (id INTEGER, loaded_at TEXT, epoch INT)")
        conn.executemany(
            "INSERT INTO invoices VALUES (?, ?, ?)",
            [
                (1, "2026-11-25 08:00:00", 1764057600),
                (2, "2026-11-26 09:30:00", 1764149400),
            ],
        )
        conn.execute("CREATE TABLE load_log (table_name TEXT, finished_at TEXT)")
        conn.execute(
            "INSERT INTO load_log VALUES ('invoices', '2026-11-26T07:15:00+00:00')"
        )
    return path


def make_dataset(sqlite_path: Path, extra: dict[str, Any] | None) -> SqlaTable:
    database = Database(
        id=1, database_name="warehouse", sqlalchemy_uri=f"sqlite:///{sqlite_path}"
    )
    return SqlaTable(
        id=7,
        table_name="invoices",
        database=database,
        columns=[
            TableColumn(column_name="id", type="INTEGER"),
            TableColumn(column_name="loaded_at", type="TEXT", is_dttm=True),
            TableColumn(
                column_name="epoch",
                type="INT",
                is_dttm=True,
                python_date_format="epoch_s",
            ),
        ],
        extra=json.dumps(extra) if extra is not None else None,
    )


@pytest.fixture
def no_rls(mocker: MockerFixture) -> None:
    mocker.patch.object(SqlaTable, "get_sqla_row_level_filters", return_value=[])


# --- parsing ------------------------------------------------------------------


def test_parse_freshness_config_column() -> None:
    config = parse_freshness_config(
        {"freshness": {"column": "loaded_at", "warn_after_minutes": 60}}
    )
    assert config == FreshnessConfig(column="loaded_at", warn_after_minutes=60)


def test_parse_freshness_config_accepts_json_string() -> None:
    assert parse_freshness_config('{"freshness": {"sql": "SELECT 1"}}') == (
        FreshnessConfig(sql="SELECT 1")
    )


@pytest.mark.parametrize(
    "extra",
    [None, "", "{}", "not json", '{"warning_markdown": "x"}', {"freshness": None}],
)
def test_parse_freshness_config_without_setting(extra: Any) -> None:
    assert parse_freshness_config(extra) is None


@pytest.mark.parametrize(
    "freshness",
    [
        {},
        {"column": "a", "sql": "SELECT 1"},
        {"column": ""},
        {"column": "a", "warn_after_minutes": 0},
        {"column": "a", "warn_after_minutes": "10"},
        {"column": "a", "unknown": True},
        "loaded_at",
    ],
)
def test_parse_freshness_config_rejects_invalid(freshness: Any) -> None:
    with pytest.raises(FreshnessValidationError) as excinfo:
        parse_freshness_config({"freshness": freshness})
    assert "freshness" in excinfo.value.messages_dict


# --- timestamps ---------------------------------------------------------------


@pytest.mark.parametrize(
    "value, date_format, expected",
    [
        ("2026-11-26 09:30:00", None, datetime(2026, 11, 26, 9, 30, tzinfo=UTC)),
        (
            "2026-11-26T12:30:00+03:00",
            None,
            datetime(2026, 11, 26, 9, 30, tzinfo=UTC),
        ),
        # A bare number is not a time (a count, an amount, an id) ...
        (1764149400, None, None),
        (392.5, None, None),
        (np.int64(40), None, None),
        # ... unless the format says how to read it.
        (1764149400, "epoch_s", datetime(2025, 11, 26, 9, 30, tzinfo=UTC)),
        (20261126, "%Y%m%d", datetime(2026, 11, 26, tzinfo=UTC)),
        (20261126.0, "%Y%m%d", datetime(2026, 11, 26, tzinfo=UTC)),
        (12, "%Y%m%d", None),
        (1764149400000, "epoch_ms", datetime(2025, 11, 26, 9, 30, tzinfo=UTC)),
        ("1764149400", "epoch_s", datetime(2025, 11, 26, 9, 30, tzinfo=UTC)),
        ("26/11/2026", "%d/%m/%Y", datetime(2026, 11, 26, tzinfo=UTC)),
        (date(2026, 11, 26), None, datetime(2026, 11, 26, tzinfo=UTC)),
        (
            datetime(2026, 11, 26, 9, 30),
            None,
            datetime(2026, 11, 26, 9, 30, tzinfo=UTC),
        ),
        (np.int64(1764149400), "epoch_s", datetime(2025, 11, 26, 9, 30, tzinfo=UTC)),
        (
            np.datetime64("2026-11-26T09:30:00"),
            None,
            datetime(2026, 11, 26, 9, 30, tzinfo=UTC),
        ),
        (None, None, None),
        (float("nan"), None, None),
        (True, None, None),
        ("not a date", None, None),
        ("26/11/2026", "%Y-%m-%d", None),
        ([1], None, None),
    ],
)
def test_to_utc_datetime(
    value: Any, date_format: str | None, expected: datetime | None
) -> None:
    assert to_utc_datetime(value, date_format) == expected


def test_is_stale() -> None:
    now = datetime(2026, 11, 26, 12, 0, tzinfo=UTC)
    two_hours_ago = now - timedelta(hours=2)
    assert is_stale(two_hours_ago, 60, now) is True
    assert is_stale(two_hours_ago, 180, now) is False
    assert is_stale(two_hours_ago, None, now) is False
    assert is_stale(None, 60, now) is False


# --- save-time validation -----------------------------------------------------


def _validate(extra: Any, **overrides: Any) -> None:
    kwargs: dict[str, Any] = {
        "stored_extra": None,
        "columns": {"loaded_at": True, "region": False},
        "database": MagicMock(),
        "catalog": None,
        "schema": None,
        "template_params": {},
        "binding_changed": False,
    }
    kwargs.update(overrides)
    validate_freshness_extra(extra, **kwargs)


def test_validate_rejects_unknown_column() -> None:
    with pytest.raises(FreshnessValidationError) as excinfo:
        _validate({"freshness": {"column": "missing"}})
    assert excinfo.value.messages_dict == {
        "freshness": {"column": ["Column missing does not exist."]}
    }


def test_validate_rejects_column_that_is_not_a_time_column() -> None:
    with pytest.raises(FreshnessValidationError) as excinfo:
        _validate({"freshness": {"column": "region"}})
    assert excinfo.value.messages_dict == {
        "freshness": {
            "column": [
                "Column region is not a time column. Mark it as temporal or set "
                "its datetime format."
            ]
        }
    }


def test_freshness_time_columns_reads_models_and_request_dicts() -> None:
    stored = [
        TableColumn(id=1, column_name="loaded_at", is_dttm=True),
        TableColumn(id=2, column_name="epoch", python_date_format="epoch_s"),
        TableColumn(id=3, column_name="region"),
    ]
    assert freshness_time_columns(stored) == {
        "loaded_at": True,
        "epoch": True,
        "region": False,
    }
    request = [
        # A partial update keeps the stored flags it leaves out.
        {"id": 1, "column_name": "loaded_at"},
        {"id": 2, "column_name": "epoch", "python_date_format": None},
        {"id": 3, "column_name": "region", "is_dttm": True},
        {"column_name": "new_col"},
    ]
    assert freshness_time_columns(request, existing=stored) == {
        "loaded_at": True,
        "epoch": False,
        "region": True,
        "new_col": False,
    }


def test_validate_accepts_known_column(mocker: MockerFixture) -> None:
    authorize = mocker.patch("superset.datasets.freshness.authorize_freshness_sql")
    _validate({"freshness": {"column": "loaded_at"}})
    authorize.assert_not_called()


def test_validate_authorizes_new_sql(mocker: MockerFixture) -> None:
    authorize = mocker.patch("superset.datasets.freshness.authorize_freshness_sql")
    database = MagicMock()
    _validate(
        {"freshness": {"sql": "SELECT MAX(finished_at) FROM load_log"}},
        database=database,
        schema="main",
        template_params={"a": 1},
    )
    authorize.assert_called_once_with(
        "SELECT MAX(finished_at) FROM load_log",
        database=database,
        catalog=None,
        schema="main",
        template_params={"a": 1},
    )


def test_validate_skips_unchanged_sql(mocker: MockerFixture) -> None:
    authorize = mocker.patch("superset.datasets.freshness.authorize_freshness_sql")
    stored = {"freshness": {"sql": "SELECT 1"}, "warning_markdown": "old"}
    _validate({"freshness": {"sql": "SELECT 1"}}, stored_extra=json.dumps(stored))
    authorize.assert_not_called()


def test_validate_reauthorizes_unchanged_sql_when_binding_moves(
    mocker: MockerFixture,
) -> None:
    authorize = mocker.patch("superset.datasets.freshness.authorize_freshness_sql")
    stored = json.dumps({"freshness": {"sql": "SELECT 1"}})
    _validate(
        {"freshness": {"sql": "SELECT 1"}}, stored_extra=stored, binding_changed=True
    )
    authorize.assert_called_once()


def test_validate_fails_closed_on_unreadable_template_params(
    mocker: MockerFixture,
) -> None:
    authorize = mocker.patch("superset.datasets.freshness.authorize_freshness_sql")
    with pytest.raises(FreshnessValidationError):
        _validate({"freshness": {"sql": "SELECT 1"}}, template_params=None)
    authorize.assert_not_called()
    # ...but only when there is SQL to authorize
    _validate({"freshness": {"column": "loaded_at"}}, template_params=None)


@pytest.mark.parametrize(
    "sql, message",
    [
        ("SELECT 1; SELECT 2", "The freshness query must be a single statement."),
        ("DELETE FROM load_log", "The freshness query must be a read-only SELECT."),
        (
            "INSERT INTO load_log VALUES ('a', 'b')",
            "The freshness query must be a read-only SELECT.",
        ),
    ],
)
def test_authorize_rejects_non_select(
    mocker: MockerFixture, sqlite_path: Path, sql: str, message: str
) -> None:
    raise_for_access = mocker.patch(
        "superset.datasets.freshness.security_manager.raise_for_access"
    )
    database = make_dataset(sqlite_path, None).database
    with pytest.raises(FreshnessValidationError) as excinfo:
        authorize_freshness_sql(
            sql, database=database, catalog=None, schema=None, template_params={}
        )
    assert excinfo.value.messages_dict == {"freshness": {"sql": [message]}}
    raise_for_access.assert_not_called()


def test_authorize_checks_data_access(mocker: MockerFixture, sqlite_path: Path) -> None:
    raise_for_access = mocker.patch(
        "superset.datasets.freshness.security_manager.raise_for_access"
    )
    database = make_dataset(sqlite_path, None).database
    authorize_freshness_sql(
        "SELECT MAX(finished_at) FROM {{ log_table }}",
        database=database,
        catalog=None,
        schema="main",
        template_params={"log_table": "load_log"},
    )
    raise_for_access.assert_called_once_with(
        database=database,
        sql="SELECT MAX(finished_at) FROM {{ log_table }}",
        catalog=None,
        schema="main",
        template_params={"log_table": "load_log"},
        allow_editorship=False,
    )


def test_authorize_propagates_access_denial(
    mocker: MockerFixture, sqlite_path: Path
) -> None:
    denied = SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
            message="You need access to load_log",
            level=ErrorLevel.ERROR,
        )
    )
    mocker.patch(
        "superset.datasets.freshness.security_manager.raise_for_access",
        side_effect=denied,
    )
    database = make_dataset(sqlite_path, None).database
    with pytest.raises(SupersetSecurityException):
        authorize_freshness_sql(
            "SELECT MAX(finished_at) FROM load_log",
            database=database,
            catalog=None,
            schema=None,
            template_params={},
        )


def test_authorize_rejects_disallowed_functions(
    mocker: MockerFixture, sqlite_path: Path
) -> None:
    mocker.patch("superset.datasets.freshness.security_manager.raise_for_access")
    mocker.patch.dict(
        "superset.datasets.freshness.app.config",
        {"DISALLOWED_SQL_FUNCTIONS": {"sqlite": {"load_extension"}}},
    )
    database = make_dataset(sqlite_path, None).database
    with pytest.raises(FreshnessValidationError):
        authorize_freshness_sql(
            "SELECT load_extension('x')",
            database=database,
            catalog=None,
            schema=None,
            template_params={},
        )


# --- execution ----------------------------------------------------------------


def test_get_dataset_freshness_without_setting(
    sqlite_path: Path, cache: FakeCache
) -> None:
    assert get_dataset_freshness(make_dataset(sqlite_path, None)) is None
    assert cache.store == {}


@pytest.mark.usefixtures("no_rls")
def test_get_dataset_freshness_column(sqlite_path: Path, cache: FakeCache) -> None:
    dataset = make_dataset(sqlite_path, {"freshness": {"column": "loaded_at"}})
    assert get_dataset_freshness(dataset) == datetime(2026, 11, 26, 9, 30, tzinfo=UTC)
    # cached for DATA_FRESHNESS_CACHE_TIMEOUT
    assert list(cache.timeouts.values()) == [900]


@pytest.mark.usefixtures("no_rls")
def test_get_dataset_freshness_column_uses_date_format(
    sqlite_path: Path, cache: FakeCache
) -> None:
    dataset = make_dataset(sqlite_path, {"freshness": {"column": "epoch"}})
    assert get_dataset_freshness(dataset) == datetime(2025, 11, 26, 9, 30, tzinfo=UTC)


def test_get_dataset_freshness_column_applies_rls(
    mocker: MockerFixture, sqlite_path: Path, cache: FakeCache
) -> None:
    mocker.patch.object(
        SqlaTable, "get_sqla_row_level_filters", return_value=[text("id = 1")]
    )
    dataset = make_dataset(sqlite_path, {"freshness": {"column": "loaded_at"}})
    assert get_dataset_freshness(dataset) == datetime(2026, 11, 25, 8, 0, tzinfo=UTC)


def test_get_dataset_freshness_sql(
    mocker: MockerFixture, sqlite_path: Path, cache: FakeCache
) -> None:
    apply_rls = mocker.patch("superset.utils.rls.apply_rls", return_value=False)
    dataset = make_dataset(
        sqlite_path,
        {
            "freshness": {
                "sql": "SELECT MAX(finished_at) FROM load_log "
                "WHERE table_name = '{{ 'invoices' }}'"
            }
        },
    )
    assert get_dataset_freshness(dataset) == datetime(2026, 11, 26, 7, 15, tzinfo=UTC)
    apply_rls.assert_called_once()
    # The cache is keyed on the SQL that ran, after Jinja.
    (key,) = cache.store
    assert key.startswith("data_freshness_")


def test_get_dataset_freshness_sql_runs_rls_rewrite(
    mocker: MockerFixture, sqlite_path: Path, cache: FakeCache
) -> None:
    def add_predicate(database: Any, catalog: Any, schema: Any, statement: Any) -> bool:
        statement._parsed = statement._parsed.where("1 = 0")  # noqa: SLF001
        return True

    mocker.patch("superset.utils.rls.apply_rls", side_effect=add_predicate)
    dataset = make_dataset(
        sqlite_path, {"freshness": {"sql": "SELECT MAX(finished_at) FROM load_log"}}
    )
    # The RLS-filtered statement matches no rows.
    assert get_dataset_freshness(dataset) is None


def test_get_dataset_freshness_sql_rejects_rendered_mutation(
    mocker: MockerFixture, sqlite_path: Path, cache: FakeCache
) -> None:
    mocker.patch("superset.utils.rls.apply_rls", return_value=False)
    get_df = mocker.patch.object(Database, "get_df")
    dataset = make_dataset(
        sqlite_path,
        {"freshness": {"sql": "{{ 'DELETE FROM load_log' }}"}},
    )
    assert get_dataset_freshness(dataset) is None
    get_df.assert_not_called()


@pytest.mark.usefixtures("no_rls")
def test_get_dataset_freshness_uses_cache(
    mocker: MockerFixture, sqlite_path: Path, cache: FakeCache
) -> None:
    dataset = make_dataset(sqlite_path, {"freshness": {"column": "loaded_at"}})
    first = get_dataset_freshness(dataset)
    get_df = mocker.patch.object(Database, "get_df")
    assert get_dataset_freshness(dataset) == first
    get_df.assert_not_called()


@pytest.mark.usefixtures("no_rls")
def test_get_dataset_freshness_caches_failures(
    mocker: MockerFixture, sqlite_path: Path, cache: FakeCache
) -> None:
    get_df = mocker.patch.object(
        Database, "get_df", side_effect=Exception("warehouse down")
    )
    dataset = make_dataset(sqlite_path, {"freshness": {"column": "loaded_at"}})
    assert get_dataset_freshness(dataset) is None
    assert get_dataset_freshness(dataset) is None
    get_df.assert_called_once()


@pytest.mark.usefixtures("no_rls")
def test_get_dataset_freshness_column_must_still_be_a_time_column(
    sqlite_path: Path, cache: FakeCache, caplog: pytest.LogCaptureFixture
) -> None:
    # Saved when valid; the column was unmarked afterwards.
    dataset = make_dataset(sqlite_path, {"freshness": {"column": "id"}})
    assert get_dataset_freshness(dataset) is None
    assert "not a time column" in caplog.text


@pytest.mark.parametrize(
    "sql, reason",
    [
        ("SELECT COUNT(*) FROM invoices", "of type int is not a timestamp"),
        ("SELECT 'hello'", "of type str is not a timestamp"),
        ("SELECT loaded_at FROM invoices", "returned 2 rows and 1 columns"),
        ("SELECT MAX(loaded_at), MAX(id) FROM invoices", "returned 1 rows and 2"),
        ("SELECT MAX(nope) FROM invoices", "freshness query failed"),
    ],
)
def test_get_dataset_freshness_sql_rejects_non_timestamp_answers(
    mocker: MockerFixture,
    sqlite_path: Path,
    cache: FakeCache,
    caplog: pytest.LogCaptureFixture,
    sql: str,
    reason: str,
) -> None:
    mocker.patch("superset.utils.rls.apply_rls", return_value=False)
    dataset = make_dataset(sqlite_path, {"freshness": {"sql": sql}})
    with caplog.at_level(logging.WARNING, logger="superset.datasets.freshness"):
        assert get_dataset_freshness(dataset) is None
    assert reason in caplog.text
    # Neither SQL nor data reaches the log.
    assert sql not in caplog.text


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT finished_at FROM load_log WHERE 1 = 0",
        "SELECT MAX(finished_at) FROM load_log WHERE 1 = 0",
    ],
)
def test_get_dataset_freshness_sql_without_a_value_is_not_a_warning(
    mocker: MockerFixture,
    sqlite_path: Path,
    cache: FakeCache,
    caplog: pytest.LogCaptureFixture,
    sql: str,
) -> None:
    mocker.patch("superset.utils.rls.apply_rls", return_value=False)
    dataset = make_dataset(sqlite_path, {"freshness": {"sql": sql}})
    with caplog.at_level(logging.WARNING, logger="superset.datasets.freshness"):
        assert get_dataset_freshness(dataset) is None
    assert caplog.text == ""


def test_get_dataset_freshness_ignores_invalid_setting(
    sqlite_path: Path, cache: FakeCache
) -> None:
    dataset = make_dataset(sqlite_path, {"freshness": {"column": "a", "sql": "b"}})
    assert get_dataset_freshness(dataset) is None


# --- dashboard roll-up --------------------------------------------------------


def test_get_dashboard_freshness(
    mocker: MockerFixture, sqlite_path: Path, cache: FakeCache
) -> None:
    fresh = make_dataset(
        sqlite_path, {"freshness": {"column": "loaded_at", "warn_after_minutes": 60}}
    )
    old = make_dataset(sqlite_path, {"freshness": {"column": "x"}})
    old.id, old.table_name = 8, "orders"
    hidden = make_dataset(sqlite_path, {"freshness": {"column": "loaded_at"}})
    hidden.id, hidden.table_name = 9, "secret"
    unconfigured = make_dataset(sqlite_path, None)
    unconfigured.id, unconfigured.table_name = 10, "plain"

    answers = {
        7: datetime(2026, 11, 26, 9, 30, tzinfo=UTC),
        8: datetime(2026, 11, 25, 8, 0, tzinfo=UTC),
        9: datetime(2020, 1, 1, tzinfo=UTC),
    }
    mocker.patch(
        "superset.datasets.freshness.get_dataset_freshness",
        side_effect=lambda dataset: answers[dataset.id],
    )
    mocker.patch(
        "superset.datasets.freshness._can_read_freshness",
        side_effect=lambda dataset, dashboard: dataset.id != 9,
    )
    mocker.patch(
        "superset.datasets.freshness.datetime",
        wraps=datetime,
        **{"now.return_value": datetime(2026, 11, 26, 12, 0, tzinfo=UTC)},
    )
    dashboard = MagicMock(datasources={fresh, old, hidden, unconfigured})

    assert get_dashboard_freshness(dashboard) == {
        "data_as_of": datetime(2026, 11, 25, 8, 0, tzinfo=UTC),
        "stale": True,
        "datasets": [
            {
                "id": 7,
                "name": "invoices",
                "data_as_of": datetime(2026, 11, 26, 9, 30, tzinfo=UTC),
                "warn_after_minutes": 60,
                "stale": True,
            },
            {
                "id": 8,
                "name": "orders",
                "data_as_of": datetime(2026, 11, 25, 8, 0, tzinfo=UTC),
                "warn_after_minutes": None,
                "stale": False,
            },
        ],
    }


def test_get_dashboard_freshness_without_answers(mocker: MockerFixture) -> None:
    dashboard = MagicMock(datasources=set())
    assert get_dashboard_freshness(dashboard) == {
        "data_as_of": None,
        "stale": False,
        "datasets": [],
    }
