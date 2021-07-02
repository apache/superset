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
import logging
import random
import string
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func

from superset import appbuilder, db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from tests.integration_tests.dashboards.consts import DEFAULT_DASHBOARD_SLUG_TO_TEST

logger = logging.getLogger(__name__)

session = appbuilder.get_session


def get_mock_positions(dashboard: Dashboard) -> Dict[str, Any]:
    positions = {"DASHBOARD_VERSION_KEY": "v2"}
    for i, slc in enumerate(dashboard.slices):
        id_ = "DASHBOARD_CHART_TYPE-{}".format(i)
        position_data: Any = {
            "type": "CHART",
            "id": id_,
            "children": [],
            "meta": {"width": 4, "height": 50, "chartId": slc.id},
        }
        positions[id_] = position_data
    return positions


def build_save_dash_parts(
    dashboard_slug: Optional[str] = None, dashboard_to_edit: Optional[Dashboard] = None
) -> Tuple[Dashboard, Dict[str, Any], Dict[str, Any]]:
    if not dashboard_to_edit:
        dashboard_slug = (
            dashboard_slug if dashboard_slug else DEFAULT_DASHBOARD_SLUG_TO_TEST
        )
        dashboard_to_edit = get_dashboard_by_slug(dashboard_slug)

    data_before_change = {
        "positions": dashboard_to_edit.position,
        "dashboard_title": dashboard_to_edit.dashboard_title,
    }
    data_after_change = {
        "css": "",
        "expanded_slices": {},
        "positions": get_mock_positions(dashboard_to_edit),
        "dashboard_title": dashboard_to_edit.dashboard_title,
    }
    return dashboard_to_edit, data_before_change, data_after_change


def get_all_dashboards() -> List[Dashboard]:
    return db.session.query(Dashboard).all()


def get_dashboard_by_slug(dashboard_slug: str) -> Dashboard:
    return db.session.query(Dashboard).filter_by(slug=dashboard_slug).first()


def get_slice_by_name(slice_name: str) -> Slice:
    return db.session.query(Slice).filter_by(slice_name=slice_name).first()


def get_sql_table_by_name(table_name: str):
    return db.session.query(SqlaTable).filter_by(table_name=table_name).one()


def count_dashboards() -> int:
    return db.session.query(func.count(Dashboard.id)).first()[0]


def random_title():
    return f"title{random_str()}"


def random_slug():
    return f"slug{random_str()}"


def get_random_string(length):
    letters = string.ascii_lowercase
    result_str = "".join(random.choice(letters) for i in range(length))
    print("Random string of length", length, "is:", result_str)
    return result_str


def random_str():
    return get_random_string(8)


def grant_access_to_dashboard(dashboard, role_name):
    role = security_manager.find_role(role_name)
    dashboard.roles.append(role)
    db.session.merge(dashboard)
    db.session.commit()


def revoke_access_to_dashboard(dashboard, role_name):
    role = security_manager.find_role(role_name)
    dashboard.roles.remove(role)
    db.session.merge(dashboard)
    db.session.commit()
