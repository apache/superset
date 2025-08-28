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

import copy

from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import select

from tests.unit_tests.fixtures.assets_configs import (
    charts_config_1,
    charts_config_2,
    dashboards_config_1,
    dashboards_config_2,
    databases_config,
    datasets_config,
)

def test_import_dashboard_overwrite_charts_and_datasets(mocker: MockerFixture, session: Session) -> None:
    """
    Test that existing dashboards are overwritten.
    """
    from superset import db, security_manager
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.connectors.sqla.models import SqlaTable
    import time
    from datetime import datetime

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    Dashboard.metadata.create_all(engine)  

    #for some reason it won't allow me to reuse the same config in the second import
    #thus declaring two configs with the same content
    base_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    new_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }

    #gettings uuids
    dasboard_configs = list(dashboards_config_1.values())
    dashboard_uuid = dasboard_configs[0]["uuid"]
    chart_configs = list(charts_config_1.values())
    chart_uuid = chart_configs[0]["uuid"]
    dataset_configs = list(datasets_config.values())
    dataset_uuid = dataset_configs[0]["uuid"]

    #importing first time and retrieving initial records
    ImportDashboardsCommand._import(base_configs, overwrite=True)
    imported_dashboard = db.session.query(Dashboard).filter_by(uuid=dashboard_uuid).one()
    imported_chart = db.session.query(Slice).filter_by(uuid=chart_uuid).one()
    imported_dataset = db.session.query(SqlaTable).filter_by(uuid=dataset_uuid).one()

    #extracting changed_on field to compare later, ignoring milliseconds
    initial_dashboard_changed_on = imported_dashboard.changed_on.strftime("%Y-%m-%d %H:%M:%S")
    initial_chart_changed_on = imported_chart.changed_on.strftime("%Y-%m-%d %H:%M:%S")
    initial_dataset_changed_on = imported_dataset.changed_on.strftime("%Y-%m-%d %H:%M:%S")
   
    #ensuring the changed_on field will be different
    time.sleep(1)

    #importing second time and retrieving updated records
    ImportDashboardsCommand._import(new_configs, overwrite=True)
    imported_dashboard = db.session.query(Dashboard).filter_by(uuid=dashboard_uuid).one()
    imported_chart = db.session.query(Slice).filter_by(uuid=chart_uuid).one()
    imported_dataset = db.session.query(SqlaTable).filter_by(uuid=dataset_uuid).one()

    #extracting changed_on field to compare with the previous retrieved, ignoring milliseconds
    final_dashboard_changed_on = imported_dashboard.changed_on.strftime("%Y-%m-%d %H:%M:%S")
    final_chart_changed_on = imported_chart.changed_on.strftime("%Y-%m-%d %H:%M:%S")
    final_dataset_changed_on = imported_dataset.changed_on.strftime("%Y-%m-%d %H:%M:%S")

    #asserting the changed_on field was updated on all three records
    assert initial_dashboard_changed_on != final_dashboard_changed_on
    assert initial_chart_changed_on != final_chart_changed_on
    assert initial_dataset_changed_on != final_dataset_changed_on
    #asserting the changed_on field was updated to the same value on all three records
    assert final_dashboard_changed_on == final_chart_changed_on == final_dataset_changed_on
