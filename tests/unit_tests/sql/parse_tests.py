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


from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlglot import Dialects, exp, parse_one

from superset.exceptions import QueryClauseValidationException, SupersetParseError
from superset.jinja_context import JinjaTemplateProcessor
from superset.sql.parse import (
    apply_cls,
    CLS_ACTION_PRECEDENCE,
    CLS_HASH_FUNCTIONS,
    CLSAction,
    CLSTransformer,
    CTASMethod,
    extract_tables_from_statement,
    JinjaSQLResult,
    KQLTokenType,
    KustoKQLStatement,
    LimitMethod,
    merge_cls_rules,
    process_jinja_sql,
    remove_quotes,
    RLSMethod,
    sanitize_clause,
    split_kql,
    SQLGLOT_DIALECTS,
    SQLScript,
    SQLStatement,
    Table,
    tokenize_kql,
)
from tests.integration_tests.conftest import with_feature_flags


def test_table() -> None:
    """
    Test the `Table` class and its string conversion.

    Special characters in the table, schema, or catalog name should be escaped correctly.
    """  # noqa: E501
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


def test_table_qualify() -> None:
    """
    Test the `Table.qualify` method.

    The qualify method should add schema and/or catalog if not already set,
    but should not override existing values.
    """
    # Table with no schema or catalog
    table = Table("tbname")

    # Add schema only
    qualified = table.qualify(schema="schemaname")
    assert qualified.table == "tbname"
    assert qualified.schema == "schemaname"
    assert qualified.catalog is None
    assert str(qualified) == "schemaname.tbname"

    # Add catalog only
    qualified = table.qualify(catalog="catalogname")
    assert qualified.table == "tbname"
    assert qualified.schema is None
    assert qualified.catalog == "catalogname"
    assert str(qualified) == "catalogname.tbname"

    # Add both schema and catalog
    qualified = table.qualify(schema="schemaname", catalog="catalogname")
    assert qualified.table == "tbname"
    assert qualified.schema == "schemaname"
    assert qualified.catalog == "catalogname"
    assert str(qualified) == "catalogname.schemaname.tbname"

    # Table with existing schema - should not override
    table_with_schema = Table("tbname", "existingschema")
    qualified = table_with_schema.qualify(schema="newschema")
    assert qualified.schema == "existingschema"
    assert str(qualified) == "existingschema.tbname"

    # Table with existing catalog - should not override
    table_with_catalog = Table("tbname", catalog="existingcatalog")
    qualified = table_with_catalog.qualify(catalog="newcatalog")
    assert qualified.catalog == "existingcatalog"
    assert str(qualified) == "existingcatalog.tbname"

    # Table with existing schema and catalog - should not override
    fully_qualified = Table("tbname", "existingschema", "existingcatalog")
    qualified = fully_qualified.qualify(schema="newschema", catalog="newcatalog")
    assert qualified.schema == "existingschema"
    assert qualified.catalog == "existingcatalog"
    assert str(qualified) == "existingcatalog.existingschema.tbname"

    # Table with schema but no catalog - should add catalog only
    table_with_schema_only = Table("tbname", "existingschema")
    qualified = table_with_schema_only.qualify(
        schema="newschema", catalog="catalogname"
    )
    assert qualified.schema == "existingschema"
    assert qualified.catalog == "catalogname"
    assert str(qualified) == "catalogname.existingschema.tbname"

    # Table with catalog but no schema - should add schema only
    table_with_catalog_only = Table("tbname", catalog="existingcatalog")
    qualified = table_with_catalog_only.qualify(
        schema="schemaname", catalog="newcatalog"
    )
    assert qualified.schema == "schemaname"
    assert qualified.catalog == "existingcatalog"
    assert str(qualified) == "existingcatalog.schemaname.tbname"

    # Calling qualify with no arguments should return equivalent table
    qualified = table.qualify()
    assert qualified.table == table.table
    assert qualified.schema == table.schema
    assert qualified.catalog == table.catalog


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
        SQLScript("SELECT col FROM t WHERE col NOT IN (1, 2)", "dremio").format()
        == """
SELECT
  col
FROM t
WHERE
  NOT col IN (1, 2)
        """.strip()
    )


def test_split_no_dialect() -> None:
    """
    Test the statement split when the engine has no corresponding dialect.
    """
    sql = "SELECT col FROM t WHERE col NOT IN (1, 2); SELECT * FROM t; SELECT foo"
    statements = SQLScript(sql, "dremio").statements
    assert len(statements) == 3
    assert statements[0].format() == "SELECT\n  col\nFROM t\nWHERE\n  NOT col IN (1, 2)"
    assert statements[1].format() == "SELECT\n  *\nFROM t"
    assert statements[2].format() == "SELECT\n  foo"


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


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        (
            " SELECT foo FROM tbl ; ",
            "postgresql",
            ["SELECT\n  foo\nFROM tbl"],
        ),
        (
            "SELECT foo FROM tbl1; SELECT bar FROM tbl2;",
            "postgresql",
            ["SELECT\n  foo\nFROM tbl1", "SELECT\n  bar\nFROM tbl2"],
        ),
        (
            "let foo = 1; tbl | where bar == foo",
            "kustokql",
            ["let foo = 1", "tbl | where bar == foo"],
        ),
        (
            "SELECT 1; -- extraneous comment",
            "postgresql",
            ["SELECT\n  1 /* extraneous comment */"],
        ),
        (
            "SHOW TABLES FROM s1 like '%order%';",
            "mysql",
            ["SHOW TABLES FROM s1 LIKE '%order%'"],
        ),
        (
            "SELECT 1; SELECT 2; SELECT 3;",
            "unknown-engine",
            [
                "SELECT\n  1",
                "SELECT\n  2",
                "SELECT\n  3",
            ],
        ),
    ],
)
def test_sqlscript_split(sql: str, engine: str, expected: list[str]) -> None:
    """
    Test the `SQLScript` class with a script that has a single statement.
    """
    script = SQLScript(sql, engine)
    assert [statement.format() for statement in script.statements] == expected


def test_sqlstatement() -> None:
    """
    Test the `SQLStatement` class.
    """
    statement = SQLStatement(
        "SELECT * FROM table1 UNION ALL SELECT * FROM table2",
        "sqlite",
    )

    assert (
        statement.format()
        == "SELECT\n  *\nFROM table1\nUNION ALL\nSELECT\n  *\nFROM table2"
    )
    assert str(statement) == statement.format()

    assert statement.tables == {
        Table(table="table1", schema=None, catalog=None),
        Table(table="table2", schema=None, catalog=None),
    }

    assert statement.parse_predicate("a > 1") == exp.GT(
        this=exp.Column(this=exp.Identifier(this="a", quoted=False)),
        expression=exp.Literal(this="1", is_string=False),
    )

    statement = SQLStatement("SET a=1", "sqlite")
    assert statement.get_settings() == {"a": "1"}

    with pytest.raises(
        ValueError,
        match="Either statement or ast must be provided",
    ):
        SQLStatement()


def test_kustokqlstatement() -> None:
    """
    Test the `KustoKQLStatement` class.
    """
    statement = KustoKQLStatement("foo | take 100", "kustokql")

    assert statement.format() == "foo | take 100"
    assert str(statement) == statement.format()

    # doesn't support table extraction
    assert statement.tables == set()

    # optimize is a no-op
    assert statement.optimize().format() == "foo | take 100"

    # predicate parsing is also no-op
    assert statement.parse_predicate("a > 1") == "a > 1"

    with pytest.raises(SupersetParseError, match="Invalid engine: invalid-engine"):
        KustoKQLStatement("foo | take 100", "invalid-engine")

    with pytest.raises(
        SupersetParseError,
        match="KustoKQLStatement should have exactly one statement",
    ):
        KustoKQLStatement("foo | take 1; bar | take 2", "kustokql")


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


@pytest.mark.parametrize(
    "kql, expected",
    [
        (";Table | take 5", ["Table | take 5"]),
        (";Table | take 5;", ["Table | take 5"]),
        (
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
            [
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
            ],
        ),
    ],
)
def test_split_kql(kql: str, expected: list[str]) -> None:
    """
    Test the `split_kql` function.
    """
    assert split_kql(kql) == expected


@pytest.mark.parametrize(
    ("engine", "sql", "expected"),
    [
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
        ("base", "SHOW LOCKS test EXTENDED", False),
        ("base", "SET hivevar:desc='Legislators'", False),
        ("base", "UPDATE t1 SET col1 = NULL", True),
        ("base", "EXPLAIN SELECT 1", False),
        ("base", "SELECT 1", False),
        ("base", "WITH bla AS (SELECT 1) SELECT * FROM bla", False),
        ("base", "SHOW CATALOGS", False),
        ("base", "SHOW TABLES", False),
        ("hive", "UPDATE t1 SET col1 = NULL", True),
        ("hive", "INSERT OVERWRITE TABLE tabB SELECT a.Age FROM TableA", True),
        ("hive", "SHOW LOCKS test EXTENDED", False),
        ("hive", "SET hivevar:desc='Legislators'", False),
        ("hive", "EXPLAIN SELECT 1", False),
        ("hive", "SELECT 1", False),
        ("hive", "WITH bla AS (SELECT 1) SELECT * FROM bla", False),
        ("presto", "SET hivevar:desc='Legislators'", False),
        ("presto", "UPDATE t1 SET col1 = NULL", True),
        ("presto", "INSERT OVERWRITE TABLE tabB SELECT a.Age FROM TableA", True),
        ("presto", "SHOW LOCKS test EXTENDED", False),
        ("presto", "EXPLAIN SELECT 1", False),
        ("presto", "SELECT 1", False),
        ("presto", "WITH bla AS (SELECT 1) SELECT * FROM bla", False),
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


@pytest.mark.parametrize(
    "engine",
    [
        "ascend",
        "awsathena",
        "base",
        "bigquery",
        "clickhouse",
        "clickhousedb",
        "cockroachdb",
        "couchbase",
        "crate",
        "databend",
        "databricks",
        "db2",
        "denodo",
        "dremio",
        "drill",
        "druid",
        "duckdb",
        "dynamodb",
        "elasticsearch",
        "exa",
        "firebird",
        "firebolt",
        "gsheets",
        "hana",
        "hive",
        "ibmi",
        "impala",
        "kustokql",
        "kustosql",
        "kylin",
        "mariadb",
        "motherduck",
        "mssql",
        "mysql",
        "netezza",
        "oceanbase",
        "ocient",
        "odelasticsearch",
        "oracle",
        "pinot",
        "postgresql",
        "presto",
        "pydoris",
        "redshift",
        "risingwave",
        "shillelagh",
        "snowflake",
        "solr",
        "sqlite",
        "starrocks",
        "superset",
        "teradatasql",
        "trino",
        "vertica",
    ],
)
@pytest.mark.parametrize(
    "sql, expected",
    [
        ("SELECT 1", False),
        ("with source as ( select 1 as one ) select * from source", False),
        ("ALTER TABLE foo ADD COLUMN bar INT", True),
    ],
)
def test_is_mutating(sql: str, engine: str, expected: bool) -> None:
    """
    Global tests for `is_mutating`, covering all supported engines.
    """
    assert SQLStatement(sql, engine).is_mutating() == expected


@pytest.mark.parametrize(
    "sql, expected",
    [
        (
            """
DO $$
BEGIN
  INSERT INTO public.users (name, real_name)
    VALUES ('SQLLab bypass DML', 'SQLLab bypass DML');
END;
$$;
            """,
            True,
        ),
        (
            """
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM orders WHERE status = 'pending') > 100 THEN
        RAISE NOTICE 'High pending order volume detected';
    END IF;
END;
$$;
            """,
            True,
        ),
    ],
)
def test_is_mutating_anonymous_block(sql: str, expected: bool) -> None:
    """
    Test for `is_mutating` with a Postgres anonymous block.

    Since we can't parse the PL/pgSQL inside the block we always assume it is mutating.
    """
    assert SQLStatement(sql, "postgresql").is_mutating() == expected


def test_optimize() -> None:
    """
    Test that the `optimize` method works as expected.

    The SQL optimization only works with engines that have a corresponding dialect.
    """
    sql = """
SELECT anon_1.a, anon_1.b
FROM (SELECT some_table.a AS a, some_table.b AS b, some_table.c AS c
FROM some_table) AS anon_1
WHERE anon_1.a > 1 AND anon_1.b = 2
    """

    optimized = """
SELECT
  anon_1.a,
  anon_1.b
FROM (
  SELECT
    some_table.a AS a,
    some_table.b AS b,
    some_table.c AS c
  FROM some_table
  WHERE
    some_table.a > 1 AND some_table.b = 2
) AS anon_1
WHERE
  TRUE AND TRUE
    """.strip()

    not_optimized = """
SELECT
  anon_1.a,
  anon_1.b
FROM (
  SELECT
    some_table.a AS a,
    some_table.b AS b,
    some_table.c AS c
  FROM some_table
) AS anon_1
WHERE
  anon_1.a > 1 AND anon_1.b = 2
    """.strip()

    assert SQLStatement(sql, "sqlite").optimize().format() == optimized
    assert SQLStatement(sql, "crate").optimize().format() == not_optimized

    # also works for scripts
    assert SQLScript(sql, "sqlite").optimize().format() == optimized


def test_firebolt() -> None:
    """
    Test that Firebolt 3rd party dialect is registered correctly.

    We need a custom dialect for Firebolt because it parses `NOT col IN (1, 2)` as
    `(NOT col) IN (1, 2)` instead of `NOT (col IN (1, 2))`, which will fail when `col`
    is not a boolean.

    Note that `NOT col = 1` works as expected in Firebolt, parsing as `NOT (col = 1)`.
    """
    sql = "SELECT col NOT IN (1, 2) FROM tbl"
    assert (
        SQLStatement(sql, "firebolt").format()
        == """
SELECT
  NOT (
    col IN (1, 2)
  )
FROM tbl
    """.strip()
    )

    sql = "SELECT NOT col = 1 FROM tbl"
    assert (
        SQLStatement(sql, "firebolt").format()
        == """
SELECT
  NOT col = 1
FROM tbl
    """.strip()
    )


def test_firebolt_old() -> None:
    """
    Test the dialect for the old Firebolt syntax.
    """
    from superset.sql.dialects import FireboltOld
    from superset.sql.parse import SQLGLOT_DIALECTS

    SQLGLOT_DIALECTS["firebolt"] = FireboltOld

    sql = "SELECT * FROM t1 UNNEST(col1 AS foo)"
    assert (
        SQLStatement(sql, "firebolt").format()
        == """
SELECT
  *
FROM t1 UNNEST(col1 AS foo)
        """.strip()
    )


def test_firebolt_old_escape_string() -> None:
    """
    Test the dialect for the old Firebolt syntax.
    """
    from superset.sql.dialects import FireboltOld
    from superset.sql.parse import SQLGLOT_DIALECTS

    SQLGLOT_DIALECTS["firebolt"] = FireboltOld

    # both '' and \' are valid escape sequences
    sql = r"SELECT 'foo''bar', 'foo\'bar'"

    # but they normalize to ''
    assert (
        SQLStatement(sql, "firebolt").format()
        == """
SELECT
  'foo''bar',
  'foo''bar'
        """.strip()
    )


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("SELECT * FROM users LIMIT 10", "postgresql", 10),
        (
            """
WITH cte_example AS (
  SELECT * FROM my_table
  LIMIT 100
)
SELECT * FROM cte_example
LIMIT 10;
        """,
            "postgresql",
            10,
        ),
        ("SELECT * FROM users ORDER BY id DESC LIMIT 25", "postgresql", 25),
        ("SELECT * FROM users", "postgresql", None),
        ("SELECT TOP 5 name FROM employees", "teradatasql", 5),
        ("SELECT TOP (42) * FROM table_name", "teradatasql", 42),
        ("select * from table", "postgresql", None),
        ("select * from mytable limit 10", "postgresql", 10),
        (
            "select * from (select * from my_subquery limit 10) where col=1 limit 20",
            "postgresql",
            20,
        ),
        ("select * from (select * from my_subquery limit 10);", "postgresql", None),
        (
            "select * from (select * from my_subquery limit 10) where col=1 limit 20;",
            "postgresql",
            20,
        ),
        ("select * from mytable limit 20, 10", "postgresql", 10),
        ("select * from mytable limit 10 offset 20", "postgresql", 10),
        (
            """
SELECT id, value, i
FROM (SELECT * FROM my_table LIMIT 10),
LATERAL generate_series(1, value) AS i;
        """,
            "postgresql",
            None,
        ),
        # not really valid SQL, but let's roll with it
        ("SELECT * FROM my_table LIMIT invalid", "postgresql", None),
    ],
)
def test_get_limit_value(sql: str, engine: str, expected: str) -> None:
    assert SQLStatement(sql, engine).get_limit_value() == expected


@pytest.mark.parametrize(
    "kql, expected",
    [
        ("StormEvents | take 10", 10),
        ("StormEvents | limit 20", 20),
        ("StormEvents | where State == 'FL' | summarize count()", None),
        ("StormEvents | where name has 'limit 10'", None),
        ("AnotherTable | take 5", 5),
        ("datatable(x:int) [1, 2, 3] | take 100", 100),
        (
            """
    Table1 | where msg contains 'abc;xyz'
           | limit 5
    """,
            5,
        ),
        ("table | take five", None),
    ],
)
def test_get_kql_limit_value(kql: str, expected: str) -> None:
    assert KustoKQLStatement(kql, "kustokql").get_limit_value() == expected


@pytest.mark.parametrize(
    "sql, engine, limit, method, expected",
    [
        (
            "SELECT * FROM t",
            "postgresql",
            10,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM t\nLIMIT 10",
        ),
        (
            "SELECT * FROM t LIMIT 1000",
            "postgresql",
            10,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM t\nLIMIT 10",
        ),
        (
            "SELECT * FROM t",
            "mssql",
            10,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 10\n  *\nFROM t",
        ),
        (
            "SELECT * FROM t",
            "teradatasql",
            10,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 10\n  *\nFROM t",
        ),
        (
            "SELECT * FROM t",
            "oracle",
            10,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM t\nFETCH FIRST 10 ROWS ONLY",
        ),
        (
            "SELECT * FROM t",
            "db2",
            10,
            LimitMethod.WRAP_SQL,
            "SELECT\n  *\nFROM (\n  SELECT\n    *\n  FROM t\n)\nLIMIT 10",
        ),
        (
            "SEL TOP 1000 * FROM My_table",
            "teradatasql",
            100,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 100\n  *\nFROM My_table",
        ),
        (
            "SEL TOP 1000 * FROM My_table;",
            "teradatasql",
            100,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 100\n  *\nFROM My_table",
        ),
        (
            "SEL TOP 1000 * FROM My_table;",
            "teradatasql",
            1000,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 1000\n  *\nFROM My_table",
        ),
        (
            "SELECT TOP 1000 * FROM My_table;",
            "teradatasql",
            100,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 100\n  *\nFROM My_table",
        ),
        (
            "SELECT TOP 1000 * FROM My_table;",
            "teradatasql",
            10000,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 10000\n  *\nFROM My_table",
        ),
        (
            "SELECT TOP 1000 * FROM My_table",
            "mssql",
            100,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 100\n  *\nFROM My_table",
        ),
        (
            "SELECT TOP 1000 * FROM My_table;",
            "mssql",
            100,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 100\n  *\nFROM My_table",
        ),
        (
            "SELECT TOP 1000 * FROM My_table;",
            "mssql",
            10000,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 10000\n  *\nFROM My_table",
        ),
        (
            "SELECT TOP 1000 * FROM My_table;",
            "mssql",
            1000,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 1000\n  *\nFROM My_table",
        ),
        (
            """
with abc as (select * from test union select * from test1)
select TOP 100 * from currency
            """,
            "mssql",
            1000,
            LimitMethod.FORCE_LIMIT,
            """
WITH abc AS (
  SELECT
    *
  FROM test
  UNION
  SELECT
    *
  FROM test1
)
SELECT
TOP 1000
  *
FROM currency
            """.strip(),
        ),
        (
            "SELECT DISTINCT x from tbl",
            "mssql",
            100,
            LimitMethod.FORCE_LIMIT,
            "SELECT DISTINCT\nTOP 100\n  x\nFROM tbl",
        ),
        (
            "SELECT 1 as cnt",
            "mssql",
            10,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 10\n  1 AS cnt",
        ),
        (
            "select TOP 1000 * from abc where id=1",
            "mssql",
            10,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 10\n  *\nFROM abc\nWHERE\n  id = 1",
        ),
        (
            "SELECT * FROM birth_names -- SOME COMMENT",
            "postgresql",
            1000,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM birth_names /* SOME COMMENT */\nLIMIT 1000",
        ),
        (
            "SELECT * FROM birth_names -- SOME COMMENT WITH LIMIT 555",
            "postgresql",
            1000,
            LimitMethod.FORCE_LIMIT,
            """
SELECT
  *
FROM birth_names /* SOME COMMENT WITH LIMIT 555 */
LIMIT 1000
            """.strip(),
        ),
        (
            "SELECT * FROM birth_names LIMIT 555",
            "postgresql",
            1000,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM birth_names\nLIMIT 1000",
        ),
        (
            "SELECT * FROM birth_names LIMIT 555",
            "postgresql",
            1000,
            LimitMethod.FETCH_MANY,
            "SELECT\n  *\nFROM birth_names\nLIMIT 555",
        ),
    ],
)
def test_set_limit_value(
    sql: str,
    engine: str,
    limit: int,
    method: LimitMethod,
    expected: str,
) -> None:
    statement = SQLStatement(sql, engine)
    statement.set_limit_value(limit, method)
    assert statement.format() == expected


@pytest.mark.parametrize(
    "kql, limit, expected",
    [
        ("StormEvents | take 10", 100, "StormEvents | take 100"),
        ("StormEvents | limit 20", 10, "StormEvents | limit 10"),
        (
            "StormEvents | where State == 'FL' | summarize count()",
            10,
            "StormEvents | where State == 'FL' | summarize count() | take 10",
        ),
        (
            "StormEvents | where name has 'limit 10'",
            10,
            "StormEvents | where name has 'limit 10' | take 10",
        ),
        ("AnotherTable | take 5", 50, "AnotherTable | take 50"),
        (
            "datatable(x:int) [1, 2, 3] | take 100",
            10,
            "datatable(x:int) [1, 2, 3] | take 10",
        ),
        (
            """
    Table1 | where msg contains 'abc;xyz'
           | limit 5
    """,
            10,
            """Table1 | where msg contains 'abc;xyz'
           | limit 10""",
        ),
    ],
)
def test_set_kql_limit_value(kql: str, limit: int, expected: str) -> None:
    """
    Test the `set_limit_value` method for KustoKQLStatement.
    """
    statement = KustoKQLStatement(kql, "kustokql")
    statement.set_limit_value(limit)
    assert statement.format() == expected


@pytest.mark.parametrize("method", [LimitMethod.WRAP_SQL, LimitMethod.FETCH_MANY])
def test_set_kql_limit_value_invalid_method(method: LimitMethod) -> None:
    """
    Test that setting a limit value with an invalid method raises an error.
    """
    statement = KustoKQLStatement("foo", "kustokql")

    with pytest.raises(
        SupersetParseError,
        match="Kusto KQL only supports the FORCE_LIMIT method.",
    ):
        statement.set_limit_value(10, method)


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("SELECT 1", "postgresql", False),
        ("SELECT 1 AS cnt", "postgresql", False),
        (
            """
SELECT 'INR' AS cur
UNION
SELECT 'USD' AS cur
UNION
SELECT 'EUR' AS cur
            """,
            "postgresql",
            False,
        ),
        ("WITH cte AS (SELECT 1) SELECT * FROM cte", "postgresql", True),
        (
            """
WITH
    x AS (SELECT a FROM t1),
    y AS (SELECT a AS b FROM t2),
    z AS (SELECT b AS c FROM t3)
SELECT c FROM z
            """,
            "postgresql",
            True,
        ),
        (
            """
WITH
    x AS (SELECT a FROM t1),
    y AS (SELECT a AS b FROM x),
    z AS (SELECT b AS c FROM y)
SELECT c FROM z
            """,
            "postgresql",
            True,
        ),
        (
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
            """,
            "postgresql",
            True,
        ),
    ],
)
def test_has_cte(sql: str, engine: str, expected: bool) -> None:
    """
    Test that the parser detects CTEs correctly.
    """
    assert SQLStatement(sql, engine).has_cte() == expected


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        (
            "SELECT 1",
            "postgresql",
            "WITH __cte AS (\n  SELECT\n    1\n)",
        ),
        (
            """
WITH currency AS (SELECT 'INR' AS cur),
     currency_2 AS (SELECT 'USD' AS cur)
SELECT * FROM currency
UNION ALL
SELECT * FROM currency_2
            """,
            "postgresql",
            """
WITH currency AS (
  SELECT
    'INR' AS cur
), currency_2 AS (
  SELECT
    'USD' AS cur
), __cte AS (
  SELECT
    *
  FROM currency
  UNION ALL
  SELECT
    *
  FROM currency_2
)
            """.strip(),
        ),
    ],
)
def test_as_cte(sql: str, engine: str, expected: str) -> None:
    """
    Test that we can covert select to CTE.
    """
    assert SQLStatement(sql, engine).as_cte().format() == expected


@pytest.mark.parametrize(
    "sql, rules, expected",
    [
        (
            "SELECT t.foo FROM some_table AS t",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM (
  SELECT
    *
  FROM some_table
  WHERE
    id = 42
) AS t
            """.strip(),
        ),
        (
            "SELECT t.foo FROM some_table AS t",
            {},
            """
SELECT
  t.foo
FROM some_table AS t
            """.strip(),
        ),
        (
            "SELECT t.foo FROM some_table AS t WHERE bar = 'baz'",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM (
  SELECT
    *
  FROM some_table
  WHERE
    id = 42
) AS t
WHERE
  bar = 'baz'
            """.strip(),
        ),
        (
            "SELECT t.foo FROM schema1.some_table AS t",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM (
  SELECT
    *
  FROM schema1.some_table
  WHERE
    id = 42
) AS t
            """.strip(),
        ),
        (
            "SELECT t.foo FROM schema1.some_table AS t",
            {Table("some_table", "schema2"): "id = 42"},
            "SELECT\n  t.foo\nFROM schema1.some_table AS t",
        ),
        (
            "SELECT t.foo FROM catalog1.schema1.some_table AS t",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM (
  SELECT
    *
  FROM catalog1.schema1.some_table
  WHERE
    id = 42
) AS t
            """.strip(),
        ),
        (
            "SELECT t.foo FROM catalog1.schema1.some_table AS t",
            {Table("some_table", "schema1", "catalog2"): "id = 42"},
            "SELECT\n  t.foo\nFROM catalog1.schema1.some_table AS t",
        ),
        (
            "SELECT * FROM some_table WHERE 1=1",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM some_table
  WHERE
    id = 42
) AS "some_table"
WHERE
  1 = 1
            """.strip(),
        ),
        (
            "SELECT * FROM table WHERE 1=1",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM table
  WHERE
    id = 42
) AS "table"
WHERE
  1 = 1
            """.strip(),
        ),
        (
            'SELECT * FROM "table" WHERE 1=1',
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM "table"
  WHERE
    id = 42
) AS "table"
WHERE
  1 = 1
            """.strip(),
        ),
        (
            "SELECT * FROM table WHERE 1=1",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  1 = 1
            """.strip(),
        ),
        (
            "SELECT * FROM other_table WHERE 1=1",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM other_table
WHERE
  1 = 1
            """.strip(),
        ),
        (
            "SELECT * FROM table JOIN other_table ON table.id = other_table.id",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
JOIN (
  SELECT
    *
  FROM other_table
  WHERE
    id = 42
) AS "other_table"
  ON table.id = other_table.id
            """.strip(),
        ),
        (
            'SELECT * FROM "table" JOIN other_table ON "table".id = other_table.id',
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM "table"
  WHERE
    id = 42
) AS "table"
JOIN other_table
  ON "table".id = other_table.id
            """.strip(),
        ),
        (
            "SELECT * FROM (SELECT * FROM some_table)",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM (
    SELECT
      *
    FROM some_table
    WHERE
      id = 42
  ) AS "some_table"
)
            """.strip(),
        ),
        (
            "SELECT * FROM table UNION ALL SELECT * FROM other_table",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM table
  WHERE
    id = 42
) AS "table"
UNION ALL
SELECT
  *
FROM other_table
            """.strip(),
        ),
        (
            "SELECT * FROM table UNION ALL SELECT * FROM other_table",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
UNION ALL
SELECT
  *
FROM (
  SELECT
    *
  FROM other_table
  WHERE
    id = 42
) AS "other_table"
            """.strip(),
        ),
        (
            "SELECT a.*, b.* FROM tbl_a AS a INNER JOIN tbl_b AS b ON a.col = b.col",
            {Table("tbl_a", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  a.*,
  b.*
FROM (
  SELECT
    *
  FROM tbl_a
  WHERE
    id = 42
) AS a
INNER JOIN tbl_b AS b
  ON a.col = b.col
            """.strip(),
        ),
        (
            "SELECT a.*, b.* FROM tbl_a a INNER JOIN tbl_b b ON a.col = b.col",
            {Table("tbl_a", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  a.*,
  b.*
FROM (
  SELECT
    *
  FROM tbl_a
  WHERE
    id = 42
) AS a
INNER JOIN tbl_b AS b
  ON a.col = b.col
            """.strip(),
        ),
        (
            "SELECT * FROM public.flights LIMIT 100",
            {Table("flights", "public", "catalog1"): "\"AIRLINE\" like 'A%'"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM public.flights
  WHERE
    "AIRLINE" LIKE 'A%'
) AS "public.flights"
LIMIT 100
        """.strip(),
        ),
    ],
)
def test_rls_subquery_transformer(
    sql: str,
    rules: dict[Table, str],
    expected: str,
) -> None:
    """
    Test `RLSAsSubqueryTransformer`.
    """
    statement = SQLStatement(sql)
    statement.apply_rls(
        "catalog1",
        "schema1",
        {k: [parse_one(v)] for k, v in rules.items()},
        RLSMethod.AS_SUBQUERY,
    )
    assert statement.format() == expected


def test_rls_invalid_method(mocker: MockerFixture) -> None:
    """
    Test that an invalid RLS method raises an error.
    """
    statement = SQLStatement("SELECT 1", "postgresql")
    predicates = mocker.MagicMock()

    with pytest.raises(ValueError, match="Invalid RLS method: invalid"):
        statement.apply_rls("catalog1", "schema1", predicates, "invalid")  # type: ignore


@pytest.mark.parametrize(
    "sql, rules, expected",
    [
        (
            "SELECT t.foo FROM some_table AS t",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM some_table AS t
WHERE
  t.id = 42
            """.strip(),
        ),
        (
            "SELECT t.foo FROM schema2.some_table AS t",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM schema2.some_table AS t
            """.strip(),
        ),
        (
            "SELECT t.foo FROM catalog2.schema1.some_table AS t",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM catalog2.schema1.some_table AS t
            """.strip(),
        ),
        (
            "SELECT t.foo FROM some_table AS t WHERE bar = 'baz'",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM some_table AS t
WHERE
  t.id = 42 AND (
    bar = 'baz'
  )
            """.strip(),
        ),
        (
            "SELECT t.foo FROM some_table AS t WHERE bar = 'baz' OR foo = 'qux'",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM some_table AS t
WHERE
  t.id = 42 AND (
    bar = 'baz' OR foo = 'qux'
  )
            """.strip(),
        ),
        (
            "SELECT * FROM some_table WHERE 1=1",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM some_table
WHERE
  some_table.id = 42 AND (
    1 = 1
  )
            """.strip(),
        ),
        (
            "SELECT * FROM some_table WHERE TRUE OR FALSE",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM some_table
WHERE
  some_table.id = 42 AND (
    TRUE OR FALSE
  )
            """.strip(),
        ),
        (
            "SELECT * FROM table WHERE 1=1",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  table.id = 42 AND (
    1 = 1
  )
            """.strip(),
        ),
        (
            'SELECT * FROM "table" WHERE 1=1',
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM "table"
WHERE
  "table".id = 42 AND (
    1 = 1
  )
            """.strip(),
        ),
        (
            "SELECT * FROM table WHERE 1=1",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  1 = 1
            """.strip(),
        ),
        (
            "SELECT * FROM other_table WHERE 1=1",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM other_table
WHERE
  1 = 1
            """.strip(),
        ),
        (
            "SELECT * FROM table",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  table.id = 42
            """.strip(),
        ),
        (
            "SELECT * FROM some_table",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM some_table
WHERE
  some_table.id = 42
            """.strip(),
        ),
        (
            "SELECT * FROM table ORDER BY id",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  table.id = 42
ORDER BY
  id
            """.strip(),
        ),
        (
            "SELECT * FROM table WHERE 1=1 AND table.id=42",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  table.id = 42 AND (
    1 = 1 AND table.id = 42
  )
            """.strip(),
        ),
        (
            """
SELECT * FROM table
JOIN other_table
ON table.id = other_table.id
AND other_table.id=42
            """,
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
JOIN other_table
  ON other_table.id = 42 AND (
    table.id = other_table.id AND other_table.id = 42
  )
            """.strip(),
        ),
        (
            "SELECT * FROM table WHERE 1=1 AND id=42",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  table.id = 42 AND (
    1 = 1 AND id = 42
  )
            """.strip(),
        ),
        (
            "SELECT * FROM table JOIN other_table ON table.id = other_table.id",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
JOIN other_table
  ON other_table.id = 42 AND (
    table.id = other_table.id
  )
            """.strip(),
        ),
        (
            "SELECT * FROM table JOIN other_table",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
JOIN other_table
  ON other_table.id = 42
            """.strip(),
        ),
        (
            """
SELECT *
FROM table
JOIN other_table
ON table.id = other_table.id
WHERE 1=1
            """,
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
JOIN other_table
  ON other_table.id = 42 AND (
    table.id = other_table.id
  )
WHERE
  1 = 1
            """.strip(),
        ),
        (
            "SELECT * FROM (SELECT * FROM other_table)",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM other_table
  WHERE
    other_table.id = 42
)
            """.strip(),
        ),
        (
            "SELECT * FROM table UNION ALL SELECT * FROM other_table",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  table.id = 42
UNION ALL
SELECT
  *
FROM other_table
            """.strip(),
        ),
        (
            "SELECT * FROM table UNION ALL SELECT * FROM other_table",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
UNION ALL
SELECT
  *
FROM other_table
WHERE
  other_table.id = 42
            """.strip(),
        ),
        (
            "INSERT INTO some_table (col1, col2) VALUES (1, 2)",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
INSERT INTO some_table (
  col1,
  col2
)
VALUES
  (1, 2)
            """.strip(),
        ),
    ],
)
def test_rls_predicate_transformer(
    sql: str,
    rules: dict[Table, str],
    expected: str,
) -> None:
    """
    Test `RLSPredicateTransformer`.
    """
    statement = SQLStatement(sql)
    statement.apply_rls(
        "catalog1",
        "schema1",
        {k: [parse_one(v)] for k, v in rules.items()},
        RLSMethod.AS_PREDICATE,
    )
    assert statement.format() == expected


@pytest.mark.parametrize(
    "sql, table, expected",
    [
        (
            "SELECT * FROM some_table",
            Table("some_table"),
            """
CREATE TABLE some_table AS
SELECT
  *
FROM some_table
            """.strip(),
        ),
        (
            "SELECT * FROM some_table",
            Table("some_table", "schema1", "catalog1"),
            """
CREATE TABLE catalog1.schema1.some_table AS
SELECT
  *
FROM some_table
            """.strip(),
        ),
    ],
)
def test_as_create_table(sql: str, table: Table, expected: str) -> None:
    """
    Test the `as_create_table` method.
    """
    statement = SQLStatement(sql)
    create_table = statement.as_create_table(table, CTASMethod.TABLE)
    assert create_table.format() == expected


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("SELECT * FROM table", "postgresql", True),
        (
            """
-- comment
SELECT * FROM table
-- comment 2
            """,
            "mysql",
            True,
        ),
        (
            """
-- comment
SET @value = 42;
SELECT @value as foo;
-- comment 2
            """,
            "mysql",
            True,
        ),
        (
            """
-- comment
EXPLAIN SELECT * FROM table
-- comment 2
            """,
            "mysql",
            False,
        ),
        (
            """
SELECT * FROM table;
INSERT INTO TABLE (foo) VALUES (42);
            """,
            "mysql",
            False,
        ),
    ],
)
def test_is_valid_ctas(sql: str, engine: str, expected: bool) -> None:
    """
    Test the `is_valid_ctas` method.
    """
    assert SQLScript(sql, engine).is_valid_ctas() == expected


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("SELECT * FROM table", "postgresql", True),
        (
            """
-- comment
SELECT * FROM table
-- comment 2
            """,
            "mysql",
            True,
        ),
        (
            """
-- comment
SET @value = 42;
SELECT @value as foo;
-- comment 2
            """,
            "mysql",
            False,
        ),
        (
            """
-- comment
SELECT value as foo;
-- comment 2
            """,
            "mysql",
            True,
        ),
        (
            """
SELECT * FROM table;
INSERT INTO TABLE (foo) VALUES (42);
            """,
            "mysql",
            False,
        ),
    ],
)
def test_is_valid_cvas(sql: str, engine: str, expected: bool) -> None:
    """
    Test the `is_valid_cvas` method.
    """
    assert SQLScript(sql, engine).is_valid_cvas() == expected


@pytest.mark.parametrize(
    "sql, expected, engine",
    [
        ("col = 1", "col = 1", "base"),
        ("1=\t\n1", "1 = 1", "base"),
        ("(col = 1)", "(col = 1)", "base"),  # Compact format without newlines
        (
            "(col1 = 1) AND (col2 = 2)",
            "(col1 = 1) AND (col2 = 2)",
            "base",
        ),  # Compact format
        (
            "col = 'abc' -- comment",
            "col = 'abc'",
            "base",
        ),  # Comments removed for compact format
        ("col = 'col1 = 1) AND (col2 = 2'", "col = 'col1 = 1) AND (col2 = 2'", "base"),
        ("col = 'select 1; select 2'", "col = 'select 1; select 2'", "base"),
        ("col = 'abc -- comment'", "col = 'abc -- comment'", "base"),
        ("col1 = 1) AND (col2 = 2)", QueryClauseValidationException, "base"),
        ("(col1 = 1) AND (col2 = 2", QueryClauseValidationException, "base"),
        ("col1 = 1) AND (col2 = 2", QueryClauseValidationException, "base"),
        ("(col1 = 1)) AND ((col2 = 2)", QueryClauseValidationException, "base"),
        ("TRUE; SELECT 1", QueryClauseValidationException, "base"),
    ],
)
def test_sanitize_clause(sql: str, expected: str | Exception, engine: str) -> None:
    """
    Test the `sanitize_clause` function.
    """
    if isinstance(expected, str):
        assert sanitize_clause(sql, engine) == expected
    else:
        with pytest.raises(expected):
            sanitize_clause(sql, engine)


@pytest.mark.parametrize(
    "engine",
    [
        "hive",
        "presto",
        "trino",
    ],
)
@pytest.mark.parametrize(
    "macro, expected",
    [
        (
            "latest_partition('foo.bar')",
            {Table(table="bar", schema="foo")},
        ),
        (
            "latest_partition(' foo.bar ')",  # Non-atypical user error which works
            {Table(table="bar", schema="foo")},
        ),
        (
            "latest_partition('foo.%s'|format('bar'))",
            {Table(table="bar", schema="foo")},
        ),
        (
            "latest_sub_partition('foo.bar', baz='qux')",
            {Table(table="bar", schema="foo")},
        ),
        (
            "latest_partition('foo.%s'|format(str('bar')))",
            set(),
        ),
        (
            "latest_partition('foo.{}'.format('bar'))",
            set(),
        ),
    ],
)
def test_extract_tables_from_jinja_sql(
    mocker: MockerFixture,
    engine: str,
    macro: str,
    expected: set[Table],
) -> None:
    assert (
        process_jinja_sql(
            sql=f"'{{{{ {engine}.{macro} }}}}'",
            database=mocker.MagicMock(backend=engine),
        ).tables
        == expected
    )


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=False)
def test_extract_tables_from_jinja_sql_disabled(mocker: MockerFixture) -> None:
    """
    Test the function when the feature flag is disabled.
    """
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "mssql"

    assert process_jinja_sql(
        sql="SELECT 1 FROM t",
        database=database,
    ).tables == {Table("t")}


def test_extract_tables_from_jinja_sql_invalid_function(mocker: MockerFixture) -> None:
    """
    Test the function with an invalid function.
    """
    database = mocker.MagicMock(backend="postgresql")

    processor = JinjaTemplateProcessor(database)
    processor.env.globals["my_table"] = lambda: "t"
    mocker.patch(
        "superset.jinja_context.get_template_processor",
        return_value=processor,
    )

    assert process_jinja_sql(
        sql="SELECT * FROM {{ my_table() }}",
        database=database,
    ).tables == {Table("t")}


def test_process_jinja_sql_result_object_structure(mocker: MockerFixture) -> None:
    """
    Test that process_jinja_sql returns a proper JinjaSQLResult object
    with correct script and tables properties.
    """
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "postgresql"

    result = process_jinja_sql(
        sql="SELECT id FROM users WHERE active = true",
        database=database,
    )

    # Test that result is the correct type
    assert isinstance(result, JinjaSQLResult)

    # Test that script property returns a SQLScript
    assert hasattr(result, "script")
    assert isinstance(result.script, SQLScript)

    # Test that tables property returns a set of Tables
    assert hasattr(result, "tables")
    assert isinstance(result.tables, set)
    assert result.tables == {Table("users")}

    # Test that the script contains the expected SQL
    formatted_sql = result.script.format()
    assert "users" in formatted_sql
    assert "active = TRUE" in formatted_sql


def test_process_jinja_sql_template_params_parameter(mocker: MockerFixture) -> None:
    """
    Test that the template_params parameter is properly handled.
    """
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "postgresql"

    processor = JinjaTemplateProcessor(database)
    mocker.patch(
        "superset.jinja_context.get_template_processor",
        return_value=processor,
    )

    # Test that template_params parameter is accepted and passed through
    result = process_jinja_sql(
        sql="SELECT * FROM table_name",
        database=database,
        template_params={"param1": "value1"},
    )

    # Verify the function accepts the parameter without error
    assert isinstance(result, JinjaSQLResult)
    assert result.tables == {Table("table_name")}


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("SELECT * FROM users", "postgresql", True),
        ("WITH cte AS (SELECT * FROM users) SELECT * FROM cte", "postgresql", True),
        ("CREATE TABLE users AS SELECT * FROM users", "postgresql", False),
        ("ALTER TABLE users ADD COLUMN age INT", "postgresql", False),
        ("SET @value = 42", "postgresql", False),
    ],
)
def test_sqlstatement_is_select(sql: str, engine: str, expected: bool) -> None:
    """
    Test the `SQLStatement.is_select()` method.
    """
    assert SQLStatement(sql, engine).is_select() == expected


@pytest.mark.parametrize(
    "kql, expected",
    [
        ("StormEvents | take 10", True),
        ("StormEvents | limit 20", True),
        ("StormEvents | where State == 'FL' | summarize count()", True),
        ("StormEvents | where name has 'limit 10'", True),
        ("AnotherTable | take 5", True),
        ("datatable(x:int) [1, 2, 3] | take 100", True),
        (".create table StormEvents (x:int)", False),
        (".ingest inline into table StormEvents <| StormEvents | take 10", False),
    ],
)
def test_kqlstatement_is_select(kql: str, expected: bool) -> None:
    """
    Test the `KustoKQLStatement.is_select()` method.
    """
    assert KustoKQLStatement(kql, "kustokql").is_select() == expected


def test_singlestore_engine_mapping():
    """
    Test the `singlestoredb` dialect is properly used.
    """
    sql = "SELECT COUNT(*) AS `COUNT(*)`"
    statement = SQLStatement(sql, engine="singlestoredb")
    assert statement.is_select()

    # Should parse without errors
    formatted = statement.format()
    assert "COUNT(*)" in formatted


def test_remove_quotes() -> None:
    """
    Test the `remove_quotes` helper function.
    """
    assert remove_quotes(None) is None
    assert remove_quotes('"foo"') == "foo"
    assert remove_quotes("'foo'") == "foo"
    assert remove_quotes("`foo`") == "foo"
    assert remove_quotes("'foo`") == "'foo`"


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("SELECT * FROM table", "postgresql", False),
        ("SELECT VERSION()", "postgresql", True),
        ("SELECT query_to_xml()", "postgresql", True),
        ("WITH cte AS (SELECT * FROM table) SELECT * FROM cte", "postgresql", False),
        (
            """
SELECT *
FROM query_to_xml('SELECT * from some_table WHERE id = 42')
            """,
            "postgresql",
            True,
        ),
        ("Table | limit 10", "kustokql", False),
    ],
)
def test_check_functions_present(sql: str, engine: str, expected: bool) -> None:
    """
    Check the `check_functions_present` method.
    """
    functions = {"version", "query_to_xml"}
    assert SQLScript(sql, engine).check_functions_present(functions) == expected


@pytest.mark.parametrize(
    "kql, expected",
    [
        (
            "StormEvents | take 10",
            [
                (KQLTokenType.WORD, "StormEvents"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "|"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "take"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.NUMBER, "10"),
            ],
        ),
        ("'test'", [(KQLTokenType.STRING, "'test'")]),
        ("```test```", [(KQLTokenType.STRING, "```test```")]),
    ],
)
def test_tokenize_kql(kql: str, expected: list[tuple[KQLTokenType, str]]) -> None:
    """
    Test the `tokenize_kql` function.
    """
    assert tokenize_kql(kql) == expected


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("a = 1", "postgresql", False),
        ("(SELECT * FROM table)", "postgresql", True),
        ("SELECT * FROM table", "postgresql", False),
        ("SELECT * FROM (SELECT 1)", "postgresql", True),
        ("SELECT * FROM (SELECT 1) AS subquery", "postgresql", True),
        ("WITH cte AS (SELECT 1) SELECT * FROM cte", "postgresql", True),
        ("SELECT * FROM table WHERE EXISTS (SELECT 1)", "postgresql", True),
        ("SELECT * FROM table WHERE NOT EXISTS (SELECT 1)", "postgresql", True),
        (
            "SELECT * FROM table WHERE id IN (SELECT id FROM other_table)",
            "postgresql",
            True,
        ),
    ],
)
def test_has_subquery(sql: str, engine: str, expected: bool) -> None:
    """
    Test the `has_subquery` method.
    """
    assert SQLStatement(sql, engine).has_subquery() == expected


# =============================================================================
# Column-Level Security (CLS) Tests
# =============================================================================


def test_cls_action_enum() -> None:
    """
    Test CLSAction enum values exist.
    """
    assert CLSAction.HASH is not None
    assert CLSAction.NULLIFY is not None
    assert CLSAction.HIDE is not None
    assert CLSAction.MASK is not None


def test_cls_hash_functions_mapping() -> None:
    """
    Test that CLS_HASH_FUNCTIONS has entries for common dialects.
    """
    # Check fallback exists
    assert None in CLS_HASH_FUNCTIONS
    assert CLS_HASH_FUNCTIONS[None] == "'[HASHED]'"

    # Check common dialects
    assert Dialects.POSTGRES in CLS_HASH_FUNCTIONS
    assert Dialects.MYSQL in CLS_HASH_FUNCTIONS
    assert Dialects.BIGQUERY in CLS_HASH_FUNCTIONS
    assert Dialects.SNOWFLAKE in CLS_HASH_FUNCTIONS

    # Verify hash patterns contain placeholder
    for dialect, pattern in CLS_HASH_FUNCTIONS.items():
        if dialect is not None and pattern != "'[HASHED]'":
            assert "{}" in pattern, f"Missing placeholder in {dialect} hash pattern"


def test_apply_cls_empty_rules() -> None:
    """
    Test that apply_cls returns original SQL when rules are empty.
    """
    sql = "SELECT id, name FROM users"
    result = apply_cls(sql, {}, engine="postgresql")
    assert result == sql


def test_apply_cls_hash_action() -> None:
    """
    Test CLSAction.HASH transforms column with hash function.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    sql = "SELECT ssn, name FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == (
        "SELECT\n"
        '  MD5(CAST("users"."ssn" AS TEXT)) AS ssn,\n'
        '  "users"."name" AS "name"\n'
        'FROM "users" AS "users"'
    )


def test_apply_cls_nullify_action() -> None:
    """
    Test CLSAction.NULLIFY transforms column to NULL.
    """
    rules = {Table("users"): {"salary": CLSAction.NULLIFY}}
    sql = "SELECT salary, name FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == (
        'SELECT\n  NULL AS salary,\n  "users"."name" AS "name"\nFROM "users" AS "users"'
    )


def test_apply_cls_hide_action() -> None:
    """
    Test CLSAction.HIDE removes column from SELECT.
    """
    rules = {Table("users"): {"password": CLSAction.HIDE}}
    sql = "SELECT password, name FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == ('SELECT\n  "users"."name" AS "name"\nFROM "users" AS "users"')


def test_apply_cls_mask_action() -> None:
    """
    Test CLSAction.MASK transforms column to CASE expression preserving NULLs.
    """
    rules = {Table("users"): {"phone": CLSAction.MASK}}
    sql = "SELECT phone, name FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == (
        "SELECT\n"
        "  CASE WHEN \"users\".\"phone\" IS NULL THEN NULL ELSE '****' END AS phone,\n"
        '  "users"."name" AS "name"\n'
        'FROM "users" AS "users"'
    )


def test_apply_cls_mask_preserves_null() -> None:
    """
    Test CLSAction.MASK preserves NULL values using CASE expression.

    MASK generates: CASE WHEN column IS NULL THEN NULL ELSE '****' END
    This preserves the semantic meaning of NULL (no value) vs masked (hidden value).
    """
    rules = {Table("users"): {"email": CLSAction.MASK}}
    sql = "SELECT email FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # The CASE expression should check for NULL and preserve it
    assert "CASE WHEN" in result
    assert "IS NULL THEN NULL" in result
    assert "ELSE '****'" in result


def test_apply_cls_all_actions() -> None:
    """
    Test all CLS actions in a single query.
    """
    rules = {
        Table("employees"): {
            "ssn": CLSAction.HASH,
            "salary": CLSAction.NULLIFY,
            "password": CLSAction.HIDE,
            "phone": CLSAction.MASK,
        }
    }
    sql = "SELECT ssn, salary, password, phone, name FROM employees"
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == (
        "SELECT\n"
        '  MD5(CAST("employees"."ssn" AS TEXT)) AS ssn,\n'
        "  NULL AS salary,\n"
        "  CASE WHEN \"employees\".\"phone\" IS NULL THEN NULL ELSE '****' END AS phone,\n"
        '  "employees"."name" AS "name"\n'
        'FROM "employees" AS "employees"'
    )


def test_apply_cls_qualified_columns() -> None:
    """
    Test CLS with fully qualified column names (table.column).
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    sql = "SELECT users.ssn, users.name FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == (
        "SELECT\n"
        '  MD5(CAST("users"."ssn" AS TEXT)) AS ssn,\n'
        '  "users"."name" AS "name"\n'
        'FROM "users" AS "users"'
    )


def test_apply_cls_table_alias() -> None:
    """
    Test CLS with table aliases.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    sql = "SELECT u.ssn, u.name FROM users u"
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == (
        "SELECT\n"
        '  MD5(CAST("u"."ssn" AS TEXT)) AS ssn,\n'
        '  "u"."name" AS "name"\n'
        'FROM "users" AS "u"'
    )


def test_apply_cls_join() -> None:
    """
    Test CLS with JOIN queries.
    """
    rules = {
        Table("employees"): {"ssn": CLSAction.HASH},
        Table("salaries"): {"amount": CLSAction.NULLIFY},
    }
    sql = """
SELECT e.ssn, e.name, s.amount
FROM employees e
JOIN salaries s
ON e.id = s.employee_id
    """
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == (
        "SELECT\n"
        '  MD5(CAST("e"."ssn" AS TEXT)) AS ssn,\n'
        '  "e"."name" AS "name",\n'
        "  NULL AS amount\n"
        'FROM "employees" AS "e"\n'
        'JOIN "salaries" AS "s"\n'
        '  ON "e"."id" = "s"."employee_id"'
    )


def test_apply_cls_case_insensitive() -> None:
    """
    Test CLS rules are case-insensitive for table and column names.
    """
    rules = {Table("USERS"): {"SSN": CLSAction.HASH}}
    sql = "SELECT ssn, name FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == (
        "SELECT\n"
        '  MD5(CAST("users"."ssn" AS TEXT)) AS ssn,\n'
        '  "users"."name" AS "name"\n'
        'FROM "users" AS "users"'
    )


def test_apply_cls_with_column_alias() -> None:
    """
    Test CLS preserves existing column aliases.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    sql = "SELECT ssn AS social_security, name FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == (
        "SELECT\n"
        '  MD5(CAST("users"."ssn" AS TEXT)) AS social_security,\n'
        '  "users"."name" AS "name"\n'
        'FROM "users" AS "users"'
    )


def test_apply_cls_no_matching_table() -> None:
    """
    Test CLS leaves columns unchanged when table doesn't match rules.
    """
    rules = {Table("other_table"): {"ssn": CLSAction.HASH}}
    sql = "SELECT ssn, name FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # Table doesn't match rules, so columns are unchanged (just qualified)
    assert result == (
        "SELECT\n"
        '  "users"."ssn" AS "ssn",\n'
        '  "users"."name" AS "name"\n'
        'FROM "users" AS "users"'
    )


def test_apply_cls_non_column_expressions() -> None:
    """
    Test CLS leaves non-column expressions unchanged.
    """
    rules = {Table("users"): {"name": CLSAction.HASH}}
    sql = "SELECT 1 AS one, 'test' AS str, COUNT(*) AS cnt FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == (
        "SELECT\n"
        '  1 AS "one",\n'
        "  'test' AS \"str\",\n"
        '  COUNT(*) AS "cnt"\n'
        'FROM "users" AS "users"'
    )


def test_apply_cls_with_schema() -> None:
    """
    Test CLS with schema for column qualification.
    """
    rules = {
        Table("employees"): {"ssn": CLSAction.HASH},
        Table("departments"): {"budget": CLSAction.NULLIFY},
    }
    schema = {
        "employees": {
            "id": "INT",
            "ssn": "VARCHAR",
            "name": "VARCHAR",
            "dept_id": "INT",
        },
        "departments": {"id": "INT", "name": "VARCHAR", "budget": "DECIMAL"},
    }
    sql = """
SELECT
    ssn, name, budget
FROM employees e
JOIN departments d
ON e.dept_id = d.id
    """
    result = apply_cls(sql, rules, engine="postgresql", schema=schema)

    assert "MD5" in result
    assert "NULL" in result


def test_apply_cls_different_dialects() -> None:
    """
    Test CLS uses correct hash function for different database dialects.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    sql = "SELECT ssn FROM users"

    # PostgreSQL
    result_pg = apply_cls(sql, rules, engine="postgresql")
    assert result_pg == (
        'SELECT\n  MD5(CAST("users"."ssn" AS TEXT)) AS ssn\nFROM "users" AS "users"'
    )

    # MySQL
    result_mysql = apply_cls(sql, rules, engine="mysql")
    assert result_mysql == (
        "SELECT\n  MD5(CAST(`users`.`ssn` AS CHAR)) AS ssn\nFROM `users` AS `users`"
    )

    # BigQuery
    result_bq = apply_cls(sql, rules, engine="bigquery")
    assert result_bq == (
        "SELECT\n"
        "  TO_HEX(MD5(CAST(`users`.`ssn` AS STRING))) AS ssn\n"
        "FROM `users` AS `users`"
    )


def test_apply_cls_unknown_dialect_fallback() -> None:
    """
    Test CLS uses fallback for unknown database dialects.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    sql = "SELECT users.ssn FROM users"
    result = apply_cls(sql, rules, engine="unknown_database")

    assert result == ('SELECT\n  \'[HASHED]\' AS ssn\nFROM "users" AS "users"')


def test_apply_cls_select_star_warning(caplog: pytest.LogCaptureFixture) -> None:
    """
    Test CLS logs warning for SELECT * queries.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    sql = "SELECT * FROM users"

    import logging

    with caplog.at_level(logging.WARNING):
        result = apply_cls(sql, rules, engine="postgresql")

    assert (
        "SELECT *" in caplog.text or "CLS cannot fully process SELECT *" in caplog.text
    )
    assert "*" in result  # Star should be preserved


def test_sql_statement_apply_cls_method() -> None:
    """
    Test SQLStatement.apply_cls method.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    statement = SQLStatement("SELECT ssn, name FROM users", engine="postgresql")
    statement.apply_cls(rules)
    result = statement.format()

    assert result == (
        "SELECT\n"
        '  MD5(CAST("users"."ssn" AS TEXT)) AS ssn,\n'
        '  "users"."name" AS "name"\n'
        'FROM "users" AS "users"'
    )


def test_sql_statement_apply_cls_empty_rules() -> None:
    """
    Test SQLStatement.apply_cls with empty rules returns unchanged statement.
    """
    original_sql = "SELECT ssn, name FROM users"
    statement = SQLStatement(original_sql, engine="postgresql")
    statement.apply_cls({})
    result = statement.format()

    # Empty rules, so original query is preserved (just formatted)
    assert result == ("SELECT\n  ssn,\n  name\nFROM users")


def test_sql_statement_apply_cls_with_schema() -> None:
    """
    Test SQLStatement.apply_cls with schema parameter.
    """
    rules = {Table("employees"): {"ssn": CLSAction.HASH}}
    schema = {"employees": {"id": "INT", "ssn": "VARCHAR", "name": "VARCHAR"}}
    statement = SQLStatement("SELECT ssn, name FROM employees", engine="postgresql")
    statement.apply_cls(rules, schema=schema)
    result = statement.format()

    assert result == (
        "SELECT\n"
        '  MD5(CAST("employees"."ssn" AS TEXT)) AS ssn,\n'
        '  "employees"."name" AS "name"\n'
        'FROM "employees" AS "employees"'
    )


def test_cls_transformer_normalize_rules() -> None:
    """
    Test CLSTransformer normalizes table and column names to lowercase.
    """
    rules = {Table("USERS"): {"SSN": CLSAction.HASH, "Name": CLSAction.MASK}}
    transformer = CLSTransformer(rules, Dialects.POSTGRES)

    # Check that a normalized Table key exists
    normalized_key = Table("users")
    assert normalized_key in transformer.rules
    assert "ssn" in transformer.rules[normalized_key]
    assert "name" in transformer.rules[normalized_key]


def test_cls_transformer_get_action() -> None:
    """
    Test CLSTransformer._get_action method.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    transformer = CLSTransformer(rules, Dialects.POSTGRES)

    # Valid table and column
    assert transformer._get_action("users", "ssn") == CLSAction.HASH

    # Case insensitive
    assert transformer._get_action("USERS", "SSN") == CLSAction.HASH

    # No matching column
    assert transformer._get_action("users", "name") is None

    # No matching table
    assert transformer._get_action("other", "ssn") is None

    # None table
    assert transformer._get_action(None, "ssn") is None


def test_cls_transformer_extract_scope_tables() -> None:
    """
    Test CLSTransformer._extract_scope_tables method.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    transformer = CLSTransformer(rules, Dialects.POSTGRES)

    # Single table
    select = parse_one("SELECT * FROM users")
    tables = transformer._extract_scope_tables(select)
    assert "users" in tables
    assert tables["users"] == "users"

    # Table with alias
    select = parse_one("SELECT * FROM users u")
    tables = transformer._extract_scope_tables(select)
    assert "u" in tables
    assert tables["u"] == "users"

    # JOIN
    select = parse_one("SELECT * FROM users u JOIN orders o ON u.id = o.user_id")
    tables = transformer._extract_scope_tables(select)
    assert "u" in tables
    assert "o" in tables
    assert tables["u"] == "users"
    assert tables["o"] == "orders"


def test_cls_transformer_get_table_for_column_qualified() -> None:
    """
    Test CLSTransformer._get_table_for_column with qualified columns.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    transformer = CLSTransformer(rules, Dialects.POSTGRES)
    scope_tables = {"u": "users", "o": "orders"}

    # Qualified with alias
    column = parse_one("u.ssn").find(exp.Column)
    result = transformer._get_table_for_column(column, scope_tables)
    assert result == "users"

    # Qualified with unknown alias (returns as-is)
    column = parse_one("x.ssn").find(exp.Column)
    result = transformer._get_table_for_column(column, scope_tables)
    assert result == "x"


def test_cls_transformer_get_table_for_column_single_table() -> None:
    """
    Test CLSTransformer._get_table_for_column infers single table.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    transformer = CLSTransformer(rules, Dialects.POSTGRES)
    scope_tables = {"users": "users"}

    # Unqualified column with single table in scope
    column = parse_one("ssn").find(exp.Column)
    result = transformer._get_table_for_column(column, scope_tables)
    assert result == "users"


def test_cls_transformer_get_table_for_column_multi_table_rules_match() -> None:
    """
    Test CLSTransformer._get_table_for_column matches against rules.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    transformer = CLSTransformer(rules, Dialects.POSTGRES)
    scope_tables = {"users": "users", "orders": "orders"}

    # Unqualified column that only exists in rules for one table
    column = parse_one("ssn").find(exp.Column)
    result = transformer._get_table_for_column(column, scope_tables)
    assert result == "users"


def test_cls_transformer_get_table_for_column_no_match() -> None:
    """
    Test CLSTransformer._get_table_for_column returns None when no match.
    """
    rules = {Table("other"): {"col": CLSAction.HASH}}
    transformer = CLSTransformer(rules, Dialects.POSTGRES)
    scope_tables = {"users": "users", "orders": "orders"}

    # Unqualified column with no matching rule
    column = parse_one("ssn").find(exp.Column)
    result = transformer._get_table_for_column(column, scope_tables)
    assert result is None


def test_cls_transformer_get_column_alias() -> None:
    """
    Test CLSTransformer._get_column_alias method.
    """
    transformer = CLSTransformer({}, Dialects.POSTGRES)

    # Column expression
    column = parse_one("ssn").find(exp.Column)
    assert transformer._get_column_alias(column) == "ssn"

    # Alias expression
    alias = parse_one("ssn AS social").find(exp.Alias)
    assert transformer._get_column_alias(alias) == "social"

    # Other expression (literal)
    literal = parse_one("'test'").find(exp.Literal)
    assert transformer._get_column_alias(literal) == "'test'"


def test_cls_transformer_create_expressions() -> None:
    """
    Test CLSTransformer expression creation methods.
    """
    transformer = CLSTransformer({}, Dialects.POSTGRES)

    # Hash expression
    column = parse_one("ssn").find(exp.Column)
    hash_expr = transformer._create_hash_expression(column, "ssn")
    assert isinstance(hash_expr, exp.Alias)
    assert hash_expr.alias == "ssn"

    # Null expression
    null_expr = transformer._create_null_expression("salary")
    assert isinstance(null_expr, exp.Alias)
    assert null_expr.alias == "salary"
    assert isinstance(null_expr.this, exp.Null)

    # Mask expression (CASE expression that preserves NULLs)
    phone_column = parse_one("phone").find(exp.Column)
    mask_expr = transformer._create_mask_expression(phone_column, "phone")
    assert isinstance(mask_expr, exp.Alias)
    assert mask_expr.alias == "phone"
    assert isinstance(mask_expr.this, exp.Case)
    # The CASE should have a default of '****'
    case_default = mask_expr.this.args.get("default")
    assert isinstance(case_default, exp.Literal)
    assert case_default.this == "****"


def test_cls_transformer_call_non_select() -> None:
    """
    Test CLSTransformer.__call__ returns non-SELECT nodes unchanged.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    transformer = CLSTransformer(rules, Dialects.POSTGRES)

    # Non-SELECT node should be returned unchanged
    table = parse_one("users").find(exp.Column)
    result = transformer(table)
    assert result == table


def test_cls_transformer_transform_expression_non_column() -> None:
    """
    Test CLSTransformer._transform_expression returns non-column expressions unchanged.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    transformer = CLSTransformer(rules, Dialects.POSTGRES)
    scope_tables = {"users": "users"}

    # Literal expression should be unchanged
    literal = parse_one("'test'")
    result = transformer._transform_expression(literal, scope_tables)
    assert result == literal

    # Function expression should be unchanged
    func = parse_one("COUNT(*)")
    result = transformer._transform_expression(func, scope_tables)
    assert result == func


@pytest.mark.parametrize(
    "sql,rules,engine,expected",
    [
        # Basic HASH
        (
            "SELECT t.id FROM t",
            {Table("t"): {"id": CLSAction.HASH}},
            "postgresql",
            'SELECT\n  MD5(CAST("t"."id" AS TEXT)) AS id\nFROM "t" AS "t"',
        ),
        # Basic NULLIFY
        (
            "SELECT t.salary FROM t",
            {Table("t"): {"salary": CLSAction.NULLIFY}},
            "postgresql",
            'SELECT\n  NULL AS salary\nFROM "t" AS "t"',
        ),
        # Basic HIDE
        (
            "SELECT t.secret, t.public FROM t",
            {Table("t"): {"secret": CLSAction.HIDE}},
            "postgresql",
            'SELECT\n  "t"."public" AS "public"\nFROM "t" AS "t"',
        ),
        # Basic MASK (preserves NULLs)
        (
            "SELECT t.phone FROM t",
            {Table("t"): {"phone": CLSAction.MASK}},
            "postgresql",
            "SELECT\n  CASE WHEN \"t\".\"phone\" IS NULL THEN NULL ELSE '****' END AS phone\nFROM \"t\" AS \"t\"",
        ),
        # Multiple tables with different rules
        (
            "SELECT a.ssn, b.amount FROM users a JOIN payments b ON a.id = b.user_id",
            {
                Table("users"): {"ssn": CLSAction.HASH},
                Table("payments"): {"amount": CLSAction.NULLIFY},
            },
            "postgresql",
            (
                "SELECT\n"
                '  MD5(CAST("a"."ssn" AS TEXT)) AS ssn,\n'
                "  NULL AS amount\n"
                'FROM "users" AS "a"\n'
                'JOIN "payments" AS "b"\n'
                '  ON "a"."id" = "b"."user_id"'
            ),
        ),
        # Snowflake dialect
        (
            "SELECT t.col FROM t",
            {Table("t"): {"col": CLSAction.HASH}},
            "snowflake",
            'SELECT\n  MD5(TO_CHAR("T"."COL")) AS COL\nFROM "T" AS "T"',
        ),
        # ClickHouse dialect
        (
            "SELECT t.col FROM t",
            {Table("t"): {"col": CLSAction.HASH}},
            "clickhouse",
            'SELECT\n  MD5(toString("t"."col")) AS col\nFROM "t" AS "t"',
        ),
    ],
)
def test_apply_cls_parametrized(
    sql: str,
    rules: dict[Table, Any],
    engine: str,
    expected: str,
) -> None:
    """
    Parametrized tests for apply_cls function.
    """
    result = apply_cls(sql, rules, engine=engine)
    assert result == expected


def test_apply_cls_subquery() -> None:
    """
    Test CLS applies to subqueries.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    sql = "SELECT * FROM (SELECT ssn, name FROM users) AS subq"
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == (
        "SELECT\n"
        '  "subq"."ssn" AS "ssn",\n'
        '  "subq"."name" AS "name"\n'
        "FROM (\n"
        "  SELECT\n"
        '    MD5(CAST("users"."ssn" AS TEXT)) AS ssn,\n'
        '    "users"."name" AS "name"\n'
        '  FROM "users" AS "users"\n'
        ') AS "subq"'
    )


def test_apply_cls_cte() -> None:
    """
    Test CLS applies to CTEs.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    sql = "WITH cte AS (SELECT ssn, name FROM users) SELECT * FROM cte"
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == (
        'WITH "cte" AS (\n'
        "  SELECT\n"
        '    MD5(CAST("users"."ssn" AS TEXT)) AS ssn,\n'
        '    "users"."name" AS "name"\n'
        '  FROM "users" AS "users"\n'
        ")\n"
        "SELECT\n"
        '  "cte"."ssn" AS "ssn",\n'
        '  "cte"."name" AS "name"\n'
        'FROM "cte" AS "cte"'
    )


def test_apply_cls_union() -> None:
    """
    Test CLS applies to UNION queries.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    sql = "SELECT ssn FROM users UNION SELECT ssn FROM archived_users"
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == (
        "SELECT\n"
        '  MD5(CAST("users"."ssn" AS TEXT)) AS ssn\n'
        'FROM "users" AS "users"\n'
        "UNION\n"
        "SELECT\n"
        '  "archived_users"."ssn" AS "ssn"\n'
        'FROM "archived_users" AS "archived_users"'
    )


def test_cls_hide_all_columns() -> None:
    """
    Test CLS HIDE action when all columns are hidden.
    """
    rules = {Table("users"): {"id": CLSAction.HIDE, "name": CLSAction.HIDE}}
    sql = "SELECT id, name FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # Both columns should be hidden, resulting in empty SELECT
    assert result == 'SELECT\nFROM "users" AS "users"'


def test_cls_transformer_extract_scope_tables_no_from() -> None:
    """
    Test CLSTransformer._extract_scope_tables with no FROM clause.
    """
    transformer = CLSTransformer({}, Dialects.POSTGRES)
    select = parse_one("SELECT 1")
    tables = transformer._extract_scope_tables(select)
    assert tables == {}


def test_cls_transformer_extract_scope_tables_no_joins() -> None:
    """
    Test CLSTransformer._extract_scope_tables with FROM but no JOINs.
    """
    transformer = CLSTransformer({}, Dialects.POSTGRES)
    select = parse_one("SELECT * FROM users")
    tables = transformer._extract_scope_tables(select)
    assert "users" in tables
    assert len(tables) == 1


def test_apply_cls_aliased_column_preserves_alias() -> None:
    """
    Test that CLS preserves the alias when column has AS clause.
    """
    rules = {Table("t"): {"col": CLSAction.HASH}}
    sql = "SELECT t.col AS my_alias FROM t"
    result = apply_cls(sql, rules, engine="postgresql")

    assert result == (
        'SELECT\n  MD5(CAST("t"."col" AS TEXT)) AS my_alias\nFROM "t" AS "t"'
    )


def test_cls_transformer_hash_pattern_fallback() -> None:
    """
    Test CLSTransformer uses fallback hash pattern for unknown dialect.
    """
    # Use None as dialect to trigger fallback
    transformer = CLSTransformer({Table("t"): {"col": CLSAction.HASH}}, None)
    assert transformer.hash_pattern == "'[HASHED]'"


# Tests for CLS predicate transformation
def test_apply_cls_where_clause_hash() -> None:
    """
    Test CLS HASH transforms columns in WHERE clause predicates.

    This prevents information leakage by ensuring filter conditions also
    get hashed, so queries like "WHERE role='CEO'" won't match unless
    the user knows the hash value.
    """
    rules = {Table("payroll"): {"role": CLSAction.HASH}}
    sql = "SELECT MAX(salary) FROM payroll WHERE role='CEO'"
    result = apply_cls(sql, rules, engine="postgresql")

    # The WHERE clause should have the column hashed
    assert "MD5" in result
    assert 'WHERE' in result
    assert "MD5(CAST" in result


def test_apply_cls_where_clause_nullify() -> None:
    """
    Test CLS NULLIFY in WHERE clause becomes FALSE to prevent filtering.
    """
    rules = {Table("payroll"): {"salary": CLSAction.NULLIFY}}
    sql = "SELECT name FROM payroll WHERE salary > 100000"
    result = apply_cls(sql, rules, engine="postgresql")

    # The WHERE clause column becomes FALSE to block filtering
    assert "FALSE" in result


def test_apply_cls_where_clause_mask() -> None:
    """
    Test CLS MASK in WHERE clause becomes FALSE to prevent filtering.
    """
    rules = {Table("users"): {"phone": CLSAction.MASK}}
    sql = "SELECT name FROM users WHERE phone = '555-1234'"
    result = apply_cls(sql, rules, engine="postgresql")

    # The WHERE clause column becomes FALSE to block filtering
    assert "FALSE" in result


def test_apply_cls_where_clause_hide() -> None:
    """
    Test CLS HIDE in WHERE clause becomes FALSE to prevent filtering.
    """
    rules = {Table("users"): {"secret_code": CLSAction.HIDE}}
    sql = "SELECT name FROM users WHERE secret_code = 'ADMIN'"
    result = apply_cls(sql, rules, engine="postgresql")

    # The WHERE clause column becomes FALSE to block filtering
    assert "FALSE" in result


def test_apply_cls_where_clause_multiple_conditions() -> None:
    """
    Test CLS transforms multiple conditions in WHERE clause.
    """
    rules = {Table("users"): {"role": CLSAction.HASH, "salary": CLSAction.NULLIFY}}
    sql = "SELECT name FROM users WHERE role = 'admin' AND salary > 50000"
    result = apply_cls(sql, rules, engine="postgresql")

    # One condition should be hashed, other becomes FALSE
    assert "MD5" in result
    assert "FALSE" in result


def test_apply_cls_join_on_clause_hash() -> None:
    """
    Test CLS HASH transforms columns in JOIN ON clause.
    """
    rules = {Table("users"): {"user_id": CLSAction.HASH}}
    sql = """
SELECT o.order_id
FROM orders o
JOIN users u ON o.customer_id = u.user_id
    """
    result = apply_cls(sql, rules, engine="postgresql")

    # The ON clause should have the column hashed
    assert "MD5" in result


def test_apply_cls_cross_join_no_on_clause() -> None:
    """
    Test CLS handles CROSS JOIN (no ON clause) without error.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    sql = "SELECT u.ssn, p.name FROM users u CROSS JOIN products p"
    result = apply_cls(sql, rules, engine="postgresql")

    # SSN in SELECT should be hashed, CROSS JOIN has no ON to transform
    assert "MD5" in result
    assert "CROSS JOIN" in result


def test_apply_cls_having_clause_hash() -> None:
    """
    Test CLS HASH transforms columns in HAVING clause.
    """
    rules = {Table("sales"): {"region": CLSAction.HASH}}
    sql = "SELECT COUNT(*) FROM sales GROUP BY region HAVING region = 'North'"
    result = apply_cls(sql, rules, engine="postgresql")

    # The HAVING clause should have the column hashed
    assert "HAVING" in result
    assert "MD5" in result


def test_apply_cls_group_by_hash() -> None:
    """
    Test CLS HASH transforms columns in GROUP BY clause.
    """
    rules = {Table("users"): {"department": CLSAction.HASH}}
    sql = "SELECT COUNT(*) FROM users GROUP BY department"
    result = apply_cls(sql, rules, engine="postgresql")

    # GROUP BY should have the column hashed
    assert "GROUP BY" in result
    assert "MD5" in result


def test_apply_cls_group_by_hide() -> None:
    """
    Test CLS HIDE removes column from GROUP BY clause.
    """
    rules = {Table("users"): {"ssn": CLSAction.HIDE}}
    sql = "SELECT COUNT(*) FROM users GROUP BY ssn"
    result = apply_cls(sql, rules, engine="postgresql")

    # GROUP BY should be removed (no columns left)
    assert "GROUP BY" not in result


def test_apply_cls_group_by_nullify() -> None:
    """
    Test CLS NULLIFY removes column from GROUP BY clause.
    """
    rules = {Table("users"): {"salary": CLSAction.NULLIFY}}
    sql = "SELECT COUNT(*) FROM users GROUP BY salary"
    result = apply_cls(sql, rules, engine="postgresql")

    # GROUP BY should be removed (no columns left)
    assert "GROUP BY" not in result


def test_apply_cls_group_by_mask() -> None:
    """
    Test CLS MASK removes column from GROUP BY clause.
    """
    rules = {Table("users"): {"phone": CLSAction.MASK}}
    sql = "SELECT COUNT(*) FROM users GROUP BY phone"
    result = apply_cls(sql, rules, engine="postgresql")

    # GROUP BY should be removed (no columns left)
    assert "GROUP BY" not in result


def test_apply_cls_group_by_multiple_columns() -> None:
    """
    Test CLS with multiple columns in GROUP BY - partial removal.
    """
    rules = {Table("users"): {"ssn": CLSAction.HIDE}}
    sql = "SELECT COUNT(*) FROM users GROUP BY department, ssn"
    result = apply_cls(sql, rules, engine="postgresql")

    # GROUP BY should keep department but remove ssn
    assert "GROUP BY" in result
    assert "department" in result.lower()
    assert "ssn" not in result.lower()


def test_apply_cls_order_by_hash() -> None:
    """
    Test CLS HASH transforms columns in ORDER BY clause.
    """
    rules = {Table("users"): {"salary": CLSAction.HASH}}
    sql = "SELECT name FROM users ORDER BY salary DESC"
    result = apply_cls(sql, rules, engine="postgresql")

    # ORDER BY should have the column hashed
    assert "ORDER BY" in result
    assert "MD5" in result
    assert "DESC" in result


def test_apply_cls_order_by_hide() -> None:
    """
    Test CLS HIDE removes column from ORDER BY clause.
    """
    rules = {Table("users"): {"salary": CLSAction.HIDE}}
    sql = "SELECT name FROM users ORDER BY salary"
    result = apply_cls(sql, rules, engine="postgresql")

    # ORDER BY should be removed (no columns left)
    assert "ORDER BY" not in result


def test_apply_cls_order_by_nullify() -> None:
    """
    Test CLS NULLIFY removes column from ORDER BY clause.
    """
    rules = {Table("users"): {"salary": CLSAction.NULLIFY}}
    sql = "SELECT name FROM users ORDER BY salary"
    result = apply_cls(sql, rules, engine="postgresql")

    # ORDER BY should be removed
    assert "ORDER BY" not in result


def test_apply_cls_order_by_mask() -> None:
    """
    Test CLS MASK removes column from ORDER BY clause.
    """
    rules = {Table("users"): {"salary": CLSAction.MASK}}
    sql = "SELECT name FROM users ORDER BY salary"
    result = apply_cls(sql, rules, engine="postgresql")

    # ORDER BY should be removed
    assert "ORDER BY" not in result


def test_apply_cls_order_by_multiple_columns() -> None:
    """
    Test CLS with multiple columns in ORDER BY - partial removal.
    """
    rules = {Table("users"): {"salary": CLSAction.HIDE}}
    sql = "SELECT name FROM users ORDER BY name, salary DESC"
    result = apply_cls(sql, rules, engine="postgresql")

    # ORDER BY should keep name but remove salary
    assert "ORDER BY" in result
    assert "name" in result.lower()
    # salary should be removed
    assert "salary" not in result.lower()


def test_apply_cls_case_expression_hide() -> None:
    """
    Test CLS HIDE in CASE expression replaces column with NULL.
    """
    rules = {Table("users"): {"status": CLSAction.HIDE}}
    sql = "SELECT name, CASE WHEN status = 'active' THEN 'yes' ELSE 'no' END as is_active FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # status should be replaced with NULL in the CASE
    assert "NULL = 'active'" in result
    # Original column name should not appear
    assert "status" not in result.lower() or "null" in result.lower()


def test_apply_cls_case_expression_hash() -> None:
    """
    Test CLS HASH in CASE expression transforms the column.
    """
    rules = {Table("users"): {"status": CLSAction.HASH}}
    sql = "SELECT name, CASE WHEN status = 'active' THEN 'yes' ELSE 'no' END as is_active FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # status should be hashed in the CASE
    assert "MD5" in result
    assert "CASE WHEN" in result


def test_apply_cls_function_argument_hide() -> None:
    """
    Test CLS HIDE in function argument replaces column with NULL.
    """
    rules = {Table("users"): {"email": CLSAction.HIDE}}
    sql = "SELECT UPPER(email) as upper_email FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # email should be replaced with NULL
    assert "UPPER(NULL)" in result


def test_apply_cls_function_argument_hash() -> None:
    """
    Test CLS HASH in function argument transforms the column.
    """
    rules = {Table("users"): {"email": CLSAction.HASH}}
    sql = "SELECT UPPER(email) as upper_email FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # email should be hashed inside UPPER
    assert "UPPER(MD5" in result


def test_apply_cls_window_partition_by_hide() -> None:
    """
    Test CLS HIDE removes column from window PARTITION BY.
    """
    rules = {Table("employees"): {"department": CLSAction.HIDE}}
    sql = "SELECT name, ROW_NUMBER() OVER (PARTITION BY department ORDER BY name) as rn FROM employees"
    result = apply_cls(sql, rules, engine="postgresql")

    # department should be removed from PARTITION BY
    assert "PARTITION BY" not in result or "department" not in result.lower()
    # ORDER BY name should remain
    assert "ORDER BY" in result


def test_apply_cls_window_partition_by_hash() -> None:
    """
    Test CLS HASH transforms column in window PARTITION BY.
    """
    rules = {Table("employees"): {"department": CLSAction.HASH}}
    sql = "SELECT name, ROW_NUMBER() OVER (PARTITION BY department ORDER BY name) as rn FROM employees"
    result = apply_cls(sql, rules, engine="postgresql")

    # department should be hashed in PARTITION BY
    assert "PARTITION BY" in result
    assert "MD5" in result


def test_apply_cls_window_order_by_hide() -> None:
    """
    Test CLS HIDE removes column from window ORDER BY.
    """
    rules = {Table("employees"): {"salary": CLSAction.HIDE}}
    sql = "SELECT name, RANK() OVER (ORDER BY salary DESC) as rank FROM employees"
    result = apply_cls(sql, rules, engine="postgresql")

    # salary should be removed from ORDER BY, leaving empty or no ORDER
    assert "salary" not in result.lower()


def test_apply_cls_window_order_by_hash() -> None:
    """
    Test CLS HASH transforms column in window ORDER BY.
    """
    rules = {Table("employees"): {"salary": CLSAction.HASH}}
    sql = "SELECT name, RANK() OVER (ORDER BY salary DESC) as rank FROM employees"
    result = apply_cls(sql, rules, engine="postgresql")

    # salary should be hashed in window ORDER BY
    assert "MD5" in result
    assert "DESC" in result


def test_apply_cls_window_partition_only_no_order() -> None:
    """
    Test CLS with window that has PARTITION BY but no ORDER BY.
    Covers branch 847->836 (no window_order).
    """
    rules = {Table("employees"): {"department": CLSAction.HASH}}
    sql = "SELECT name, COUNT(*) OVER (PARTITION BY department) as cnt FROM employees"
    result = apply_cls(sql, rules, engine="postgresql")

    # department should be hashed in PARTITION BY, no ORDER BY
    assert "PARTITION BY" in result
    assert "MD5" in result
    assert "ORDER BY" not in result.split("OVER")[1].split(")")[0]  # No ORDER BY in window


def test_apply_cls_window_partition_all_blocked() -> None:
    """
    Test CLS removes PARTITION BY when all columns are blocked.
    Covers branch 842->840 (_is_blocked returns True in partition loop).
    """
    rules = {Table("employees"): {"department": CLSAction.HIDE}}
    sql = "SELECT name, COUNT(*) OVER (PARTITION BY department) as cnt FROM employees"
    result = apply_cls(sql, rules, engine="postgresql")

    # PARTITION BY should be removed entirely
    assert "PARTITION BY" not in result
    assert "OVER ()" in result


def test_apply_cls_window_order_all_blocked() -> None:
    """
    Test CLS removes window ORDER BY when all columns are blocked.
    Covers line 861 (window.set("order", None)) and branch 856->849.
    """
    rules = {Table("employees"): {"salary": CLSAction.HIDE}}
    sql = "SELECT name, RANK() OVER (ORDER BY salary) as rank FROM employees"
    result = apply_cls(sql, rules, engine="postgresql")

    # ORDER BY should be removed from window
    assert "ORDER BY" not in result
    assert "OVER ()" in result


def test_apply_cls_arithmetic_expression_hide() -> None:
    """
    Test CLS HIDE in arithmetic expression replaces column with NULL.
    """
    rules = {Table("products"): {"price": CLSAction.HIDE}}
    sql = "SELECT name, price * 1.1 as price_with_tax FROM products"
    result = apply_cls(sql, rules, engine="postgresql")

    # price should be replaced with NULL
    assert "NULL * 1.1" in result or "NULL" in result


def test_apply_cls_concat_function_hide() -> None:
    """
    Test CLS HIDE in CONCAT function replaces column with NULL.
    """
    rules = {Table("users"): {"ssn": CLSAction.HIDE}}
    sql = "SELECT CONCAT('SSN: ', ssn) as display FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # ssn should be replaced with NULL
    assert "NULL" in result


def test_apply_cls_where_no_rules_unchanged() -> None:
    """
    Test that WHERE clause without matching rules remains unchanged.
    """
    rules = {Table("other_table"): {"col": CLSAction.HASH}}
    sql = "SELECT name FROM users WHERE active = true"
    result = apply_cls(sql, rules, engine="postgresql")

    # No transformation should occur - just column qualification
    assert "WHERE" in result
    assert 'MD5' not in result
    assert 'FALSE' not in result


def test_apply_cls_table_with_schema() -> None:
    """
    Test CLS rules with Table containing schema.

    Rules with schema specified require the table in scope to match.
    Since queries often resolve to just the table name without schema,
    we match by table name when the rule doesn't specify schema.
    """
    # Rule without schema matches any table with that name
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    sql = "SELECT ssn FROM public.users"
    result = apply_cls(sql, rules, engine="postgresql")

    # Should apply the hash since table name matches
    assert "MD5" in result


def test_apply_cls_table_key_matching() -> None:
    """
    Test CLS rules match by table name when schema is not in query scope.

    The scope_tables dict maps aliases to table names. When the query
    has a schema-qualified table, the transformer still uses the table name.
    """
    rules = {Table("users"): {"ssn": CLSAction.HASH}}
    sql = "SELECT ssn FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # Should apply the hash since table name matches
    assert "MD5" in result


def test_apply_cls_table_with_schema_rule() -> None:
    """
    Test CLS rules with Table(table, schema) pattern.
    """
    rules = {Table("users", schema="public"): {"ssn": CLSAction.HASH}}
    sql = "SELECT ssn FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # Rule has schema but query doesn't - should match by table name fallback
    assert "MD5" in result


def test_apply_cls_table_with_schema_case_insensitive() -> None:
    """
    Test CLS rules with Table(table, schema) are case-insensitive.
    """
    rules = {Table("USERS", schema="PUBLIC"): {"SSN": CLSAction.HASH}}
    sql = "SELECT ssn FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # Should match despite case differences
    assert "MD5" in result


def test_apply_cls_table_with_schema_multiple_tables() -> None:
    """
    Test CLS rules with Table(table, schema) for multiple tables.
    """
    rules = {
        Table("users", schema="public"): {"ssn": CLSAction.HASH},
        Table("accounts", schema="finance"): {"balance": CLSAction.NULLIFY},
    }
    sql = """
    SELECT u.ssn, a.balance
    FROM users u
    JOIN accounts a ON u.id = a.user_id
    """
    result = apply_cls(sql, rules, engine="postgresql")

    # Both rules should be applied
    assert "MD5" in result
    assert "NULL" in result


def test_apply_cls_table_with_catalog_and_schema_rule() -> None:
    """
    Test CLS rules with Table(table, schema, catalog) pattern.
    """
    rules = {Table("users", schema="public", catalog="mydb"): {"ssn": CLSAction.HASH}}
    sql = "SELECT ssn FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # Rule has catalog/schema but query doesn't - should match by table name fallback
    assert "MD5" in result


def test_apply_cls_table_with_catalog_and_schema_case_insensitive() -> None:
    """
    Test CLS rules with Table(table, schema, catalog) are case-insensitive.
    """
    rules = {Table("USERS", schema="PUBLIC", catalog="MYDB"): {"SSN": CLSAction.MASK}}
    sql = "SELECT ssn FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # Should match despite case differences
    assert "'****'" in result


def test_apply_cls_table_with_catalog_schema_multiple_actions() -> None:
    """
    Test CLS rules with Table(table, schema, catalog) and multiple actions.
    """
    rules = {
        Table("employees", schema="hr", catalog="corp"): {
            "ssn": CLSAction.HASH,
            "salary": CLSAction.NULLIFY,
            "phone": CLSAction.MASK,
            "password": CLSAction.HIDE,
        }
    }
    sql = "SELECT ssn, salary, phone, password, name FROM employees"
    result = apply_cls(sql, rules, engine="postgresql")

    # Verify all actions applied
    assert "MD5" in result  # HASH
    assert "NULL" in result  # NULLIFY
    assert "'****'" in result  # MASK
    assert "password" not in result.lower() or "password" not in result.split("SELECT")[1].split("FROM")[0]  # HIDE


def test_apply_cls_table_with_schema_in_predicate() -> None:
    """
    Test CLS rules with Table(table, schema) also transform predicates.
    """
    rules = {Table("payroll", schema="hr"): {"role": CLSAction.HASH}}
    sql = "SELECT MAX(salary) FROM payroll WHERE role = 'CEO'"
    result = apply_cls(sql, rules, engine="postgresql")

    # Both SELECT and WHERE should have the column hashed
    assert "MD5" in result
    assert "WHERE" in result


def test_apply_cls_table_with_catalog_schema_in_predicate() -> None:
    """
    Test CLS rules with Table(table, schema, catalog) also transform predicates.
    """
    rules = {Table("payroll", schema="hr", catalog="corp"): {"salary": CLSAction.NULLIFY}}
    sql = "SELECT salary, name FROM payroll WHERE salary > 100000"
    result = apply_cls(sql, rules, engine="postgresql")

    # SELECT should have NULL (for salary), WHERE should have FALSE
    assert "NULL" in result
    assert "FALSE" in result


def test_apply_cls_table_schema_no_match_different_table() -> None:
    """
    Test CLS rules with Table(table, schema) don't match different table names.
    """
    rules = {Table("employees", schema="hr"): {"ssn": CLSAction.HASH}}
    sql = "SELECT ssn FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # Should NOT apply - table name doesn't match
    assert "MD5" not in result


def test_apply_cls_table_catalog_schema_no_match_different_table() -> None:
    """
    Test CLS rules with Table(table, schema, catalog) don't match different table names.
    """
    rules = {Table("employees", schema="hr", catalog="corp"): {"ssn": CLSAction.HASH}}
    sql = "SELECT ssn FROM users"
    result = apply_cls(sql, rules, engine="postgresql")

    # Should NOT apply - table name doesn't match
    assert "MD5" not in result


def test_apply_cls_mixed_table_rules() -> None:
    """
    Test CLS with a mix of Table rules: some with schema/catalog, some without.
    """
    rules = {
        Table("users"): {"email": CLSAction.MASK},  # No schema/catalog
        Table("employees", schema="hr"): {"ssn": CLSAction.HASH},  # With schema
        Table("payroll", schema="finance", catalog="corp"): {"salary": CLSAction.NULLIFY},  # With both
    }
    sql = """
    SELECT u.email, e.ssn, p.salary
    FROM users u
    JOIN employees e ON u.id = e.user_id
    JOIN payroll p ON e.id = p.employee_id
    """
    result = apply_cls(sql, rules, engine="postgresql")

    # All three rules should be applied
    assert "'****'" in result  # MASK for email
    assert "MD5" in result  # HASH for ssn
    assert "NULL" in result  # NULLIFY for salary


def test_cls_transformer_normalize_rules_with_schema() -> None:
    """
    Test CLSTransformer normalizes Table with schema to lowercase.
    """
    rules = {Table("USERS", schema="PUBLIC"): {"SSN": CLSAction.HASH}}
    transformer = CLSTransformer(rules, Dialects.POSTGRES)

    # Check that normalized Table key exists
    normalized_key = Table("users", schema="public")
    assert normalized_key in transformer.rules
    assert "ssn" in transformer.rules[normalized_key]


def test_cls_transformer_normalize_rules_with_catalog_and_schema() -> None:
    """
    Test CLSTransformer normalizes Table with catalog and schema to lowercase.
    """
    rules = {Table("USERS", schema="PUBLIC", catalog="MYDB"): {"SSN": CLSAction.HASH}}
    transformer = CLSTransformer(rules, Dialects.POSTGRES)

    # Check that normalized Table key exists
    normalized_key = Table("users", schema="public", catalog="mydb")
    assert normalized_key in transformer.rules
    assert "ssn" in transformer.rules[normalized_key]


def test_cls_transformer_get_action_with_schema() -> None:
    """
    Test CLSTransformer._get_action with Table(table, schema).
    """
    rules = {Table("users", schema="public"): {"ssn": CLSAction.HASH}}
    transformer = CLSTransformer(rules, Dialects.POSTGRES)

    # Should match by table name (fallback behavior)
    assert transformer._get_action("users", "ssn") == CLSAction.HASH

    # Case insensitive
    assert transformer._get_action("USERS", "SSN") == CLSAction.HASH

    # Different table should not match
    assert transformer._get_action("employees", "ssn") is None


def test_cls_transformer_get_action_with_catalog_and_schema() -> None:
    """
    Test CLSTransformer._get_action with Table(table, schema, catalog).
    """
    rules = {Table("users", schema="public", catalog="mydb"): {"ssn": CLSAction.HASH}}
    transformer = CLSTransformer(rules, Dialects.POSTGRES)

    # Should match by table name (fallback behavior)
    assert transformer._get_action("users", "ssn") == CLSAction.HASH

    # Case insensitive
    assert transformer._get_action("USERS", "SSN") == CLSAction.HASH

    # Different table should not match
    assert transformer._get_action("employees", "ssn") is None


# Tests for merge_cls_rules and CLS_ACTION_PRECEDENCE
def test_cls_action_precedence() -> None:
    """
    Test CLS_ACTION_PRECEDENCE has correct ordering: HIDE > NULLIFY > MASK > HASH.
    """
    assert CLS_ACTION_PRECEDENCE[CLSAction.HIDE] > CLS_ACTION_PRECEDENCE[CLSAction.NULLIFY]
    assert CLS_ACTION_PRECEDENCE[CLSAction.NULLIFY] > CLS_ACTION_PRECEDENCE[CLSAction.MASK]
    assert CLS_ACTION_PRECEDENCE[CLSAction.MASK] > CLS_ACTION_PRECEDENCE[CLSAction.HASH]


def test_merge_cls_rules_empty() -> None:
    """
    Test merge_cls_rules with no arguments returns empty dict.
    """
    result = merge_cls_rules()
    assert result == {}


def test_merge_cls_rules_single() -> None:
    """
    Test merge_cls_rules with single rule set returns it unchanged.
    """
    rules = {Table("foo"): {"col1": CLSAction.HASH}}
    result = merge_cls_rules(rules)
    assert result == rules


def test_merge_cls_rules_no_conflict() -> None:
    """
    Test merge_cls_rules with non-conflicting rules.
    """
    rules1 = {Table("foo"): {"col1": CLSAction.HASH}}
    rules2 = {Table("foo"): {"col2": CLSAction.HIDE}}
    result = merge_cls_rules(rules1, rules2)

    assert result == {Table("foo"): {"col1": CLSAction.HASH, "col2": CLSAction.HIDE}}


def test_merge_cls_rules_different_tables() -> None:
    """
    Test merge_cls_rules with different tables.
    """
    rules1 = {Table("foo"): {"col1": CLSAction.HASH}}
    rules2 = {Table("bar"): {"col1": CLSAction.NULLIFY}}
    result = merge_cls_rules(rules1, rules2)

    assert result == {
        Table("foo"): {"col1": CLSAction.HASH},
        Table("bar"): {"col1": CLSAction.NULLIFY},
    }


def test_merge_cls_rules_conflict_nullify_over_hash() -> None:
    """
    Test merge_cls_rules keeps NULLIFY over HASH (stricter).
    """
    rules1 = {Table("foo"): {"col1": CLSAction.HASH}}
    rules2 = {Table("foo"): {"col1": CLSAction.NULLIFY}}
    result = merge_cls_rules(rules1, rules2)

    assert result == {Table("foo"): {"col1": CLSAction.NULLIFY}}


def test_merge_cls_rules_conflict_hide_over_nullify() -> None:
    """
    Test merge_cls_rules keeps HIDE over NULLIFY (stricter).
    """
    rules1 = {Table("foo"): {"col1": CLSAction.NULLIFY}}
    rules2 = {Table("foo"): {"col1": CLSAction.HIDE}}
    result = merge_cls_rules(rules1, rules2)

    assert result == {Table("foo"): {"col1": CLSAction.HIDE}}


def test_merge_cls_rules_conflict_mask_over_hash() -> None:
    """
    Test merge_cls_rules keeps MASK over HASH (stricter).
    """
    rules1 = {Table("foo"): {"col1": CLSAction.HASH}}
    rules2 = {Table("foo"): {"col1": CLSAction.MASK}}
    result = merge_cls_rules(rules1, rules2)

    assert result == {Table("foo"): {"col1": CLSAction.MASK}}


def test_merge_cls_rules_conflict_nullify_over_mask() -> None:
    """
    Test merge_cls_rules keeps NULLIFY over MASK (stricter).
    """
    rules1 = {Table("foo"): {"col1": CLSAction.MASK}}
    rules2 = {Table("foo"): {"col1": CLSAction.NULLIFY}}
    result = merge_cls_rules(rules1, rules2)

    assert result == {Table("foo"): {"col1": CLSAction.NULLIFY}}


def test_merge_cls_rules_keeps_stricter_regardless_of_order() -> None:
    """
    Test merge_cls_rules keeps stricter action regardless of input order.
    """
    rules1 = {Table("foo"): {"col1": CLSAction.NULLIFY}}
    rules2 = {Table("foo"): {"col1": CLSAction.HASH}}

    # NULLIFY is stricter than HASH, should be kept
    result = merge_cls_rules(rules1, rules2)
    assert result == {Table("foo"): {"col1": CLSAction.NULLIFY}}

    # Reverse order should produce same result
    result = merge_cls_rules(rules2, rules1)
    assert result == {Table("foo"): {"col1": CLSAction.NULLIFY}}


def test_merge_cls_rules_user_example() -> None:
    """
    Test merge_cls_rules with the user's example from requirements.

    Given:
      {Table("foo"): {"col1": CLSAction.NULLIFY}}
      {Table("foo"): {"col1": CLSAction.HASH, "col2": CLSAction.HIDE}}

    Should produce:
      {Table("foo"): {"col1": CLSAction.NULLIFY, "col2": CLSAction.HIDE}}
    """
    rules1 = {Table("foo"): {"col1": CLSAction.NULLIFY}}
    rules2 = {Table("foo"): {"col1": CLSAction.HASH, "col2": CLSAction.HIDE}}
    result = merge_cls_rules(rules1, rules2)

    assert result == {Table("foo"): {"col1": CLSAction.NULLIFY, "col2": CLSAction.HIDE}}


def test_merge_cls_rules_multiple_rule_sets() -> None:
    """
    Test merge_cls_rules with more than two rule sets.
    """
    rules1 = {Table("foo"): {"col1": CLSAction.HASH}}
    rules2 = {Table("foo"): {"col1": CLSAction.MASK, "col2": CLSAction.HASH}}
    rules3 = {Table("foo"): {"col1": CLSAction.NULLIFY, "col3": CLSAction.HIDE}}
    result = merge_cls_rules(rules1, rules2, rules3)

    assert result == {
        Table("foo"): {
            "col1": CLSAction.NULLIFY,  # NULLIFY is strictest
            "col2": CLSAction.HASH,
            "col3": CLSAction.HIDE,
        }
    }


def test_merge_cls_rules_with_schema() -> None:
    """
    Test merge_cls_rules with Table containing schema.
    """
    rules1 = {Table("users", schema="public"): {"ssn": CLSAction.HASH}}
    rules2 = {Table("users", schema="public"): {"ssn": CLSAction.HIDE, "email": CLSAction.MASK}}
    result = merge_cls_rules(rules1, rules2)

    assert result == {
        Table("users", schema="public"): {"ssn": CLSAction.HIDE, "email": CLSAction.MASK}
    }


def test_merge_cls_rules_with_catalog_and_schema() -> None:
    """
    Test merge_cls_rules with Table containing catalog and schema.
    """
    rules1 = {Table("users", schema="public", catalog="mydb"): {"ssn": CLSAction.MASK}}
    rules2 = {Table("users", schema="public", catalog="mydb"): {"ssn": CLSAction.NULLIFY}}
    result = merge_cls_rules(rules1, rules2)

    assert result == {
        Table("users", schema="public", catalog="mydb"): {"ssn": CLSAction.NULLIFY}
    }


def test_merge_cls_rules_different_schemas_same_table() -> None:
    """
    Test merge_cls_rules treats tables with different schemas as distinct.
    """
    rules1 = {Table("users", schema="public"): {"ssn": CLSAction.HASH}}
    rules2 = {Table("users", schema="private"): {"ssn": CLSAction.HIDE}}
    result = merge_cls_rules(rules1, rules2)

    # Should be two separate entries, not merged
    assert result == {
        Table("users", schema="public"): {"ssn": CLSAction.HASH},
        Table("users", schema="private"): {"ssn": CLSAction.HIDE},
    }


def test_merge_cls_rules_complex_scenario() -> None:
    """
    Test merge_cls_rules with a complex real-world scenario.
    """
    # Organization-wide rules (less strict)
    org_rules = {
        Table("employees"): {"ssn": CLSAction.HASH, "salary": CLSAction.MASK},
        Table("customers"): {"email": CLSAction.MASK},
    }

    # Department-specific rules (stricter for certain columns)
    dept_rules = {
        Table("employees"): {"ssn": CLSAction.HIDE, "phone": CLSAction.MASK},
        Table("customers"): {"email": CLSAction.HASH, "credit_card": CLSAction.HIDE},
    }

    # User-specific rules (even stricter)
    user_rules = {
        Table("employees"): {"salary": CLSAction.HIDE},
    }

    result = merge_cls_rules(org_rules, dept_rules, user_rules)

    assert result == {
        Table("employees"): {
            "ssn": CLSAction.HIDE,  # HIDE > HASH
            "salary": CLSAction.HIDE,  # HIDE > MASK
            "phone": CLSAction.MASK,
        },
        Table("customers"): {
            "email": CLSAction.MASK,  # MASK > HASH
            "credit_card": CLSAction.HIDE,
        },
    }
