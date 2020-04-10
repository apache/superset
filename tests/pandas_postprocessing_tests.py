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
import math
from typing import Any, List

from pandas import Series

from superset.exceptions import QueryObjectValidationError
from superset.utils import pandas_postprocessing as proc

from .base_tests import SupersetTestCase
from .fixtures.dataframes import categories_df, timeseries_df


def series_to_list(series: Series) -> List[Any]:
    """
    Converts a `Series` to a regular list, and replaces non-numeric values to
    Nones.

    :param series: Series to convert
    :return: list without nan or inf
    """
    return [
        None
        if not isinstance(val, str) and (math.isnan(val) or math.isinf(val))
        else val
        for val in series.tolist()
    ]


class PostProcessingTestCase(SupersetTestCase):
    def test_pivot(self):
        aggregates = {"idx_nulls": {"operator": "sum"}}

        # regular pivot
        df = proc.pivot(
            df=categories_df,
            index=["name"],
            columns=["category"],
            aggregates=aggregates,
        )
        self.assertListEqual(
            df.columns.tolist(),
            [("idx_nulls", "cat0"), ("idx_nulls", "cat1"), ("idx_nulls", "cat2")],
        )
        self.assertEqual(len(df), 101)
        self.assertEqual(df.sum()[0], 315)

        # regular pivot
        df = proc.pivot(
            df=categories_df,
            index=["dept"],
            columns=["category"],
            aggregates=aggregates,
        )
        self.assertEqual(len(df), 5)

        # fill value
        df = proc.pivot(
            df=categories_df,
            index=["name"],
            columns=["category"],
            metric_fill_value=1,
            aggregates={"idx_nulls": {"operator": "sum"}},
        )
        self.assertEqual(df.sum()[0], 382)

        # invalid index reference
        self.assertRaises(
            QueryObjectValidationError,
            proc.pivot,
            df=categories_df,
            index=["abc"],
            columns=["dept"],
            aggregates=aggregates,
        )

        # invalid column reference
        self.assertRaises(
            QueryObjectValidationError,
            proc.pivot,
            df=categories_df,
            index=["dept"],
            columns=["abc"],
            aggregates=aggregates,
        )

        # invalid aggregate options
        self.assertRaises(
            QueryObjectValidationError,
            proc.pivot,
            df=categories_df,
            index=["name"],
            columns=["category"],
            aggregates={"idx_nulls": {}},
        )

    def test_aggregate(self):
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
        self.assertListEqual(
            df.columns.tolist(), ["constant", "asc sum", "asc q2", "desc q1"]
        )
        self.assertEqual(series_to_list(df["asc sum"])[0], 5050)
        self.assertEqual(series_to_list(df["asc q2"])[0], 75)
        self.assertEqual(series_to_list(df["desc q1"])[0], 25)

    def test_sort(self):
        df = proc.sort(df=categories_df, columns={"category": True, "asc_idx": False})
        self.assertEqual(96, series_to_list(df["asc_idx"])[1])

        self.assertRaises(
            QueryObjectValidationError, proc.sort, df=df, columns={"abc": True}
        )

    def test_rolling(self):
        # sum rolling type
        post_df = proc.rolling(
            df=timeseries_df,
            columns={"y": "y"},
            rolling_type="sum",
            window=2,
            min_periods=0,
        )

        self.assertListEqual(post_df.columns.tolist(), ["label", "y"])
        self.assertListEqual(series_to_list(post_df["y"]), [1.0, 3.0, 5.0, 7.0])

        # mean rolling type with alias
        post_df = proc.rolling(
            df=timeseries_df,
            rolling_type="mean",
            columns={"y": "y_mean"},
            window=10,
            min_periods=0,
        )
        self.assertListEqual(post_df.columns.tolist(), ["label", "y", "y_mean"])
        self.assertListEqual(series_to_list(post_df["y_mean"]), [1.0, 1.5, 2.0, 2.5])

        # count rolling type
        post_df = proc.rolling(
            df=timeseries_df,
            rolling_type="count",
            columns={"y": "y"},
            window=10,
            min_periods=0,
        )
        self.assertListEqual(post_df.columns.tolist(), ["label", "y"])
        self.assertListEqual(series_to_list(post_df["y"]), [1.0, 2.0, 3.0, 4.0])

        # quantile rolling type
        post_df = proc.rolling(
            df=timeseries_df,
            columns={"y": "q1"},
            rolling_type="quantile",
            rolling_type_options={"quantile": 0.25},
            window=10,
            min_periods=0,
        )
        self.assertListEqual(post_df.columns.tolist(), ["label", "y", "q1"])
        self.assertListEqual(series_to_list(post_df["q1"]), [1.0, 1.25, 1.5, 1.75])

        # incorrect rolling type
        self.assertRaises(
            QueryObjectValidationError,
            proc.rolling,
            df=timeseries_df,
            columns={"y": "y"},
            rolling_type="abc",
            window=2,
        )

        # incorrect rolling type options
        self.assertRaises(
            QueryObjectValidationError,
            proc.rolling,
            df=timeseries_df,
            columns={"y": "y"},
            rolling_type="quantile",
            rolling_type_options={"abc": 123},
            window=2,
        )

    def test_select(self):
        # reorder columns
        post_df = proc.select(df=timeseries_df, columns=["y", "label"])
        self.assertListEqual(post_df.columns.tolist(), ["y", "label"])

        # one column
        post_df = proc.select(df=timeseries_df, columns=["label"])
        self.assertListEqual(post_df.columns.tolist(), ["label"])

        # rename one column
        post_df = proc.select(df=timeseries_df, columns=["y"], rename={"y": "y1"})
        self.assertListEqual(post_df.columns.tolist(), ["y1"])

        # rename one and leave one unchanged
        post_df = proc.select(
            df=timeseries_df, columns=["label", "y"], rename={"y": "y1"}
        )
        self.assertListEqual(post_df.columns.tolist(), ["label", "y1"])

        # invalid columns
        self.assertRaises(
            QueryObjectValidationError,
            proc.select,
            df=timeseries_df,
            columns=["qwerty"],
            rename={"abc": "qwerty"},
        )

    def test_diff(self):
        # overwrite column
        post_df = proc.diff(df=timeseries_df, columns={"y": "y"})
        self.assertListEqual(post_df.columns.tolist(), ["label", "y"])
        self.assertListEqual(series_to_list(post_df["y"]), [None, 1.0, 1.0, 1.0])

        # add column
        post_df = proc.diff(df=timeseries_df, columns={"y": "y1"})
        self.assertListEqual(post_df.columns.tolist(), ["label", "y", "y1"])
        self.assertListEqual(series_to_list(post_df["y"]), [1.0, 2.0, 3.0, 4.0])
        self.assertListEqual(series_to_list(post_df["y1"]), [None, 1.0, 1.0, 1.0])

        # look ahead
        post_df = proc.diff(df=timeseries_df, columns={"y": "y1"}, periods=-1)
        self.assertListEqual(series_to_list(post_df["y1"]), [-1.0, -1.0, -1.0, None])

        # invalid column reference
        self.assertRaises(
            QueryObjectValidationError,
            proc.diff,
            df=timeseries_df,
            columns={"abc": "abc"},
        )

    def test_cum(self):
        # create new column (cumsum)
        post_df = proc.cum(df=timeseries_df, columns={"y": "y2"}, operator="sum",)
        self.assertListEqual(post_df.columns.tolist(), ["label", "y", "y2"])
        self.assertListEqual(series_to_list(post_df["label"]), ["x", "y", "z", "q"])
        self.assertListEqual(series_to_list(post_df["y"]), [1.0, 2.0, 3.0, 4.0])
        self.assertListEqual(series_to_list(post_df["y2"]), [1.0, 3.0, 6.0, 10.0])

        # overwrite column (cumprod)
        post_df = proc.cum(df=timeseries_df, columns={"y": "y"}, operator="prod",)
        self.assertListEqual(post_df.columns.tolist(), ["label", "y"])
        self.assertListEqual(series_to_list(post_df["y"]), [1.0, 2.0, 6.0, 24.0])

        # overwrite column (cummin)
        post_df = proc.cum(df=timeseries_df, columns={"y": "y"}, operator="min",)
        self.assertListEqual(post_df.columns.tolist(), ["label", "y"])
        self.assertListEqual(series_to_list(post_df["y"]), [1.0, 1.0, 1.0, 1.0])

        # invalid operator
        self.assertRaises(
            QueryObjectValidationError,
            proc.cum,
            df=timeseries_df,
            columns={"y": "y"},
            operator="abc",
        )
