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
import re
import textwrap
from dataclasses import dataclass
from datetime import datetime
from email.utils import make_msgid, parseaddr
from typing import Any, Optional

import nh3
from flask_babel import gettext as __

from superset import app
from superset.exceptions import SupersetErrorsException
from superset.reports.models import ReportRecipientType
from superset.reports.notifications.base import BaseNotification
from superset.reports.notifications.exceptions import NotificationError
from superset.utils import json
from superset.utils.core import get_email_address_list, HeaderDataType, send_email_smtp
from superset.utils.decorators import statsd_gauge

logger = logging.getLogger(__name__)


def replace_date_placeholders(text: str) -> str:
    """
    Replace date placeholders in text with current date.
    Supports user-friendly date format patterns within curly braces.

    Examples:
    - {yyyyMMdd} -> 20240912
    - {yyyy-MM-dd} -> 2024-09-12
    - {yyMMdd} -> 240912
    - {yyyyMMdd_HHmmss} -> 20240912_143045
    - {yyyy/MM/dd} -> 2024/09/12
    """
    if not text:
        return text

    now = datetime.now()

    # Convert user-friendly format to Python strftime format
    def convert_format(user_format: str) -> str:
        # Replace common user-friendly patterns with Python strftime codes
        # Use a more robust approach to avoid double replacements
        replacements = [
            ("yyyy", "%Y"),  # 4-digit year
            ("yy", "%y"),  # 2-digit year
            ("MM", "%m"),  # 2-digit month
            ("dd", "%d"),  # 2-digit day
            ("HH", "%H"),  # 24-hour format
            ("hh", "%I"),  # 12-hour format
            ("mm", "%M"),  # minutes
            ("ss", "%S"),  # seconds
        ]

        python_format = user_format
        for user_code, python_code in replacements:
            python_format = python_format.replace(user_code, python_code)

        # Handle single character patterns after double character patterns
        python_format = re.sub(
            r"(?<!%)(?<![a-zA-Z])M(?!%)(?![a-zA-Z])", "%m", python_format
        )
        python_format = re.sub(
            r"(?<!%)(?<![a-zA-Z])d(?!%)(?![a-zA-Z])", "%d", python_format
        )

        return python_format

    # Find all date format patterns like {yyyyMMdd}, {yyyy-MM-dd}, etc.
    def replace_date_format(match: re.Match[str]) -> str:
        user_format = match.group(1)  # Extract the format string inside braces
        try:
            python_format = convert_format(user_format)
            return now.strftime(python_format)
        except ValueError:
            # If the format is invalid, return the original placeholder
            return match.group(0)

    # Replace patterns like {yyyyMMdd}, {yyyy-MM-dd}, etc.
    text = re.sub(r"\{([^}]+)\}", replace_date_format, text)

    return text


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

INTERNAL_EMAIL_DOMAIN = "aven.com"


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

    @staticmethod
    def _get_smtp_domain() -> str:
        return parseaddr(app.config["SMTP_MAIL_FROM"])[1].split("@")[1]

    def _error_template(self, text: str) -> str:
        call_to_action = self._get_call_to_action()
        return __(
            """
            <p>Your report/alert was unable to be generated because of the following error: %(text)s</p>
            <p>Please check your dashboard/chart for errors.</p>
            <p><b><a href="%(url)s">%(call_to_action)s</a></b></p>
            """,
            text=text,
            url=self._content.url,
            call_to_action=call_to_action,
        )

    def _get_content(self) -> EmailContent:
        if self._content.text:
            return EmailContent(body=self._error_template(self._content.text))
        # Get the domain from the 'From' address ..
        # and make a message id without the < > in the end

        domain = self._get_smtp_domain()
        images = {}

        if self._content.screenshots:
            images = {
                make_msgid(domain)[1:-1]: screenshot
                for screenshot in self._content.screenshots
            }

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

        img_tags = []
        for msgid in images.keys():
            img_tags.append(
                f"""<div class="image">
                    <img width="1000" src="cid:{msgid}">
                </div>
                """
            )
        img_tag = "".join(img_tags)
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
                  .image{{
                      margin-bottom: 18px;
                      min-width: 1000px;
                  }}
                </style>
              </head>
              <body>
                <div>{description}</div>
                <br>
                <b><a href="{self._content.url}">{call_to_action}</a></b><p></p>
                {html_table}
                {img_tag}
              </body>
            </html>
            """
        )
        csv_data = None
        if self._content.csv:
            # Use custom CSV filename if provided, otherwise use the default name
            csv_name = self._content.csv_filename or __(
                "%(name)s.csv", name=self._content.name
            )
            # Replace date placeholders in CSV filename
            csv_name = replace_date_placeholders(csv_name)
            csv_data = {csv_name: self._content.csv}

        pdf_data = None
        if self._content.pdf:
            pdf_data = {__("%(name)s.pdf", name=self._content.name): self._content.pdf}

        return EmailContent(
            body=body,
            images=images,
            pdf=pdf_data,
            data=csv_data,
            header_data=self._content.header_data,
        )

    def _get_subject(self) -> str:
        if self._content.email_subject:
            # Use custom email subject with date placeholder replacement
            subject = replace_date_placeholders(self._content.email_subject)
            return __(
                "%(prefix)s %(title)s",
                prefix=app.config["EMAIL_REPORTS_SUBJECT_PREFIX"],
                title=subject,
            )
        return __(
            "%(prefix)s %(title)s",
            prefix=app.config["EMAIL_REPORTS_SUBJECT_PREFIX"],
            title=self._content.name,
        )

    def _get_call_to_action(self) -> str:
        email_address_list = get_email_address_list(self._get_to())
        for email_address in email_address_list:
            if INTERNAL_EMAIL_DOMAIN not in email_address:
                return ""
        return __(app.config["EMAIL_REPORTS_CTA"])

    def _get_to(self) -> str:
        return json.loads(self._recipient.recipient_config_json)["target"]

    def _get_cc(self) -> str:
        # To accomadate backward compatability
        return json.loads(self._recipient.recipient_config_json).get("ccTarget", "")

    def _get_bcc(self) -> str:
        # To accomadate backward compatability
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
                app.config,
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
                "Report sent to email, notification content is %s", content.header_data
            )
        except SupersetErrorsException as ex:
            raise NotificationError(
                ";".join([error.message for error in ex.errors])
            ) from ex
        except Exception as ex:
            raise NotificationError(str(ex)) from ex
