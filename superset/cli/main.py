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
import logging
from typing import Any, Dict

import click
from colorama import Fore, Style
from flask.cli import FlaskGroup, with_appcontext

from superset import app, appbuilder, security_manager
from superset.cli import celery, examples, importexport, test, thumbnails, update
from superset.cli.lib import feature_flags, normalize_token
from superset.extensions import db

logger = logging.getLogger(__name__)


@click.group(
    cls=FlaskGroup, context_settings={"token_normalize_func": normalize_token},
)
@with_appcontext
def superset() -> None:
    """This is a management script for the Superset application."""

    @app.shell_context_processor
    def make_shell_context() -> Dict[str, Any]:
        return dict(app=app, db=db)


# add sub-commands
superset.add_command(celery.flower)
superset.add_command(celery.worker)
superset.add_command(examples.load_examples)
superset.add_command(importexport.export_dashboards)
if not feature_flags.get("VERSIONED_EXPORT"):
    superset.add_command(importexport.export_datasource_schema)
superset.add_command(importexport.export_datasources)
superset.add_command(importexport.import_dashboards)
superset.add_command(importexport.import_datasources)
superset.add_command(importexport.import_directory)
superset.add_command(test.alert)
superset.add_command(test.load_test_users)
superset.add_command(thumbnails.compute_thumbnails)
superset.add_command(update.re_encrypt_secrets)
superset.add_command(update.refresh_druid)
superset.add_command(update.set_database_uri)
superset.add_command(update.sync_tags)
superset.add_command(update.update_api_docs)
superset.add_command(update.update_datasources_cache)


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
