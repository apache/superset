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
"""
Removing Superset's row cap from a SQL Lab query, and keeping the user's own.

SQL Lab bakes ``min(dropdown limit, SQL_MAX_ROW)`` plus one truncation-probe
row into the SQL it runs, so a full export has to take that cap back out of
``Query.executed_sql`` -- the only rendered copy there is, since the original
template params are not persisted.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from superset.commands.sql_lab.streaming_export_command import (
    FullStreamingSqlResultExportCommand,
)
from superset.db_engine_specs.oracle import OracleEngineSpec
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.exceptions import SupersetErrorException
from superset.sqllab.limiting_factor import LimitingFactor


def _command(
    *,
    sql: str = "SELECT a FROM t",
    executed_sql: str = "SELECT a FROM t LIMIT 100001",
    limiting_factor: str = LimitingFactor.DROPDOWN,
    select_sql: str | None = None,
    spec: type = PostgresEngineSpec,
) -> FullStreamingSqlResultExportCommand:
    query = MagicMock()
    query.client_id = "abc"
    query.sql = sql
    query.executed_sql = executed_sql
    query.select_sql = select_sql
    query.limiting_factor = limiting_factor
    query.catalog = None
    query.schema = None
    query.database.db_engine_spec = spec
    command = FullStreamingSqlResultExportCommand("abc")
    command._query = query  # noqa: SLF001
    return command


def test_supersets_own_cap_is_removed_from_the_exported_sql() -> None:
    command = _command()

    sql, _database, _catalog, _schema = command._get_sql_and_database()  # noqa: SLF001

    assert "LIMIT" not in sql.upper()
    assert command._get_row_limit() is None  # noqa: SLF001


def test_a_limit_the_user_wrote_themselves_is_kept() -> None:
    """Their ``LIMIT 10`` is part of their query, not a server cap, so a full
    export of that query still returns ten rows."""
    command = _command(
        sql="SELECT a FROM t LIMIT 10",
        executed_sql="SELECT a FROM t LIMIT 11",
        limiting_factor=LimitingFactor.QUERY,
    )

    sql, _database, _catalog, _schema = command._get_sql_and_database()  # noqa: SLF001

    assert sql == "SELECT a FROM t LIMIT 11"
    assert command._get_row_limit() == 10  # noqa: SLF001


def test_a_limit_equal_to_the_dropdown_is_treated_as_the_users_own() -> None:
    command = _command(
        sql="SELECT a FROM t LIMIT 1000",
        executed_sql="SELECT a FROM t LIMIT 1001",
        limiting_factor=LimitingFactor.QUERY_AND_DROPDOWN,
    )

    sql, _database, _catalog, _schema = command._get_sql_and_database()  # noqa: SLF001

    assert sql == "SELECT a FROM t LIMIT 1001"
    assert command._get_row_limit() == 1000  # noqa: SLF001


def test_a_users_larger_limit_is_restored_when_the_cap_replaced_it() -> None:
    """``apply_limit`` overwrites a larger authored ``LIMIT`` in place, which
    is the other way ``limiting_factor`` lands on DROPDOWN. Dropping the cap
    without putting their limit back would return more rows than they asked
    for."""
    command = _command(
        sql="SELECT a FROM t LIMIT 500000",
        executed_sql="SELECT a FROM t LIMIT 100001",
        limiting_factor=LimitingFactor.DROPDOWN,
    )

    sql, _database, _catalog, _schema = command._get_sql_and_database()  # noqa: SLF001

    assert "LIMIT 500000" in sql


def test_an_unparseable_authored_query_exports_uncapped() -> None:
    """Jinja can make ``Query.sql`` unreadable. "No limit of their own" is what
    the requester asked for anyway, so it is the safe reading."""
    command = _command(
        sql="SELECT a FROM {{ not_sql ( ",
        executed_sql="SELECT a FROM t LIMIT 100001",
        limiting_factor=LimitingFactor.DROPDOWN,
    )

    sql, _database, _catalog, _schema = command._get_sql_and_database()  # noqa: SLF001

    assert "LIMIT" not in sql.upper()


def test_a_ctas_query_reads_its_results_back_uncapped_already() -> None:
    command = _command(select_sql="SELECT * FROM tmp_table")

    sql, _database, _catalog, _schema = command._get_sql_and_database()  # noqa: SLF001

    assert sql == "SELECT * FROM tmp_table"
    assert command._get_row_limit() is None  # noqa: SLF001


def test_a_query_with_no_cap_at_all_is_exported_as_stored() -> None:
    command = _command(
        executed_sql="SELECT a FROM t", limiting_factor=LimitingFactor.NOT_LIMITED
    )

    sql, _database, _catalog, _schema = command._get_sql_and_database()  # noqa: SLF001

    assert sql == "SELECT a FROM t"


def test_a_cap_that_cannot_be_removed_is_refused_rather_than_truncated() -> None:
    """Oracle releases without ``FETCH FIRST`` get a ``ROWNUM`` filter instead
    of a ``LIMIT``, which is a predicate rather than a clause to drop.
    Exporting anyway would silently stop at the cap."""
    command = _command(
        executed_sql="SELECT * FROM (SELECT a FROM t) WHERE ROWNUM <= 100001",
        spec=OracleEngineSpec,
    )

    with pytest.raises(SupersetErrorException) as excinfo:
        command._get_sql_and_database()  # noqa: SLF001

    assert excinfo.value.status == 400
    assert "cannot be removed" in str(excinfo.value.error.message)


def test_a_multi_statement_script_is_refused() -> None:
    """Engines that run a whole script as one block store every statement.
    Only the last returns rows, but running it alone would drop what the
    earlier ones set up."""
    command = _command(
        executed_sql="CREATE TEMP TABLE x AS SELECT 1; SELECT * FROM x LIMIT 100001"
    )

    with pytest.raises(SupersetErrorException) as excinfo:
        command._get_sql_and_database()  # noqa: SLF001

    assert excinfo.value.status == 400
    assert "multiple statements" in str(excinfo.value.error.message)


def test_the_stored_sql_is_parsed_once_for_both_the_sql_and_the_limit() -> None:
    """``run()`` asks for both; resolving twice would reparse and re-raise."""
    command = _command()

    first, *_ = command._get_sql_and_database()  # noqa: SLF001
    command._get_row_limit()  # noqa: SLF001
    second, *_ = command._get_sql_and_database()  # noqa: SLF001

    assert first == second
    assert command._resolved_sql is not command._UNRESOLVED  # noqa: SLF001
