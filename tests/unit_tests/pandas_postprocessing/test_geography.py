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
from superset.utils.pandas_postprocessing import (
    geodetic_parse,
    geohash_decode,
    geohash_encode,
)
from tests.unit_tests.fixtures.dataframes import lonlat_df
from tests.unit_tests.pandas_postprocessing.utils import round_floats, series_to_list


def test_geohash_decode():
    # decode lon/lat from geohash
    post_df = geohash_decode(
        df=lonlat_df[["city", "geohash"]],
        geohash="geohash",
        latitude="latitude",
        longitude="longitude",
    )
    assert sorted(post_df.columns.tolist()) == sorted(
        ["city", "geohash", "latitude", "longitude"]
    )
    assert round_floats(series_to_list(post_df["longitude"]), 6) == round_floats(
        series_to_list(lonlat_df["longitude"]), 6
    )
    assert round_floats(series_to_list(post_df["latitude"]), 6) == round_floats(
        series_to_list(lonlat_df["latitude"]), 6
    )


def test_geohash_encode():
    # encode lon/lat into geohash
    post_df = geohash_encode(
        df=lonlat_df[["city", "latitude", "longitude"]],
        latitude="latitude",
        longitude="longitude",
        geohash="geohash",
    )
    assert sorted(post_df.columns.tolist()) == sorted(
        ["city", "geohash", "latitude", "longitude"]
    )
    assert series_to_list(post_df["geohash"]) == series_to_list(lonlat_df["geohash"])


def test_geodetic_parse():
    # parse geodetic string with altitude into lon/lat/altitude
    post_df = geodetic_parse(
        df=lonlat_df[["city", "geodetic"]],
        geodetic="geodetic",
        latitude="latitude",
        longitude="longitude",
        altitude="altitude",
    )
    assert sorted(post_df.columns.tolist()) == sorted(
        ["city", "geodetic", "latitude", "longitude", "altitude"]
    )
    assert series_to_list(post_df["longitude"]) == series_to_list(
        lonlat_df["longitude"]
    )
    assert series_to_list(post_df["latitude"]) == series_to_list(lonlat_df["latitude"])
    assert series_to_list(post_df["altitude"]) == series_to_list(lonlat_df["altitude"])

    # parse geodetic string into lon/lat
    post_df = geodetic_parse(
        df=lonlat_df[["city", "geodetic"]],
        geodetic="geodetic",
        latitude="latitude",
        longitude="longitude",
    )
    assert sorted(post_df.columns.tolist()) == sorted(
        ["city", "geodetic", "latitude", "longitude"]
    )
    assert series_to_list(post_df["longitude"]) == series_to_list(
        lonlat_df["longitude"]
    )
    assert series_to_list(post_df["latitude"]) == series_to_list(lonlat_df["latitude"])


def test_geohash_optional_library_missing():
    from unittest.mock import patch

    import pytest

    from superset.exceptions import InvalidPostProcessingError

    # Test that geohash_decode and geohash_encode raise InvalidPostProcessingError
    # when the underlying library is missing (mocked as None).
    with patch("superset.utils.pandas_postprocessing.geography.geohash_lib", None):
        with pytest.raises(InvalidPostProcessingError) as excinfo:
            geohash_decode(
                df=lonlat_df[["city", "geohash"]],
                geohash="geohash",
                latitude="latitude",
                longitude="longitude",
            )
        assert "pygeohash" in str(excinfo.value)

        with pytest.raises(InvalidPostProcessingError) as excinfo:
            geohash_encode(
                df=lonlat_df[["city", "latitude", "longitude"]],
                latitude="latitude",
                longitude="longitude",
                geohash="geohash",
            )
        assert "pygeohash" in str(excinfo.value)


def test_geohash_encode_positional_fallback():
    from unittest.mock import MagicMock, patch

    # Create a mock object that mimics python-geohash
    # (throws TypeError on keyword arguments)
    mock_geohash = MagicMock()
    def side_effect(*args, **kwargs):
        if kwargs:
            raise TypeError("encode() got an unexpected keyword argument")
        return "mocked_geohash"
    mock_geohash.encode.side_effect = side_effect

    target = "superset.utils.pandas_postprocessing.geography.geohash_lib"
    with patch(target, mock_geohash):
        post_df = geohash_encode(
            df=lonlat_df[["city", "latitude", "longitude"]].head(1),
            latitude="latitude",
            longitude="longitude",
            geohash="geohash",
        )
        assert post_df.iloc[0]["geohash"] == "mocked_geohash"
