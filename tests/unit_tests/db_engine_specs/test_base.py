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
