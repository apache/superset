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
"""Unit tests for SQL Lab CSV export."""

from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock

import pandas as pd
import pytest
from pytest_mock import MockerFixture

from superset.commands.sql_lab.export import SqlResultExportCommand
from superset.sqllab.limiting_factor import LimitingFactor
from superset.utils import csv
from superset.utils.fetch_memory_cap import is_fetch_memory_cap_disabled


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("0E-18", "0.000000000000000000"),
        ("-1E-7", "-0.0000001"),
        ("1E+30", "1000000000000000000000000000000"),
        ("12.3400", "12.3400"),
        ("NaN", ""),
        ("Infinity", "Infinity"),
        ("-Infinity", "-Infinity"),
    ],
)
def test_csv_export_without_results_backend_preserves_decimals(
    mocker: MockerFixture, value: str, expected: str
) -> None:
    """Re-executed query results use exact fixed-point decimal text."""
    mocker.patch("superset.commands.sql_lab.export.results_backend", None)
    mocker.patch.dict("superset.commands.sql_lab.export.app.config", {"CSV_EXPORT": {}})
    csv_spy = mocker.spy(csv, "df_to_escaped_csv")
    decimal_value = Decimal(value)
    query = MagicMock()
    query.select_sql = "SELECT amount FROM numbers"
    query.database.get_df.return_value = pd.DataFrame(
        {"amount": [decimal_value], "other": ["unchanged"]}, dtype=object
    )
    mock_db = mocker.patch("superset.commands.sql_lab.export.db")
    query_result = mock_db.session.query.return_value.filter_by.return_value
    query_result.one_or_none.return_value = query

    result = SqlResultExportCommand("client_id").run()

    assert result["data"] == f"amount,other\n{expected},unchanged\n".encode()
    assert result["count"] == 1
    query.database.get_df.assert_called_once_with(
        query.select_sql, query.catalog, query.schema
    )
    if not decimal_value.is_finite():
        assert csv_spy.call_args.args[0].at[0, "amount"] is decimal_value


@pytest.mark.parametrize("decimal_separator", [".", ","])
def test_csv_export_mixed_frame_is_byte_identical(
    mocker: MockerFixture, decimal_separator: str
) -> None:
    """Column mapping preserves mixed values and untouched numeric columns."""
    mocker.patch("superset.commands.sql_lab.export.results_backend", None)
    mocker.patch.dict(
        "superset.commands.sql_lab.export.app.config",
        {"CSV_EXPORT": {"sep": ";", "decimal": decimal_separator}},
    )
    query: MagicMock = MagicMock()
    query.select_sql = "SELECT * FROM numbers"
    frame: pd.DataFrame = pd.DataFrame(
        {
            "mixed": [Decimal("12.3400"), 1.25, "=formula", None, Decimal("NaN")],
            "float": [1.25, 2.5, 3.75, 4.0, 5.0],
            "nullable": pd.Series([1, None, 3, 4, 5], dtype=object),
        },
    )
    frame.index = [10, 20, 30, 40, 50]
    query.database.get_df.return_value = frame
    mock_db: MagicMock = mocker.patch("superset.commands.sql_lab.export.db")
    query_result: MagicMock = mock_db.session.query.return_value.filter_by.return_value
    query_result.one_or_none.return_value = query
    formatter: MagicMock = mocker.spy(csv, "format_decimal")

    result = SqlResultExportCommand("client_id").run()

    expected: str = (
        "mixed;float;nullable\n"
        "12.3400;1.25;1\n"
        "1.25;2.5;\n"
        "'=formula;3.75;3\n"
        ";4.0;4\n"
        ";5.0;5\n"
    )
    if decimal_separator == ",":
        # Pandas applies the separator to float columns, not mixed object cells.
        expected = expected.replace(";1.25;", ";1,25;").replace(";2.5;", ";2,5;")
        expected = expected.replace(";3.75;", ";3,75;").replace(";4.0;", ";4,0;")
        expected = expected.replace(";5.0;", ";5,0;")
    assert result["data"] == expected.encode()
    assert result["count"] == 5
    assert formatter.call_count == 5


@pytest.mark.parametrize(
    ("limiting_factor", "uses_results_backend"),
    [
        (LimitingFactor.MEMORY, False),
        (LimitingFactor.DROPDOWN, True),
        (LimitingFactor.NOT_LIMITED, True),
    ],
)
def test_csv_export_reruns_memory_truncated_results_without_cap(
    mocker: MockerFixture,
    limiting_factor: LimitingFactor,
    uses_results_backend: bool,
) -> None:
    """
    Stored SQL Lab results cut short by an engine fetch memory cap are
    incomplete, so the export reruns the query without the cap, keeping the
    row limit. Other stored results are exported as they are.
    """
    results_backend = mocker.patch(
        "superset.commands.sql_lab.export.results_backend", new_callable=MagicMock
    )
    results_backend.get.return_value = b"blob"
    mocker.patch(
        "superset.commands.sql_lab.export.utils.zlib_decompress", return_value="{}"
    )
    mocker.patch(
        "superset.commands.sql_lab.export._deserialize_results_payload",
        return_value={"data": [{"n": 1}], "columns": [{"name": "n"}]},
    )
    mocker.patch.dict("superset.commands.sql_lab.export.app.config", {"CSV_EXPORT": {}})
    query = MagicMock()
    query.results_key = "key"
    query.select_sql = None
    query.executed_sql = "SELECT n FROM t LIMIT 4"
    query.limiting_factor = limiting_factor
    query.database.db_engine_spec.engine = "bigquery"
    cap_disabled: list[bool] = []

    def get_df(*_: Any) -> pd.DataFrame:
        cap_disabled.append(is_fetch_memory_cap_disabled())
        return pd.DataFrame({"n": [1, 2, 3, 4]})

    query.database.get_df.side_effect = get_df
    mock_db = mocker.patch("superset.commands.sql_lab.export.db")
    query_result = mock_db.session.query.return_value.filter_by.return_value
    query_result.one_or_none.return_value = query

    result = SqlResultExportCommand("client_id").run()

    if uses_results_backend:
        assert result["count"] == 1
        query.database.get_df.assert_not_called()
    else:
        # LIMIT 4 holds the extra probe row, so 3 rows are exported.
        assert result["count"] == 3
        assert cap_disabled == [True]
    assert is_fetch_memory_cap_disabled() is False


def test_csv_export_never_reruns_mutating_memory_truncated_scripts(
    mocker: MockerFixture,
) -> None:
    """
    Rerunning a memory-truncated script that mutates data would apply the
    mutation again, so its stored rows are exported instead.
    """
    results_backend = mocker.patch(
        "superset.commands.sql_lab.export.results_backend", new_callable=MagicMock
    )
    results_backend.get.return_value = b"blob"
    mocker.patch(
        "superset.commands.sql_lab.export.utils.zlib_decompress", return_value="{}"
    )
    mocker.patch(
        "superset.commands.sql_lab.export._deserialize_results_payload",
        return_value={"data": [{"n": 1}], "columns": [{"name": "n"}]},
    )
    mocker.patch.dict("superset.commands.sql_lab.export.app.config", {"CSV_EXPORT": {}})
    query = MagicMock()
    query.results_key = "key"
    query.select_sql = None
    query.executed_sql = "INSERT INTO log VALUES (1);\nSELECT n FROM t LIMIT 4"
    query.limiting_factor = LimitingFactor.MEMORY
    query.database.db_engine_spec.engine = "bigquery"
    mock_db = mocker.patch("superset.commands.sql_lab.export.db")
    query_result = mock_db.session.query.return_value.filter_by.return_value
    query_result.one_or_none.return_value = query

    result = SqlResultExportCommand("client_id").run()

    assert result["count"] == 1
    query.database.get_df.assert_not_called()


@pytest.mark.parametrize(
    "limiting_factor", [LimitingFactor.MEMORY, LimitingFactor.NOT_LIMITED]
)
@pytest.mark.parametrize("missing_results", ["backend", "key", "blob"])
@pytest.mark.parametrize("use_select_sql", [False, True])
def test_csv_export_rejects_mutating_scripts_without_stored_results(
    mocker: MockerFixture,
    limiting_factor: LimitingFactor,
    missing_results: str,
    use_select_sql: bool,
) -> None:
    """Missing stored results must not cause an export to repeat writes."""
    from superset.exceptions import SupersetErrorException

    backend = mocker.patch(
        "superset.commands.sql_lab.export.results_backend", new_callable=MagicMock
    )
    backend.get.return_value = None
    if missing_results == "backend":
        mocker.patch("superset.commands.sql_lab.export.results_backend", None)
    query = MagicMock()
    query.results_key = None if missing_results == "key" else "key"
    sql = "INSERT INTO log VALUES (1); SELECT n FROM t LIMIT 4"
    query.select_sql = sql if use_select_sql else None
    query.executed_sql = "SELECT 1" if use_select_sql else sql
    query.limiting_factor = limiting_factor
    query.database.db_engine_spec.engine = "bigquery"
    command = SqlResultExportCommand("client_id")
    mocker.patch.object(command, "validate")
    command._query = query

    with pytest.raises(SupersetErrorException, match="modify data or schema") as exc:
        command.run()

    assert exc.value.status == 400
    query.database.get_df.assert_not_called()


@pytest.mark.parametrize(
    "sql",
    [
        "BEGIN INSERT INTO t VALUES (1); SELECT 1; END;",
        "BEGIN UPDATE t SET n=1; SELECT 1; END;",
        "BEGIN DELETE FROM t WHERE TRUE; SELECT 1; END;",
        "BEGIN MERGE t USING s ON FALSE WHEN NOT MATCHED THEN INSERT ROW; END;",
        "BEGIN CREATE TABLE t(n INT64); SELECT 1; END;",
        "BEGIN ALTER TABLE t ADD COLUMN n INT64; END;",
        "BEGIN DROP TABLE t; END;",
        "IF TRUE THEN INSERT INTO t VALUES (1); END IF;",
        "WHILE TRUE DO UPDATE t SET n=1; END WHILE;",
        "LOOP DELETE FROM t WHERE TRUE; END LOOP;",
        "FOR r IN (SELECT 1) DO IF TRUE THEN INSERT INTO t VALUES (1); "
        "END IF; END FOR;",
        "BEGIN SELECT 1; EXCEPTION WHEN ERROR THEN INSERT INTO t VALUES (1); END;",
        "REPEAT INSERT INTO t VALUES (1); UNTIL TRUE END REPEAT;",
        "block: BEGIN INSERT INTO t VALUES (1); END block;",
        "IF FALSE THEN SELECT 1; ELSE INSERT INTO t VALUES (1); END IF;",
        "IF FALSE THEN SELECT 1; ELSE UPDATE t SET n=1; END IF;",
        "IF TRUE THEN SELECT 1; ELSE SELECT 2; END IF; DELETE FROM t WHERE TRUE;",
        "IF TRUE THEN SELECT 1; ELSE SELECT 2; END IF; CREATE TABLE t(n INT64);",
        "IF TRUE THEN SELECT 1; ELSE SELECT 2; END IF; "
        "IF FALSE THEN SELECT 3; ELSE INSERT INTO t VALUES (1); END IF;",
        "LOAD DATA INTO t FROM FILES(format='CSV', uris=['gs://bucket/data.csv']);",
        "LOAD DATA OVERWRITE t FROM FILES(format='CSV', uris=['gs://bucket/data.csv']);",
        "IF TRUE THEN SELECT 1; ELSE SELECT 2; END IF;",
        "BEGIN SELECT 1; END;",
    ],
)
@pytest.mark.parametrize(
    ("stored_results", "limiting_factor"),
    [
        (False, LimitingFactor.NOT_LIMITED),
        (False, LimitingFactor.MEMORY),
        (True, LimitingFactor.MEMORY),
    ],
)
def test_csv_export_never_reruns_bigquery_script_blocks(
    mocker: MockerFixture,
    sql: str,
    stored_results: bool,
    limiting_factor: LimitingFactor,
) -> None:
    """Opaque scripting bodies must not repeat writes during CSV downloads."""
    from superset.exceptions import SupersetErrorException

    backend = mocker.patch(
        "superset.commands.sql_lab.export.results_backend", new_callable=MagicMock
    )
    backend.get.return_value = b"blob" if stored_results else None
    mocker.patch(
        "superset.commands.sql_lab.export.utils.zlib_decompress", return_value="{}"
    )
    mocker.patch(
        "superset.commands.sql_lab.export._deserialize_results_payload",
        return_value={"data": [{"n": 1}], "columns": [{"name": "n"}]},
    )
    mocker.patch.dict("superset.commands.sql_lab.export.app.config", {"CSV_EXPORT": {}})
    query = MagicMock()
    query.results_key = "key"
    query.select_sql = None
    query.executed_sql = sql
    query.limiting_factor = limiting_factor
    query.database.db_engine_spec.engine = "bigquery"
    command = SqlResultExportCommand("client_id")
    mocker.patch.object(command, "validate")
    command._query = query

    if stored_results:
        assert command.run()["data"] == b"n\n1\n"
        backend.get.assert_called_once_with("key")
    else:
        with pytest.raises(SupersetErrorException) as exc:
            command.run()
        assert exc.value.status == 400
    query.database.get_df.assert_not_called()


@pytest.mark.parametrize(
    "engine, sql",
    [
        ("mysql", "SHOW TABLES FROM some_schema"),
        ("mysql", "SHOW TABLES"),
        ("postgresql", "SHOW server_version"),
        ("kustokql", "print 1"),
    ],
)
@pytest.mark.parametrize("use_select_sql", [False, True])
@pytest.mark.parametrize("missing_results", ["backend", "key", "blob"])
def test_csv_export_reruns_non_bigquery_metadata_and_kql_reads(
    mocker: MockerFixture,
    engine: str,
    sql: str,
    use_select_sql: bool,
    missing_results: str,
) -> None:
    """Opaque metadata reads and KQL retain the export fallback to get_df."""
    from superset.sql.parse import SQLScript

    script = SQLScript(sql, engine)
    assert not script.has_opaque_scripting_body()
    assert not script.has_mutation()
    backend = mocker.patch(
        "superset.commands.sql_lab.export.results_backend", new_callable=MagicMock
    )
    backend.get.return_value = None
    if missing_results == "backend":
        mocker.patch("superset.commands.sql_lab.export.results_backend", None)
    mocker.patch.dict("superset.commands.sql_lab.export.app.config", {"CSV_EXPORT": {}})
    query = MagicMock()
    query.results_key = None if missing_results == "key" else "key"
    query.select_sql = sql if use_select_sql else None
    query.executed_sql = "SELECT 1" if use_select_sql else sql
    query.limiting_factor = LimitingFactor.NOT_LIMITED
    query.database.db_engine_spec.engine = engine
    query.database.get_df.return_value = pd.DataFrame({"n": [1, 2]})
    command = SqlResultExportCommand("client_id")
    mocker.patch.object(command, "validate")
    command._query = query

    result = command.run()

    assert result["data"] == b"n\n1\n2\n"
    assert result["count"] == 2
    query.database.get_df.assert_called_once_with(sql, query.catalog, query.schema)


@pytest.mark.parametrize("use_select_sql", [False, True])
def test_csv_export_bigquery_unparseable_script_uses_stored_rows(
    mocker: MockerFixture, use_select_sql: bool
) -> None:
    """A BigQuery opaque body stays fail-closed even without detected mutations."""
    from superset.sql.parse import SQLScript

    sql = "IF TRUE THEN SELECT 1; ELSE SELECT 2; END IF;"
    script = SQLScript(sql, "bigquery")
    assert script.has_unparseable_statement
    assert not script.has_mutation()
    backend = mocker.patch(
        "superset.commands.sql_lab.export.results_backend", new_callable=MagicMock
    )
    backend.get.return_value = b"blob"
    mocker.patch(
        "superset.commands.sql_lab.export.utils.zlib_decompress", return_value="{}"
    )
    mocker.patch(
        "superset.commands.sql_lab.export._deserialize_results_payload",
        return_value={"data": [{"n": 1}], "columns": [{"name": "n"}]},
    )
    mocker.patch.dict("superset.commands.sql_lab.export.app.config", {"CSV_EXPORT": {}})
    query = MagicMock()
    query.results_key = "key"
    query.select_sql = sql if use_select_sql else None
    query.executed_sql = "SELECT 1" if use_select_sql else sql
    query.limiting_factor = LimitingFactor.MEMORY
    query.database.db_engine_spec.engine = "bigquery"
    command = SqlResultExportCommand("client_id")
    mocker.patch.object(command, "validate")
    command._query = query

    assert command.run()["data"] == b"n\n1\n"
    backend.get.assert_called_once_with("key")
    query.database.get_df.assert_not_called()


@pytest.mark.parametrize(
    "engine, sql",
    [
        ("mssql", "BEGIN INSERT INTO log VALUES (1) END; SELECT n FROM t"),
        ("mysql", "IF TRUE THEN INSERT INTO log VALUES (1); END IF; SELECT n FROM t"),
    ],
)
@pytest.mark.parametrize("use_select_sql", [False, True])
@pytest.mark.parametrize("missing_results", ["backend", "key", "blob", None])
@pytest.mark.parametrize(
    "limiting_factor", [LimitingFactor.MEMORY, LimitingFactor.NOT_LIMITED]
)
def test_csv_export_never_reruns_opaque_blocks(
    mocker: MockerFixture,
    engine: str,
    sql: str,
    use_select_sql: bool,
    missing_results: str | None,
    limiting_factor: LimitingFactor,
) -> None:
    """Opaque blocks use stored rows or refuse export, regardless of engine."""
    from superset.exceptions import SupersetErrorException
    from superset.sql.parse import SQLScript

    script = SQLScript(sql, engine)
    assert script.has_unparseable_statement
    assert not script.has_mutation()
    backend = mocker.patch(
        "superset.commands.sql_lab.export.results_backend", new_callable=MagicMock
    )
    backend.get.return_value = None if missing_results else b"blob"
    if missing_results == "backend":
        mocker.patch("superset.commands.sql_lab.export.results_backend", None)
    mocker.patch(
        "superset.commands.sql_lab.export.utils.zlib_decompress", return_value="{}"
    )
    mocker.patch(
        "superset.commands.sql_lab.export._deserialize_results_payload",
        return_value={"data": [{"n": 1}], "columns": [{"name": "n"}]},
    )
    mocker.patch.dict("superset.commands.sql_lab.export.app.config", {"CSV_EXPORT": {}})
    query = MagicMock()
    query.results_key = None if missing_results == "key" else "key"
    query.select_sql = sql if use_select_sql else None
    query.executed_sql = "SELECT 1" if use_select_sql else sql
    query.limiting_factor = limiting_factor
    query.database.db_engine_spec.engine = engine
    command = SqlResultExportCommand("client_id")
    mocker.patch.object(command, "validate")
    command._query = query

    if missing_results:
        with pytest.raises(
            SupersetErrorException, match="modify data or schema"
        ) as exc:
            command.run()
        assert exc.value.status == 400
    else:
        assert command.run()["data"] == b"n\n1\n"
        backend.get.assert_called_once_with("key")
    query.database.get_df.assert_not_called()


@pytest.mark.parametrize(
    "sql",
    [
        "BEGIN SELECT 1 END; SELECT 2",
        "BEGIN TRY SELECT 1 END TRY BEGIN CATCH SELECT 2 END CATCH",
    ],
)
@pytest.mark.parametrize("use_select_sql", [False, True])
@pytest.mark.parametrize("streaming", [False, True])
@pytest.mark.parametrize("missing_results", ["backend", "key", "blob", None])
@pytest.mark.parametrize(
    "limiting_factor", [LimitingFactor.MEMORY, LimitingFactor.NOT_LIMITED]
)
def test_csv_export_read_only_opaque_blocks_require_stored_results(
    mocker: MockerFixture,
    sql: str,
    use_select_sql: bool,
    streaming: bool,
    missing_results: str | None,
    limiting_factor: LimitingFactor,
) -> None:
    """Read-only opaque SQL Server blocks need stored rows on both export paths."""
    from superset.commands.sql_lab.streaming_export_command import (
        StreamingSqlResultExportCommand,
    )
    from superset.exceptions import SupersetErrorException
    from superset.sql.parse import SQLScript

    script = SQLScript(sql, "mssql")
    assert script.has_opaque_scripting_body()
    assert not script.has_mutation()
    backend = mocker.patch(
        "superset.commands.sql_lab.export.results_backend", new_callable=MagicMock
    )
    backend.get.return_value = None if missing_results else b"blob"
    if missing_results == "backend":
        mocker.patch("superset.commands.sql_lab.export.results_backend", None)
    mocker.patch(
        "superset.commands.sql_lab.export.utils.zlib_decompress", return_value="{}"
    )
    mocker.patch(
        "superset.commands.sql_lab.export._deserialize_results_payload",
        return_value={"data": [{"n": 1}], "columns": [{"name": "n"}]},
    )
    mocker.patch.dict("superset.commands.sql_lab.export.app.config", {"CSV_EXPORT": {}})
    query = MagicMock()
    query.results_key = None if missing_results == "key" else "key"
    query.select_sql = sql if use_select_sql else None
    query.executed_sql = "SELECT 1" if use_select_sql else sql
    query.limiting_factor = limiting_factor
    query.database.db_engine_spec.engine = "mssql"
    mock_db = mocker.patch("superset.commands.sql_lab.export.db")
    query_result = mock_db.session.query.return_value.filter_by.return_value
    query_result.one_or_none.return_value = query
    command = (
        StreamingSqlResultExportCommand("client_id")
        if streaming
        else SqlResultExportCommand("client_id")
    )
    command._query = query

    if missing_results:
        with pytest.raises(
            SupersetErrorException, match="opaque control-flow blocks on any engine"
        ) as exc:
            command.run()
        assert exc.value.status == 400
        assert "stored results" in str(exc.value)
        assert "standalone read-only query" in str(exc.value)
    elif isinstance(command, StreamingSqlResultExportCommand):
        assert "".join(command.run()()) == "n\n1\n"
        backend.get.assert_called_once_with("key")
    else:
        assert command.run()["data"] == b"n\n1\n"
        backend.get.assert_called_once_with("key")

    if isinstance(command, StreamingSqlResultExportCommand):
        with pytest.raises(
            SupersetErrorException, match="opaque control-flow blocks on any engine"
        ):
            command._get_sql_and_database()
    query.database.get_df.assert_not_called()
    query.database.get_sqla_engine.assert_not_called()
