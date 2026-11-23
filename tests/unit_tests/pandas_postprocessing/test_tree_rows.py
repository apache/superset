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
from typing import Any

import pandas as pd
import pytest
from pandas import DataFrame, RangeIndex

from superset.charts.schemas import ChartDataPostProcessingOperationSchema
from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing import tree_rows

DAY = [["2026-11-08T00:00:00", "2026-11-09T00:00:00"]]


def two_levels(time_column: str | None = "t") -> list[dict[str, Any]]:
    step: dict[str, Any] = {"id_column": "step", "columns": ["step", "t"]}
    if time_column:
        step["time_column"] = time_column
    return [{"id_column": "session", "columns": ["session", "channel"]}, step]


def frame(rows: list[tuple[Any, ...]]) -> DataFrame:
    return DataFrame(rows, columns=["session", "channel", "step", "t"])


def records(df: DataFrame) -> list[dict[str, Any]]:
    return [
        {key: None if pd.isna(value) else value for key, value in row.items()}
        for row in df.to_dict(orient="records")
    ]


def test_a_null_child_header_row_is_dropped_when_children_exist() -> None:
    df = frame(
        [
            ("s1", "Voice", None, None),
            ("s1", "Voice", "a", "2026-11-08 01:00:00"),
            ("s1", "Voice", "b", "2026-11-08 02:00:00"),
            ("s1", "Voice", "c", "2026-11-08 03:00:00"),
        ]
    )
    result = tree_rows(df, two_levels())
    assert result["step"].tolist() == ["a", "b", "c"]
    assert isinstance(result.index, RangeIndex)


def test_a_parent_with_only_null_children_is_one_empty_row() -> None:
    df = frame([("s1", "Voice", None, "x"), ("s1", "Voice", None, "y")])
    assert records(tree_rows(df, two_levels())) == [
        {"session": "s1", "channel": "Voice", "step": None, "t": None}
    ]


@pytest.mark.parametrize("parent", [None, ""])
def test_an_empty_parent_id_with_children_is_one_empty_row(parent: Any) -> None:
    df = frame(
        [(parent, "Voice", f"st{i}", "2026-11-08 01:00:00") for i in range(7)]
        + [("s2", "Chat", "z", "2026-11-08 01:00:00")]
    )
    result = records(tree_rows(df, two_levels(), DAY))
    assert result == [
        {"session": parent, "channel": "Voice", "step": None, "t": None},
        {"session": "s2", "channel": "Chat", "step": "z", "t": "2026-11-08 01:00:00"},
    ]


def test_all_children_out_of_range_is_one_empty_row() -> None:
    df = frame(
        [("s1", "Voice", f"st{i}", "2026-11-09 00:00:00") for i in range(3)]
        + [("s1", "Voice", "st9", "2026-11-07 23:59:59")]
    )
    assert records(tree_rows(df, two_levels(), DAY)) == [
        {"session": "s1", "channel": "Voice", "step": None, "t": None}
    ]


def test_only_children_in_range_are_kept() -> None:
    df = frame(
        [
            ("s1", "Voice", "a", "2026-11-07 23:00:00"),
            ("s1", "Voice", "b", "2026-11-08 00:00:00"),
            ("s1", "Voice", "c", "2026-11-09 00:00:00"),
            ("s1", "Voice", "d", "2026-11-08 23:59:59"),
            ("s1", "Voice", "e", None),
        ]
    )
    assert tree_rows(df, two_levels(), DAY)["step"].tolist() == ["b", "d"]


def test_three_levels_cascade() -> None:
    levels = [
        {"id_column": "l1", "columns": ["l1"]},
        {"id_column": "l2", "columns": ["l2", "time2"], "time_column": "time2"},
        {"id_column": "l3", "columns": ["l3", "time3"], "time_column": "time3"},
    ]
    inside, outside = "2026-11-08 12:00:00", "2026-11-10 12:00:00"
    df = DataFrame(
        [
            ("p", "out", outside, "x1", inside),
            ("p", "out", outside, "x2", inside),
            ("p", "in", inside, "y1", outside),
            ("p", "in", inside, "y2", outside),
            ("q", "in", inside, "z1", inside),
            ("q", "in", inside, "z2", outside),
        ],
        columns=["l1", "l2", "time2", "l3", "time3"],
    )
    assert records(tree_rows(df, levels, DAY)) == [
        {"l1": "p", "l2": "in", "time2": inside, "l3": None, "time3": None},
        {"l1": "q", "l2": "in", "time2": inside, "l3": "z1", "time3": inside},
    ]


def test_row_order_is_kept() -> None:
    df = frame(
        [
            ("s2", "Chat", "b", None),
            ("s1", "Voice", None, None),
            ("s2", "Chat", "a", None),
            ("s3", "Web", "c", None),
        ]
    )
    result = tree_rows(df, two_levels(None))
    assert result[["session", "step"]].values.tolist() == [
        ["s2", "b"],
        ["s1", None],
        ["s2", "a"],
        ["s3", "c"],
    ]


def test_tz_aware_times_and_nat() -> None:
    df = frame(
        [
            ("s1", "Voice", "a", pd.Timestamp("2026-11-08 01:00", tz="Europe/Warsaw")),
            ("s1", "Voice", "b", pd.Timestamp("2026-11-08 00:30", tz="Europe/Warsaw")),
            ("s1", "Voice", "c", pd.NaT),
        ]
    )
    assert tree_rows(df, two_levels(), DAY)["step"].tolist() == ["a"]


def test_datetime_column() -> None:
    df = frame(
        [
            ("s1", "Voice", "a", pd.Timestamp("2026-11-08 01:00")),
            ("s1", "Voice", "b", pd.Timestamp("2026-11-09 01:00")),
        ]
    )
    assert tree_rows(df, two_levels(), DAY)["step"].tolist() == ["a"]


@pytest.mark.parametrize(
    "bounds,expected",
    [
        ([[None, "2026-11-09T00:00:00"]], ["a", "b"]),
        ([["2026-11-08T00:00:00", None]], ["b", "c"]),
    ],
)
def test_an_open_side(bounds: list[list[str | None]], expected: list[str]) -> None:
    df = frame(
        [
            ("s1", "Voice", "a", "2026-11-01 00:00:00"),
            ("s1", "Voice", "b", "2026-11-08 05:00:00"),
            ("s1", "Voice", "c", "2026-12-01 00:00:00"),
        ]
    )
    assert tree_rows(df, two_levels(), bounds)["step"].tolist() == expected


def test_every_bound_must_hold() -> None:
    df = frame(
        [
            ("s1", "Voice", "a", "2026-11-08 05:00:00"),
            ("s1", "Voice", "b", "2026-11-08 15:00:00"),
        ]
    )
    bounds = DAY + [["2026-11-08T00:00:00", "2026-11-08T12:00:00"]]
    assert tree_rows(df, two_levels(), bounds)["step"].tolist() == ["a"]


def test_without_a_time_column_only_the_null_rules_apply() -> None:
    df = frame(
        [
            ("s1", "Voice", "a", "2020-01-01 00:00:00"),
            ("s1", "Voice", None, None),
            (None, "Chat", "x", None),
        ]
    )
    result = records(tree_rows(df, two_levels(None), DAY))
    assert [row["step"] for row in result] == ["a", None]
    assert result[1]["session"] is None


def test_without_bounds_the_time_column_is_not_checked() -> None:
    df = frame([("s1", "Voice", "a", "2020-01-01 00:00:00")])
    assert tree_rows(df, two_levels())["step"].tolist() == ["a"]


def test_an_empty_frame_comes_back_empty() -> None:
    result = tree_rows(frame([]), two_levels(), DAY)
    assert result.empty
    assert result.columns.tolist() == ["session", "channel", "step", "t"]


def test_blanking_keeps_int_columns_as_ints() -> None:
    df = DataFrame(
        {
            "session": ["s1", "s2"],
            "channel": ["Voice", "Chat"],
            "step": [1, 2],
            "t": ["2026-11-08 01:00:00", "2026-11-10 01:00:00"],
        }
    )
    result = tree_rows(df, two_levels(), DAY)
    assert result["step"].tolist() == [1, None]
    assert (
        result.to_csv(index=False).splitlines()[1] == "s1,Voice,1,2026-11-08 01:00:00"
    )


def test_nullable_integer_children_export_without_decimal_suffixes() -> None:
    """A childless parent must not turn the other children's integers into floats."""
    df = DataFrame(
        {
            "session": ["s1", "s2"],
            "step": [1, None],
            "duration": [54000, None],
            "fraction": [1.5, None],
        }
    )
    levels = [
        {"id_column": "session", "columns": ["session"]},
        {"id_column": "step", "columns": ["step", "duration", "fraction"]},
    ]
    result = tree_rows(df, levels)
    assert result.to_csv(index=False).splitlines() == [
        "session,step,duration,fraction",
        "s1,1,54000,1.5",
        "s2,,,",
    ]


def test_whole_float_children_without_incoming_nulls_stay_float() -> None:
    """Whole-valued float columns keep the source's float representation."""
    df = DataFrame({"parent": ["a", "b"], "child": [1, 2], "price": [10.0, 20.0]})
    result = tree_rows(
        df,
        [
            {"id_column": "parent", "columns": ["parent"]},
            {"id_column": "child", "columns": ["child", "price"]},
        ],
    )
    assert pd.api.types.is_float_dtype(result["price"])
    assert result.to_csv(index=False).splitlines()[1:] == ["a,1,10.0", "b,2,20.0"]


def test_a_level_without_id_column_is_rejected() -> None:
    with pytest.raises(InvalidPostProcessingError):
        tree_rows(frame([]), [{"id_column": "session", "columns": []}, {}])


def test_a_missing_time_column_is_rejected() -> None:
    with pytest.raises(InvalidPostProcessingError):
        tree_rows(frame([]), two_levels("missing"), DAY)


def test_the_operation_is_accepted_by_the_schema() -> None:
    schema = ChartDataPostProcessingOperationSchema()
    loaded = schema.load(
        {"operation": "tree_rows", "options": {"levels": two_levels()}}
    )
    assert loaded["operation"] == "tree_rows"
