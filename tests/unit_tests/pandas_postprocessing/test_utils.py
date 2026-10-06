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

import numpy as np
import pandas as pd
import pytest

from superset.utils.pandas_postprocessing import (
    escape_separator,
    pivot,
    unescape_separator,
)
from superset.utils.pandas_postprocessing.utils import _append_columns


@pytest.fixture
def base_sample_df() -> pd.DataFrame:
    """Fixture providing a base DataFrame with single-level columns."""
    return pd.DataFrame(
        {
            "x": [1, 2, 3],
            "y": [10, 20, 30],
            "z": [100, 200, 300],
        }
    )


@pytest.fixture
def append_sample_df() -> pd.DataFrame:
    """Fixture providing an append DataFrame with overlapping and extra columns."""
    return pd.DataFrame(
        {
            "y": [11, 22, 33],
            "z": [101, 202, 303],
            "unmapped_extra": [999, 999, 999],
        }
    )


@pytest.fixture
def multiindex_base_df() -> pd.DataFrame:
    """Fixture providing a MultiIndex base DataFrame."""
    columns = pd.MultiIndex.from_tuples(
        [("m1", "A"), ("m1", "B"), ("m2", "A")],
        names=["metric", "category"],
    )
    return pd.DataFrame(
        [[1, 2, 10], [3, 4, 20]],
        columns=columns,
    )


@pytest.fixture
def multiindex_append_df() -> pd.DataFrame:
    """Fixture providing a MultiIndex append DataFrame."""
    columns = pd.MultiIndex.from_tuples(
        [("m1", "A"), ("m1", "B"), ("m3", "A"), ("unmapped", "X")],
        names=["metric", "category"],
    )
    return pd.DataFrame(
        [[15.5, 25.5, 300.0, 999.0], [35.5, 45.5, 400.0, 999.0]],
        columns=columns,
    )


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


def test_append_columns_mixed_mapping_duplication():
    """
    Test that _append_columns with mixed mapping overwrites existing
    target columns and appends new columns without duplicating labels
    or leaking unmapped columns.
    """
    base_df = pd.DataFrame(
        {
            "x": [1, 2, 3],
            "y": [10, 20, 30],
            "z": [100, 200, 300],
        }
    )
    append_df = pd.DataFrame(
        {
            "y": [11, 22, 33],
            "z": [101, 202, 303],
            "extra": [999, 999, 999],
        }
    )
    mapping = {"y": "y", "z": "z2"}

    result = _append_columns(base_df, append_df, mapping)

    assert list(result.columns) == ["x", "y", "z", "z2"]
    assert not result.columns.has_duplicates
    assert isinstance(result["y"], pd.Series)
    assert result["y"].tolist() == [11, 22, 33]
    assert result["z2"].tolist() == [101, 202, 303]
    assert result["z"].tolist() == [100, 200, 300]
    assert "extra" not in result.columns
    assert base_df["y"].tolist() == [10, 20, 30]


def test_append_columns_zero_duplicate_labels_evidence_gate(
    base_sample_df: pd.DataFrame,
    append_sample_df: pd.DataFrame,
):
    """
    Evidence gate consolidating verification of zero duplicate labels,
    correct Series lookup types, full base immutability, and complete
    unmapped column isolation across mixed column mappings.
    """
    mapping = {"y": "y", "z": "z2"}
    result = _append_columns(base_sample_df, append_sample_df, mapping)

    # 1. Zero duplicate labels
    assert not result.columns.has_duplicates
    assert len(result.columns) == len(set(result.columns))

    # 2. Series type preservation for lookups
    assert isinstance(result["y"], pd.Series)
    assert isinstance(result["z2"], pd.Series)

    # 3. Discard unmapped columns
    assert "unmapped_extra" not in result.columns

    # 4. Base DataFrame immutability
    assert base_sample_df["y"].tolist() == [10, 20, 30]


def test_append_columns_using_fixtures(
    base_sample_df: pd.DataFrame,
    append_sample_df: pd.DataFrame,
):
    """Verify append_columns using standard fixtures with mixed mapping."""
    result = _append_columns(
        base_sample_df,
        append_sample_df,
        {"y": "y", "z": "z_new"},
    )
    assert list(result.columns) == ["x", "y", "z", "z_new"]
    assert isinstance(result["y"], pd.Series)
    assert result["y"].tolist() == [11, 22, 33]
    assert result["z_new"].tolist() == [101, 202, 303]
    assert result["z"].tolist() == [100, 200, 300]
    assert "unmapped_extra" not in result.columns


def test_append_columns_multiindex_mixed_mapping(
    multiindex_base_df: pd.DataFrame,
    multiindex_append_df: pd.DataFrame,
):
    """Verify append_columns correctly handles MultiIndex columns and avoids leaks."""
    result = _append_columns(
        multiindex_base_df,
        multiindex_append_df,
        {"m1": "m1", "m3": "m3_new"},
    )
    assert isinstance(result.columns, pd.MultiIndex)
    assert "m1" in result.columns.levels[0]
    assert "m2" in result.columns.levels[0]
    assert "m3_new" in result.columns.levels[0]
    assert "unmapped" not in result.columns.levels[0]

    assert result[("m1", "A")].tolist() == [15.5, 35.5]
    assert result[("m3_new", "A")].tolist() == [300.0, 400.0]
    assert multiindex_base_df[("m1", "A")].tolist() == [1, 3]


def test_append_columns_type_coercion_int_to_float_with_nan():
    """
    Verify overwriting int64 column with float values containing NaN
    does not raise LossySetitemError.
    """
    base_df = pd.DataFrame({"val": [1, 2, 3]})
    append_df = pd.DataFrame({"val": [np.nan, 2.5, 3.5]})

    result = _append_columns(base_df, append_df, {"val": "val"})

    assert isinstance(result["val"], pd.Series)
    assert result["val"].isna().sum() == 1
    assert result["val"].iloc[1] == 2.5
    assert result["val"].iloc[2] == 3.5
    assert base_df["val"].tolist() == [1, 2, 3]


def test_append_columns_empty_mapping(base_sample_df: pd.DataFrame):
    """Verify passing empty columns mapping returns an isolated copy of base_df."""
    append_df = pd.DataFrame({"y": [99, 99, 99]})
    result = _append_columns(base_sample_df, append_df, {})

    assert list(result.columns) == ["x", "y", "z"]
    assert result.equals(base_sample_df)

    result["x"] = [9, 9, 9]
    assert base_sample_df["x"].tolist() == [1, 2, 3]


def test_append_columns_unmapped_columns_strictly_discarded():
    """Verify only mapped columns are copied and multiple extra columns are ignored."""
    base_df = pd.DataFrame({"a": [1, 2]})
    append_df = pd.DataFrame(
        {
            "target_src": [10, 20],
            "leak1": [100, 200],
            "leak2": [300, 400],
            "leak3": [500, 600],
        }
    )
    result = _append_columns(base_df, append_df, {"target_src": "a"})

    assert list(result.columns) == ["a"]
    assert result["a"].tolist() == [10, 20]
    for leak in ["leak1", "leak2", "leak3"]:
        assert leak not in result.columns


def test_append_columns_missing_source_column_safely_ignored(
    base_sample_df: pd.DataFrame,
):
    """Verify mapping referencing non-existent source column does not raise KeyError."""
    append_df = pd.DataFrame({"y": [1, 2, 3]})
    result = _append_columns(
        base_sample_df,
        append_df,
        {"non_existent": "new_target"},
    )
    assert list(result.columns) == ["x", "y", "z"]
