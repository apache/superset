'''
This module will handle generating an email, including+ the recipients,
the sender, the subject, the message and any attachments.

It can be used throughout the project
'''

import sys
import smtplib

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication


class Email:

    def __init__(self, recipients, sender, subj=None, body=None, attachments=None, ):
        self.recipients = ', '.join(recipients)
        self.sender = sender
        self.subj = subj
        self.body = body
        self.attachments = attachments
        self.compose_email()

    def compose_email(self):
        self.email = MIMEMultipart()
        self.email['To'] = self.recipients
        self.email['From'] = self.sender
        self.email['Subject'] = self.subj
        body = MIMEText(self.body)
        self.attach_file(body)
        for attachment in self.attachments:
            self.attach_file(attachment)

    def attach_file(self, attachment):
        try:
            file = open(attachment, 'rb')
            extension = attachment.split('.')[1]
            document = MIMEApplication(file.read(), _subtype=extension)
            file.close()
            document.add_header('Content-Disposition', 'attachement', filename=attachment)
            self.email.attach(document)
            return
        except:
            try:
                self.email.attach(attachment)
            except Exception as e:
                print('Error attaching to email: ' + str(e))
        return

    def send_email(self):
        try:
            s = smtplib.SMTP('localhost')
            s.sendmail(self.sender, self.recipients, self.email.as_string())
            s.quit()
        except Exception as e:
            print('Error sending email: ' + str(e))
            sys.exit(e)
        return
