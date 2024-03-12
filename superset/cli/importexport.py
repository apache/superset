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
import yaml
from flask import g
from flask.cli import with_appcontext

from superset import security_manager
from superset.extensions import db
from superset.utils.core import override_user

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
                    fp.write(file_content().encode())
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
                    fp.write(file_content().encode())
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
    required=True,
    help="Path to a single ZIP file",
)
@click.option(
    "--username",
    "-u",
    required=True,
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
@click.option(
    "--username",
    "-u",
    required=False,
    default="admin",
    help="Specify the user name to assign datasources to",
)
def import_datasources(path: str, username: Optional[str] = "admin") -> None:
    """Import datasources from ZIP file"""
    # pylint: disable=import-outside-toplevel
    from superset.commands.dataset.importers.dispatcher import ImportDatasetsCommand
    from superset.commands.importers.v1.utils import get_contents_from_bundle

    with override_user(user=security_manager.find_user(username=username)):
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


@click.command()
@with_appcontext
@click.option(
    "--dashboard-file",
    "-f",
    default=None,
    help="Specify the file to export to",
)
@click.option(
    "--print_stdout",
    "-p",
    is_flag=True,
    default=False,
    help="Print JSON to stdout",
)
def legacy_export_dashboards(
    dashboard_file: Optional[str], print_stdout: bool = False
) -> None:
    """Export dashboards to JSON"""
    # pylint: disable=import-outside-toplevel
    from superset.utils import dashboard_import_export

    data = dashboard_import_export.export_dashboards()
    if print_stdout or not dashboard_file:
        print(data)
    if dashboard_file:
        logger.info("Exporting dashboards to %s", dashboard_file)
        with open(dashboard_file, "w") as data_stream:
            data_stream.write(data)


@click.command()
@with_appcontext
@click.option(
    "--datasource-file",
    "-f",
    default=None,
    help="Specify the file to export to",
)
@click.option(
    "--print_stdout",
    "-p",
    is_flag=True,
    default=False,
    help="Print YAML to stdout",
)
@click.option(
    "--back-references",
    "-b",
    is_flag=True,
    default=False,
    help="Include parent back references",
)
@click.option(
    "--include-defaults",
    "-d",
    is_flag=True,
    default=False,
    help="Include fields containing defaults",
)
def legacy_export_datasources(
    datasource_file: Optional[str],
    print_stdout: bool = False,
    back_references: bool = False,
    include_defaults: bool = False,
) -> None:
    """Export datasources to YAML"""
    # pylint: disable=import-outside-toplevel
    from superset.utils import dict_import_export

    data = dict_import_export.export_to_dict(
        recursive=True,
        back_references=back_references,
        include_defaults=include_defaults,
    )
    if print_stdout or not datasource_file:
        yaml.safe_dump(data, sys.stdout, default_flow_style=False)
    if datasource_file:
        logger.info("Exporting datasources to %s", datasource_file)
        with open(datasource_file, "w") as data_stream:
            yaml.safe_dump(data, data_stream, default_flow_style=False)


@click.command()
@with_appcontext
@click.option(
    "--path",
    "-p",
    help="Path to a single JSON file or path containing multiple JSON "
    "files to import (*.json)",
)
@click.option(
    "--recursive",
    "-r",
    is_flag=True,
    default=False,
    help="recursively search the path for json files",
)
@click.option(
    "--username",
    "-u",
    default=None,
    help="Specify the user name to assign dashboards to",
)
def legacy_import_dashboards(path: str, recursive: bool, username: str) -> None:
    """Import dashboards from JSON file"""
    # pylint: disable=import-outside-toplevel
    from superset.commands.dashboard.importers.v0 import ImportDashboardsCommand

    path_object = Path(path)
    files: list[Path] = []
    if path_object.is_file():
        files.append(path_object)
    elif path_object.exists() and not recursive:
        files.extend(path_object.glob("*.json"))
    elif path_object.exists() and recursive:
        files.extend(path_object.rglob("*.json"))
    if username is not None:
        g.user = security_manager.find_user(username=username)
    contents = {}
    for path_ in files:
        with open(path_) as file:
            contents[path_.name] = file.read()
    try:
        ImportDashboardsCommand(contents).run()
    except Exception:  # pylint: disable=broad-except
        logger.exception("Error when importing dashboard")
        sys.exit(1)


@click.command()
@with_appcontext
@click.option(
    "--path",
    "-p",
    help="Path to a single YAML file or path containing multiple YAML "
    "files to import (*.yaml or *.yml)",
)
@click.option(
    "--sync",
    "-s",
    "sync",
    default="",
    help="comma separated list of element types to synchronize "
    'e.g. "metrics,columns" deletes metrics and columns in the DB '
    "that are not specified in the YAML file",
)
@click.option(
    "--recursive",
    "-r",
    is_flag=True,
    default=False,
    help="recursively search the path for yaml files",
)
def legacy_import_datasources(path: str, sync: str, recursive: bool) -> None:
    """Import datasources from YAML"""
    # pylint: disable=import-outside-toplevel
    from superset.commands.dataset.importers.v0 import ImportDatasetsCommand

    sync_array = sync.split(",")
    sync_columns = "columns" in sync_array
    sync_metrics = "metrics" in sync_array

    path_object = Path(path)
    files: list[Path] = []
    if path_object.is_file():
        files.append(path_object)
    elif path_object.exists() and not recursive:
        files.extend(path_object.glob("*.yaml"))
        files.extend(path_object.glob("*.yml"))
    elif path_object.exists() and recursive:
        files.extend(path_object.rglob("*.yaml"))
        files.extend(path_object.rglob("*.yml"))
    contents = {}
    for path_ in files:
        with open(path_) as file:
            contents[path_.name] = file.read()
    try:
        ImportDatasetsCommand(
            contents, sync_columns=sync_columns, sync_metrics=sync_metrics
        ).run()
    except Exception:  # pylint: disable=broad-except
        logger.exception("Error when importing dataset")
        sys.exit(1)


@click.command()
@with_appcontext
@click.option(
    "--back-references",
    "-b",
    is_flag=True,
    default=False,
    help="Include parent back references",
)
def legacy_export_datasource_schema(back_references: bool) -> None:
    """Export datasource YAML schema to stdout"""
    # pylint: disable=import-outside-toplevel
    from superset.utils import dict_import_export

    data = dict_import_export.export_schema_to_dict(back_references=back_references)
    yaml.safe_dump(data, sys.stdout, default_flow_style=False)
