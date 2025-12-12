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
from unittest.mock import patch, MagicMock, ANY

import pandas as pd
from pytz import timezone

from superset.reports.models import ReportRecipients, ReportRecipientType
from superset.reports.notifications.base import NotificationContent
from superset.reports.notifications.email import EmailNotification
from tests.unit_tests.conftest import with_feature_flags


# Helper to mock app.config.get
def get_app_config_mock(config_values):
    def side_effect(key, default=None):
        return config_values.get(key, default)
    return side_effect

# Default config for PDF tests
DEFAULT_PDF_CONFIG = {
    "PDF_EXPORT_HEADERS_FOOTERS_ENABLED": True,
    "PDF_EXPORT_HEADER_TEMPLATE": "Header: {report_name} - Page {page_number}/{total_pages}",
    "PDF_EXPORT_FOOTER_TEMPLATE": "Footer: {generation_date} - {report_name}",
    "PDF_EXPORT_PAGE_SIZE": "A4",
    "PDF_EXPORT_ORIENTATION": "portrait",
    "EMAIL_REPORTS_SUBJECT_PREFIX": "[Test Report]",
    "EMAIL_REPORTS_CTA": "Test CTA",
    "SMTP_MAIL_FROM": "test@example.com"
}


def test_render_description_with_html() -> None:
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
            "owners": [1],
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


@with_feature_flags(DATE_FORMAT_IN_EMAIL_SUBJECT=True)
def test_email_subject_with_datetime() -> None:
    now = datetime.now(timezone("UTC"))
    datetime_pattern = "%Y-%m-%d"
    content = NotificationContent(
        name=f"test alert {datetime_pattern}",
        embedded_data=pd.DataFrame({"A": [1, 2, 3]}),
        description='<p>This is <a href="#">a test</a> alert</p><br />',
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "owners": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
            "execution_id": "test-execution-id",
        },
    )
    subject = EmailNotification(
        recipient=ReportRecipients(type=ReportRecipientType.EMAIL), content=content
    )._get_subject()
    assert datetime_pattern not in subject
    assert now.strftime(datetime_pattern) in subject


@patch('superset.reports.notifications.email.is_feature_enabled')
@patch('superset.reports.notifications.email.CSS')
@patch('superset.reports.notifications.email.HTML')
@patch('superset.reports.notifications.email.app')
def test_pdf_generation_triggered_and_content(mock_app, mock_html, mock_css, mock_is_feature_enabled):
    mock_is_feature_enabled.return_value = False # For self._name simplicity
    mock_app.config.get.side_effect = get_app_config_mock(DEFAULT_PDF_CONFIG)

    mock_pdf_bytes = b"mock_pdf_content"
    mock_html_instance = MagicMock()
    mock_html_instance.write_pdf.return_value = mock_pdf_bytes
    mock_html.return_value = mock_html_instance

    mock_content = MagicMock(spec=NotificationContent)
    mock_content.name = "Test Report Name"
    mock_content.description = "Test PDF Description"
    mock_content.embedded_data = pd.DataFrame({'col1': [10, 20], 'col2': ['X', 'Y']})
    mock_content.screenshots = None
    mock_content.csv = None
    mock_content.pdf = None
    mock_content.text = None
    mock_content.report_format = "PDF"
    mock_content.url = "http://superset.example.com"
    mock_content.header_data = {}

    notification = EmailNotification(recipient=MagicMock(), content=mock_content)
    email_content_result = notification._get_content()

    mock_html.assert_called_once()
    args_html, kwargs_html = mock_html.call_args
    html_passed_to_weasyprint = kwargs_html.get('string', args_html[0] if args_html else '')
    assert '<div class="report-description">Test PDF Description</div>' in html_passed_to_weasyprint
    assert "<td>X</td>" in html_passed_to_weasyprint # Check for df.to_html(..., escape=False)
    assert ":root" in html_passed_to_weasyprint # Check for CSS variables block
    assert f'--report-name-var: "{mock_content.name}";' in html_passed_to_weasyprint

    mock_css.assert_called_once()
    args_css, kwargs_css = mock_css.call_args
    css_string_passed = kwargs_css.get('string', args_css[0] if args_css else '')
    assert "@page { size: A4 portrait; margin: 2.5cm 1.5cm 2cm 1.5cm; }" in css_string_passed
    assert 'body { font-family: sans-serif; }' in css_string_passed

    assert email_content_result.pdf == {f"{mock_content.name}.pdf": mock_pdf_bytes}
    # Check that html_table is not included in the email body
    assert "<table" not in email_content_result.body
    assert mock_content.description not in email_content_result.body # Description should be in PDF

@patch('superset.reports.notifications.email.is_feature_enabled')
@patch('superset.reports.notifications.email.CSS')
@patch('superset.reports.notifications.email.HTML')
@patch('superset.reports.notifications.email.app')
def test_pdf_headers_footers_enabled(mock_app, mock_html, mock_css, mock_is_feature_enabled):
    mock_is_feature_enabled.return_value = False
    config = {**DEFAULT_PDF_CONFIG, "PDF_EXPORT_HEADERS_FOOTERS_ENABLED": True}
    mock_app.config.get.side_effect = get_app_config_mock(config)

    mock_html_instance = MagicMock()
    mock_html_instance.write_pdf.return_value = b"pdf"
    mock_html.return_value = mock_html_instance

    mock_content = MagicMock(spec=NotificationContent, name="My Report", description="Desc", report_format="PDF", embedded_data=pd.DataFrame({'A': [1]}))
    mock_content.url = "http://superset.example.com"
    mock_content.header_data = {}


    notification = EmailNotification(recipient=MagicMock(), content=mock_content)
    notification._get_content()

    mock_css.assert_called_once()
    args_css, _ = mock_css.call_args
    css_string = args_css[0]

    expected_header_content = config["PDF_EXPORT_HEADER_TEMPLATE"].replace("{report_name}", "My Report")
    expected_header_content = expected_header_content.replace("{page_number}", "counter(page)")
    expected_header_content = expected_header_content.replace("{total_pages}", "counter(pages)")

    expected_footer_content = config["PDF_EXPORT_FOOTER_TEMPLATE"].replace("{generation_date}", notification.now.strftime('%Y-%m-%d %H:%M:%S UTC'))
    expected_footer_content = expected_footer_content.replace("{report_name}", "My Report")

    assert f'@page @top-center {{ content: "{expected_header_content}"; font-size: 9pt; color: #333; }}' in css_string
    assert f'@page @bottom-center {{ content: "{expected_footer_content}"; font-size: 9pt; color: #333; }}' in css_string

@patch('superset.reports.notifications.email.is_feature_enabled')
@patch('superset.reports.notifications.email.CSS')
@patch('superset.reports.notifications.email.HTML')
@patch('superset.reports.notifications.email.app')
def test_pdf_headers_footers_disabled(mock_app, mock_html, mock_css, mock_is_feature_enabled):
    mock_is_feature_enabled.return_value = False
    config = {**DEFAULT_PDF_CONFIG, "PDF_EXPORT_HEADERS_FOOTERS_ENABLED": False}
    mock_app.config.get.side_effect = get_app_config_mock(config)

    mock_html_instance = MagicMock()
    mock_html_instance.write_pdf.return_value = b"pdf"
    mock_html.return_value = mock_html_instance

    mock_content = MagicMock(spec=NotificationContent, name="My Report", description="Desc", report_format="PDF", embedded_data=pd.DataFrame({'A': [1]}))
    mock_content.url = "http://superset.example.com"
    mock_content.header_data = {}

    notification = EmailNotification(recipient=MagicMock(), content=mock_content)
    notification._get_content()

    mock_css.assert_called_once()
    args_css, _ = mock_css.call_args
    css_string = args_css[0]
    assert '@page @top-center { content: ""; }' in css_string # Check one, assume others are similar
    assert '@page @bottom-center { content: ""; }' in css_string


@patch('superset.reports.notifications.email.is_feature_enabled')
@patch('superset.reports.notifications.email.CSS')
@patch('superset.reports.notifications.email.HTML')
@patch('superset.reports.notifications.email.app')
def test_pdf_page_size_orientation(mock_app, mock_html, mock_css, mock_is_feature_enabled):
    mock_is_feature_enabled.return_value = False
    config = {**DEFAULT_PDF_CONFIG, "PDF_EXPORT_PAGE_SIZE": "Letter", "PDF_EXPORT_ORIENTATION": "landscape"}
    mock_app.config.get.side_effect = get_app_config_mock(config)

    mock_html_instance = MagicMock()
    mock_html_instance.write_pdf.return_value = b"pdf"
    mock_html.return_value = mock_html_instance

    mock_content = MagicMock(spec=NotificationContent, name="My Report", description="Desc", report_format="PDF", embedded_data=pd.DataFrame({'A': [1]}))
    mock_content.url = "http://superset.example.com"
    mock_content.header_data = {}

    notification = EmailNotification(recipient=MagicMock(), content=mock_content)
    notification._get_content()

    mock_css.assert_called_once()
    args_css, _ = mock_css.call_args
    css_string = args_css[0]
    assert "@page { size: Letter landscape; margin: 2.5cm 1.5cm 2cm 1.5cm; }" in css_string

@patch('superset.reports.notifications.email.is_feature_enabled')
@patch('superset.reports.notifications.email.CSS')
@patch('superset.reports.notifications.email.HTML')
@patch('superset.reports.notifications.email.app')
def test_fallback_to_html_when_not_pdf_format(mock_app, mock_html, mock_css, mock_is_feature_enabled):
    mock_is_feature_enabled.return_value = False
    mock_app.config.get.side_effect = get_app_config_mock(DEFAULT_PDF_CONFIG)

    mock_content = MagicMock(spec=NotificationContent)
    mock_content.name = "HTML Report"
    mock_content.description = "HTML Description"
    mock_content.embedded_data = pd.DataFrame({'col1': [1], 'col2': ['A']})
    mock_content.screenshots = None
    mock_content.csv = None
    mock_content.pdf = None
    mock_content.text = None
    mock_content.report_format = "PNG" # Not PDF
    mock_content.url = "http://superset.example.com"
    mock_content.header_data = {}


    notification = EmailNotification(recipient=MagicMock(), content=mock_content)
    email_content_result = notification._get_content()

    mock_html.assert_not_called()
    mock_css.assert_not_called()

    assert email_content_result.pdf is None
    assert "HTML Description" in email_content_result.body
    assert "<table" in email_content_result.body # HTML table should be in body
    # Check that pandas escapes HTML by default
    mock_content.embedded_data = pd.DataFrame({'col1': ['<script>alert(1)</script>']})
    email_content_result_escaped = notification._get_content()
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in email_content_result_escaped.body
