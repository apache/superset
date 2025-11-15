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
import logging
import textwrap
from dataclasses import dataclass
from datetime import datetime
from email.utils import make_msgid, parseaddr
from typing import Any, Optional

import nh3
from flask import current_app
from flask_babel import gettext as __
from pytz import timezone

from superset import is_feature_enabled
from superset.exceptions import SupersetErrorsException
from superset.reports.models import ReportRecipientType
from superset.reports.notifications.base import BaseNotification
from superset.reports.notifications.exceptions import NotificationError
from superset.utils import json
from superset.utils.core import HeaderDataType, send_email_smtp
from superset.utils.decorators import statsd_gauge

logger = logging.getLogger(__name__)

TABLE_TAGS = {"table", "th", "tr", "td", "thead", "tbody", "tfoot"}
TABLE_ATTRIBUTES = {"colspan", "rowspan", "halign", "border", "class"}

ALLOWED_TAGS = {
    "a",
    "abbr",
    "acronym",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "i",
    "li",
    "ol",
    "p",
    "strong",
    "ul",
}.union(TABLE_TAGS)

ALLOWED_TABLE_ATTRIBUTES = {tag: TABLE_ATTRIBUTES for tag in TABLE_TAGS}
ALLOWED_ATTRIBUTES = {
    "a": {"href", "title"},
    "abbr": {"title"},
    "acronym": {"title"},
    **ALLOWED_TABLE_ATTRIBUTES,
}


@dataclass
class EmailContent:
    body: str
    header_data: Optional[HeaderDataType] = None
    data: Optional[dict[str, Any]] = None
    pdf: Optional[dict[str, bytes]] = None
    images: Optional[dict[str, bytes]] = None


class EmailNotification(BaseNotification):  # pylint: disable=too-few-public-methods
    """
    Sends an email notification for a report recipient
    """

    type = ReportRecipientType.EMAIL
    now = datetime.now(timezone("UTC"))

    @property
    def _name(self) -> str:
        """Include date format in the name if feature flag is enabled"""
        return (
            self._parse_name(self._content.name)
            if is_feature_enabled("DATE_FORMAT_IN_EMAIL_SUBJECT")
            else self._content.name
        )

    @staticmethod
    def _get_smtp_domain() -> str:
        return parseaddr(current_app.config["SMTP_MAIL_FROM"])[1].split("@")[1]

    def _error_template(self, text: str) -> str:
        call_to_action = self._get_call_to_action()
        return __(
            """
            <p>Your report/alert was unable to be generated because of the following error: %(text)s</p>
            <p>Please check your dashboard/chart for errors.</p>
            <p><b><a href="%(url)s">%(call_to_action)s</a></b></p>
            """,  # noqa: E501
            text=text,
            url=self._content.url,
            call_to_action=call_to_action,
        )

    def _get_content(self) -> EmailContent:
        if self._content.text:
            return EmailContent(body=self._error_template(self._content.text))

        # Strip any malicious HTML from the description
        # pylint: disable=no-member
        description = nh3.clean(
            self._content.description or "",
            tags=ALLOWED_TAGS,
            attributes=ALLOWED_ATTRIBUTES,
        )

        # Strip malicious HTML from embedded data, allowing only table elements
        if self._content.embedded_data is not None:
            df = self._content.embedded_data
            # pylint: disable=no-member
            html_table = nh3.clean(
                df.to_html(na_rep="", index=True, escape=True),
                # pandas will escape the HTML in cells already, so passing
                # more allowed tags here will not work
                tags=TABLE_TAGS,
                attributes=ALLOWED_TABLE_ATTRIBUTES,
            )
        else:
            html_table = ""

        # Handle Azure Blob Storage for attachments
        azure_links_html = ""
        if current_app.config.get("AZURE_BLOB_REPORTS_ENABLED", False):
            # Upload attachments to Azure Blob Storage
            from superset.utils.azure_blob import upload_report_attachments

            blob_urls = upload_report_attachments(
                csv_data=self._content.csv,
                pdf_data=self._content.pdf,
                screenshots=self._content.screenshots,
                report_name=self._name,
            )

            # Generate download links section if configured
            if blob_urls and current_app.config.get(
                "AZURE_BLOB_REPORTS_INCLUDE_LINKS", True
            ):
                links = []
                if "csv" in blob_urls:
                    links.append(
                        f'<li><a href="{blob_urls["csv"]}">Download CSV</a></li>'
                    )
                if "pdf" in blob_urls:
                    links.append(
                        f'<li><a href="{blob_urls["pdf"]}">Download PDF</a></li>'
                    )
                if "screenshots" in blob_urls:
                    for idx, url in enumerate(blob_urls["screenshots"], 1):
                        links.append(
                            f'<li><a href="{url}">Download Screenshot {idx}</a></li>'
                        )

                if links:
                    azure_links_html = """
                    <div style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
                        <h3 style="margin-top: 0; color: #42526E;">Report Attachments</h3>
                        <ul style="list-style-type: none; padding-left: 0;">
                            {}
                        </ul>
                        <p style="font-size: 12px; color: #6B778C; margin-bottom: 0;">
                            <em>Links expire in {} days</em>
                        </p>
                    </div>
                    """.format(
                        "".join(links),
                        int(
                            current_app.config.get(
                                "AZURE_BLOB_REPORTS_SAS_EXPIRY_HOURS", 168
                            )
                            / 24
                        ),
                    )

        call_to_action = self._get_call_to_action()
        body = textwrap.dedent(
            f"""
            <html>
              <head>
                <style type="text/css">
                  table, th, td {{
                    border-collapse: collapse;
                    border-color: rgb(200, 212, 227);
                    color: rgb(42, 63, 95);
                    padding: 4px 8px;
                  }}
                  a {{
                    color: #0052CC;
                    text-decoration: none;
                  }}
                  a:hover {{
                    text-decoration: underline;
                  }}
                </style>
              </head>
              <body>
                <div>{description}</div>
                <br>
                <b><a href="{self._content.url}">{call_to_action}</a></b><p></p>
                {html_table}
                {azure_links_html}
              </body>
            </html>
            """
        )

        # Attachments are not sent via email - either stored in Azure Blob or disabled
        return EmailContent(
            body=body,
            images=None,  # No images attached
            pdf=None,  # No PDF attachments
            data=None,  # No CSV attachments
            header_data=self._content.header_data,
        )

    def _get_subject(self) -> str:
        return __(
            "%(prefix)s %(title)s",
            prefix=current_app.config["EMAIL_REPORTS_SUBJECT_PREFIX"],
            title=self._name,
        )

    def _parse_name(self, name: str) -> str:
        """If user add a date format to the subject, parse it to the real date
        This feature is hidden behind a feature flag `DATE_FORMAT_IN_EMAIL_SUBJECT`
        by default it is disabled
        """
        return self.now.strftime(name)

    def _get_call_to_action(self) -> str:
        return __(current_app.config["EMAIL_REPORTS_CTA"])

    def _get_to(self) -> str:
        return json.loads(self._recipient.recipient_config_json)["target"]

    def _get_cc(self) -> str:
        # To accommodate backward compatibility
        return json.loads(self._recipient.recipient_config_json).get("ccTarget", "")

    def _get_bcc(self) -> str:
        # To accommodate backward compatibility
        return json.loads(self._recipient.recipient_config_json).get("bccTarget", "")

    @statsd_gauge("reports.email.send")
    def send(self) -> None:
        subject = self._get_subject()
        content = self._get_content()
        to = self._get_to()
        cc = self._get_cc()
        bcc = self._get_bcc()

        try:
            send_email_smtp(
                to,
                subject,
                content.body,
                current_app.config,
                files=[],
                data=content.data,
                pdf=content.pdf,
                images=content.images,
                mime_subtype="related",
                dryrun=False,
                cc=cc,
                bcc=bcc,
                header_data=content.header_data,
            )
            logger.info(
                "Report sent to email, task_id: %s, notification content is %s",
                content.header_data.get("execution_id")
                if content.header_data
                else None,
                content.header_data,
            )
        except SupersetErrorsException as ex:
            raise NotificationError(
                ";".join([error.message for error in ex.errors])
            ) from ex
        except Exception as ex:
            raise NotificationError(str(ex)) from ex
