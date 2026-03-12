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


def _patch_bq_fetch_deps(
    mocker: MockerFixture, max_mb: int = 200
) -> tuple[mock.MagicMock, mock.MagicMock]:
    """Helper to patch Flask g and current_app for BigQuery fetch_data tests."""
    flask_g = mocker.patch("superset.db_engine_specs.bigquery.g")
    app = mocker.patch("superset.db_engine_specs.bigquery.current_app")
    # Make current_app truthy and .config.get() return a plain int
    app.__bool__ = mock.Mock(return_value=True)
    app.config = mock.MagicMock()
    app.config.get = mock.Mock(return_value=max_mb)
    return flask_g, app


def test_fetch_data_within_memory_limit(mocker: MockerFixture) -> None:
    """
    Test that fetch_data returns all rows when the result fits within the
    configured memory limit.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    rows = [(1, "a"), (2, "b"), (3, "c")]

    cursor = mock.MagicMock()
    # First fetchmany returns all rows; the result set is smaller than limit
    cursor.fetchmany.return_value = rows

    flask_g, _ = _patch_bq_fetch_deps(mocker, max_mb=200)

    result = BigQueryEngineSpec.fetch_data(cursor, limit=100)

    assert result == rows
    assert flask_g.bq_memory_limited is False
    assert flask_g.bq_memory_limited_row_count == 3


def test_fetch_data_truncated_by_memory_limit(mocker: MockerFixture) -> None:
    """
    Test that fetch_data truncates results and sets the memory_limited flag
    when the memory budget is exceeded.

    We use a very small budget (1 MB) so that after the first batch the
    method computes ``remaining_rows <= 0``, hitting the truncation path.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    # 1000 rows of ~10KB each --> first batch ~10 MB >> 1 MB budget
    first_batch = [(i, "x" * 10_000) for i in range(1000)]

    cursor = mock.MagicMock()
    cursor.fetchmany.return_value = first_batch

    # 1 MB budget: first batch exceeds it, so remaining_rows <= 0
    flask_g, _ = _patch_bq_fetch_deps(mocker, max_mb=1)

    result = BigQueryEngineSpec.fetch_data(cursor, limit=None)

    assert result == first_batch
    assert flask_g.bq_memory_limited is True
    assert flask_g.bq_memory_limited_row_count == len(first_batch)


def test_fetch_data_empty_result(mocker: MockerFixture) -> None:
    """
    Test that fetch_data handles an empty result set gracefully.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    cursor = mock.MagicMock()
    cursor.fetchmany.return_value = []

    flask_g, _ = _patch_bq_fetch_deps(mocker, max_mb=200)

    result = BigQueryEngineSpec.fetch_data(cursor, limit=100)

    assert result == []
    assert flask_g.bq_memory_limited is False
    assert flask_g.bq_memory_limited_row_count == 0


def test_fetch_data_fallback_on_exception(mocker: MockerFixture) -> None:
    """
    Test that fetch_data falls back to the parent implementation when the
    progressive fetch raises an exception.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    cursor = mock.MagicMock()
    cursor.fetchmany.side_effect = RuntimeError("cursor error")
    cursor.fetchall.return_value = [(1, "a"), (2, "b")]
    cursor.description = [("col1", None), ("col2", None)]

    flask_g, _ = _patch_bq_fetch_deps(mocker, max_mb=200)

    result = BigQueryEngineSpec.fetch_data(cursor, limit=None)

    assert result == [(1, "a"), (2, "b")]
    assert flask_g.bq_memory_limited is False
    assert flask_g.bq_memory_limited_row_count == 2


def test_fetch_data_converts_bigquery_row_objects(mocker: MockerFixture) -> None:
    """
    Test that BigQuery Row objects are converted to plain values.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    class FakeRow:
        """Mimics google.cloud.bigquery.table.Row"""

        def __init__(self, vals: tuple[Any, ...]) -> None:
            self._vals = vals

        def values(self) -> tuple[Any, ...]:
            return self._vals

    FakeRow.__name__ = "Row"

    rows = [FakeRow((1, "a")), FakeRow((2, "b"))]

    cursor = mock.MagicMock()
    cursor.fetchmany.return_value = rows

    flask_g, _ = _patch_bq_fetch_deps(mocker, max_mb=200)

    result = BigQueryEngineSpec.fetch_data(cursor, limit=100)

    assert result == [(1, "a"), (2, "b")]
    assert flask_g.bq_memory_limited is False
