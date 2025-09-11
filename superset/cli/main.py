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
import importlib
import logging
import pkgutil
from typing import Any

import click
from colorama import Fore, Style
from flask.cli import FlaskGroup, with_appcontext

from superset import app, appbuilder, cli, security_manager
from superset.cli.lib import normalize_token
from superset.extensions import db
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


@click.group(
    cls=FlaskGroup,
    context_settings={"token_normalize_func": normalize_token},
)
@with_appcontext
def superset() -> None:
    """\033[1;37mThe Apache Superset CLI\033[0m"""
    # NOTE: codes above are ANSI color codes for bold white in CLI header ^^^

    @app.shell_context_processor
    def make_shell_context() -> dict[str, Any]:
        return {"app": app, "db": db}


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
@transaction()
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
    print(Fore.YELLOW + "Superset " + Fore.CYAN + f"{app.config['VERSION_STRING']}")
    print(Fore.BLUE + "-=" * 15)
    if verbose:
        print("[DB] : " + f"{db.engine}")
    print(Style.RESET_ALL)
