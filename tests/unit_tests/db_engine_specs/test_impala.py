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
from typing import Optional
from unittest.mock import Mock, patch

import pytest
from sqlalchemy import column, types

from superset.db_engine_specs.impala import ImpalaEngineSpec as spec  # noqa: N813
from superset.models.core import Database
from superset.models.sql_lab import Query
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CAST('2019-01-02' AS DATE)"),
        ("TimeStamp", "CAST('2019-01-02T03:04:05.678900' AS TIMESTAMP)"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_get_cancel_query_id() -> None:
    query = Query()

    cursor_mock = Mock()
    last_operation_mock = Mock()
    cursor_mock._last_operation = last_operation_mock

    guid = bytes(reversed(bytes.fromhex("9fbdba20000000006940643a2731718b")))
    last_operation_mock.handle.operationId.guid = guid

    assert (
        spec.get_cancel_query_id(cursor_mock, query)
        == "6940643a2731718b:9fbdba2000000000"
    )


@patch("superset.db_engine_specs.impala.is_safe_host", return_value=True)
@patch("requests.post")
def test_cancel_query(post_mock: Mock, _safe_host: Mock) -> None:  # noqa: PT019
    query = Query()
    database = Database(
        database_name="test_impala",
        sqlalchemy_uri="impala://impala.example.com:21050/default",
    )
    query.database = database

    response_mock = Mock()
    response_mock.status_code = 200
    post_mock.return_value = response_mock

    result = spec.cancel_query(None, query, "6940643a2731718b:9fbdba2000000000")

    post_mock.assert_called_once_with(
        "http://impala.example.com:25000/cancel_query?query_id=6940643a2731718b:9fbdba2000000000",
        timeout=3,
        allow_redirects=False,
    )
    assert result is True


@patch("superset.db_engine_specs.impala.is_safe_host", return_value=True)
@patch("requests.post")
def test_cancel_query_failed(post_mock: Mock, _safe_host: Mock) -> None:  # noqa: PT019
    query = Query()
    database = Database(
        database_name="test_impala",
        sqlalchemy_uri="impala://impala.example.com:21050/default",
    )
    query.database = database

    response_mock = Mock()
    response_mock.status_code = 500
    post_mock.return_value = response_mock

    result = spec.cancel_query(None, query, "6940643a2731718b:9fbdba2000000000")

    post_mock.assert_called_once_with(
        "http://impala.example.com:25000/cancel_query?query_id=6940643a2731718b:9fbdba2000000000",
        timeout=3,
        allow_redirects=False,
    )
    assert result is False


@patch("superset.db_engine_specs.impala.is_safe_host", return_value=True)
@patch("requests.post")
def test_cancel_query_exception(post_mock: Mock, _safe_host: Mock) -> None:  # noqa: PT019
    query = Query()
    database = Database(
        database_name="test_impala",
        sqlalchemy_uri="impala://impala.example.com:21050/default",
    )
    query.database = database

    post_mock.side_effect = Exception("Network error")

    result = spec.cancel_query(None, query, "6940643a2731718b:9fbdba2000000000")

    assert result is False


@patch("requests.post")
def test_cancel_query_blocks_internal_host(post_mock: Mock, app_context: None) -> None:
    """A private/internal Impala host is refused by default (no HTTP call)."""
    query = Query()
    database = Database(
        database_name="test_impala",
        sqlalchemy_uri="impala://169.254.169.254:21050/default",
    )
    query.database = database

    result = spec.cancel_query(None, query, "6940643a2731718b:9fbdba2000000000")

    assert result is False
    post_mock.assert_not_called()


@patch("requests.post")
def test_cancel_query_allows_internal_host_with_opt_out(
    post_mock: Mock, app_context: None
) -> None:
    """IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS=True permits internal targets."""
    from flask import current_app

    query = Query()
    database = Database(
        database_name="test_impala",
        sqlalchemy_uri="impala://10.0.0.5:21050/default",
    )
    query.database = database

    response_mock = Mock()
    response_mock.status_code = 200
    post_mock.return_value = response_mock

    original = current_app.config.get("IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS")
    current_app.config["IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS"] = True
    try:
        result = spec.cancel_query(None, query, "6940643a2731718b:9fbdba2000000000")
    finally:
        current_app.config["IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS"] = original

    post_mock.assert_called_once_with(
        "http://10.0.0.5:25000/cancel_query?query_id=6940643a2731718b:9fbdba2000000000",
        timeout=3,
        allow_redirects=False,
    )
    assert result is True


def test_presentation_timezone_grain_utc_source() -> None:
    """A UTC-stored Impala column is shifted to the presentation zone, then bucketed."""
    actual = str(
        spec.get_timestamp_expr(
            col=column("col", types.TIMESTAMP()),
            pdf=None,
            time_grain="P1D",
            presentation_timezone="America/New_York",
            source_timezone="UTC",
            source_type="TIMESTAMP",
        )
    )
    assert actual == "TRUNC(FROM_UTC_TIMESTAMP(col, 'America/New_York'), 'DD')"


def test_presentation_timezone_grain_non_utc_source() -> None:
    """A non-UTC source is first normalized to UTC, then shifted to the zone."""
    actual = str(
        spec.get_timestamp_expr(
            col=column("col", types.TIMESTAMP()),
            pdf=None,
            time_grain="P1D",
            presentation_timezone="America/New_York",
            source_timezone="America/Chicago",
            source_type="TIMESTAMP",
        )
    )
    assert actual == (
        "TRUNC(FROM_UTC_TIMESTAMP("
        "TO_UTC_TIMESTAMP(col, 'America/Chicago'), 'America/New_York'), 'DD')"
    )


def test_presentation_timezone_epoch_seconds() -> None:
    """An epoch column is decoded (UTC) then shifted to the presentation zone."""
    actual = str(
        spec.get_timestamp_expr(
            col=column("col"),
            pdf="epoch_s",
            time_grain="P1D",
            presentation_timezone="America/New_York",
        )
    )
    assert actual == (
        "TRUNC(FROM_UTC_TIMESTAMP(from_unixtime(col), 'America/New_York'), 'DD')"
    )


def test_presentation_timezone_requires_source() -> None:
    """A zone-less Impala column with no source zone is refused."""
    with pytest.raises(ValueError, match="source_timezone is required"):
        spec.get_timestamp_expr(
            col=column("col", types.TIMESTAMP()),
            pdf=None,
            time_grain="P1D",
            presentation_timezone="America/New_York",
            source_type="TIMESTAMP",
        )


def test_presentation_timezone_rejects_unknown_zone() -> None:
    """An out-of-allowlist zone never reaches the generated SQL."""
    with pytest.raises(ValueError, match="Invalid IANA time zone"):
        spec.get_timestamp_expr(
            col=column("col", types.TIMESTAMP()),
            pdf=None,
            time_grain="P1D",
            presentation_timezone="Not/AZone",
            source_timezone="UTC",
            source_type="TIMESTAMP",
        )


def test_presentation_timezone_unset_is_byte_identical() -> None:
    """No presentation zone ⇒ SQL identical to the current generator."""
    plain = str(
        spec.get_timestamp_expr(
            col=column("col", types.TIMESTAMP()),
            pdf=None,
            time_grain="P1D",
        )
    )
    assert plain == "TRUNC(col, 'DD')"


def test_presentation_timezone_bound_utc_source() -> None:
    """A UTC-source boundary is converted from presentation wall-clock to UTC."""
    bound = spec.presentation_timezone_bound(
        datetime(2024, 1, 1, 0, 0, 0), "America/New_York", "UTC", False
    )
    assert bound == (
        "TO_UTC_TIMESTAMP(CAST('2024-01-01 00:00:00.000000' AS TIMESTAMP), "
        "'America/New_York')"
    )


def test_presentation_timezone_bound_non_utc_source() -> None:
    """A non-UTC source boundary is further expressed in the column's source zone."""
    bound = spec.presentation_timezone_bound(
        datetime(2024, 1, 1, 0, 0, 0), "America/New_York", "America/Chicago", False
    )
    assert bound == (
        "FROM_UTC_TIMESTAMP(TO_UTC_TIMESTAMP("
        "CAST('2024-01-01 00:00:00.000000' AS TIMESTAMP), 'America/New_York'), "
        "'America/Chicago')"
    )


def test_presentation_timezone_bound_requires_source() -> None:
    with pytest.raises(ValueError, match="source_timezone is required"):
        spec.presentation_timezone_bound(
            datetime(2024, 1, 1), "America/New_York", None, False
        )


def test_epoch_ms_uses_integer_division() -> None:
    """epoch_ms must integer-divide (DIV): Impala's `/` always yields DOUBLE
    and from_unixtime() requires BIGINT, so the base-class `/1000` template
    fails analysis (verified on Impala 4.5.0)."""
    actual = str(
        spec.get_timestamp_expr(col=column("col"), pdf="epoch_ms", time_grain="P1D")
    )
    assert actual == "TRUNC(from_unixtime(CAST(col DIV 1000 AS BIGINT)), 'DD')"


def test_presentation_timezone_epoch_millis() -> None:
    """The zone wrap composes with the corrected epoch_ms decode."""
    actual = str(
        spec.get_timestamp_expr(
            col=column("col"),
            pdf="epoch_ms",
            time_grain="P1D",
            presentation_timezone="America/New_York",
        )
    )
    assert actual == (
        "TRUNC(FROM_UTC_TIMESTAMP(from_unixtime(CAST(col DIV 1000 AS BIGINT)), "
        "'America/New_York'), 'DD')"
    )
