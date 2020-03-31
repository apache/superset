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
from superset.utils import pandas_postprocessing as proc

from .base_tests import SupersetTestCase
from .fixtures.dataframes import categories_df, timeseries_df


class PostProcessingTestCase(SupersetTestCase):
    def test_aggregate_with_named_aggregators(self):
        aggregates = {
            "asc sum": {"column": "asc_idx", "operator": "sum"},
            "asc q2": {
                "column": "asc_idx",
                "operator": "percentile",
                "options": {"q": 75},
            },
            "desc q1": {
                "column": "desc_idx",
                "operator": "percentile",
                "options": {"q": 25},
            },
        }
        df = proc.aggregate(
            df=categories_df, groupby=["constant"], aggregates=aggregates
        )
        data = df.to_dict(orient="series")

        self.assertEqual(data["asc sum"][0], 5050)
        self.assertEqual(data["asc q2"][0], 75)
        self.assertEqual(data["desc q1"][0], 25)

    def test_pivot_basic_functionality(self):
        aggregates = {"idx_nulls": {"operator": "sum"}}

        df = proc.pivot(
            df=categories_df,
            index=["name"],
            columns=["category"],
            aggregates=aggregates,
        )
        self.assertListEqual(
            list(idx[1] for idx in df.columns), ["cat0", "cat1", "cat2"]
        )
        self.assertEqual(len(df), 101)
        self.assertEqual(df.sum()[0], 315)

        df = proc.pivot(
            df=categories_df,
            index=["dept"],
            columns=["category"],
            aggregates=aggregates,
        )
        self.assertEqual(len(df), 5)

    def test_pivot_metric_fill_value(self):
        aggregates = {"idx_nulls": {}}  # should default to sum
        df = proc.pivot(
            df=categories_df,
            index=["name"],
            columns=["category"],
            metric_fill_value=1,
            aggregates=aggregates,
        )
        self.assertEqual(df.sum()[0], 382)

    def test_sort(self):
        df = proc.sort(
            df=categories_df, by=["category", "asc_idx"], ascending={"asc_idx": False}
        )
        self.assertEqual(96, df["asc_idx"].reset_index(drop=True)[1])

    def test_rolling(self):
        post_df = proc.rolling(df=timeseries_df, rolling_type="cumsum", window=0)

        self.assertListEqual(post_df["y"].tolist(), [1.0, 3.0, 6.0, 10.0])

        post_df = proc.rolling(
            df=timeseries_df, rolling_type="sum", window=2, min_periods=0
        )

        self.assertListEqual(post_df["y"].tolist(), [1.0, 3.0, 5.0, 7.0])

        post_df = proc.rolling(
            df=timeseries_df, rolling_type="mean", window=10, min_periods=0
        )
        self.assertListEqual(post_df["y"].tolist(), [1.0, 1.5, 2.0, 2.5])

        post_df = proc.rolling(
            df=timeseries_df, rolling_type="count", window=10, min_periods=0
        )
        self.assertListEqual(post_df["y"].tolist(), [1.0, 2.0, 3.0, 4.0])
