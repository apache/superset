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
# pylint: disable=unused-argument, import-outside-toplevel, protected-access

from textwrap import dedent
from typing import Any, Optional

import pytest
from sqlalchemy import types

from superset.superset_typing import ResultSetColumnType, SQLAColumnType
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import assert_column_spec


def test_get_text_clause_with_colon() -> None:
    """
    Make sure text clauses are correctly escaped
    """

    from superset.db_engine_specs.base import BaseEngineSpec

    text_clause = BaseEngineSpec.get_text_clause(
        "SELECT foo FROM tbl WHERE foo = '123:456')"
    )
    assert text_clause.text == "SELECT foo FROM tbl WHERE foo = '123\\:456')"


def test_parse_sql_single_statement() -> None:
    """
    `parse_sql` should properly strip leading and trailing spaces and semicolons
    """

    from superset.db_engine_specs.base import BaseEngineSpec

    queries = BaseEngineSpec.parse_sql(" SELECT foo FROM tbl ; ")
    assert queries == ["SELECT foo FROM tbl"]


def test_parse_sql_multi_statement() -> None:
    """
    For string with multiple SQL-statements `parse_sql` method should return list
    where each element represents the single SQL-statement
    """

    from superset.db_engine_specs.base import BaseEngineSpec

    queries = BaseEngineSpec.parse_sql("SELECT foo FROM tbl1; SELECT bar FROM tbl2;")
    assert queries == [
        "SELECT foo FROM tbl1",
        "SELECT bar FROM tbl2",
    ]


@pytest.mark.parametrize(
    "original,expected",
    [
        (
            dedent(
                """
with currency as
(
select 'INR' as cur
)
select * from currency
"""
            ),
            None,
        ),
        (
            "SELECT 1 as cnt",
            None,
        ),
        (
            dedent(
                """
select 'INR' as cur
union
select 'AUD' as cur
union
select 'USD' as cur
"""
            ),
            None,
        ),
    ],
)
def test_cte_query_parsing(original: types.TypeEngine, expected: str) -> None:
    from superset.db_engine_specs.base import BaseEngineSpec

    actual = BaseEngineSpec.get_cte_query(original)
    assert actual == expected


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        ("SMALLINT", types.SmallInteger, None, GenericDataType.NUMERIC, False),
        ("INTEGER", types.Integer, None, GenericDataType.NUMERIC, False),
        ("BIGINT", types.BigInteger, None, GenericDataType.NUMERIC, False),
        ("DECIMAL", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("NUMERIC", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("REAL", types.REAL, None, GenericDataType.NUMERIC, False),
        ("DOUBLE PRECISION", types.Float, None, GenericDataType.NUMERIC, False),
        ("MONEY", types.Numeric, None, GenericDataType.NUMERIC, False),
        # String
        ("CHAR", types.String, None, GenericDataType.STRING, False),
        ("VARCHAR", types.String, None, GenericDataType.STRING, False),
        ("TEXT", types.String, None, GenericDataType.STRING, False),
        # Temporal
        ("DATE", types.Date, None, GenericDataType.TEMPORAL, True),
        ("TIMESTAMP", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
        ("TIME", types.Time, None, GenericDataType.TEMPORAL, True),
        # Boolean
        ("BOOLEAN", types.Boolean, None, GenericDataType.BOOLEAN, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec as spec

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


@pytest.mark.parametrize(
    "cols, expected_result",
    [
        (
            [SQLAColumnType(name="John", type="integer", is_dttm=False)],
            [
                ResultSetColumnType(
                    column_name="John", name="John", type="integer", is_dttm=False
                )
            ],
        ),
        (
            [SQLAColumnType(name="hugh", type="integer", is_dttm=False)],
            [
                ResultSetColumnType(
                    column_name="hugh", name="hugh", type="integer", is_dttm=False
                )
            ],
        ),
    ],
)
def test_convert_inspector_columns(
    cols: list[SQLAColumnType], expected_result: list[ResultSetColumnType]
):
    from superset.db_engine_specs.base import convert_inspector_columns

    assert convert_inspector_columns(cols) == expected_result
