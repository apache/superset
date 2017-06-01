#!/usr/bin/env python
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import logging
import celery
from celery.bin import worker as celery_worker
from datetime import datetime
from subprocess import Popen

from flask_migrate import MigrateCommand
from flask_script import Manager

from superset import app, db, security

config = app.config

manager = Manager(app)
manager.add_command('db', MigrateCommand)


@manager.command
def init():
    """Inits the Superset application"""
    security.sync_role_definitions()


@manager.option(
    '-d', '--debug', action='store_true',
    help="Start the web server in debug mode")
@manager.option(
    '-n', '--no-reload', action='store_false', dest='no_reload',
    default=config.get("FLASK_USE_RELOAD"),
    help="Don't use the reloader in debug mode")
@manager.option(
    '-a', '--address', default=config.get("SUPERSET_WEBSERVER_ADDRESS"),
    help="Specify the address to which to bind the web server")
@manager.option(
    '-p', '--port', default=config.get("SUPERSET_WEBSERVER_PORT"),
    help="Specify the port on which to run the web server")
@manager.option(
    '-w', '--workers', default=config.get("SUPERSET_WORKERS", 2),
    help="Number of gunicorn web server workers to fire up")
@manager.option(
    '-t', '--timeout', default=config.get("SUPERSET_WEBSERVER_TIMEOUT"),
    help="Specify the timeout (seconds) for the gunicorn web server")
@manager.option(
    '-s', '--socket', default=config.get("SUPERSET_WEBSERVER_SOCKET"),
    help="Path to a UNIX socket as an alternative to address:port, e.g. "
         "/var/run/superset.sock. "
         "Will override the address and port values.")
def runserver(debug, no_reload, address, port, timeout, workers, socket):
    """Starts a Superset web server."""
    debug = debug or config.get("DEBUG")
    if debug:
        app.run(
            host='0.0.0.0',
            port=int(port),
            threaded=True,
            debug=True,
            use_reloader=no_reload)
    else:
        addr_str = " unix:{socket} " if socket else" {address}:{port} "
        cmd = (
            "gunicorn "
            "-w {workers} "
            "--timeout {timeout} "
            "-b " + addr_str +
            "--limit-request-line 0 "
            "--limit-request-field_size 0 "
            "superset:app").format(**locals())
        print("Starting server with command: " + cmd)
        Popen(cmd, shell=True).wait()


@manager.option(
    '-v', '--verbose', action='store_true',
    help="Show extra information")
def version(verbose):
    """Prints the current version number"""
    s = (
        "\n-----------------------\n"
        "Superset {version}\n"
        "-----------------------").format(
        version=config.get('VERSION_STRING'))
    print(s)
    if verbose:
        print("[DB] : " + "{}".format(db.engine))


@manager.option(
    '-t', '--load-test-data', action='store_true',
    help="Load additional test data")
def load_examples(load_test_data):
    """Loads a set of Slices and Dashboards and a supporting dataset """
    from superset import data
    print("Loading examples into {}".format(db))

    data.load_css_templates()

    print("Loading energy related dataset")
    data.load_energy()

    print("Loading [World Bank's Health Nutrition and Population Stats]")
    data.load_world_bank_health_n_pop()

    print("Loading [Birth names]")
    data.load_birth_names()

    print("Loading [Random time series data]")
    data.load_random_time_series_data()

    print("Loading [Random long/lat data]")
    data.load_long_lat_data()

    print("Loading [Country Map data]")
    data.load_country_map_data()

    print("Loading [Multiformat time series]")
    data.load_multiformat_time_series_data()

    print("Loading [Misc Charts] dashboard")
    data.load_misc_dashboard()

    if load_test_data:
        print("Loading [Unicode test data]")
        data.load_unicode_test_data()


@manager.option(
    '-d', '--datasource',
    help=(
            "Specify which datasource name to load, if omitted, all "
            "datasources will be refreshed"))
@manager.option(
    '-m', '--merge',
    help=(
            "Specify using 'merge' property during operation. "
            "Default value is False "))
def refresh_druid(datasource, merge):
    """Refresh druid datasources"""
    session = db.session()
    from superset.connectors.druid.models import DruidCluster
    for cluster in session.query(DruidCluster).all():
        try:
            cluster.refresh_datasources(datasource_name=datasource,
                                        merge_flag=merge)
        except Exception as e:
            print(
                "Error while processing cluster '{}'\n{}".format(
                    cluster, str(e)))
            logging.exception(e)
        cluster.metadata_last_refreshed = datetime.now()
        print(
            "Refreshed metadata from cluster "
            "[" + cluster.cluster_name + "]")
    session.commit()


@manager.command
def update_datasources_cache():
    """Refresh sqllab datasources cache"""
    from superset.models.core import Database
    for database in db.session.query(Database).all():
        print('Fetching {} datasources ...'.format(database.name))
        try:
            database.all_table_names(force=True)
            database.all_view_names(force=True)
        except Exception as e:
            print('{}'.format(e.message))


@manager.option(
    '-w', '--workers', default=config.get("SUPERSET_CELERY_WORKERS", 32),
    help="Number of celery server workers to fire up")
def worker(workers):
    """Starts a Superset worker for async SQL query execution."""
    # celery -A tasks worker --loglevel=info
    print("Starting SQL Celery worker.")
    if config.get('CELERY_CONFIG'):
        print("Celery broker url: ")
        print(config.get('CELERY_CONFIG').BROKER_URL)

    application = celery.current_app._get_current_object()
    c_worker = celery_worker.worker(app=application)
    options = {
        'broker': config.get('CELERY_CONFIG').BROKER_URL,
        'loglevel': 'INFO',
        'traceback': True,
        'concurrency': int(workers),
    }
    c_worker.run(**options)
