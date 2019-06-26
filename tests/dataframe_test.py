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

from superset.dataframe import dedup, SupersetDataFrame
from superset.db_engine_specs import BaseEngineSpec
from .base_tests import SupersetTestCase


class SupersetDataFrameTestCase(SupersetTestCase):
    def test_dedup(self):
        self.assertEquals(dedup(["foo", "bar"]), ["foo", "bar"])
        self.assertEquals(
            dedup(["foo", "bar", "foo", "bar", "Foo"]),
            ["foo", "bar", "foo__1", "bar__1", "Foo"],
        )
        self.assertEquals(
            dedup(["foo", "bar", "bar", "bar", "Bar"]),
            ["foo", "bar", "bar__1", "bar__2", "Bar"],
        )
        self.assertEquals(
            dedup(["foo", "bar", "bar", "bar", "Bar"], case_sensitive=False),
            ["foo", "bar", "bar__1", "bar__2", "Bar__3"],
        )

    def test_get_columns_basic(self):
        data = [("a1", "b1", "c1"), ("a2", "b2", "c2")]
        cursor_descr = (("a", "string"), ("b", "string"), ("c", "string"))
        cdf = SupersetDataFrame(data, cursor_descr, BaseEngineSpec)
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
        cdf = SupersetDataFrame(data, cursor_descr, BaseEngineSpec)
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
        cdf = SupersetDataFrame(data, cursor_descr, BaseEngineSpec)
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
        self.assertEquals(f(np.dtype("M"), ""), True)
        self.assertEquals(f(np.dtype("f"), "DATETIME"), True)
        self.assertEquals(f(np.dtype("i"), "TIMESTAMP"), True)
        self.assertEquals(f(None, "DATETIME"), True)
        self.assertEquals(f(None, "TIMESTAMP"), True)

        self.assertEquals(f(None, ""), False)
        self.assertEquals(f(np.dtype(np.int32), ""), False)

    def test_dedup_with_data(self):
        data = [("a", 1), ("a", 2)]
        cursor_descr = (("a", "string"), ("a", "string"))
        cdf = SupersetDataFrame(data, cursor_descr, BaseEngineSpec)
        self.assertListEqual(cdf.column_names, ["a", "a__1"])
