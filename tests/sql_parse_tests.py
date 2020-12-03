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
import unittest

import sqlparse

from superset.sql_parse import ParsedQuery, Table


class TestSupersetSqlParse(unittest.TestCase):
    def extract_tables(self, query):
        return ParsedQuery(query).tables

    def test_table(self):
        self.assertEqual(str(Table("tbname")), "tbname")
        self.assertEqual(str(Table("tbname", "schemaname")), "schemaname.tbname")

        self.assertEqual(
            str(Table("tbname", "schemaname", "catalogname")),
            "catalogname.schemaname.tbname",
        )

        self.assertEqual(
            str(Table("tb.name", "schema/name", "catalog\name")),
            "catalog%0Aame.schema%2Fname.tb%2Ename",
        )

    def test_simple_select(self):
        query = "SELECT * FROM tbname"
        self.assertEqual({Table("tbname")}, self.extract_tables(query))

        query = "SELECT * FROM tbname foo"
        self.assertEqual({Table("tbname")}, self.extract_tables(query))

        query = "SELECT * FROM tbname AS foo"
        self.assertEqual({Table("tbname")}, self.extract_tables(query))

        # underscores
        query = "SELECT * FROM tb_name"
        self.assertEqual({Table("tb_name")}, self.extract_tables(query))

        # quotes
        query = 'SELECT * FROM "tbname"'
        self.assertEqual({Table("tbname")}, self.extract_tables(query))

        # unicode encoding
        query = 'SELECT * FROM "tb_name" WHERE city = "Lübeck"'
        self.assertEqual({Table("tb_name")}, self.extract_tables(query))

        # schema
        self.assertEqual(
            {Table("tbname", "schemaname")},
            self.extract_tables("SELECT * FROM schemaname.tbname"),
        )

        self.assertEqual(
            {Table("tbname", "schemaname")},
            self.extract_tables('SELECT * FROM "schemaname"."tbname"'),
        )

        self.assertEqual(
            {Table("tbname", "schemaname")},
            self.extract_tables("SELECT * FROM schemaname.tbname foo"),
        )

        self.assertEqual(
            {Table("tbname", "schemaname")},
            self.extract_tables("SELECT * FROM schemaname.tbname AS foo"),
        )

        self.assertEqual(
            {Table("tbname", "schemaname", "catalogname")},
            self.extract_tables("SELECT * FROM catalogname.schemaname.tbname"),
        )

        # Ill-defined cluster/schema/table.
        self.assertEqual(set(), self.extract_tables("SELECT * FROM schemaname."))

        self.assertEqual(
            set(), self.extract_tables("SELECT * FROM catalogname.schemaname.")
        )

        self.assertEqual(set(), self.extract_tables("SELECT * FROM catalogname.."))

        self.assertEqual(
            set(), self.extract_tables("SELECT * FROM catalogname..tbname")
        )

        # quotes
        query = "SELECT field1, field2 FROM tb_name"
        self.assertEqual({Table("tb_name")}, self.extract_tables(query))

        query = "SELECT t1.f1, t2.f2 FROM t1, t2"
        self.assertEqual({Table("t1"), Table("t2")}, self.extract_tables(query))

    def test_select_named_table(self):
        query = "SELECT a.date, a.field FROM left_table a LIMIT 10"
        self.assertEqual({Table("left_table")}, self.extract_tables(query))

    def test_reverse_select(self):
        query = "FROM t1 SELECT field"
        self.assertEqual({Table("t1")}, self.extract_tables(query))

    def test_subselect(self):
        query = """
          SELECT sub.*
              FROM (
                    SELECT *
                      FROM s1.t1
                     WHERE day_of_week = 'Friday'
                   ) sub, s2.t2
          WHERE sub.resolution = 'NONE'
        """
        self.assertEqual(
            {Table("t1", "s1"), Table("t2", "s2")}, self.extract_tables(query)
        )

        query = """
          SELECT sub.*
              FROM (
                    SELECT *
                      FROM s1.t1
                     WHERE day_of_week = 'Friday'
                   ) sub
          WHERE sub.resolution = 'NONE'
        """
        self.assertEqual({Table("t1", "s1")}, self.extract_tables(query))

        query = """
            SELECT * FROM t1
            WHERE s11 > ANY
             (SELECT COUNT(*) /* no hint */ FROM t2
               WHERE NOT EXISTS
                (SELECT * FROM t3
                  WHERE ROW(5*t2.s1,77)=
                    (SELECT 50,11*s1 FROM t4)));
        """
        self.assertEqual(
            {Table("t1"), Table("t2"), Table("t3"), Table("t4")},
            self.extract_tables(query),
        )

    def test_select_in_expression(self):
        query = "SELECT f1, (SELECT count(1) FROM t2) FROM t1"
        self.assertEqual({Table("t1"), Table("t2")}, self.extract_tables(query))

    def test_union(self):
        query = "SELECT * FROM t1 UNION SELECT * FROM t2"
        self.assertEqual({Table("t1"), Table("t2")}, self.extract_tables(query))

        query = "SELECT * FROM t1 UNION ALL SELECT * FROM t2"
        self.assertEqual({Table("t1"), Table("t2")}, self.extract_tables(query))

        query = "SELECT * FROM t1 INTERSECT ALL SELECT * FROM t2"
        self.assertEqual({Table("t1"), Table("t2")}, self.extract_tables(query))

    def test_select_from_values(self):
        query = "SELECT * FROM VALUES (13, 42)"
        self.assertFalse(self.extract_tables(query))

    def test_select_array(self):
        query = """
            SELECT ARRAY[1, 2, 3] AS my_array
            FROM t1 LIMIT 10
        """
        self.assertEqual({Table("t1")}, self.extract_tables(query))

    def test_select_if(self):
        query = """
            SELECT IF(CARDINALITY(my_array) >= 3, my_array[3], NULL)
            FROM t1 LIMIT 10
        """
        self.assertEqual({Table("t1")}, self.extract_tables(query))

    # SHOW TABLES ((FROM | IN) qualifiedName)? (LIKE pattern=STRING)?
    def test_show_tables(self):
        query = "SHOW TABLES FROM s1 like '%order%'"
        # TODO: figure out what should code do here
        self.assertEqual({Table("s1")}, self.extract_tables(query))
        # Expected behavior is below, it is fixed in sqlparse>=3.1
        # However sqlparse==3.1 breaks some sql formatting.
        # self.assertEqual(set(), self.extract_tables(query))

    # SHOW COLUMNS (FROM | IN) qualifiedName
    def test_show_columns(self):
        query = "SHOW COLUMNS FROM t1"
        self.assertEqual({Table("t1")}, self.extract_tables(query))

    def test_where_subquery(self):
        query = """
          SELECT name
            FROM t1
            WHERE regionkey = (SELECT max(regionkey) FROM t2)
        """
        self.assertEqual({Table("t1"), Table("t2")}, self.extract_tables(query))

        query = """
          SELECT name
            FROM t1
            WHERE regionkey IN (SELECT regionkey FROM t2)
        """
        self.assertEqual({Table("t1"), Table("t2")}, self.extract_tables(query))

        query = """
          SELECT name
            FROM t1
            WHERE regionkey EXISTS (SELECT regionkey FROM t2)
        """
        self.assertEqual({Table("t1"), Table("t2")}, self.extract_tables(query))

    # DESCRIBE | DESC qualifiedName
    def test_describe(self):
        self.assertEqual({Table("t1")}, self.extract_tables("DESCRIBE t1"))

    # SHOW PARTITIONS FROM qualifiedName (WHERE booleanExpression)?
    # (ORDER BY sortItem (',' sortItem)*)? (LIMIT limit=(INTEGER_VALUE | ALL))?
    def test_show_partitions(self):
        query = """
            SHOW PARTITIONS FROM orders
            WHERE ds >= '2013-01-01' ORDER BY ds DESC;
        """
        self.assertEqual({Table("orders")}, self.extract_tables(query))

    def test_join(self):
        query = "SELECT t1.*, t2.* FROM t1 JOIN t2 ON t1.a = t2.a;"
        self.assertEqual({Table("t1"), Table("t2")}, self.extract_tables(query))

        # subquery + join
        query = """
            SELECT a.date, b.name FROM
                left_table a
                JOIN (
                  SELECT
                    CAST((b.year) as VARCHAR) date,
                    name
                  FROM right_table
                ) b
                ON a.date = b.date
        """
        self.assertEqual(
            {Table("left_table"), Table("right_table")}, self.extract_tables(query)
        )

        query = """
            SELECT a.date, b.name FROM
                left_table a
                LEFT INNER JOIN (
                  SELECT
                    CAST((b.year) as VARCHAR) date,
                    name
                  FROM right_table
                ) b
                ON a.date = b.date
        """
        self.assertEqual(
            {Table("left_table"), Table("right_table")}, self.extract_tables(query)
        )

        query = """
            SELECT a.date, b.name FROM
                left_table a
                RIGHT OUTER JOIN (
                  SELECT
                    CAST((b.year) as VARCHAR) date,
                    name
                  FROM right_table
                ) b
                ON a.date = b.date
        """
        self.assertEqual(
            {Table("left_table"), Table("right_table")}, self.extract_tables(query)
        )

        query = """
            SELECT a.date, b.name FROM
                left_table a
                FULL OUTER JOIN (
                  SELECT
                    CAST((b.year) as VARCHAR) date,
                    name
                  FROM right_table
                ) b
                ON a.date = b.date
        """
        self.assertEqual(
            {Table("left_table"), Table("right_table")}, self.extract_tables(query)
        )

        # TODO: add SEMI join support, SQL Parse does not handle it.
        # query = """
        #     SELECT a.date, b.name FROM
        #         left_table a
        #         LEFT SEMI JOIN (
        #           SELECT
        #             CAST((b.year) as VARCHAR) date,
        #             name
        #           FROM right_table
        #         ) b
        #         ON a.date = b.date
        # """
        # self.assertEqual({'left_table', 'right_table'},
        #                   sql_parse.extract_tables(query))

    def test_combinations(self):
        query = """
            SELECT * FROM t1
            WHERE s11 > ANY
             (SELECT * FROM t1 UNION ALL SELECT * FROM (
               SELECT t6.*, t3.* FROM t6 JOIN t3 ON t6.a = t3.a) tmp_join
               WHERE NOT EXISTS
                (SELECT * FROM t3
                  WHERE ROW(5*t3.s1,77)=
                    (SELECT 50,11*s1 FROM t4)));
        """
        self.assertEqual(
            {Table("t1"), Table("t3"), Table("t4"), Table("t6")},
            self.extract_tables(query),
        )

        query = """
        SELECT * FROM (SELECT * FROM (SELECT * FROM (SELECT * FROM EmployeeS)
            AS S1) AS S2) AS S3;
        """
        self.assertEqual({Table("EmployeeS")}, self.extract_tables(query))

    def test_with(self):
        query = """
            WITH
              x AS (SELECT a FROM t1),
              y AS (SELECT a AS b FROM t2),
              z AS (SELECT b AS c FROM t3)
            SELECT c FROM z;
        """
        self.assertEqual(
            {Table("t1"), Table("t2"), Table("t3")}, self.extract_tables(query)
        )

        query = """
            WITH
              x AS (SELECT a FROM t1),
              y AS (SELECT a AS b FROM x),
              z AS (SELECT b AS c FROM y)
            SELECT c FROM z;
        """
        self.assertEqual({Table("t1")}, self.extract_tables(query))

    def test_reusing_aliases(self):
        query = """
            with q1 as ( select key from q2 where key = '5'),
            q2 as ( select key from src where key = '5')
            select * from (select key from q1) a;
        """
        self.assertEqual({Table("src")}, self.extract_tables(query))

    def test_multistatement(self):
        query = "SELECT * FROM t1; SELECT * FROM t2"
        self.assertEqual({Table("t1"), Table("t2")}, self.extract_tables(query))

        query = "SELECT * FROM t1; SELECT * FROM t2;"
        self.assertEqual({Table("t1"), Table("t2")}, self.extract_tables(query))

    def test_update_not_select(self):
        sql = ParsedQuery("UPDATE t1 SET col1 = NULL")
        self.assertEqual(False, sql.is_select())

    def test_set(self):
        sql = ParsedQuery(
            """
            -- comment
            SET hivevar:desc='Legislators';
        """
        )

        self.assertEqual(True, sql.is_set())
        self.assertEqual(False, sql.is_select())

        self.assertEqual(True, ParsedQuery("set hivevar:desc='bla'").is_set())
        self.assertEqual(False, ParsedQuery("SELECT 1").is_set())

    def test_show(self):
        sql = ParsedQuery(
            """
            -- comment
            SHOW LOCKS test EXTENDED;
            -- comment
        """
        )

        self.assertEqual(True, sql.is_show())
        self.assertEqual(False, sql.is_select())

        self.assertEqual(True, ParsedQuery("SHOW TABLES").is_show())
        self.assertEqual(True, ParsedQuery("shOw TABLES").is_show())
        self.assertEqual(True, ParsedQuery("show TABLES").is_show())
        self.assertEqual(False, ParsedQuery("SELECT 1").is_show())

    def test_explain(self):
        sql = ParsedQuery("EXPLAIN SELECT 1")

        self.assertEqual(True, sql.is_explain())
        self.assertEqual(False, sql.is_select())

    def test_complex_extract_tables(self):
        query = """SELECT sum(m_examples) AS "sum__m_example"
            FROM
              (SELECT COUNT(DISTINCT id_userid) AS m_examples,
                      some_more_info
               FROM my_b_table b
               JOIN my_t_table t ON b.ds=t.ds
               JOIN my_l_table l ON b.uid=l.uid
               WHERE b.rid IN
                   (SELECT other_col
                    FROM inner_table)
                 AND l.bla IN ('x', 'y')
               GROUP BY 2
               ORDER BY 2 ASC) AS "meh"
            ORDER BY "sum__m_example" DESC
            LIMIT 10;"""
        self.assertEqual(
            {
                Table("my_l_table"),
                Table("my_b_table"),
                Table("my_t_table"),
                Table("inner_table"),
            },
            self.extract_tables(query),
        )

    def test_complex_extract_tables2(self):
        query = """SELECT *
            FROM table_a AS a, table_b AS b, table_c as c
            WHERE a.id = b.id and b.id = c.id"""
        self.assertEqual(
            {Table("table_a"), Table("table_b"), Table("table_c")},
            self.extract_tables(query),
        )

    def test_mixed_from_clause(self):
        query = """SELECT *
            FROM table_a AS a, (select * from table_b) AS b, table_c as c
            WHERE a.id = b.id and b.id = c.id"""
        self.assertEqual(
            {Table("table_a"), Table("table_b"), Table("table_c")},
            self.extract_tables(query),
        )

    def test_nested_selects(self):
        query = """
            select (extractvalue(1,concat(0x7e,(select GROUP_CONCAT(TABLE_NAME)
            from INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA like "%bi%"),0x7e)));
        """
        self.assertEqual(
            {Table("COLUMNS", "INFORMATION_SCHEMA")}, self.extract_tables(query)
        )
        query = """
            select (extractvalue(1,concat(0x7e,(select GROUP_CONCAT(COLUMN_NAME)
            from INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME="bi_achivement_daily"),0x7e)));
        """
        self.assertEqual(
            {Table("COLUMNS", "INFORMATION_SCHEMA")}, self.extract_tables(query)
        )

    def test_complex_extract_tables3(self):
        query = """SELECT somecol AS somecol
            FROM
              (WITH bla AS
                 (SELECT col_a
                  FROM a
                  WHERE 1=1
                    AND column_of_choice NOT IN
                      ( SELECT interesting_col
                       FROM b ) ),
                    rb AS
                 ( SELECT yet_another_column
                  FROM
                    ( SELECT a
                     FROM c
                     GROUP BY the_other_col ) not_table
                  LEFT JOIN bla foo ON foo.prop = not_table.bad_col0
                  WHERE 1=1
                  GROUP BY not_table.bad_col1 ,
                           not_table.bad_col2 ,
                  ORDER BY not_table.bad_col_3 DESC ,
                           not_table.bad_col4 ,
                           not_table.bad_col5) SELECT random_col
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
            LIMIT 50000;"""
        self.assertEqual(
            {Table("a"), Table("b"), Table("c"), Table("d"), Table("e"), Table("f")},
            self.extract_tables(query),
        )

    def test_complex_cte_with_prefix(self):
        query = """
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
        self.assertEqual({Table("SalesOrderHeader")}, self.extract_tables(query))

    def test_get_query_with_new_limit_comment(self):
        sql = "SELECT * FROM birth_names -- SOME COMMENT"
        parsed = ParsedQuery(sql)
        newsql = parsed.set_or_update_query_limit(1000)
        self.assertEqual(newsql, sql + "\nLIMIT 1000")

    def test_get_query_with_new_limit_comment_with_limit(self):
        sql = "SELECT * FROM birth_names -- SOME COMMENT WITH LIMIT 555"
        parsed = ParsedQuery(sql)
        newsql = parsed.set_or_update_query_limit(1000)
        self.assertEqual(newsql, sql + "\nLIMIT 1000")

    def test_get_query_with_new_limit_lower(self):
        sql = "SELECT * FROM birth_names LIMIT 555"
        parsed = ParsedQuery(sql)
        newsql = parsed.set_or_update_query_limit(1000)
        # not applied as new limit is higher
        expected = "SELECT * FROM birth_names LIMIT 555"
        self.assertEqual(newsql, expected)

    def test_get_query_with_new_limit_upper(self):
        sql = "SELECT * FROM birth_names LIMIT 1555"
        parsed = ParsedQuery(sql)
        newsql = parsed.set_or_update_query_limit(1000)
        # applied as new limit is lower
        expected = "SELECT * FROM birth_names LIMIT 1000"
        self.assertEqual(newsql, expected)

    def test_basic_breakdown_statements(self):
        multi_sql = """
        SELECT * FROM birth_names;
        SELECT * FROM birth_names LIMIT 1;
        """
        parsed = ParsedQuery(multi_sql)
        statements = parsed.get_statements()
        self.assertEqual(len(statements), 2)
        expected = ["SELECT * FROM birth_names", "SELECT * FROM birth_names LIMIT 1"]
        self.assertEqual(statements, expected)

    def test_messy_breakdown_statements(self):
        multi_sql = """
        SELECT 1;\t\n\n\n  \t
        \t\nSELECT 2;
        SELECT * FROM birth_names;;;
        SELECT * FROM birth_names LIMIT 1
        """
        parsed = ParsedQuery(multi_sql)
        statements = parsed.get_statements()
        self.assertEqual(len(statements), 4)
        expected = [
            "SELECT 1",
            "SELECT 2",
            "SELECT * FROM birth_names",
            "SELECT * FROM birth_names LIMIT 1",
        ]
        self.assertEqual(statements, expected)

    def test_identifier_list_with_keyword_as_alias(self):
        query = """
        WITH
            f AS (SELECT * FROM foo),
            match AS (SELECT * FROM f)
        SELECT * FROM match
        """
        self.assertEqual({Table("foo")}, self.extract_tables(query))

    def test_sqlparse_formatting(self):
        # sqlparse 0.3.1 has a bug and removes space between from and from_unixtime while formatting:
        # SELECT extract(HOUR\n               fromfrom_unixtime(hour_ts)
        # AT TIME ZONE 'America/Los_Angeles')\nfrom table
        self.assertEqual(
            "SELECT extract(HOUR\n               from from_unixtime(hour_ts) "
            "AT TIME ZONE 'America/Los_Angeles')\nfrom table",
            sqlparse.format(
                "SELECT extract(HOUR from from_unixtime(hour_ts) AT TIME ZONE 'America/Los_Angeles') from table",
                reindent=True,
            ),
        )

    def test_is_explain(self):
        query = """
            -- comment
            EXPLAIN select * from table
            -- comment 2
        """
        parsed = ParsedQuery(query)
        self.assertEqual(parsed.is_explain(), True)

        query = """
            -- comment
            EXPLAIN select * from table
            where col1 = 'something'
            -- comment 2

            -- comment 3
            EXPLAIN select * from table
            where col1 = 'something'
            -- comment 4
        """
        parsed = ParsedQuery(query)
        self.assertEqual(parsed.is_explain(), True)

        query = """
            -- This is a comment
                -- this is another comment but with a space in the front
            EXPLAIN SELECT * FROM TABLE
        """
        parsed = ParsedQuery(query)
        self.assertEqual(parsed.is_explain(), True)

        query = """
            /* This is a comment
                 with stars instead */
            EXPLAIN SELECT * FROM TABLE
        """
        parsed = ParsedQuery(query)
        self.assertEqual(parsed.is_explain(), True)

        query = """
            -- comment
            select * from table
            where col1 = 'something'
            -- comment 2
        """
        parsed = ParsedQuery(query)
        self.assertEqual(parsed.is_explain(), False)
