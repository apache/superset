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
import numpy as np
import pandas as pd

import tests.test_app
from superset.dataframe import df_to_records
from superset.db_engine_specs import BaseEngineSpec
from superset.result_set import SupersetResultSet

from .base_tests import SupersetTestCase


class TestSupersetDataFrame(SupersetTestCase):
    def test_df_to_records(self):
        data = [("a1", "b1", "c1"), ("a2", "b2", "c2")]
        cursor_descr = (("a", "string"), ("b", "string"), ("c", "string"))
        results = SupersetResultSet(data, cursor_descr, BaseEngineSpec)
        df = results.to_pandas_df()

        self.assertEqual(
            df_to_records(df),
            [{"a": "a1", "b": "b1", "c": "c1"}, {"a": "a2", "b": "b2", "c": "c2"}],
        )

    def test_js_max_int(self):
        data = [(1, 1239162456494753670, "c1"), (2, 100, "c2")]
        cursor_descr = (("a", "int"), ("b", "int"), ("c", "string"))
        results = SupersetResultSet(data, cursor_descr, BaseEngineSpec)
        df = results.to_pandas_df()

        self.assertEqual(
            df_to_records(df),
            [
                {"a": 1, "b": "1239162456494753670", "c": "c1"},
                {"a": 2, "b": 100, "c": "c2"},
            ],
        )
