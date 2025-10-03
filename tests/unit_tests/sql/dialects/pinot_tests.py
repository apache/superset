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
import sqlglot

from superset.sql.dialects.pinot import Pinot


def test_pinot_dialect_registered() -> None:
    """
    Test that Pinot dialect is properly registered.
    """
    from superset.sql.parse import SQLGLOT_DIALECTS

    assert "pinot" in SQLGLOT_DIALECTS
    assert SQLGLOT_DIALECTS["pinot"] == Pinot


def test_double_quotes_as_identifiers() -> None:
    """
    Test that double quotes are treated as identifiers, not string literals.
    """
    sql = 'SELECT "column_name" FROM "table_name"'
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  "column_name"
FROM "table_name"
        """.strip()
    )


def test_single_quotes_for_strings() -> None:
    """
    Test that single quotes are used for string literals.
    """
    sql = "SELECT * FROM users WHERE name = 'John'"
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  *
FROM users
WHERE
  name = 'John'
        """.strip()
    )


def test_backticks_as_identifiers() -> None:
    """
    Test that backticks work as identifiers (MySQL-style).
    Backticks are normalized to double quotes in output.
    """
    sql = "SELECT `column_name` FROM `table_name`"
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  "column_name"
FROM "table_name"
        """.strip()
    )


def test_mixed_identifier_quotes() -> None:
    """
    Test mixing double quotes and backticks for identifiers.
    All identifiers are normalized to double quotes in output.
    """
    sql = (
        'SELECT "col1", `col2` FROM "table1" JOIN `table2` ON "table1".id = `table2`.id'
    )
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  "col1",
  "col2"
FROM "table1"
JOIN "table2"
  ON "table1".id = "table2".id
        """.strip()
    )


def test_string_with_escaped_quotes() -> None:
    """
    Test string literals with escaped single quotes.
    """
    sql = "SELECT * FROM users WHERE name = 'O''Brien'"
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  *
FROM users
WHERE
  name = 'O''Brien'
        """.strip()
    )


def test_string_with_backslash_escape() -> None:
    """
    Test string literals with backslash escapes.
    """
    sql = r"SELECT * FROM users WHERE path = 'C:\\Users\\John'"
    ast = sqlglot.parse_one(sql, Pinot)

    generated = Pinot().generate(expression=ast, pretty=True)
    assert "WHERE" in generated
    assert "path" in generated


@pytest.mark.parametrize(
    "sql, expected",
    [
        (
            'SELECT COUNT(*) FROM "events" WHERE "type" = \'click\'',
            """
SELECT
  COUNT(*)
FROM "events"
WHERE
  "type" = 'click'
            """.strip(),
        ),
        (
            'SELECT "user_id", SUM("amount") FROM "transactions" GROUP BY "user_id"',
            """
SELECT
  "user_id",
  SUM("amount")
FROM "transactions"
GROUP BY
  "user_id"
            """.strip(),
        ),
        (
            "SELECT * FROM \"orders\" WHERE \"status\" IN ('pending', 'shipped')",
            """
SELECT
  *
FROM "orders"
WHERE
  "status" IN ('pending', 'shipped')
            """.strip(),
        ),
    ],
)
def test_various_queries(sql: str, expected: str) -> None:
    """
    Test various SQL queries with Pinot dialect.
    """
    ast = sqlglot.parse_one(sql, Pinot)
    assert Pinot().generate(expression=ast, pretty=True) == expected


def test_aggregate_functions() -> None:
    """
    Test aggregate functions with quoted identifiers.
    """
    sql = """
SELECT
    "category",
    COUNT(*),
    AVG("price"),
    MAX("quantity")
FROM "products"
GROUP BY "category"
    """
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  "category",
  COUNT(*),
  AVG("price"),
  MAX("quantity")
FROM "products"
GROUP BY
  "category"
        """.strip()
    )


def test_join_with_quoted_identifiers() -> None:
    """
    Test JOIN operations with double-quoted identifiers.
    """
    sql = """
    SELECT "u"."name", "o"."total"
    FROM "users" AS "u"
    JOIN "orders" AS "o" ON "u"."id" = "o"."user_id"
    """
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  "u"."name",
  "o"."total"
FROM "users" AS "u"
JOIN "orders" AS "o"
  ON "u"."id" = "o"."user_id"
        """.strip()
    )


def test_subquery_with_quoted_identifiers() -> None:
    """
    Test subqueries with double-quoted identifiers.
    """
    sql = 'SELECT * FROM (SELECT "id", "name" FROM "users") AS "subquery"'
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  *
FROM (
  SELECT
    "id",
    "name"
  FROM "users"
) AS "subquery"
        """.strip()
    )


def test_case_expression() -> None:
    """
    Test CASE expressions with quoted identifiers.
    """
    sql = """
    SELECT "name",
           CASE WHEN "age" < 18 THEN 'minor'
                WHEN "age" >= 18 THEN 'adult'
           END AS "category"
    FROM "persons"
    """
    ast = sqlglot.parse_one(sql, Pinot)

    generated = Pinot().generate(expression=ast, pretty=True)
    assert '"name"' in generated
    assert '"age"' in generated
    assert '"category"' in generated
    assert "'minor'" in generated
    assert "'adult'" in generated


def test_cte_with_quoted_identifiers() -> None:
    """
    Test Common Table Expressions (CTE) with quoted identifiers.
    """
    sql = """
    WITH "high_value_orders" AS (
        SELECT * FROM "orders" WHERE "total" > 1000
    )
    SELECT "customer_id", COUNT(*) FROM "high_value_orders" GROUP BY "customer_id"
    """
    ast = sqlglot.parse_one(sql, Pinot)

    generated = Pinot().generate(expression=ast, pretty=True)
    assert 'WITH "high_value_orders" AS' in generated
    assert '"orders"' in generated
    assert '"total"' in generated
    assert '"customer_id"' in generated


def test_order_by_with_quoted_identifiers() -> None:
    """
    Test ORDER BY clause with quoted identifiers.
    SQLGlot explicitly includes ASC in the output.
    """
    sql = 'SELECT "name", "salary" FROM "employees" ORDER BY "salary" DESC, "name" ASC'
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  "name",
  "salary"
FROM "employees"
ORDER BY
  "salary" DESC,
  "name" ASC
        """.strip()
    )


def test_limit_and_offset() -> None:
    """
    Test LIMIT and OFFSET clauses.
    """
    sql = 'SELECT * FROM "products" LIMIT 10 OFFSET 20'
    ast = sqlglot.parse_one(sql, Pinot)

    generated = Pinot().generate(expression=ast, pretty=True)
    assert '"products"' in generated
    assert "LIMIT 10" in generated


def test_distinct() -> None:
    """
    Test DISTINCT keyword with quoted identifiers.
    """
    sql = 'SELECT DISTINCT "category" FROM "products"'
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT DISTINCT
  "category"
FROM "products"
        """.strip()
    )


def test_cast_to_string() -> None:
    """
    Test that CAST to STRING is preserved (not converted to CHAR).
    """
    sql = "SELECT CAST(cohort_size AS STRING) FROM table"
    ast = sqlglot.parse_one(sql, Pinot)
    generated = Pinot().generate(expression=ast)

    assert "STRING" in generated
    assert "CHAR" not in generated


def test_concat_with_cast_string() -> None:
    """
    Test CONCAT with CAST to STRING - verifies the original issue is fixed.
    """
    sql = """
SELECT concat(a, cast(b AS string), ' - ')
FROM "default".c"""
    ast = sqlglot.parse_one(sql, Pinot)
    generated = Pinot().generate(expression=ast)

    # Verify STRING type is preserved (not converted to CHAR)
    assert "STRING" in generated or "string" in generated.lower()
    assert "CHAR" not in generated


@pytest.mark.parametrize(
    "cast_type, expected_type",
    [
        ("INT", "INT"),
        ("TINYINT", "INT"),
        ("SMALLINT", "INT"),
        ("BIGINT", "LONG"),
        ("LONG", "LONG"),
        ("FLOAT", "FLOAT"),
        ("DOUBLE", "DOUBLE"),
        ("BOOLEAN", "BOOLEAN"),
        ("TIMESTAMP", "TIMESTAMP"),
        ("STRING", "STRING"),
        ("VARCHAR", "STRING"),
        ("CHAR", "STRING"),
        ("TEXT", "STRING"),
        ("BYTES", "BYTES"),
        ("BINARY", "BYTES"),
        ("VARBINARY", "BYTES"),
        ("JSON", "JSON"),
    ],
)
def test_type_mappings(cast_type: str, expected_type: str) -> None:
    """
    Test that Pinot type mappings work correctly for all basic types.
    """
    sql = f"SELECT CAST(col AS {cast_type}) FROM table"  # noqa: S608
    ast = sqlglot.parse_one(sql, Pinot)
    generated = Pinot().generate(expression=ast)

    assert expected_type in generated


def test_unsigned_type() -> None:
    """
    Test that unsigned integer types are handled correctly.
    Tests the UNSIGNED_TYPE_MAPPING path in datatype_sql method.
    """
    from sqlglot import exp

    # Create a UBIGINT DataType which is in UNSIGNED_TYPE_MAPPING
    dt = exp.DataType(this=exp.DataType.Type.UBIGINT)
    result = Pinot.Generator().datatype_sql(dt)

    assert "UNSIGNED" in result
    assert "BIGINT" in result


def test_date_trunc_preserved() -> None:
    """
    Test that DATE_TRUNC is preserved and not converted to MySQL's DATE() function.
    """
    sql = "SELECT DATE_TRUNC('day', dt_column) FROM table"
    result = sqlglot.parse_one(sql, Pinot).sql(Pinot)

    assert "DATE_TRUNC" in result
    assert "date_trunc('day'" in result.lower()
    # Should not be converted to MySQL's DATE() function
    assert result != "SELECT DATE(dt_column) FROM table"


def test_cast_timestamp_preserved() -> None:
    """
    Test that CAST AS TIMESTAMP is preserved and not converted to TIMESTAMP() function.
    """
    sql = "SELECT CAST(dt_column AS TIMESTAMP) FROM table"
    result = sqlglot.parse_one(sql, Pinot).sql(Pinot)

    assert "CAST" in result
    assert "AS TIMESTAMP" in result
    # Should not be converted to MySQL's TIMESTAMP() function
    assert "TIMESTAMP(dt_column)" not in result


def test_date_trunc_with_cast_timestamp() -> None:
    """
    Test the original complex query with DATE_TRUNC and CAST AS TIMESTAMP.
    Verifies that both are preserved in parse/generate round-trip.
    """
    sql = """
SELECT
  CAST(
    DATE_TRUNC(
      'day',
      CAST(
        DATETIMECONVERT(
          dt_epoch_ms, '1:MILLISECONDS:EPOCH',
          '1:MILLISECONDS:EPOCH', '1:MILLISECONDS'
        ) AS TIMESTAMP
      )
    ) AS TIMESTAMP
  ),
  SUM(a) + SUM(b)
FROM
  "default".c
WHERE
  dt_epoch_ms >= 1735690800000
  AND dt_epoch_ms < 1759328588000
  AND locality != 'US'
GROUP BY
  CAST(
    DATE_TRUNC(
      'day',
      CAST(
        DATETIMECONVERT(
          dt_epoch_ms, '1:MILLISECONDS:EPOCH',
          '1:MILLISECONDS:EPOCH', '1:MILLISECONDS'
        ) AS TIMESTAMP
      )
    ) AS TIMESTAMP
  )
LIMIT
  10000
    """
    result = sqlglot.parse_one(sql, Pinot).sql(Pinot)

    # Verify DATE_TRUNC and CAST are preserved
    assert "DATE_TRUNC" in result
    assert "CAST" in result

    # Verify these are NOT converted to MySQL functions
    assert "TIMESTAMP(DATETIMECONVERT" not in result
    assert result.count("DATE_TRUNC") == 2  # Should appear twice (SELECT and GROUP BY)


def test_pinot_date_add_parsing() -> None:
    """
    Test that Pinot's DATE_ADD function with Presto-like syntax can be parsed.
    """
    from superset.sql.parse import SQLScript

    sql = """
SELECT dt_epoch_ms FROM my_table WHERE dt_epoch_ms >= date_add('day', -180, now())
    """
    script = SQLScript(sql, "pinot")
    assert len(script.statements) == 1
    assert not script.has_mutation()


def test_pinot_date_add_simple() -> None:
    """
    Test parsing of simple DATE_ADD expressions.
    """
    test_cases = [
        "date_add('day', -180, now())",
        "DATE_ADD('month', 5, current_timestamp())",
        "date_add('year', 1, my_date_column)",
    ]

    for sql in test_cases:
        parsed = sqlglot.parse_one(sql, Pinot)
        assert parsed is not None
        # Verify that it generates valid SQL
        generated = parsed.sql(dialect=Pinot)
        assert "DATE_ADD" in generated.upper()


def test_pinot_date_add_unit_quoted() -> None:
    """
    Test that DATE_ADD preserves quotes around the unit argument.

    Pinot requires the unit to be a quoted string, not an identifier.
    """
    sql = "dt_epoch_ms >= date_add('day', -180, now())"
    result = sqlglot.parse_one(sql, Pinot).sql(Pinot)

    # The unit should be quoted: 'DAY' not DAY
    assert "DATE_ADD('DAY', -180, NOW())" in result
    assert "DATE_ADD(DAY," not in result


def test_pinot_date_sub_parsing() -> None:
    """
    Test that Pinot's DATE_SUB function with Presto-like syntax can be parsed.
    """
    from superset.sql.parse import SQLScript

    sql = "SELECT * FROM my_table WHERE dt >= date_sub('day', 7, now())"
    script = SQLScript(sql, "pinot")
    assert len(script.statements) == 1
    assert not script.has_mutation()


def test_pinot_date_sub_simple() -> None:
    """
    Test parsing of simple DATE_SUB expressions.
    """
    test_cases = [
        "date_sub('day', 7, now())",
        "DATE_SUB('month', 3, current_timestamp())",
        "date_sub('hour', 24, my_date_column)",
    ]

    for sql in test_cases:
        parsed = sqlglot.parse_one(sql, Pinot)
        assert parsed is not None
        # Verify that it generates valid SQL
        generated = parsed.sql(dialect=Pinot)
        assert "DATE_SUB" in generated.upper()


def test_pinot_date_sub_unit_quoted() -> None:
    """
    Test that DATE_SUB preserves quotes around the unit argument.

    Pinot requires the unit to be a quoted string, not an identifier.
    """
    sql = "dt_epoch_ms >= date_sub('day', -180, now())"
    result = sqlglot.parse_one(sql, Pinot).sql(Pinot)

    # The unit should be quoted: 'DAY' not DAY
    assert "DATE_SUB('DAY', -180, NOW())" in result
    assert "DATE_SUB(DAY," not in result


def test_substr_cross_dialect_generation() -> None:
    """
    Test that SUBSTR is preserved when generating Pinot SQL.

    Note that the MySQL dialect (in which Pinot is based) uses SUBSTRING instead of
    SUBSTR.
    """
    # Parse with Pinot dialect
    pinot_sql = "SELECT SUBSTR('hello', 0, 3) FROM users"
    parsed = sqlglot.parse_one(pinot_sql, Pinot)

    # Generate back to Pinot → should preserve SUBSTR
    pinot_output = parsed.sql(dialect=Pinot)
    assert "SUBSTR(" in pinot_output
    assert "SUBSTRING(" not in pinot_output

    # Generate to MySQL → should convert to SUBSTRING
    mysql_output = parsed.sql(dialect="mysql")
    assert "SUBSTRING(" in mysql_output
    assert pinot_output != mysql_output  # They should be different


@pytest.mark.parametrize(
    "function_name,sample_args",
    [
        # Math functions
        ("ABS", "-5"),
        ("CEIL", "3.14"),
        ("FLOOR", "3.14"),
        ("EXP", "2"),
        ("LN", "10"),
        ("SQRT", "16"),
        ("ROUNDDECIMAL", "3.14159, 2"),
        ("ADD", "1, 2, 3"),
        ("SUB", "10, 3"),
        ("MULT", "5, 4"),
        ("MOD", "10, 3"),
        # String functions
        ("UPPER", "'hello'"),
        ("LOWER", "'HELLO'"),
        ("REVERSE", "'hello'"),
        ("SUBSTR", "'hello', 0, 3"),
        ("CONCAT", "'hello', ' ', 'world'"),
        ("TRIM", "' hello '"),
        ("LTRIM", "' hello'"),
        ("RTRIM", "'hello '"),
        ("LENGTH", "'hello'"),
        ("STRPOS", "'hello', 'l', 1"),
        ("STARTSWITH", "'hello', 'he'"),
        ("REPLACE", "'hello', 'l', 'r'"),
        ("RPAD", "'hello', 10, 'x'"),
        ("LPAD", "'hello', 10, 'x'"),
        ("CODEPOINT", "'A'"),
        ("CHR", "65"),
        ("regexpExtract", "'foo123bar', '[0-9]+'"),
        ("regexpReplace", "'hello', 'l', 'r'"),
        ("remove", "'hello', 'l'"),
        ("urlEncoding", "'hello world'"),
        ("urlDecoding", "'hello%20world'"),
        ("fromBase64", "'aGVsbG8='"),
        ("toUtf8", "'hello'"),
        ("isSubnetOf", "'192.168.1.1', '192.168.0.0/16'"),
        # DateTime functions
        ("DATETRUNC", "'day', timestamp_col"),
        ("DATETIMECONVERT", "dt_col, '1:HOURS:EPOCH', '1:DAYS:EPOCH', '1:DAYS'"),
        ("TIMECONVERT", "timestamp_col, 'MILLISECONDS', 'SECONDS'"),
        ("NOW", ""),
        ("AGO", "'P1D'"),
        ("YEAR", "timestamp_col"),
        ("QUARTER", "timestamp_col"),
        ("MONTH", "timestamp_col"),
        ("WEEK", "timestamp_col"),
        ("DAY", "timestamp_col"),
        ("HOUR", "timestamp_col"),
        ("MINUTE", "timestamp_col"),
        ("SECOND", "timestamp_col"),
        ("MILLISECOND", "timestamp_col"),
        ("DAYOFWEEK", "timestamp_col"),
        ("DAYOFYEAR", "timestamp_col"),
        ("YEAROFWEEK", "timestamp_col"),
        ("toEpochSeconds", "timestamp_col"),
        ("toEpochMinutes", "timestamp_col"),
        ("toEpochHours", "timestamp_col"),
        ("toEpochDays", "timestamp_col"),
        ("fromEpochSeconds", "1234567890"),
        ("fromEpochMinutes", "20576131"),
        ("fromEpochHours", "342935"),
        ("fromEpochDays", "14288"),
        ("toDateTime", "timestamp_col, 'yyyy-MM-dd'"),
        ("fromDateTime", "'2024-01-01', 'yyyy-MM-dd'"),
        ("timezoneHour", "timestamp_col"),
        ("timezoneMinute", "timestamp_col"),
        ("DATE_ADD", "'day', 7, NOW()"),
        ("DATE_SUB", "'day', 7, NOW()"),
        ("TIMESTAMPADD", "'day', 7, timestamp_col"),
        ("TIMESTAMPDIFF", "'day', timestamp1, timestamp2"),
        ("dateTrunc", "'day', timestamp_col"),
        ("dateDiff", "'day', timestamp1, timestamp2"),
        ("dateAdd", "'day', 7, timestamp_col"),
        ("dateBin", "'day', timestamp_col, NOW()"),
        ("toIso8601", "timestamp_col"),
        ("fromIso8601", "'2024-01-01T00:00:00Z'"),
        # Aggregation functions
        ("COUNT", "*"),
        ("SUM", "amount"),
        ("AVG", "value"),
        ("MIN", "value"),
        ("MAX", "value"),
        ("DISTINCTCOUNT", "user_id"),
        ("DISTINCTCOUNTBITMAP", "user_id"),
        ("DISTINCTCOUNTHLL", "user_id"),
        ("DISTINCTCOUNTRAWHLL", "user_id"),
        ("DISTINCTCOUNTHLLPLUS", "user_id"),
        ("DISTINCTCOUNTRAWHLLPLUS", "user_id"),
        ("DISTINCTCOUNTSMARTHLL", "user_id"),
        ("DISTINCTCOUNTCPCSKETCH", "user_id"),
        ("DISTINCTCOUNTRAWCPCSKETCH", "user_id"),
        ("DISTINCTCOUNTTHETASKETCH", "user_id"),
        ("DISTINCTCOUNTRAWTHETASKETCH", "user_id"),
        ("DISTINCTCOUNTTUPLESKETCH", "user_id"),
        ("DISTINCTCOUNTRAWINTEGERSUMTUPLESKETCH", "user_id"),
        ("DISTINCTCOUNTULL", "user_id"),
        ("DISTINCTCOUNTRAWULL", "user_id"),
        ("SEGMENTPARTITIONEDDISTINCTCOUNT", "user_id"),
        ("SUMVALUESINTEGERSUMTUPLESKETCH", "value"),
        ("PERCENTILE", "value, 95"),
        ("PERCENTILEEST", "value, 95"),
        ("PERCENTILETDIGEST", "value, 95"),
        ("PERCENTILESMARTTDIGEST", "value, 95"),
        ("PERCENTILEKLL", "value, 95"),
        ("PERCENTILEKLLRAW", "value, 95"),
        ("HISTOGRAM", "value, 10"),
        ("MODE", "category"),
        ("MINMAXRANGE", "value"),
        ("SUMPRECISION", "value, 10"),
        ("ARG_MIN", "value, id"),
        ("ARG_MAX", "value, id"),
        ("COVAR_POP", "x, y"),
        ("COVAR_SAMP", "x, y"),
        ("LASTWITHTIME", "value, timestamp_col, 'LONG'"),
        ("FIRSTWITHTIME", "value, timestamp_col, 'LONG'"),
        ("ARRAY_AGG", "value"),
        # Multi-value functions
        ("COUNTMV", "tags"),
        ("MAXMV", "scores"),
        ("MINMV", "scores"),
        ("SUMMV", "scores"),
        ("AVGMV", "scores"),
        ("MINMAXRANGEMV", "scores"),
        ("PERCENTILEMV", "scores, 95"),
        ("PERCENTILEESTMV", "scores, 95"),
        ("PERCENTILETDIGESTMV", "scores, 95"),
        ("PERCENTILEKLLMV", "scores, 95"),
        ("DISTINCTCOUNTMV", "tags"),
        ("DISTINCTCOUNTBITMAPMV", "tags"),
        ("DISTINCTCOUNTHLLMV", "tags"),
        ("DISTINCTCOUNTRAWHLLMV", "tags"),
        ("DISTINCTCOUNTHLLPLUSMV", "tags"),
        ("DISTINCTCOUNTRAWHLLPLUSMV", "tags"),
        ("ARRAYLENGTH", "array_col"),
        ("MAP_VALUE", "map_col, 'key'"),
        ("VALUEIN", "value, 'val1', 'val2'"),
        # JSON functions
        ("JSONEXTRACTSCALAR", "json_col, '$.name', 'STRING'"),
        ("JSONEXTRACTKEY", "json_col, '$.data'"),
        ("JSONFORMAT", "json_col"),
        ("JSONPATH", "json_col, '$.name'"),
        ("JSONPATHLONG", "json_col, '$.id'"),
        ("JSONPATHDOUBLE", "json_col, '$.price'"),
        ("JSONPATHSTRING", "json_col, '$.name'"),
        ("JSONPATHARRAY", "json_col, '$.items'"),
        ("JSONPATHARRAYDEFAULTEMPTY", "json_col, '$.items'"),
        ("TOJSONMAPSTR", "map_col"),
        ("JSON_MATCH", "json_col, '\"$.name\"=''value'''"),
        ("JSON_EXTRACT_SCALAR", "json_col, '$.name', 'STRING'"),
        # Array functions
        ("arrayReverseInt", "int_array"),
        ("arrayReverseString", "string_array"),
        ("arraySortInt", "int_array"),
        ("arraySortString", "string_array"),
        ("arrayIndexOfInt", "int_array, 5"),
        ("arrayIndexOfString", "string_array, 'value'"),
        ("arrayContainsInt", "int_array, 5"),
        ("arrayContainsString", "string_array, 'value'"),
        ("arraySliceInt", "int_array, 0, 3"),
        ("arraySliceString", "string_array, 0, 3"),
        ("arrayDistinctInt", "int_array"),
        ("arrayDistinctString", "string_array"),
        ("arrayRemoveInt", "int_array, 5"),
        ("arrayRemoveString", "string_array, 'value'"),
        ("arrayUnionInt", "int_array1, int_array2"),
        ("arrayUnionString", "string_array1, string_array2"),
        ("arrayConcatInt", "int_array1, int_array2"),
        ("arrayConcatString", "string_array1, string_array2"),
        ("arrayElementAtInt", "int_array, 0"),
        ("arrayElementAtString", "string_array, 0"),
        ("arraySumInt", "int_array"),
        ("arrayValueConstructor", "1, 2, 3"),
        ("arrayToString", "array_col, ','"),
        # Geospatial functions
        ("ST_DISTANCE", "point1, point2"),
        ("ST_CONTAINS", "polygon, point"),
        ("ST_AREA", "polygon"),
        ("ST_GEOMFROMTEXT", "'POINT(1 2)'"),
        ("ST_GEOMFROMWKB", "wkb_col"),
        ("ST_GEOGFROMWKB", "wkb_col"),
        ("ST_GEOGFROMTEXT", "'POINT(1 2)'"),
        ("ST_POINT", "1.0, 2.0"),
        ("ST_POLYGON", "'POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))'"),
        ("ST_ASBINARY", "geom_col"),
        ("ST_ASTEXT", "geom_col"),
        ("ST_GEOMETRYTYPE", "geom_col"),
        ("ST_EQUALS", "geom1, geom2"),
        ("ST_WITHIN", "geom1, geom2"),
        ("ST_UNION", "geom1, geom2"),
        ("ST_GEOMFROMGEOJSON", '\'{"type":"Point","coordinates":[1,2]}\''),
        ("ST_GEOGFROMGEOJSON", '\'{"type":"Point","coordinates":[1,2]}\''),
        ("ST_ASGEOJSON", "geom_col"),
        ("toSphericalGeography", "geom_col"),
        ("toGeometry", "geog_col"),
        # Binary/Hash functions
        ("SHA", "'hello'"),
        ("SHA256", "'hello'"),
        ("SHA512", "'hello'"),
        ("SHA224", "'hello'"),
        ("MD5", "'hello'"),
        ("MD2", "'hello'"),
        ("toBase64", "'hello'"),
        ("fromUtf8", "bytes_col"),
        ("MurmurHash2", "'hello'"),
        ("MurmurHash3Bit32", "'hello'"),
        # Window functions
        ("ROW_NUMBER", ""),
        ("RANK", ""),
        ("DENSE_RANK", ""),
        # Funnel analysis
        ("FunnelMaxStep", "event_col, 'step1', 'step2', 'step3'"),
        ("FunnelMatchStep", "event_col, 'step1', 'step2', 'step3'"),
        ("FunnelCompleteCount", "event_col, 'step1', 'step2', 'step3'"),
        # Text search
        ("TEXT_MATCH", "text_col, 'search query'"),
        # Vector functions
        ("VECTOR_SIMILARITY", "vector1, vector2"),
        ("l2_distance", "vector1, vector2"),
        # Lookup
        ("LOOKUP", "'lookupTable', 'lookupColumn', 'keyColumn', keyValue"),
        # URL functions
        ("urlProtocol", "'https://example.com/path'"),
        ("urlDomain", "'https://example.com/path'"),
        ("urlPath", "'https://example.com/path'"),
        ("urlPort", "'https://example.com:8080/path'"),
        ("urlEncode", "'hello world'"),
        ("urlDecode", "'hello%20world'"),
        # Conditional
        ("COALESCE", "val1, val2, 'default'"),
        ("NULLIF", "val1, val2"),
        ("GREATEST", "1, 2, 3"),
        ("LEAST", "1, 2, 3"),
        # Other
        ("REGEXP_LIKE", "'hello', 'h.*'"),
        ("GROOVY", "'{return arg0 + arg1}', col1, col2"),
    ],
)
def test_pinot_function_names_preserved(function_name: str, sample_args: str) -> None:
    """
    Test that Pinot function names are preserved during parse/generate roundtrip.

    This ensures that when we parse Pinot SQL and generate it back, the function
    names remain unchanged. This is critical for maintaining compatibility with
    Pinot's function library.
    """
    # Special handling for window functions
    if function_name in ["ROW_NUMBER", "RANK", "DENSE_RANK"]:
        sql = f"SELECT {function_name}() OVER (ORDER BY col) FROM table"  # noqa: S608
    else:
        sql = f"SELECT {function_name}({sample_args}) FROM table"  # noqa: S608

    # Parse with Pinot dialect
    parsed = sqlglot.parse_one(sql, Pinot)

    # Generate back to Pinot
    generated = parsed.sql(dialect=Pinot)

    # The function name should be preserved (case-insensitive check)
    assert function_name.upper() in generated.upper(), (
        f"Function {function_name} not preserved in output: {generated}"
    )
