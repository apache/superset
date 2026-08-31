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
"""Unit tests for Rison filter parser."""

from superset.utils.rison_filters import RisonFilterParser


def test_simple_equality():
    parser = RisonFilterParser()
    result = parser.parse("(country:USA)")

    assert len(result) == 1
    assert result[0]["expressionType"] == "SIMPLE"
    assert result[0]["clause"] == "WHERE"
    assert result[0]["subject"] == "country"
    assert result[0]["operator"] == "=="
    assert result[0]["comparator"] == "USA"


def test_multiple_filters_and():
    parser = RisonFilterParser()
    result = parser.parse("(country:USA,year:2024)")

    assert len(result) == 2
    assert result[0]["subject"] == "country"
    assert result[0]["comparator"] == "USA"
    assert result[1]["subject"] == "year"
    assert result[1]["comparator"] == 2024


def test_list_in_operator():
    parser = RisonFilterParser()
    result = parser.parse("(country:!(USA,Canada))")

    assert len(result) == 1
    assert result[0]["subject"] == "country"
    assert result[0]["operator"] == "IN"
    assert result[0]["comparator"] == ["USA", "Canada"]


def test_not_operator():
    parser = RisonFilterParser()
    result = parser.parse("(NOT:(country:USA))")

    assert len(result) == 1
    assert result[0]["subject"] == "country"
    assert result[0]["operator"] == "!="
    assert result[0]["comparator"] == "USA"


def test_not_in_operator():
    parser = RisonFilterParser()
    result = parser.parse("(NOT:(country:!(USA,Canada)))")

    assert len(result) == 1
    assert result[0]["subject"] == "country"
    assert result[0]["operator"] == "NOT IN"
    assert result[0]["comparator"] == ["USA", "Canada"]


def test_or_operator():
    parser = RisonFilterParser()
    result = parser.parse("(OR:!((status:active),(priority:high)))")

    assert len(result) == 1
    assert result[0]["expressionType"] == "SQL"
    assert result[0]["clause"] == "WHERE"
    assert "status = 'active' OR priority = 'high'" in result[0]["sqlExpression"]


def test_comparison_operators():
    parser = RisonFilterParser()

    result = parser.parse("(sales:(gt:100000))")
    assert result[0]["operator"] == ">"
    assert result[0]["comparator"] == 100000

    result = parser.parse("(age:(gte:18))")
    assert result[0]["operator"] == ">="
    assert result[0]["comparator"] == 18

    result = parser.parse("(temp:(lt:32))")
    assert result[0]["operator"] == "<"
    assert result[0]["comparator"] == 32

    result = parser.parse("(price:(lte:1000))")
    assert result[0]["operator"] == "<="
    assert result[0]["comparator"] == 1000


def test_between_operator():
    parser = RisonFilterParser()
    result = parser.parse("(date:(between:!('2024-01-01','2024-12-31')))")

    assert len(result) == 1
    assert result[0]["operator"] == "BETWEEN"
    assert result[0]["comparator"] == ["2024-01-01", "2024-12-31"]


def test_like_operator():
    parser = RisonFilterParser()
    result = parser.parse("(name:(like:'%smith%'))")

    assert len(result) == 1
    assert result[0]["operator"] == "LIKE"
    assert result[0]["comparator"] == "%smith%"


def test_empty_filter():
    parser = RisonFilterParser()
    assert parser.parse("") == []
    assert parser.parse("()") == []


def test_invalid_rison():
    parser = RisonFilterParser()
    assert parser.parse("invalid rison") == []
    assert parser.parse("(unclosed") == []


def test_or_branch_escapes_string_literals():
    """OR-branch SQL must escape apostrophes; otherwise a value like
    `O'Brien'); DROP TABLE x; --` could close out a literal and inject.

    Bypasses the Rison parser (whose quoting rules complicate expressing
    apostrophes in test inputs) and exercises `_handle_or_operator` with
    a hand-built decoded payload — which is exactly what `_convert_to_adhoc_filters`
    feeds it after a successful prison.loads.
    """
    parser = RisonFilterParser()
    result = parser._handle_or_operator(
        [{"name": "O'Brien"}, {"role": "admin"}],
    )

    assert len(result) == 1
    sql = result[0]["sqlExpression"]
    # Single quote inside the literal is doubled per SQL standard.
    assert "'O''Brien'" in sql
    assert "'admin'" in sql


def test_or_branch_rejects_unsafe_identifiers():
    """Columns that don't match a strict identifier whitelist drop the
    condition rather than getting interpolated into SQL."""
    parser = RisonFilterParser()
    result = parser._handle_or_operator(
        [{"col; DROP TABLE x": 1}, {"role": "admin"}],
    )

    # The unsafe column is dropped, the safe one remains.
    assert len(result) == 1
    sql = result[0]["sqlExpression"]
    assert "DROP" not in sql
    assert "role = 'admin'" in sql


def test_or_branch_all_conditions_unsafe_returns_nothing():
    parser = RisonFilterParser()
    result = parser._handle_or_operator(
        [{"col;1": 1}, {"col;2": 2}],
    )
    assert result == []


def test_or_branch_between_quotes_both_bounds():
    parser = RisonFilterParser()
    result = parser.parse("(OR:!((date:(between:!('2024-01-01','2024-12-31')))))")
    sql = result[0]["sqlExpression"]
    assert "date BETWEEN '2024-01-01' AND '2024-12-31'" in sql
