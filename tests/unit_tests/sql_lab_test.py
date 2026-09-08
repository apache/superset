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
# pylint: disable=import-outside-toplevel, invalid-name, unused-argument, too-many-locals

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import text
from sqlalchemy.orm import Session

from superset.app import SupersetApp
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.models.core import Database
from superset.sql.parse import SQLStatement, Table
from superset.sql_lab import (
    get_query,
    SqlLabException,
)
from superset.utils.rls import apply_rls, get_predicates_for_table
from tests.conftest import with_config


def test_get_query_rolls_back_session_before_retrying(
    mocker: MockerFixture, app: SupersetApp
) -> None:
    """
    A broken transaction (e.g. `PendingRollbackError` following a failed flush)
    leaves the session unusable until `session.rollback()` is called, so without
    it every `backoff` retry would reuse the same poisoned session and fail
    identically. `get_query` must roll back on failure so each retry gets a
    clean session and has a real chance to succeed.
    """
    # avoid actually sleeping through the `backoff` decorator's retry interval
    mocker.patch("backoff._sync.time.sleep")

    expected_query = mocker.MagicMock()
    mock_one = mocker.patch("superset.sql_lab.db.session.query")
    mock_one.return_value.filter_by.return_value.one.side_effect = [
        Exception("session is broken"),
        expected_query,
    ]
    mock_rollback = mocker.patch("superset.sql_lab.db.session.rollback")

    result = get_query(query_id=1)

    assert result is expected_query
    assert mock_one.return_value.filter_by.return_value.one.call_count == 2
    mock_rollback.assert_called_once()


def test_get_query_swallows_rollback_failure(
    mocker: MockerFixture, app: SupersetApp
) -> None:
    """
    If the session/connection is too broken for `rollback()` itself to succeed,
    that failure must not replace the original lookup error: `get_query` still
    needs to raise `SqlLabException` so the `backoff` decorator's retry contract
    (which only matches on `SqlLabException`) isn't bypassed.
    """
    mocker.patch("backoff._sync.time.sleep")

    mock_one = mocker.patch("superset.sql_lab.db.session.query")
    mock_one.return_value.filter_by.return_value.one.side_effect = Exception(
        "session is broken"
    )
    mocker.patch(
        "superset.sql_lab.db.session.rollback",
        side_effect=Exception("connection already closed"),
    )

    with pytest.raises(SqlLabException):
        get_query(query_id=1)


@with_config(
    {
        "SQLLAB_PAYLOAD_MAX_MB": 50,
        "DISALLOWED_SQL_FUNCTIONS": {},
        "SQLLAB_CTAS_NO_LIMIT": False,
        "SQL_MAX_ROW": 100000,
        "QUERY_LOGGER": None,
        "TROUBLESHOOTING_LINK": None,
        "STATS_LOGGER": MagicMock(),
    }
)
def test_apply_rls(mocker: MockerFixture) -> None:
    """
    Test the ``apply_rls`` helper function.
    """
    database = mocker.MagicMock()
    database.get_default_schema_for_query.return_value = "public"
    database.get_default_catalog.return_value = "examples"
    database.db_engine_spec = PostgresEngineSpec
    get_predicates_for_table = mocker.patch(
        "superset.utils.rls.get_predicates_for_table",
        side_effect=[["c1 = 1"], ["c2 = 2"]],
    )

    parsed_statement = SQLStatement("SELECT * FROM t1, t2", "postgresql")
    parsed_statement.tables = sorted(parsed_statement.tables, key=lambda x: x.table)  # type: ignore

    apply_rls(database, "examples", "public", parsed_statement)

    get_predicates_for_table.assert_has_calls(
        [
            mocker.call(
                Table("t1", "public", "examples"),
                database,
                "examples",
                exclude_dataset_id=None,
            ),
            mocker.call(
                Table("t2", "public", "examples"),
                database,
                "examples",
                exclude_dataset_id=None,
            ),
        ]
    )

    assert (
        parsed_statement.format()
        == """
SELECT
  *
FROM (
  SELECT
    *
  FROM t1
  WHERE
    c1 = 1
) AS "t1", (
  SELECT
    *
  FROM t2
  WHERE
    c2 = 2
) AS "t2"
        """.strip()
    )


def test_get_predicates_for_table(mocker: MockerFixture) -> None:
    """
    Test the ``get_predicates_for_table`` helper function.
    """
    database = mocker.MagicMock()
    dataset = mocker.MagicMock()
    predicate = mocker.MagicMock()
    predicate.compile.return_value = "c1 = 1"
    dataset.get_sqla_row_level_filters.return_value = [predicate]
    db = mocker.patch("superset.utils.rls.db")
    db.session.query().filter().one_or_none.return_value = dataset

    table = Table("t1", "public", "examples")
    assert get_predicates_for_table(table, database, "examples") == ["c1 = 1"]
    dataset.get_sqla_row_level_filters.assert_called_once_with(
        include_global_guest_rls=False
    )


def test_get_predicates_for_table_null_schema_dataset(session: Session) -> None:
    """
    A dataset stored with a NULL schema is scoped to the database's default
    schema, mirroring the existing null-catalog fallback.

    A query resolving to that default schema must find the dataset, so its RLS
    predicates are applied instead of being silently dropped. A query against a
    different schema must not, since the null-schema dataset doesn't describe it.
    """
    from superset.connectors.sqla.models import SqlaTable

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="rls_db", sqlalchemy_uri="sqlite://")
    # registered without an explicit schema, e.g. via the dataset API
    dataset = SqlaTable(table_name="t1", schema=None, catalog=None, database=database)
    session.add_all([database, dataset])
    session.flush()

    with (
        patch.object(
            SqlaTable, "get_sqla_row_level_filters", return_value=[text("c1 = 1")]
        ),
        patch.object(Database, "get_default_schema", return_value="public"),
    ):
        assert get_predicates_for_table(
            Table("t1", "public", None), database, None
        ) == ["c1 = 1"]

        assert (
            get_predicates_for_table(Table("t1", "sales", None), database, None) == []
        )


def test_get_predicates_for_table_prefers_exact_schema_match(session: Session) -> None:
    """
    A dataset stored without a schema and one stored with the default schema can
    coexist for the same table. The exact match must win, and the lookup must stay
    unambiguous rather than treating both rows as candidates for a single dataset.
    """
    from superset.connectors.sqla.models import SqlaTable

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="rls_db_exact", sqlalchemy_uri="sqlite://")
    session.add_all(
        [
            database,
            SqlaTable(table_name="t1", schema=None, catalog=None, database=database),
            SqlaTable(
                table_name="t1", schema="public", catalog=None, database=database
            ),
        ]
    )
    session.flush()

    def row_level_filters(
        self: Any, include_global_guest_rls: bool = True
    ) -> list[Any]:
        return [text(f"c1 = '{self.schema}'")]

    with (
        patch.object(
            SqlaTable,
            "get_sqla_row_level_filters",
            autospec=True,
            side_effect=row_level_filters,
        ),
        patch.object(Database, "get_default_schema", return_value="public"),
    ):
        assert get_predicates_for_table(
            Table("t1", "public", None), database, None
        ) == ["c1 = 'public'"]


def test_get_predicates_for_table_excludes_self(mocker: MockerFixture) -> None:
    """
    When ``exclude_dataset_id`` is supplied, the lookup query must add an
    ``id != exclude_dataset_id`` filter so a virtual dataset whose
    ``table_name`` matches a table referenced inside its own SQL doesn't get
    its own RLS injected into the inner SQL (would double-apply on top of the
    outer WHERE). Regression test for the physical→virtual conversion bug.
    """
    database = mocker.MagicMock()
    db = mocker.patch("superset.utils.rls.db")
    db.session.query().filter().one_or_none.return_value = None

    table = Table("orders", "public", "examples")
    assert (
        get_predicates_for_table(table, database, "examples", exclude_dataset_id=42)
        == []
    )
    # The filter call should have received four base filters plus the exclusion
    # filter, i.e. five total positional args inside and_().
    filter_call = db.session.query().filter.call_args
    and_clause = filter_call.args[0]
    assert len(and_clause.clauses) == 5
