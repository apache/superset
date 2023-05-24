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
import json
from superset.utils.core import DatasourceType
import textwrap
import unittest
from unittest import mock

from superset import security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import SupersetException
from superset.utils.core import override_user
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
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
from superset.utils.database import get_example_database

from .base_tests import SupersetTestCase
from .fixtures.energy_dashboard import (
    load_energy_table_with_slice,
    load_energy_table_data,
)


class TestDatabaseModel(SupersetTestCase):
    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("requests"), "requests not installed"
    )
    def test_database_schema_presto(self):
        sqlalchemy_uri = "presto://presto.airbnb.io:8080/hive/default"
        model = Database(database_name="test_database", sqlalchemy_uri=sqlalchemy_uri)

        with model.get_sqla_engine_with_context() as engine:
            db = make_url(engine.url).database
            self.assertEqual("hive/default", db)

        with model.get_sqla_engine_with_context(schema="core_db") as engine:
            db = make_url(engine.url).database
            self.assertEqual("hive/core_db", db)

        sqlalchemy_uri = "presto://presto.airbnb.io:8080/hive"
        model = Database(database_name="test_database", sqlalchemy_uri=sqlalchemy_uri)

        with model.get_sqla_engine_with_context() as engine:
            db = make_url(engine.url).database
            self.assertEqual("hive", db)

        with model.get_sqla_engine_with_context(schema="core_db") as engine:
            db = make_url(engine.url).database
            self.assertEqual("hive/core_db", db)

    def test_database_schema_postgres(self):
        sqlalchemy_uri = "postgresql+psycopg2://postgres.airbnb.io:5439/prod"
        model = Database(database_name="test_database", sqlalchemy_uri=sqlalchemy_uri)

        with model.get_sqla_engine_with_context() as engine:
            db = make_url(engine.url).database
            self.assertEqual("prod", db)

        with model.get_sqla_engine_with_context(schema="foo") as engine:
            db = make_url(engine.url).database
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

        with model.get_sqla_engine_with_context() as engine:
            db = make_url(engine.url).database
            self.assertEqual("default", db)

        with model.get_sqla_engine_with_context(schema="core_db") as engine:
            db = make_url(engine.url).database
            self.assertEqual("core_db", db)

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("MySQLdb"), "mysqlclient not installed"
    )
    def test_database_schema_mysql(self):
        sqlalchemy_uri = "mysql://root@localhost/superset"
        model = Database(database_name="test_database", sqlalchemy_uri=sqlalchemy_uri)

        with model.get_sqla_engine_with_context() as engine:
            db = make_url(engine.url).database
            self.assertEqual("superset", db)

        with model.get_sqla_engine_with_context(schema="staging") as engine:
            db = make_url(engine.url).database
            self.assertEqual("staging", db)

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("MySQLdb"), "mysqlclient not installed"
    )
    def test_database_impersonate_user(self):
        uri = "mysql://root@localhost"
        example_user = security_manager.find_user(username="gamma")
        model = Database(database_name="test_database", sqlalchemy_uri=uri)

        with override_user(example_user):
            model.impersonate_user = True
            with model.get_sqla_engine_with_context() as engine:
                username = make_url(engine.url).username
                self.assertEqual(example_user.username, username)

            model.impersonate_user = False
            with model.get_sqla_engine_with_context() as engine:
                username = make_url(engine.url).username
                self.assertNotEqual(example_user.username, username)

    @mock.patch("superset.models.core.create_engine")
    def test_impersonate_user_presto(self, mocked_create_engine):
        uri = "presto://localhost"
        principal_user = security_manager.find_user(username="gamma")
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

        with override_user(principal_user):
            model = Database(
                database_name="test_database", sqlalchemy_uri=uri, extra=extra
            )
            model.impersonate_user = True
            model._get_sqla_engine()
            call_args = mocked_create_engine.call_args

            assert str(call_args[0][0]) == "presto://gamma@localhost"

            assert call_args[1]["connect_args"] == {
                "protocol": "https",
                "username": "original_user",
                "password": "original_user_password",
                "principal_username": "gamma",
            }

            model.impersonate_user = False
            model._get_sqla_engine()
            call_args = mocked_create_engine.call_args

            assert str(call_args[0][0]) == "presto://localhost"

            assert call_args[1]["connect_args"] == {
                "protocol": "https",
                "username": "original_user",
                "password": "original_user_password",
            }

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("MySQLdb"), "mysqlclient not installed"
    )
    @mock.patch("superset.models.core.create_engine")
    def test_adjust_engine_params_mysql(self, mocked_create_engine):
        model = Database(
            database_name="test_database1",
            sqlalchemy_uri="mysql://user:password@localhost",
        )
        model._get_sqla_engine()
        call_args = mocked_create_engine.call_args

        assert str(call_args[0][0]) == "mysql://user:password@localhost"
        assert call_args[1]["connect_args"]["local_infile"] == 0

        model = Database(
            database_name="test_database2",
            sqlalchemy_uri="mysql+mysqlconnector://user:password@localhost",
        )
        model._get_sqla_engine()
        call_args = mocked_create_engine.call_args

        assert str(call_args[0][0]) == "mysql+mysqlconnector://user:password@localhost"
        assert call_args[1]["connect_args"]["allow_local_infile"] == 0

    @mock.patch("superset.models.core.create_engine")
    def test_impersonate_user_trino(self, mocked_create_engine):
        principal_user = security_manager.find_user(username="gamma")

        with override_user(principal_user):
            model = Database(
                database_name="test_database", sqlalchemy_uri="trino://localhost"
            )
            model.impersonate_user = True
            model._get_sqla_engine()
            call_args = mocked_create_engine.call_args

            assert str(call_args[0][0]) == "trino://localhost"
            assert call_args[1]["connect_args"]["user"] == "gamma"

            model = Database(
                database_name="test_database",
                sqlalchemy_uri="trino://original_user:original_user_password@localhost",
            )

            model.impersonate_user = True
            model._get_sqla_engine()
            call_args = mocked_create_engine.call_args

            assert (
                str(call_args[0][0])
                == "trino://original_user:original_user_password@localhost"
            )
            assert call_args[1]["connect_args"]["user"] == "gamma"

    @mock.patch("superset.models.core.create_engine")
    def test_impersonate_user_hive(self, mocked_create_engine):
        uri = "hive://localhost"
        principal_user = security_manager.find_user(username="gamma")
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

        with override_user(principal_user):
            model = Database(
                database_name="test_database", sqlalchemy_uri=uri, extra=extra
            )
            model.impersonate_user = True
            model._get_sqla_engine()
            call_args = mocked_create_engine.call_args

            assert str(call_args[0][0]) == "hive://localhost"

            assert call_args[1]["connect_args"] == {
                "protocol": "https",
                "username": "original_user",
                "password": "original_user_password",
                "configuration": {"hive.server2.proxy.user": "gamma"},
            }

            model.impersonate_user = False
            model._get_sqla_engine()
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
            database_name="test_database",
            sqlalchemy_uri="mysql://root@localhost",
        )
        model.db_engine_spec.get_dbapi_exception_mapping = mock.Mock(
            return_value={Exception: SupersetException}
        )
        mocked_create_engine.side_effect = Exception()
        with self.assertRaises(SupersetException):
            model._get_sqla_engine()


class TestSqlaTableModel(SupersetTestCase):
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_timestamp_expression(self):
        tbl = self.get_table(name="birth_names")
        ds_col = tbl.get_column("ds")
        sqla_literal = ds_col.get_timestamp_expression(None)
        assert str(sqla_literal.compile()) == "ds"

        sqla_literal = ds_col.get_timestamp_expression("P1D")
        compiled = "{}".format(sqla_literal.compile())
        if tbl.database.backend == "mysql":
            assert compiled == "DATE(ds)"

        prev_ds_expr = ds_col.expression
        ds_col.expression = "DATE_ADD(ds, 1)"
        sqla_literal = ds_col.get_timestamp_expression("P1D")
        compiled = "{}".format(sqla_literal.compile())
        if tbl.database.backend == "mysql":
            assert compiled == "DATE(DATE_ADD(ds, 1))"
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

        def canonicalize_df(df):
            ret = df.sort_values(by=list(df.columns.values), inplace=False)
            ret.reset_index(inplace=True, drop=True)
            return ret

        df1 = self.query_with_expr_helper(is_timeseries=True, inner_join=True)
        name_list1 = canonicalize_df(df1).name.values.tolist()
        df2 = self.query_with_expr_helper(is_timeseries=True, inner_join=False)
        name_list2 = canonicalize_df(df1).name.values.tolist()
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

        def mutator(*args, **kwargs):
            return "-- COMMENT\n" + args[0]

        app.config["SQL_QUERY_MUTATOR"] = mutator
        sql = tbl.get_query_str(query_obj)
        self.assertIn("-- COMMENT", sql)

        app.config["SQL_QUERY_MUTATOR"] = None

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_sql_mutator_different_params(self):
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

        def mutator(sql, database=None, **kwargs):
            return "-- COMMENT\n--" + "\n" + str(database) + "\n" + sql

        app.config["SQL_QUERY_MUTATOR"] = mutator
        mutated_sql = tbl.get_query_str(query_obj)
        self.assertIn("-- COMMENT", mutated_sql)
        self.assertIn(tbl.database.name, mutated_sql)

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
                datasource_id=tbl.id,
                datasource_type=tbl.type,
                slice_name="Genders",
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
        column_names = [col["column_name"] for col in data_for_slices["columns"]]
        assert "name" in column_names
        assert "state" in column_names
        assert set(data_for_slices["verbose_map"].keys()) == {
            "__timestamp",
            "sum__num",
            "name",
            "state",
        }

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_data_for_slices_with_adhoc_column(self):
        # should perform sqla.model.BaseDatasource.data_for_slices() with adhoc
        # column and legacy chart
        tbl = self.get_table(name="birth_names")
        dashboard = self.get_dash_by_slug("births")
        slc = Slice(
            slice_name="slice with adhoc column",
            datasource_type=DatasourceType.TABLE,
            viz_type="table",
            params=json.dumps(
                {
                    "adhoc_filters": [],
                    "granularity_sqla": "ds",
                    "groupby": [
                        "name",
                        {"label": "adhoc_column", "sqlExpression": "name"},
                    ],
                    "metrics": ["sum__num"],
                    "time_range": "No filter",
                    "viz_type": "table",
                }
            ),
            datasource_id=tbl.id,
        )
        dashboard.slices.append(slc)
        datasource_info = slc.datasource.data_for_slices([slc])
        assert "database" in datasource_info

        # clean up and auto commit
        metadata_db.session.delete(slc)
