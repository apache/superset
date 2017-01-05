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

from superset import app, db, data, security

config = app.config

manager = Manager(app)
manager.add_command('db', MigrateCommand)


@manager.command
def init():
    """Inits the Superset application"""
    security.sync_role_definitions()


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
    from superset import models
    for cluster in session.query(models.DruidCluster).all():
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
def worker():
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
    }
    c_worker.run(**options)
