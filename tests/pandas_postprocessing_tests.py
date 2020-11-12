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
from datetime import datetime
import math
from typing import Any, List, Optional

from pandas import DataFrame, Series, Timestamp
import pytest

from superset.exceptions import QueryObjectValidationError
from superset.utils import pandas_postprocessing as proc
from superset.utils.core import (
    DTTM_ALIAS,
    PostProcessingContributionOrientation,
    PostProcessingBoxplotWhiskerType,
)

from .base_tests import SupersetTestCase
from .fixtures.dataframes import (
    categories_df,
    lonlat_df,
    names_df,
    timeseries_df,
    prophet_df,
)

AGGREGATES_SINGLE = {"idx_nulls": {"operator": "sum"}}
AGGREGATES_MULTIPLE = {
    "idx_nulls": {"operator": "sum"},
    "asc_idx": {"operator": "mean"},
}


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


def round_floats(
    floats: List[Optional[float]], precision: int
) -> List[Optional[float]]:
    """
    Round list of floats to certain precision

    :param floats: floats to round
    :param precision: intended decimal precision
    :return: rounded floats
    """
    return [round(val, precision) if val else None for val in floats]


class TestPostProcessing(SupersetTestCase):
    def test_flatten_column_after_pivot(self):
        """
        Test pivot column flattening function
        """
        # single aggregate cases
        self.assertEqual(
            proc._flatten_column_after_pivot(
                aggregates=AGGREGATES_SINGLE, column="idx_nulls",
            ),
            "idx_nulls",
        )
        self.assertEqual(
            proc._flatten_column_after_pivot(
                aggregates=AGGREGATES_SINGLE, column=1234,
            ),
            "1234",
        )
        self.assertEqual(
            proc._flatten_column_after_pivot(
                aggregates=AGGREGATES_SINGLE, column=Timestamp("2020-09-29T00:00:00"),
            ),
            "2020-09-29 00:00:00",
        )
        self.assertEqual(
            proc._flatten_column_after_pivot(
                aggregates=AGGREGATES_SINGLE, column="idx_nulls",
            ),
            "idx_nulls",
        )
        self.assertEqual(
            proc._flatten_column_after_pivot(
                aggregates=AGGREGATES_SINGLE, column=("idx_nulls", "col1"),
            ),
            "col1",
        )
        self.assertEqual(
            proc._flatten_column_after_pivot(
                aggregates=AGGREGATES_SINGLE, column=("idx_nulls", "col1", 1234),
            ),
            "col1, 1234",
        )

        # Multiple aggregate cases
        self.assertEqual(
            proc._flatten_column_after_pivot(
                aggregates=AGGREGATES_MULTIPLE, column=("idx_nulls", "asc_idx", "col1"),
            ),
            "idx_nulls, asc_idx, col1",
        )
        self.assertEqual(
            proc._flatten_column_after_pivot(
                aggregates=AGGREGATES_MULTIPLE,
                column=("idx_nulls", "asc_idx", "col1", 1234),
            ),
            "idx_nulls, asc_idx, col1, 1234",
        )

    def test_pivot_without_columns(self):
        """
        Make sure pivot without columns returns correct DataFrame
        """
        df = proc.pivot(df=categories_df, index=["name"], aggregates=AGGREGATES_SINGLE,)
        self.assertListEqual(
            df.columns.tolist(), ["name", "idx_nulls"],
        )
        self.assertEqual(len(df), 101)
        self.assertEqual(df.sum()[1], 1050)

    def test_pivot_with_single_column(self):
        """
        Make sure pivot with single column returns correct DataFrame
        """
        df = proc.pivot(
            df=categories_df,
            index=["name"],
            columns=["category"],
            aggregates=AGGREGATES_SINGLE,
        )
        self.assertListEqual(
            df.columns.tolist(), ["name", "cat0", "cat1", "cat2"],
        )
        self.assertEqual(len(df), 101)
        self.assertEqual(df.sum()[1], 315)

        df = proc.pivot(
            df=categories_df,
            index=["dept"],
            columns=["category"],
            aggregates=AGGREGATES_SINGLE,
        )
        self.assertListEqual(
            df.columns.tolist(), ["dept", "cat0", "cat1", "cat2"],
        )
        self.assertEqual(len(df), 5)

    def test_pivot_with_multiple_columns(self):
        """
        Make sure pivot with multiple columns returns correct DataFrame
        """
        df = proc.pivot(
            df=categories_df,
            index=["name"],
            columns=["category", "dept"],
            aggregates=AGGREGATES_SINGLE,
        )
        self.assertEqual(len(df.columns), 1 + 3 * 5)  # index + possible permutations

    def test_pivot_fill_values(self):
        """
        Make sure pivot with fill values returns correct DataFrame
        """
        df = proc.pivot(
            df=categories_df,
            index=["name"],
            columns=["category"],
            metric_fill_value=1,
            aggregates={"idx_nulls": {"operator": "sum"}},
        )
        self.assertEqual(df.sum()[1], 382)

    def test_pivot_exceptions(self):
        """
        Make sure pivot raises correct Exceptions
        """
        # Missing index
        self.assertRaises(
            TypeError,
            proc.pivot,
            df=categories_df,
            columns=["dept"],
            aggregates=AGGREGATES_SINGLE,
        )

        # invalid index reference
        self.assertRaises(
            QueryObjectValidationError,
            proc.pivot,
            df=categories_df,
            index=["abc"],
            columns=["dept"],
            aggregates=AGGREGATES_SINGLE,
        )

        # invalid column reference
        self.assertRaises(
            QueryObjectValidationError,
            proc.pivot,
            df=categories_df,
            index=["dept"],
            columns=["abc"],
            aggregates=AGGREGATES_SINGLE,
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

        # rename and select one column
        post_df = proc.select(df=timeseries_df, columns=["y"], rename={"y": "y1"})
        self.assertListEqual(post_df.columns.tolist(), ["y1"])

        # rename one and leave one unchanged
        post_df = proc.select(df=timeseries_df, rename={"y": "y1"})
        self.assertListEqual(post_df.columns.tolist(), ["label", "y1"])

        # drop one column
        post_df = proc.select(df=timeseries_df, exclude=["label"])
        self.assertListEqual(post_df.columns.tolist(), ["y"])

        # rename and drop one column
        post_df = proc.select(df=timeseries_df, rename={"y": "y1"}, exclude=["label"])
        self.assertListEqual(post_df.columns.tolist(), ["y1"])

        # invalid columns
        self.assertRaises(
            QueryObjectValidationError,
            proc.select,
            df=timeseries_df,
            columns=["abc"],
            rename={"abc": "qwerty"},
        )

        # select renamed column by new name
        self.assertRaises(
            QueryObjectValidationError,
            proc.select,
            df=timeseries_df,
            columns=["label_new"],
            rename={"label": "label_new"},
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

    def test_geohash_decode(self):
        # decode lon/lat from geohash
        post_df = proc.geohash_decode(
            df=lonlat_df[["city", "geohash"]],
            geohash="geohash",
            latitude="latitude",
            longitude="longitude",
        )
        self.assertListEqual(
            sorted(post_df.columns.tolist()),
            sorted(["city", "geohash", "latitude", "longitude"]),
        )
        self.assertListEqual(
            round_floats(series_to_list(post_df["longitude"]), 6),
            round_floats(series_to_list(lonlat_df["longitude"]), 6),
        )
        self.assertListEqual(
            round_floats(series_to_list(post_df["latitude"]), 6),
            round_floats(series_to_list(lonlat_df["latitude"]), 6),
        )

    def test_geohash_encode(self):
        # encode lon/lat into geohash
        post_df = proc.geohash_encode(
            df=lonlat_df[["city", "latitude", "longitude"]],
            latitude="latitude",
            longitude="longitude",
            geohash="geohash",
        )
        self.assertListEqual(
            sorted(post_df.columns.tolist()),
            sorted(["city", "geohash", "latitude", "longitude"]),
        )
        self.assertListEqual(
            series_to_list(post_df["geohash"]), series_to_list(lonlat_df["geohash"]),
        )

    def test_geodetic_parse(self):
        # parse geodetic string with altitude into lon/lat/altitude
        post_df = proc.geodetic_parse(
            df=lonlat_df[["city", "geodetic"]],
            geodetic="geodetic",
            latitude="latitude",
            longitude="longitude",
            altitude="altitude",
        )
        self.assertListEqual(
            sorted(post_df.columns.tolist()),
            sorted(["city", "geodetic", "latitude", "longitude", "altitude"]),
        )
        self.assertListEqual(
            series_to_list(post_df["longitude"]),
            series_to_list(lonlat_df["longitude"]),
        )
        self.assertListEqual(
            series_to_list(post_df["latitude"]), series_to_list(lonlat_df["latitude"]),
        )
        self.assertListEqual(
            series_to_list(post_df["altitude"]), series_to_list(lonlat_df["altitude"]),
        )

        # parse geodetic string into lon/lat
        post_df = proc.geodetic_parse(
            df=lonlat_df[["city", "geodetic"]],
            geodetic="geodetic",
            latitude="latitude",
            longitude="longitude",
        )
        self.assertListEqual(
            sorted(post_df.columns.tolist()),
            sorted(["city", "geodetic", "latitude", "longitude"]),
        )
        self.assertListEqual(
            series_to_list(post_df["longitude"]),
            series_to_list(lonlat_df["longitude"]),
        )
        self.assertListEqual(
            series_to_list(post_df["latitude"]), series_to_list(lonlat_df["latitude"]),
        )

    def test_contribution(self):
        df = DataFrame(
            {
                DTTM_ALIAS: [
                    datetime(2020, 7, 16, 14, 49),
                    datetime(2020, 7, 16, 14, 50),
                ],
                "a": [1, 3],
                "b": [1, 9],
            }
        )

        # cell contribution across row
        row_df = proc.contribution(df, PostProcessingContributionOrientation.ROW)
        self.assertListEqual(df.columns.tolist(), [DTTM_ALIAS, "a", "b"])
        self.assertListEqual(series_to_list(row_df["a"]), [0.5, 0.25])
        self.assertListEqual(series_to_list(row_df["b"]), [0.5, 0.75])

        # cell contribution across column without temporal column
        df.pop(DTTM_ALIAS)
        column_df = proc.contribution(df, PostProcessingContributionOrientation.COLUMN)
        self.assertListEqual(df.columns.tolist(), ["a", "b"])
        self.assertListEqual(series_to_list(column_df["a"]), [0.25, 0.75])
        self.assertListEqual(series_to_list(column_df["b"]), [0.1, 0.9])

    def test_prophet_valid(self):
        pytest.importorskip("fbprophet")

        df = proc.prophet(
            df=prophet_df, time_grain="P1M", periods=3, confidence_interval=0.9
        )
        columns = {column for column in df.columns}
        assert columns == {
            DTTM_ALIAS,
            "a__yhat",
            "a__yhat_upper",
            "a__yhat_lower",
            "a",
            "b__yhat",
            "b__yhat_upper",
            "b__yhat_lower",
            "b",
        }
        assert df[DTTM_ALIAS].iloc[0].to_pydatetime() == datetime(2018, 12, 31)
        assert df[DTTM_ALIAS].iloc[-1].to_pydatetime() == datetime(2022, 3, 31)
        assert len(df) == 7

        df = proc.prophet(
            df=prophet_df, time_grain="P1M", periods=5, confidence_interval=0.9
        )
        assert df[DTTM_ALIAS].iloc[0].to_pydatetime() == datetime(2018, 12, 31)
        assert df[DTTM_ALIAS].iloc[-1].to_pydatetime() == datetime(2022, 5, 31)
        assert len(df) == 9

    def test_prophet_missing_temporal_column(self):
        df = prophet_df.drop(DTTM_ALIAS, axis=1)

        self.assertRaises(
            QueryObjectValidationError,
            proc.prophet,
            df=df,
            time_grain="P1M",
            periods=3,
            confidence_interval=0.9,
        )

    def test_prophet_incorrect_confidence_interval(self):
        self.assertRaises(
            QueryObjectValidationError,
            proc.prophet,
            df=prophet_df,
            time_grain="P1M",
            periods=3,
            confidence_interval=0.0,
        )

        self.assertRaises(
            QueryObjectValidationError,
            proc.prophet,
            df=prophet_df,
            time_grain="P1M",
            periods=3,
            confidence_interval=1.0,
        )

    def test_prophet_incorrect_periods(self):
        self.assertRaises(
            QueryObjectValidationError,
            proc.prophet,
            df=prophet_df,
            time_grain="P1M",
            periods=0,
            confidence_interval=0.8,
        )

    def test_prophet_incorrect_time_grain(self):
        self.assertRaises(
            QueryObjectValidationError,
            proc.prophet,
            df=prophet_df,
            time_grain="yearly",
            periods=10,
            confidence_interval=0.8,
        )

    def test_boxplot_tukey(self):
        df = proc.boxplot(
            df=names_df,
            groupby=["region"],
            whisker_type=PostProcessingBoxplotWhiskerType.TUKEY,
            metrics=["cars"],
        )
        columns = {column for column in df.columns}
        assert columns == {
            "cars__mean",
            "cars__median",
            "cars__q1",
            "cars__q3",
            "cars__max",
            "cars__min",
            "cars__count",
            "cars__outliers",
            "region",
        }
        assert len(df) == 4

    def test_boxplot_min_max(self):
        df = proc.boxplot(
            df=names_df,
            groupby=["region"],
            whisker_type=PostProcessingBoxplotWhiskerType.MINMAX,
            metrics=["cars"],
        )
        columns = {column for column in df.columns}
        assert columns == {
            "cars__mean",
            "cars__median",
            "cars__q1",
            "cars__q3",
            "cars__max",
            "cars__min",
            "cars__count",
            "cars__outliers",
            "region",
        }
        assert len(df) == 4

    def test_boxplot_percentile(self):
        df = proc.boxplot(
            df=names_df,
            groupby=["region"],
            whisker_type=PostProcessingBoxplotWhiskerType.PERCENTILE,
            metrics=["cars"],
            percentiles=[1, 99],
        )
        columns = {column for column in df.columns}
        assert columns == {
            "cars__mean",
            "cars__median",
            "cars__q1",
            "cars__q3",
            "cars__max",
            "cars__min",
            "cars__count",
            "cars__outliers",
            "region",
        }
        assert len(df) == 4

    def test_boxplot_percentile_incorrect_params(self):
        with pytest.raises(QueryObjectValidationError):
            proc.boxplot(
                df=names_df,
                groupby=["region"],
                whisker_type=PostProcessingBoxplotWhiskerType.PERCENTILE,
                metrics=["cars"],
            )

        with pytest.raises(QueryObjectValidationError):
            proc.boxplot(
                df=names_df,
                groupby=["region"],
                whisker_type=PostProcessingBoxplotWhiskerType.PERCENTILE,
                metrics=["cars"],
                percentiles=[10],
            )

        with pytest.raises(QueryObjectValidationError):
            proc.boxplot(
                df=names_df,
                groupby=["region"],
                whisker_type=PostProcessingBoxplotWhiskerType.PERCENTILE,
                metrics=["cars"],
                percentiles=[90, 10],
            )

        with pytest.raises(QueryObjectValidationError):
            proc.boxplot(
                df=names_df,
                groupby=["region"],
                whisker_type=PostProcessingBoxplotWhiskerType.PERCENTILE,
                metrics=["cars"],
                percentiles=[10, 90, 10],
            )
