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
import numpy as np
import pandas as pd

from superset.dataframe import SupersetDataFrame
from superset.table import SupersetTable
from superset.db_engine_specs import BaseEngineSpec
from superset.db_engine_specs.presto import PrestoEngineSpec

from .base_tests import SupersetTestCase


class SupersetDataFrameTestCase(SupersetTestCase):
    def test_get_columns_basic(self):
        data = [("a1", "b1", "c1"), ("a2", "b2", "c2")]
        cursor_descr = (("a", "string"), ("b", "string"), ("c", "string"))
        table = SupersetTable(data, cursor_descr, BaseEngineSpec)
        cdf = SupersetDataFrame(table)
        self.assertEqual(
            cdf.columns,
            [
                {"is_date": False, "type": "STRING", "name": "a", "is_dim": True},
                {"is_date": False, "type": "STRING", "name": "b", "is_dim": True},
                {"is_date": False, "type": "STRING", "name": "c", "is_dim": True},
            ],
        )

    def test_get_columns_with_int(self):
        data = [("a1", 1), ("a2", 2)]
        cursor_descr = (("a", "string"), ("b", "int"))
        table = SupersetTable(data, cursor_descr, BaseEngineSpec)
        cdf = SupersetDataFrame(table)
        self.assertEqual(
            cdf.columns,
            [
                {"is_date": False, "type": "STRING", "name": "a", "is_dim": True},
                {
                    "is_date": False,
                    "type": "INT",
                    "name": "b",
                    "is_dim": False,
                    "agg": "sum",
                },
            ],
        )

    def test_get_columns_type_inference(self):
        data = [(1.2, 1), (3.14, 2)]
        cursor_descr = (("a", None), ("b", None))
        table = SupersetTable(data, cursor_descr, BaseEngineSpec)
        cdf = SupersetDataFrame(table)
        self.assertEqual(
            cdf.columns,
            [
                {
                    "is_date": False,
                    "type": "FLOAT",
                    "name": "a",
                    "is_dim": False,
                    "agg": "sum",
                },
                {
                    "is_date": False,
                    "type": "INT",
                    "name": "b",
                    "is_dim": False,
                    "agg": "sum",
                },
            ],
        )

    def test_is_date(self):
        f = SupersetDataFrame.is_date
        self.assertEqual(f(np.dtype("M"), ""), True)
        self.assertEqual(f(np.dtype("f"), "DATETIME"), True)
        self.assertEqual(f(np.dtype("i"), "TIMESTAMP"), True)
        self.assertEqual(f(None, "DATETIME"), True)
        self.assertEqual(f(None, "TIMESTAMP"), True)

        self.assertEqual(f(None, ""), False)
        self.assertEqual(f(np.dtype(np.int32), ""), False)

    def test_dedup_with_data(self):
        data = [("a", 1), ("a", 2)]
        cursor_descr = (("a", "string"), ("a", "string"))
        table = SupersetTable(data, cursor_descr, BaseEngineSpec)
        cdf = SupersetDataFrame(table)
        self.assertListEqual(cdf.column_names, ["a", "a__1"])

    def test_int64_with_missing_data(self):
        data = [(None,), (1239162456494753670,), (None,), (None,), (None,), (None,)]
        cursor_descr = [("user_id", "bigint", None, None, None, None, True)]

        # int64 coluns with null values are interpreted as dtype `object`
        # in order to prevent precision loss due to the default float64 dtype
        table = SupersetTable(data, cursor_descr, BaseEngineSpec)
        cdf = SupersetDataFrame(table)
        np.testing.assert_array_equal(
            cdf.raw_df.values.tolist(),
            [[np.nan], [1239162456494753670], [np.nan], [np.nan], [np.nan], [np.nan]],
        )

    def test_pandas_datetime64(self):
        data = [(None,)]
        cursor_descr = [("ds", "timestamp", None, None, None, None, True)]
        table = SupersetTable(data, cursor_descr, PrestoEngineSpec)
        cdf = SupersetDataFrame(table)
        self.assertEqual(cdf.raw_df.dtypes[0], np.dtype("<M8[ns]"))

    def test_no_type_coercion(self):
        data = [("a", 1), ("b", 2)]
        cursor_descr = [
            ("one", "varchar", None, None, None, None, True),
            ("two", "integer", None, None, None, None, True),
        ]
        table = SupersetTable(data, cursor_descr, PrestoEngineSpec)
        cdf = SupersetDataFrame(table)
        self.assertEqual(cdf.raw_df.dtypes[0], np.dtype("O"))
        self.assertEqual(cdf.raw_df.dtypes[1], pd.Int64Dtype())

    def test_empty_data(self):
        data = []
        cursor_descr = [
            ("one", "varchar", None, None, None, None, True),
            ("two", "integer", None, None, None, None, True),
        ]
        table = SupersetTable(data, cursor_descr, PrestoEngineSpec)
        cdf = SupersetDataFrame(table)
        self.assertEqual(cdf.raw_df.dtypes[0], np.dtype("O"))
        self.assertEqual(cdf.raw_df.dtypes[1], pd.Int64Dtype())
