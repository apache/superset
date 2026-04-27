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

# pylint: disable=line-too-long, import-outside-toplevel, protected-access, invalid-name

from datetime import datetime
from typing import Any, Optional
from unittest import mock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select
from sqlalchemy.engine.url import make_url
from sqlalchemy.sql import sqltypes
from sqlalchemy_bigquery import BigQueryDialect

from superset.sql.parse import Table
from superset.superset_typing import ResultSetColumnType
from superset.utils import json
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


def test_get_fields() -> None:
    """
    Test the custom ``_get_fields`` method.

    The method adds custom labels (aliases) to the columns to prevent
    collision when referencing record fields. Eg, if we had these two
    columns:

        name STRING
        project STRUCT<name STRING>

    One could write this query:

        SELECT
            `name`,
            `project`.`name`
        FROM
            the_table

    But then both columns would get aliased as "name".

    The custom method will replace the fields so that the final query
    looks like this:

        SELECT
            `name` AS `name`,
            `project`.`name` AS project__name
        FROM
            the_table

    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    columns: list[ResultSetColumnType] = [
        {"column_name": "limit", "name": "limit", "type": "STRING", "is_dttm": False},
        {"column_name": "name", "name": "name", "type": "STRING", "is_dttm": False},
        {
            "column_name": "project.name",
            "name": "project.name",
            "type": "STRING",
            "is_dttm": False,
        },
    ]
    fields = BigQueryEngineSpec._get_fields(columns)

    query = select(fields)
    assert str(query.compile(dialect=BigQueryDialect())) == (
        "SELECT `limit` AS `limit`, `name` AS `name`, "
        "`project`.`name` AS `project__name`"
    )


def test_select_star(mocker: MockerFixture) -> None:
    """
    Test the ``select_star`` method.

    The method removes pseudo-columns from structures inside arrays. While these
    pseudo-columns show up as "columns" for metadata reasons, we can't select them
    in the query, as opposed to fields from non-array structures.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    cols: list[ResultSetColumnType] = [
        {
            "column_name": "trailer",
            "name": "trailer",
            "type": sqltypes.ARRAY(sqltypes.JSON()),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
            "is_dttm": False,
        },
        {
            "column_name": "trailer.key",
            "name": "trailer.key",
            "type": sqltypes.String(),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
            "is_dttm": False,
        },
        {
            "column_name": "trailer.value",
            "name": "trailer.value",
            "type": sqltypes.String(),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
            "is_dttm": False,
        },
        {
            "column_name": "trailer.email",
            "name": "trailer.email",
            "type": sqltypes.String(),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
            "is_dttm": False,
        },
    ]

    # mock the database so we can compile the query
    database = mocker.MagicMock()
    database.compile_sqla_query = lambda query, catalog, schema: str(
        query.compile(dialect=BigQueryDialect(), compile_kwargs={"literal_binds": True})
    )

    dialect = BigQueryDialect()

    sql = BigQueryEngineSpec.select_star(
        database=database,
        table=Table("my_table"),
        dialect=dialect,
        limit=100,
        show_cols=True,
        indent=True,
        latest_partition=False,
        cols=cols,
    )
    assert (
        sql
        == """SELECT
  `trailer` AS `trailer`
FROM `my_table`
LIMIT 100"""
    )


def test_get_parameters_from_uri_serializable() -> None:
    """
    Test that the result from ``get_parameters_from_uri`` is JSON serializable.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    parameters = BigQueryEngineSpec.get_parameters_from_uri(
        "bigquery://dbt-tutorial-347100/",
        {"access_token": "TOP_SECRET"},
    )
    assert parameters == {"access_token": "TOP_SECRET", "query": {}}
    assert json.loads(json.dumps(parameters)) == parameters


def test_unmask_encrypted_extra() -> None:
    """
    Test that the private key can be reused from the previous `encrypted_extra`.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    old = json.dumps(
        {
            "credentials_info": {
                "project_id": "black-sanctum-314419",
                "private_key": "SECRET",
            },
        }
    )
    new = json.dumps(
        {
            "credentials_info": {
                "project_id": "yellow-unicorn-314419",
                "private_key": "XXXXXXXXXX",
            },
        }
    )

    assert BigQueryEngineSpec.unmask_encrypted_extra(old, new) == json.dumps(
        {
            "credentials_info": {
                "project_id": "yellow-unicorn-314419",
                "private_key": "SECRET",
            },
        }
    )


def test_unmask_encrypted_extra_field_changeed() -> None:
    """
    Test that the private key is not reused when the field has changed.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    old = json.dumps(
        {
            "credentials_info": {
                "project_id": "black-sanctum-314419",
                "private_key": "SECRET",
            },
        }
    )
    new = json.dumps(
        {
            "credentials_info": {
                "project_id": "yellow-unicorn-314419",
                "private_key": "NEW-SECRET",
            },
        }
    )

    assert BigQueryEngineSpec.unmask_encrypted_extra(old, new) == json.dumps(
        {
            "credentials_info": {
                "project_id": "yellow-unicorn-314419",
                "private_key": "NEW-SECRET",
            },
        }
    )


def test_unmask_encrypted_extra_when_old_is_none() -> None:
    """
    Test that a `None` value for the old field works for `encrypted_extra`.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    old = None
    new = json.dumps(
        {
            "credentials_info": {
                "project_id": "yellow-unicorn-314419",
                "private_key": "XXXXXXXXXX",
            },
        }
    )

    assert BigQueryEngineSpec.unmask_encrypted_extra(old, new) == json.dumps(
        {
            "credentials_info": {
                "project_id": "yellow-unicorn-314419",
                "private_key": "XXXXXXXXXX",
            },
        }
    )


def test_unmask_encrypted_extra_when_new_is_none() -> None:
    """
    Test that a `None` value for the new field works for `encrypted_extra`.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    old = json.dumps(
        {
            "credentials_info": {
                "project_id": "black-sanctum-314419",
                "private_key": "SECRET",
            },
        }
    )
    new = None

    assert BigQueryEngineSpec.unmask_encrypted_extra(old, new) is None


def test_mask_encrypted_extra() -> None:
    """
    Test that the private key is masked when the database is edited.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    config = json.dumps(
        {
            "credentials_info": {
                "project_id": "black-sanctum-314419",
                "private_key": "SECRET",
            },
        }
    )

    assert BigQueryEngineSpec.mask_encrypted_extra(config) == json.dumps(
        {
            "credentials_info": {
                "project_id": "black-sanctum-314419",
                "private_key": "XXXXXXXXXX",
            },
        }
    )


def test_mask_encrypted_extra_when_empty() -> None:
    """
    Test that the encrypted extra will return a none value if the field is empty.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    assert BigQueryEngineSpec.mask_encrypted_extra(None) is None


def test_parse_error_message() -> None:
    """
    Test that we parse a received message and just extract the useful information.

    Example errors:
    bigquery error: 400 Syntax error:  Table \"case_detail_all_suites\" must be qualified with a dataset (e.g. dataset.table).

    (job ID: ddf30b05-44e8-4fbf-aa29-40bfccaed886)
                                                -----Query Job SQL Follows-----
    |    .    |    .    |    .    |\n   1:select * from case_detail_all_suites\n   2:LIMIT 1001\n    |    .    |    .    |    .    |
    """  # noqa: E501
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    message = 'bigquery error: 400 Syntax error: Table "case_detail_all_suites" must be qualified with a dataset (e.g. dataset.table).\n\n(job ID: ddf30b05-44e8-4fbf-aa29-40bfccaed886)\n\n     -----Query Job SQL Follows-----     \n\n    |    .    |    .    |    .    |\n   1:select * from case_detail_all_suites\n   2:LIMIT 1001\n    |    .    |    .    |    .    |'  # noqa: E501
    expected_result = 'bigquery error: 400 Syntax error: Table "case_detail_all_suites" must be qualified with a dataset (e.g. dataset.table).'  # noqa: E501
    assert (
        str(BigQueryEngineSpec.parse_error_exception(Exception(message)))
        == expected_result
    )


def test_parse_error_raises_exception() -> None:
    """
    Test that we handle any exception we might get from calling the parse_error_exception method.

    Example errors:
    400 Syntax error: Expected "(" or keyword UNNEST but got "@" at [4:80]
    bigquery error: 400 Table \"case_detail_all_suites\" must be qualified with a dataset (e.g. dataset.table).
    """  # noqa: E501
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    message = 'bigquery error: 400 Syntax error: Table "case_detail_all_suites" must be qualified with a dataset (e.g. dataset.table).'  # noqa: E501
    message_2 = "6"
    expected_result = 'bigquery error: 400 Syntax error: Table "case_detail_all_suites" must be qualified with a dataset (e.g. dataset.table).'  # noqa: E501
    assert (
        str(BigQueryEngineSpec.parse_error_exception(Exception(message)))
        == expected_result
    )
    assert str(BigQueryEngineSpec.parse_error_exception(Exception(message_2))) == "6"


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CAST('2019-01-02' AS DATE)"),
        ("DateTime", "CAST('2019-01-02T03:04:05.678900' AS DATETIME)"),
        ("TimeStamp", "CAST('2019-01-02T03:04:05.678900' AS TIMESTAMP)"),
        ("Time", "CAST('03:04:05.678900' AS TIME)"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    """
    DB Eng Specs (bigquery): Test conversion to date time
    """
    from superset.db_engine_specs.bigquery import (
        BigQueryEngineSpec as spec,  # noqa: N813
    )

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_get_default_catalog(mocker: MockerFixture) -> None:
    """
    Test that we get the default catalog from the connection URI.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec
    from superset.models.core import Database

    mocker.patch.object(Database, "get_sqla_engine")
    get_client = mocker.patch.object(BigQueryEngineSpec, "_get_client")
    get_client().project = "project"

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="bigquery://project",
    )
    assert BigQueryEngineSpec.get_default_catalog(database) == "project"

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="bigquery:///project",
    )
    assert BigQueryEngineSpec.get_default_catalog(database) == "project"

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="bigquery://",
    )
    assert BigQueryEngineSpec.get_default_catalog(database) == "project"


def test_adjust_engine_params_catalog_as_host() -> None:
    """
    Test passing a custom catalog.

    In this test, the original URI has the catalog as the host.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    url = make_url("bigquery://project")

    uri = BigQueryEngineSpec.adjust_engine_params(url, {})[0]
    assert str(uri) == "bigquery://project"

    uri = BigQueryEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="other-project",
    )[0]
    assert str(uri) == "bigquery://other-project/"


def test_get_materialized_view_names() -> None:
    """
    Test get_materialized_view_names method.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    database = mock.Mock()
    database.get_default_catalog.return_value = "my_project"

    inspector = mock.Mock()

    # Mock the raw connection and cursor
    cursor_mock = mock.Mock()
    cursor_mock.fetchall.return_value = [
        ("materialized_view_1",),
        ("materialized_view_2",),
    ]

    connection_mock = mock.Mock()
    connection_mock.cursor.return_value = cursor_mock
    connection_mock.__enter__ = mock.Mock(return_value=connection_mock)
    connection_mock.__exit__ = mock.Mock(return_value=None)

    database.get_raw_connection.return_value = connection_mock

    result = BigQueryEngineSpec.get_materialized_view_names(
        database=database, inspector=inspector, schema="my_dataset"
    )

    assert result == {"materialized_view_1", "materialized_view_2"}

    # Verify the SQL query was correct
    cursor_mock.execute.assert_called_once()
    executed_query = cursor_mock.execute.call_args[0][0]
    assert "INFORMATION_SCHEMA.TABLES" in executed_query
    assert "table_type = 'MATERIALIZED VIEW'" in executed_query


def test_get_view_names_excludes_materialized_views() -> None:
    """
    Test get_view_names excludes materialized views.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    database = mock.Mock()
    database.get_default_catalog.return_value = "my_project"

    inspector = mock.Mock()

    # Mock the raw connection and cursor
    cursor_mock = mock.Mock()
    # Return only regular views, not materialized views
    cursor_mock.fetchall.return_value = [
        ("regular_view_1",),
        ("regular_view_2",),
    ]

    connection_mock = mock.Mock()
    connection_mock.cursor.return_value = cursor_mock
    connection_mock.__enter__ = mock.Mock(return_value=connection_mock)
    connection_mock.__exit__ = mock.Mock(return_value=None)

    database.get_raw_connection.return_value = connection_mock

    result = BigQueryEngineSpec.get_view_names(
        database=database, inspector=inspector, schema="my_dataset"
    )

    assert result == {"regular_view_1", "regular_view_2"}

    # Verify the SQL query only gets regular views
    cursor_mock.execute.assert_called_once()
    executed_query = cursor_mock.execute.call_args[0][0]
    assert "INFORMATION_SCHEMA.TABLES" in executed_query
    assert "table_type = 'VIEW'" in executed_query
    # Ensure it's not querying for materialized views
    assert "MATERIALIZED VIEW" not in executed_query


def test_string_literal_with_apostrophe() -> None:
    """
    Test that string literals containing apostrophes are properly escaped
    for BigQuery.

    BigQuery uses standard SQL quoting where single quotes delimit string
    literals and embedded single quotes are escaped by doubling them.
    The upstream sqlalchemy-bigquery dialect uses ``repr()`` which switches
    to double-quote delimiters when the value contains an apostrophe.
    Double-quoted tokens are identifiers in BigQuery, causing syntax errors.
    """
    from sqlalchemy import column as sa_column

    from superset.db_engine_specs.bigquery import BigQueryEngineSpec  # noqa: F811

    # Trigger module load to ensure the monkey-patch is applied
    assert BigQueryEngineSpec is not None

    dialect = BigQueryDialect()

    stmt = select(sa_column("name")).where(sa_column("name") == "Fernando's")
    compiled_sql = str(
        stmt.compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    )

    # The compiled SQL must use single-quoted literal with doubled apostrophes.
    # It must NOT contain backslash-escaped or double-quoted forms.
    assert "= 'Fernando''s'" in compiled_sql
    assert '\\"' not in compiled_sql
    assert "\\'" not in compiled_sql


def test_string_literal_without_apostrophe() -> None:
    """
    Test that normal string literals (without apostrophes) still compile
    correctly after the monkey-patch.
    """
    from sqlalchemy import column as sa_column

    from superset.db_engine_specs.bigquery import BigQueryEngineSpec  # noqa: F811

    assert BigQueryEngineSpec is not None

    dialect = BigQueryDialect()

    stmt = select(sa_column("name")).where(sa_column("name") == "Fernando")
    compiled_sql = str(
        stmt.compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    )

    assert "= 'Fernando'" in compiled_sql


def test_string_literal_in_filter_with_apostrophe() -> None:
    """
    Test that IN filters with apostrophes in values compile correctly.
    """
    from sqlalchemy import column as sa_column

    from superset.db_engine_specs.bigquery import BigQueryEngineSpec  # noqa: F811

    assert BigQueryEngineSpec is not None

    dialect = BigQueryDialect()

    stmt = select(sa_column("name")).where(
        sa_column("name").in_(["Fernando's", "O'Brien"])
    )
    compiled_sql = str(
        stmt.compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    )

    assert "'Fernando''s'" in compiled_sql
    assert "'O''Brien'" in compiled_sql


def test_process_string_literal_directly() -> None:
    """
    Test _process_string_literal covers apostrophe doubling and percent
    escaping for format-string safety.
    """
    from superset.db_engine_specs.bigquery import _process_string_literal

    assert _process_string_literal("hello") == "'hello'"
    assert _process_string_literal("O'Brien") == "'O''Brien'"
    assert _process_string_literal("100%") == "'100%%'"
    assert _process_string_literal("it's 100%") == "'it''s 100%%'"


def test_literal_processor_non_bigquery_dialect() -> None:
    """
    Test that BigQuerySafeString.literal_processor falls back to the parent
    implementation when used with a non-BigQuery dialect.
    """
    from sqlalchemy import create_engine

    from superset.db_engine_specs.bigquery import (
        _monkeypatch_bigquery_string_literal,  # noqa: F811
    )

    _monkeypatch_bigquery_string_literal()

    safe_cls = BigQueryDialect.colspecs[sqltypes.String]
    instance = safe_cls()

    # Use a non-BigQuery dialect (sqlite)
    sqlite_dialect = create_engine("sqlite://").dialect
    processor = instance.literal_processor(sqlite_dialect)

    # The fallback processor should still produce a valid quoted string
    assert processor is not None


def test_monkeypatch_is_applied() -> None:
    """
    Test that _monkeypatch_bigquery_string_literal installs the custom
    type decorator into BigQueryDialect.colspecs.
    """
    from sqlalchemy.sql import sqltypes as sa_sqltypes

    from superset.db_engine_specs.bigquery import (
        BigQueryEngineSpec,  # noqa: F811
    )

    assert BigQueryEngineSpec is not None

    colspecs = BigQueryDialect.colspecs
    assert sa_sqltypes.String in colspecs
    safe_cls = colspecs[sa_sqltypes.String]
    assert safe_cls.__name__ == "BigQuerySafeString"


def test_literal_processor_returns_process_string_literal_for_bigquery() -> None:
    """
    Test that BigQuerySafeString.literal_processor returns the
    _process_string_literal function when given a BigQuery dialect,
    and that calling it produces correctly escaped output.
    """
    from superset.db_engine_specs.bigquery import (
        _monkeypatch_bigquery_string_literal,
        _process_string_literal,
    )

    _monkeypatch_bigquery_string_literal()

    safe_cls = BigQueryDialect.colspecs[sqltypes.String]
    instance = safe_cls()

    dialect = BigQueryDialect()
    processor = instance.literal_processor(dialect)

    assert processor is _process_string_literal
    assert processor("O'Brien") == "'O''Brien'"
    assert processor("plain") == "'plain'"


def test_monkeypatch_handles_missing_bigquery_package() -> None:
    """
    Test that _monkeypatch_bigquery_string_literal gracefully handles
    the case where sqlalchemy_bigquery is not installed.
    """
    import builtins

    from superset.db_engine_specs.bigquery import (
        _monkeypatch_bigquery_string_literal,
    )

    original_import = builtins.__import__

    def mock_import(name: str, *args: Any, **kwargs: Any) -> Any:
        if name == "sqlalchemy_bigquery":
            raise ImportError("mocked missing package")
        return original_import(name, *args, **kwargs)

    with mock.patch("builtins.__import__", side_effect=mock_import):
        # Should not raise — the except ImportError branch handles it
        _monkeypatch_bigquery_string_literal()
