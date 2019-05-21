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
"""Loads datasets, dashboards and slices in a new superset instance"""
# pylint: disable=C,R,W
import csv
from io import BytesIO
import json
import os
import sys
import zlib

from prettytable import PrettyTable
import requests

from superset import app, db
from superset.connectors.connector_registry import ConnectorRegistry
from superset.models import core as models

# Shortcuts
DB = models.Database
Slice = models.Slice
Dash = models.Dashboard

TBL = ConnectorRegistry.sources['table']

config = app.config

BLOB_BASE_URL = f'https://github.com/rjurney/examples-data/blob/{ config.get("EXAMPLES_GIT_TAG") }/'
RAW_BASE_URL = f'https://github.com/rjurney/examples-data/raw/{ config.get("EXAMPLES_GIT_TAG") }/'
LIST_URL = f'https://api.github.com/repos/rjurney/examples-data/contents/?ref={ config.get("EXAMPLES_GIT_TAG") }'
RAW_BASE_URL = f'https://github.com/rjurney/examples-data/raw/{ config.get("EXAMPLES_GIT_TAG") }/'

DATA_FOLDER = os.path.join(config.get('BASE_DIR'), 'data')

misc_dash_slices = set()  # slices assembled in a 'Misc Chart' dashboard


def update_slice_ids(layout_dict, slices):
    charts = [
        component for component in layout_dict.values()
        if isinstance(component, dict) and component['type'] == 'CHART'
    ]
    sorted_charts = sorted(charts, key=lambda k: k['meta']['chartId'])
    for i, chart_component in enumerate(sorted_charts):
        if i < len(slices):
            chart_component['meta']['chartId'] = int(slices[i].id)


def merge_slice(slc):
    o = db.session.query(Slice).filter_by(slice_name=slc.slice_name).first()
    if o:
        db.session.delete(o)
    db.session.add(slc)
    db.session.commit()


def get_slice_json(defaults, **kwargs):
    d = defaults.copy()
    d.update(kwargs)
    return json.dumps(d, indent=4, sort_keys=True)


def get_example_data(filepath, is_gzip=True, make_bytes=False):
    content = requests.get(f'{BLOB_BASE_URL}{filepath}?raw=true').content
    if is_gzip:
        content = zlib.decompress(content, zlib.MAX_WBITS|16)
    if make_bytes:
        content = BytesIO(content)
    return content


def list_examples_table(tag='master'):
    """Use the Github Get contents API to list available examples"""
    content = json.loads(requests.get(LIST_URL).content)
    dirs = [x for x in content if x['type'] == 'dir']

    # Write CSV to stdout
    t = PrettyTable(field_names=['Title', 'Description', 'Total Size (MB)', 'Total Rows',
                                 'File Count', 'Created Date'])

    for _dir in dirs:
        link = _dir['_links']['self']
        sub_content = json.loads(requests.get(link).content)
        dashboard_info = list(filter(lambda x: x['name'] == 'dashboard.json', sub_content))[0]
        #file_urls = filter(lambda x: x['name'] != 'dashboard.json', sub_content)

        d = json.loads(requests.get(dashboard_info['download_url']).content)['description']
        t.add_row([
            d['title'], d['description'], d['total_size_mb'], d['total_rows'], 
            d['file_count'], d['created_at']])     

    return t