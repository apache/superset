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
import os
import re
import smtplib
import ssl
from email.mime.application import MIMEApplication
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate
from typing import Any, Optional

from flask import g

from superset import db
from superset.reports.models import ReportSchedule, ReportSourceFormat
from superset.reports.types import HeaderDataType

logger = logging.getLogger(__name__)


def get_email_address_list(address_string: str) -> list[str]:
    address_string_list: list[str] = []
    if isinstance(address_string, str):
        address_string_list = re.split(r",|\s|;", address_string)
    return [x.strip() for x in address_string_list if x.strip()]


def _get_log_data() -> HeaderDataType:
    global_context = getattr(g, "context", {}) or {}
    chart_id = global_context.get("chart_id")
    dashboard_id = global_context.get("dashboard_id")
    report_schedule_id = global_context.get("report_schedule_id")
    report_source: str = ""
    report_format: str = ""
    report_type: str = ""
    owners: list[int] = []

    # intentionally creating a new session to
    # keep the logging session separate from the
    # main session
    session = db.create_scoped_session()
    report_schedule = (
        session.query(ReportSchedule).filter_by(id=report_schedule_id).one_or_none()
    )
    session.close()

    if report_schedule is not None:
        report_type = report_schedule.type
        report_format = report_schedule.report_format
        owners = report_schedule.owners
        report_source = (
            ReportSourceFormat.DASHBOARD
            if report_schedule.dashboard_id
            else ReportSourceFormat.CHART
        )

    log_data: HeaderDataType = {
        "notification_type": report_type,
        "notification_source": report_source,
        "notification_format": report_format,
        "chart_id": chart_id,
        "dashboard_id": dashboard_id,
        "owners": owners,
    }
    return log_data


def send_email_smtp(
    to: str,
    subject: str,
    html_content: str,
    config: dict[str, Any],
    files: Optional[list[str]] = None,
    data: Optional[dict[str, str]] = None,
    images: Optional[dict[str, bytes]] = None,
    dryrun: bool = False,
    cc: Optional[str] = None,
    bcc: Optional[str] = None,
    mime_subtype: str = "mixed",
) -> None:
    """
    Send an email with html content, eg:
    send_email_smtp(
        'test@example.com', 'foo', '<b>Foo</b> bar',['/dev/null'], dryrun=True)
    """
    smtp_mail_from = config["SMTP_MAIL_FROM"]
    smtp_mail_to = get_email_address_list(to)

    msg = MIMEMultipart(mime_subtype)
    msg["Subject"] = subject
    msg["From"] = smtp_mail_from
    msg["To"] = ", ".join(smtp_mail_to)

    msg.preamble = "This is a multi-part message in MIME format."

    recipients = smtp_mail_to
    if cc:
        smtp_mail_cc = get_email_address_list(cc)
        msg["CC"] = ", ".join(smtp_mail_cc)
        recipients = recipients + smtp_mail_cc

    if bcc:
        # don't add bcc in header
        smtp_mail_bcc = get_email_address_list(bcc)
        recipients = recipients + smtp_mail_bcc

    msg["Date"] = formatdate(localtime=True)
    mime_text = MIMEText(html_content, "html")
    msg.attach(mime_text)

    # Attach files by reading them from disk
    for fname in files or []:
        basename = os.path.basename(fname)
        with open(fname, "rb") as f:
            msg.attach(
                MIMEApplication(
                    f.read(),
                    Content_Disposition=f"attachment; filename='{basename}'",
                    Name=basename,
                )
            )

    # Attach any files passed directly
    for name, body in (data or {}).items():
        msg.attach(
            MIMEApplication(
                body, Content_Disposition=f"attachment; filename='{name}'", Name=name
            )
        )

    # Attach any inline images, which may be required for display in
    # HTML content (inline)
    for msgid, imgdata in (images or {}).items():
        formatted_time = formatdate(localtime=True)
        file_name = f"{subject} {formatted_time}"
        image = MIMEImage(imgdata, name=file_name)
        image.add_header("Content-ID", f"<{msgid}>")
        image.add_header("Content-Disposition", "inline")
        msg.attach(image)
    msg_mutator = config["EMAIL_HEADER_MUTATOR"]
    # the base notification returns the message without any editing.
    header_data = _get_log_data()
    new_msg = msg_mutator(msg, **(header_data or {}))
    send_mime_email(smtp_mail_from, recipients, new_msg, config, dryrun=dryrun)


def send_mime_email(
    e_from: str,
    e_to: list[str],
    mime_msg: MIMEMultipart,
    config: dict[str, Any],
    dryrun: bool = False,
) -> None:
    smtp_host = config["SMTP_HOST"]
    smtp_port = config["SMTP_PORT"]
    smtp_user = config["SMTP_USER"]
    smtp_password = config["SMTP_PASSWORD"]
    smtp_starttls = config["SMTP_STARTTLS"]
    smtp_ssl = config["SMTP_SSL"]
    smtp_ssl_server_auth = config["SMTP_SSL_SERVER_AUTH"]

    if dryrun:
        logger.info("Dryrun enabled, email notification content is below:")
        logger.info(mime_msg.as_string())
        return

    # Default ssl context is SERVER_AUTH using the default system
    # root CA certificates
    ssl_context = ssl.create_default_context() if smtp_ssl_server_auth else None
    smtp = (
        smtplib.SMTP_SSL(smtp_host, smtp_port, context=ssl_context)
        if smtp_ssl
        else smtplib.SMTP(smtp_host, smtp_port)
    )
    if smtp_starttls:
        smtp.starttls(context=ssl_context)
    if smtp_user and smtp_password:
        smtp.login(smtp_user, smtp_password)
    logger.debug("Sent an email to %s", str(e_to))
    smtp.sendmail(e_from, e_to, mime_msg.as_string())
    smtp.quit()
