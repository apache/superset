from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import unittest

from superset import sql_parse


class SupersetTestCase(unittest.TestCase):

    def test_simple_select(self):
        query = "SELECT * FROM tbname"
        self.assertEquals({"tbname"}, sql_parse.extract_tables(query))

        # underscores
        query = "SELECT * FROM tb_name"
        self.assertEquals({"tb_name"},
                          sql_parse.extract_tables(query))

        # quotes
        query = 'SELECT * FROM "tbname"'
        self.assertEquals({"tbname"}, sql_parse.extract_tables(query))

        # schema
        # self.assertEquals(
        #     {"schemaname.tbname"},
        #     sql_parse.extract_tables("SELECT * FROM schemaname.tbname"))

        # quotes
        query = "SELECT field1, field2 FROM tb_name"
        self.assertEquals({"tb_name"}, sql_parse.extract_tables(query))

        query = "SELECT t1.f1, t2.f2 FROM t1, t2"
        self.assertEquals({"t1", "t2"}, sql_parse.extract_tables(query))

    def test_select_named_table(self):
        query = "SELECT a.date, a.field FROM left_table a LIMIT 10"
        self.assertEquals(
            {"left_table"}, sql_parse.extract_tables(query))

    def test_reverse_select(self):
        query = "FROM t1 SELECT field"
        self.assertEquals({"t1"}, sql_parse.extract_tables(query))

    def test_subselect(self):
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
        self.assertEquals({"left_table", "right_table"},
                          sql_parse.extract_tables(query))

    def test_union(self):
        query = "SELECT t1 UNION SELECT * t2"
        self.assertEquals({"t1", "t2"}, sql_parse.extract_tables(query))

        query = "SELECT t1 UNION ALL SELECT * t2"
        self.assertEquals({"t1", "t2"}, sql_parse.extract_tables(query))

        query = "SELECT t1 INTERSECT SELECT * t2"
        self.assertEquals({"t1", "t2"}, sql_parse.extract_tables(query))

    def test_select_from_values(self):
        query = "SELECT * FROM VALUES (13, 42)"
        self.assertEquals({}, sql_parse.extract_tables(query))

    def test_select_array(self):
        query = """
            SELECT ARRAY[1, 2, 3] AS my_array
            FROM t1 LIMIT 10
        """
        self.assertEquals({"t1"}, sql_parse.extract_tables(query))

    def test_select_if(self):
        query = """
            SELECT IF(CARDINALITY(my_array) >= 3, my_array[3], NULL)
            FROM t1 LIMIT 10
        """
        self.assertEquals({"t1"}, sql_parse.extract_tables(query))

    # SHOW TABLES ((FROM | IN) qualifiedName)? (LIKE pattern=STRING)?
    def test_show_tables(self):
        query = 'SHOW TABLES FROM s1 like "%order%"'
        # TODO: figure out what should code do here
        self.assertEquals({"s1.*"}, sql_parse.extract_tables(query))

    # SHOW COLUMNS (FROM | IN) qualifiedName
    def test_show_columns(self):
        query = "SHOW COLUMNS FROM t1"
        self.assertEquals({"t1"}, sql_parse.extract_tables(query))

    # DESCRIBE | DESC qualifiedName
    def test_describe(self):
        self.assertEquals({"t1"}, sql_parse.extract_tables("DESCRIBE t1"))
        self.assertEquals({"t1"}, sql_parse.extract_tables("DESC t1"))

    # SHOW PARTITIONS (FROM | IN) qualifiedName (WHERE booleanExpression)?
    # (ORDER BY sortItem (',' sortItem)*)? (LIMIT limit=(INTEGER_VALUE | ALL))?
    def test_show_partitions(self):
        query = """
            SHOW PARTITIONS FROM orders
            WHERE ds >= '2013-01-01' ORDER BY ds DESC;
        """
        self.assertEquals({"orders"}, sql_parse.extract_tables(query))

    def test_join(self):
        query = "SELECT t1.*, t2.* FROM t1 JOIN t2 ON t1.a = t2.a;"
        self.assertEquals({"t1", "t2"}, sql_parse.extract_tables(query))

    def test_with(self):
        query = """
            WITH
              x AS (SELECT a FROM t),
              y AS (SELECT a AS b FROM x),
              z AS (SELECT b AS c FROM y)
            SELECT c FROM z;
        """
        self.assertEquals({"x", "y", "z"}, sql_parse.extract_tables(query))
