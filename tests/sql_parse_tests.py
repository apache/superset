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

from superset import sql_parse


class SupersetTestCase(unittest.TestCase):
    def extract_tables(self, query):
        sq = sql_parse.ParsedQuery(query)
        return sq.tables

    def test_simple_select(self):
        query = "SELECT * FROM tbname"
        self.assertEquals({"tbname"}, self.extract_tables(query))

        query = "SELECT * FROM tbname foo"
        self.assertEquals({"tbname"}, self.extract_tables(query))

        query = "SELECT * FROM tbname AS foo"
        self.assertEquals({"tbname"}, self.extract_tables(query))

        # underscores
        query = "SELECT * FROM tb_name"
        self.assertEquals({"tb_name"}, self.extract_tables(query))

        # quotes
        query = 'SELECT * FROM "tbname"'
        self.assertEquals({"tbname"}, self.extract_tables(query))

        # unicode encoding
        query = 'SELECT * FROM "tb_name" WHERE city = "Lübeck"'
        self.assertEquals({"tb_name"}, self.extract_tables(query))

        # schema
        self.assertEquals(
            {"schemaname.tbname"},
            self.extract_tables("SELECT * FROM schemaname.tbname"),
        )

        self.assertEquals(
            {"schemaname.tbname"},
            self.extract_tables('SELECT * FROM "schemaname"."tbname"'),
        )

        self.assertEquals(
            {"schemaname.tbname"},
            self.extract_tables("SELECT * FROM schemaname.tbname foo"),
        )

        self.assertEquals(
            {"schemaname.tbname"},
            self.extract_tables("SELECT * FROM schemaname.tbname AS foo"),
        )

        # cluster
        self.assertEquals(
            {"clustername.schemaname.tbname"},
            self.extract_tables("SELECT * FROM clustername.schemaname.tbname"),
        )

        # Ill-defined cluster/schema/table.
        self.assertEquals(set(), self.extract_tables("SELECT * FROM schemaname."))

        self.assertEquals(
            set(), self.extract_tables("SELECT * FROM clustername.schemaname.")
        )

        self.assertEquals(set(), self.extract_tables("SELECT * FROM clustername.."))

        self.assertEquals(
            set(), self.extract_tables("SELECT * FROM clustername..tbname")
        )

        # quotes
        query = "SELECT field1, field2 FROM tb_name"
        self.assertEquals({"tb_name"}, self.extract_tables(query))

        query = "SELECT t1.f1, t2.f2 FROM t1, t2"
        self.assertEquals({"t1", "t2"}, self.extract_tables(query))

    def test_select_named_table(self):
        query = "SELECT a.date, a.field FROM left_table a LIMIT 10"
        self.assertEquals({"left_table"}, self.extract_tables(query))

    def test_reverse_select(self):
        query = "FROM t1 SELECT field"
        self.assertEquals({"t1"}, self.extract_tables(query))

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
        self.assertEquals({"s1.t1", "s2.t2"}, self.extract_tables(query))

        query = """
          SELECT sub.*
              FROM (
                    SELECT *
                      FROM s1.t1
                     WHERE day_of_week = 'Friday'
                   ) sub
          WHERE sub.resolution = 'NONE'
        """
        self.assertEquals({"s1.t1"}, self.extract_tables(query))

        query = """
            SELECT * FROM t1
            WHERE s11 > ANY
             (SELECT COUNT(*) /* no hint */ FROM t2
               WHERE NOT EXISTS
                (SELECT * FROM t3
                  WHERE ROW(5*t2.s1,77)=
                    (SELECT 50,11*s1 FROM t4)));
        """
        self.assertEquals({"t1", "t2", "t3", "t4"}, self.extract_tables(query))

    def test_select_in_expression(self):
        query = "SELECT f1, (SELECT count(1) FROM t2) FROM t1"
        self.assertEquals({"t1", "t2"}, self.extract_tables(query))

    def test_union(self):
        query = "SELECT * FROM t1 UNION SELECT * FROM t2"
        self.assertEquals({"t1", "t2"}, self.extract_tables(query))

        query = "SELECT * FROM t1 UNION ALL SELECT * FROM t2"
        self.assertEquals({"t1", "t2"}, self.extract_tables(query))

        query = "SELECT * FROM t1 INTERSECT ALL SELECT * FROM t2"
        self.assertEquals({"t1", "t2"}, self.extract_tables(query))

    def test_select_from_values(self):
        query = "SELECT * FROM VALUES (13, 42)"
        self.assertFalse(self.extract_tables(query))

    def test_select_array(self):
        query = """
            SELECT ARRAY[1, 2, 3] AS my_array
            FROM t1 LIMIT 10
        """
        self.assertEquals({"t1"}, self.extract_tables(query))

    def test_select_if(self):
        query = """
            SELECT IF(CARDINALITY(my_array) >= 3, my_array[3], NULL)
            FROM t1 LIMIT 10
        """
        self.assertEquals({"t1"}, self.extract_tables(query))

    # SHOW TABLES ((FROM | IN) qualifiedName)? (LIKE pattern=STRING)?
    def test_show_tables(self):
        query = "SHOW TABLES FROM s1 like '%order%'"
        # TODO: figure out what should code do here
        self.assertEquals({"s1"}, self.extract_tables(query))

    # SHOW COLUMNS (FROM | IN) qualifiedName
    def test_show_columns(self):
        query = "SHOW COLUMNS FROM t1"
        self.assertEquals({"t1"}, self.extract_tables(query))

    def test_where_subquery(self):
        query = """
          SELECT name
            FROM t1
            WHERE regionkey = (SELECT max(regionkey) FROM t2)
        """
        self.assertEquals({"t1", "t2"}, self.extract_tables(query))

        query = """
          SELECT name
            FROM t1
            WHERE regionkey IN (SELECT regionkey FROM t2)
        """
        self.assertEquals({"t1", "t2"}, self.extract_tables(query))

        query = """
          SELECT name
            FROM t1
            WHERE regionkey EXISTS (SELECT regionkey FROM t2)
        """
        self.assertEquals({"t1", "t2"}, self.extract_tables(query))

    # DESCRIBE | DESC qualifiedName
    def test_describe(self):
        self.assertEquals({"t1"}, self.extract_tables("DESCRIBE t1"))

    # SHOW PARTITIONS FROM qualifiedName (WHERE booleanExpression)?
    # (ORDER BY sortItem (',' sortItem)*)? (LIMIT limit=(INTEGER_VALUE | ALL))?
    def test_show_partitions(self):
        query = """
            SHOW PARTITIONS FROM orders
            WHERE ds >= '2013-01-01' ORDER BY ds DESC;
        """
        self.assertEquals({"orders"}, self.extract_tables(query))

    def test_join(self):
        query = "SELECT t1.*, t2.* FROM t1 JOIN t2 ON t1.a = t2.a;"
        self.assertEquals({"t1", "t2"}, self.extract_tables(query))

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
        self.assertEquals({"left_table", "right_table"}, self.extract_tables(query))

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
        self.assertEquals({"left_table", "right_table"}, self.extract_tables(query))

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
        self.assertEquals({"left_table", "right_table"}, self.extract_tables(query))

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
        self.assertEquals({"left_table", "right_table"}, self.extract_tables(query))

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
        # self.assertEquals({'left_table', 'right_table'},
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
        self.assertEquals({"t1", "t3", "t4", "t6"}, self.extract_tables(query))

        query = """
        SELECT * FROM (SELECT * FROM (SELECT * FROM (SELECT * FROM EmployeeS)
            AS S1) AS S2) AS S3;
        """
        self.assertEquals({"EmployeeS"}, self.extract_tables(query))

    def test_with(self):
        query = """
            WITH
              x AS (SELECT a FROM t1),
              y AS (SELECT a AS b FROM t2),
              z AS (SELECT b AS c FROM t3)
            SELECT c FROM z;
        """
        self.assertEquals({"t1", "t2", "t3"}, self.extract_tables(query))

        query = """
            WITH
              x AS (SELECT a FROM t1),
              y AS (SELECT a AS b FROM x),
              z AS (SELECT b AS c FROM y)
            SELECT c FROM z;
        """
        self.assertEquals({"t1"}, self.extract_tables(query))

    def test_reusing_aliases(self):
        query = """
            with q1 as ( select key from q2 where key = '5'),
            q2 as ( select key from src where key = '5')
            select * from (select key from q1) a;
        """
        self.assertEquals({"src"}, self.extract_tables(query))

    def test_multistatement(self):
        query = "SELECT * FROM t1; SELECT * FROM t2"
        self.assertEquals({"t1", "t2"}, self.extract_tables(query))

        query = "SELECT * FROM t1; SELECT * FROM t2;"
        self.assertEquals({"t1", "t2"}, self.extract_tables(query))

    def test_update_not_select(self):
        sql = sql_parse.ParsedQuery("UPDATE t1 SET col1 = NULL")
        self.assertEquals(False, sql.is_select())
        self.assertEquals(False, sql.is_readonly())

    def test_explain(self):
        sql = sql_parse.ParsedQuery("EXPLAIN SELECT 1")

        self.assertEquals(True, sql.is_explain())
        self.assertEquals(False, sql.is_select())
        self.assertEquals(True, sql.is_readonly())

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
        self.assertEquals(
            {"my_l_table", "my_b_table", "my_t_table", "inner_table"},
            self.extract_tables(query),
        )

    def test_complex_extract_tables2(self):
        query = """SELECT *
            FROM table_a AS a, table_b AS b, table_c as c
            WHERE a.id = b.id and b.id = c.id"""
        self.assertEquals({"table_a", "table_b", "table_c"}, self.extract_tables(query))

    def test_mixed_from_clause(self):
        query = """SELECT *
            FROM table_a AS a, (select * from table_b) AS b, table_c as c
            WHERE a.id = b.id and b.id = c.id"""
        self.assertEquals({"table_a", "table_b", "table_c"}, self.extract_tables(query))

    def test_nested_selects(self):
        query = """
            select (extractvalue(1,concat(0x7e,(select GROUP_CONCAT(TABLE_NAME)
            from INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA like "%bi%"),0x7e)));
        """
        self.assertEquals({"INFORMATION_SCHEMA.COLUMNS"}, self.extract_tables(query))
        query = """
            select (extractvalue(1,concat(0x7e,(select GROUP_CONCAT(COLUMN_NAME)
            from INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME="bi_achivement_daily"),0x7e)));
        """
        self.assertEquals({"INFORMATION_SCHEMA.COLUMNS"}, self.extract_tables(query))

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
        self.assertEquals({"a", "b", "c", "d", "e", "f"}, self.extract_tables(query))

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
        self.assertEquals({"SalesOrderHeader"}, self.extract_tables(query))

    def test_get_query_with_new_limit_comment(self):
        sql = "SELECT * FROM ab_user -- SOME COMMENT"
        parsed = sql_parse.ParsedQuery(sql)
        newsql = parsed.get_query_with_new_limit(1000)
        self.assertEquals(newsql, sql + "\nLIMIT 1000")

    def test_get_query_with_new_limit_comment_with_limit(self):
        sql = "SELECT * FROM ab_user -- SOME COMMENT WITH LIMIT 555"
        parsed = sql_parse.ParsedQuery(sql)
        newsql = parsed.get_query_with_new_limit(1000)
        self.assertEquals(newsql, sql + "\nLIMIT 1000")

    def test_get_query_with_new_limit(self):
        sql = "SELECT * FROM ab_user LIMIT 555"
        parsed = sql_parse.ParsedQuery(sql)
        newsql = parsed.get_query_with_new_limit(1000)
        expected = "SELECT * FROM ab_user LIMIT 1000"
        self.assertEquals(newsql, expected)

    def test_basic_breakdown_statements(self):
        multi_sql = """
        SELECT * FROM ab_user;
        SELECT * FROM ab_user LIMIT 1;
        """
        parsed = sql_parse.ParsedQuery(multi_sql)
        statements = parsed.get_statements()
        self.assertEquals(len(statements), 2)
        expected = ["SELECT * FROM ab_user", "SELECT * FROM ab_user LIMIT 1"]
        self.assertEquals(statements, expected)

    def test_messy_breakdown_statements(self):
        multi_sql = """
        SELECT 1;\t\n\n\n  \t
        \t\nSELECT 2;
        SELECT * FROM ab_user;;;
        SELECT * FROM ab_user LIMIT 1
        """
        parsed = sql_parse.ParsedQuery(multi_sql)
        statements = parsed.get_statements()
        self.assertEquals(len(statements), 4)
        expected = [
            "SELECT 1",
            "SELECT 2",
            "SELECT * FROM ab_user",
            "SELECT * FROM ab_user LIMIT 1",
        ]
        self.assertEquals(statements, expected)

    def test_identifier_list_with_keyword_as_alias(self):
        query = """
        WITH
            f AS (SELECT * FROM foo),
            match AS (SELECT * FROM f)
        SELECT * FROM match
        """
        self.assertEquals({"foo"}, self.extract_tables(query))
