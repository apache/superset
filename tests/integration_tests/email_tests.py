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
"""Unit tests for email service in Superset"""

import logging
import ssl
import tempfile
import unittest
from email.mime.application import MIMEApplication
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from unittest import mock

from superset import app
from superset.utils import core as utils
from tests.integration_tests.base_tests import SupersetTestCase

from .utils import read_fixture

send_email_test = mock.Mock()
logger = logging.getLogger(__name__)


class TestEmailSmtp(SupersetTestCase):
    def setUp(self):
        app.config["SMTP_SSL"] = False

    @mock.patch("superset.utils.core.send_mime_email")
    def test_send_smtp(self, mock_send_mime):
        attachment = tempfile.NamedTemporaryFile()
        attachment.write(b"attachment")
        attachment.seek(0)
        utils.send_email_smtp(
            "to", "subject", "content", app.config, files=[attachment.name]
        )
        assert mock_send_mime.called
        call_args = mock_send_mime.call_args[0]
        logger.debug(call_args)
        assert call_args[0] == app.config["SMTP_MAIL_FROM"]
        assert call_args[1] == ["to"]
        msg = call_args[2]
        assert msg["Subject"] == "subject"
        assert msg["From"] == app.config["SMTP_MAIL_FROM"]
        assert len(msg.get_payload()) == 2
        mimeapp = MIMEApplication("attachment")
        assert msg.get_payload()[-1].get_payload() == mimeapp.get_payload()

    @mock.patch("superset.utils.core.send_mime_email")
    def test_send_smtp_with_email_mutator(self, mock_send_mime):
        attachment = tempfile.NamedTemporaryFile()
        attachment.write(b"attachment")
        attachment.seek(0)

        # putting this into a variable so that we can reset after the test
        base_email_mutator = app.config["EMAIL_HEADER_MUTATOR"]

        def mutator(msg, **kwargs):
            msg["foo"] = "bar"
            return msg

        app.config["EMAIL_HEADER_MUTATOR"] = mutator
        utils.send_email_smtp(
            "to", "subject", "content", app.config, files=[attachment.name]
        )
        assert mock_send_mime.called
        call_args = mock_send_mime.call_args[0]
        logger.debug(call_args)
        assert call_args[0] == app.config["SMTP_MAIL_FROM"]
        assert call_args[1] == ["to"]
        msg = call_args[2]
        assert msg["Subject"] == "subject"
        assert msg["From"] == app.config["SMTP_MAIL_FROM"]
        assert msg["foo"] == "bar"
        assert len(msg.get_payload()) == 2
        mimeapp = MIMEApplication("attachment")
        assert msg.get_payload()[-1].get_payload() == mimeapp.get_payload()
        app.config["EMAIL_HEADER_MUTATOR"] = base_email_mutator

    @mock.patch("superset.utils.core.send_mime_email")
    def test_send_smtp_with_email_mutator_changing_recipients(self, mock_send_mime):
        attachment = tempfile.NamedTemporaryFile()
        attachment.write(b"attachment")
        attachment.seek(0)

        # putting this into a variable so that we can reset after the test
        base_email_mutator = app.config["EMAIL_HEADER_MUTATOR"]

        def mutator(msg, **kwargs):
            msg.replace_header("To", "mutated")
            return msg

        app.config["EMAIL_HEADER_MUTATOR"] = mutator
        utils.send_email_smtp(
            "to", "subject", "content", app.config, files=[attachment.name]
        )
        assert mock_send_mime.called
        call_args = mock_send_mime.call_args[0]
        logger.debug(call_args)
        assert call_args[0] == app.config["SMTP_MAIL_FROM"]
        assert call_args[1] == ["mutated"]
        msg = call_args[2]
        assert msg["Subject"] == "subject"
        assert msg["From"] == app.config["SMTP_MAIL_FROM"]
        assert len(msg.get_payload()) == 2
        mimeapp = MIMEApplication("attachment")
        assert msg.get_payload()[-1].get_payload() == mimeapp.get_payload()
        app.config["EMAIL_HEADER_MUTATOR"] = base_email_mutator

    @mock.patch("superset.utils.core.send_mime_email")
    def test_send_smtp_data(self, mock_send_mime):
        utils.send_email_smtp(
            "to", "subject", "content", app.config, data={"1.txt": b"data"}
        )
        assert mock_send_mime.called
        call_args = mock_send_mime.call_args[0]
        logger.debug(call_args)
        assert call_args[0] == app.config["SMTP_MAIL_FROM"]
        assert call_args[1] == ["to"]
        msg = call_args[2]
        assert msg["Subject"] == "subject"
        assert msg["From"] == app.config["SMTP_MAIL_FROM"]
        assert len(msg.get_payload()) == 2
        mimeapp = MIMEApplication("data")
        assert msg.get_payload()[-1].get_payload() == mimeapp.get_payload()

    @mock.patch("superset.utils.core.send_mime_email")
    def test_send_smtp_inline_images(self, mock_send_mime):
        image = read_fixture("sample.png")
        utils.send_email_smtp(
            "to", "subject", "content", app.config, images=dict(blah=image)
        )
        assert mock_send_mime.called
        call_args = mock_send_mime.call_args[0]
        logger.debug(call_args)
        assert call_args[0] == app.config["SMTP_MAIL_FROM"]
        assert call_args[1] == ["to"]
        msg = call_args[2]
        assert msg["Subject"] == "subject"
        assert msg["From"] == app.config["SMTP_MAIL_FROM"]
        assert len(msg.get_payload()) == 2
        mimeapp = MIMEImage(image)
        assert msg.get_payload()[-1].get_payload() == mimeapp.get_payload()

    @mock.patch("superset.utils.core.send_mime_email")
    def test_send_bcc_smtp(self, mock_send_mime):
        attachment = tempfile.NamedTemporaryFile()
        attachment.write(b"attachment")
        attachment.seek(0)
        utils.send_email_smtp(
            "to",
            "subject",
            "content",
            app.config,
            files=[attachment.name],
            cc="cc",
            bcc="bcc",
        )
        assert mock_send_mime.called
        call_args = mock_send_mime.call_args[0]
        assert call_args[0] == app.config["SMTP_MAIL_FROM"]
        assert call_args[1] == ["to", "cc", "bcc"]
        msg = call_args[2]
        assert msg["Subject"] == "subject"
        assert msg["From"] == app.config["SMTP_MAIL_FROM"]
        assert len(msg.get_payload()) == 2
        mimeapp = MIMEApplication("attachment")
        assert msg.get_payload()[-1].get_payload() == mimeapp.get_payload()

    @mock.patch("smtplib.SMTP_SSL")
    @mock.patch("smtplib.SMTP")
    def test_send_mime(self, mock_smtp, mock_smtp_ssl):
        mock_smtp.return_value = mock.Mock()
        mock_smtp_ssl.return_value = mock.Mock()
        msg = MIMEMultipart()
        utils.send_mime_email("from", "to", msg, app.config, dryrun=False)
        mock_smtp.assert_called_with(app.config["SMTP_HOST"], app.config["SMTP_PORT"])
        assert mock_smtp.return_value.starttls.called
        mock_smtp.return_value.login.assert_called_with(
            app.config["SMTP_USER"], app.config["SMTP_PASSWORD"]
        )
        mock_smtp.return_value.sendmail.assert_called_with(
            "from", "to", msg.as_string()
        )
        assert mock_smtp.return_value.quit.called

    @mock.patch("smtplib.SMTP_SSL")
    @mock.patch("smtplib.SMTP")
    def test_send_mime_ssl(self, mock_smtp, mock_smtp_ssl):
        app.config["SMTP_SSL"] = True
        mock_smtp.return_value = mock.Mock()
        mock_smtp_ssl.return_value = mock.Mock()
        utils.send_mime_email("from", "to", MIMEMultipart(), app.config, dryrun=False)
        assert not mock_smtp.called
        mock_smtp_ssl.assert_called_with(
            app.config["SMTP_HOST"], app.config["SMTP_PORT"], context=None
        )

    @mock.patch("smtplib.SMTP_SSL")
    @mock.patch("smtplib.SMTP")
    def test_send_mime_ssl_server_auth(self, mock_smtp, mock_smtp_ssl):
        app.config["SMTP_SSL"] = True
        app.config["SMTP_SSL_SERVER_AUTH"] = True
        mock_smtp.return_value = mock.Mock()
        mock_smtp_ssl.return_value = mock.Mock()
        utils.send_mime_email("from", "to", MIMEMultipart(), app.config, dryrun=False)
        assert not mock_smtp.called
        mock_smtp_ssl.assert_called_with(
            app.config["SMTP_HOST"], app.config["SMTP_PORT"], context=mock.ANY
        )
        called_context = mock_smtp_ssl.call_args.kwargs["context"]
        assert called_context.verify_mode == ssl.CERT_REQUIRED

    @mock.patch("smtplib.SMTP")
    def test_send_mime_tls_server_auth(self, mock_smtp):
        app.config["SMTP_STARTTLS"] = True
        app.config["SMTP_SSL_SERVER_AUTH"] = True
        mock_smtp.return_value = mock.Mock()
        mock_smtp.return_value.starttls.return_value = mock.Mock()
        utils.send_mime_email("from", "to", MIMEMultipart(), app.config, dryrun=False)
        mock_smtp.return_value.starttls.assert_called_with(context=mock.ANY)
        called_context = mock_smtp.return_value.starttls.call_args.kwargs["context"]
        assert called_context.verify_mode == ssl.CERT_REQUIRED

    @mock.patch("smtplib.SMTP_SSL")
    @mock.patch("smtplib.SMTP")
    def test_send_mime_noauth(self, mock_smtp, mock_smtp_ssl):
        smtp_user = app.config["SMTP_USER"]
        smtp_password = app.config["SMTP_PASSWORD"]
        app.config["SMTP_USER"] = None
        app.config["SMTP_PASSWORD"] = None
        mock_smtp.return_value = mock.Mock()
        mock_smtp_ssl.return_value = mock.Mock()
        utils.send_mime_email("from", "to", MIMEMultipart(), app.config, dryrun=False)
        assert not mock_smtp_ssl.called
        mock_smtp.assert_called_with(app.config["SMTP_HOST"], app.config["SMTP_PORT"])
        assert not mock_smtp.login.called
        app.config["SMTP_USER"] = smtp_user
        app.config["SMTP_PASSWORD"] = smtp_password

    @mock.patch("smtplib.SMTP_SSL")
    @mock.patch("smtplib.SMTP")
    def test_send_mime_dryrun(self, mock_smtp, mock_smtp_ssl):
        utils.send_mime_email("from", "to", MIMEMultipart(), app.config, dryrun=True)
        assert not mock_smtp.called
        assert not mock_smtp_ssl.called


if __name__ == "__main__":
    unittest.main()
