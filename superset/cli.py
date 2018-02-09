#!/usr/bin/env python
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from datetime import datetime
import logging
from subprocess import Popen
from sys import stdout

from colorama import Fore, Style
from flask_migrate import MigrateCommand
from flask_script import Manager
from pathlib2 import Path
import yaml

from superset import app, db, dict_import_export_util, security, utils

config = app.config
celery_app = utils.get_celery_app(config)

manager = Manager(app)
manager.add_command('db', MigrateCommand)


@manager.command
def init():
    """Inits the Superset application"""
    security.sync_role_definitions()


@manager.option(
    '-d', '--debug', action='store_true',
    help='Start the web server in debug mode')
@manager.option(
    '-n', '--no-reload', action='store_false', dest='no_reload',
    default=config.get('FLASK_USE_RELOAD'),
    help="Don't use the reloader in debug mode")
@manager.option(
    '-a', '--address', default=config.get('SUPERSET_WEBSERVER_ADDRESS'),
    help='Specify the address to which to bind the web server')
@manager.option(
    '-p', '--port', default=config.get('SUPERSET_WEBSERVER_PORT'),
    help='Specify the port on which to run the web server')
@manager.option(
    '-w', '--workers',
    default=config.get('SUPERSET_WORKERS', 2),
    help='Number of gunicorn web server workers to fire up')
@manager.option(
    '-t', '--timeout', default=config.get('SUPERSET_WEBSERVER_TIMEOUT'),
    help='Specify the timeout (seconds) for the gunicorn web server')
@manager.option(
    '-s', '--socket', default=config.get('SUPERSET_WEBSERVER_SOCKET'),
    help='Path to a UNIX socket as an alternative to address:port, e.g. '
         '/var/run/superset.sock. '
         'Will override the address and port values.')
def runserver(debug, no_reload, address, port, timeout, workers, socket):
    """Starts a Superset web server."""
    debug = debug or config.get('DEBUG')
    if debug:
        print(Fore.BLUE + '-=' * 20)
        print(
            Fore.YELLOW + 'Starting Superset server in ' +
            Fore.RED + 'DEBUG' +
            Fore.YELLOW + ' mode')
        print(Fore.BLUE + '-=' * 20)
        print(Style.RESET_ALL)
        app.run(
            host='0.0.0.0',
            port=int(port),
            threaded=True,
            debug=True,
            use_reloader=no_reload)
    else:
        addr_str = ' unix:{socket} ' if socket else' {address}:{port} '
        cmd = (
            'gunicorn '
            '-w {workers} '
            '--timeout {timeout} '
            '-b ' + addr_str +
            '--limit-request-line 0 '
            '--limit-request-field_size 0 '
            'superset:app').format(**locals())
        print(Fore.GREEN + 'Starting server with command: ')
        print(Fore.YELLOW + cmd)
        print(Style.RESET_ALL)
        Popen(cmd, shell=True).wait()


@manager.option(
    '-v', '--verbose', action='store_true',
    help='Show extra information')
def version(verbose):
    """Prints the current version number"""
    print(Fore.BLUE + '-=' * 15)
    print(Fore.YELLOW + 'Superset ' + Fore.CYAN + '{version}'.format(
        version=config.get('VERSION_STRING')))
    print(Fore.BLUE + '-=' * 15)
    if verbose:
        print('[DB] : ' + '{}'.format(db.engine))
    print(Style.RESET_ALL)


@manager.option(
    '-t', '--load-test-data', action='store_true',
    help='Load additional test data')
def load_examples(load_test_data):
    """Loads a set of Slices and Dashboards and a supporting dataset """
    from superset import data
    print('Loading examples into {}'.format(db))

    data.load_css_templates()

    print('Loading energy related dataset')
    data.load_energy()

    print("Loading [World Bank's Health Nutrition and Population Stats]")
    data.load_world_bank_health_n_pop()

    print('Loading [Birth names]')
    data.load_birth_names()

    print('Loading [Random time series data]')
    data.load_random_time_series_data()

    print('Loading [Random long/lat data]')
    data.load_long_lat_data()

    print('Loading [Country Map data]')
    data.load_country_map_data()

    print('Loading [Multiformat time series]')
    data.load_multiformat_time_series_data()

    print('Loading [Misc Charts] dashboard')
    data.load_misc_dashboard()

    print('Loading [Paris GeoJson]')
    data.load_paris_iris_geojson()

    print('Loading [San Francisco population polygons]')
    data.load_sf_population_polygons()

    print('Loading [Flights data]')
    data.load_flights()

    print('Loading [BART lines]')
    data.load_bart_lines()

    if load_test_data:
        print('Loading [Unicode test data]')
        data.load_unicode_test_data()

    print('Loading DECK.gl demo')
    data.load_deck_dash()


@manager.option(
    '-d', '--datasource',
    help=(
        'Specify which datasource name to load, if omitted, all '
        'datasources will be refreshed'
    ),
)
@manager.option(
    '-m', '--merge',
    help=(
        "Specify using 'merge' property during operation. "
        'Default value is False '
    ),
)
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
            'Refreshed metadata from cluster '
            '[' + cluster.cluster_name + ']')
    session.commit()


@manager.option(
    '-p', '--path', dest='path',
    help='Path to a single YAML file or path containing multiple YAML '
         'files to import (*.yaml or *.yml)')
@manager.option(
    '-s', '--sync', dest='sync', default='',
    help='comma seperated list of element types to synchronize '
         'e.g. "metrics,columns" deletes metrics and columns in the DB '
         'that are not specified in the YAML file')
@manager.option(
    '-r', '--recursive', dest='recursive', action='store_true',
    help='recursively search the path for yaml files')
def import_datasources(path, sync, recursive=False):
    """Import datasources from YAML"""
    sync_array = sync.split(',')
    p = Path(path)
    files = []
    if p.is_file():
        files.append(p)
    elif p.exists() and not recursive:
        files.extend(p.glob('*.yaml'))
        files.extend(p.glob('*.yml'))
    elif p.exists() and recursive:
        files.extend(p.rglob('*.yaml'))
        files.extend(p.rglob('*.yml'))
    for f in files:
        logging.info('Importing datasources from file %s', f)
        try:
            with f.open() as data_stream:
                dict_import_export_util.import_from_dict(
                    db.session,
                    yaml.safe_load(data_stream),
                    sync=sync_array)
        except Exception as e:
            logging.error('Error when importing datasources from file %s', f)
            logging.error(e)


@manager.option(
    '-f', '--datasource-file', default=None, dest='datasource_file',
    help='Specify the the file to export to')
@manager.option(
    '-p', '--print', action='store_true', dest='print_stdout',
    help='Print YAML to stdout')
@manager.option(
    '-b', '--back-references', action='store_true', dest='back_references',
    help='Include parent back references')
@manager.option(
    '-d', '--include-defaults', action='store_true', dest='include_defaults',
    help='Include fields containing defaults')
def export_datasources(print_stdout, datasource_file,
                       back_references, include_defaults):
    """Export datasources to YAML"""
    data = dict_import_export_util.export_to_dict(
        session=db.session,
        recursive=True,
        back_references=back_references,
        include_defaults=include_defaults)
    if print_stdout or not datasource_file:
        yaml.safe_dump(data, stdout, default_flow_style=False)
    if datasource_file:
        logging.info('Exporting datasources to %s', datasource_file)
        with open(datasource_file, 'w') as data_stream:
            yaml.safe_dump(data, data_stream, default_flow_style=False)


@manager.option(
    '-b', '--back-references', action='store_false',
    help='Include parent back references')
def export_datasource_schema(back_references):
    """Export datasource YAML schema to stdout"""
    data = dict_import_export_util.export_schema_to_dict(
        back_references=back_references)
    yaml.safe_dump(data, stdout, default_flow_style=False)


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
    '-w', '--workers',
    type=int,
    help='Number of celery server workers to fire up')
def worker(workers):
    """Starts a Superset worker for async SQL query execution."""
    if workers:
        celery_app.conf.update(CELERYD_CONCURRENCY=workers)
    elif config.get('SUPERSET_CELERY_WORKERS'):
        celery_app.conf.update(
            CELERYD_CONCURRENCY=config.get('SUPERSET_CELERY_WORKERS'))

    worker = celery_app.Worker(optimization='fair')
    worker.start()


@manager.option(
    '-p', '--port',
    default='5555',
    help=('Port on which to start the Flower process'))
@manager.option(
    '-a', '--address',
    default='localhost',
    help=('Address on which to run the service'))
def flower(port, address):
    """Runs a Celery Flower web server

    Celery Flower is a UI to monitor the Celery operation on a given
    broker"""
    BROKER_URL = celery_app.conf.BROKER_URL
    cmd = (
        'celery flower '
        '--broker={BROKER_URL} '
        '--port={port} '
        '--address={address} '
    ).format(**locals())
    print(Fore.GREEN + 'Starting a Celery Flower instance')
    print(Fore.BLUE + '-=' * 40)
    print(Fore.YELLOW + cmd)
    print(Fore.BLUE + '-=' * 40)
    Popen(cmd, shell=True).wait()
