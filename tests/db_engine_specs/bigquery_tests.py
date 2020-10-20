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
import sys
import unittest.mock as mock

from pandas import DataFrame
from sqlalchemy import column

from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.bigquery import BigQueryEngineSpec
from tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestBigQueryDbEngineSpec(TestDbEngineSpec):
    def test_bigquery_sqla_column_label(self):
        """
        DB Eng Specs (bigquery): Test column label
        """
        test_cases = {
            "Col": "Col",
            "SUM(x)": "SUM_x__5f110",
            "SUM[x]": "SUM_x__7ebe1",
            "12345_col": "_12345_col_8d390",
        }
        for original, expected in test_cases.items():
            actual = BigQueryEngineSpec.make_label_compatible(column(original).name)
            self.assertEqual(actual, expected)

    def test_convert_dttm(self):
        """
        DB Eng Specs (bigquery): Test conversion to date time
        """
        dttm = self.get_dttm()
        test_cases = {
            "DATE": "CAST('2019-01-02' AS DATE)",
            "DATETIME": "CAST('2019-01-02T03:04:05.678900' AS DATETIME)",
            "TIMESTAMP": "CAST('2019-01-02T03:04:05.678900' AS TIMESTAMP)",
            "TIME": "CAST('03:04:05.678900' AS TIME)",
            "UNKNOWNTYPE": None,
        }

        for target_type, expected in test_cases.items():
            actual = BigQueryEngineSpec.convert_dttm(target_type, dttm)
            self.assertEqual(actual, expected)

    def test_timegrain_expressions(self):
        """
        DB Eng Specs (bigquery): Test time grain expressions
        """
        col = column("temporal")
        test_cases = {
            "DATE": "DATE_TRUNC(temporal, HOUR)",
            "TIME": "TIME_TRUNC(temporal, HOUR)",
            "DATETIME": "DATETIME_TRUNC(temporal, HOUR)",
            "TIMESTAMP": "TIMESTAMP_TRUNC(temporal, HOUR)",
        }
        for type_, expected in test_cases.items():
            actual = BigQueryEngineSpec.get_timestamp_expr(
                col=col, pdf=None, time_grain="PT1H", type_=type_
            )
            self.assertEqual(str(actual), expected)

    def test_fetch_data(self):
        """
        DB Eng Specs (bigquery): Test fetch data
        """
        # Mock a google.cloud.bigquery.table.Row
        class Row(object):
            def __init__(self, value):
                self._value = value

            def values(self):
                return self._value

        data1 = [(1, "foo")]
        with mock.patch.object(BaseEngineSpec, "fetch_data", return_value=data1):
            result = BigQueryEngineSpec.fetch_data(None, 0)
        self.assertEqual(result, data1)

        data2 = [Row(1), Row(2)]
        with mock.patch.object(BaseEngineSpec, "fetch_data", return_value=data2):
            result = BigQueryEngineSpec.fetch_data(None, 0)
        self.assertEqual(result, [1, 2])

    def test_extra_table_metadata(self):
        """
        DB Eng Specs (bigquery): Test extra table metadata
        """
        database = mock.Mock()
        # Test no indexes
        database.get_indexes = mock.MagicMock(return_value=None)
        result = BigQueryEngineSpec.extra_table_metadata(
            database, "some_table", "some_schema"
        )
        self.assertEqual(result, {})

        index_metadata = [
            {"name": "clustering", "column_names": ["c_col1", "c_col2", "c_col3"],},
            {"name": "partition", "column_names": ["p_col1", "p_col2", "p_col3"],},
        ]
        expected_result = {
            "partitions": {"cols": [["p_col1", "p_col2", "p_col3"]]},
            "clustering": {"cols": [["c_col1", "c_col2", "c_col3"]]},
        }
        database.get_indexes = mock.MagicMock(return_value=index_metadata)
        result = BigQueryEngineSpec.extra_table_metadata(
            database, "some_table", "some_schema"
        )
        self.assertEqual(result, expected_result)

    def test_normalize_indexes(self):
        """
        DB Eng Specs (bigquery): Test extra table metadata
        """
        indexes = [{"name": "partition", "column_names": [None], "unique": False}]
        normalized_idx = BigQueryEngineSpec.normalize_indexes(indexes)
        self.assertEqual(normalized_idx, [])

        indexes = [{"name": "partition", "column_names": ["dttm"], "unique": False}]
        normalized_idx = BigQueryEngineSpec.normalize_indexes(indexes)
        self.assertEqual(normalized_idx, indexes)

        indexes = [
            {"name": "partition", "column_names": ["dttm", None], "unique": False}
        ]
        normalized_idx = BigQueryEngineSpec.normalize_indexes(indexes)
        self.assertEqual(
            normalized_idx,
            [{"name": "partition", "column_names": ["dttm"], "unique": False}],
        )

    def test_df_to_sql(self):
        """
        DB Eng Specs (bigquery): Test DataFrame to SQL contract
        """
        # test missing google.oauth2 dependency
        sys.modules["pandas_gbq"] = mock.MagicMock()
        df = DataFrame()
        self.assertRaisesRegexp(
            Exception,
            "Could not import libraries",
            BigQueryEngineSpec.df_to_sql,
            df,
            con="some_connection",
            schema="schema",
            name="name",
        )

        invalid_kwargs = [
            {"name": "some_name"},
            {"schema": "some_schema"},
            {"con": "some_con"},
            {"name": "some_name", "con": "some_con"},
            {"name": "some_name", "schema": "some_schema"},
            {"con": "some_con", "schema": "some_schema"},
        ]
        # Test check for missing required kwargs (name, schema, con)
        sys.modules["google.oauth2"] = mock.MagicMock()
        for invalid_kwarg in invalid_kwargs:
            self.assertRaisesRegexp(
                Exception,
                "name, schema and con need to be defined in kwargs",
                BigQueryEngineSpec.df_to_sql,
                df,
                **invalid_kwarg,
            )

        import pandas_gbq
        from google.oauth2 import service_account

        pandas_gbq.to_gbq = mock.Mock()
        service_account.Credentials.from_service_account_info = mock.MagicMock(
            return_value="account_info"
        )
        connection = mock.Mock()
        connection.engine.url.host = "google-host"
        connection.dialect.credentials_info = "secrets"

        BigQueryEngineSpec.df_to_sql(
            df, con=connection, schema="schema", name="name", if_exists="extra_key"
        )

        pandas_gbq.to_gbq.assert_called_with(
            df,
            project_id="google-host",
            destination_table="schema.name",
            credentials="account_info",
            if_exists="extra_key",
        )
