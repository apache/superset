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
import json
import os

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
