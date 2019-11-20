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
import argparse
from typing import Dict, List
import os
import smtplib
import ssl
from string import Template

SMTP_PORT = 587
SMTP_SERVER = "mail-relay.apache.org"
PROJECT_NAME = "Superset"
PROJECT_MODULE = "superset"
PROJECT_DESCRIPTION = "Apache Superset (incubating) is a modern, enterprise-ready business intelligence web application"

voting_steps_info: Dict = {
    "vote_pmc": {
        "receiver_email": "danielvazgaspar@gmail.com",
        "template": "email_templates/vote_pmc.tmpl",
        "extra_input": {},
    },
    "vote_ipmc": {
        "receiver_email": "danielvazgaspar@gmail.com",
        "template": "email_templates/vote_ipmc.tmpl",
        "extra_input": [
            {"name": "voting_thread", "message": "The URL for the PMC voting thread: "},
            {
                "name": "mentors_voted",
                "message": "A list of mentors that have already voted: ",
            },
        ],
    },
    "result_ipmc": {
        "receiver_email": "danielvazgaspar@gmail.com",
        "template": "email_templates/result_ipmc.tmpl",
        "extra_input": {},
    },
    "announce": {
        "receiver_email": "danielvazgaspar@gmail.com",
        "template": "email_templates/announce.tmpl",
        "extra_input": {},
    },
}


def send_email(
    smtp_server: str,
    smpt_port: int,
    username: str,
    password: str,
    sender_email: str,
    receiver_email: str,
    message: str,
):
    """
    Send a simple text email (SMTP)
    """
    context = ssl.create_default_context()
    with smtplib.SMTP(smtp_server, smpt_port) as server:
        server.starttls(context=context)
        server.login(username, password)
        server.sendmail(sender_email, receiver_email, message)


def input_required(message: str) -> str:
    """
    Asks for required user input infinite times

    :param message: The message to display when asking for user input
    :return: User input
    """
    answer = input(message)
    while not answer:
        print("This field is required")
        answer = input(message)
    return answer


def input_extra(parameters: List[Dict]) -> Dict:
    """
    Asks for dynamic extra user input

    :param message: List of dicts, ex: [{"name": "input1", "message": "Write value for input1"}, ...]
    :return: Dict, ex: {"input1": "some user input"}
    """
    answers = dict()
    for parameter in parameters:
        answers[parameter["name"]] = input_required(parameter["message"])
    return answers


def render_template(template_file: str, **kwargs) -> str:
    """
    Simple render template based on named parameters

    :param template_file: The template file location
    :kwargs: Named parameters to use when rendering the template
    :return: Rendered template
    """
    with open(template_file) as file:
        template_source = file.read()
    template = Template(template_source)
    message = template.substitute(kwargs)
    return message


# Argument parsing
parser = argparse.ArgumentParser(description="Apache voting mailer script")
parser.add_argument(
    "-t",
    "--email_type",
    help="The type of email to send choose from: vote_pmc, result_pmc, vote_ipmc, result_ipmc",
)
args = parser.parse_args()
email_type: str = str(args.email_type)
if email_type not in voting_steps_info:
    exit("Expected required '--email_type' parameter")

template = voting_steps_info[email_type]["template"]

# Check for required environment variables
version_rc = os.environ.get("SUPERSET_VERSION_RC")
if not version_rc:
    exit("Expected SUPERSET_VERSION_RC environment variable to be set")
version = os.environ.get("SUPERSET_VERSION")
if not version:
    exit("Expected SUPERSET_VERSION environment variable to be set")

# Collect all necessary template arguments
template_arguments = dict()
template_arguments["receiver_email"] = voting_steps_info[email_type][
    "receiver_email"
]
template_arguments["project_name"] = PROJECT_NAME
template_arguments["project_module"] = PROJECT_MODULE
template_arguments["project_description"] = PROJECT_DESCRIPTION
template_arguments["version"] = version
template_arguments["version_rc"] = version_rc
# Ask for required user input
template_arguments["sender_email"] = input_required(
    "Sender email (ex: user@apache.org): "
)
username = input_required("Apache username: ")
password = input_required("Apache password: ")
template_arguments.update(
    input_extra(voting_steps_info[email_type]["extra_input"])
)


message = render_template(template, **template_arguments)

print("--------------------------")
print("SMTP Message")
print("--------------------------")
print(message)
print("--------------------------")
confirm = input("Is the Email message ok? (yes/no): ")
if confirm not in ("Yes", "yes", "y"):
    exit("Exit by user request")

try:
    send_email(
        SMTP_SERVER,
        SMTP_PORT,
        username,
        password,
        template_arguments["sender_email"],
        template_arguments["receiver_email"],
        message,
    )
    print("Email sent successfully")
except smtplib.SMTPAuthenticationError:
    exit("SMTP User authentication error, Email not sent!")
except Exception as e:
    exit(f"SMTP exception {e}")
