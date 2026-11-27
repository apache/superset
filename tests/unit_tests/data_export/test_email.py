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
"""The email that delivers a full export."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest

from superset.data_export import email
from superset.utils.export_email import humanize_row_count, humanize_ttl

REQUESTED_AT = datetime(2026, 11, 26, 9, 0, tzinfo=timezone.utc)
EXPIRES_AT = datetime(2026, 11, 27, 9, 0, tzinfo=timezone.utc)


def _success(**overrides: Any) -> str:
    kwargs: dict[str, Any] = {
        "label": "Sales by region",
        "download_url": "https://superset.example.com/api/v1/data_export/download/x/",
        "row_count": 1_250_000,
        "requested_at": REQUESTED_AT,
        "expires_at": EXPIRES_AT,
        "ttl_seconds": 86400,
    }
    kwargs.update(overrides)
    return email.build_success_email(**kwargs)


def test_the_email_carries_a_link_rather_than_the_file(app_context: None) -> None:
    """An uncapped export has no size bound, so attaching it would mean
    building something no mail server would accept."""
    body = _success()

    assert 'href="https://superset.example.com/api/v1/data_export/download/x/"' in body
    assert "Download CSV file" in body


def test_the_email_states_how_many_rows_the_file_holds(app_context: None) -> None:
    """The requester asked for all of them; the count is how they check."""
    assert "1,250,000 rows" in _success()


def test_the_email_states_when_the_link_expires(app_context: None) -> None:
    body = _success()

    assert "24 hours" in body
    assert "2026-11-27 09:00:00 UTC" in body


def test_the_email_says_when_a_file_is_only_part_of_the_chart(
    app_context: None,
) -> None:
    body = _success(partial_note="Main result set only.")

    assert "Main result set only." in body


def test_a_chart_name_cannot_inject_markup(app_context: None) -> None:
    body = _success(label="<script>alert(1)</script>")

    assert "<script>" not in body
    assert "&lt;script&gt;" in body


def test_the_failure_email_explains_an_actionable_refusal(
    app_context: None,
) -> None:
    body = email.build_failure_email(
        "Sales", REQUESTED_AT, "Its row limit cannot be removed."
    )

    assert "Its row limit cannot be removed." in body


def test_the_failure_email_stays_generic_without_a_reason(
    app_context: None,
) -> None:
    """An internal error must not be quoted into an email."""
    body = email.build_failure_email("Sales", REQUESTED_AT)

    assert "An error occurred while generating the file" in body


def test_the_subject_says_whether_the_export_worked(app_context: None) -> None:
    assert "is ready" in email.build_subject("Sales", success=True)
    assert "could not be completed" in email.build_subject("Sales", success=False)


@pytest.mark.parametrize(
    "rows, expected",
    [(0, "0 rows"), (1, "1 row"), (1234567, "1,234,567 rows")],
)
def test_row_counts_read_naturally(app_context: None, rows: int, expected: str) -> None:
    assert humanize_row_count(rows) == expected


@pytest.mark.parametrize(
    "seconds, expected",
    [
        (86400, "24 hours"),
        (5400, "1 hour 30 minutes"),
        (900, "15 minutes"),
        (30, "30 seconds"),
    ],
)
def test_link_lifetimes_read_naturally(
    app_context: None, seconds: int, expected: str
) -> None:
    """The stated lifetime has to match the link's real expiration, so a
    sub-hour TTL keeps its minutes."""
    assert humanize_ttl(seconds) == expected
