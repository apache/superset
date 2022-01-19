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

"""
A command to sync DBT models and metrics to Superset.
"""

import os.path
from pathlib import Path

import click
from flask.cli import with_appcontext

from superset.cli.sync.dbt.databases import sync_database
from superset.cli.sync.dbt.datasets import sync_datasets


@click.command()
@with_appcontext
@click.argument("manifest", type=click.Path(exists=True, resolve_path=True))
@click.option(
    "--project", help="Name of the DBT project", default="default",
)
@click.option("--target", help="Target name", default="dev")
@click.option(
    "--profile",
    help="Location of profiles.yml file",
    type=click.Path(exists=True, resolve_path=True),
)
def dbt(manifest: str, project: str, target: str, profile: str) -> None:
    """
    Sync models and metrics from DBT to Superset.
    """
    if profile is None:
        profile = os.path.expanduser("~/.dbt/profiles.yml")

    database = sync_database(Path(profile), project, target)
    sync_datasets(Path(manifest), database)
