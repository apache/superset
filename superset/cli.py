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
# pylint: disable=C,R,W
import logging
from datetime import datetime
from subprocess import Popen
from sys import stdout

import click
import yaml
from colorama import Fore, Style
from flask import g
from flask_appbuilder import Model
from pathlib2 import Path

from superset import app, appbuilder, db, examples, security_manager
from superset.common.tags import add_favorites, add_owners, add_types
from superset.utils import core as utils, dashboard_import_export, dict_import_export

config = app.config
celery_app = utils.get_celery_app(config)


def create_app(script_info=None):
    return app


@app.shell_context_processor
def make_shell_context():
    return dict(app=app, db=db)


@app.cli.command()
def init():
    """Inits the Superset application"""
    utils.get_example_database()
    appbuilder.add_permissions(update_perms=True)
    security_manager.sync_role_definitions()


@app.cli.command()
@click.option("--verbose", "-v", is_flag=True, help="Show extra information")
def version(verbose):
    """Prints the current version number"""
    print(Fore.BLUE + "-=" * 15)
    print(
        Fore.YELLOW
        + "Superset "
        + Fore.CYAN
        + "{version}".format(version=config.get("VERSION_STRING"))
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


@app.cli.command()
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


@app.cli.command()
@click.option("--database_name", "-d", help="Database name to change")
@click.option("--uri", "-u", help="Database URI to change")
def set_database_uri(database_name, uri):
    """Updates a database connection URI """
    utils.get_or_create_db(database_name, uri)


@app.cli.command()
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
        except Exception as e:
            print("Error while processing cluster '{}'\n{}".format(cluster, str(e)))
            logging.exception(e)
        cluster.metadata_last_refreshed = datetime.now()
        print("Refreshed metadata from cluster " "[" + cluster.cluster_name + "]")
    session.commit()


@app.cli.command()
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
    p = Path(path)
    files = []
    if p.is_file():
        files.append(p)
    elif p.exists() and not recursive:
        files.extend(p.glob("*.json"))
    elif p.exists() and recursive:
        files.extend(p.rglob("*.json"))
    if username is not None:
        g.user = security_manager.find_user(username=username)
    for f in files:
        logging.info("Importing dashboard from file %s", f)
        try:
            with f.open() as data_stream:
                dashboard_import_export.import_dashboards(db.session, data_stream)
        except Exception as e:
            logging.error("Error when importing dashboard from file %s", f)
            logging.error(e)


@app.cli.command()
@click.option(
    "--dashboard-file", "-f", default=None, help="Specify the the file to export to"
)
@click.option(
    "--print_stdout", "-p", is_flag=True, default=False, help="Print JSON to stdout"
)
def export_dashboards(print_stdout, dashboard_file):
    """Export dashboards to JSON"""
    data = dashboard_import_export.export_dashboards(db.session)
    if print_stdout or not dashboard_file:
        print(data)
    if dashboard_file:
        logging.info("Exporting dashboards to %s", dashboard_file)
        with open(dashboard_file, "w") as data_stream:
            data_stream.write(data)


@app.cli.command()
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
    sync_array = sync.split(",")
    p = Path(path)
    files = []
    if p.is_file():
        files.append(p)
    elif p.exists() and not recursive:
        files.extend(p.glob("*.yaml"))
        files.extend(p.glob("*.yml"))
    elif p.exists() and recursive:
        files.extend(p.rglob("*.yaml"))
        files.extend(p.rglob("*.yml"))
    for f in files:
        logging.info("Importing datasources from file %s", f)
        try:
            with f.open() as data_stream:
                dict_import_export.import_from_dict(
                    db.session, yaml.safe_load(data_stream), sync=sync_array
                )
        except Exception as e:
            logging.error("Error when importing datasources from file %s", f)
            logging.error(e)


@app.cli.command()
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
    data = dict_import_export.export_to_dict(
        session=db.session,
        recursive=True,
        back_references=back_references,
        include_defaults=include_defaults,
    )
    if print_stdout or not datasource_file:
        yaml.safe_dump(data, stdout, default_flow_style=False)
    if datasource_file:
        logging.info("Exporting datasources to %s", datasource_file)
        with open(datasource_file, "w") as data_stream:
            yaml.safe_dump(data, data_stream, default_flow_style=False)


@app.cli.command()
@click.option(
    "--back-references",
    "-b",
    is_flag=True,
    default=False,
    help="Include parent back references",
)
def export_datasource_schema(back_references):
    """Export datasource YAML schema to stdout"""
    data = dict_import_export.export_schema_to_dict(back_references=back_references)
    yaml.safe_dump(data, stdout, default_flow_style=False)


@app.cli.command()
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
            except Exception as e:
                print("{}".format(str(e)))


@app.cli.command()
@click.option(
    "--workers", "-w", type=int, help="Number of celery server workers to fire up"
)
def worker(workers):
    """Starts a Superset worker for async SQL query execution."""
    logging.info(
        "The 'superset worker' command is deprecated. Please use the 'celery "
        "worker' command instead."
    )
    if workers:
        celery_app.conf.update(CELERYD_CONCURRENCY=workers)
    elif config.get("SUPERSET_CELERY_WORKERS"):
        celery_app.conf.update(
            CELERYD_CONCURRENCY=config.get("SUPERSET_CELERY_WORKERS")
        )

    worker = celery_app.Worker(optimization="fair")
    worker.start()


@app.cli.command()
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
    BROKER_URL = celery_app.conf.BROKER_URL
    cmd = (
        "celery flower "
        f"--broker={BROKER_URL} "
        f"--port={port} "
        f"--address={address} "
    )
    logging.info(
        "The 'superset flower' command is deprecated. Please use the 'celery "
        "flower' command instead."
    )
    print(Fore.GREEN + "Starting a Celery Flower instance")
    print(Fore.BLUE + "-=" * 40)
    print(Fore.YELLOW + cmd)
    print(Fore.BLUE + "-=" * 40)
    Popen(cmd, shell=True).wait()


@app.cli.command()
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
    if config.get("TESTING"):

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


@app.cli.command()
def sync_tags():
    """Rebuilds special tags (owner, type, favorited by)."""
    # pylint: disable=no-member
    metadata = Model.metadata
    add_types(db.engine, metadata)
    add_owners(db.engine, metadata)
    add_favorites(db.engine, metadata)
