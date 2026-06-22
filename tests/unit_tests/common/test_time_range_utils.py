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

import freezegun
import pytest

from superset.common.utils.time_range_utils import (
    get_presentation_relative_now,
    get_since_until_from_query_object,
    get_since_until_from_time_range,
)
from tests.unit_tests.conftest import with_feature_flags


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


def _zone_datasource(zone, supports=True):
    """A duck-typed dataset carrying a presentation zone."""
    datasource = mock.MagicMock()
    datasource.presentation_timezone = zone
    datasource.db_engine_spec.supports_presentation_timezone = supports
    return datasource


@with_feature_flags(DATASET_PRESENTATION_TIMEZONE=True)
def test_get_presentation_relative_now_in_zone() -> None:
    """The anchor is the zone's current wall-clock (naive)."""
    with freezegun.freeze_time("2024-06-15 04:00:00"):  # UTC
        anchor = get_presentation_relative_now(_zone_datasource("America/New_York"))
    assert anchor == datetime(2024, 6, 15, 0, 0, 0)  # EDT = UTC-4
    assert anchor.tzinfo is None


@with_feature_flags(DATASET_PRESENTATION_TIMEZONE=True)
def test_get_presentation_relative_now_gates() -> None:
    """No zone, or an unsupported engine, leaves the anchor unset."""
    assert get_presentation_relative_now(_zone_datasource(None)) is None
    assert (
        get_presentation_relative_now(_zone_datasource("UTC", supports=False)) is None
    )
    assert get_presentation_relative_now(None) is None  # SQL Lab / no datasource


def test_get_presentation_relative_now_inert_without_flag() -> None:
    """Flag off ⇒ no anchor, even with a zone configured."""
    assert get_presentation_relative_now(_zone_datasource("America/New_York")) is None


@pytest.mark.query_object({"time_range": "Last week"})
@with_feature_flags(DATASET_PRESENTATION_TIMEZONE=True)
def test_since_until_relative_anchored_in_presentation_zone(
    dummy_query_object,
) -> None:
    """'Last week' on a zoned dataset resolves in that zone's calendar.

    Frozen at 2024-06-14 13:00 UTC: Auckland (UTC+12) is already Jun 15
    01:00, so 'today' there is Jun 15 while the server's UTC today is still
    Jun 14 — the anchored result (Jun 8..15) differs from the unanchored
    one (Jun 7..14), proving the zone anchor is applied.
    """
    dummy_query_object.datasource = _zone_datasource("Pacific/Auckland")
    with freezegun.freeze_time("2024-06-14 13:00:00"):  # UTC; Auckland Jun 15 01:00
        since, until = get_since_until_from_query_object(dummy_query_object)
    assert (since, until) == (datetime(2024, 6, 8), datetime(2024, 6, 15))
