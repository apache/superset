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
from typing import Any

from click.core import Context

try:
    import jinja2
except ModuleNotFoundError:
    exit("Jinja2 is a required dependency for this script")
try:
    import click
except ModuleNotFoundError:
    exit("Click is a required dependency for this script")

RECEIVER_EMAIL = "dev@superset.apache.org"
PROJECT_NAME = "Superset"
PROJECT_MODULE = "superset"
PROJECT_DESCRIPTION = "Apache Superset is a modern, enterprise-ready business intelligence web application."


def string_comma_to_list(message: str) -> list[str]:
    if not message:
        return []
    return [element.strip() for element in message.split(",")]


def render_template(template_file: str, **kwargs: Any) -> str:
    """
    Simple render template based on named parameters

    :param template_file: The template file location
    :kwargs: Named parameters to use when rendering the template
    :return: Rendered template
    """
    template = jinja2.Template(open(template_file).read())
    return template.render(kwargs)


class BaseParameters:
    def __init__(
        self,
        version: str,
        version_rc: str,
    ) -> None:
        self.version = version
        self.version_rc = version_rc
        self.template_arguments: dict[str, Any] = {}

    def __repr__(self) -> str:
        return f"Apache Credentials: {self.version}/{self.version_rc}"


@click.group()
@click.pass_context
@click.option("--version", envvar="SUPERSET_VERSION")
@click.option("--version_rc", envvar="SUPERSET_VERSION_RC")
def cli(
    ctx: Context,
    version: str,
    version_rc: str,
) -> None:
    """Welcome to releasing send email CLI interface!"""
    base_parameters = BaseParameters(version, version_rc)
    base_parameters.template_arguments["receiver_email"] = RECEIVER_EMAIL
    base_parameters.template_arguments["project_name"] = PROJECT_NAME
    base_parameters.template_arguments["project_module"] = PROJECT_MODULE
    base_parameters.template_arguments["project_description"] = PROJECT_DESCRIPTION
    base_parameters.template_arguments["version"] = base_parameters.version
    base_parameters.template_arguments["version_rc"] = base_parameters.version_rc
    ctx.obj = base_parameters


@cli.command("vote_pmc")
@click.pass_obj
def vote_pmc(base_parameters: BaseParameters) -> None:
    template_file = "email_templates/vote_pmc.j2"
    message = render_template(template_file, **base_parameters.template_arguments)
    print(message)


@cli.command("result_pmc")
@click.option(
    "--vote_bindings",
    default="",
    type=str,
    prompt="A List of people with +1 binding vote (ex: Max,Grace,Krist)",
)
@click.option(
    "--vote_nonbindings",
    default="",
    type=str,
    prompt="A List of people with +1 non binding vote (ex: Ville)",
)
@click.option(
    "--vote_negatives",
    default="",
    type=str,
    prompt="A List of people with -1 vote (ex: John)",
)
@click.option(
    "--vote_thread",
    default="",
    type=str,
    prompt="Permalink to the vote thread "
    "(see https://lists.apache.org/list.html?dev@superset.apache.org)",
)
@click.pass_obj
def result_pmc(
    base_parameters: BaseParameters,
    vote_bindings: str,
    vote_nonbindings: str,
    vote_negatives: str,
    vote_thread: str,
) -> None:
    template_file = "email_templates/result_pmc.j2"
    base_parameters.template_arguments["vote_bindings"] = string_comma_to_list(
        vote_bindings
    )
    base_parameters.template_arguments["vote_nonbindings"] = string_comma_to_list(
        vote_nonbindings
    )
    base_parameters.template_arguments["vote_negatives"] = string_comma_to_list(
        vote_negatives
    )
    base_parameters.template_arguments["vote_thread"] = vote_thread
    message = render_template(template_file, **base_parameters.template_arguments)
    print(message)


@cli.command("announce")
@click.pass_obj
def announce(base_parameters: BaseParameters) -> None:
    template_file = "email_templates/announce.j2"
    message = render_template(template_file, **base_parameters.template_arguments)
    print(message)


cli()
