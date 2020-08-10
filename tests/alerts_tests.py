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
"""Unit tests for alerting in Superset"""
import logging
from unittest.mock import patch

import pytest

from superset import db
from superset.models.alerts import Alert, AlertLog
from superset.models.schedules import ScheduleType
from superset.models.slice import Slice
from superset.tasks.schedules import run_alert_query, schedule_alert_query
from superset.utils import core as utils
from tests.test_app import app

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@pytest.yield_fixture(scope="module")
def setup_database():
    with app.app_context():
        slice_id = db.session.query(Slice).all()[0].id
        database_id = utils.get_example_database().id

        alerts = [
            Alert(
                id=1,
                label="alert_1",
                active=True,
                crontab="*/1 * * * *",
                sql="SELECT 0",
                alert_type="email",
                slice_id=slice_id,
                database_id=database_id,
            ),
            Alert(
                id=2,
                label="alert_2",
                active=True,
                crontab="*/1 * * * *",
                sql="SELECT 55",
                alert_type="email",
                slice_id=slice_id,
                database_id=database_id,
            ),
            Alert(
                id=3,
                label="alert_3",
                active=False,
                crontab="*/1 * * * *",
                sql="UPDATE 55",
                alert_type="email",
                slice_id=slice_id,
                database_id=database_id,
            ),
            Alert(id=4, active=False, label="alert_4", database_id=-1),
            Alert(id=5, active=False, label="alert_5", database_id=database_id),
        ]

        db.session.bulk_save_objects(alerts)
        db.session.commit()
        yield db.session

        db.session.query(AlertLog).delete()
        db.session.query(Alert).delete()


@patch("superset.tasks.schedules.deliver_alert")
@patch("superset.tasks.schedules.logging.Logger.error")
def test_run_alert_query(mock_error, mock_deliver_alert, setup_database):
    dbsession = setup_database

    # Test passing alert with null SQL result
    alert1 = dbsession.query(Alert).filter_by(id=1).one()
    run_alert_query(alert1.id, alert1.database_id, alert1.sql, alert1.label)
    assert mock_deliver_alert.call_count == 0
    assert mock_error.call_count == 0

    # Test passing alert with True SQL result
    alert2 = dbsession.query(Alert).filter_by(id=2).one()
    run_alert_query(alert2.id, alert2.database_id, alert2.sql, alert2.label)
    assert mock_deliver_alert.call_count == 1
    assert mock_error.call_count == 0

    # Test passing alert with error in SQL query
    alert3 = dbsession.query(Alert).filter_by(id=3).one()
    run_alert_query(alert3.id, alert3.database_id, alert3.sql, alert3.label)
    assert mock_deliver_alert.call_count == 1
    assert mock_error.call_count == 2

    # Test passing alert with invalid database
    alert4 = dbsession.query(Alert).filter_by(id=4).one()
    run_alert_query(alert4.id, alert4.database_id, alert4.sql, alert4.label)
    assert mock_deliver_alert.call_count == 1
    assert mock_error.call_count == 3

    # Test passing alert with no SQL statement
    alert5 = dbsession.query(Alert).filter_by(id=5).one()
    run_alert_query(alert5.id, alert5.database_id, alert5.sql, alert5.label)
    assert mock_deliver_alert.call_count == 1
    assert mock_error.call_count == 4


@patch("superset.tasks.schedules.deliver_alert")
@patch("superset.tasks.schedules.run_alert_query")
def test_schedule_alert_query(mock_run_alert, mock_deliver_alert, setup_database):
    dbsession = setup_database
    active_alert = dbsession.query(Alert).filter_by(id=1).one()
    inactive_alert = dbsession.query(Alert).filter_by(id=3).one()

    # Test that inactive alerts are no processed
    schedule_alert_query(report_type=ScheduleType.alert, schedule_id=inactive_alert.id)
    assert mock_run_alert.call_count == 0
    assert mock_deliver_alert.call_count == 0

    # Test that active alerts with no recipients passed in are processed regularly
    schedule_alert_query(report_type=ScheduleType.alert, schedule_id=active_alert.id)
    assert mock_run_alert.call_count == 1
    assert mock_deliver_alert.call_count == 0

    # Test that active alerts sent as a test are delivered immediately
    schedule_alert_query(
        report_type=ScheduleType.alert,
        schedule_id=active_alert.id,
        recipients="testing@email.com",
        is_test_alert=True,
    )
    assert mock_run_alert.call_count == 1
    assert mock_deliver_alert.call_count == 1
