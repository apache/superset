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
from datetime import datetime
from io import BytesIO
import json
import os
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


def get_examples_uris(repo_name, tag):
    """Given a full Github repo name return the base urls to the contents and blog APIs"""
    contents_uri = f'https://api.github.com/repos/{repo_name}/contents/?ref={tag}'
    blob_uri = f'https://github.com/{repo_name}/blob/{tag}/'
    return contents_uri, blob_uri


def get_example_data(filepath, is_gzip=True, make_bytes=False):
    examples_repos_uris = \
        [get_examples_uris(r[0], r[1]) for r in config.get('EXAMPLE_REPOS_TAGS')]
    contents_uri, blob_uri = examples_repos_uris[0]
    content = requests.get(f'{blob_uri}/{filepath}?raw=true').content
    if is_gzip:
        content = zlib.decompress(content, zlib.MAX_WBITS | 16)
    if make_bytes:
        content = BytesIO(content)
    return content


def get_examples_file_list(examples_repos_uris, examples_tag='master'):
    """Use the Github get contents API to list available examples"""
    examples = []

    for (repo_name, repo_tag, contents_uri, blob_uri) in examples_repos_uris:

        # Github authentication via a Personal Access Token for rate limit problems
        headers = None
        token = config.get('GITHUB_AUTH_TOKEN')
        if token:
            headers = {'Authorization': 'token %s' % token}

        content = json.loads(requests.get(contents_uri, headers=headers).content)
        dirs = [x for x in content if x['type'] == 'dir']  # examples are in sub-dirs

        for _dir in dirs:
            link = _dir['_links']['self']
            sub_content = json.loads(requests.get(link, headers=headers).content)
            dashboard_info = list(filter(
                lambda x: x['name'] == 'dashboard.json', sub_content))[0]
            data_files = list(filter(
                lambda x: x['name'].endswith('.csv.gz'), sub_content))
            examples.append({
                'repo_name': repo_name,
                'repo_tag': repo_tag,
                'metadata_file': dashboard_info,
                'data_files': data_files,
            })

    return examples


def list_examples_table(examples_repo, examples_tag='master'):
    """Turn a list of available examples into a PrettyTable"""
    # Write a pretty table to stdout
    t = PrettyTable(field_names=['Title', 'Description', 'Size (MB)', 'Rows',
                                 'Files', 'Created Date', 'Repository', 'Tag'])

    # Optionally replace the default examples repo with a specified one
    examples_repos_uris = [(r[0], r[1]) + get_examples_uris(r[0], r[1])
                           for r in config.get('EXAMPLE_REPOS_TAGS')]

    # Replace the configured repos with the examples repo specified
    if examples_repo:
        examples_repos_uris = [
            (examples_repo,
             examples_tag) +
            get_examples_uris(examples_repo, examples_tag),
        ]

    file_info_list = get_examples_file_list(examples_repos_uris)

    def shorten(val, length):
        result = val
        if len(val) > length:
            result = val[0:length] + '...'
        return result

    def date_format(iso_date):
        dt = datetime.strptime(iso_date, '%Y-%m-%dT%H:%M:%S.%f')
        return dt.isoformat(timespec='minutes')

    for file_info in file_info_list:

        d = json.loads(
            requests.get(
                file_info['metadata_file']['download_url']).content)['description']
        row = [
            d['title'],
            shorten(d['description'], 50),
            d['total_size_mb'],
            d['total_rows'],
            d['file_count'],
            date_format(d['created_at']),
            shorten(file_info['repo_name'], 30),
            shorten(file_info['repo_tag'], 20),
        ]
        t.add_row(row)

    return t
