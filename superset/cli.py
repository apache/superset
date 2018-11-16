#!/usr/bin/env python
# pylint: disable=C,R,W
from datetime import datetime
import logging
from subprocess import Popen
from sys import stdout

import click
from colorama import Fore, Style
from pathlib2 import Path
import werkzeug.serving
import yaml

from superset import (
    app, data, db, security_manager,
)
from superset.utils import (
    core as utils, dashboard_import_export, dict_import_export)

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
    utils.get_or_create_main_db()
    security_manager.sync_role_definitions()


def debug_run(app, port, use_reloader):
    click.secho(
        '[DEPRECATED] As of Flask >=1.0.0, this command is no longer '
        'supported, please use `flask run` instead, as documented in our '
        'CONTRIBUTING.md',
        fg='red',
    )
    click.secho('[example]', fg='yellow')
    click.secho(
        'flask run -p 8080 --with-threads --reload --debugger',
        fg='green',
    )


def console_log_run(app, port, use_reloader):
    from console_log import ConsoleLog
    from gevent import pywsgi
    from geventwebsocket.handler import WebSocketHandler

    app.wsgi_app = ConsoleLog(app.wsgi_app, app.logger)

    def run():
        server = pywsgi.WSGIServer(
            ('0.0.0.0', int(port)),
            app,
            handler_class=WebSocketHandler)
        server.serve_forever()

    if use_reloader:
        from gevent import monkey
        monkey.patch_all()
        run = werkzeug.serving.run_with_reloader(run)

    run()


@app.cli.command()
@click.option('--debug', '-d', is_flag=True, help='Start the web server in debug mode')
@click.option('--console-log', is_flag=True,
              help='Create logger that logs to the browser console (implies -d)')
@click.option('--no-reload', '-n', 'use_reloader', flag_value=False,
              default=config.get('FLASK_USE_RELOAD'),
              help='Don\'t use the reloader in debug mode')
@click.option('--address', '-a', default=config.get('SUPERSET_WEBSERVER_ADDRESS'),
              help='Specify the address to which to bind the web server')
@click.option('--port', '-p', default=config.get('SUPERSET_WEBSERVER_PORT'),
              help='Specify the port on which to run the web server')
@click.option('--workers', '-w', default=config.get('SUPERSET_WORKERS', 2),
              help='Number of gunicorn web server workers to fire up [DEPRECATED]')
@click.option('--timeout', '-t', default=config.get('SUPERSET_WEBSERVER_TIMEOUT'),
              help='Specify the timeout (seconds) for the '
                   'gunicorn web server [DEPRECATED]')
@click.option('--socket', '-s', default=config.get('SUPERSET_WEBSERVER_SOCKET'),
              help='Path to a UNIX socket as an alternative to address:port, e.g. '
                   '/var/run/superset.sock. '
                   'Will override the address and port values. [DEPRECATED]')
def runserver(debug, console_log, use_reloader, address, port, timeout, workers, socket):
    """Starts a Superset web server."""
    debug = debug or config.get('DEBUG') or console_log
    if debug:
        print(Fore.BLUE + '-=' * 20)
        print(
            Fore.YELLOW + 'Starting Superset server in ' +
            Fore.RED + 'DEBUG' +
            Fore.YELLOW + ' mode')
        print(Fore.BLUE + '-=' * 20)
        print(Style.RESET_ALL)
        if console_log:
            console_log_run(app, port, use_reloader)
        else:
            debug_run(app, port, use_reloader)
    else:
        logging.info(
            "The Gunicorn 'superset runserver' command is deprecated. Please "
            "use the 'gunicorn' command instead.")
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


@app.cli.command()
@click.option('--verbose', '-v', is_flag=True, help='Show extra information')
def version(verbose):
    """Prints the current version number"""
    print(Fore.BLUE + '-=' * 15)
    print(Fore.YELLOW + 'Superset ' + Fore.CYAN + '{version}'.format(
        version=config.get('VERSION_STRING')))
    print(Fore.BLUE + '-=' * 15)
    if verbose:
        print('[DB] : ' + '{}'.format(db.engine))
    print(Style.RESET_ALL)


def load_examples_run(load_test_data):
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
    data.load_multiformat_time_series()

    print('Loading [Paris GeoJson]')
    data.load_paris_iris_geojson()

    print('Loading [San Francisco population polygons]')
    data.load_sf_population_polygons()

    print('Loading [Flights data]')
    data.load_flights()

    print('Loading [BART lines]')
    data.load_bart_lines()

    print('Loading [Multi Line]')
    data.load_multi_line()

    print('Loading [Misc Charts] dashboard')
    data.load_misc_dashboard()

    if load_test_data:
        print('Loading [Unicode test data]')
        data.load_unicode_test_data()

    print('Loading DECK.gl demo')
    data.load_deck_dash()


@app.cli.command()
@click.option('--load-test-data', '-t', is_flag=True, help='Load additional test data')
def load_examples(load_test_data):
    """Loads a set of Slices and Dashboards and a supporting dataset """
    load_examples_run(load_test_data)


@app.cli.command()
@click.option('--datasource', '-d', help='Specify which datasource name to load, if '
                                         'omitted, all datasources will be refreshed')
@click.option('--merge', '-m', is_flag=True, default=False,
              help='Specify using \'merge\' property during operation. '
                   'Default value is False.')
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


@app.cli.command()
@click.option(
    '--path', '-p',
    help='Path to a single JSON file or path containing multiple JSON files'
         'files to import (*.json)')
@click.option(
    '--recursive', '-r',
    help='recursively search the path for json files')
def import_dashboards(path, recursive=False):
    """Import dashboards from JSON"""
    p = Path(path)
    files = []
    if p.is_file():
        files.append(p)
    elif p.exists() and not recursive:
        files.extend(p.glob('*.json'))
    elif p.exists() and recursive:
        files.extend(p.rglob('*.json'))
    for f in files:
        logging.info('Importing dashboard from file %s', f)
        try:
            with f.open() as data_stream:
                dashboard_import_export.import_dashboards(
                    db.session, data_stream)
        except Exception as e:
            logging.error('Error when importing dashboard from file %s', f)
            logging.error(e)


@app.cli.command()
@click.option(
    '--dashboard-file', '-f', default=None,
    help='Specify the the file to export to')
@click.option(
    '--print_stdout', '-p',
    help='Print JSON to stdout')
def export_dashboards(print_stdout, dashboard_file):
    """Export dashboards to JSON"""
    data = dashboard_import_export.export_dashboards(db.session)
    if print_stdout or not dashboard_file:
        print(data)
    if dashboard_file:
        logging.info('Exporting dashboards to %s', dashboard_file)
        with open(dashboard_file, 'w') as data_stream:
            data_stream.write(data)


@app.cli.command()
@click.option(
    '--path', '-p',
    help='Path to a single YAML file or path containing multiple YAML '
         'files to import (*.yaml or *.yml)')
@click.option(
    '--sync', '-s', 'sync', default='',
    help='comma seperated list of element types to synchronize '
         'e.g. "metrics,columns" deletes metrics and columns in the DB '
         'that are not specified in the YAML file')
@click.option(
    '--recursive', '-r',
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
                dict_import_export.import_from_dict(
                    db.session,
                    yaml.safe_load(data_stream),
                    sync=sync_array)
        except Exception as e:
            logging.error('Error when importing datasources from file %s', f)
            logging.error(e)


@app.cli.command()
@click.option(
    '--datasource-file', '-f', default=None,
    help='Specify the the file to export to')
@click.option(
    '--print_stdout', '-p',
    help='Print YAML to stdout')
@click.option(
    '--back-references', '-b',
    help='Include parent back references')
@click.option(
    '--include-defaults', '-d',
    help='Include fields containing defaults')
def export_datasources(print_stdout, datasource_file,
                       back_references, include_defaults):
    """Export datasources to YAML"""
    data = dict_import_export.export_to_dict(
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


@app.cli.command()
@click.option(
    '--back-references', '-b',
    help='Include parent back references')
def export_datasource_schema(back_references):
    """Export datasource YAML schema to stdout"""
    data = dict_import_export.export_schema_to_dict(
        back_references=back_references)
    yaml.safe_dump(data, stdout, default_flow_style=False)


@app.cli.command()
def update_datasources_cache():
    """Refresh sqllab datasources cache"""
    from superset.models.core import Database
    for database in db.session.query(Database).all():
        if database.allow_multi_schema_metadata_fetch:
            print('Fetching {} datasources ...'.format(database.name))
            try:
                database.all_table_names_in_database(
                    force=True, cache=True, cache_timeout=24 * 60 * 60)
                database.all_view_names_in_database(
                    force=True, cache=True, cache_timeout=24 * 60 * 60)
            except Exception as e:
                print('{}'.format(str(e)))


@app.cli.command()
@click.option(
    '--workers', '-w',
    type=int,
    help='Number of celery server workers to fire up')
def worker(workers):
    """Starts a Superset worker for async SQL query execution."""
    logging.info(
        "The 'superset worker' command is deprecated. Please use the 'celery "
        "worker' command instead.")
    if workers:
        celery_app.conf.update(CELERYD_CONCURRENCY=workers)
    elif config.get('SUPERSET_CELERY_WORKERS'):
        celery_app.conf.update(
            CELERYD_CONCURRENCY=config.get('SUPERSET_CELERY_WORKERS'))

    worker = celery_app.Worker(optimization='fair')
    worker.start()


@app.cli.command()
@click.option(
    '-p', '--port',
    default='5555',
    help='Port on which to start the Flower process')
@click.option(
    '-a', '--address',
    default='localhost',
    help='Address on which to run the service')
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
    logging.info(
        "The 'superset flower' command is deprecated. Please use the 'celery "
        "flower' command instead.")
    print(Fore.GREEN + 'Starting a Celery Flower instance')
    print(Fore.BLUE + '-=' * 40)
    print(Fore.YELLOW + cmd)
    print(Fore.BLUE + '-=' * 40)
    Popen(cmd, shell=True).wait()


@app.cli.command()
def load_test_users():
    """
    Loads admin, alpha, and gamma user for testing purposes

    Syncs permissions for those users/roles
    """
    print(Fore.GREEN + 'Loading a set of users for unit tests')
    load_test_users_run()


def load_test_users_run():
    """
    Loads admin, alpha, and gamma user for testing purposes

    Syncs permissions for those users/roles
    """
    if config.get('TESTING'):
        security_manager.sync_role_definitions()
        gamma_sqllab_role = security_manager.add_role('gamma_sqllab')
        for perm in security_manager.find_role('Gamma').permissions:
            security_manager.add_permission_role(gamma_sqllab_role, perm)
        utils.get_or_create_main_db()
        db_perm = utils.get_main_database(security_manager.get_session).perm
        security_manager.merge_perm('database_access', db_perm)
        db_pvm = security_manager.find_permission_view_menu(
            view_menu_name=db_perm, permission_name='database_access')
        gamma_sqllab_role.permissions.append(db_pvm)
        for perm in security_manager.find_role('sql_lab').permissions:
            security_manager.add_permission_role(gamma_sqllab_role, perm)

        admin = security_manager.find_user('admin')
        if not admin:
            security_manager.add_user(
                'admin', 'admin', ' user', 'admin@fab.org',
                security_manager.find_role('Admin'),
                password='general')

        gamma = security_manager.find_user('gamma')
        if not gamma:
            security_manager.add_user(
                'gamma', 'gamma', 'user', 'gamma@fab.org',
                security_manager.find_role('Gamma'),
                password='general')

        gamma2 = security_manager.find_user('gamma2')
        if not gamma2:
            security_manager.add_user(
                'gamma2', 'gamma2', 'user', 'gamma2@fab.org',
                security_manager.find_role('Gamma'),
                password='general')

        gamma_sqllab_user = security_manager.find_user('gamma_sqllab')
        if not gamma_sqllab_user:
            security_manager.add_user(
                'gamma_sqllab', 'gamma_sqllab', 'user', 'gamma_sqllab@fab.org',
                gamma_sqllab_role, password='general')

        alpha = security_manager.find_user('alpha')
        if not alpha:
            security_manager.add_user(
                'alpha', 'alpha', 'user', 'alpha@fab.org',
                security_manager.find_role('Alpha'),
                password='general')
        security_manager.get_session.commit()
