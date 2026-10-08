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
    assert series_to_list(post_df["latitude"]), series_to_list(lonlat_df["latitude"])


def test_geodetic_parse_without_altitude_drops_unasked_column():
    """
    An altitude is always parsed, but may only reach the result when asked for.

    The parsed frame always carries latitude, longitude and altitude, so a
    mapping that renames and leaves altitude out must drop it rather than carry
    it through under its source name.
    """
    post_df = geodetic_parse(
        df=lonlat_df[["city", "geodetic"]],
        geodetic="geodetic",
        latitude="lat",
        longitude="lon",
    )

    assert post_df.columns.tolist() == ["city", "geodetic", "lat", "lon"]
    assert series_to_list(post_df["lon"]) == series_to_list(lonlat_df["longitude"])
    assert series_to_list(post_df["lat"]) == series_to_list(lonlat_df["latitude"])


def test_geohash_encode_drops_working_columns():
    """
    Encoding works on columns it names `latitude` and `longitude` internally.

    Naming the geohash column something other than `geohash` makes the mapping
    a renaming one, and those working columns must not reach the result: the
    source frame already has a latitude and a longitude, so carrying them
    through leaves two columns under each label.
    """
    post_df = geohash_encode(
        df=lonlat_df[["city", "latitude", "longitude"]],
        latitude="latitude",
        longitude="longitude",
        geohash="hash",
    )

    assert post_df.columns.tolist() == ["city", "latitude", "longitude", "hash"]
    assert not post_df.columns.duplicated().any()
    assert series_to_list(post_df["hash"]) == series_to_list(lonlat_df["geohash"])
