#!/usr/bin/python3
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
import os
import smtplib
import ssl
from string import Template

SMTP_PORT = 587
SMTP_SERVER = "mail-relay.apache.org"


def send_email(
    smtp_server: str,
    smpt_port: int,
    username: str,
    password: str,
    sender_email: str,
    receiver_email: str,
    message: str
):
    context = ssl.create_default_context()
    with smtplib.SMTP(smtp_server, smpt_port) as server:
        server.starttls(context=context)
        server.login(username, password)
        server.sendmail(sender_email, receiver_email, message)


def required_input(message: str) -> str:
    answer = input(message)
    while not answer:
        print("This field is required")
        answer = input(message)
    return answer


def render_template(template: str, **kwargs) -> str:
    with open('email_templates/vote_pmc.tmpl') as file:
        template_source = file.read()

        template = Template(template_source)
        message = template.substitute(kwargs)
    return message


version_rc = os.environ.get("SUPERSET_VERSION_RC")
if not version_rc:
    exit("Expected SUPERSET_VERSION_RC environment variable to be set")
version = os.environ.get("SUPERSET_VERSION")
if not version:
    exit("Expected SUPERSET_VERSION environment variable to be set")


receiver_email = "danielvazgaspar@gmail.com"  # Enter receiver address
sender_email = required_input("Sender email (ex: user@apache.org): ")
username = required_input("Apache username: ")
password = required_input("Apache password: ")

message = render_template(
    "email_templates/vote_pmc.tmpl",
    receiver_email=receiver_email,
    sender_email=sender_email,
    project_name="Superset",
    project_module="superset",
    version=version,
    version_rc=version_rc
)

print("--------------------------")
print("SMTP Message")
print("--------------------------")
print(message)
print("--------------------------")
confirm = input("Is the Email message ok? (yes/no): ")
if confirm not in ("Yes", "yes", "y"):
    exit(1)

send_email(SMTP_SERVER, SMTP_PORT, username, password, sender_email, receiver_email, message)
