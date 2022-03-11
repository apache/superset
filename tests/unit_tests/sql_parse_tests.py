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

# pylint: disable=invalid-name, too-many-lines

import unittest
from typing import Set

import pytest
import sqlparse

from superset.exceptions import QueryClauseValidationException
from superset.sql_parse import (
    add_table_name,
    has_table_query,
    insert_rls,
    matches_table_name,
    ParsedQuery,
    strip_comments_from_sql,
    Table,
    validate_filter_clause,
)


def extract_tables(query: str) -> Set[Table]:
    """
    Helper function to extract tables referenced in a query.
    """
    return ParsedQuery(query).tables


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

    # reverse select
    assert extract_tables("FROM t1 SELECT field") == {Table("t1")}


def test_extract_tables_subselect() -> None:
    """
    Test that tables inside subselects are parsed correctly.
    """
    assert (
        extract_tables(
            """
SELECT sub.*
FROM (
    SELECT *
        FROM s1.t1
        WHERE day_of_week = 'Friday'
    ) sub, s2.t2
WHERE sub.resolution = 'NONE'
"""
        )
        == {Table("t1", "s1"), Table("t2", "s2")}
    )

    assert (
        extract_tables(
            """
SELECT sub.*
FROM (
    SELECT *
    FROM s1.t1
    WHERE day_of_week = 'Friday'
) sub
WHERE sub.resolution = 'NONE'
"""
        )
        == {Table("t1", "s1")}
    )

    assert (
        extract_tables(
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
        )
        == {Table("t1"), Table("t2"), Table("t3"), Table("t4")}
    )


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
    assert (
        extract_tables(
            """
SELECT ARRAY[1, 2, 3] AS my_array
FROM t1 LIMIT 10
"""
        )
        == {Table("t1")}
    )


def test_extract_tables_select_if() -> None:
    """
    Test that queries with an ``IF`` work as expected.
    """
    assert (
        extract_tables(
            """
SELECT IF(CARDINALITY(my_array) >= 3, my_array[3], NULL)
FROM t1 LIMIT 10
"""
        )
        == {Table("t1")}
    )


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
    assert extract_tables("SELECT * FROM schemaname.") == set()
    assert extract_tables("SELECT * FROM catalogname.schemaname.") == set()
    assert extract_tables("SELECT * FROM catalogname..") == set()
    assert extract_tables("SELECT * FROM catalogname..tbname") == set()


@unittest.skip("Requires sqlparse>=3.1")
def test_extract_tables_show_tables_from() -> None:
    """
    Test ``SHOW TABLES FROM``.

    This is currently broken in the pinned version of sqlparse, and fixed in
    ``sqlparse>=3.1``. However, ``sqlparse==3.1`` breaks some sql formatting.
    """
    assert extract_tables("SHOW TABLES FROM s1 like '%order%'") == set()


def test_extract_tables_show_columns_from() -> None:
    """
    Test ``SHOW COLUMNS FROM``.
    """
    assert extract_tables("SHOW COLUMNS FROM t1") == {Table("t1")}


def test_extract_tables_where_subquery() -> None:
    """
    Test that tables in a ``WHERE`` subquery are parsed correctly.
    """
    assert (
        extract_tables(
            """
SELECT name
FROM t1
WHERE regionkey = (SELECT max(regionkey) FROM t2)
"""
        )
        == {Table("t1"), Table("t2")}
    )

    assert (
        extract_tables(
            """
SELECT name
FROM t1
WHERE regionkey IN (SELECT regionkey FROM t2)
"""
        )
        == {Table("t1"), Table("t2")}
    )

    assert (
        extract_tables(
            """
SELECT name
FROM t1
WHERE regionkey EXISTS (SELECT regionkey FROM t2)
"""
        )
        == {Table("t1"), Table("t2")}
    )


def test_extract_tables_describe() -> None:
    """
    Test ``DESCRIBE``.
    """
    assert extract_tables("DESCRIBE t1") == {Table("t1")}


def test_extract_tables_show_partitions() -> None:
    """
    Test ``SHOW PARTITIONS``.
    """
    assert (
        extract_tables(
            """
SHOW PARTITIONS FROM orders
WHERE ds >= '2013-01-01' ORDER BY ds DESC
"""
        )
        == {Table("orders")}
    )


def test_extract_tables_join() -> None:
    """
    Test joins.
    """
    assert extract_tables("SELECT t1.*, t2.* FROM t1 JOIN t2 ON t1.a = t2.a;") == {
        Table("t1"),
        Table("t2"),
    }

    assert (
        extract_tables(
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
        )
        == {Table("left_table"), Table("right_table")}
    )

    assert (
        extract_tables(
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
        )
        == {Table("left_table"), Table("right_table")}
    )

    assert (
        extract_tables(
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
        )
        == {Table("left_table"), Table("right_table")}
    )

    assert (
        extract_tables(
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
        )
        == {Table("left_table"), Table("right_table")}
    )


def test_extract_tables_semi_join() -> None:
    """
    Test ``LEFT SEMI JOIN``.
    """
    assert (
        extract_tables(
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
        )
        == {Table("left_table"), Table("right_table")}
    )


def test_extract_tables_combinations() -> None:
    """
    Test a complex case with nested queries.
    """
    assert (
        extract_tables(
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
        )
        == {Table("t1"), Table("t3"), Table("t4"), Table("t6")}
    )

    assert (
        extract_tables(
            """
SELECT * FROM (
    SELECT * FROM (
        SELECT * FROM (
            SELECT * FROM EmployeeS
        ) AS S1
    ) AS S2
) AS S3
"""
        )
        == {Table("EmployeeS")}
    )


def test_extract_tables_with() -> None:
    """
    Test ``WITH``.
    """
    assert (
        extract_tables(
            """
WITH
    x AS (SELECT a FROM t1),
    y AS (SELECT a AS b FROM t2),
    z AS (SELECT b AS c FROM t3)
SELECT c FROM z
"""
        )
        == {Table("t1"), Table("t2"), Table("t3")}
    )

    assert (
        extract_tables(
            """
WITH
    x AS (SELECT a FROM t1),
    y AS (SELECT a AS b FROM x),
    z AS (SELECT b AS c FROM y)
SELECT c FROM z
"""
        )
        == {Table("t1")}
    )


def test_extract_tables_reusing_aliases() -> None:
    """
    Test that the parser follows aliases.
    """
    assert (
        extract_tables(
            """
with q1 as ( select key from q2 where key = '5'),
q2 as ( select key from src where key = '5')
select * from (select key from q1) a
"""
        )
        == {Table("src")}
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


def test_extract_tables_complex() -> None:
    """
    Test a few complex queries.
    """
    assert (
        extract_tables(
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
        )
        == {
            Table("my_l_table"),
            Table("my_b_table"),
            Table("my_t_table"),
            Table("inner_table"),
        }
    )

    assert (
        extract_tables(
            """
SELECT *
FROM table_a AS a, table_b AS b, table_c as c
WHERE a.id = b.id and b.id = c.id
"""
        )
        == {Table("table_a"), Table("table_b"), Table("table_c")}
    )

    assert (
        extract_tables(
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
        )
        == {Table("a"), Table("b"), Table("c"), Table("d"), Table("e"), Table("f")}
    )


def test_extract_tables_mixed_from_clause() -> None:
    """
    Test that the parser handles a ``FROM`` clause with table and subselect.
    """
    assert (
        extract_tables(
            """
SELECT *
FROM table_a AS a, (select * from table_b) AS b, table_c as c
WHERE a.id = b.id and b.id = c.id
"""
        )
        == {Table("table_a"), Table("table_b"), Table("table_c")}
    )


def test_extract_tables_nested_select() -> None:
    """
    Test that the parser handles selects inside functions.
    """
    assert (
        extract_tables(
            """
select (extractvalue(1,concat(0x7e,(select GROUP_CONCAT(TABLE_NAME)
from INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA like "%bi%"),0x7e)));
"""
        )
        == {Table("COLUMNS", "INFORMATION_SCHEMA")}
    )

    assert (
        extract_tables(
            """
select (extractvalue(1,concat(0x7e,(select GROUP_CONCAT(COLUMN_NAME)
from INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME="bi_achivement_daily"),0x7e)));
"""
        )
        == {Table("COLUMNS", "INFORMATION_SCHEMA")}
    )


def test_extract_tables_complex_cte_with_prefix() -> None:
    """
    Test that the parser handles CTEs with prefixes.
    """
    assert (
        extract_tables(
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
        )
        == {Table("SalesOrderHeader")}
    )


def test_extract_tables_identifier_list_with_keyword_as_alias() -> None:
    """
    Test that aliases that are keywords are parsed correctly.
    """
    assert (
        extract_tables(
            """
WITH
    f AS (SELECT * FROM foo),
    match AS (SELECT * FROM f)
SELECT * FROM match
"""
        )
        == {Table("foo")}
    )


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


def test_unknown_select() -> None:
    """
    Test that `is_select` works when sqlparse fails to identify the type.
    """
    sql = "WITH foo AS(SELECT 1) SELECT 1"
    assert sqlparse.parse(sql)[0].get_type() == "UNKNOWN"
    assert ParsedQuery(sql).is_select()

    sql = "WITH foo AS(SELECT 1) INSERT INTO my_table (a) VALUES (1)"
    assert sqlparse.parse(sql)[0].get_type() == "UNKNOWN"
    assert not ParsedQuery(sql).is_select()

    sql = "WITH foo AS(SELECT 1) DELETE FROM my_table"
    assert sqlparse.parse(sql)[0].get_type() == "UNKNOWN"
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

    ``sqlparse==0.3.1`` has a bug and removes space between ``from`` and
    ``from_unixtime``, resulting in::

        SELECT extract(HOUR
        fromfrom_unixtime(hour_ts)
        AT TIME ZONE 'America/Los_Angeles')
        from table

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


def test_validate_filter_clause_valid():
    # regular clauses
    assert validate_filter_clause("col = 1") is None
    assert validate_filter_clause("1=\t\n1") is None
    assert validate_filter_clause("(col = 1)") is None
    assert validate_filter_clause("(col1 = 1) AND (col2 = 2)") is None

    # Valid literal values that appear to be invalid
    assert validate_filter_clause("col = 'col1 = 1) AND (col2 = 2'") is None
    assert validate_filter_clause("col = 'select 1; select 2'") is None
    assert validate_filter_clause("col = 'abc -- comment'") is None


def test_validate_filter_clause_closing_unclosed():
    with pytest.raises(QueryClauseValidationException):
        validate_filter_clause("col1 = 1) AND (col2 = 2)")


def test_validate_filter_clause_unclosed():
    with pytest.raises(QueryClauseValidationException):
        validate_filter_clause("(col1 = 1) AND (col2 = 2")


def test_validate_filter_clause_closing_and_unclosed():
    with pytest.raises(QueryClauseValidationException):
        validate_filter_clause("col1 = 1) AND (col2 = 2")


def test_validate_filter_clause_closing_and_unclosed_nested():
    with pytest.raises(QueryClauseValidationException):
        validate_filter_clause("(col1 = 1)) AND ((col2 = 2)")


def test_validate_filter_clause_multiple():
    with pytest.raises(QueryClauseValidationException):
        validate_filter_clause("TRUE; SELECT 1")


def test_validate_filter_clause_comment():
    with pytest.raises(QueryClauseValidationException):
        validate_filter_clause("1 = 1 -- comment")


def test_validate_filter_clause_subquery_comment():
    with pytest.raises(QueryClauseValidationException):
        validate_filter_clause("(1 = 1 -- comment\n)")


def test_sqlparse_issue_652():
    stmt = sqlparse.parse(r"foo = '\' AND bar = 'baz'")[0]
    assert len(stmt.tokens) == 5
    assert str(stmt.tokens[0]) == "foo = '\\'"


@pytest.mark.parametrize(
    "sql,expected",
    [
        ("SELECT * FROM table", True),
        ("SELECT a FROM (SELECT 1 AS a) JOIN (SELECT * FROM table)", True),
        ("(SELECT COUNT(DISTINCT name) AS foo FROM    birth_names)", True),
        ("COUNT(*)", False),
        ("SELECT a FROM (SELECT 1 AS a)", False),
        ("SELECT a FROM (SELECT 1 AS a) JOIN table", True),
        ("SELECT * FROM (SELECT 1 AS foo, 2 AS bar) ORDER BY foo ASC, bar", False),
        ("SELECT * FROM other_table", True),
        ("extract(HOUR from from_unixtime(hour_ts)", False),
    ],
)
def test_has_table_query(sql: str, expected: bool) -> None:
    """
    Test if a given statement queries a table.

    This is used to prevent ad-hoc metrics from querying unauthorized tables, bypassing
    row-level security.
    """
    statement = sqlparse.parse(sql)[0]
    assert has_table_query(statement) == expected


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
def test_insert_rls(sql: str, table: str, rls: str, expected: str) -> None:
    """
    Insert into a statement a given RLS condition associated with a table.
    """
    statement = sqlparse.parse(sql)[0]
    condition = sqlparse.parse(rls)[0]
    assert str(insert_rls(statement, table, condition)).strip() == expected.strip()


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


@pytest.mark.parametrize(
    "candidate,table,expected",
    [
        ("table", "table", True),
        ("schema.table", "table", True),
        ("table", "schema.table", True),
        ('schema."my table"', '"my table"', True),
        ('schema."my.table"', '"my.table"', True),
    ],
)
def test_matches_table_name(candidate: str, table: str, expected: bool) -> None:
    token = sqlparse.parse(candidate)[0].tokens[0]
    assert matches_table_name(token, table) == expected
