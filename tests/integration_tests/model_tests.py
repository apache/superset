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
from unittest import mock

from superset.exceptions import SupersetException
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
)

import pytest
from sqlalchemy.engine.url import make_url
from sqlalchemy.types import DateTime

import tests.integration_tests.test_app
from superset import app, db as metadata_db
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.common.db_query_status import QueryStatus
from superset.models.core import Database
from superset.models.slice import Slice
from superset.models.sql_types.base import literal_dttm_type_factory
from superset.utils.core import get_example_database

from .base_tests import SupersetTestCase
from .fixtures.energy_dashboard import load_energy_table_with_slice


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

    @mock.patch("superset.models.core.create_engine")
    def test_impersonate_user_presto(self, mocked_create_engine):
        uri = "presto://localhost"
        principal_user = "logged_in_user"
        extra = """
                {
                    "metadata_params": {},
                    "engine_params": {
                               "connect_args":{
                                  "protocol": "https",
                                  "username":"original_user",
                                  "password":"original_user_password"
                               }
                    },
                    "metadata_cache_timeout": {},
                    "schemas_allowed_for_file_upload": []
                }
                """

        model = Database(database_name="test_database", sqlalchemy_uri=uri, extra=extra)

        model.impersonate_user = True
        model.get_sqla_engine(user_name=principal_user)
        call_args = mocked_create_engine.call_args

        assert str(call_args[0][0]) == "presto://logged_in_user@localhost"

        assert call_args[1]["connect_args"] == {
            "protocol": "https",
            "username": "original_user",
            "password": "original_user_password",
            "principal_username": "logged_in_user",
        }

        model.impersonate_user = False
        model.get_sqla_engine(user_name=principal_user)
        call_args = mocked_create_engine.call_args

        assert str(call_args[0][0]) == "presto://localhost"

        assert call_args[1]["connect_args"] == {
            "protocol": "https",
            "username": "original_user",
            "password": "original_user_password",
        }

    @mock.patch("superset.models.core.create_engine")
    def test_impersonate_user_trino(self, mocked_create_engine):
        uri = "trino://localhost"
        principal_user = "logged_in_user"

        model = Database(database_name="test_database", sqlalchemy_uri=uri)

        model.impersonate_user = True
        model.get_sqla_engine(user_name=principal_user)
        call_args = mocked_create_engine.call_args

        assert str(call_args[0][0]) == "trino://localhost"

        assert call_args[1]["connect_args"] == {
            "user": "logged_in_user",
        }

        uri = "trino://original_user:original_user_password@localhost"
        model = Database(database_name="test_database", sqlalchemy_uri=uri)
        model.impersonate_user = True
        model.get_sqla_engine(user_name=principal_user)
        call_args = mocked_create_engine.call_args

        assert str(call_args[0][0]) == "trino://original_user@localhost"

        assert call_args[1]["connect_args"] == {"user": "logged_in_user"}

    @mock.patch("superset.models.core.create_engine")
    def test_impersonate_user_hive(self, mocked_create_engine):
        uri = "hive://localhost"
        principal_user = "logged_in_user"
        extra = """
                {
                    "metadata_params": {},
                    "engine_params": {
                               "connect_args":{
                                  "protocol": "https",
                                  "username":"original_user",
                                  "password":"original_user_password"
                               }
                    },
                    "metadata_cache_timeout": {},
                    "schemas_allowed_for_file_upload": []
                }
                """

        model = Database(database_name="test_database", sqlalchemy_uri=uri, extra=extra)

        model.impersonate_user = True
        model.get_sqla_engine(user_name=principal_user)
        call_args = mocked_create_engine.call_args

        assert str(call_args[0][0]) == "hive://localhost"

        assert call_args[1]["connect_args"] == {
            "protocol": "https",
            "username": "original_user",
            "password": "original_user_password",
            "configuration": {"hive.server2.proxy.user": "logged_in_user"},
        }

        model.impersonate_user = False
        model.get_sqla_engine(user_name=principal_user)
        call_args = mocked_create_engine.call_args

        assert str(call_args[0][0]) == "hive://localhost"

        assert call_args[1]["connect_args"] == {
            "protocol": "https",
            "username": "original_user",
            "password": "original_user_password",
        }

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_select_star(self):
        db = get_example_database()
        table_name = "energy_usage"
        sql = db.select_star(table_name, show_cols=False, latest_partition=False)
        quote = db.inspector.engine.dialect.identifier_preparer.quote_identifier
        expected = (
            textwrap.dedent(
                f"""\
        SELECT *
        FROM {quote(table_name)}
        LIMIT 100"""
            )
            if db.backend in {"presto", "hive"}
            else textwrap.dedent(
                f"""\
        SELECT *
        FROM {table_name}
        LIMIT 100"""
            )
        )
        assert expected in sql
        sql = db.select_star(table_name, show_cols=True, latest_partition=False)
        # TODO(bkyryliuk): unify sql generation
        if db.backend == "presto":
            assert (
                textwrap.dedent(
                    """\
                SELECT "source" AS "source",
                       "target" AS "target",
                       "value" AS "value"
                FROM "energy_usage"
                LIMIT 100"""
                )
                == sql
            )
        elif db.backend == "hive":
            assert (
                textwrap.dedent(
                    """\
                SELECT `source`,
                       `target`,
                       `value`
                FROM `energy_usage`
                LIMIT 100"""
                )
                == sql
            )
        else:
            assert (
                textwrap.dedent(
                    """\
                SELECT source,
                       target,
                       value
                FROM energy_usage
                LIMIT 100"""
                )
                in sql
            )

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

    @mock.patch("superset.models.core.create_engine")
    def test_get_sqla_engine(self, mocked_create_engine):
        model = Database(
            database_name="test_database", sqlalchemy_uri="mysql://root@localhost",
        )
        model.db_engine_spec.get_dbapi_exception_mapping = mock.Mock(
            return_value={Exception: SupersetException}
        )
        mocked_create_engine.side_effect = Exception()
        with self.assertRaises(SupersetException):
            model.get_sqla_engine()


class TestSqlaTableModel(SupersetTestCase):
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_timestamp_expression(self):
        col_type = (
            "VARCHAR"
            if get_example_database().backend == "presto"
            else "TemporalWrapperType"
        )
        tbl = self.get_table(name="birth_names")
        ds_col = tbl.get_column("ds")
        sqla_literal = ds_col.get_timestamp_expression(None)
        self.assertEqual(str(sqla_literal.compile()), "ds")
        assert type(sqla_literal.type).__name__ == col_type

        sqla_literal = ds_col.get_timestamp_expression("P1D")
        assert type(sqla_literal.type).__name__ == col_type
        compiled = "{}".format(sqla_literal.compile())
        if tbl.database.backend == "mysql":
            self.assertEqual(compiled, "DATE(ds)")

        prev_ds_expr = ds_col.expression
        ds_col.expression = "DATE_ADD(ds, 1)"
        sqla_literal = ds_col.get_timestamp_expression("P1D")
        assert type(sqla_literal.type).__name__ == col_type
        compiled = "{}".format(sqla_literal.compile())
        if tbl.database.backend == "mysql":
            self.assertEqual(compiled, "DATE(DATE_ADD(ds, 1))")
        ds_col.expression = prev_ds_expr

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_timestamp_expression_epoch(self):
        tbl = self.get_table(name="birth_names")
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
        tbl = self.get_table(name="birth_names")
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
            label="arbitrary", expressionType="SQL", sqlExpression="SUM(num_boys)"
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
            series_limit=15 if inner_join and is_timeseries else None,
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

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_query_with_expr_groupby_timeseries(self):
        if get_example_database().backend == "presto":
            # TODO(bkyryliuk): make it work for presto.
            return

        def cannonicalize_df(df):
            ret = df.sort_values(by=list(df.columns.values), inplace=False)
            ret.reset_index(inplace=True, drop=True)
            return ret

        df1 = self.query_with_expr_helper(is_timeseries=True, inner_join=True)
        name_list1 = cannonicalize_df(df1).name.values.tolist()
        df2 = self.query_with_expr_helper(is_timeseries=True, inner_join=False)
        name_list2 = cannonicalize_df(df1).name.values.tolist()
        self.assertFalse(df2.empty)

        assert name_list2 == name_list1

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_query_with_expr_groupby(self):
        self.query_with_expr_helper(is_timeseries=False)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_sql_mutator(self):
        tbl = self.get_table(name="birth_names")
        query_obj = dict(
            groupby=[],
            metrics=None,
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
        tbl = self.get_table(name="birth_names")

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

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_data_for_slices_with_no_query_context(self):
        tbl = self.get_table(name="birth_names")
        slc = (
            metadata_db.session.query(Slice)
            .filter_by(
                datasource_id=tbl.id, datasource_type=tbl.type, slice_name="Genders",
            )
            .first()
        )
        data_for_slices = tbl.data_for_slices([slc])
        assert len(data_for_slices["metrics"]) == 1
        assert len(data_for_slices["columns"]) == 1
        assert data_for_slices["metrics"][0]["metric_name"] == "sum__num"
        assert data_for_slices["columns"][0]["column_name"] == "gender"
        assert set(data_for_slices["verbose_map"].keys()) == {
            "__timestamp",
            "sum__num",
            "gender",
        }

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_data_for_slices_with_query_context(self):
        tbl = self.get_table(name="birth_names")
        slc = (
            metadata_db.session.query(Slice)
            .filter_by(
                datasource_id=tbl.id,
                datasource_type=tbl.type,
                slice_name="Pivot Table v2",
            )
            .first()
        )
        data_for_slices = tbl.data_for_slices([slc])
        assert len(data_for_slices["metrics"]) == 1
        assert len(data_for_slices["columns"]) == 2
        assert data_for_slices["metrics"][0]["metric_name"] == "sum__num"
        assert data_for_slices["columns"][0]["column_name"] == "name"
        assert set(data_for_slices["verbose_map"].keys()) == {
            "__timestamp",
            "sum__num",
            "name",
            "state",
        }


def test_literal_dttm_type_factory():
    orig_type = DateTime()
    new_type = literal_dttm_type_factory(orig_type, PostgresEngineSpec, "TIMESTAMP")
    assert type(new_type).__name__ == "TemporalWrapperType"
    assert str(new_type) == str(orig_type)
