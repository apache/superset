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
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional
from zipfile import is_zipfile, ZipFile

import click
from flask import g
from flask.cli import with_appcontext

from superset import security_manager
from superset.extensions import db

logger = logging.getLogger(__name__)


@click.command()
@with_appcontext
@click.argument("directory")
@click.option(
    "--overwrite",
    "-o",
    is_flag=True,
    help="Overwriting existing metadata definitions",
)
@click.option(
    "--force",
    "-f",
    is_flag=True,
    help="Force load data even if table already exists",
)
def import_directory(directory: str, overwrite: bool, force: bool) -> None:
    """Imports configs from a given directory"""
    # pylint: disable=import-outside-toplevel
    from superset.examples.utils import load_configs_from_directory

    load_configs_from_directory(
        root=Path(directory),
        overwrite=overwrite,
        force_data=force,
    )


@click.command()
@with_appcontext
@click.option(
    "--dashboard-file",
    "-f",
    help="Specify the file to export to",
)
def export_dashboards(dashboard_file: Optional[str] = None) -> None:
    """Export dashboards to ZIP file"""
    # pylint: disable=import-outside-toplevel
    from superset.commands.dashboard.export import ExportDashboardsCommand
    from superset.models.dashboard import Dashboard

    g.user = security_manager.find_user(username="admin")

    dashboard_ids = [id_ for (id_,) in db.session.query(Dashboard.id).all()]
    timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    root = f"dashboard_export_{timestamp}"
    dashboard_file = dashboard_file or f"{root}.zip"

    try:
        with ZipFile(dashboard_file, "w") as bundle:
            for file_name, file_content in ExportDashboardsCommand(dashboard_ids).run():
                with bundle.open(f"{root}/{file_name}", "w") as fp:
                    fp.write(file_content.encode())
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "There was an error when exporting the dashboards, please check "
            "the exception traceback in the log"
        )
        sys.exit(1)


@click.command()
@with_appcontext
@click.option(
    "--datasource-file",
    "-f",
    help="Specify the file to export to",
)
def export_datasources(datasource_file: Optional[str] = None) -> None:
    """Export datasources to ZIP file"""
    # pylint: disable=import-outside-toplevel
    from superset.commands.dataset.export import ExportDatasetsCommand
    from superset.connectors.sqla.models import SqlaTable

    g.user = security_manager.find_user(username="admin")

    dataset_ids = [id_ for (id_,) in db.session.query(SqlaTable.id).all()]
    timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    root = f"dataset_export_{timestamp}"
    datasource_file = datasource_file or f"{root}.zip"

    try:
        with ZipFile(datasource_file, "w") as bundle:
            for file_name, file_content in ExportDatasetsCommand(dataset_ids).run():
                with bundle.open(f"{root}/{file_name}", "w") as fp:
                    fp.write(file_content.encode())
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "There was an error when exporting the datasets, please check "
            "the exception traceback in the log"
        )
        sys.exit(1)


@click.command()
@with_appcontext
@click.option(
    "--path",
    "-p",
    help="Path to a single ZIP file",
)
@click.option(
    "--username",
    "-u",
    default=None,
    help="Specify the user name to assign dashboards to",
)
def import_dashboards(path: str, username: Optional[str]) -> None:
    """Import dashboards from ZIP file"""
    # pylint: disable=import-outside-toplevel
    from superset.commands.dashboard.importers.dispatcher import ImportDashboardsCommand
    from superset.commands.importers.v1.utils import get_contents_from_bundle

    if username is not None:
        g.user = security_manager.find_user(username=username)
    if is_zipfile(path):
        with ZipFile(path) as bundle:
            contents = get_contents_from_bundle(bundle)
    else:
        with open(path) as file:
            contents = {path: file.read()}
    try:
        ImportDashboardsCommand(contents, overwrite=True).run()
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "There was an error when importing the dashboards(s), please check "
            "the exception traceback in the log"
        )
        sys.exit(1)


@click.command()
@with_appcontext
@click.option(
    "--path",
    "-p",
    help="Path to a single ZIP file",
)
def import_datasources(path: str) -> None:
    """Import datasources from ZIP file"""
    # pylint: disable=import-outside-toplevel
    from superset.commands.dataset.importers.dispatcher import ImportDatasetsCommand
    from superset.commands.importers.v1.utils import get_contents_from_bundle

    if is_zipfile(path):
        with ZipFile(path) as bundle:
            contents = get_contents_from_bundle(bundle)
    else:
        with open(path) as file:
            contents = {path: file.read()}
    try:
        ImportDatasetsCommand(contents, overwrite=True).run()
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "There was an error when importing the dataset(s), please check the "
            "exception traceback in the log"
        )
        sys.exit(1)
