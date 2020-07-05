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
import json
import logging
import time
from datetime import datetime
from io import BytesIO
from typing import Any, Dict, Optional

from flask_babel import lazy_gettext as _
from sqlalchemy.orm import Session

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.exceptions import DashboardImportException
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice

logger = logging.getLogger(__name__)


def decode_dashboards(  # pylint: disable=too-many-return-statements
    o: Dict[str, Any]
) -> Any:
    """
    Function to be passed into json.loads obj_hook parameter
    Recreates the dashboard object from a json representation.
    """
    from superset.connectors.druid.models import (
        DruidCluster,
        DruidColumn,
        DruidDatasource,
        DruidMetric,
    )

    if "__Dashboard__" in o:
        return Dashboard(**o["__Dashboard__"])
    if "__Slice__" in o:
        return Slice(**o["__Slice__"])
    if "__TableColumn__" in o:
        return TableColumn(**o["__TableColumn__"])
    if "__SqlaTable__" in o:
        return SqlaTable(**o["__SqlaTable__"])
    if "__SqlMetric__" in o:
        return SqlMetric(**o["__SqlMetric__"])
    if "__DruidCluster__" in o:
        return DruidCluster(**o["__DruidCluster__"])
    if "__DruidColumn__" in o:
        return DruidColumn(**o["__DruidColumn__"])
    if "__DruidDatasource__" in o:
        return DruidDatasource(**o["__DruidDatasource__"])
    if "__DruidMetric__" in o:
        return DruidMetric(**o["__DruidMetric__"])
    if "__datetime__" in o:
        return datetime.strptime(o["__datetime__"], "%Y-%m-%dT%H:%M:%S")

    return o


def import_dashboards(
    session: Session,
    data_stream: BytesIO,
    database_id: Optional[int] = None,
    import_time: Optional[int] = None,
) -> None:
    """Imports dashboards from a stream to databases"""
    current_tt = int(time.time())
    import_time = current_tt if import_time is None else import_time
    data = json.loads(data_stream.read(), object_hook=decode_dashboards)
    if not data:
        raise DashboardImportException(_("No data in file"))
    for table in data["datasources"]:
        type(table).import_obj(table, database_id, import_time=import_time)
    session.commit()
    for dashboard in data["dashboards"]:
        Dashboard.import_obj(dashboard, import_time=import_time)
    session.commit()


def export_dashboards(session: Session) -> str:
    """Returns all dashboards metadata as a json dump"""
    logger.info("Starting export")
    dashboards = session.query(Dashboard)
    dashboard_ids = []
    for dashboard in dashboards:
        dashboard_ids.append(dashboard.id)
    data = Dashboard.export_dashboards(dashboard_ids)
    return data
