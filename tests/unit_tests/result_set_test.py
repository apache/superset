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

# pylint: disable=import-outside-toplevel, unused-argument

from datetime import datetime, timezone

import numpy as np
import pandas as pd
from numpy.core.multiarray import array
from pytest_mock import MockerFixture

from superset.db_engine_specs.base import BaseEngineSpec
from superset.result_set import stringify_values, SupersetResultSet


def test_column_names_as_bytes() -> None:
    """
    Test that we can handle column names as bytes.
    """
    from superset.db_engine_specs.redshift import RedshiftEngineSpec
    from superset.result_set import SupersetResultSet

    data = (
        [
            "2016-01-26",
            392.002014,
            397.765991,
            390.575012,
            392.153015,
            392.153015,
            58147000,
        ],
        [
            "2016-01-27",
            392.444,
            396.842987,
            391.782013,
            394.971985,
            394.971985,
            47424400,
        ],
    )
    description = [
        (b"date", 1043, None, None, None, None, None),
        (b"open", 701, None, None, None, None, None),
        (b"high", 701, None, None, None, None, None),
        (b"low", 701, None, None, None, None, None),
        (b"close", 701, None, None, None, None, None),
        (b"adj close", 701, None, None, None, None, None),
        (b"volume", 20, None, None, None, None, None),
    ]
    result_set = SupersetResultSet(data, description, RedshiftEngineSpec)  # type: ignore

    assert (
        result_set.to_pandas_df().to_markdown()
        == """
|    | date       |    open |    high |     low |   close |   adj close |   volume |
|---:|:-----------|--------:|--------:|--------:|--------:|------------:|---------:|
|  0 | 2016-01-26 | 392.002 | 397.766 | 390.575 | 392.153 |     392.153 | 58147000 |
|  1 | 2016-01-27 | 392.444 | 396.843 | 391.782 | 394.972 |     394.972 | 47424400 |
    """.strip()
    )


def test_stringify_with_null_integers():
    """
    Test that we can safely handle type errors when an integer column has a null value
    """

    data = [
        ("foo", "bar", pd.NA, None),
        ("foo", "bar", pd.NA, True),
        ("foo", "bar", pd.NA, None),
    ]
    numpy_dtype = [
        ("id", "object"),
        ("value", "object"),
        ("num", "object"),
        ("bool", "object"),
    ]

    array2 = np.array(data, dtype=numpy_dtype)
    column_names = ["id", "value", "num", "bool"]

    result_set = np.array([stringify_values(array2[column]) for column in column_names])

    expected = np.array(
        [
            array(["foo", "foo", "foo"], dtype=object),
            array(["bar", "bar", "bar"], dtype=object),
            array([None, None, None], dtype=object),
            array([None, "True", None], dtype=object),
        ]
    )

    assert np.array_equal(result_set, expected)


def test_stringify_with_null_timestamps():
    """
    Test that we can safely handle type errors when a timestamp column has a null value
    """

    data = [
        ("foo", "bar", pd.NaT, None),
        ("foo", "bar", pd.NaT, True),
        ("foo", "bar", pd.NaT, None),
    ]
    numpy_dtype = [
        ("id", "object"),
        ("value", "object"),
        ("num", "object"),
        ("bool", "object"),
    ]

    array2 = np.array(data, dtype=numpy_dtype)
    column_names = ["id", "value", "num", "bool"]

    result_set = np.array([stringify_values(array2[column]) for column in column_names])

    expected = np.array(
        [
            array(["foo", "foo", "foo"], dtype=object),
            array(["bar", "bar", "bar"], dtype=object),
            array([None, None, None], dtype=object),
            array([None, "True", None], dtype=object),
        ]
    )

    assert np.array_equal(result_set, expected)


def test_timezone_series(mocker: MockerFixture) -> None:
    """
    Test that we can handle timezone-aware datetimes correctly.

    This covers a regression that happened when upgrading from Pandas 1.5.3 to 2.0.3.
    """
    logger = mocker.patch("superset.result_set.logger")

    data = [[datetime(2023, 1, 1, tzinfo=timezone.utc)]]
    description = [(b"__time", "datetime", None, None, None, None, False)]
    result_set = SupersetResultSet(
        data,
        description,  # type: ignore
        BaseEngineSpec,
    )
    assert result_set.to_pandas_df().values.tolist() == [
        [pd.Timestamp("2023-01-01 00:00:00+0000", tz="UTC")]
    ]
    logger.exception.assert_not_called()
