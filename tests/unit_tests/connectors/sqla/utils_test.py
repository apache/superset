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

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from pytest_mock import MockerFixture

from superset.connectors.sqla.utils import (
    get_columns_description,
    get_virtual_table_metadata,
)
from superset.exceptions import SupersetSecurityException
from superset.models.core import Database


# Returns column descriptions when given valid database, catalog, schema, and query
def test_returns_column_descriptions(mocker: MockerFixture) -> None:
    database = mocker.MagicMock()
    cursor = mocker.MagicMock()

    result_set = mocker.MagicMock()
    db_engine_spec = mocker.MagicMock()

    CURSOR_DESCR = (  # noqa: N806
        ("foo", "string"),
        ("bar", "string"),
        ("baz", "string"),
        ("type_generic", "string"),
        ("is_dttm", "boolean"),
    )
    cursor.description = CURSOR_DESCR

    database.get_raw_connection.return_value.__enter__.return_value.cursor.return_value = cursor  # noqa: E501
    database.db_engine_spec = db_engine_spec
    database.apply_limit_to_sql.return_value = "SELECT * FROM table LIMIT 1"
    database.mutate_sql_based_on_config.return_value = "SELECT * FROM table LIMIT 1"
    db_engine_spec.fetch_data.return_value = [("col1", "col1", "STRING", None, False)]
    db_engine_spec.get_datatype.return_value = "STRING"
    db_engine_spec.resolve_column_type.return_value = "STRING"
    db_engine_spec.get_column_spec.return_value.is_dttm = False
    db_engine_spec.get_column_spec.return_value.generic_type = "STRING"

    mocker.patch("superset.result_set.SupersetResultSet", return_value=result_set)

    columns = get_columns_description(
        database, "catalog", "schema", "SELECT * FROM table"
    )

    assert columns == [
        {
            "column_name": "foo",
            "name": "foo",
            "type": "STRING",
            "type_generic": "STRING",
            "is_dttm": False,
        },
        {
            "column_name": "bar",
            "name": "bar",
            "type": "STRING",
            "type_generic": "STRING",
            "is_dttm": False,
        },
        {
            "column_name": "baz",
            "name": "baz",
            "type": "STRING",
            "type_generic": "STRING",
            "is_dttm": False,
        },
        {
            "column_name": "type_generic",
            "name": "type_generic",
            "type": "STRING",
            "type_generic": "STRING",
            "is_dttm": False,
        },
        {
            "column_name": "is_dttm",
            "name": "is_dttm",
            "type": "STRING",
            "type_generic": "STRING",
            "is_dttm": False,
        },
    ]


def _create_zero_row_database(tmp_path: Path) -> tuple[Database, str]:
    """
    Create a real SQLite-backed ``Database`` and a query that matches zero rows.

    The table itself contains data, but the ``WHERE`` clause filters everything
    out — mirroring the repro steps in issue #37609 (a virtual dataset whose
    date filter matches no rows).
    """
    db_path = tmp_path / "zero_rows.db"
    with closing(sqlite3.connect(db_path)) as conn:
        conn.execute("CREATE TABLE events (id INTEGER, name TEXT, event_date TEXT)")
        conn.execute("INSERT INTO events VALUES (1, 'a', '2026-01-01')")
        conn.commit()

    database = Database(
        id=1,
        database_name="zero_rows_db",
        sqlalchemy_uri=f"sqlite:///{db_path}",
    )
    query = "SELECT id, name, event_date FROM events WHERE event_date = '2026-02-01'"
    return database, query


def test_get_columns_description_zero_row_query(tmp_path: Path) -> None:
    """
    Column metadata must be derived from the cursor description even when the
    query returns zero rows.

    Executes a real query against a real (SQLite) database instead of mocking
    the cursor, so this covers the full path used when a virtual dataset's
    columns are synced: ``get_columns_description`` -> raw connection ->
    ``SupersetResultSet.columns``.

    Regression test for https://github.com/apache/superset/issues/37609
    """
    database, query = _create_zero_row_database(tmp_path)

    columns = get_columns_description(database, None, None, query)

    assert [col["column_name"] for col in columns] == ["id", "name", "event_date"]
    assert all(col["name"] for col in columns)


def test_get_virtual_table_metadata_zero_row_query(
    mocker: MockerFixture, tmp_path: Path
) -> None:
    """
    ``get_virtual_table_metadata`` (the entry point used by "Sync columns from
    source" / dataset metadata refresh) must return the column metadata for a
    virtual dataset whose query returns zero rows.

    Regression test for https://github.com/apache/superset/issues/37609
    """
    database, query = _create_zero_row_database(tmp_path)

    dataset = mocker.MagicMock(
        sql=query,
        catalog=None,
        schema=None,
        database=database,
        template_params_dict={},
    )
    dataset.get_template_processor().process_template.return_value = query

    columns = get_virtual_table_metadata(dataset=dataset)

    assert [col["column_name"] for col in columns] == ["id", "name", "event_date"]


def test_get_virtual_table_metadata(mocker: MockerFixture) -> None:
    """
    Test the `get_virtual_table_metadata` function.
    """
    mocker.patch(
        "superset.connectors.sqla.utils.get_columns_description",
        return_value=[{"name": "one", "type": "INTEGER"}],
    )
    dataset = mocker.MagicMock(
        sql="with source as ( select 1 as one ) select * from source",
    )
    dataset.database.db_engine_spec.engine = "postgresql"
    dataset.get_template_processor().process_template.return_value = dataset.sql

    assert get_virtual_table_metadata(dataset) == [{"name": "one", "type": "INTEGER"}]


def test_get_virtual_table_metadata_mutating(mocker: MockerFixture) -> None:
    """
    Test the `get_virtual_table_metadata` function with mutating SQL.
    """
    dataset = mocker.MagicMock(sql="DROP TABLE sample_data")
    dataset.database.db_engine_spec.engine = "postgresql"
    dataset.get_template_processor().process_template.return_value = dataset.sql

    with pytest.raises(SupersetSecurityException) as excinfo:
        get_virtual_table_metadata(dataset)
    assert str(excinfo.value) == "Only `SELECT` statements are allowed"


def test_get_virtual_table_metadata_multiple(mocker: MockerFixture) -> None:
    """
    Test the `get_virtual_table_metadata` function with multiple statements.
    """
    dataset = mocker.MagicMock(sql="SELECT 1; SELECT 2")
    dataset.database.db_engine_spec.engine = "postgresql"
    dataset.get_template_processor().process_template.return_value = dataset.sql

    with pytest.raises(SupersetSecurityException) as excinfo:
        get_virtual_table_metadata(dataset)
    assert str(excinfo.value) == "Only single queries supported"


def test_get_virtual_table_metadata_renders_jinja(mocker: MockerFixture) -> None:
    """Regression for #25839: Jinja templates in a virtual dataset's SQL must
    be rendered via the template processor before SQL parsing. Otherwise the
    raw Jinja tokens reach sqlglot and the parser rejects them as a syntax
    error (the user-visible symptom is "Invalid SQL" when clicking
    "SYNC COLUMNS FROM SOURCE" on a dataset that uses {{ from_dttm }} etc.).
    """
    mock_get_columns_description = mocker.patch(
        "superset.connectors.sqla.utils.get_columns_description",
        return_value=[{"name": "rendered_col", "type": "INTEGER"}],
    )

    raw_sql = "SELECT * FROM tbl WHERE ts > '{{ from_dttm }}'"
    rendered_sql = "SELECT * FROM tbl WHERE ts > '2024-01-01 00:00:00'"

    dataset = mocker.MagicMock(sql=raw_sql)
    dataset.database.db_engine_spec.engine = "postgresql"
    dataset.template_params_dict = {}
    dataset.get_template_processor().process_template.return_value = rendered_sql

    # If Jinja rendering is skipped, sqlglot tries to parse the raw {{ ... }}
    # and raises SupersetGenericDBErrorException / SupersetParseError.
    assert get_virtual_table_metadata(dataset) == [
        {"name": "rendered_col", "type": "INTEGER"}
    ]

    # The template processor MUST have been called with the raw SQL (the
    # whole point of the bug fix). A future regression that re-introduces
    # the "Jinja not rendered" path would either skip this call or call it
    # with the wrong input.
    dataset.get_template_processor().process_template.assert_any_call(
        raw_sql, **dataset.template_params_dict
    )

    # End-to-end guard: the rendered SQL must reach get_columns_description,
    # not the raw Jinja string. A regression where rendering is used for
    # parsing only and the raw SQL leaks downstream would pass the
    # process_template assertion above but fail this one.
    call_args = mock_get_columns_description.call_args
    assert call_args is not None, "get_columns_description was never called"
    passed_query = call_args.kwargs.get("query")
    if passed_query is None and call_args.args:
        passed_query = call_args.args[-1]
    assert passed_query == rendered_sql, (
        f"get_columns_description received unrendered SQL: {passed_query!r}"
    )
