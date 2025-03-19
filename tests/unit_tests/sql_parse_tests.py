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

from typing import Optional
from unittest.mock import Mock

import pytest
import sqlparse
from pytest_mock import MockerFixture
from sqlalchemy import text
from sqlparse.sql import Identifier, Token, TokenList
from sqlparse.tokens import Name

from superset.exceptions import (
    QueryClauseValidationException,
    SupersetSecurityException,
)
from superset.sql.parse import Table
from superset.sql_parse import (
    add_table_name,
    check_sql_functions_exist,
    extract_table_references,
    extract_tables_from_jinja_sql,
    get_rls_for_table,
    has_table_query,
    insert_rls_as_subquery,
    insert_rls_in_predicate,
    ParsedQuery,
    sanitize_clause,
    strip_comments_from_sql,
)


def extract_tables(query: str, engine: str = "base") -> set[Table]:
    """
    Helper function to extract tables referenced in a query.
    """
    return ParsedQuery(query, engine=engine).tables


def test_table() -> None:
    """
    Test the ``Table`` class and its string conversion.

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


def test_extract_tables() -> None:
    """
    Test that referenced tables are parsed correctly from the SQL.
    """
    assert extract_tables("SELECT * FROM tbname") == {Table("tbname")}
    assert extract_tables("SELECT * FROM tbname foo") == {Table("tbname")}
    assert extract_tables("SELECT * FROM tbname AS foo") == {Table("tbname")}

    # underscore
    assert extract_tables("SELECT * FROM tb_name") == {Table("tb_name")}

    # quotes
    assert extract_tables('SELECT * FROM "tbname"') == {Table("tbname")}

    # unicode
    assert extract_tables('SELECT * FROM "tb_name" WHERE city = "Lübeck"') == {
        Table("tb_name")
    }

    # columns
    assert extract_tables("SELECT field1, field2 FROM tb_name") == {Table("tb_name")}
    assert extract_tables("SELECT t1.f1, t2.f2 FROM t1, t2") == {
        Table("t1"),
        Table("t2"),
    }

    # named table
    assert extract_tables("SELECT a.date, a.field FROM left_table a LIMIT 10") == {
        Table("left_table")
    }

    assert extract_tables(
        "SELECT FROM (SELECT FROM forbidden_table) AS forbidden_table;"
    ) == {Table("forbidden_table")}

    assert extract_tables(
        "select * from (select * from forbidden_table) forbidden_table"
    ) == {Table("forbidden_table")}


def test_extract_tables_subselect() -> None:
    """
    Test that tables inside subselects are parsed correctly.
    """
    assert extract_tables(
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

    assert extract_tables(
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

    assert extract_tables(
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
    Test that parser works with ``SELECT``s used as expressions.
    """
    assert extract_tables("SELECT f1, (SELECT count(1) FROM t2) FROM t1") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables("SELECT f1, (SELECT count(1) FROM t2) as f2 FROM t1") == {
        Table("t1"),
        Table("t2"),
    }


def test_extract_tables_parenthesis() -> None:
    """
    Test that parenthesis are parsed correctly.
    """
    assert extract_tables("SELECT f1, (x + y) AS f2 FROM t1") == {Table("t1")}


def test_extract_tables_with_schema() -> None:
    """
    Test that schemas are parsed correctly.
    """
    assert extract_tables("SELECT * FROM schemaname.tbname") == {
        Table("tbname", "schemaname")
    }
    assert extract_tables('SELECT * FROM "schemaname"."tbname"') == {
        Table("tbname", "schemaname")
    }
    assert extract_tables('SELECT * FROM "schemaname"."tbname" foo') == {
        Table("tbname", "schemaname")
    }
    assert extract_tables('SELECT * FROM "schemaname"."tbname" AS foo') == {
        Table("tbname", "schemaname")
    }


def test_extract_tables_union() -> None:
    """
    Test that ``UNION`` queries work as expected.
    """
    assert extract_tables("SELECT * FROM t1 UNION SELECT * FROM t2") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables("SELECT * FROM t1 UNION ALL SELECT * FROM t2") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables("SELECT * FROM t1 INTERSECT ALL SELECT * FROM t2") == {
        Table("t1"),
        Table("t2"),
    }


def test_extract_tables_select_from_values() -> None:
    """
    Test that selecting from values returns no tables.
    """
    assert extract_tables("SELECT * FROM VALUES (13, 42)") == set()


def test_extract_tables_select_array() -> None:
    """
    Test that queries selecting arrays work as expected.
    """
    assert extract_tables(
        """
SELECT ARRAY[1, 2, 3] AS my_array
FROM t1 LIMIT 10
"""
    ) == {Table("t1")}


def test_extract_tables_select_if() -> None:
    """
    Test that queries with an ``IF`` work as expected.
    """
    assert extract_tables(
        """
SELECT IF(CARDINALITY(my_array) >= 3, my_array[3], NULL)
FROM t1 LIMIT 10
"""
    ) == {Table("t1")}


def test_extract_tables_with_catalog() -> None:
    """
    Test that catalogs are parsed correctly.
    """
    assert extract_tables("SELECT * FROM catalogname.schemaname.tbname") == {
        Table("tbname", "schemaname", "catalogname")
    }


def test_extract_tables_illdefined() -> None:
    """
    Test that ill-defined tables return an empty set.
    """
    with pytest.raises(SupersetSecurityException) as excinfo:
        extract_tables("SELECT * FROM schemaname.")
    assert (
        str(excinfo.value)
        == "You may have an error in your SQL statement. Error parsing near '.' at line 1:25"
    )

    with pytest.raises(SupersetSecurityException) as excinfo:
        extract_tables("SELECT * FROM catalogname.schemaname.")
    assert (
        str(excinfo.value)
        == "You may have an error in your SQL statement. Error parsing near '.' at line 1:37"
    )

    with pytest.raises(SupersetSecurityException) as excinfo:
        extract_tables("SELECT * FROM catalogname..")
    assert (
        str(excinfo.value)
        == "You may have an error in your SQL statement. Error parsing near '.' at line 1:27"
    )

    with pytest.raises(SupersetSecurityException) as excinfo:
        extract_tables('SELECT * FROM "tbname')
    assert (
        str(excinfo.value)
        == "You may have an error in your SQL statement. Unable to tokenize script"
    )

    # odd edge case that works
    assert extract_tables("SELECT * FROM catalogname..tbname") == {
        Table(table="tbname", schema=None, catalog="catalogname")
    }


def test_extract_tables_show_tables_from() -> None:
    """
    Test ``SHOW TABLES FROM``.
    """
    assert extract_tables("SHOW TABLES FROM s1 like '%order%'", "mysql") == set()


def test_extract_tables_show_columns_from() -> None:
    """
    Test ``SHOW COLUMNS FROM``.
    """
    assert extract_tables("SHOW COLUMNS FROM t1") == {Table("t1")}


def test_extract_tables_where_subquery() -> None:
    """
    Test that tables in a ``WHERE`` subquery are parsed correctly.
    """
    assert extract_tables(
        """
SELECT name
FROM t1
WHERE regionkey = (SELECT max(regionkey) FROM t2)
"""
    ) == {Table("t1"), Table("t2")}

    assert extract_tables(
        """
SELECT name
FROM t1
WHERE regionkey IN (SELECT regionkey FROM t2)
"""
    ) == {Table("t1"), Table("t2")}

    assert extract_tables(
        """
SELECT name
FROM t1
WHERE EXISTS (SELECT 1 FROM t2 WHERE t1.regionkey = t2.regionkey);
"""
    ) == {Table("t1"), Table("t2")}


def test_extract_tables_describe() -> None:
    """
    Test ``DESCRIBE``.
    """
    assert extract_tables("DESCRIBE t1") == {Table("t1")}


def test_extract_tables_show_partitions() -> None:
    """
    Test ``SHOW PARTITIONS``.
    """
    assert extract_tables(
        """
SHOW PARTITIONS FROM orders
WHERE ds >= '2013-01-01' ORDER BY ds DESC
"""
    ) == {Table("orders")}


def test_extract_tables_join() -> None:
    """
    Test joins.
    """
    assert extract_tables("SELECT t1.*, t2.* FROM t1 JOIN t2 ON t1.a = t2.a;") == {
        Table("t1"),
        Table("t2"),
    }

    assert extract_tables(
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

    assert extract_tables(
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

    assert extract_tables(
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

    assert extract_tables(
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
    Test ``LEFT SEMI JOIN``.
    """
    assert extract_tables(
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
    assert extract_tables(
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

    assert extract_tables(
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
    Test ``WITH``.
    """
    assert extract_tables(
        """
WITH
    x AS (SELECT a FROM t1),
    y AS (SELECT a AS b FROM t2),
    z AS (SELECT b AS c FROM t3)
SELECT c FROM z
"""
    ) == {Table("t1"), Table("t2"), Table("t3")}

    assert extract_tables(
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
    assert extract_tables(
        """
with q1 as ( select key from q2 where key = '5'),
q2 as ( select key from src where key = '5')
select * from (select key from q1) a
"""
    ) == {Table("src")}

    # weird query with circular dependency
    assert (
        extract_tables(
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
    assert extract_tables("SELECT * FROM t1; SELECT * FROM t2") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables("SELECT * FROM t1; SELECT * FROM t2;") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables(
        "ADD JAR file:///hive.jar; SELECT * FROM t1;",
        engine="hive",
    ) == {Table("t1")}


def test_extract_tables_complex() -> None:
    """
    Test a few complex queries.
    """
    assert extract_tables(
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

    assert extract_tables(
        """
SELECT *
FROM table_a AS a, table_b AS b, table_c as c
WHERE a.id = b.id and b.id = c.id
"""
    ) == {Table("table_a"), Table("table_b"), Table("table_c")}

    assert extract_tables(
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
    Test that the parser handles a ``FROM`` clause with table and subselect.
    """
    assert extract_tables(
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
    assert extract_tables(
        """
select (extractvalue(1,concat(0x7e,(select GROUP_CONCAT(TABLE_NAME)
from INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA like "%bi%"),0x7e)));
""",
        "mysql",
    ) == {Table("COLUMNS", "INFORMATION_SCHEMA")}

    assert extract_tables(
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
    assert extract_tables(
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
    assert extract_tables(
        """
WITH
    f AS (SELECT * FROM foo),
    match AS (SELECT * FROM f)
SELECT * FROM match
"""
    ) == {Table("foo")}


def test_update() -> None:
    """
    Test that ``UPDATE`` is not detected as ``SELECT``.
    """
    assert ParsedQuery("UPDATE t1 SET col1 = NULL").is_select() is False


def test_set() -> None:
    """
    Test that ``SET`` is detected correctly.
    """
    query = ParsedQuery(
        """
-- comment
SET hivevar:desc='Legislators';
"""
    )
    assert query.is_set() is True
    assert query.is_select() is False

    assert ParsedQuery("set hivevar:desc='bla'").is_set() is True
    assert ParsedQuery("SELECT 1").is_set() is False


def test_show() -> None:
    """
    Test that ``SHOW`` is detected correctly.
    """
    query = ParsedQuery(
        """
-- comment
SHOW LOCKS test EXTENDED;
-- comment
"""
    )
    assert query.is_show() is True
    assert query.is_select() is False

    assert ParsedQuery("SHOW TABLES").is_show() is True
    assert ParsedQuery("shOw TABLES").is_show() is True
    assert ParsedQuery("show TABLES").is_show() is True
    assert ParsedQuery("SELECT 1").is_show() is False


def test_is_explain() -> None:
    """
    Test that ``EXPLAIN`` is detected correctly.
    """
    assert ParsedQuery("EXPLAIN SELECT 1").is_explain() is True
    assert ParsedQuery("EXPLAIN SELECT 1").is_select() is False

    assert (
        ParsedQuery(
            """
-- comment
EXPLAIN select * from table
-- comment 2
"""
        ).is_explain()
        is True
    )

    assert (
        ParsedQuery(
            """
-- comment
EXPLAIN select * from table
where col1 = 'something'
-- comment 2

-- comment 3
EXPLAIN select * from table
where col1 = 'something'
-- comment 4
"""
        ).is_explain()
        is True
    )

    assert (
        ParsedQuery(
            """
-- This is a comment
    -- this is another comment but with a space in the front
EXPLAIN SELECT * FROM TABLE
"""
        ).is_explain()
        is True
    )

    assert (
        ParsedQuery(
            """
/* This is a comment
     with stars instead */
EXPLAIN SELECT * FROM TABLE
"""
        ).is_explain()
        is True
    )

    assert (
        ParsedQuery(
            """
-- comment
select * from table
where col1 = 'something'
-- comment 2
"""
        ).is_explain()
        is False
    )


def test_is_valid_ctas() -> None:
    """
    Test if a query is a valid CTAS.

    A valid CTAS has a ``SELECT`` as its last statement.
    """
    assert (
        ParsedQuery("SELECT * FROM table", strip_comments=True).is_valid_ctas() is True
    )

    assert (
        ParsedQuery(
            """
-- comment
SELECT * FROM table
-- comment 2
""",
            strip_comments=True,
        ).is_valid_ctas()
        is True
    )

    assert (
        ParsedQuery(
            """
-- comment
SET @value = 42;
SELECT @value as foo;
-- comment 2
""",
            strip_comments=True,
        ).is_valid_ctas()
        is True
    )

    assert (
        ParsedQuery(
            """
-- comment
EXPLAIN SELECT * FROM table
-- comment 2
""",
            strip_comments=True,
        ).is_valid_ctas()
        is False
    )

    assert (
        ParsedQuery(
            """
SELECT * FROM table;
INSERT INTO TABLE (foo) VALUES (42);
""",
            strip_comments=True,
        ).is_valid_ctas()
        is False
    )


def test_is_valid_cvas() -> None:
    """
    Test if a query is a valid CVAS.

    A valid CVAS has a single ``SELECT`` statement.
    """
    assert (
        ParsedQuery("SELECT * FROM table", strip_comments=True).is_valid_cvas() is True
    )

    assert (
        ParsedQuery(
            """
-- comment
SELECT * FROM table
-- comment 2
""",
            strip_comments=True,
        ).is_valid_cvas()
        is True
    )

    assert (
        ParsedQuery(
            """
-- comment
SET @value = 42;
SELECT @value as foo;
-- comment 2
""",
            strip_comments=True,
        ).is_valid_cvas()
        is False
    )

    assert (
        ParsedQuery(
            """
-- comment
EXPLAIN SELECT * FROM table
-- comment 2
""",
            strip_comments=True,
        ).is_valid_cvas()
        is False
    )

    assert (
        ParsedQuery(
            """
SELECT * FROM table;
INSERT INTO TABLE (foo) VALUES (42);
""",
            strip_comments=True,
        ).is_valid_cvas()
        is False
    )


def test_is_select_cte_with_comments() -> None:
    """
    Some CTES with comments are not correctly identified as SELECTS.
    """
    sql = ParsedQuery(
        """WITH blah AS
  (SELECT * FROM core_dev.manager_team),

blah2 AS
  (SELECT * FROM core_dev.manager_workspace)

SELECT * FROM blah
INNER JOIN blah2 ON blah2.team_id = blah.team_id"""
    )
    assert sql.is_select()

    sql = ParsedQuery(
        """WITH blah AS
/*blahblahbalh*/
  (SELECT * FROM core_dev.manager_team),
--blahblahbalh

blah2 AS
  (SELECT * FROM core_dev.manager_workspace)

SELECT * FROM blah
INNER JOIN blah2 ON blah2.team_id = blah.team_id"""
    )
    assert sql.is_select()


def test_cte_is_select() -> None:
    """
    Some CTEs are not correctly identified as SELECTS.
    """
    # `AS(` gets parsed as a function
    sql = ParsedQuery(
        """WITH foo AS(
SELECT
  FLOOR(__time TO WEEK) AS "week",
  name,
  COUNT(DISTINCT user_id) AS "unique_users"
FROM "druid"."my_table"
GROUP BY 1,2
)
SELECT
  f.week,
  f.name,
  f.unique_users
FROM foo f"""
    )
    assert sql.is_select()


def test_cte_is_select_lowercase() -> None:
    """
    Some CTEs with lowercase select are not correctly identified as SELECTS.
    """
    sql = ParsedQuery(
        """WITH foo AS(
select
  FLOOR(__time TO WEEK) AS "week",
  name,
  COUNT(DISTINCT user_id) AS "unique_users"
FROM "druid"."my_table"
GROUP BY 1,2
)
select
  f.week,
  f.name,
  f.unique_users
FROM foo f"""
    )
    assert sql.is_select()


def test_cte_insert_is_not_select() -> None:
    """
    Some CTEs with lowercase select are not correctly identified as SELECTS.
    """
    sql = ParsedQuery(
        """WITH foo AS(
        INSERT INTO foo (id) VALUES (1) RETURNING 1
        ) select * FROM foo f"""
    )
    assert sql.is_select() is False


def test_cte_delete_is_not_select() -> None:
    """
    Some CTEs with lowercase select are not correctly identified as SELECTS.
    """
    sql = ParsedQuery(
        """WITH foo AS(
        DELETE FROM foo RETURNING *
        ) select * FROM foo f"""
    )
    assert sql.is_select() is False


def test_cte_is_not_select_lowercase() -> None:
    """
    Some CTEs with lowercase select are not correctly identified as SELECTS.
    """
    sql = ParsedQuery(
        """WITH foo AS(
        insert into foo (id) values (1) RETURNING 1
        ) select * FROM foo f"""
    )
    assert sql.is_select() is False


def test_cte_with_multiple_selects() -> None:
    sql = ParsedQuery(
        "WITH a AS ( select * from foo1 ), b as (select * from foo2) SELECT * FROM a;"
    )
    assert sql.is_select()


def test_cte_with_multiple_with_non_select() -> None:
    sql = ParsedQuery(
        """WITH a AS (
        select * from foo1
        ), b as (
        update foo2 set id=2
        ) SELECT * FROM a"""
    )
    assert sql.is_select() is False
    sql = ParsedQuery(
        """WITH a AS (
         update foo2 set name=2
         ),
        b as (
        select * from foo1
        ) SELECT * FROM a"""
    )
    assert sql.is_select() is False
    sql = ParsedQuery(
        """WITH a AS (
         update foo2 set name=2
         ),
        b as (
        update foo1 set name=2
        ) SELECT * FROM a"""
    )
    assert sql.is_select() is False
    sql = ParsedQuery(
        """WITH a AS (
        INSERT INTO foo (id) VALUES (1)
        ),
        b as (
        select 1
        ) SELECT * FROM a"""
    )
    assert sql.is_select() is False


def test_unknown_select() -> None:
    """
    Test that `is_select` works when sqlparse fails to identify the type.
    """
    sql = "WITH foo AS(SELECT 1) SELECT 1"
    assert sqlparse.parse(sql)[0].get_type() == "SELECT"
    assert ParsedQuery(sql).is_select()

    sql = "WITH foo AS(SELECT 1) INSERT INTO my_table (a) VALUES (1)"
    assert sqlparse.parse(sql)[0].get_type() == "INSERT"
    assert not ParsedQuery(sql).is_select()

    sql = "WITH foo AS(SELECT 1) DELETE FROM my_table"
    assert sqlparse.parse(sql)[0].get_type() == "DELETE"
    assert not ParsedQuery(sql).is_select()


def test_get_query_with_new_limit_comment() -> None:
    """
    Test that limit is applied correctly.
    """
    query = ParsedQuery("SELECT * FROM birth_names -- SOME COMMENT")
    assert query.set_or_update_query_limit(1000) == (
        "SELECT * FROM birth_names -- SOME COMMENT\nLIMIT 1000"
    )


def test_get_query_with_new_limit_comment_with_limit() -> None:
    """
    Test that limits in comments are ignored.
    """
    query = ParsedQuery("SELECT * FROM birth_names -- SOME COMMENT WITH LIMIT 555")
    assert query.set_or_update_query_limit(1000) == (
        "SELECT * FROM birth_names -- SOME COMMENT WITH LIMIT 555\nLIMIT 1000"
    )


def test_get_query_with_new_limit_lower() -> None:
    """
    Test that lower limits are not replaced.
    """
    query = ParsedQuery("SELECT * FROM birth_names LIMIT 555")
    assert query.set_or_update_query_limit(1000) == (
        "SELECT * FROM birth_names LIMIT 555"
    )


def test_get_query_with_new_limit_upper() -> None:
    """
    Test that higher limits are replaced.
    """
    query = ParsedQuery("SELECT * FROM birth_names LIMIT 2000")
    assert query.set_or_update_query_limit(1000) == (
        "SELECT * FROM birth_names LIMIT 1000"
    )


def test_basic_breakdown_statements() -> None:
    """
    Test that multiple statements are parsed correctly.
    """
    query = ParsedQuery(
        """
SELECT * FROM birth_names;
SELECT * FROM birth_names LIMIT 1;
"""
    )
    assert query.get_statements() == [
        "SELECT * FROM birth_names",
        "SELECT * FROM birth_names LIMIT 1",
    ]


def test_messy_breakdown_statements() -> None:
    """
    Test the messy multiple statements are parsed correctly.
    """
    query = ParsedQuery(
        """
SELECT 1;\t\n\n\n  \t
\t\nSELECT 2;
SELECT * FROM birth_names;;;
SELECT * FROM birth_names LIMIT 1
"""
    )
    assert query.get_statements() == [
        "SELECT 1",
        "SELECT 2",
        "SELECT * FROM birth_names",
        "SELECT * FROM birth_names LIMIT 1",
    ]


def test_sqlparse_formatting():
    """
    Test that ``from_unixtime`` is formatted correctly.
    """
    assert sqlparse.format(
        "SELECT extract(HOUR from from_unixtime(hour_ts) "
        "AT TIME ZONE 'America/Los_Angeles') from table",
        reindent=True,
    ) == (
        "SELECT extract(HOUR\n               from from_unixtime(hour_ts) "
        "AT TIME ZONE 'America/Los_Angeles')\nfrom table"
    )


def test_strip_comments_from_sql() -> None:
    """
    Test that comments are stripped out correctly.
    """
    assert (
        strip_comments_from_sql("SELECT col1, col2 FROM table1")
        == "SELECT col1, col2 FROM table1"
    )
    assert (
        strip_comments_from_sql("SELECT col1, col2 FROM table1\n-- comment")
        == "SELECT col1, col2 FROM table1\n"
    )
    assert (
        strip_comments_from_sql("SELECT '--abc' as abc, col2 FROM table1\n")
        == "SELECT '--abc' as abc, col2 FROM table1"
    )


def test_check_sql_functions_exist() -> None:
    """
    Test that comments are stripped out correctly.
    """
    assert not (
        check_sql_functions_exist("select a, b from version", {"version"}, "postgresql")
    )

    assert check_sql_functions_exist("select version()", {"version"}, "postgresql")

    assert check_sql_functions_exist(
        "select version from version()", {"version"}, "postgresql"
    )

    assert check_sql_functions_exist(
        "select 1, a.version from (select version from version()) as a",
        {"version"},
        "postgresql",
    )

    assert check_sql_functions_exist(
        "select 1, a.version from (select version()) as a", {"version"}, "postgresql"
    )


def test_sanitize_clause_valid():
    # regular clauses
    assert sanitize_clause("col = 1") == "col = 1"
    assert sanitize_clause("1=\t\n1") == "1=\t\n1"
    assert sanitize_clause("(col = 1)") == "(col = 1)"
    assert sanitize_clause("(col1 = 1) AND (col2 = 2)") == "(col1 = 1) AND (col2 = 2)"
    assert sanitize_clause("col = 'abc' -- comment") == "col = 'abc' -- comment\n"

    # Valid literal values that at could be flagged as invalid by a naive query parser
    assert (
        sanitize_clause("col = 'col1 = 1) AND (col2 = 2'")
        == "col = 'col1 = 1) AND (col2 = 2'"
    )
    assert sanitize_clause("col = 'select 1; select 2'") == "col = 'select 1; select 2'"
    assert sanitize_clause("col = 'abc -- comment'") == "col = 'abc -- comment'"


def test_sanitize_clause_closing_unclosed():
    with pytest.raises(QueryClauseValidationException):
        sanitize_clause("col1 = 1) AND (col2 = 2)")


def test_sanitize_clause_unclosed():
    with pytest.raises(QueryClauseValidationException):
        sanitize_clause("(col1 = 1) AND (col2 = 2")


def test_sanitize_clause_closing_and_unclosed():
    with pytest.raises(QueryClauseValidationException):
        sanitize_clause("col1 = 1) AND (col2 = 2")


def test_sanitize_clause_closing_and_unclosed_nested():
    with pytest.raises(QueryClauseValidationException):
        sanitize_clause("(col1 = 1)) AND ((col2 = 2)")


def test_sanitize_clause_multiple():
    with pytest.raises(QueryClauseValidationException):
        sanitize_clause("TRUE; SELECT 1")


def test_sqlparse_issue_652():
    stmt = sqlparse.parse(r"foo = '\' AND bar = 'baz'")[0]
    assert len(stmt.tokens) == 5
    assert str(stmt.tokens[0]) == "foo = '\\'"


@pytest.mark.parametrize(
    ("engine", "sql", "expected"),
    [
        ("postgresql", "extract(HOUR from from_unixtime(hour_ts))", False),
        ("postgresql", "SELECT * FROM table", True),
        ("postgresql", "(SELECT * FROM table)", True),
        (
            "postgresql",
            "SELECT a FROM (SELECT 1 AS a) JOIN (SELECT * FROM table)",
            True,
        ),
        (
            "postgresql",
            "(SELECT COUNT(DISTINCT name) AS foo FROM    birth_names)",
            True,
        ),
        ("postgresql", "COUNT(*)", False),
        ("postgresql", "SELECT a FROM (SELECT 1 AS a)", False),
        ("postgresql", "SELECT a FROM (SELECT 1 AS a) JOIN table", True),
        (
            "postgresql",
            "SELECT * FROM (SELECT 1 AS foo, 2 AS bar) ORDER BY foo ASC, bar",
            False,
        ),
        ("postgresql", "SELECT * FROM other_table", True),
        ("postgresql", "(SELECT COUNT(DISTINCT name) from birth_names)", True),
        (
            "postgresql",
            "(SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%user%' LIMIT 1)",
            True,
        ),
        (
            "postgresql",
            "(SELECT table_name FROM /**/ information_schema.tables WHERE table_name LIKE '%user%' LIMIT 1)",
            True,
        ),
        (
            "postgresql",
            "SELECT FROM (SELECT FROM forbidden_table) AS forbidden_table;",
            True,
        ),
        (
            "postgresql",
            "SELECT * FROM (SELECT * FROM forbidden_table) forbidden_table",
            True,
        ),
        (
            "postgresql",
            "((select users.id from (select 'majorie' as a) b, users where b.a = users.name and users.name in ('majorie') limit 1) like 'U%')",
            True,
        ),
    ],
)
def test_has_table_query(engine: str, sql: str, expected: bool) -> None:
    """
    Test if a given statement queries a table.

    This is used to prevent ad-hoc metrics from querying unauthorized tables, bypassing
    row-level security.
    """
    assert has_table_query(sql, engine) == expected


@pytest.mark.parametrize(
    "sql,table,rls,expected",
    [
        # Basic test
        (
            "SELECT * FROM some_table WHERE 1=1",
            "some_table",
            "id=42",
            (
                "SELECT * FROM (SELECT * FROM some_table WHERE some_table.id=42) "
                "AS some_table WHERE 1=1"
            ),
        ),
        # Here "table" is a reserved word; since sqlparse is too aggressive when
        # characterizing reserved words we need to support them even when not quoted.
        (
            "SELECT * FROM table WHERE 1=1",
            "table",
            "id=42",
            "SELECT * FROM (SELECT * FROM table WHERE table.id=42) AS table WHERE 1=1",
        ),
        # RLS is only applied to queries reading from the associated table
        (
            "SELECT * FROM table WHERE 1=1",
            "other_table",
            "id=42",
            "SELECT * FROM table WHERE 1=1",
        ),
        (
            "SELECT * FROM other_table WHERE 1=1",
            "table",
            "id=42",
            "SELECT * FROM other_table WHERE 1=1",
        ),
        # JOINs are supported
        (
            "SELECT * FROM table JOIN other_table ON table.id = other_table.id",
            "other_table",
            "id=42",
            (
                "SELECT * FROM table JOIN "
                "(SELECT * FROM other_table WHERE other_table.id=42) AS other_table "
                "ON table.id = other_table.id"
            ),
        ),
        # Subqueries
        (
            "SELECT * FROM (SELECT * FROM other_table)",
            "other_table",
            "id=42",
            (
                "SELECT * FROM (SELECT * FROM ("
                "SELECT * FROM other_table WHERE other_table.id=42"
                ") AS other_table)"
            ),
        ),
        # UNION
        (
            "SELECT * FROM table UNION ALL SELECT * FROM other_table",
            "table",
            "id=42",
            (
                "SELECT * FROM (SELECT * FROM table WHERE table.id=42) AS table "
                "UNION ALL SELECT * FROM other_table"
            ),
        ),
        (
            "SELECT * FROM table UNION ALL SELECT * FROM other_table",
            "other_table",
            "id=42",
            (
                "SELECT * FROM table UNION ALL SELECT * FROM ("
                "SELECT * FROM other_table WHERE other_table.id=42) AS other_table"
            ),
        ),
        #  When comparing fully qualified table names (eg, schema.table) to simple names
        # (eg, table) we are also conservative, assuming the schema is the same, since
        # we don't have information on the default schema.
        (
            "SELECT * FROM schema.table_name",
            "table_name",
            "id=42",
            (
                "SELECT * FROM (SELECT * FROM schema.table_name "
                "WHERE table_name.id=42) AS table_name"
            ),
        ),
        (
            "SELECT * FROM schema.table_name",
            "schema.table_name",
            "id=42",
            (
                "SELECT * FROM (SELECT * FROM schema.table_name "
                "WHERE schema.table_name.id=42) AS table_name"
            ),
        ),
        (
            "SELECT * FROM table_name",
            "schema.table_name",
            "id=42",
            (
                "SELECT * FROM (SELECT * FROM table_name WHERE "
                "schema.table_name.id=42) AS table_name"
            ),
        ),
        # Aliases
        (
            "SELECT a.*, b.* FROM tbl_a AS a INNER JOIN tbl_b AS b ON a.col = b.col",
            "tbl_a",
            "id=42",
            (
                "SELECT a.*, b.* FROM "
                "(SELECT * FROM tbl_a WHERE tbl_a.id=42) AS a "
                "INNER JOIN tbl_b AS b "
                "ON a.col = b.col"
            ),
        ),
        (
            "SELECT a.*, b.* FROM tbl_a a INNER JOIN tbl_b b ON a.col = b.col",
            "tbl_a",
            "id=42",
            (
                "SELECT a.*, b.* FROM "
                "(SELECT * FROM tbl_a WHERE tbl_a.id=42) AS a "
                "INNER JOIN tbl_b b ON a.col = b.col"
            ),
        ),
    ],
)
def test_insert_rls_as_subquery(
    mocker: MockerFixture, sql: str, table: str, rls: str, expected: str
) -> None:
    """
    Insert into a statement a given RLS condition associated with a table.
    """
    condition = sqlparse.parse(rls)[0]
    add_table_name(condition, table)

    # pylint: disable=unused-argument
    def get_rls_for_table(
        candidate: Token,
        database_id: int,
        default_schema: str,
    ) -> Optional[TokenList]:
        """
        Return the RLS ``condition`` if ``candidate`` matches ``table``.
        """
        if not isinstance(candidate, Identifier):
            candidate = Identifier([Token(Name, candidate.value)])

        candidate_table = ParsedQuery.get_table(candidate)
        if not candidate_table:
            return None
        candidate_table_name = (
            f"{candidate_table.schema}.{candidate_table.table}"
            if candidate_table.schema
            else candidate_table.table
        )
        for left, right in zip(
            candidate_table_name.split(".")[::-1], table.split(".")[::-1]
        ):
            if left != right:
                return None
        return condition

    mocker.patch("superset.sql_parse.get_rls_for_table", new=get_rls_for_table)

    statement = sqlparse.parse(sql)[0]
    assert (
        str(
            insert_rls_as_subquery(
                token_list=statement, database_id=1, default_schema="my_schema"
            )
        ).strip()
        == expected.strip()
    )


@pytest.mark.parametrize(
    "sql,table,rls,expected",
    [
        # Basic test: append RLS (some_table.id=42) to an existing WHERE clause.
        (
            "SELECT * FROM some_table WHERE 1=1",
            "some_table",
            "id=42",
            "SELECT * FROM some_table WHERE ( 1=1) AND some_table.id=42",
        ),
        # Any existing predicates MUST to be wrapped in parenthesis because AND has higher
        # precedence than OR. If the RLS it `1=0` and we didn't add parenthesis a user
        # could bypass it by crafting a query with `WHERE TRUE OR FALSE`, since
        # `WHERE TRUE OR FALSE AND 1=0` evaluates to `WHERE TRUE OR (FALSE AND 1=0)`.
        (
            "SELECT * FROM some_table WHERE TRUE OR FALSE",
            "some_table",
            "1=0",
            "SELECT * FROM some_table WHERE ( TRUE OR FALSE) AND 1=0",
        ),
        # Here "table" is a reserved word; since sqlparse is too aggressive when
        # characterizing reserved words we need to support them even when not quoted.
        (
            "SELECT * FROM table WHERE 1=1",
            "table",
            "id=42",
            "SELECT * FROM table WHERE ( 1=1) AND table.id=42",
        ),
        # RLS is only applied to queries reading from the associated table.
        (
            "SELECT * FROM table WHERE 1=1",
            "other_table",
            "id=42",
            "SELECT * FROM table WHERE 1=1",
        ),
        (
            "SELECT * FROM other_table WHERE 1=1",
            "table",
            "id=42",
            "SELECT * FROM other_table WHERE 1=1",
        ),
        # If there's no pre-existing WHERE clause we create one.
        (
            "SELECT * FROM table",
            "table",
            "id=42",
            "SELECT * FROM table WHERE table.id=42",
        ),
        (
            "SELECT * FROM some_table",
            "some_table",
            "id=42",
            "SELECT * FROM some_table WHERE some_table.id=42",
        ),
        (
            "SELECT * FROM table ORDER BY id",
            "table",
            "id=42",
            "SELECT * FROM table  WHERE table.id=42 ORDER BY id",
        ),
        (
            "SELECT * FROM some_table;",
            "some_table",
            "id=42",
            "SELECT * FROM some_table WHERE some_table.id=42 ;",
        ),
        (
            "SELECT * FROM some_table       ;",
            "some_table",
            "id=42",
            "SELECT * FROM some_table        WHERE some_table.id=42 ;",
        ),
        (
            "SELECT * FROM some_table       ",
            "some_table",
            "id=42",
            "SELECT * FROM some_table        WHERE some_table.id=42",
        ),
        # We add the RLS even if it's already present, to be conservative. It should have
        # no impact on the query, and it's easier than testing if the RLS is already
        # present (it could be present in an OR clause, eg).
        (
            "SELECT * FROM table WHERE 1=1 AND table.id=42",
            "table",
            "id=42",
            "SELECT * FROM table WHERE ( 1=1 AND table.id=42) AND table.id=42",
        ),
        (
            (
                "SELECT * FROM table JOIN other_table ON "
                "table.id = other_table.id AND other_table.id=42"
            ),
            "other_table",
            "id=42",
            (
                "SELECT * FROM table JOIN other_table ON other_table.id=42 "
                "AND ( table.id = other_table.id AND other_table.id=42 )"
            ),
        ),
        (
            "SELECT * FROM table WHERE 1=1 AND id=42",
            "table",
            "id=42",
            "SELECT * FROM table WHERE ( 1=1 AND id=42) AND table.id=42",
        ),
        # For joins we apply the RLS to the ON clause, since it's easier and prevents
        # leaking information about number of rows on OUTER JOINs.
        (
            "SELECT * FROM table JOIN other_table ON table.id = other_table.id",
            "other_table",
            "id=42",
            (
                "SELECT * FROM table JOIN other_table ON other_table.id=42 "
                "AND ( table.id = other_table.id )"
            ),
        ),
        (
            (
                "SELECT * FROM table JOIN other_table ON table.id = other_table.id "
                "WHERE 1=1"
            ),
            "other_table",
            "id=42",
            (
                "SELECT * FROM table JOIN other_table ON other_table.id=42 "
                "AND ( table.id = other_table.id  ) WHERE 1=1"
            ),
        ),
        # Subqueries also work, as expected.
        (
            "SELECT * FROM (SELECT * FROM other_table)",
            "other_table",
            "id=42",
            "SELECT * FROM (SELECT * FROM other_table WHERE other_table.id=42 )",
        ),
        # As well as UNION.
        (
            "SELECT * FROM table UNION ALL SELECT * FROM other_table",
            "table",
            "id=42",
            "SELECT * FROM table  WHERE table.id=42 UNION ALL SELECT * FROM other_table",
        ),
        (
            "SELECT * FROM table UNION ALL SELECT * FROM other_table",
            "other_table",
            "id=42",
            (
                "SELECT * FROM table UNION ALL "
                "SELECT * FROM other_table WHERE other_table.id=42"
            ),
        ),
        # When comparing fully qualified table names (eg, schema.table) to simple names
        # (eg, table) we are also conservative, assuming the schema is the same, since
        # we don't have information on the default schema.
        (
            "SELECT * FROM schema.table_name",
            "table_name",
            "id=42",
            "SELECT * FROM schema.table_name WHERE table_name.id=42",
        ),
        (
            "SELECT * FROM schema.table_name",
            "schema.table_name",
            "id=42",
            "SELECT * FROM schema.table_name WHERE schema.table_name.id=42",
        ),
        (
            "SELECT * FROM table_name",
            "schema.table_name",
            "id=42",
            "SELECT * FROM table_name WHERE schema.table_name.id=42",
        ),
    ],
)
def test_insert_rls_in_predicate(
    mocker: MockerFixture, sql: str, table: str, rls: str, expected: str
) -> None:
    """
    Insert into a statement a given RLS condition associated with a table.
    """
    condition = sqlparse.parse(rls)[0]
    add_table_name(condition, table)

    # pylint: disable=unused-argument
    def get_rls_for_table(
        candidate: Token,
        database_id: int,
        default_schema: str,
    ) -> Optional[TokenList]:
        """
        Return the RLS ``condition`` if ``candidate`` matches ``table``.
        """
        # compare ignoring schema
        for left, right in zip(str(candidate).split(".")[::-1], table.split(".")[::-1]):
            if left != right:
                return None
        return condition

    mocker.patch("superset.sql_parse.get_rls_for_table", new=get_rls_for_table)

    statement = sqlparse.parse(sql)[0]
    assert (
        str(
            insert_rls_in_predicate(
                token_list=statement,
                database_id=1,
                default_schema="my_schema",
            )
        ).strip()
        == expected.strip()
    )


@pytest.mark.parametrize(
    "rls,table,expected",
    [
        ("id=42", "users", "users.id=42"),
        ("users.id=42", "users", "users.id=42"),
        ("schema.users.id=42", "users", "schema.users.id=42"),
        ("false", "users", "false"),
    ],
)
def test_add_table_name(rls: str, table: str, expected: str) -> None:
    condition = sqlparse.parse(rls)[0]
    add_table_name(condition, table)
    assert str(condition) == expected


def test_get_rls_for_table(mocker: MockerFixture) -> None:
    """
    Tests for ``get_rls_for_table``.
    """
    candidate = Identifier([Token(Name, "some_table")])
    dataset = mocker.patch("superset.db").session.query().filter().one_or_none()
    dataset.__str__.return_value = "some_table"

    dataset.get_sqla_row_level_filters.return_value = [text("organization_id = 1")]
    assert (
        str(get_rls_for_table(candidate, 1, "public"))
        == "some_table.organization_id = 1"
    )

    dataset.get_sqla_row_level_filters.return_value = [
        text("organization_id = 1"),
        text("foo = 'bar'"),
    ]
    assert (
        str(get_rls_for_table(candidate, 1, "public"))
        == "some_table.organization_id = 1 AND some_table.foo = 'bar'"
    )

    dataset.get_sqla_row_level_filters.return_value = []
    assert get_rls_for_table(candidate, 1, "public") is None


def test_extract_table_references(mocker: MockerFixture) -> None:
    """
    Test the ``extract_table_references`` helper function.
    """
    assert extract_table_references("SELECT 1", "trino") == set()
    assert extract_table_references("SELECT 1 FROM some_table", "trino") == {
        Table(table="some_table", schema=None, catalog=None)
    }
    assert extract_table_references("SELECT {{ jinja }} FROM some_table", "trino") == {
        Table(table="some_table", schema=None, catalog=None)
    }
    assert extract_table_references(
        "SELECT 1 FROM some_catalog.some_schema.some_table", "trino"
    ) == {Table(table="some_table", schema="some_schema", catalog="some_catalog")}

    # with identifier quotes
    assert extract_table_references(
        "SELECT 1 FROM `some_catalog`.`some_schema`.`some_table`", "mysql"
    ) == {Table(table="some_table", schema="some_schema", catalog="some_catalog")}
    assert extract_table_references(
        'SELECT 1 FROM "some_catalog".some_schema."some_table"', "trino"
    ) == {Table(table="some_table", schema="some_schema", catalog="some_catalog")}

    assert extract_table_references(
        "SELECT * FROM some_table JOIN other_table ON some_table.id = other_table.id",
        "trino",
    ) == {
        Table(table="some_table", schema=None, catalog=None),
        Table(table="other_table", schema=None, catalog=None),
    }

    # test falling back to sqlparse
    logger = mocker.patch("superset.sql_parse.logger")
    sql = "SELECT * FROM table UNION ALL SELECT * FROM other_table"
    assert extract_table_references(sql, "trino") == {
        Table(table="table", schema=None, catalog=None),
        Table(table="other_table", schema=None, catalog=None),
    }
    logger.warning.assert_called_once()

    logger = mocker.patch("superset.migrations.shared.utils.logger")
    sql = "SELECT * FROM table UNION ALL SELECT * FROM other_table"
    assert extract_table_references(sql, "trino", show_warning=False) == {
        Table(table="table", schema=None, catalog=None),
        Table(table="other_table", schema=None, catalog=None),
    }
    logger.warning.assert_not_called()


def test_is_select() -> None:
    """
    Test `is_select`.
    """
    assert not ParsedQuery("SELECT 1; DROP DATABASE superset").is_select()
    assert ParsedQuery(
        "with base as(select id from table1 union all select id from table2) select * from base"
    ).is_select()
    assert ParsedQuery(
        """
WITH t AS (
    SELECT 1 UNION ALL SELECT 2
)
SELECT * FROM t"""
    ).is_select()
    assert not ParsedQuery("").is_select()
    assert not ParsedQuery("USE foo").is_select()
    assert ParsedQuery("USE foo; SELECT * FROM bar").is_select()


@pytest.mark.parametrize(
    "engine",
    [
        "hive",
        "presto",
        "trino",
    ],
)
@pytest.mark.parametrize(
    "macro,expected",
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
    engine: str, macro: str, expected: set[Table]
) -> None:
    assert (
        extract_tables_from_jinja_sql(
            sql=f"'{{{{ {engine}.{macro} }}}}'",
            database=Mock(),
        )
        == expected
    )
