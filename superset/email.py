from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from builtins import str
from past.builtins import basestring

import logging
import os
import smtplib

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.utils import formatdate

from flask import render_template
from flask_babel import gettext as __

from superset import app


def notify_user_about_perm_udate(granter, user, role, datasource, tpl_name):
    msg = render_template(tpl_name, granter=granter, user=user, role=role,
                          datasource=datasource)
    logging.info(msg)
    subject = __('[Superset] Access to the datasource %(name)s was granted',
                 name=datasource.full_name)

    dryrun = app.debug or not app.config.get('EMAIL_NOTIFICATIONS')
    send_email_smtp(user.email, subject, msg, bcc=granter.email, dryrun=dryrun)


def send_email_smtp(to, subject, html_content, files=None, dryrun=False,
                    cc=None, bcc=None, mime_subtype='mixed'):
    """
    Send an email with html content

    >>> send_email_smtp('test@example.com', 'foo', '<b>Foo</b> bar',
    >>>                 ['/dev/null'], dryrun=True)
    """
    SMTP_MAIL_FROM = app.config.get('SMTP_MAIL_FROM')

    to = get_email_address_list(to)

    msg = MIMEMultipart(mime_subtype)
    msg['Subject'] = subject
    msg['From'] = SMTP_MAIL_FROM
    msg['To'] = ", ".join(to)
    recipients = to
    if cc:
        cc = get_email_address_list(cc)
        msg['CC'] = ", ".join(cc)
        recipients = recipients + cc

    if bcc:
        # don't add bcc in header
        bcc = get_email_address_list(bcc)
        recipients = recipients + bcc

    msg['Date'] = formatdate(localtime=True)
    mime_text = MIMEText(html_content, 'html')
    msg.attach(mime_text)

    for fname in files or []:
        basename = os.path.basename(fname)
        with open(fname, "rb") as f:
            msg.attach(MIMEApplication(
                f.read(),
                Content_Disposition='attachment; filename="%s"' % basename,
                Name=basename
            ))

    send_MIME_email(SMTP_MAIL_FROM, recipients, msg, dryrun)


def send_MIME_email(e_from, e_to, mime_msg, dryrun=False):
    SMTP_HOST = app.config.get('SMTP_HOST')
    SMTP_PORT = app.config.get('SMTP_PORT')
    SMTP_USER = app.config.get('SMTP_USER')
    SMTP_PASSWORD = app.config.get('SMTP_PASSWORD')
    SMTP_STARTTLS = app.config.get('SMTP_STARTTLS')
    SMTP_SSL = app.config.get('SMTP_SSL')

    if not dryrun:
        s = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) if SMTP_SSL else \
            smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        if SMTP_STARTTLS:
            s.starttls()
        if SMTP_USER and SMTP_PASSWORD:
            s.login(SMTP_USER, SMTP_PASSWORD)
        logging.info("Sent an alert email to " + str(e_to))
        s.sendmail(e_from, e_to, mime_msg.as_string())
        s.quit()
    else:
        logging.info('Dryrun enabled, email notification content is below:')
        logging.info(mime_msg.as_string())


def get_email_address_list(address_string):
    if isinstance(address_string, basestring):
        if ',' in address_string:
            address_string = address_string.split(',')
        elif ';' in address_string:
            address_string = address_string.split(';')
        else:
            address_string = [address_string]
    return address_string
