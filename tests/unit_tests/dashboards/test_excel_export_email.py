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
from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock, patch

from superset.dashboards.excel_export import email

REQUESTED = datetime(2026, 1, 1, 12, 0, 0)
EXPIRES = datetime(2026, 1, 2, 12, 0, 0)


def test_success_email_contains_link_and_expiry() -> None:
    html = email.build_success_email(
        dashboard_title="Sales",
        download_url="https://signed.example/file.xlsx?sig=abc",
        requested_at=REQUESTED,
        expires_at=EXPIRES,
        ttl_seconds=86400,
        skipped_charts=[],
    )
    assert "https://signed.example/file.xlsx?sig=abc" in html
    assert "expires in 24 hours" in html
    assert "2026-01-02 12:00:00 UTC" in html
    assert "2026-01-01 12:00:00 UTC" in html
    assert "<li>" not in html  # no skipped section


def test_success_email_lists_skipped_charts() -> None:
    html = email.build_success_email(
        dashboard_title="Sales",
        download_url="https://x",
        requested_at=REQUESTED,
        expires_at=EXPIRES,
        ttl_seconds=86400,
        skipped_charts=["10 - Broken chart"],
    )
    assert "no saved query context" in html
    assert "<li>10 - Broken chart</li>" in html


def test_success_email_escapes_title() -> None:
    html = email.build_success_email(
        dashboard_title="<script>alert(1)</script>",
        download_url="https://x",
        requested_at=REQUESTED,
        expires_at=EXPIRES,
        ttl_seconds=86400,
        skipped_charts=[],
    )
    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_failure_email_body() -> None:
    html = email.build_failure_email("Sales", REQUESTED)
    assert "could not be completed" in html
    assert "2026-01-01 12:00:00 UTC" in html


@patch("superset.dashboards.excel_export.email.current_app")
def test_build_subject(mock_app: MagicMock) -> None:
    mock_app.config = {"EMAIL_REPORTS_SUBJECT_PREFIX": "[Report] "}
    assert (
        email.build_subject("Sales", success=True)
        == "[Report] Your dashboard export is ready: Sales"
    )
    assert email.build_subject("Sales", success=False).startswith(
        "[Report] Your dashboard export could not be completed"
    )


@patch("superset.dashboards.excel_export.email.send_email_smtp")
@patch("superset.dashboards.excel_export.email.current_app")
def test_send_export_email(mock_app: MagicMock, mock_send: MagicMock) -> None:
    mock_app.config = {"SMTP_HOST": "localhost"}
    email.send_export_email("user@example.com", "subj", "<html></html>")
    mock_send.assert_called_once_with(
        to="user@example.com",
        subject="subj",
        html_content="<html></html>",
        config=mock_app.config,
    )
