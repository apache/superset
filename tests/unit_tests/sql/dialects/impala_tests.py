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
from sqlglot import exp, parse_one

from superset.sql.dialects.impala import Impala


def test_impala_date_add_functions() -> None:
    """
    Test Impala-specific date addition functions.
    """
    # Test MONTHS_ADD
    sql = "SELECT MONTHS_ADD(date_col, 3) FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT MONTHS_ADD(date_col, 3) FROM table1"

    # Test YEARS_ADD
    sql = "SELECT YEARS_ADD(date_col, 2) FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT YEARS_ADD(date_col, 2) FROM table1"

    # Test DAYS_ADD
    sql = "SELECT DAYS_ADD(date_col, 7) FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT DAYS_ADD(date_col, 7) FROM table1"

    # Test WEEKS_ADD
    sql = "SELECT WEEKS_ADD(date_col, 4) FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT WEEKS_ADD(date_col, 4) FROM table1"


def test_impala_date_sub_functions() -> None:
    """
    Test Impala-specific date subtraction functions.
    """
    # Test MONTHS_SUB
    sql = "SELECT MONTHS_SUB(date_col, 3) FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT MONTHS_SUB(date_col, 3) FROM table1"

    # Test YEARS_SUB
    sql = "SELECT YEARS_SUB(date_col, 2) FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT YEARS_SUB(date_col, 2) FROM table1"

    # Test DAYS_SUB
    sql = "SELECT DAYS_SUB(date_col, 7) FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT DAYS_SUB(date_col, 7) FROM table1"

    # Test WEEKS_SUB
    sql = "SELECT WEEKS_SUB(date_col, 4) FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT WEEKS_SUB(date_col, 4) FROM table1"


def test_impala_date_part_function() -> None:
    """
    Test DATE_PART function parsing.
    """
    # Test DATE_PART with YEAR
    sql = "SELECT DATE_PART('YEAR', date_col) FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT YEAR(date_col) FROM table1"

    # Test DATE_PART with MONTH
    sql = "SELECT DATE_PART('MONTH', date_col) FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT MONTH(date_col) FROM table1"

    # Test DATE_PART with DAY
    sql = "SELECT DATE_PART('DAY', date_col) FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT DAY(date_col) FROM table1"


def test_impala_data_types() -> None:
    """
    Test that Impala treats VARCHAR/CHAR as STRING.
    """
    # Test VARCHAR conversion
    sql = "CREATE TABLE test (col1 VARCHAR(100))"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "CREATE TABLE test (col1 STRING)"

    # Test CHAR conversion
    sql = "CREATE TABLE test (col1 CHAR(10))"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "CREATE TABLE test (col1 STRING)"

    # Test NVARCHAR conversion
    sql = "CREATE TABLE test (col1 NVARCHAR(50))"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "CREATE TABLE test (col1 STRING)"


def test_impala_unsupported_functions() -> None:
    """
    Test that unsupported Hive functions are handled properly.
    """
    # STR_TO_MAP is not supported
    with pytest.raises(Exception) as exc_info:
        sql = "SELECT STR_TO_MAP('a:1,b:2', ',', ':') FROM table1"
        ast = parse_one(sql, dialect=Impala)
        ast.sql(dialect=Impala)
    assert "STR_TO_MAP is not supported" in str(exc_info.value)

    # TRANSFORM is not supported
    with pytest.raises(Exception) as exc_info:
        sql = "SELECT TRANSFORM(col) USING 'script.py' FROM table1"
        ast = parse_one(sql, dialect=Impala)
        ast.sql(dialect=Impala)
    assert "TRANSFORM is not supported" in str(exc_info.value)


def test_impala_json_functions() -> None:
    """
    Test that JSON functions are mapped to Impala equivalents.
    """
    # Test JSON extract scalar to JSON_VALUE
    sql = "SELECT GET_JSON_OBJECT(json_col, '$.field') FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT JSON_VALUE(json_col, '$.field') FROM table1"


def test_impala_aggregate_functions() -> None:
    """
    Test that COLLECT_LIST/SET are mapped to GROUP_CONCAT.
    """
    # Test COLLECT_LIST conversion
    sql = "SELECT COLLECT_LIST(col1) FROM table1 GROUP BY col2"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT GROUP_CONCAT(col1, ',') FROM table1 GROUP BY col2"

    # Test COLLECT_SET conversion
    sql = "SELECT COLLECT_SET(col1) FROM table1 GROUP BY col2"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert (
        regenerated
        == "SELECT GROUP_CONCAT(DISTINCT col1, ',') FROM table1 GROUP BY col2"
    )


def test_standard_date_add_sub() -> None:
    """
    Test standard DATE_ADD/DATE_SUB with generic units.
    """
    # Generic DATE_ADD (should be parsed and regenerated as-is)
    sql = "SELECT DATE_ADD(date_col, 5) FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT DAYS_ADD(date_col, 5) FROM table1"


def test_unnest_without_lateral_view() -> None:
    """
    Test that UNNEST is handled without LATERAL VIEW syntax.
    """
    # Impala uses JOIN with UNNEST instead of LATERAL VIEW
    sql = "SELECT * FROM table1, UNNEST(array_col) AS t(elem)"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    # Should not contain LATERAL VIEW
    assert "LATERAL VIEW" not in regenerated
    assert "UNNEST" in regenerated


def test_extract_function() -> None:
    """
    Test EXTRACT function.
    """
    sql = "SELECT EXTRACT(YEAR FROM date_col) FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT EXTRACT(YEAR FROM date_col) FROM table1"

    sql = "SELECT EXTRACT(MONTH FROM date_col) FROM table1"
    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)
    assert regenerated == "SELECT EXTRACT(MONTH FROM date_col) FROM table1"


def test_complex_query() -> None:
    """
    Test a more complex query with multiple Impala-specific features.
    """
    sql = """
    SELECT 
        customer_id,
        GROUP_CONCAT(product_name, ',') as products,
        MONTHS_ADD(order_date, 1) as next_month,
        JSON_VALUE(order_details, '$.total') as total
    FROM orders
    WHERE YEARS_SUB(order_date, 1) > '2022-01-01'
    GROUP BY customer_id, order_date, order_details
    """

    ast = parse_one(sql, dialect=Impala)
    regenerated = ast.sql(dialect=Impala)

    # Check key components are preserved
    assert "GROUP_CONCAT" in regenerated
    assert "MONTHS_ADD" in regenerated
    assert "JSON_VALUE" in regenerated
    assert "YEARS_SUB" in regenerated


@pytest.mark.parametrize(
    "func, expected_class, unit",
    [
        ("MONTHS_ADD(x, 1)", exp.DateAdd, "MONTH"),
        ("YEARS_SUB(x, 2)", exp.DateSub, "YEAR"),
        ("DAYS_ADD(x, 3)", exp.DateAdd, "DAY"),
        ("WEEKS_SUB(x, 4)", exp.DateSub, "WEEK"),
    ],
)
def test_date_functions_parse_correctly(func, expected_class, unit):
    parsed = parse_one(func, read=Impala)
    assert isinstance(parsed, expected_class)
    assert parsed.text("unit").upper() == unit


@pytest.mark.parametrize(
    "sql, expected_expr",
    [
        ("DATE_PART('year', d)", exp.Year),
        ("DATE_PART('second', d)", exp.Second),
        ("EXTRACT(year FROM d)", exp.Extract),
    ],
)
def test_date_part_and_extract(sql, expected_expr):
    parsed = parse_one(sql, read=Impala)
    if expected_expr == exp.Extract:
        assert isinstance(parsed, expected_expr)
    else:
        assert isinstance(parsed, expected_expr)


@pytest.mark.parametrize(
    "expr, expected_sql",
    [
        (
            exp.DateAdd(
                this=exp.Column(this="x"),
                expression=exp.Literal.number(1),
                unit=exp.Literal.string("YEAR"),
            ),
            "YEARS_ADD(x, 1)",
        ),
        (
            exp.DateSub(
                this=exp.Column(this="y"),
                expression=exp.Literal.number(2),
                unit=exp.Literal.string("MONTH"),
            ),
            "MONTHS_SUB(y, 2)",
        ),
    ],
)
def test_sql_generation_for_date_add_sub(expr, expected_sql):
    sql = expr.sql(dialect=Impala)
    assert sql == expected_sql


def test_string_type_is_mapped():
    expr = exp.DataType.build("VARCHAR")
    sql = expr.sql(dialect=Impala)
    assert sql == "STRING"


def test_unsupported_functions_raise():
    gen = Impala.Generator()
    with pytest.raises(Exception):
        gen.sql(exp.StrToMap(this=exp.Literal.string("x")))


@pytest.mark.parametrize(
    "sql",
    [
        "LATERAL VIEW explode(arr) t",
    ],
)
def test_lateral_not_supported(sql):
    parsed = parse_one(sql, read=Impala)
    assert parsed is None or isinstance(parsed, exp.Expression)
