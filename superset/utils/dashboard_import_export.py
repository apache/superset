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
import json
import logging
import os
import re
import shutil
import tempfile
import time

from flask_appbuilder import Model
import pandas as pd
import requests
from sqlalchemy import Column, Integer
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm.exc import NoResultFound

from superset import app, db
from superset.connectors.connector_registry import ConnectorRegistry
from superset.exceptions import DashboardNotFoundException, SupersetException
from superset.models.core import Dashboard, Database
from superset.utils.core import (
    decode_dashboards, get_or_create_main_db,
)


def import_dashboard(session, data, import_time):
    """Import a Dashboard from exported data"""
    for dashboard in data['dashboards']:
        Dashboard.import_obj(
            dashboard, import_time=import_time)


def import_datasources(data, import_time, substitute_db_name=None):
    """Import any data sources in Dashboard file"""
    for table in data['datasources']:
        if table.type == 'table':
            type(table).import_obj(table, import_time=import_time,
                                   substitute_db_name=substitute_db_name)
        else:
            raise SupersetException('Druid datasources not supported!')


def table_to_sql(path, table_name, engine):
    """Take a file and load it into a table"""
    logging.info(f'Import data from file {path} into table {table_name}')

    try:
        df = pd.read_csv(path, parse_dates=True, infer_datetime_format=True, 
                         compression='infer')
        df.to_sql(
            table_name,
            engine.get_sqla_engine(),
            if_exists='replace',
            chunksize=500,
            index=False)
    except (pd.errors.ParserError, pd.errors.OutOfBoundsDatetime, 
            pd.errors.EmptyDataError) as e:
        logging.exception(e)
        raise SupersetException('Error reading table into database!')


def import_files_to_table(data, is_example=False, data_blob_urls=None):
    """Import any files in this exported Dashboard"""
    if isinstance(data, dict) and data.get('files'):
        engine = get_or_create_main_db()

        if is_example:
            with tempfile.TemporaryDirectory() as tmpdir:
                for file_info in data['files']:

                    # Get the github info for the file
                    blob_file_path = f'{tmpdir}{os.path.sep}{file_info["file_name"]}'
                    blob_url = data_blob_urls[file_info['file_name']]

                    response = requests.get(blob_url, stream=True)
                    with open(blob_file_path, 'wb') as out_file:
                        shutil.copyfileobj(response.raw, out_file)
                    del response

                    table_to_sql(blob_file_path, file_info['table_name'], engine)
        else:
            for table in data['files']:
                table_to_sql(table['file_name'], table['table_name'], engine)


def import_dashboards(session, data, is_example=False, data_blob_urls=None, 
                      database_uri=None, import_time=None):
    """Imports dashboards from a stream to databases"""
    current_tt = int(time.time())
    import_time = current_tt if import_time is None else import_time

    data = json.loads(data, object_hook=decode_dashboards)

    # substitute_db_name = get_db_name(database_uri) or \
    #     get_default_example_db().database_name
    substitute_db_name = get_db_name(database_uri) if database_uri else \
        get_or_create_main_db().database_name

    import_dashboard(session, data, import_time)
    import_datasources(data, import_time, substitute_db_name=substitute_db_name)
    session.commit()

    import_files_to_table(data, is_example=True, data_blob_urls=data_blob_urls)
    session.commit()


def get_db_name(uri):
    """Get the DB name from the URI string"""
    db_name = make_url(uri).database
    if uri.startswith('sqlite'):
        db_name = re.match('(?s:.*)/(.+?).db$', db_name).group(1)
    return db_name


def get_default_example_db():
    """Get the optional substitute database for example import"""
    uri = app.config.get('SQLALCHEMY_EXAMPLES_URI')
    db_name = get_db_name(uri)

    return db.session.query(Database).filter_by(
        database_name=db_name).one()


def export_dashboards(session, dashboard_ids=None, dashboard_titles=None,
                      export_data=False, export_data_dir=None, description=None,
                      export_title=None, _license='Apache 2.0', url=None,
                      strip_database=False):
    """Returns all dashboards metadata as a json dump"""
    logging.info('Starting export')
    export_dashboard_ids = []

    session = db.session() if not session else session
    query = session.query(Dashboard)
    if dashboard_ids or dashboard_titles:
        query = query.filter(Dashboard.id.in_(dashboard_ids) |
                             Dashboard.dashboard_title.in_(dashboard_titles))

    export_dashboard_ids = [d.id for d in query.all()]

    data = {}
    if not export_dashboard_ids:
        logging.error('No dashboards found!')
        raise DashboardNotFoundException('No dashboards found!')
    else:
        data = Dashboard.export_dashboards(export_dashboard_ids,
                                           export_data, export_data_dir)

    if export_title:
        data['description']['title'] = export_title
    if description:
        data['description']['description'] = description
    if url:
        data['description']['url'] = url
    data['description']['license'] = _license

    export_json = json.dumps(data, indent=4, sort_keys=True)

    # Remove datasources[].__SqlaTable__.database for example export
    # if strip_database:
    #     parsed_json = json.loads(export_json)
    #     for datasource in parsed_json['datasources']:
    #         datasource['__SqlaTable__']['database'] = None
    #     export_json = '{}'  # json.dumps(parsed_json, indent=4, sort_keys=True)

    return export_json


def get_slug(session, dashboard_id=None, dashboard_title=None):
    """Get the slug for the name of the directory inside the tarballed example"""
    session = db.session() if not session else session
    query = session.query(Dashboard)
    slug = None
    if dashboard_id or dashboard_title:
        query = query.filter((Dashboard.id == dashboard_id) |
                             (Dashboard.dashboard_title == dashboard_title))
        dashboard = query.first()
        slug = getattr(dashboard, 'slug', None)
    return slug


def remove_dashboard(session, import_example_data, dashboard_title, database_uri=None, 
                     primary_key=Column('id', Integer, primary_key=True)):
    """Remove a dashboard based on id or title"""

    session = db.session() if not session else session
    logging.debug(session.query(Dashboard).all())

    try:
        dashboard = session.query(Dashboard).filter(
            Dashboard.dashboard_title == dashboard_title,
        ).one()

        session.delete(dashboard)
        session.commit()
    except NoResultFound:
        raise DashboardNotFoundException('Dashboard not found!')

    # Remove the associated table metadata
    SqlaTable = ConnectorRegistry.sources['table']
    for f in import_example_data['files']:
        t = session.query(SqlaTable).filter(
            SqlaTable.table_name == f['table_name']
        ).one()
        session.delete(t)
        session.commit()

        # Now delete the physical data table
        # exampled_engine = get_or_create_example_db(database_uri)
        examples_engine = get_or_create_main_db()
        sqla_engine = examples_engine.get_sqla_engine()

        # Create a model class on the fly to do a cross-platform table drop
        class DropTable(Model):
            __tablename__ = f['table_name']
            id = primary_key

        table = DropTable()
        table.__table__.drop(sqla_engine)
