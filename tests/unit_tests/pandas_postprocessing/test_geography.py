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
import pytest

from superset.utils.pandas_postprocessing import (
    geodetic_parse,
    geohash_decode,
    geohash_encode,
    pivot,
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


@pytest.mark.parametrize(
    "func, source_column, kwargs",
    [
        (geohash_decode, "geohash", {"geohash": "geohash"}),
        (geodetic_parse, "geodetic", {"geodetic": "geodetic"}),
        (
            geodetic_parse,
            "geodetic",
            {"geodetic": "geodetic", "altitude": "altitude"},
        ),
    ],
    ids=["geohash_decode", "geodetic_parse", "geodetic_parse-with-altitude"],
)
def test_geography_keeps_the_index_it_was_given(func, source_column, kwargs):
    """
    A parsed frame must carry the caller's index, not a fresh one.

    `_append_columns` aligns on the index, so a parsed frame left on its own
    `RangeIndex` matches nothing when the caller's frame is indexed by anything
    else. `pd.concat` then unions the two, and the result holds the original
    rows with no coordinates plus one unlabelled row per parsed row.
    """
    df = lonlat_df[["city", source_column]].set_index("city")

    post_df = func(df=df, latitude="lat", longitude="lon", **kwargs)

    assert len(post_df) == len(df)
    assert post_df.index.tolist() == df.index.tolist()
    assert post_df["lat"].notna().all()
    assert post_df["lon"].notna().all()


def test_geohash_encode_keeps_the_index_it_was_given():
    """
    Encoding is unaffected by the index, and must stay that way.

    It slices `df[[latitude, longitude]]`, so its working frame inherits the
    caller's index rather than getting a fresh one, which is why it needs no
    change where the two parsers did. Pinned so a later refactor that builds a
    frame here instead does not reintroduce the mismatch.
    """
    df = lonlat_df[["city", "latitude", "longitude"]].set_index("city")

    post_df = geohash_encode(
        df=df, latitude="latitude", longitude="longitude", geohash="geohash"
    )

    assert len(post_df) == len(df)
    assert post_df.index.tolist() == df.index.tolist()
    assert series_to_list(post_df["geohash"]) == series_to_list(lonlat_df["geohash"])


def test_geodetic_parse_after_pivot_keeps_one_row_per_group():
    """
    The index a previous operation leaves behind must survive the parse.

    `pivot` indexes by its groupby columns, so a chain that pivots and then
    parses is the shortest route to a non-`RangeIndex` frame reaching these
    operations. Before the index was carried, two rows in became four out, with
    the coordinates landing on the two phantom rows.
    """
    pivoted = pivot(
        df=lonlat_df[["city", "geodetic"]],
        index=["city"],
        columns=[],
        aggregates={"geodetic": {"operator": "max"}},
    )

    post_df = geodetic_parse(
        df=pivoted, geodetic="geodetic", latitude="lat", longitude="lon"
    )

    assert len(post_df) == len(pivoted)
    assert post_df.index.tolist() == pivoted.index.tolist()
    assert post_df["lat"].notna().all()
    assert post_df["lon"].notna().all()
