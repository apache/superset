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
# isort:skip_file
import textwrap
import unittest

import pandas
from sqlalchemy.engine.url import make_url

import tests.test_app
from superset import app, db as metadata_db
from superset.models.core import Database
from superset.models.slice import Slice
from superset.utils.core import get_example_database, QueryStatus

from .base_tests import SupersetTestCase


class TestDatabaseModel(SupersetTestCase):
    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("requests"), "requests not installed"
    )
    def test_database_schema_presto(self):
        sqlalchemy_uri = "presto://presto.airbnb.io:8080/hive/default"
        model = Database(database_name="test_database", sqlalchemy_uri=sqlalchemy_uri)

        db = make_url(model.get_sqla_engine().url).database
        self.assertEqual("hive/default", db)

        db = make_url(model.get_sqla_engine(schema="core_db").url).database
        self.assertEqual("hive/core_db", db)

        sqlalchemy_uri = "presto://presto.airbnb.io:8080/hive"
        model = Database(database_name="test_database", sqlalchemy_uri=sqlalchemy_uri)

        db = make_url(model.get_sqla_engine().url).database
        self.assertEqual("hive", db)

        db = make_url(model.get_sqla_engine(schema="core_db").url).database
        self.assertEqual("hive/core_db", db)

    def test_database_schema_postgres(self):
        sqlalchemy_uri = "postgresql+psycopg2://postgres.airbnb.io:5439/prod"
        model = Database(database_name="test_database", sqlalchemy_uri=sqlalchemy_uri)

        db = make_url(model.get_sqla_engine().url).database
        self.assertEqual("prod", db)

        db = make_url(model.get_sqla_engine(schema="foo").url).database
        self.assertEqual("prod", db)

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("thrift"), "thrift not installed"
    )
    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pyhive"), "pyhive not installed"
    )
    def test_database_schema_hive(self):
        sqlalchemy_uri = "hive://hive@hive.airbnb.io:10000/default?auth=NOSASL"
        model = Database(database_name="test_database", sqlalchemy_uri=sqlalchemy_uri)
        db = make_url(model.get_sqla_engine().url).database
        self.assertEqual("default", db)

        db = make_url(model.get_sqla_engine(schema="core_db").url).database
        self.assertEqual("core_db", db)

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("MySQLdb"), "mysqlclient not installed"
    )
    def test_database_schema_mysql(self):
        sqlalchemy_uri = "mysql://root@localhost/superset"
        model = Database(database_name="test_database", sqlalchemy_uri=sqlalchemy_uri)

        db = make_url(model.get_sqla_engine().url).database
        self.assertEqual("superset", db)

        db = make_url(model.get_sqla_engine(schema="staging").url).database
        self.assertEqual("staging", db)

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("MySQLdb"), "mysqlclient not installed"
    )
    def test_database_impersonate_user(self):
        uri = "mysql://root@localhost"
        example_user = "giuseppe"
        model = Database(database_name="test_database", sqlalchemy_uri=uri)

        model.impersonate_user = True
        user_name = make_url(model.get_sqla_engine(user_name=example_user).url).username
        self.assertEqual(example_user, user_name)

        model.impersonate_user = False
        user_name = make_url(model.get_sqla_engine(user_name=example_user).url).username
        self.assertNotEqual(example_user, user_name)

    def test_select_star(self):
        db = get_example_database()
        table_name = "energy_usage"
        sql = db.select_star(table_name, show_cols=False, latest_partition=False)
        expected = textwrap.dedent(
            f"""\
        SELECT *
        FROM {table_name}
        LIMIT 100"""
        )
        assert sql.startswith(expected)

        sql = db.select_star(table_name, show_cols=True, latest_partition=False)
        expected = textwrap.dedent(
            f"""\
        SELECT source,
               target,
               value
        FROM energy_usage
        LIMIT 100"""
        )
        assert sql.startswith(expected)

    def test_select_star_fully_qualified_names(self):
        db = get_example_database()
        schema = "schema.name"
        table_name = "table/name"
        sql = db.select_star(
            table_name, schema=schema, show_cols=False, latest_partition=False
        )
        fully_qualified_names = {
            "sqlite": '"schema.name"."table/name"',
            "mysql": "`schema.name`.`table/name`",
            "postgres": '"schema.name"."table/name"',
        }
        fully_qualified_name = fully_qualified_names.get(db.db_engine_spec.engine)
        if fully_qualified_name:
            expected = textwrap.dedent(
                f"""\
            SELECT *
            FROM {fully_qualified_name}
            LIMIT 100"""
            )
            assert sql.startswith(expected)

    def test_single_statement(self):
        main_db = get_example_database()

        if main_db.backend == "mysql":
            df = main_db.get_df("SELECT 1", None)
            self.assertEqual(df.iat[0, 0], 1)

            df = main_db.get_df("SELECT 1;", None)
            self.assertEqual(df.iat[0, 0], 1)

    def test_multi_statement(self):
        main_db = get_example_database()

        if main_db.backend == "mysql":
            df = main_db.get_df("USE superset; SELECT 1", None)
            self.assertEqual(df.iat[0, 0], 1)

            df = main_db.get_df("USE superset; SELECT ';';", None)
            self.assertEqual(df.iat[0, 0], ";")


class TestSqlaTableModel(SupersetTestCase):
    def test_get_timestamp_expression(self):
        tbl = self.get_table_by_name("birth_names")
        ds_col = tbl.get_column("ds")
        sqla_literal = ds_col.get_timestamp_expression(None)
        self.assertEqual(str(sqla_literal.compile()), "ds")

        sqla_literal = ds_col.get_timestamp_expression("P1D")
        compiled = "{}".format(sqla_literal.compile())
        if tbl.database.backend == "mysql":
            self.assertEqual(compiled, "DATE(ds)")

        prev_ds_expr = ds_col.expression
        ds_col.expression = "DATE_ADD(ds, 1)"
        sqla_literal = ds_col.get_timestamp_expression("P1D")
        compiled = "{}".format(sqla_literal.compile())
        if tbl.database.backend == "mysql":
            self.assertEqual(compiled, "DATE(DATE_ADD(ds, 1))")
        ds_col.expression = prev_ds_expr

    def test_get_timestamp_expression_epoch(self):
        tbl = self.get_table_by_name("birth_names")
        ds_col = tbl.get_column("ds")

        ds_col.expression = None
        ds_col.python_date_format = "epoch_s"
        sqla_literal = ds_col.get_timestamp_expression(None)
        compiled = "{}".format(sqla_literal.compile())
        if tbl.database.backend == "mysql":
            self.assertEqual(compiled, "from_unixtime(ds)")

        ds_col.python_date_format = "epoch_s"
        sqla_literal = ds_col.get_timestamp_expression("P1D")
        compiled = "{}".format(sqla_literal.compile())
        if tbl.database.backend == "mysql":
            self.assertEqual(compiled, "DATE(from_unixtime(ds))")

        prev_ds_expr = ds_col.expression
        ds_col.expression = "DATE_ADD(ds, 1)"
        sqla_literal = ds_col.get_timestamp_expression("P1D")
        compiled = "{}".format(sqla_literal.compile())
        if tbl.database.backend == "mysql":
            self.assertEqual(compiled, "DATE(from_unixtime(DATE_ADD(ds, 1)))")
        ds_col.expression = prev_ds_expr

    def query_with_expr_helper(self, is_timeseries, inner_join=True):
        tbl = self.get_table_by_name("birth_names")
        ds_col = tbl.get_column("ds")
        ds_col.expression = None
        ds_col.python_date_format = None
        spec = self.get_database_by_id(tbl.database_id).db_engine_spec
        if not spec.allows_joins and inner_join:
            # if the db does not support inner joins, we cannot force it so
            return None
        old_inner_join = spec.allows_joins
        spec.allows_joins = inner_join
        arbitrary_gby = "state || gender || '_test'"
        arbitrary_metric = dict(
            label="arbitrary", expressionType="SQL", sqlExpression="SUM(sum_boys)"
        )
        query_obj = dict(
            groupby=[arbitrary_gby, "name"],
            metrics=[arbitrary_metric],
            filter=[],
            is_timeseries=is_timeseries,
            columns=[],
            granularity="ds",
            from_dttm=None,
            to_dttm=None,
            extras=dict(time_grain_sqla="P1Y"),
        )
        qr = tbl.query(query_obj)
        self.assertEqual(qr.status, QueryStatus.SUCCESS)
        sql = qr.query
        self.assertIn(arbitrary_gby, sql)
        self.assertIn("name", sql)
        if inner_join and is_timeseries:
            self.assertIn("JOIN", sql.upper())
        else:
            self.assertNotIn("JOIN", sql.upper())
        spec.allows_joins = old_inner_join
        self.assertFalse(qr.df.empty)
        return qr.df

    def test_query_with_expr_groupby_timeseries(self):
        def cannonicalize_df(df):
            ret = df.sort_values(by=list(df.columns.values), inplace=False)
            ret.reset_index(inplace=True, drop=True)
            return ret

        df1 = self.query_with_expr_helper(is_timeseries=True, inner_join=True)
        name_list1 = cannonicalize_df(df1).name.values.tolist()
        df2 = self.query_with_expr_helper(is_timeseries=True, inner_join=False)
        name_list2 = cannonicalize_df(df1).name.values.tolist()
        self.assertFalse(df2.empty)

        expected_namelist = [
            "Anthony",
            "Brian",
            "Christopher",
            "Daniel",
            "David",
            "Eric",
            "James",
            "Jeffrey",
            "John",
            "Joseph",
            "Kenneth",
            "Kevin",
            "Mark",
            "Michael",
            "Paul",
        ]
        assert name_list2 == expected_namelist
        assert name_list1 == expected_namelist

    def test_query_with_expr_groupby(self):
        self.query_with_expr_helper(is_timeseries=False)

    def test_sql_mutator(self):
        tbl = self.get_table_by_name("birth_names")
        query_obj = dict(
            groupby=[],
            metrics=[],
            filter=[],
            is_timeseries=False,
            columns=["name"],
            granularity=None,
            from_dttm=None,
            to_dttm=None,
            extras={},
        )
        sql = tbl.get_query_str(query_obj)
        self.assertNotIn("-- COMMENT", sql)

        def mutator(*args):
            return "-- COMMENT\n" + args[0]

        app.config["SQL_QUERY_MUTATOR"] = mutator
        sql = tbl.get_query_str(query_obj)
        self.assertIn("-- COMMENT", sql)

        app.config["SQL_QUERY_MUTATOR"] = None

    def test_query_with_non_existent_metrics(self):
        tbl = self.get_table_by_name("birth_names")

        query_obj = dict(
            groupby=[],
            metrics=["invalid"],
            filter=[],
            is_timeseries=False,
            columns=["name"],
            granularity=None,
            from_dttm=None,
            to_dttm=None,
            extras={},
        )

        with self.assertRaises(Exception) as context:
            tbl.get_query_str(query_obj)

        self.assertTrue("Metric 'invalid' does not exist", context.exception)

    def test_data_for_slices(self):
        tbl = self.get_table_by_name("birth_names")
        slc = (
            metadata_db.session.query(Slice)
            .filter_by(datasource_id=tbl.id, datasource_type=tbl.type)
            .first()
        )

        data_for_slices = tbl.data_for_slices([slc])
        self.assertEqual(len(data_for_slices["columns"]), 0)
        self.assertEqual(len(data_for_slices["metrics"]), 1)
        self.assertEqual(len(data_for_slices["verbose_map"].keys()), 2)
