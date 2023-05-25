#!/usr/bin/env python
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
#
import html
import importlib
import logging
import os
import pkgutil
from typing import Any, Dict

import click
from click import Command
from colorama import Fore, Style
from flask.cli import FlaskGroup, with_appcontext

from superset import app, appbuilder, cli, security_manager
from superset.cli.lib import normalize_token
from superset.extensions import db

logger = logging.getLogger(__name__)


@click.group(
    cls=FlaskGroup,
    context_settings={"token_normalize_func": normalize_token},
)
@with_appcontext
def superset() -> None:
    """This is a management script for the Superset application."""

    @app.shell_context_processor
    def make_shell_context() -> Dict[str, Any]:
        return dict(app=app, db=db)


# add sub-commands
for load, module_name, is_pkg in pkgutil.walk_packages(
    cli.__path__, cli.__name__ + "."
):
    module = importlib.import_module(module_name)
    for attribute in module.__dict__.values():
        if isinstance(attribute, (click.core.Command, click.core.Group)):
            superset.add_command(attribute)

            if isinstance(attribute, click.core.Group):
                break


@superset.command()
@with_appcontext
def init() -> None:
    """Inits the Superset application"""
    appbuilder.add_permissions(update_perms=True)
    security_manager.sync_role_definitions()


@superset.command()
@with_appcontext
@click.option("--verbose", "-v", is_flag=True, help="Show extra information")
def version(verbose: bool) -> None:
    """Prints the current version number"""
    print(Fore.BLUE + "-=" * 15)
    print(
        Fore.YELLOW
        + "Superset "
        + Fore.CYAN
        + "{version}".format(version=app.config["VERSION_STRING"])
    )
    print(Fore.BLUE + "-=" * 15)
    if verbose:
        print("[DB] : " + "{}".format(db.engine))
    print(Style.RESET_ALL)


@superset.command(hidden=True)
@with_appcontext
def update_cli_docs() -> None:
    """Regenerate the cli.md file in docs"""

    click.secho("Retrieving cli info", fg="yellow")
    markdown_content = generate_cli_docs(superset.commands)

    click.secho("Generating cli markdown", fg="yellow")
    superset_dir = os.path.abspath(os.path.dirname(__file__))
    cli_markdown = os.path.join(
        superset_dir, "..", "..", "docs", "static", "resources", "cli.mdx"
    )

    with open(cli_markdown, "w") as outfile:
        outfile.write(html.escape(markdown_content, quote=False))
    click.secho("Successfully generated cli docs!", fg="green")


def generate_cli_docs(commands: dict[str, Command], level: int = 0) -> str:
    """Recursively traverse Click CLI commands to collect documentation relevant info

    :param commands: Click commands
    :param level: count of recursion
    :returns: markdown content as string
    """
    entries = {}
    for cmd in commands.values():
        positional_args = ""
        named_args = ""

        if cmd.hidden:
            continue

        entries[cmd.name] = f"{'#' * (level + 2)} {cmd.name}\n\n{cmd.help}\n\n"

        # get arguments info
        for option in cmd.params:
            option_info = option.to_info_dict()

            # get named arguments
            if option_info["param_type_name"] == "option":
                named_args += f"- `{option_info['opts']}`: "
                named_args += f"{option_info['help']}"
                if option_info["required"]:
                    named_args += " (required)"
                named_args += "\n\n"
            # get positional arguments
            elif option_info["param_type_name"] == "argument":
                positional_args += (
                    f"- `{option_info['opts']}`: {option_info['type']['param_type']}"
                )
                if option_info["required"]:
                    positional_args += " (required)"
                positional_args += "\n\n"

        if positional_args:
            entries[
                cmd.name
            ] += f"{'#' * (level + 3)} Positional Arguments\n\n{positional_args}"
        if named_args:
            entries[cmd.name] += f"{'#' * (level + 3)} Named Arguments\n\n{named_args}"

        # get sub-commands info
        if not cmd.params and isinstance(cmd, click.Group):
            entries[cmd.name] += f"{'#' * (level + 3)} Sub-commands\n\n"
            entries[cmd.name] += generate_cli_docs(cmd.commands, level + 2)

    return "\n\n".join(dict(sorted(entries.items())).values())
