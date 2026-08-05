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


from datetime import datetime
from typing import Optional

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.engine.url import make_url

from superset.sql.parse import Table
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CAST('2019-01-02' AS DATE)"),
        (
            "TimeStamp",
            "CAST('2019-01-02 03:04:05.678900' AS TIMESTAMP)",
        ),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.hive import HiveEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec

    assert (
        HiveEngineSpec.get_schema_from_engine_params(
            make_url("hive://localhost:10000/default"), {}
        )
        == "default"
    )


@pytest.mark.parametrize(
    "catalog,schema",
    [
        (None, None),
        (None, "new_schema"),
        ("catalog", None),
        ("catalog", "new_schema"),
    ],
)
def test_adjust_engine_params(catalog: Optional[str], schema: Optional[str]) -> None:
    """
    Test that ``adjust_engine_params`` leaves the URI untouched.

    The URI database must not be rewritten to the selected schema: PyHive runs
    ``USE`` on it at connect time, and on Spark Thrift Server it can select a
    catalog, so overwriting it with the schema breaks table resolution (see
    issue #30208). Schema selection happens via ``get_prequeries`` instead.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec

    uri = make_url("hive://localhost:10000/default")
    connect_args = {"foo": "bar"}

    adjusted_uri, adjusted_connect_args = HiveEngineSpec.adjust_engine_params(
        uri,
        connect_args,
        catalog=catalog,
        schema=schema,
    )
    assert adjusted_uri is uri
    assert adjusted_connect_args is connect_args
    assert connect_args == {"foo": "bar"}


@pytest.mark.parametrize(
    "catalog,schema,expected",
    [
        (None, None, []),
        ("catalog", None, []),
        (None, "new_schema", ["USE `new_schema`"]),
        ("catalog", "new_schema", ["USE `new_schema`"]),
        (None, "evil`schema", ["USE `evil``schema`"]),
    ],
)
def test_get_prequeries(
    mocker: MockerFixture,
    catalog: Optional[str],
    schema: Optional[str],
    expected: list[str],
) -> None:
    """
    Test that ``get_prequeries`` selects the schema with a ``USE`` statement.

    Together with ``supports_dynamic_schema`` this implements per-query schema
    selection, so unqualified table names resolve in the schema Superset
    attributes the query to.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec

    assert HiveEngineSpec.supports_dynamic_schema

    database = mocker.MagicMock()
    assert (
        HiveEngineSpec.get_prequeries(database, catalog=catalog, schema=schema)
        == expected
    )


def test_select_star(mocker: MockerFixture) -> None:
    """
    Test the ``select_star`` method.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec

    database = mocker.MagicMock()
    dialect = mocker.MagicMock()

    def quote_table(table: Table, dialect: Dialect) -> str:
        return ".".join(
            part for part in (table.catalog, table.schema, table.table) if part
        )

    mocker.patch.object(HiveEngineSpec, "quote_table", quote_table)

    HiveEngineSpec.select_star(
        database=database,
        table=Table("my_table", "my_schema", "my_catalog"),
        dialect=dialect,
        limit=100,
        show_cols=False,
        indent=True,
        latest_partition=False,
        cols=None,
    )

    query = database.compile_sqla_query.mock_calls[0][1][0]
    assert (
        str(query)
        == """
SELECT * \nFROM my_schema.my_table
 LIMIT :param_1
    """.strip()
    )


def test_get_view_names_escapes_schema(mocker: MockerFixture) -> None:
    """
    Test that ``get_view_names`` correctly escapes backticks in schema names
    within the SHOW VIEWS statement.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec

    database = mocker.MagicMock()
    inspector = mocker.MagicMock()

    conn = mocker.MagicMock()
    cursor = mocker.MagicMock()
    cursor.fetchall.return_value = []
    conn.__enter__ = mocker.MagicMock(return_value=conn)
    conn.__exit__ = mocker.MagicMock(return_value=False)
    conn.cursor.return_value = cursor
    database.get_raw_connection.return_value = conn

    HiveEngineSpec.get_view_names(database, inspector, schema="evil` UNION SELECT 1--")
    cursor.execute.assert_called_once()
    sql = cursor.execute.call_args[0][0]
    assert "IN `evil`` UNION SELECT 1--`" in sql


def test_df_to_sql_escapes_like_wildcards(mocker: MockerFixture) -> None:
    """
    Test that ``df_to_sql`` escapes ``%`` and ``_`` wildcard characters in the
    SHOW TABLES LIKE pattern used to detect table existence.
    """
    import pandas as pd

    from superset.db_engine_specs.hive import HiveEngineSpec
    from superset.exceptions import SupersetException
    from superset.sql.parse import Table

    database = mocker.MagicMock()
    # Simulate an existing table so df_to_sql raises before reaching the upload path
    database.get_df.return_value = pd.DataFrame({"name": ["sales_%_2024"]})

    with pytest.raises(SupersetException, match="Table already exists"):
        HiveEngineSpec.df_to_sql(
            database=database,
            table=Table("sales_%_2024", "my_schema"),
            df=pd.DataFrame({"a": [1]}),
            to_sql_kwargs={"if_exists": "fail"},
        )

    database.get_df.assert_called_once()
    sql = database.get_df.call_args[0][0]
    assert r"\%" in sql
    assert r"\_" in sql
    assert "ESCAPE" in sql


def test_partition_query_escapes_identifiers() -> None:
    """
    Test that ``_partition_query`` correctly backtick-quotes table and schema names
    in the SHOW PARTITIONS statement.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec
    from superset.sql.parse import Table

    result = HiveEngineSpec._partition_query(
        table=Table("my_table", "my_schema"),
        indexes=[],
        database=None,  # type: ignore
    )
    assert result == "SHOW PARTITIONS `my_schema`.`my_table`"

    result = HiveEngineSpec._partition_query(
        table=Table("evil`tbl", "evil`schema"),
        indexes=[],
        database=None,  # type: ignore
    )
    assert result == "SHOW PARTITIONS `evil``schema`.`evil``tbl`"

    result = HiveEngineSpec._partition_query(
        table=Table("no_schema_tbl"),
        indexes=[],
        database=None,  # type: ignore
    )
    assert result == "SHOW PARTITIONS `no_schema_tbl`"
