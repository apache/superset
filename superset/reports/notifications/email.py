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
from flask_babel import gettext as __
from pytz import timezone

from superset import app, is_feature_enabled
from superset.exceptions import SupersetErrorsException
from superset.reports.models import ReportRecipientType
from superset.reports.notifications.base import BaseNotification
from superset.reports.notifications.exceptions import NotificationError
from superset.utils import json
from superset.utils.core import HeaderDataType, send_email_smtp
from superset.utils.decorators import statsd_gauge

currentYear = datetime.now().year
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
        return parseaddr(app.config["SMTP_MAIL_FROM"])[1].split("@")[1]

    def _error_template(self, text: str) -> str:
        call_to_action = self._get_call_to_action()
        return __(
            """
            <p>Your report/alert was unable to be generated because of the following error: %(text)s</p>
            <p>Please check your dashboard/chart for errors.</p>
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
                <meta http-equiv="content-type" content="text/html; charset=windows-1252" />
                <meta charset="UTF-8" />
            
                <meta http-equiv="X-UA-Compatible" content="IE=edge" />
            
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link rel="preconnect" target="_blank" href="https://fonts.gstatic.com" />
                <link
                  target="_blank"
                  href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Freehand&family=Montserrat:wght@300;400;500;600;700&display=swap"
                  rel="stylesheet"
                />
                <style>
                  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&display=swap");
                </style>
              </head>
            
              <body style="background-color: #ececec; padding: 30px 0; margin: 0">
                <table
                  style="background-color: #ffffff; padding: 0 0px"
                  cellspacing="0"
                  cellpadding="10"
                  border="0"
                  align="center"
                >
                  <tbody>
                    <tr>
                      <td style="padding: 0px 30px 50 30px">
                        <table
                          style="
                            font-family: Inter, 'Helvetica Neue Light', 'Helvetica Regular',
                              Arial, sans-serif;
                            font-size: 16px;
                            line-height: 26px;
                          "
                          cellspacing="0"
                          cellpadding="10"
                          border="0"
                          align="center"
                        >
                          <tbody>
                            <tr>
                              <td style="padding: 40px 50px" align="center">
                                <img
                                  src="https://www.remita.net/assets/minimal/images/remita_orange_new_logo.svg"
                                  width="100px;"
                                />
                              </td>
                            </tr>
                            <tr>
                              <td
                                style="
                                  background: #fff;
                                  border-top-left-radius: 16px;
                                  border-top-right-radius: 16px;
                                  line-height: 23px !important;
                                "
                              >
                                <div>Hello ,</div>
                                <br />
                <div>{description}</div>
                                <br />
                                <p></p>
                                {html_table} {img_tag}
                              </td>
                            </tr>
                            <tr>
                              <td
                                style="
                                  padding: 10px 20px;
                                  background: #f7f9fc;
                                  text-align: center;
                                  font-size: 14px;
                                "
                              >
                                <p style="margin-bottom: 30px">
                                  You received this email because you signed up to Remita.Please do not reply this email as it is automatically generated and unmanned.
                                </p>
                                <p>&copy; {currentYear} Remita Payment Services Limited</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </body>
            </html>
            """
        )
        csv_data = None
        if self._content.csv:
            csv_data = {__("%(name)s.csv", name=self._name): self._content.csv}

        pdf_data = None
        if self._content.pdf:
            pdf_data = {__("%(name)s.pdf", name=self._name): self._content.pdf}

        return EmailContent(
            body=body,
            images=images,
            pdf=pdf_data,
            data=csv_data,
            header_data=self._content.header_data,
        )

    def _get_subject(self) -> str:
        return __(
            "%(prefix)s %(title)s",
            prefix=app.config["EMAIL_REPORTS_SUBJECT_PREFIX"],
            title=self._name,
        )

    def _parse_name(self, name: str) -> str:
        """If user add a date format to the subject, parse it to the real date
        This feature is hidden behind a feature flag `DATE_FORMAT_IN_EMAIL_SUBJECT`
        by default it is disabled
        """
        return self.now.strftime(name)

    def _get_call_to_action(self) -> str:
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
