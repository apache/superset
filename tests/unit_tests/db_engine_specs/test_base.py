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
from flask.ctx import AppContext
from sqlalchemy.types import TypeEngine


def test_get_text_clause_with_colon(app_context: AppContext) -> None:
    """
    Make sure text clauses are correctly escaped
    """

    from superset.db_engine_specs.base import BaseEngineSpec

    text_clause = BaseEngineSpec.get_text_clause(
        "SELECT foo FROM tbl WHERE foo = '123:456')"
    )
    assert text_clause.text == "SELECT foo FROM tbl WHERE foo = '123\\:456')"


def test_parse_sql_single_statement(app_context: AppContext) -> None:
    """
    `parse_sql` should properly strip leading and trailing spaces and semicolons
    """

    from superset.db_engine_specs.base import BaseEngineSpec

    queries = BaseEngineSpec.parse_sql(" SELECT foo FROM tbl ; ")
    assert queries == ["SELECT foo FROM tbl"]


def test_parse_sql_multi_statement(app_context: AppContext) -> None:
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
        ("SELECT 1 as cnt", None,),
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
def test_cte_query_parsing(
    app_context: AppContext, original: TypeEngine, expected: str
) -> None:
    from superset.db_engine_specs.base import BaseEngineSpec

    actual = BaseEngineSpec.get_cte_query(original)
    assert actual == expected


@pytest.mark.parametrize(
    "value,suffix,category,expected",
    [
        ("str", "", None, "str"),
        (0, "", None, "0"),
        (100, "", None, "100"),
        (1000, "", None, "1 K"),
        (10000, "", None, "10 K"),
        (123, " rows", None, "123 rows"),
        (1234, " rows", None, "1 K rows"),
        (1999, " rows", None, "1 K rows"),
        (2000, " rows", None, "2 K rows"),
        (123, "", "bytes", "123 B"),
        (1024, "", "bytes", "1 KiB"),
        (1024 ** 2, "", "bytes", "1 MiB"),
        (1000 ** 2, "J", None, "1 MJ"),
        (1024 ** 3, "", "bytes", "1 GiB"),
        (1000 ** 3, "W", None, "1 GW"),
        (1024 ** 8, "", "bytes", "1 YiB"),
        (1000 ** 8, "m", None, "1 Ym"),
        # Yottabyte is the largest unit, but larger values can be handled
        (1024 ** 9, "", "bytes", "1024 YiB"),
        (1000 ** 9, "m", None, "1000 Ym"),
    ],
)
def test_humanize(
    app_context: AppContext,
    value: Any,
    suffix: str,
    category: Optional[str],
    expected: str,
) -> None:
    from superset.db_engine_specs.base import BaseEngineSpec

    actual = BaseEngineSpec._humanize(value, suffix, category)
    assert actual == expected
