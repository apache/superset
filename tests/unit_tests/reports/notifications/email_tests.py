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
from io import BytesIO
from typing import TYPE_CHECKING
from zipfile import is_zipfile, ZipExtFile

import pandas as pd
import pytest
from freezegun import freeze_time
from pytz import timezone

from tests.unit_tests.conftest import with_feature_flags

if TYPE_CHECKING:
    from superset.reports.notifications.email import EmailNotification


def test_render_description_with_html() -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    content = NotificationContent(
        name="test alert",
        embedded_data=pd.DataFrame(
            {
                "A": [1, 2, 3],
                "B": [4, 5, 6],
                "C": ["111", "222", '<a href="http://www.example.com">333</a>'],
            }
        ),
        description='<p>This is <a href="#">a test</a> alert</p><br />',
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "editors": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
            "execution_id": "test-execution-id",
        },
    )
    email_body = (
        EmailNotification(
            recipient=ReportRecipients(type=ReportRecipientType.EMAIL), content=content
        )
        ._get_content()
        .body
    )
    assert (
        '<p>This is <a href="#" rel="noopener noreferrer">a test</a> alert</p><br>'
        in email_body
    )
    assert '<td>&lt;a href="http://www.example.com"&gt;333&lt;/a&gt;</td>' in email_body


def test_error_template_sanitizes_html() -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    content = NotificationContent(
        name="test alert",
        text='DB error near "<img src=x onerror=alert(1)><script>alert(2)</script>"',
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "editors": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
            "execution_id": "test-execution-id",
        },
    )
    email_body = (
        EmailNotification(
            recipient=ReportRecipients(type=ReportRecipientType.EMAIL), content=content
        )
        ._get_content()
        .body
    )

    # Injected markup in the error text must be stripped, not rendered.
    assert "<img" not in email_body
    assert "<script>" not in email_body
    assert "onerror=alert(1)" not in email_body


def test_cta_link_included_by_default() -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    content = NotificationContent(
        name="test alert",
        description="<p>This is a test alert</p>",
        url="http://example.com/superset/dashboard/1/",
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "editors": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
            "execution_id": "test-execution-id",
        },
    )
    email_body = (
        EmailNotification(
            recipient=ReportRecipients(type=ReportRecipientType.EMAIL), content=content
        )
        ._get_content()
        .body
    )
    assert (
        '<b><a href="http://example.com/superset/dashboard/1/">'
        "Explore in Superset</a></b>" in email_body
    )


def test_cta_link_omitted_when_include_cta_is_false() -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    content = NotificationContent(
        name="test alert",
        description="<p>This is a test alert</p>",
        url="http://example.com/superset/dashboard/1/",
        include_cta=False,
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "editors": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
            "execution_id": "test-execution-id",
        },
    )
    email_body = (
        EmailNotification(
            recipient=ReportRecipients(type=ReportRecipientType.EMAIL), content=content
        )
        ._get_content()
        .body
    )
    assert "Explore in Superset" not in email_body
    assert "http://example.com/superset/dashboard/1/" not in email_body
    assert "<p>This is a test alert</p>" in email_body


def test_error_template_cta_link_respects_include_cta() -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    content = NotificationContent(
        name="test alert",
        text="Report generation failed",
        url="http://example.com/superset/dashboard/1/",
        include_cta=False,
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "editors": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
            "execution_id": "test-execution-id",
        },
    )
    email_body = (
        EmailNotification(
            recipient=ReportRecipients(type=ReportRecipientType.EMAIL), content=content
        )
        ._get_content()
        .body
    )
    assert "Report generation failed" in email_body
    assert "Explore in Superset" not in email_body
    assert "http://example.com/superset/dashboard/1/" not in email_body


@pytest.mark.parametrize(
    "include_cta",
    [True, False],
    ids=["with-cta", "without-cta"],
)
def test_retry_error_template_cta_link_respects_include_cta(
    include_cta: bool,
) -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    content = NotificationContent(
        name="test alert",
        text="Report generation failed",
        url="http://example.com/superset/dashboard/1/",
        include_cta=include_cta,
        retry_attempt=1,
        retry_max_attempts=3,
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "editors": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
            "execution_id": "test-execution-id",
        },
    )
    email_body = (
        EmailNotification(
            recipient=ReportRecipients(type=ReportRecipientType.EMAIL), content=content
        )
        ._get_content()
        .body
    )
    assert "Retry in Progress" in email_body
    if include_cta:
        assert "Explore in Superset" in email_body
        assert "http://example.com/superset/dashboard/1/" in email_body
    else:
        assert "Explore in Superset" not in email_body
        assert "http://example.com/superset/dashboard/1/" not in email_body


@pytest.mark.parametrize(
    "include_cta",
    [True, False],
    ids=["with-cta", "without-cta"],
)
def test_final_failure_template_cta_link_respects_include_cta(
    include_cta: bool,
) -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    content = NotificationContent(
        name="test alert",
        text="Report generation failed",
        url="http://example.com/superset/dashboard/1/",
        include_cta=include_cta,
        retry_max_attempts=3,
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "editors": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
            "execution_id": "test-execution-id",
        },
    )
    email_body = (
        EmailNotification(
            recipient=ReportRecipients(type=ReportRecipientType.EMAIL), content=content
        )
        ._get_content()
        .body
    )
    assert "failed to generate after" in email_body
    if include_cta:
        assert "Explore in Superset" in email_body
        assert "http://example.com/superset/dashboard/1/" in email_body
    else:
        assert "Explore in Superset" not in email_body
        assert "http://example.com/superset/dashboard/1/" not in email_body


@with_feature_flags(DATE_FORMAT_IN_EMAIL_SUBJECT=True)
def test_email_subject_with_datetime() -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    datetime_pattern = "%Y-%m-%d"

    content = NotificationContent(
        name=f"test alert {datetime_pattern}",
        embedded_data=pd.DataFrame(
            {
                "A": [1, 2, 3],
            }
        ),
        description='<p>This is <a href="#">a test</a> alert</p><br />',
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "editors": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
            "execution_id": "test-execution-id",
        },
    )
    # Freeze the clock to a fixed, distinctive instant and construct the
    # notification *under* the freeze. The subject date must reflect this
    # frozen moment, which is only possible if the timestamp is stamped per
    # instance at construction/send time. If the timestamp were a class
    # attribute evaluated at import time (the regression this fixes), it would
    # carry the real import-time date instead and this assertion would fail.
    frozen_now = datetime(2021, 4, 22, 12, 0, 0, tzinfo=timezone("UTC"))
    with freeze_time(frozen_now):
        notification = EmailNotification(
            recipient=ReportRecipients(type=ReportRecipientType.EMAIL),
            content=content,
        )
        subject = notification._get_subject()
    assert datetime_pattern not in subject
    assert frozen_now.strftime(datetime_pattern) in subject


def _make_notification(
    *,
    csv: bytes | None = None,
    xlsx: bytes | None = None,
) -> "EmailNotification":
    """Build an email notification for attachment tests."""
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    recipient = ReportRecipients(type=ReportRecipientType.EMAIL)
    content = NotificationContent(
        name="test report",
        text=None,
        csv=csv,
        xlsx=xlsx,
        header_data={
            "notification_format": "CSV" if csv is not None else "XLSX",
            "notification_type": "Report",
            "editors": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
            "execution_id": "test-execution-id",
        },
    )
    return EmailNotification(recipient=recipient, content=content)


def test_get_csv_attachment_extension_for_csv_content() -> None:
    """Plain CSV bytes keep the CSV extension."""
    from superset.reports.notifications.email import (
        _get_csv_attachment_extension,
    )

    assert _get_csv_attachment_extension(b"value\n1\n2\n") == "csv"


def test_get_csv_attachment_extension_for_zip_content() -> None:
    """A ZIP bundling one CSV per query is identified as an archive."""
    from superset.reports.notifications.email import (
        _get_csv_attachment_extension,
    )
    from superset.utils.core import create_zip

    archive = create_zip({"query_1.csv": b"value\n1\n2\n"}).getvalue()

    assert _get_csv_attachment_extension(archive) == "zip"


def test_get_csv_attachment_extension_for_damaged_zip_content() -> None:
    """Bytes carrying the archive signature stay an archive even if unreadable.

    A truncated bundle no longer parses as a ZIP, but it is still what the
    endpoint produced, so naming it ``.zip`` describes it correctly. Naming it
    ``.csv`` would produce an attachment that opens as neither format.
    """
    from superset.reports.notifications.email import (
        _get_csv_attachment_extension,
    )
    from superset.utils.core import create_zip

    archive = create_zip(
        {
            "query_1.csv": b"value\n1\n2\n",
            "query_2.csv": b"value\n3\n4\n",
        }
    ).getvalue()
    truncated = archive[: len(archive) // 2]

    assert not is_zipfile(BytesIO(truncated))
    assert _get_csv_attachment_extension(truncated) == "zip"


def test_get_xlsx_attachment_extension_for_non_zip_content() -> None:
    """Non-ZIP responses retain the XLSX extension."""
    from superset.reports.notifications.email import (
        _get_xlsx_attachment_extension,
    )

    assert _get_xlsx_attachment_extension(b"xlsx-response") == "xlsx"


def test_get_xlsx_attachment_extension_for_xlsx_content() -> None:
    """An OOXML workbook is identified as XLSX."""
    from superset.reports.notifications.email import (
        _get_xlsx_attachment_extension,
    )
    from superset.utils import excel

    xlsx = excel.df_to_excel(pd.DataFrame({"value": [1, 2]}), index=False)

    assert _get_xlsx_attachment_extension(xlsx) == "xlsx"


def test_get_xlsx_attachment_extension_for_invalid_xlsx_zip_content() -> None:
    """A ZIP with invalid XLSX entries is not identified as a report archive."""
    from superset.reports.notifications.email import (
        _get_xlsx_attachment_extension,
    )
    from superset.utils.core import create_zip

    archive = create_zip({"query_1.xlsx": b"xlsx-response"}).getvalue()

    assert _get_xlsx_attachment_extension(archive) == "xlsx"


def test_get_xlsx_attachment_extension_reads_nested_zip_signatures_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Nested XLSX detection should not read each workbook into memory."""
    from superset.reports.notifications.email import (
        _get_xlsx_attachment_extension,
    )
    from superset.utils import excel
    from superset.utils.core import create_zip

    read_sizes: list[int] = []
    original_read = ZipExtFile.read

    def read_signature(self: ZipExtFile, n: int = -1) -> bytes:
        read_sizes.append(n)
        return original_read(self, n)

    monkeypatch.setattr(ZipExtFile, "read", read_signature)

    xlsx = excel.df_to_excel(pd.DataFrame({"value": [1, 2]}), index=False)
    archive = create_zip({"query_1.xlsx": xlsx, "query_2.xlsx": xlsx}).getvalue()

    assert _get_xlsx_attachment_extension(archive) == "zip"
    assert read_sizes == [4, 4]


@pytest.mark.parametrize(
    ("is_multi_query_bundle", "expected_extension"),
    [
        (False, "xlsx"),
        (True, "zip"),
    ],
)
def test_xlsx_report_attachment_extension(
    is_multi_query_bundle: bool,
    expected_extension: str,
) -> None:
    """Multi-query XLSX bundles should be attached as ZIP archives."""
    from superset.utils import excel
    from superset.utils.core import create_zip

    xlsx = excel.df_to_excel(pd.DataFrame({"value": [1, 2]}), index=False)
    attachment = (
        create_zip(
            {
                "query_1.xlsx": xlsx,
                "query_2.xlsx": xlsx,
            }
        ).getvalue()
        if is_multi_query_bundle
        else xlsx
    )

    email_content = _make_notification(xlsx=attachment)._get_content()

    assert email_content.data == {
        f"test report.{expected_extension}": attachment,
    }


@pytest.mark.parametrize(
    ("is_multi_query_bundle", "expected_extension"),
    [
        (False, "csv"),
        (True, "zip"),
    ],
)
def test_csv_report_attachment_extension(
    is_multi_query_bundle: bool,
    expected_extension: str,
) -> None:
    """Multi-query CSV bundles should be attached as ZIP archives."""
    from superset.utils.core import create_zip

    csv = b"value\n1\n2\n"
    attachment = (
        create_zip(
            {
                "query_1.csv": csv,
                "query_2.csv": csv,
            }
        ).getvalue()
        if is_multi_query_bundle
        else csv
    )

    email_content = _make_notification(csv=attachment)._get_content()

    assert email_content.data == {
        f"test report.{expected_extension}": attachment,
    }
