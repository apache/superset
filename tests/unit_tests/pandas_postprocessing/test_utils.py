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
import inspect

import pytest
from pandas import DataFrame

from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing import (
    escape_separator,
    pivot,
    unescape_separator,
)
from superset.utils.pandas_postprocessing.utils import (
    _append_columns,
    scalar_to_sequence,
)
from tests.unit_tests.pandas_postprocessing.utils import series_to_list


def test_escape_separator():
    assert escape_separator(r" hell \world ") == r" hell \world "
    assert unescape_separator(r" hell \world ") == r" hell \world "

    escape_string = escape_separator("hello, world")
    assert escape_string == r"hello\, world"
    assert unescape_separator(escape_string) == "hello, world"

    escape_string = escape_separator("hello,world")
    assert escape_string == r"hello\,world"
    assert unescape_separator(escape_string) == "hello,world"


def test_validate_column_args_preserves_signature():
    """
    The decorator must not hide the signature of the operation it wraps.

    `inspect.signature` follows `__wrapped__`, which `functools.wraps` sets.
    Without it every decorated operation reports `(df, **options)`, and code
    that inspects the signature -- see `QueryObject._drop_unsupported_options`
    -- cannot tell a supported option from an unsupported one.
    """
    parameters = inspect.signature(pivot).parameters

    assert pivot.__name__ == "pivot"
    assert "options" not in parameters
    assert {"index", "aggregates", "columns"} <= set(parameters)


def test_append_columns_with_mixed_mapping():
    """
    A mapping that both overwrites and renames must do each to its own half.

    Handling the mapping as a whole appends the column that was meant to be
    overwritten, so the result carries two columns under the same label and
    `df[label]` returns a DataFrame where callers expect a Series.
    """
    base_df = DataFrame({"y": [1.0, 2.0], "z": [3.0, 4.0]})
    append_df = DataFrame({"y": [10.0, 20.0], "z": [30.0, 40.0]})

    all_overwritten = _append_columns(base_df, append_df, {"y": "y", "z": "z"})
    assert all_overwritten.columns.tolist() == ["y", "z"]
    assert series_to_list(all_overwritten["y"]) == [10.0, 20.0]

    all_renamed = _append_columns(base_df, append_df, {"y": "y2", "z": "z2"})
    assert all_renamed.columns.tolist() == ["y", "z", "y2", "z2"]
    assert series_to_list(all_renamed["y"]) == [1.0, 2.0]
    assert series_to_list(all_renamed["y2"]) == [10.0, 20.0]

    mixed = _append_columns(base_df, append_df, {"y": "y", "z": "z2"})
    assert mixed.columns.tolist() == ["y", "z", "z2"]
    assert not mixed.columns.duplicated().any()
    assert series_to_list(mixed["y"]) == [10.0, 20.0]
    assert series_to_list(mixed["z"]) == [3.0, 4.0]
    assert series_to_list(mixed["z2"]) == [30.0, 40.0]


def test_append_columns_overwrites_a_target_already_in_base_df():
    """
    A rename whose target is already a column must overwrite, not append.

    `{"y": "z"}` against a frame that already has a `z` renames onto an existing
    label, so appending it leaves two columns called `z` and `df["z"]` returns a
    DataFrame where callers expect a Series. The source and target names differ,
    so a split keyed on them matching sends this down the append path.
    """
    base_df = DataFrame({"y": [1.0, 2.0], "z": [3.0, 4.0]})
    append_df = DataFrame({"y": [10.0, 20.0]})

    post_df = _append_columns(base_df, append_df, {"y": "z"})

    assert post_df.columns.tolist() == ["y", "z"]
    assert not post_df.columns.duplicated().any()
    assert series_to_list(post_df["y"]) == [1.0, 2.0]
    assert series_to_list(post_df["z"]) == [10.0, 20.0]
    # The overwrite must not reach the caller's frame.
    assert series_to_list(base_df["z"]) == [3.0, 4.0]


def test_append_columns_widens_an_int_target_the_new_values_do_not_fit():
    """
    A rename onto an int column must land even when its new values carry a NaN.

    pandas 3 raises `TypeError` instead of widening a column's dtype when a
    `.loc` write does not fit it, and a NaN never fits an int64 column. `diff`
    and `cum` hand back exactly that for an integer metric, so without the
    fallback to plain column replacement the write fails and the request 500s
    rather than producing a float column.

    The same-name case does not cover this on its own: a mapping only reaches
    the in-place write for a target it does not name once a rename onto an
    existing label is classified as an overwrite.
    """
    base_df = DataFrame({"y": [1, 2], "z": [3, 4]})
    append_df = DataFrame({"y": [float("nan"), 20.0]})

    post_df = _append_columns(base_df, append_df, {"y": "z"})

    assert post_df.columns.tolist() == ["y", "z"]
    assert not post_df.columns.duplicated().any()
    assert post_df["z"].dtype == "float64"
    assert post_df["z"].isna().tolist() == [True, False]
    assert series_to_list(post_df["z"])[1] == 20.0
    # Widening the copy must not reach the caller's frame.
    assert base_df["z"].dtype == "int64"
    assert series_to_list(base_df["z"]) == [3, 4]


def test_append_columns_splits_a_mapping_by_whether_the_target_exists():
    """
    One mapping may overwrite an existing target and append a new one.

    Both halves are renames, so neither is recognizable by its source and target
    matching; only the presence of the target separates them.
    """
    base_df = DataFrame({"y": [1.0, 2.0], "z": [3.0, 4.0]})
    append_df = DataFrame({"y": [10.0, 20.0], "z": [30.0, 40.0]})

    post_df = _append_columns(base_df, append_df, {"y": "z", "z": "w"})

    assert post_df.columns.tolist() == ["y", "z", "w"]
    assert not post_df.columns.duplicated().any()
    assert series_to_list(post_df["y"]) == [1.0, 2.0]
    assert series_to_list(post_df["z"]) == [10.0, 20.0]
    assert series_to_list(post_df["w"]) == [30.0, 40.0]


def test_append_columns_writes_in_place_when_the_target_names_the_source():
    """
    A target that names its own source is written in place, not appended.

    The target need not be a column of `base_df` for this: `geodetic_parse`
    passes `{"latitude": "latitude"}` whenever the caller keeps the default
    column name, and `latitude` is a column of `append_df` only. Testing only
    whether the target is already present would miss this, since it is not.

    `append_df` carries `base_df`'s index, which is what the geography helpers
    pass since #45086, so the in-place write lands on the caller's own rows.
    """
    base_df = DataFrame({"city": ["New York City", "Sydney"]}, index=[5, 6])
    append_df = DataFrame({"latitude": [40.7, -33.8]}, index=[5, 6])

    post_df = _append_columns(base_df, append_df, {"latitude": "latitude"})

    assert post_df.columns.tolist() == ["city", "latitude"]
    assert post_df.index.tolist() == [5, 6]
    assert len(post_df) == len(base_df)
    assert series_to_list(post_df["latitude"]) == [40.7, -33.8]


def test_append_columns_never_adds_rows_for_a_non_renaming_mapping():
    """
    A mapping that renames nothing may not change `base_df`'s row count.

    This is what separates the in-place write from the append path for a target
    that names its own source. `pd.concat` unions the index, so an `append_df`
    carrying rows `base_df` does not have would grow the result and leave the
    original columns empty in the extra rows. Writing in place keeps the
    caller's rows, which is the only shape the next operation can use.
    """
    base_df = DataFrame({"city": ["New York City", "Sydney"]})
    append_df = DataFrame({"latitude": [40.7, -33.8, 99.9]})

    post_df = _append_columns(base_df, append_df, {"latitude": "latitude"})

    assert len(post_df) == len(base_df)
    assert post_df.columns.tolist() == ["city", "latitude"]
    assert series_to_list(post_df["city"]) == ["New York City", "Sydney"]
    assert series_to_list(post_df["latitude"]) == [40.7, -33.8]


def test_append_columns_ignores_unmapped_columns():
    """
    Only the columns the mapping asks for may reach the result.

    `geodetic_parse` always parses an altitude but maps it only when the caller
    asked for one, so an unmapped column in `append_df` must be dropped rather
    than carried through under its source name.
    """
    base_df = DataFrame({"city": ["New York City", "Sydney"]})
    append_df = DataFrame(
        {
            "latitude": [40.7, -33.8],
            "longitude": [-74.0, 151.2],
            "altitude": [5.5, 0.012],
        }
    )

    post_df = _append_columns(
        base_df, append_df, {"latitude": "lat", "longitude": "lon"}
    )

    assert post_df.columns.tolist() == ["city", "lat", "lon"]


def test_append_columns_with_empty_mapping_returns_a_copy():
    """
    A mapping that asks for nothing still owes the caller its own DataFrame.

    `cum` normalizes a missing mapping to `{}`, so this is reachable, and the
    result is handed on to the next post-processing operation.
    """
    base_df = DataFrame({"y": [1.0, 2.0]})

    post_df = _append_columns(base_df, DataFrame(), {})

    assert post_df is not base_df
    assert post_df.columns.tolist() == ["y"]
    assert series_to_list(post_df["y"]) == [1.0, 2.0]


@pytest.mark.parametrize(
    "columns",
    [
        pytest.param({"y": "z", "z": "z"}, id="target already in base_df"),
        pytest.param({"y": "w", "z": "w"}, id="target not in base_df"),
    ],
)
def test_append_columns_rejects_two_sources_mapped_to_one_target(columns):
    """
    Two sources cannot both be written to one target.

    Splitting the mapping by whether the target exists sends this case down
    either half, and neither can serve it: the in-place write is handed a
    duplicate label, which pandas refuses with `ValueError: Setting with
    non-unique columns is not allowed`, and the append goes through `pd.concat`,
    which returns the target label twice. Reporting it as an invalid request
    instead keeps the chart data response a 400 rather than a 500, and the two
    geography callers wrap `ValueError` in a message about the source string,
    which would name the wrong cause.
    """
    base_df = DataFrame({"y": [1.0, 2.0], "z": [3.0, 4.0]})
    append_df = DataFrame({"y": [10.0, 20.0], "z": [30.0, 40.0]})

    with pytest.raises(InvalidPostProcessingError, match="same target"):
        _append_columns(base_df, append_df, columns)


def test_scalar_to_sequence() -> None:
    """
    None becomes an empty list.

    A string is wrapped in a list.

    A list is unchanged.
    """
    assert scalar_to_sequence(None) == []
    assert scalar_to_sequence("a") == ["a"]
    assert scalar_to_sequence(["a", "b"]) == ["a", "b"]
