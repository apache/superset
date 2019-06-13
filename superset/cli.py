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
from datetime import datetime
import json
import logging
from subprocess import Popen
from sys import exit, stdout
import tarfile
import tempfile

import click
from colorama import Fore, Style
from pathlib2 import Path
import requests
import yaml

from superset import (
    app, appbuilder, data, db, security_manager,
)
from superset.data.helpers import (
    download_url_to_blob_url, get_examples_file_list, get_examples_uris, 
    list_examples_table,
)
from superset.exceptions import DashboardNotFoundException, ExampleNotFoundException
from superset.utils import (
    core as utils, dashboard_import_export, dict_import_export,
)

logging.getLogger('urllib3').setLevel(logging.WARNING)

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
    utils.get_or_create_db_by_name(db_name='main')
    # utils.get_or_create_db_by_name(db_name='examples')
    appbuilder.add_permissions(update_perms=True)
    security_manager.sync_role_definitions()


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

    print('Loading [Unicode test data]')
    data.load_unicode_test_data()

    if not load_test_data:
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

        print('Loading DECK.gl demo')
        data.load_deck_dash()

    print('Loading [Tabbed dashboard]')
    data.load_tabbed_dashboard()


@app.cli.command()
@click.option('--load-test-data', '-t', is_flag=True, help='Load additional test data')
def load_examples(load_test_data):
    """Loads a set of charts and dashboards and a supporting dataset"""
    load_examples_run(load_test_data)


def exclusive(ctx_params, exclusive_params, error_message):
    """Provide exclusive option grouping"""
    if sum([1 if ctx_params[p] else 0 for p in exclusive_params]) > 1:
        raise click.UsageError(error_message)


@app.cli.group()
def examples():
    """Manages example dashboards/datasets"""
    pass


@examples.command('export')
@click.option(
    '--dashboard-id', '-i', default=None, type=int,
    help='Specify a single dashboard id to export')
@click.option(
    '--dashboard-title', '-t', default=None,
    help='Specify a single dashboard title to export')
@click.option(
    '--description', '-d', help='Description of new example', required=True)
@click.option(
    '--example-title', '-e', help='Title for new example', required=False)
@click.option(
    '--file-name', '-f', default='dashboard.tar.gz',
    help='Specify export file name. Defaults to dashboard.tar.gz')
@click.option(
    '--license', '-l', '_license', default='Apache 2.0',
    help='License of the example dashboard')
@click.option(
    '--url', '-u', default=None, help='URL of dataset home page')
def export_example(dashboard_id, dashboard_title, description, example_title,
                   file_name, _license, url):
    """Export example dashboard/datasets tarball"""
    if not (dashboard_id or dashboard_title):
        raise click.UsageError('must supply --dashboard-id/-i or --dashboard-title/-t')
    exclusive(
        click.get_current_context().params,
        ['dashboard_id', 'dashboard_title'],
        'options --dashboard-id/-i and --dashboard-title/-t mutually exclusive')

    # Export into a temporary directory and then tarball that directory
    with tempfile.TemporaryDirectory() as tmp_dir_name:

        try:
            data = dashboard_import_export.export_dashboards(
                db.session,
                dashboard_ids=[dashboard_id],
                dashboard_titles=[dashboard_title],
                export_data=True,
                export_data_dir=tmp_dir_name,
                description=description,
                export_title=example_title or dashboard_title,
                _license=_license,
                url=url,
                strip_database=True)

            dashboard_slug = dashboard_import_export.get_slug(
                db.session,
                dashboard_id=dashboard_id,
                dashboard_title=dashboard_title)

            out_path = f'{tmp_dir_name}/dashboard.json'

            with open(out_path, 'w') as data_stream:
                data_stream.write(data)

            with tarfile.open(file_name, 'w:gz') as tar:
                tar.add(tmp_dir_name, arcname=f'{dashboard_slug}')

            click.secho(str(f'Exported example to {file_name}'), fg='blue')

        except DashboardNotFoundException as e:
            click.secho(str(e), fg='red')
            exit(1)


@examples.command('list')
@click.option(
    '--examples-repo', '-r',
    help="Full name of Github repository containing examples, ex: " + 
         "'apache-superset/examples-data'",
    default=None)
@click.option(
    '--examples-tag', '-r',
    help="Tag or branch of Github repository containing examples. Defaults to 'master'",
    default='master')
@click.option(
    '--full-fields', '-ff', is_flag=True, default=False, help='Print full length fields')
def _list_examples(examples_repo, examples_tag, full_fields):
    """List example dashboards/datasets"""
    click.echo(
        list_examples_table(examples_repo, examples_tag=examples_tag,
                            full_fields=full_fields))


@examples.command('import')
@click.option(
    '--database-uri', '-d', help='Database URI to import example to',
    default=config.get('SQLALCHEMY_EXAMPLES_URI'))
@click.option(
    '--examples-repo', '-r',
    help="Full name of Github repository containing examples, ex: " +
         "'apache-superset/examples-data'",
    default=None)
@click.option(
    '--examples-tag', '-r',
    help="Tag or branch of Github repository containing examples. Defaults to 'master'",
    default='master')
@click.option(
    '--example-title', '-e', help='Title of example to import', required=True)
def import_example(example_title, examples_repo, examples_tag, database_uri):
    """Import an example dashboard/dataset"""

    # First fetch the example information from Github
    examples_repos = [(examples_repo, examples_tag)] \
        if examples_repo else config.get('EXAMPLE_REPOS_TAGS')
    examples_repos_uris = [(r[0], r[1]) + get_examples_uris(r[0], r[1])
                           for r in examples_repos]
    examples_files = get_examples_file_list(examples_repos_uris)

    # Github authentication via a Personal Access Token for rate limit problems
    headers = None
    token = config.get('GITHUB_AUTH_TOKEN')
    if token:
        headers = {'Authorization': 'token %s' % token}

    import_example_json = None
    import_data_info = None
    for example_file in examples_files:

        metadata_download_url = example_file['metadata_file']['download_url']
        example_metadata_json = requests.get(metadata_download_url, 
                                             headers=headers).content
        # Cheaply load json without generating objects
        example_metadata = json.loads(example_metadata_json)
        if example_metadata['description']['title'] == example_title:
            import_example_json = example_metadata_json
            import_data_info = example_file['data_files']
            logging.info(
                f"Will import example '{example_title}' from {metadata_download_url}")
            break

    if not import_example_json:
        e = ExampleNotFoundException(f'Example {example_title} not found!')
        click.secho(str(e), fg='red')
        exit(1)

    # Parse data to get file download_urls -> blob_urls
    example_metadata = json.loads(import_example_json, 
                                  object_hook=utils.decode_dashboards)

    # The given download url won't work for data files, need a blob url
    data_blob_urls = {}
    for ex_file in example_metadata['files']:
        github_info = [t for t in import_data_info
                       if t['name'] == ex_file['file_name']][0]
        blob_url = download_url_to_blob_url(github_info['download_url'])
        data_blob_urls[github_info['name']] = blob_url

    try:
        dashboard_import_export.import_dashboards(
            db.session,
            import_example_json,
            is_example=True,
            data_blob_urls=data_blob_urls,
            database_uri=database_uri)
    except Exception as e:
        logging.error(f"Error importing example dashboard '{example_title}'!")
        logging.exception(e)


@examples.command('remove')
@click.option(
    '--example-title', '-e', help='Title of example to remove', required=True)
@click.option(
    '--database-uri', '-d', help='Database URI to remove example from',
    default=config.get('SQLALCHEMY_EXAMPLES_URI'))
@click.option(
    '--examples-repo', '-r',
    help="Full name of Github repository containing examples, ex: " + 
         "'apache-superset/examples-data'",
    default=None)
@click.option(
    '--examples-tag', '-r',
    help="Tag or branch of Github repository containing examples. Defaults to 'master'",
    default='master')
def remove_example(example_title, database_uri, examples_repo, examples_tag):
    """Remove an example dashboard/dataset"""

    # First fetch the example information from Github
    examples_repos = [(examples_repo, examples_tag)] \
        if examples_repo else config.get('EXAMPLE_REPOS_TAGS')
    examples_repos_uris = [(r[0], r[1]) + get_examples_uris(r[0], r[1])
                           for r in examples_repos]
    examples_files = get_examples_file_list(examples_repos_uris)

    # Github authentication via a Personal Access Token for rate limit problems
    headers = None
    token = config.get('GITHUB_AUTH_TOKEN')
    if token:
        headers = {'Authorization': 'token %s' % token}

    # temporary - substitute url provided
    db_name = 'superset'

    import_example_data = None
    for example_file in examples_files:

        metadata_download_url = example_file['metadata_file']['download_url']
        example_metadata_json = requests.get(metadata_download_url,
                                             headers=headers).content
        # Cheaply load json without generating objects
        example_metadata = json.loads(example_metadata_json)
        if example_metadata['description']['title'] == example_title:
            import_example_data = json.loads(example_metadata_json)
            logging.info(
                f"Will remove example '{example_title}' from '{db_name}'")
            break

    logging.debug(import_example_data['files'])

    # Get the dashboard and associated records
    dashboard_title = \
        import_example_data['dashboards'][0]['__Dashboard__']['dashboard_title']
    logging.debug(f'Got dashboard title {dashboard_title} for removal...')

    utils.get_or_create_db_by_name(db_name='main')
    session = db.session()

    try:
        dashboard_import_export.remove_dashboard(
            session,
            import_example_data,
            dashboard_title,
            database_uri=database_uri
        )
    except DashboardNotFoundException as e:
        logging.exception(e)
        click.secho(
            f'Example {example_title} associated dashboard {dashboard_title} not found!',
            fg='red')


@app.cli.command()
@click.option('--datasource', '-d', help='Specify which datasource name to load, if '
                                         'omitted, all datasources will be refreshed')
@click.option('--merge', '-m', is_flag=True, default=False,
              help="Specify using 'merge' property during operation. "
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
    '--path', '-p', required=True,
    help='Path to a single JSON file or path containing multiple JSON files'
         'files to import (*.json)')
@click.option(
    '--recursive', '-r', is_flag=True, default=False,
    help='recursively search the path for json files')
def import_dashboards(path, recursive):
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
                    db.session, data_stream.read())
        except Exception as e:
            logging.error('Error when importing dashboard from file %s', f)
            logging.error(e)


@app.cli.command()
@click.option(
    '--dashboard-file', '-f', default=None,
    help='Specify the the file to export to')
@click.option(
    '--print_stdout', '-p', is_flag=True, default=False,
    help='Print JSON to stdout')
@click.option(
    '--dashboard-ids', '-i', default=None, type=int, multiple=True,
    help='Specify dashboard id to export')
@click.option(
    '--dashboard-titles', '-t', default=None, multiple=True,
    help='Specify dashboard title to export')
@click.option(
    '--export-data', '-x', default=None, is_flag=True,
    help="Export the dashboard's data tables as CSV files.")
@click.option(
    '--export-data-dir', '-d', default=config.get('DASHBOARD_EXPORT_DIR'),
    help="Specify export directory path. Defaults to '/tmp'")
def export_dashboards(print_stdout, dashboard_file, dashboard_ids,
                      dashboard_titles, export_data, export_data_dir):
    """Export dashboards to JSON and optionally tables to CSV"""
    try:
        data = dashboard_import_export.export_dashboards(
            db.session,
            dashboard_ids=dashboard_ids,
            dashboard_titles=dashboard_titles,
            export_data=export_data,
            export_data_dir=export_data_dir)
    except DashboardNotFoundException as e:
        click.secho(str(e), fg='red')
        exit(1)
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
    '--recursive', '-r', is_flag=True, default=False,
    help='recursively search the path for yaml files')
def import_datasources(path, sync, recursive):
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
    '--print_stdout', '-p', is_flag=True, default=False,
    help='Print YAML to stdout')
@click.option(
    '--back-references', '-b', is_flag=True, default=False,
    help='Include parent back references')
@click.option(
    '--include-defaults', '-d', is_flag=True, default=False,
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
    '--back-references', '-b', is_flag=True, default=False,
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
                database.get_all_table_names_in_database(
                    force=True, cache=True, cache_timeout=24 * 60 * 60)
                database.get_all_view_names_in_database(
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
        f'--broker={BROKER_URL} '
        f'--port={port} '
        f'--address={address} '
    )
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
        utils.get_or_create_db_by_name(db_name='main')
        db_perm = utils.get_main_database(security_manager.get_session).perm
        security_manager.add_permission_view_menu('database_access', db_perm)
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
