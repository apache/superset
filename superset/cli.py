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
from datetime import datetime
from subprocess import Popen
from sys import stdout
from typing import Type, Union

import click
import yaml
from colorama import Fore, Style
from flask import g
from flask.cli import FlaskGroup, with_appcontext
from flask_appbuilder import Model
from pathlib2 import Path

from superset import app, appbuilder, security_manager
from superset.app import create_app
from superset.extensions import celery_app, db
from superset.utils import core as utils

logger = logging.getLogger(__name__)


def normalize_token(token_name: str) -> str:
    """
    As of click>=7, underscores in function names are replaced by dashes.
    To avoid the need to rename all cli functions, e.g. load_examples to
    load-examples, this function is used to convert dashes back to
    underscores.

    :param token_name: token name possibly containing dashes
    :return: token name where dashes are replaced with underscores
    """
    return token_name.replace("_", "-")


@click.group(
    cls=FlaskGroup,
    create_app=create_app,
    context_settings={"token_normalize_func": normalize_token},
)
@with_appcontext
def superset():
    """This is a management script for the Superset application."""

    @app.shell_context_processor
    def make_shell_context():  # pylint: disable=unused-variable
        return dict(app=app, db=db)


@superset.command()
@with_appcontext
def init():
    """Inits the Superset application"""
    appbuilder.add_permissions(update_perms=True)
    security_manager.sync_role_definitions()


@superset.command()
@with_appcontext
@click.option("--verbose", "-v", is_flag=True, help="Show extra information")
def version(verbose):
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


def load_examples_run(load_test_data, only_metadata=False, force=False):
    if only_metadata:
        print("Loading examples metadata")
    else:
        examples_db = utils.get_example_database()
        print(f"Loading examples metadata and related data into {examples_db}")

    from superset import examples

    examples.load_css_templates()

    print("Loading energy related dataset")
    examples.load_energy(only_metadata, force)

    print("Loading [World Bank's Health Nutrition and Population Stats]")
    examples.load_world_bank_health_n_pop(only_metadata, force)

    print("Loading [Birth names]")
    examples.load_birth_names(only_metadata, force)

    print("Loading [Unicode test data]")
    examples.load_unicode_test_data(only_metadata, force)

    if not load_test_data:
        print("Loading [Random time series data]")
        examples.load_random_time_series_data(only_metadata, force)

        print("Loading [Random long/lat data]")
        examples.load_long_lat_data(only_metadata, force)

        print("Loading [Country Map data]")
        examples.load_country_map_data(only_metadata, force)

        print("Loading [Multiformat time series]")
        examples.load_multiformat_time_series(only_metadata, force)

        print("Loading [Paris GeoJson]")
        examples.load_paris_iris_geojson(only_metadata, force)

        print("Loading [San Francisco population polygons]")
        examples.load_sf_population_polygons(only_metadata, force)

        print("Loading [Flights data]")
        examples.load_flights(only_metadata, force)

        print("Loading [BART lines]")
        examples.load_bart_lines(only_metadata, force)

        print("Loading [Multi Line]")
        examples.load_multi_line(only_metadata)

        print("Loading [Misc Charts] dashboard")
        examples.load_misc_dashboard()

        print("Loading DECK.gl demo")
        examples.load_deck_dash()

    print("Loading [Tabbed dashboard]")
    examples.load_tabbed_dashboard(only_metadata)


@with_appcontext
@superset.command()
@click.option("--load-test-data", "-t", is_flag=True, help="Load additional test data")
@click.option(
    "--only-metadata", "-m", is_flag=True, help="Only load metadata, skip actual data"
)
@click.option(
    "--force", "-f", is_flag=True, help="Force load data even if table already exists"
)
def load_examples(load_test_data, only_metadata=False, force=False):
    """Loads a set of Slices and Dashboards and a supporting dataset """
    load_examples_run(load_test_data, only_metadata, force)


@with_appcontext
@superset.command()
@click.option("--database_name", "-d", help="Database name to change")
@click.option("--uri", "-u", help="Database URI to change")
def set_database_uri(database_name, uri):
    """Updates a database connection URI """
    utils.get_or_create_db(database_name, uri)


@superset.command()
@with_appcontext
@click.option(
    "--datasource",
    "-d",
    help="Specify which datasource name to load, if "
    "omitted, all datasources will be refreshed",
)
@click.option(
    "--merge",
    "-m",
    is_flag=True,
    default=False,
    help="Specify using 'merge' property during operation. " "Default value is False.",
)
def refresh_druid(datasource, merge):
    """Refresh druid datasources"""
    session = db.session()
    from superset.connectors.druid.models import DruidCluster

    for cluster in session.query(DruidCluster).all():
        try:
            cluster.refresh_datasources(datasource_name=datasource, merge_flag=merge)
        except Exception as ex:  # pylint: disable=broad-except
            print("Error while processing cluster '{}'\n{}".format(cluster, str(ex)))
            logger.exception(ex)
        cluster.metadata_last_refreshed = datetime.now()
        print("Refreshed metadata from cluster " "[" + cluster.cluster_name + "]")
    session.commit()


@superset.command()
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
def import_dashboards(path, recursive, username):
    """Import dashboards from JSON"""
    from superset.utils import dashboard_import_export

    path_object = Path(path)
    files = []
    if path_object.is_file():
        files.append(path_object)
    elif path_object.exists() and not recursive:
        files.extend(path_object.glob("*.json"))
    elif path_object.exists() and recursive:
        files.extend(path_object.rglob("*.json"))
    if username is not None:
        g.user = security_manager.find_user(username=username)
    for file_ in files:
        logger.info("Importing dashboard from file %s", file_)
        try:
            with file_.open() as data_stream:
                dashboard_import_export.import_dashboards(db.session, data_stream)
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Error when importing dashboard from file %s", file_)
            logger.error(ex)


@superset.command()
@with_appcontext
@click.option(
    "--dashboard-file", "-f", default=None, help="Specify the the file to export to"
)
@click.option(
    "--print_stdout", "-p", is_flag=True, default=False, help="Print JSON to stdout"
)
def export_dashboards(print_stdout, dashboard_file):
    """Export dashboards to JSON"""
    from superset.utils import dashboard_import_export

    data = dashboard_import_export.export_dashboards(db.session)
    if print_stdout or not dashboard_file:
        print(data)
    if dashboard_file:
        logger.info("Exporting dashboards to %s", dashboard_file)
        with open(dashboard_file, "w") as data_stream:
            data_stream.write(data)


@superset.command()
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
    help="comma seperated list of element types to synchronize "
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
def import_datasources(path, sync, recursive):
    """Import datasources from YAML"""
    from superset.utils import dict_import_export

    sync_array = sync.split(",")
    path_object = Path(path)
    files = []
    if path_object.is_file():
        files.append(path_object)
    elif path_object.exists() and not recursive:
        files.extend(path_object.glob("*.yaml"))
        files.extend(path_object.glob("*.yml"))
    elif path_object.exists() and recursive:
        files.extend(path_object.rglob("*.yaml"))
        files.extend(path_object.rglob("*.yml"))
    for file_ in files:
        logger.info("Importing datasources from file %s", file_)
        try:
            with file_.open() as data_stream:
                dict_import_export.import_from_dict(
                    db.session, yaml.safe_load(data_stream), sync=sync_array
                )
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Error when importing datasources from file %s", file_)
            logger.error(ex)


@superset.command()
@with_appcontext
@click.option(
    "--datasource-file", "-f", default=None, help="Specify the the file to export to"
)
@click.option(
    "--print_stdout", "-p", is_flag=True, default=False, help="Print YAML to stdout"
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
def export_datasources(
    print_stdout, datasource_file, back_references, include_defaults
):
    """Export datasources to YAML"""
    from superset.utils import dict_import_export

    data = dict_import_export.export_to_dict(
        session=db.session,
        recursive=True,
        back_references=back_references,
        include_defaults=include_defaults,
    )
    if print_stdout or not datasource_file:
        yaml.safe_dump(data, stdout, default_flow_style=False)
    if datasource_file:
        logger.info("Exporting datasources to %s", datasource_file)
        with open(datasource_file, "w") as data_stream:
            yaml.safe_dump(data, data_stream, default_flow_style=False)


@superset.command()
@with_appcontext
@click.option(
    "--back-references",
    "-b",
    is_flag=True,
    default=False,
    help="Include parent back references",
)
def export_datasource_schema(back_references):
    """Export datasource YAML schema to stdout"""
    from superset.utils import dict_import_export

    data = dict_import_export.export_schema_to_dict(back_references=back_references)
    yaml.safe_dump(data, stdout, default_flow_style=False)


@superset.command()
@with_appcontext
def update_datasources_cache():
    """Refresh sqllab datasources cache"""
    from superset.models.core import Database

    for database in db.session.query(Database).all():
        if database.allow_multi_schema_metadata_fetch:
            print("Fetching {} datasources ...".format(database.name))
            try:
                database.get_all_table_names_in_database(
                    force=True, cache=True, cache_timeout=24 * 60 * 60
                )
                database.get_all_view_names_in_database(
                    force=True, cache=True, cache_timeout=24 * 60 * 60
                )
            except Exception as ex:  # pylint: disable=broad-except
                print("{}".format(str(ex)))


@superset.command()
@with_appcontext
@click.option(
    "--workers", "-w", type=int, help="Number of celery server workers to fire up"
)
def worker(workers):
    """Starts a Superset worker for async SQL query execution."""
    logger.info(
        "The 'superset worker' command is deprecated. Please use the 'celery "
        "worker' command instead."
    )
    if workers:
        celery_app.conf.update(CELERYD_CONCURRENCY=workers)
    elif app.config["SUPERSET_CELERY_WORKERS"]:
        celery_app.conf.update(
            CELERYD_CONCURRENCY=app.config["SUPERSET_CELERY_WORKERS"]
        )

    local_worker = celery_app.Worker(optimization="fair")
    local_worker.start()


@superset.command()
@with_appcontext
@click.option(
    "-p", "--port", default="5555", help="Port on which to start the Flower process"
)
@click.option(
    "-a", "--address", default="localhost", help="Address on which to run the service"
)
def flower(port, address):
    """Runs a Celery Flower web server

    Celery Flower is a UI to monitor the Celery operation on a given
    broker"""
    broker_url = celery_app.conf.BROKER_URL
    cmd = (
        "celery flower "
        f"--broker={broker_url} "
        f"--port={port} "
        f"--address={address} "
    )
    logger.info(
        "The 'superset flower' command is deprecated. Please use the 'celery "
        "flower' command instead."
    )
    print(Fore.GREEN + "Starting a Celery Flower instance")
    print(Fore.BLUE + "-=" * 40)
    print(Fore.YELLOW + cmd)
    print(Fore.BLUE + "-=" * 40)
    Popen(cmd, shell=True).wait()


@superset.command()
@with_appcontext
@click.option(
    "--asynchronous",
    "-a",
    is_flag=True,
    default=False,
    help="Trigger commands to run remotely on a worker",
)
@click.option(
    "--dashboards_only",
    "-d",
    is_flag=True,
    default=False,
    help="Only process dashboards",
)
@click.option(
    "--charts_only", "-c", is_flag=True, default=False, help="Only process charts"
)
@click.option(
    "--force",
    "-f",
    is_flag=True,
    default=False,
    help="Force refresh, even if previously cached",
)
@click.option("--model_id", "-i", multiple=True)
def compute_thumbnails(
    asynchronous: bool,
    dashboards_only: bool,
    charts_only: bool,
    force: bool,
    model_id: int,
):
    """Compute thumbnails"""
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.tasks.thumbnails import (
        cache_chart_thumbnail,
        cache_dashboard_thumbnail,
    )

    def compute_generic_thumbnail(
        friendly_type: str,
        model_cls: Union[Type[Dashboard], Type[Slice]],
        model_id: int,
        compute_func,
    ):
        query = db.session.query(model_cls)
        if model_id:
            query = query.filter(model_cls.id.in_(model_id))
        dashboards = query.all()
        count = len(dashboards)
        for i, model in enumerate(dashboards):
            if asynchronous:
                func = compute_func.delay
                action = "Triggering"
            else:
                func = compute_func
                action = "Processing"
            msg = f'{action} {friendly_type} "{model}" ({i+1}/{count})'
            click.secho(msg, fg="green")
            func(model.id, force=force)

    if not charts_only:
        compute_generic_thumbnail(
            "dashboard", Dashboard, model_id, cache_dashboard_thumbnail
        )
    if not dashboards_only:
        compute_generic_thumbnail("chart", Slice, model_id, cache_chart_thumbnail)


@superset.command()
@with_appcontext
def load_test_users():
    """
    Loads admin, alpha, and gamma user for testing purposes

    Syncs permissions for those users/roles
    """
    print(Fore.GREEN + "Loading a set of users for unit tests")
    load_test_users_run()


def load_test_users_run():
    """
    Loads admin, alpha, and gamma user for testing purposes

    Syncs permissions for those users/roles
    """
    if app.config["TESTING"]:

        sm = security_manager

        examples_db = utils.get_example_database()

        examples_pv = sm.add_permission_view_menu("database_access", examples_db.perm)

        sm.sync_role_definitions()
        gamma_sqllab_role = sm.add_role("gamma_sqllab")
        sm.add_permission_role(gamma_sqllab_role, examples_pv)

        for role in ["Gamma", "sql_lab"]:
            for perm in sm.find_role(role).permissions:
                sm.add_permission_role(gamma_sqllab_role, perm)

        users = (
            ("admin", "Admin"),
            ("gamma", "Gamma"),
            ("gamma2", "Gamma"),
            ("gamma_sqllab", "gamma_sqllab"),
            ("alpha", "Alpha"),
        )
        for username, role in users:
            user = sm.find_user(username)
            if not user:
                sm.add_user(
                    username,
                    username,
                    "user",
                    username + "@fab.org",
                    sm.find_role(role),
                    password="general",
                )
        sm.get_session.commit()


@superset.command()
@with_appcontext
def sync_tags():
    """Rebuilds special tags (owner, type, favorited by)."""
    # pylint: disable=no-member
    metadata = Model.metadata

    from superset.common.tags import add_favorites, add_owners, add_types

    add_types(db.engine, metadata)
    add_owners(db.engine, metadata)
    add_favorites(db.engine, metadata)
