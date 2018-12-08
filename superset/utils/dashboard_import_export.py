# pylint: disable=C,R,W
import json
import logging
import time

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


def export_dashboards(session):
    """Returns all dashboards metadata as a json dump"""
    logging.info('Starting export')
    dashboards = session.query(Dashboard)
    dashboard_ids = []
    for dashboard in dashboards:
        dashboard_ids.append(dashboard.id)
    data = Dashboard.export_dashboards(dashboard_ids)
    return data
