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
from superset.models.alerts import (
    Alert,
    AlertLog,
    AlertValidatorType,
    SQLObservation,
    SQLObserver,
    Validator,
)
from superset.models.schedules import ScheduleType
from superset.models.slice import Slice
from superset.tasks.schedules import (
    AlertState,
    check_alert,
    deliver_alert,
    observe,
    schedule_alert_query,
)
from superset.utils import core as utils
from tests.test_app import app
from tests.utils import read_fixture

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@pytest.yield_fixture(scope="module")
def setup_database():
    with app.app_context():
        slice_id = db.session.query(Slice).all()[0].id
        database = utils.get_example_database()
        database_id = database.id
        database.get_sqla_engine().execute("CREATE TABLE test_table AS SELECT 2 as id")

        common_data = dict(
            active=True,
            crontab="* * * * *",
            slice_id=slice_id,
            recipients="recipient1@superset.com",
            slack_channel="#test_channel",
        )
        alerts = [
            Alert(**common_data, id=1, label="alert_1"),
            Alert(**common_data, id=2, label="alert_2"),
            Alert(**common_data, id=3, label="alert_3"),
            Alert(**common_data, id=4, label="alert_4"),
            Alert(id=5, crontab="* * * * *", active=False, label="alert_5"),
            Alert(id=6, crontab="* * * * *", active=False, label="alert_6"),
        ]
        observers = [
            SQLObserver(
                name="observer_1", sql="SELECT 0", alert_id=1, database_id=database_id
            ),
            SQLObserver(
                name="observer_2",
                sql="SELECT id FROM test_table WHERE id = -1",
                alert_id=2,
                database_id=database_id,
            ),
            SQLObserver(
                name="observer_3", sql="$%^&", alert_id=3, database_id=database_id
            ),
            SQLObserver(
                name="observer_4", sql="SELECT 55", alert_id=4, database_id=database_id
            ),
        ]

        db.session.bulk_save_objects(alerts)
        db.session.bulk_save_objects(observers)
        yield db.session

        db.session.query(SQLObservation).delete()
        db.session.query(SQLObserver).delete()
        db.session.query(Validator).delete()
        db.session.query(AlertLog).delete()
        db.session.query(Alert).delete()


def test_alert_observer(setup_database):
    dbsession = setup_database

    # Test SQLObserver with empty SQL return
    alert2 = dbsession.query(Alert).filter_by(id=2).one()
    observe(alert2.id)
    assert alert2.sql_observers[0].observations[-1].value is None

    # Test SQLObserver with non-empty SQL return
    alert4 = dbsession.query(Alert).filter_by(id=4).one()
    observe(alert4.id)
    assert alert4.sql_observers[0].observations[-1].value == 55


def test_alert_error(setup_database):
    dbsession = setup_database

    # Test error with Observer SQL statement
    alert3 = dbsession.query(Alert).filter_by(id=3).one()
    check_alert(alert3.id, alert3.label)
    assert alert3.logs[-1].state == AlertState.ERROR

    # Test error with alert lacking observer
    alert5 = dbsession.query(Alert).filter_by(id=5).one()
    check_alert(alert5.id, alert5.label)
    assert alert5.logs[-1].state == AlertState.ERROR


@patch("superset.tasks.schedules.deliver_alert")
def test_not_null_validator(mock_deliver_alert, setup_database):
    dbsession = setup_database
    null_val1 = Validator(
        name="Null Validator", validator_type=AlertValidatorType.not_null, alert_id=1
    )
    null_val2 = Validator(
        name="Null Validator", validator_type=AlertValidatorType.not_null, alert_id=2
    )
    null_val4 = Validator(
        name="Null Validator", validator_type=AlertValidatorType.not_null, alert_id=4
    )
    dbsession.bulk_save_objects([null_val1, null_val2, null_val4])

    # Test passing alert with null SQL result
    alert1 = dbsession.query(Alert).filter_by(id=1).one()
    check_alert(alert1.id, alert1.label)
    assert mock_deliver_alert.call_count == 0
    assert alert1.logs[-1].state == AlertState.PASS

    # Test passing alert with empty SQL result
    alert2 = dbsession.query(Alert).filter_by(id=2).one()
    check_alert(alert2.id, alert2.label)
    assert mock_deliver_alert.call_count == 0
    assert alert2.logs[-1].state == AlertState.PASS

    # Test triggering alert with non-null SQL result
    alert4 = dbsession.query(Alert).filter_by(id=4).one()
    check_alert(alert4.id, alert4.label)
    assert mock_deliver_alert.call_count == 1
    assert alert4.logs[-1].state == AlertState.TRIGGER

    db.session.query(Validator).delete()


@patch("superset.tasks.schedules.deliver_alert")
def test_gte_validator(mock_deliver_alert, setup_database):
    dbsession = setup_database
    gte_val1 = Validator(
        name="GTE Validator",
        validator_type=AlertValidatorType.gte_threshold,
        config='{"gte_threshold": 60}',
        alert_id=4,
    )

    dbsession.bulk_save_objects([gte_val1])

    # Test passing alert with null SQL result
    alert1 = dbsession.query(Alert).filter_by(id=1).one()
    check_alert(alert1.id, alert1.label)
    assert mock_deliver_alert.call_count == 0
    assert alert1.logs[-1].state == AlertState.PASS

    # Test passing alert with SQL result that doesn't pass threshold
    alert2 = dbsession.query(Alert).filter_by(id=4).one()
    check_alert(alert2.id, alert2.label)
    assert mock_deliver_alert.call_count == 0
    assert alert2.logs[-1].state == AlertState.PASS

    gte_val2 = Validator(
        name="GTE Validator",
        validator_type=AlertValidatorType.gte_threshold,
        config='{"gte_threshold": 40}',
        alert_id=4,
    )
    dbsession.bulk_save_objects([gte_val2])

    # Test triggering alert with SQL result that passes threshold
    check_alert(alert2.id, alert2.label)
    assert mock_deliver_alert.call_count == 1
    assert alert2.logs[-1].state == AlertState.TRIGGER

    dbsession.query(Validator).delete()


@patch("superset.tasks.schedules.deliver_alert")
def test_lte_validator(mock_deliver_alert, setup_database):
    dbsession = setup_database

    lte_val1 = Validator(
        name="LTE Validator",
        validator_type=AlertValidatorType.lte_threshold,
        config='{"lte_threshold": 40}',
        alert_id=4,
    )

    dbsession.bulk_save_objects([lte_val1])

    # Test passing alert with null SQL result
    alert1 = dbsession.query(Alert).filter_by(id=1).one()
    check_alert(alert1.id, alert1.label)
    assert mock_deliver_alert.call_count == 0
    assert alert1.logs[-1].state == AlertState.PASS

    # Test passing alert with SQL result that doesn't pass threshold
    alert2 = dbsession.query(Alert).filter_by(id=4).one()
    check_alert(alert2.id, alert2.label)
    assert mock_deliver_alert.call_count == 0
    assert alert2.logs[-1].state == AlertState.PASS

    lte_val2 = Validator(
        name="LTE Validator",
        validator_type=AlertValidatorType.lte_threshold,
        config='{"lte_threshold": 60}',
        alert_id=4,
    )
    dbsession.bulk_save_objects([lte_val2])

    # Test triggering alert with SQL result that passes threshold
    check_alert(alert2.id, alert2.label)
    assert mock_deliver_alert.call_count == 1
    assert alert2.logs[-1].state == AlertState.TRIGGER

    dbsession.query(Validator).delete()


@patch("superset.tasks.schedules.deliver_alert")
@patch("superset.tasks.schedules.check_alert")
def test_schedule_alert_query(mock_run_alert, mock_deliver_alert, setup_database):
    dbsession = setup_database
    active_alert = dbsession.query(Alert).filter_by(id=1).one()
    inactive_alert = dbsession.query(Alert).filter_by(id=5).one()

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
        slack_channel="#test-channel",
    )
    assert mock_run_alert.call_count == 1
    assert mock_deliver_alert.call_count == 1


@patch("superset.tasks.slack_util.WebClient.files_upload")
@patch("superset.tasks.schedules.send_email_smtp")
@patch("superset.tasks.schedules._get_url_path")
@patch("superset.utils.screenshots.ChartScreenshot.compute_and_cache")
def test_deliver_alert_screenshot(
    screenshot_mock, url_mock, email_mock, file_upload_mock, setup_database
):
    dbsession = setup_database
    alert = dbsession.query(Alert).filter_by(id=2).one()

    screenshot = read_fixture("sample.png")
    screenshot_mock.return_value = screenshot

    # TODO: fix AlertModelView.show url call from test
    url_mock.side_effect = [
        f"http://0.0.0.0:8080/alert/show/{alert.id}",
        f"http://0.0.0.0:8080/superset/slice/{alert.slice_id}/",
    ]

    deliver_alert(alert_id=alert.id, sql=alert.sql_observers[0].sql)
    assert email_mock.call_args[1]["images"]["screenshot"] == screenshot
    assert file_upload_mock.call_args[1] == {
        "channels": alert.slack_channel,
        "file": screenshot,
        "initial_comment": f"\n*Triggered Alert: {alert.label} :redalert:*\n"
        f"SQL Statement:```{alert.sql_observers[0].sql}```"
        f"\n<http://0.0.0.0:8080/alert/show/{alert.id}"
        f"|View Alert Details>\n<http://0.0.0.0:8080/superset/slice/{alert.slice_id}/"
        "|*Explore in Superset*>",
        "title": f"[Alert] {alert.label}",
    }
