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
from weasyprint import HTML, CSS
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
            <p><b><a href="%(url)s">%(call_to_action)s</a></b></p>
            """,  # noqa: E501
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

        pdf_data = None
        html_table = ""

        # Check if the report format is PDF and embedded data is available
        # Assuming self._content.report_format exists and holds the report format string
        if hasattr(self._content, 'report_format') and \
           self._content.report_format == "PDF" and \
           self._content.embedded_data is not None:
            df = self._content.embedded_data
            report_name_val = self._name # Renamed to avoid clash with CSS variable name
            generation_date_val = self.now.strftime('%Y-%m-%d %H:%M:%S UTC')

            # Retrieve PDF export configurations
            pdf_headers_footers_enabled = app.config.get("PDF_EXPORT_HEADERS_FOOTERS_ENABLED", True)
            pdf_header_template = app.config.get("PDF_EXPORT_HEADER_TEMPLATE", "Report: {report_name} - Page {page_number} of {total_pages}")
            pdf_footer_template = app.config.get("PDF_EXPORT_FOOTER_TEMPLATE", "Generated: {generation_date}")
            pdf_page_size = app.config.get("PDF_EXPORT_PAGE_SIZE", "A4")
            pdf_orientation = app.config.get("PDF_EXPORT_ORIENTATION", "portrait")

            # Prepare header and footer content based on templates and config
            header_content_str = ""
            footer_content_str = ""

            if pdf_headers_footers_enabled:
                # Sanitize report_name_val for CSS content (simple escaping for quotes)
                css_report_name = report_name_val.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\A")
                css_generation_date = generation_date_val.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\A")

                # For header: replace {report_name}, keep {page_number} and {total_pages} for CSS counters
                header_content_str = pdf_header_template.replace("{report_name}", css_report_name)
                header_content_str = header_content_str.replace("{page_number}", "counter(page)")
                header_content_str = header_content_str.replace("{total_pages}", "counter(pages)")

                # For footer: replace {generation_date} and {report_name}
                footer_content_str = pdf_footer_template.replace("{generation_date}", css_generation_date)
                footer_content_str = footer_content_str.replace("{report_name}", css_report_name)


            pdf_html_content = f"""
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    :root {{
                        /* Keeping these for potential use in body styles if needed */
                        --report-name-var: "{report_name_val.replace('"', '&quot;').replace("'", "&apos;")}";
                        --generation-date-var: "{generation_date_val}";
                    }}
                </style>
            </head>
            <body>
                <div class="report-description">{description}</div>
                <br>
                {df.to_html(na_rep="", index=True, escape=True)}
            </body>
            </html>
            """

            # Construct @page CSS string
            page_css_parts = [f"@page {{ size: {pdf_page_size} {pdf_orientation}; margin: 2.5cm 1.5cm 2cm 1.5cm; }}"]
            if pdf_headers_footers_enabled:
                # Assuming header template is for @top-center and footer for @bottom-center
                # A more complex mapping from template to specific corners would require more logic
                page_css_parts.append(f"@page @top-center {{ content: \"{header_content_str}\"; font-size: 9pt; color: #333; }}")
                page_css_parts.append(f"@page @bottom-center {{ content: \"{footer_content_str}\"; font-size: 9pt; color: #333; }}")
            else:
                # Ensure no headers/footers if disabled
                page_css_parts.append("@page @top-left { content: \"\"; }")
                page_css_parts.append("@page @top-center { content: \"\"; }")
                page_css_parts.append("@page @top-right { content: \"\"; }")
                page_css_parts.append("@page @bottom-left { content: \"\"; }")
                page_css_parts.append("@page @bottom-center { content: \"\"; }")
                page_css_parts.append("@page @bottom-right { content: \"\"; }")


            pdf_css_string = f'''
                {" ".join(page_css_parts)}

                body {{ font-family: sans-serif; }}
                table {{
                    border-collapse: collapse;
                    width: 100%;
                    page-break-inside: auto;
                }}
                tr {{
                    page-break-inside: avoid;
                    page-break-after: auto;
                }}
                th, td {{
                    border: 1px solid black;
                    padding: 4px;
                    text-align: left;
                    font-size: 8pt;
                }}
                th {{ background-color: #f0f0f0; }}
                .report-description {{ margin-bottom: 1em; font-size: 10pt; }}
            '''
            pdf_css = CSS(string=pdf_css_string)
            pdf_bytes = HTML(string=pdf_html_content).write_pdf(stylesheets=[pdf_css])
            pdf_data = {__("%(name)s.pdf", name=report_name_val): pdf_bytes}
            # Set html_table to empty as the table is in the PDF
            html_table = ""
        else:
            # Existing logic for HTML email
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
            # Fallback for existing PDF data if not generated by WeasyPrint
            if self._content.pdf:
                pdf_data = {__("%(name)s.pdf", name=self._name): self._content.pdf}


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
            csv_data = {__("%(name)s.csv", name=self._name): self._content.csv}

        # pdf_data is already defined above
        # if self._content.pdf and not pdf_data: # if pdf_data was not set by WeasyPrint
        #     pdf_data = {__("%(name)s.pdf", name=self._name): self._content.pdf}

        return EmailContent(
            body=body,
            images=images,
            pdf=pdf_data, # Use the pdf_data populated by WeasyPrint or existing logic
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
