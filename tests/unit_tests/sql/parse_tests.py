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
# pylint: disable=invalid-name, redefined-outer-name, too-many-lines


import pytest
from sqlglot import Dialects

from superset.exceptions import SupersetParseError
from superset.sql.parse import (
    extract_tables_from_statement,
    KustoKQLStatement,
    split_kql,
    SQLGLOT_DIALECTS,
    SQLScript,
    SQLStatement,
    Table,
)


def test_table() -> None:
    """
    Test the `Table` class and its string conversion.

    Special characters in the table, schema, or catalog name should be escaped correctly.
    """
    assert str(Table("tbname")) == "tbname"
    assert str(Table("tbname", "schemaname")) == "schemaname.tbname"
    assert (
        str(Table("tbname", "schemaname", "catalogname"))
        == "catalogname.schemaname.tbname"
    )
    assert (
        str(Table("table.name", "schema/name", "catalog\nname"))
        == "catalog%0Aname.schema%2Fname.table%2Ename"
    )


def extract_tables_from_sql(sql: str, engine: str = "postgresql") -> set[Table]:
    """
    Helper function to extract tables from SQL.
    """
    dialect = SQLGLOT_DIALECTS.get(engine)
    return {
        table
        for statement in SQLScript(sql, engine).statements
        for table in extract_tables_from_statement(statement._parsed, dialect)
    }


def test_extract_tables_from_sql() -> None:
    """
    Test that referenced tables are parsed correctly from the SQL.
    """
    assert extract_tables_from_sql("SELECT * FROM tbname") == {Table("tbname")}
    assert extract_tables_from_sql("SELECT * FROM tbname foo") == {Table("tbname")}
    assert extract_tables_from_sql("SELECT * FROM tbname AS foo") == {Table("tbname")}

    # underscore
    assert extract_tables_from_sql("SELECT * FROM tb_name") == {Table("tb_name")}

    # quotes
    assert extract_tables_from_sql('SELECT * FROM "tbname"') == {Table("tbname")}

    # unicode
    assert extract_tables_from_sql('SELECT * FROM "tb_name" WHERE city = "Lübeck"') == {
        Table("tb_name")
    }

    # columns
    assert extract_tables_from_sql("SELECT field1, field2 FROM tb_name") == {
        Table("tb_name")
    }
    assert extract_tables_from_sql("SELECT t1.f1, t2.f2 FROM t1, t2") == {
        Table("t1"),
        Table("t2"),
    }

    # named table
    assert extract_tables_from_sql(
        "SELECT a.date, a.field FROM left_table a LIMIT 10"
    ) == {Table("left_table")}

    assert extract_tables_from_sql(
        "SELECT FROM (SELECT FROM forbidden_table) AS forbidden_table;"
    ) == {Table("forbidden_table")}

    assert extract_tables_from_sql(
        "select * from (select * from forbidden_table) forbidden_table"
    ) == {Table("forbidden_table")}


def test_extract_tables_subselect() -> None:
    """
    Test that tables inside subselects are parsed correctly.
    """
    assert extract_tables_from_sql(
        """
SELECT sub.*
FROM (
    SELECT *
        FROM s1.t1
        WHERE day_of_week = 'Friday'
    ) sub, s2.t2
WHERE sub.resolution = 'NONE'
"""
    ) == {Table("t1", "s1"), Table("t2", "s2")}

    assert extract_tables_from_sql(
        """
SELECT sub.*
FROM (
    SELECT *
    FROM s1.t1
    WHERE day_of_week = 'Friday'
) sub
WHERE sub.resolution = 'NONE'
"""
    ) == {Table("t1", "s1")}

    assert extract_tables_from_sql(
        """
SELECT * FROM t1
WHERE s11 > ANY (
    SELECT COUNT(*) /* no hint */ FROM t2
    WHERE NOT EXISTS (
        SELECT * FROM t3
        WHERE ROW(5*t2.s1,77)=(
            SELECT 50,11*s1 FROM t4
        )
    )
)
"""
    ) == {Table("t1"), Table("t2"), Table("t3"), Table("t4")}


def test_extract_tables_select_in_expression() -> None:
    """
    Test that parser works with `SELECT`s used as expressions.
    """
    assert extract_tables_from_sql("SELECT f1, (SELECT count(1) FROM t2) FROM t1") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables_from_sql(
        "SELECT f1, (SELECT count(1) FROM t2) as f2 FROM t1"
    ) == {
        Table("t1"),
        Table("t2"),
    }


def test_extract_tables_parenthesis() -> None:
    """
    Test that parenthesis are parsed correctly.
    """
    assert extract_tables_from_sql("SELECT f1, (x + y) AS f2 FROM t1") == {Table("t1")}


def test_extract_tables_with_schema() -> None:
    """
    Test that schemas are parsed correctly.
    """
    assert extract_tables_from_sql("SELECT * FROM schemaname.tbname") == {
        Table("tbname", "schemaname")
    }
    assert extract_tables_from_sql('SELECT * FROM "schemaname"."tbname"') == {
        Table("tbname", "schemaname")
    }
    assert extract_tables_from_sql('SELECT * FROM "schemaname"."tbname" foo') == {
        Table("tbname", "schemaname")
    }
    assert extract_tables_from_sql('SELECT * FROM "schemaname"."tbname" AS foo') == {
        Table("tbname", "schemaname")
    }


def test_extract_tables_union() -> None:
    """
    Test that `UNION` queries work as expected.
    """
    assert extract_tables_from_sql("SELECT * FROM t1 UNION SELECT * FROM t2") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables_from_sql("SELECT * FROM t1 UNION ALL SELECT * FROM t2") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables_from_sql(
        "SELECT * FROM t1 INTERSECT ALL SELECT * FROM t2"
    ) == {
        Table("t1"),
        Table("t2"),
    }


def test_extract_tables_select_from_values() -> None:
    """
    Test that selecting from values returns no tables.
    """
    assert extract_tables_from_sql("SELECT * FROM VALUES (13, 42)") == set()


def test_extract_tables_select_array() -> None:
    """
    Test that queries selecting arrays work as expected.
    """
    assert extract_tables_from_sql(
        """
SELECT ARRAY[1, 2, 3] AS my_array
FROM t1 LIMIT 10
"""
    ) == {Table("t1")}


def test_extract_tables_select_if() -> None:
    """
    Test that queries with an `IF` work as expected.
    """
    assert extract_tables_from_sql(
        """
SELECT IF(CARDINALITY(my_array) >= 3, my_array[3], NULL)
FROM t1 LIMIT 10
"""
    ) == {Table("t1")}


def test_extract_tables_with_catalog() -> None:
    """
    Test that catalogs are parsed correctly.
    """
    assert extract_tables_from_sql("SELECT * FROM catalogname.schemaname.tbname") == {
        Table("tbname", "schemaname", "catalogname")
    }


def test_extract_tables_illdefined() -> None:
    """
    Test that ill-defined tables return an empty set.
    """
    with pytest.raises(SupersetParseError) as excinfo:
        extract_tables_from_sql("SELECT * FROM schemaname.")
    assert str(excinfo.value) == "Error parsing near '.' at line 1:25"

    with pytest.raises(SupersetParseError) as excinfo:
        extract_tables_from_sql("SELECT * FROM catalogname.schemaname.")
    assert str(excinfo.value) == "Error parsing near '.' at line 1:37"

    with pytest.raises(SupersetParseError) as excinfo:
        extract_tables_from_sql("SELECT * FROM catalogname..")
    assert str(excinfo.value) == "Error parsing near '.' at line 1:27"

    with pytest.raises(SupersetParseError) as excinfo:
        extract_tables_from_sql('SELECT * FROM "tbname')
    assert str(excinfo.value) == "Unable to parse script"

    # odd edge case that works
    assert extract_tables_from_sql("SELECT * FROM catalogname..tbname") == {
        Table(table="tbname", schema=None, catalog="catalogname")
    }


def test_extract_tables_show_tables_from() -> None:
    """
    Test `SHOW TABLES FROM`.
    """
    assert (
        extract_tables_from_sql("SHOW TABLES FROM s1 like '%order%'", "mysql") == set()
    )


def test_format_show_tables() -> None:
    """
    Test format when `ast.sql()` raises an exception.

    In that case sqlparse should be used instead.
    """
    assert (
        SQLScript("SHOW TABLES FROM s1 like '%order%'", "mysql").format()
        == "SHOW TABLES FROM s1 LIKE '%order%'"
    )


def test_format_no_dialect() -> None:
    """
    Test format with an engine that has no corresponding dialect.
    """
    assert (
        SQLScript("SELECT col FROM t WHERE col NOT IN (1, 2)", "firebolt").format()
        == "SELECT col\nFROM t\nWHERE col NOT IN (1,\n                  2)"
    )


def test_split_no_dialect() -> None:
    """
    Test the statement split when the engine has no corresponding dialect.
    """
    sql = "SELECT col FROM t WHERE col NOT IN (1, 2); SELECT * FROM t; SELECT foo"
    statements = SQLScript(sql, "firebolt").statements
    assert len(statements) == 3
    assert statements[0]._sql == "SELECT col FROM t WHERE col NOT IN (1, 2)"
    assert statements[1]._sql == "SELECT * FROM t"
    assert statements[2]._sql == "SELECT foo"


def test_extract_tables_show_columns_from() -> None:
    """
    Test `SHOW COLUMNS FROM`.
    """
    assert extract_tables_from_sql("SHOW COLUMNS FROM t1") == {Table("t1")}


def test_extract_tables_where_subquery() -> None:
    """
    Test that tables in a `WHERE` subquery are parsed correctly.
    """
    assert extract_tables_from_sql(
        """
SELECT name
FROM t1
WHERE regionkey = (SELECT max(regionkey) FROM t2)
"""
    ) == {Table("t1"), Table("t2")}

    assert extract_tables_from_sql(
        """
SELECT name
FROM t1
WHERE regionkey IN (SELECT regionkey FROM t2)
"""
    ) == {Table("t1"), Table("t2")}

    assert extract_tables_from_sql(
        """
SELECT name
FROM t1
WHERE EXISTS (SELECT 1 FROM t2 WHERE t1.regionkey = t2.regionkey);
"""
    ) == {Table("t1"), Table("t2")}


def test_extract_tables_describe() -> None:
    """
    Test `DESCRIBE`.
    """
    assert extract_tables_from_sql("DESCRIBE t1") == {Table("t1")}


def test_extract_tables_show_partitions() -> None:
    """
    Test `SHOW PARTITIONS`.
    """
    assert extract_tables_from_sql(
        """
SHOW PARTITIONS FROM orders
WHERE ds >= '2013-01-01' ORDER BY ds DESC
"""
    ) == {Table("orders")}


def test_extract_tables_join() -> None:
    """
    Test joins.
    """
    assert extract_tables_from_sql(
        "SELECT t1.*, t2.* FROM t1 JOIN t2 ON t1.a = t2.a;"
    ) == {
        Table("t1"),
        Table("t2"),
    }

    assert extract_tables_from_sql(
        """
SELECT a.date, b.name
FROM left_table a
JOIN (
    SELECT
        CAST((b.year) as VARCHAR) date,
        name
    FROM right_table
) b
ON a.date = b.date
"""
    ) == {Table("left_table"), Table("right_table")}

    assert extract_tables_from_sql(
        """
SELECT a.date, b.name
FROM left_table a
LEFT INNER JOIN (
    SELECT
        CAST((b.year) as VARCHAR) date,
        name
    FROM right_table
) b
ON a.date = b.date
"""
    ) == {Table("left_table"), Table("right_table")}

    assert extract_tables_from_sql(
        """
SELECT a.date, b.name
FROM left_table a
RIGHT OUTER JOIN (
    SELECT
        CAST((b.year) as VARCHAR) date,
        name
    FROM right_table
) b
ON a.date = b.date
"""
    ) == {Table("left_table"), Table("right_table")}

    assert extract_tables_from_sql(
        """
SELECT a.date, b.name
FROM left_table a
FULL OUTER JOIN (
    SELECT
        CAST((b.year) as VARCHAR) date,
        name
        FROM right_table
) b
ON a.date = b.date
"""
    ) == {Table("left_table"), Table("right_table")}


def test_extract_tables_semi_join() -> None:
    """
    Test `LEFT SEMI JOIN`.
    """
    assert extract_tables_from_sql(
        """
SELECT a.date, b.name
FROM left_table a
LEFT SEMI JOIN (
    SELECT
        CAST((b.year) as VARCHAR) date,
        name
    FROM right_table
) b
ON a.data = b.date
"""
    ) == {Table("left_table"), Table("right_table")}


def test_extract_tables_combinations() -> None:
    """
    Test a complex case with nested queries.
    """
    assert extract_tables_from_sql(
        """
SELECT * FROM t1
WHERE s11 > ANY (
    SELECT * FROM t1 UNION ALL SELECT * FROM (
        SELECT t6.*, t3.* FROM t6 JOIN t3 ON t6.a = t3.a
    ) tmp_join
    WHERE NOT EXISTS (
        SELECT * FROM t3
        WHERE ROW(5*t3.s1,77)=(
            SELECT 50,11*s1 FROM t4
        )
    )
)
"""
    ) == {Table("t1"), Table("t3"), Table("t4"), Table("t6")}

    assert extract_tables_from_sql(
        """
SELECT * FROM (
    SELECT * FROM (
        SELECT * FROM (
            SELECT * FROM EmployeeS
        ) AS S1
    ) AS S2
) AS S3
"""
    ) == {Table("EmployeeS")}


def test_extract_tables_with() -> None:
    """
    Test `WITH`.
    """
    assert extract_tables_from_sql(
        """
WITH
    x AS (SELECT a FROM t1),
    y AS (SELECT a AS b FROM t2),
    z AS (SELECT b AS c FROM t3)
SELECT c FROM z
"""
    ) == {Table("t1"), Table("t2"), Table("t3")}

    assert extract_tables_from_sql(
        """
WITH
    x AS (SELECT a FROM t1),
    y AS (SELECT a AS b FROM x),
    z AS (SELECT b AS c FROM y)
SELECT c FROM z
"""
    ) == {Table("t1")}


def test_extract_tables_reusing_aliases() -> None:
    """
    Test that the parser follows aliases.
    """
    assert extract_tables_from_sql(
        """
with q1 as ( select key from q2 where key = '5'),
q2 as ( select key from src where key = '5')
select * from (select key from q1) a
"""
    ) == {Table("src")}

    # weird query with circular dependency
    assert (
        extract_tables_from_sql(
            """
with src as ( select key from q2 where key = '5'),
q2 as ( select key from src where key = '5')
select * from (select key from src) a
"""
        )
        == set()
    )


def test_extract_tables_multistatement() -> None:
    """
    Test that the parser works with multiple statements.
    """
    assert extract_tables_from_sql("SELECT * FROM t1; SELECT * FROM t2") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables_from_sql("SELECT * FROM t1; SELECT * FROM t2;") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables_from_sql(
        "ADD JAR file:///hive.jar; SELECT * FROM t1;",
        engine="hive",
    ) == {Table("t1")}


def test_extract_tables_complex() -> None:
    """
    Test a few complex queries.
    """
    assert extract_tables_from_sql(
        """
SELECT sum(m_examples) AS "sum__m_example"
FROM (
    SELECT
        COUNT(DISTINCT id_userid) AS m_examples,
        some_more_info
    FROM my_b_table b
    JOIN my_t_table t ON b.ds=t.ds
    JOIN my_l_table l ON b.uid=l.uid
    WHERE
        b.rid IN (
            SELECT other_col
            FROM inner_table
        )
        AND l.bla IN ('x', 'y')
    GROUP BY 2
    ORDER BY 2 ASC
) AS "meh"
ORDER BY "sum__m_example" DESC
LIMIT 10;
"""
    ) == {
        Table("my_l_table"),
        Table("my_b_table"),
        Table("my_t_table"),
        Table("inner_table"),
    }

    assert extract_tables_from_sql(
        """
SELECT *
FROM table_a AS a, table_b AS b, table_c as c
WHERE a.id = b.id and b.id = c.id
"""
    ) == {Table("table_a"), Table("table_b"), Table("table_c")}

    assert extract_tables_from_sql(
        """
SELECT somecol AS somecol
FROM (
    WITH bla AS (
        SELECT col_a
        FROM a
        WHERE
            1=1
            AND column_of_choice NOT IN (
                SELECT interesting_col
                FROM b
            )
    ),
    rb AS (
        SELECT yet_another_column
        FROM (
            SELECT a
            FROM c
            GROUP BY the_other_col
        ) not_table
        LEFT JOIN bla foo
        ON foo.prop = not_table.bad_col0
        WHERE 1=1
        GROUP BY
            not_table.bad_col1 ,
            not_table.bad_col2 ,
        ORDER BY not_table.bad_col_3 DESC ,
            not_table.bad_col4 ,
            not_table.bad_col5
    )
    SELECT random_col
    FROM d
    WHERE 1=1
    UNION ALL SELECT even_more_cols
    FROM e
    WHERE 1=1
    UNION ALL SELECT lets_go_deeper
    FROM f
    WHERE 1=1
    WHERE 2=2
    GROUP BY last_col
    LIMIT 50000
)
"""
    ) == {Table("a"), Table("b"), Table("c"), Table("d"), Table("e"), Table("f")}


def test_extract_tables_mixed_from_clause() -> None:
    """
    Test that the parser handles a `FROM` clause with table and subselect.
    """
    assert extract_tables_from_sql(
        """
SELECT *
FROM table_a AS a, (select * from table_b) AS b, table_c as c
WHERE a.id = b.id and b.id = c.id
"""
    ) == {Table("table_a"), Table("table_b"), Table("table_c")}


def test_extract_tables_nested_select() -> None:
    """
    Test that the parser handles selects inside functions.
    """
    assert extract_tables_from_sql(
        """
select (extractvalue(1,concat(0x7e,(select GROUP_CONCAT(TABLE_NAME)
from INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA like "%bi%"),0x7e)));
""",
        "mysql",
    ) == {Table("COLUMNS", "INFORMATION_SCHEMA")}

    assert extract_tables_from_sql(
        """
select (extractvalue(1,concat(0x7e,(select GROUP_CONCAT(COLUMN_NAME)
from INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME="bi_achievement_daily"),0x7e)));
""",
        "mysql",
    ) == {Table("COLUMNS", "INFORMATION_SCHEMA")}


def test_extract_tables_complex_cte_with_prefix() -> None:
    """
    Test that the parser handles CTEs with prefixes.
    """
    assert extract_tables_from_sql(
        """
WITH CTE__test (SalesPersonID, SalesOrderID, SalesYear)
AS (
    SELECT SalesPersonID, SalesOrderID, YEAR(OrderDate) AS SalesYear
    FROM SalesOrderHeader
    WHERE SalesPersonID IS NOT NULL
)
SELECT SalesPersonID, COUNT(SalesOrderID) AS TotalSales, SalesYear
FROM CTE__test
GROUP BY SalesYear, SalesPersonID
ORDER BY SalesPersonID, SalesYear;
"""
    ) == {Table("SalesOrderHeader")}


def test_extract_tables_identifier_list_with_keyword_as_alias() -> None:
    """
    Test that aliases that are keywords are parsed correctly.
    """
    assert extract_tables_from_sql(
        """
WITH
    f AS (SELECT * FROM foo),
    match AS (SELECT * FROM f)
SELECT * FROM match
"""
    ) == {Table("foo")}


def test_sqlscript() -> None:
    """
    Test the `SQLScript` class.
    """
    script = SQLScript("SELECT 1; SELECT 2;", "sqlite")

    assert len(script.statements) == 2
    assert script.format() == "SELECT\n  1;\nSELECT\n  2"
    assert script.statements[0].format() == "SELECT\n  1"

    script = SQLScript("SET a=1; SET a=2; SELECT 3;", "sqlite")
    assert script.get_settings() == {"a": "2"}

    query = SQLScript(
        """set querytrace;
Events | take 100""",
        "kustokql",
    )
    assert query.get_settings() == {"querytrace": True}


def test_sqlstatement() -> None:
    """
    Test the `SQLStatement` class.
    """
    statement = SQLStatement(
        "SELECT * FROM table1 UNION ALL SELECT * FROM table2",
        "sqlite",
    )

    assert statement.tables == {
        Table(table="table1", schema=None, catalog=None),
        Table(table="table2", schema=None, catalog=None),
    }
    assert (
        statement.format()
        == "SELECT\n  *\nFROM table1\nUNION ALL\nSELECT\n  *\nFROM table2"
    )

    statement = SQLStatement("SET a=1", "sqlite")
    assert statement.get_settings() == {"a": "1"}


def test_kustokqlstatement_split_script() -> None:
    """
    Test the `KustoKQLStatement` split method.
    """
    statements = KustoKQLStatement.split_script(
        """
let totalPagesPerDay = PageViews
| summarize by Page, Day = startofday(Timestamp)
| summarize count() by Day;
let materializedScope = PageViews
| summarize by Page, Day = startofday(Timestamp);
let cachedResult = materialize(materializedScope);
cachedResult
| project Page, Day1 = Day
| join kind = inner
(
    cachedResult
    | project Page, Day2 = Day
)
on Page
| where Day2 > Day1
| summarize count() by Day1, Day2
| join kind = inner
    totalPagesPerDay
on $left.Day1 == $right.Day
| project Day1, Day2, Percentage = count_*100.0/count_1
        """,
        "kustokql",
    )
    assert len(statements) == 4


def test_kustokqlstatement_with_program() -> None:
    """
    Test the `KustoKQLStatement` split method when the KQL has a program.
    """
    statements = KustoKQLStatement.split_script(
        """
print program = ```
  public class Program {
    public static void Main() {
      System.Console.WriteLine("Hello!");
    }
  }```
        """,
        "kustokql",
    )
    assert len(statements) == 1


def test_kustokqlstatement_with_set() -> None:
    """
    Test the `KustoKQLStatement` split method when the KQL has a set command.
    """
    statements = KustoKQLStatement.split_script(
        """
set querytrace;
Events | take 100
        """,
        "kustokql",
    )
    assert len(statements) == 2
    assert statements[0].format() == "set querytrace"
    assert statements[1].format() == "Events | take 100"


@pytest.mark.parametrize(
    "kql,statements",
    [
        ('print banner=strcat("Hello", ", ", "World!")', 1),
        (r"print 'O\'Malley\'s'", 1),
        (r"print 'O\'Mal;ley\'s'", 1),
        ("print ```foo;\nbar;\nbaz;```\n", 1),
    ],
)
def test_kustokql_statement_split_special(kql: str, statements: int) -> None:
    assert len(KustoKQLStatement.split_script(kql, "kustokql")) == statements


def test_split_kql() -> None:
    """
    Test the `split_kql` function.
    """
    kql = """
let totalPagesPerDay = PageViews
| summarize by Page, Day = startofday(Timestamp)
| summarize count() by Day;
let materializedScope = PageViews
| summarize by Page, Day = startofday(Timestamp);
let cachedResult = materialize(materializedScope);
cachedResult
| project Page, Day1 = Day
| join kind = inner
(
    cachedResult
    | project Page, Day2 = Day
)
on Page
| where Day2 > Day1
| summarize count() by Day1, Day2
| join kind = inner
    totalPagesPerDay
on $left.Day1 == $right.Day
| project Day1, Day2, Percentage = count_*100.0/count_1
    """
    assert split_kql(kql) == [
        """
let totalPagesPerDay = PageViews
| summarize by Page, Day = startofday(Timestamp)
| summarize count() by Day""",
        """
let materializedScope = PageViews
| summarize by Page, Day = startofday(Timestamp)""",
        """
let cachedResult = materialize(materializedScope)""",
        """
cachedResult
| project Page, Day1 = Day
| join kind = inner
(
    cachedResult
    | project Page, Day2 = Day
)
on Page
| where Day2 > Day1
| summarize count() by Day1, Day2
| join kind = inner
    totalPagesPerDay
on $left.Day1 == $right.Day
| project Day1, Day2, Percentage = count_*100.0/count_1
    """,
    ]


@pytest.mark.parametrize(
    ("engine", "sql", "expected"),
    [
        # SQLite tests
        ("sqlite", "SELECT 1", False),
        ("sqlite", "INSERT INTO foo VALUES (1)", True),
        ("sqlite", "UPDATE foo SET bar = 2 WHERE id = 1", True),
        ("sqlite", "DELETE FROM foo WHERE id = 1", True),
        ("sqlite", "CREATE TABLE foo (id INT, bar TEXT)", True),
        ("sqlite", "DROP TABLE foo", True),
        ("sqlite", "EXPLAIN SELECT * FROM foo", False),
        ("sqlite", "PRAGMA table_info(foo)", False),
        ("postgresql", "SELECT 1", False),
        ("postgresql", "INSERT INTO foo (id, bar) VALUES (1, 'test')", True),
        ("postgresql", "UPDATE foo SET bar = 'new' WHERE id = 1", True),
        ("postgresql", "DELETE FROM foo WHERE id = 1", True),
        ("postgresql", "CREATE TABLE foo (id SERIAL PRIMARY KEY, bar TEXT)", True),
        ("postgresql", "DROP TABLE foo", True),
        ("postgresql", "EXPLAIN ANALYZE SELECT * FROM foo", False),
        ("postgresql", "EXPLAIN ANALYZE DELETE FROM foo", True),
        ("postgresql", "SHOW search_path", False),
        ("postgresql", "SET search_path TO public", False),
        (
            "postgres",
            """
            with source as (
                select 1 as one
            )
            select * from source
            """,
            False,
        ),
        ("trino", "SELECT 1", False),
        ("trino", "INSERT INTO foo VALUES (1, 'bar')", True),
        ("trino", "UPDATE foo SET bar = 'baz' WHERE id = 1", True),
        ("trino", "DELETE FROM foo WHERE id = 1", True),
        ("trino", "CREATE TABLE foo (id INT, bar VARCHAR)", True),
        ("trino", "DROP TABLE foo", True),
        ("trino", "EXPLAIN SELECT * FROM foo", False),
        ("trino", "SHOW SCHEMAS", False),
        ("trino", "SET SESSION optimization_level = '3'", False),
        ("kustokql", "tbl | limit 100", False),
        ("kustokql", "let foo = 1; tbl | where bar == foo", False),
        ("kustokql", ".show tables", False),
        ("kustokql", "print 1", False),
        ("kustokql", "set querytrace; Events | take 100", False),
        ("kustokql", ".drop table foo", True),
        ("kustokql", ".set-or-append table foo <| bar", True),
    ],
)
def test_has_mutation(engine: str, sql: str, expected: bool) -> None:
    """
    Test the `has_mutation` method.
    """
    assert SQLScript(sql, engine).has_mutation() == expected


def test_get_settings() -> None:
    """
    Test `get_settings` in some edge cases.
    """
    sql = """
set
-- this is a tricky comment
search_path -- another one
= bar;
SELECT * FROM some_table;
    """
    assert SQLScript(sql, "postgresql").get_settings() == {"search_path": "bar"}


@pytest.mark.parametrize(
    "app",
    [{"SQLGLOT_DIALECTS_EXTENSIONS": {"custom": Dialects.MYSQL}}],
    indirect=True,
)
def test_custom_dialect(app: None) -> None:
    """
    Test that custom dialects are loaded correctly.
    """
    assert SQLGLOT_DIALECTS.get("custom") == Dialects.MYSQL
