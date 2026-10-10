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

from pandas import DataFrame

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
    column name, and `latitude` is a column of `append_df` only. Appending it
    would go through `pd.concat`, which unions the index instead of aligning to
    `base_df`, so a frame that does not have a 0-based index would gain a row per
    parsed row. Testing only whether the target is already present would miss
    this, since it is not.
    """
    base_df = DataFrame({"city": ["New York City", "Sydney"]}, index=[5, 6])
    append_df = DataFrame({"latitude": [40.7, -33.8]})

    post_df = _append_columns(base_df, append_df, {"latitude": "latitude"})

    assert post_df.columns.tolist() == ["city", "latitude"]
    assert post_df.index.tolist() == [5, 6]
    assert len(post_df) == len(base_df)


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


def test_scalar_to_sequence() -> None:
    """
    None becomes an empty list.

    A string is wrapped in a list.

    A list is unchanged.
    """
    assert scalar_to_sequence(None) == []
    assert scalar_to_sequence("a") == ["a"]
    assert scalar_to_sequence(["a", "b"]) == ["a", "b"]
