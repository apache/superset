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
import time

from superset import db
from superset.exceptions import DashboardNotFoundException
from superset.models.core import Dashboard
from superset.utils.core import decode_dashboards


def import_dashboards(session, data_stream, import_time=None):
    """Imports dashboards from a stream to databases"""
    current_tt = int(time.time())
    import_time = current_tt if import_time is None else import_time
    data = json.loads(data_stream.read(), object_hook=decode_dashboards)
    # TODO: import DRUID datasources
    for table in data['datasources']:
        type(table).import_obj(table, import_time=import_time)
    session.commit()
    for dashboard in data['dashboards']:
        Dashboard.import_obj(
            dashboard, import_time=import_time)
    session.commit()


def export_dashboards(session, dashboard_ids=None, dashboard_titles=None):
    """Returns all dashboards metadata as a json dump"""
    logging.info('Starting export')
    export_dashboard_ids = []

    session = db.session()
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
        data = Dashboard.export_dashboards(export_dashboard_ids)
    return data
