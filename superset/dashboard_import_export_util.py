# -*- coding: utf-8 -*-
# pylint: disable=C,R,W
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import logging
import time
import json

from superset import utils
from superset.models.core import Dashboard

def import_dashboards(session, data_stream):
    """Imports dashboards"""
    current_tt = int(time.time())
    data = json.loads(data_stream.read(), object_hook=utils.decode_dashboards)
    # TODO: import DRUID datasources
    for table in data['datasources']:
        type(table).import_obj(table, import_time=current_tt)
    session.commit()
    for dashboard in data['dashboards']:
        Dashboard.import_obj(
            dashboard, import_time=current_tt)
    session.commit()

def export_dashboards(session):
  logging.info('Starting export')
  dashboards = session.query(Dashboard)
  dashboard_ids = [] 
  for dashboard in dashboards:
      dashboard_ids.append(dashboard.id)
  data = Dashboard.export_dashboards(dashboard_ids)
  logging.info('Starting export %s', data)
  return data