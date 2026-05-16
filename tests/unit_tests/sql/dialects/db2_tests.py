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

import pytest
from sqlglot import errors, parse_one

from superset.sql.dialects.db2 import DB2


def test_month_truncation() -> None:
    """
    Test the month truncation pattern from Db2EngineSpec time grains.
    """
    sql = """
SELECT "DATE" - (DAY("DATE")-1) DAYS AS "DATE", sum("TOTAL_FEE") AS "SUM(TOTAL_FEE)"
    """

    # test with the generic dialect -- raises exception
    with pytest.raises(errors.ParseError):
        parse_one(sql)

    ast = parse_one(sql, dialect=DB2)
    regenerated = ast.sql(dialect=DB2)

    assert regenerated == (
        'SELECT "DATE" - (DAY("DATE") - 1) DAYS AS "DATE", '
        'SUM("TOTAL_FEE") AS "SUM(TOTAL_FEE)"'
    )


def test_labeled_duration_with_day_function() -> None:
    """
    Test labeled duration with DAY function.
    """
    sql = "SELECT CURRENT_DATE - DAY(CURRENT_DATE) DAYS"

    ast = parse_one(sql, dialect=DB2)
    regenerated = ast.sql(dialect=DB2)

    assert regenerated == "SELECT CURRENT_DATE - DAY(CURRENT_DATE) DAYS"


def test_labeled_duration_with_expression() -> None:
    """
    Test labeled duration with complex expressions (from real DB2 queries).
    """
    sql = 'SELECT "DATE" - (DAY("DATE") - 1) DAYS'

    ast = parse_one(sql, dialect=DB2)
    regenerated = ast.sql(dialect=DB2)

    assert regenerated == 'SELECT "DATE" - (DAY("DATE") - 1) DAYS'


def test_labeled_duration_with_month_function() -> None:
    """
    Test labeled duration with MONTH function.
    """
    sql = 'SELECT "DATE" - (MONTH("DATE") - 1) MONTHS'

    ast = parse_one(sql, dialect=DB2)
    regenerated = ast.sql(dialect=DB2)

    assert regenerated == 'SELECT "DATE" - (MONTH("DATE") - 1) MONTHS'


def test_year_truncation() -> None:
    """
    Test the year truncation pattern from Db2EngineSpec time grains.
    """
    sql = 'SELECT "DATE" - (DAY("DATE")-1) DAYS - (MONTH("DATE")-1) MONTHS'

    ast = parse_one(sql, dialect=DB2)
    regenerated = ast.sql(dialect=DB2)

    assert regenerated == (
        'SELECT "DATE" - (DAY("DATE") - 1) DAYS - (MONTH("DATE") - 1) MONTHS'
    )


def test_quarter_truncation() -> None:
    """
    Test the quarter truncation pattern from Db2EngineSpec time grains.
    """
    sql = (
        'SELECT "DATE" - (DAY("DATE")-1) DAYS - (MONTH("DATE")-1) MONTHS'
        ' + ((QUARTER("DATE")-1) * 3) MONTHS'
    )

    ast = parse_one(sql, dialect=DB2)
    regenerated = ast.sql(dialect=DB2)

    assert regenerated == (
        'SELECT "DATE" - (DAY("DATE") - 1) DAYS - (MONTH("DATE") - 1) MONTHS'
        ' + ((QUARTER("DATE") - 1) * 3) MONTHS'
    )


def test_regular_column_aliasing_still_works() -> None:
    """
    Test that regular column aliasing still works (regression test).
    """
    sql = "SELECT col1 AS days FROM table"

    ast = parse_one(sql, dialect=DB2)
    regenerated = ast.sql(dialect=DB2)

    assert regenerated == "SELECT col1 AS days FROM table"


@pytest.mark.parametrize(
    "sql, expected",
    [
        ("SELECT col1 AS day", "SELECT col1 AS day"),
        ("SELECT col1 AS month", "SELECT col1 AS month"),
        ("SELECT col1 AS year", "SELECT col1 AS year"),
        ("SELECT col1 AS days", "SELECT col1 AS days"),
        ("SELECT col1 AS months", "SELECT col1 AS months"),
        ("SELECT col1 AS years", "SELECT col1 AS years"),
    ],
)
def test_column_aliasing_with_reserved_words(sql: str, expected: str) -> None:
    """
    Test column aliasing with DB2 time unit words.
    """
    ast = parse_one(sql, dialect=DB2)
    regenerated = ast.sql(dialect=DB2)
    assert regenerated == expected


@pytest.mark.parametrize(
    "sql, expected",
    [
        # Function-based patterns
        ('SELECT "DATE" - DAY("DATE") DAYS', 'SELECT "DATE" - DAY("DATE") DAYS'),
        (
            'SELECT "DATE" + MONTH("DATE") MONTHS',
            'SELECT "DATE" + MONTH("DATE") MONTHS',
        ),
        ('SELECT "DATE" - YEAR("DATE") YEARS', 'SELECT "DATE" - YEAR("DATE") YEARS'),
        # Complex expression patterns
        (
            'SELECT "DATE" - (DAY("DATE") - 1) DAYS',
            'SELECT "DATE" - (DAY("DATE") - 1) DAYS',
        ),
        (
            'SELECT "DATE" + (MONTH("DATE") + 2) MONTHS',
            'SELECT "DATE" + (MONTH("DATE") + 2) MONTHS',
        ),
        # Nested expressions
        (
            'SELECT "DATE" - ((DAY("DATE") - 1) + 1) DAYS - (MONTH("DATE") - 1) MONTHS',
            'SELECT "DATE" - ((DAY("DATE") - 1) + 1) DAYS - (MONTH("DATE") - 1) MONTHS',
        ),
    ],
)
def test_labeled_duration_variations(sql: str, expected: str) -> None:
    """
    Test various labeled duration patterns that should work.
    """
    ast = parse_one(sql, dialect=DB2)
    regenerated = ast.sql(dialect=DB2)
    assert regenerated == expected


def test_addition_with_labeled_duration() -> None:
    """
    Test addition operations with labeled durations.
    """
    sql = 'SELECT "DATE" + (DAY("DATE") + 5) DAYS'

    ast = parse_one(sql, dialect=DB2)
    regenerated = ast.sql(dialect=DB2)

    assert regenerated == 'SELECT "DATE" + (DAY("DATE") + 5) DAYS'


def test_arithmetic_with_different_units() -> None:
    """
    Test arithmetic operations mixing different time units.
    """
    sql = (
        'SELECT "DATE" - (DAY("DATE")-1) DAYS '
        '- (MONTH("DATE")-1) MONTHS + '
        '(YEAR("DATE")-1) YEARS'
    )

    ast = parse_one(sql, dialect=DB2)
    regenerated = ast.sql(dialect=DB2)

    assert regenerated == (
        'SELECT "DATE" - (DAY("DATE") - 1) DAYS - '
        '(MONTH("DATE") - 1) MONTHS + '
        '(YEAR("DATE") - 1) YEARS'
    )


def test_multiple_function_calls_in_duration() -> None:
    """
    Test labeled duration with multiple function calls.
    """
    sql = 'SELECT "DATE" - (DAY("DATE") + MONTH("DATE")) DAYS'

    ast = parse_one(sql, dialect=DB2)
    regenerated = ast.sql(dialect=DB2)

    assert regenerated == 'SELECT "DATE" - (DAY("DATE") + MONTH("DATE")) DAYS'


def test_labeled_duration_with_multiplication() -> None:
    """
    Test labeled duration with multiplication in the expression.
    """
    sql = 'SELECT "DATE" + ((QUARTER("DATE") - 1) * 3) MONTHS'

    ast = parse_one(sql, dialect=DB2)
    regenerated = ast.sql(dialect=DB2)

    assert regenerated == 'SELECT "DATE" + ((QUARTER("DATE") - 1) * 3) MONTHS'


def test_column_plus_literal_duration() -> None:
    """
    Test column + literal number with time unit.
    """
    sql = "SELECT col + 1 DAYS FROM t"

    ast = parse_one(sql, dialect=DB2)
    regenerated = ast.sql(dialect=DB2)

    # Should parse as (col + 1 DAYS), not (col + 1) AS DAYS
    assert regenerated == "SELECT col + 1 DAYS FROM t"
