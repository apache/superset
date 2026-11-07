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
from datetime import datetime
from unittest import mock

import pytest
from freezegun import freeze_time

from superset.common.utils.time_range_utils import (
    get_since_until_from_query_object,
    get_since_until_from_time_range,
    get_time_offset_range,
    get_time_range_from_filters,
)
from superset.constants import NO_TIME_RANGE
from superset.exceptions import QueryObjectValidationError
from tests.unit_tests.conftest import with_feature_flags


@pytest.mark.parametrize("invalid_value", [None, 42, True, [], ["2001 : 2002"], {}])
def test_time_range_selection_ignores_non_string_values(invalid_value: object) -> None:
    """Malformed temporal values cannot replace a valid range or reach parsing."""
    filters: list[dict[str, object]] = [
        {"col": "dttm", "op": "TEMPORAL_RANGE", "val": invalid_value},
    ]
    assert get_time_range_from_filters(None, filters, ["dttm"]) == NO_TIME_RANGE
    filters.append({"col": "other", "op": "TEMPORAL_RANGE", "val": "2001 : 2002"})
    selected: str = get_time_range_from_filters(None, filters, ["dttm"])
    assert get_since_until_from_time_range(selected) == (
        datetime(2001, 1, 1),
        datetime(2002, 1, 1),
    )


def test_time_range_selection_ignores_missing_value() -> None:
    """An omitted temporal value has the same selection semantics as None."""
    assert (
        get_time_range_from_filters(
            None, [{"col": "dttm", "op": "TEMPORAL_RANGE"}], ["dttm"]
        )
        == NO_TIME_RANGE
    )


def test__get_since_until_from_time_range():
    assert get_since_until_from_time_range(time_range="2001 : 2002") == (
        datetime(2001, 1, 1),
        datetime(2002, 1, 1),
    )
    assert get_since_until_from_time_range(
        time_range="2001 : 2002", time_shift="8 hours ago"
    ) == (
        datetime(2000, 12, 31, 16, 0, 0),
        datetime(2001, 12, 31, 16, 0, 0),
    )
    with mock.patch(
        "superset.utils.date_parser.EvalDateTruncFunc.eval",
        return_value=datetime(2000, 1, 1, 0, 0, 0),
    ):
        assert (
            get_since_until_from_time_range(
                time_range="Last year",
                extras={
                    "relative_end": "2100",
                },
            )
        )[1] == datetime(2100, 1, 1, 0, 0)
    with mock.patch(
        "superset.utils.date_parser.EvalDateTruncFunc.eval",
        return_value=datetime(2000, 1, 1, 0, 0, 0),
    ):
        assert (
            get_since_until_from_time_range(
                time_range="Next year",
                extras={
                    "relative_start": "2000",
                },
            )
        )[0] == datetime(2000, 1, 1, 0, 0)


@pytest.mark.query_object(
    {
        "time_range": "2001 : 2002",
        "time_shift": "8 hours ago",
    }
)
def test__since_until_from_time_range(dummy_query_object):
    assert get_since_until_from_query_object(dummy_query_object) == (
        datetime(2000, 12, 31, 16, 0, 0),
        datetime(2001, 12, 31, 16, 0, 0),
    )


@pytest.mark.query_object(
    {
        "filters": [{"col": "dttm", "op": "TEMPORAL_RANGE", "val": "2001 : 2002"}],
        "columns": [
            {
                "columnType": "BASE_AXIS",
                "label": "dttm",
                "sqlExpression": "dttm",
            }
        ],
    }
)
def test__since_until_from_adhoc_filters(dummy_query_object):
    assert get_since_until_from_query_object(dummy_query_object) == (
        datetime(2001, 1, 1, 0, 0, 0),
        datetime(2002, 1, 1, 0, 0, 0),
    )


# Expected values come from the maths processing_time_offsets ran before it
# moved to get_time_offset_range.
@pytest.mark.parametrize(
    "offset,since,until,expected",
    [
        (
            "1 year ago",
            datetime(2026, 7, 18),
            datetime(2026, 10, 16),
            (datetime(2025, 7, 18), datetime(2025, 10, 16)),
        ),
        (
            "1 month ago",
            datetime(2026, 7, 18),
            datetime(2026, 10, 16),
            (datetime(2026, 6, 18), datetime(2026, 9, 16)),
        ),
        (
            "52 weeks ago",
            datetime(2026, 7, 18),
            datetime(2026, 10, 16),
            (datetime(2025, 7, 19), datetime(2025, 10, 17)),
        ),
        (
            "28 days ago",
            datetime(2026, 7, 18),
            datetime(2026, 10, 16),
            (datetime(2026, 6, 20), datetime(2026, 9, 18)),
        ),
        (
            "inherit",
            datetime(2026, 7, 18),
            datetime(2026, 10, 16),
            (datetime(2026, 4, 19), datetime(2026, 7, 18)),
        ),
        (
            "2026-01-01",
            datetime(2026, 7, 18),
            datetime(2026, 10, 16),
            (datetime(2026, 1, 1), datetime(2026, 4, 1)),
        ),
        (
            "2025-01-01 : 2025-03-31",
            datetime(2026, 7, 18),
            datetime(2026, 10, 16),
            (datetime(2025, 1, 1), datetime(2025, 3, 31)),
        ),
        (
            "1 month ago",
            datetime(2026, 3, 31),
            datetime(2026, 5, 31),
            (datetime(2026, 2, 28), datetime(2026, 4, 30)),
        ),
        (
            "1 year ago",
            datetime(2024, 2, 29),
            datetime(2024, 3, 31),
            (datetime(2023, 2, 28), datetime(2023, 3, 31)),
        ),
        (
            "1 year ago",
            datetime(2025, 2, 28, 6),
            datetime(2028, 2, 29, 23, 59),
            (datetime(2024, 2, 28, 6), datetime(2027, 2, 28, 23, 59)),
        ),
    ],
)
@with_feature_flags(DATE_RANGE_TIMESHIFTS_ENABLED=True)
def test_get_time_offset_range(
    offset: str,
    since: datetime,
    until: datetime,
    expected: tuple[datetime, datetime],
) -> None:
    with freeze_time("2026-10-16 14:30"):
        assert get_time_offset_range(offset, since, until) == expected


@with_feature_flags(DATE_RANGE_TIMESHIFTS_ENABLED=False)
def test_get_time_offset_range_date_range_needs_the_flag() -> None:
    with pytest.raises(
        QueryObjectValidationError, match="Date range timeshifts are not enabled"
    ):
        get_time_offset_range(
            "2025-01-01 : 2025-03-31", datetime(2026, 7, 18), datetime(2026, 10, 16)
        )


@with_feature_flags(DATE_RANGE_TIMESHIFTS_ENABLED=True)
def test_get_time_offset_range_rejects_a_reversed_date_range() -> None:
    with pytest.raises(
        QueryObjectValidationError, match="From date cannot be larger than to date"
    ):
        get_time_offset_range(
            "2025-03-31 : 2025-01-01", datetime(2026, 7, 18), datetime(2026, 10, 16)
        )


@pytest.mark.parametrize("offset", ["garbage", "1 fortnight ago", ""])
def test_get_time_offset_range_rejects_an_unparsable_offset(offset: str) -> None:
    with pytest.raises(
        QueryObjectValidationError, match="Unable to interpret the time offset"
    ):
        get_time_offset_range(offset, datetime(2026, 7, 18), datetime(2026, 10, 16))


@with_feature_flags(DATE_RANGE_TIMESHIFTS_ENABLED=False)
def test_get_time_offset_range_relative_offset_ignores_the_flag() -> None:
    with freeze_time("2026-10-16 14:30"):
        assert get_time_offset_range(
            "1 year ago", datetime(2026, 7, 18), datetime(2026, 10, 16)
        ) == (datetime(2025, 7, 18), datetime(2025, 10, 16))


# Expected values come from running these cases through
# processing_time_offsets. A string __timestamp is not a datetime series, so the
# TEMPORAL_RANGE filter is shifted with time_shift=offset.
@pytest.mark.parametrize(
    "timestamp,offset,cache_offset,offset_dfs_key,shifted,inner,filter_value",
    [
        (
            "a",
            "inherit",
            "7776000 seconds ago_inherit",
            "7776000 seconds ago",
            (datetime(2026, 4, 19), datetime(2026, 7, 18)),
            (datetime(2026, 7, 18), datetime(2026, 10, 16)),
            "2026-04-19 00:00:00 : 2026-07-18 00:00:00",
        ),
        (
            "a",
            "2026-01-01",
            "198 days ago_2026-01-01",
            "198 days ago",
            (datetime(2026, 1, 1), datetime(2026, 4, 1)),
            (datetime(2026, 7, 18), datetime(2026, 10, 16)),
            "2026-01-01 00:00:00 : 2026-04-01 00:00:00",
        ),
        (
            "a",
            "1 year ago",
            "1 year ago",
            "1 year ago",
            (datetime(2025, 7, 18), datetime(2025, 10, 16)),
            (datetime(2026, 7, 18), datetime(2026, 10, 16)),
            "2025-07-18 00:00:00 : 2025-10-16 00:00:00",
        ),
        (
            datetime(2026, 7, 18),
            "2025-01-01 : 2025-03-31",
            "2025-01-01 : 2025-03-31",
            "2025-01-01 : 2025-03-31",
            (datetime(2025, 1, 1), datetime(2025, 3, 31)),
            (None, None),
            "2025-01-01 00:00:00 : 2025-03-31 00:00:00",
        ),
    ],
)
@with_feature_flags(DATE_RANGE_TIMESHIFTS_ENABLED=True)
def test_processing_time_offsets_queries_the_shifted_range(
    app_context: None,
    timestamp: str | datetime,
    offset: str,
    cache_offset: str,
    offset_dfs_key: str,
    shifted: tuple[datetime, datetime],
    inner: tuple[datetime | None, datetime | None],
    filter_value: str,
) -> None:
    import pandas as pd

    from superset.common.query_object import QueryObject
    from superset.models.helpers import ExploreMixin

    mixin = ExploreMixin()
    query_object = QueryObject(
        granularity="ds",
        metrics=["m"],
        filters=[
            {"col": "ds", "op": "TEMPORAL_RANGE", "val": "2026-07-18 : 2026-10-16"}
        ],
        time_offsets=[offset],
    )
    cache_key_fn = mock.MagicMock(return_value=None)

    with (
        mock.patch.object(
            mixin, "query", return_value=mock.MagicMock(df=pd.DataFrame())
        ),
        mock.patch.object(mixin, "join_offset_dfs") as join_offset_dfs,
        mock.patch.object(mixin, "_get_temporal_column_for_filter", return_value="ds"),
        mock.patch(
            "superset.models.helpers.get_since_until_from_query_object",
            return_value=(datetime(2026, 7, 18), datetime(2026, 10, 16)),
        ),
        freeze_time("2026-10-16 14:30"),
    ):
        mixin.processing_time_offsets(
            pd.DataFrame({"__timestamp": [timestamp], "m": [1]}),
            query_object,
            cache_key_fn=cache_key_fn,
        )

    clone, key_offset, _ = cache_key_fn.call_args.args
    assert key_offset == cache_offset
    assert list(join_offset_dfs.call_args.args[1]) == [offset_dfs_key]
    assert (clone.from_dttm, clone.to_dttm) == shifted
    assert (clone.inner_from_dttm, clone.inner_to_dttm) == inner
    assert [flt["val"] for flt in clone.filter] == [filter_value]
