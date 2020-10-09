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
import json
import logging
from typing import Optional
from unittest.mock import patch

import pytest
from sqlalchemy.orm import Session

from superset import db
from superset.exceptions import SupersetException
from superset.models.alerts import Alert, AlertLog, SQLObservation
from superset.models.slice import Slice
from superset.tasks.alerts.observer import observe
from superset.tasks.alerts.validator import (
    AlertValidatorType,
    check_validator,
    not_null_validator,
    operator_validator,
)
from superset.tasks.schedules import (
    AlertState,
    deliver_alert,
    evaluate_alert,
    validate_observations,
)
from superset.utils import core as utils
from tests.test_app import app
from tests.utils import read_fixture

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@pytest.yield_fixture(scope="module")
def setup_database():
    with app.app_context():
        example_database = utils.get_example_database()
        example_database.get_sqla_engine().execute(
            "CREATE TABLE test_table AS SELECT 1 as first, 2 as second"
        )
        example_database.get_sqla_engine().execute(
            "INSERT INTO test_table (first, second) VALUES (3, 4)"
        )

        yield db.session

        db.session.query(SQLObservation).delete()
        db.session.query(AlertLog).delete()
        db.session.query(Alert).delete()
        db.session.commit()
        example_database.get_sqla_engine().execute("DROP TABLE test_table")


def create_alert(
    db_session: Session,
    sql: str,
    validator_type: AlertValidatorType = AlertValidatorType.operator,
    validator_config: str = "",
) -> Alert:
    db_session.commit()
    alert = Alert(
        label="test_alert",
        active=True,
        crontab="* * * * *",
        slice_id=db_session.query(Slice).all()[0].id,
        recipients="recipient1@superset.com",
        slack_channel="#test_channel",
        sql=sql,
        database_id=utils.get_example_database().id,
        validator_type=validator_type,
        validator_config=validator_config,
    )
    db_session.add(alert)
    db_session.commit()
    return alert


def test_alert_observer(setup_database):
    db_session = setup_database

    # Test int SQL return
    alert1 = create_alert(db_session, "SELECT 55")
    observe(alert1.id, db_session)
    assert alert1.observations[-1].value == 55.0
    assert alert1.observations[-1].error_msg is None

    # Test double SQL return
    alert2 = create_alert(db_session, "SELECT 30.0 as wage")
    observe(alert2.id, db_session)
    assert alert2.observations[-1].value == 30.0
    assert alert2.observations[-1].error_msg is None

    # Test NULL result
    alert3 = create_alert(db_session, "SELECT null as null_result")
    observe(alert3.id, db_session)
    assert alert3.observations[-1].value is None
    assert alert3.observations[-1].error_msg is None

    # Test empty SQL return, expected
    alert4 = create_alert(db_session, "SELECT first FROM test_table WHERE first = -1")
    observe(alert4.id, db_session)
    assert alert4.observations[-1].value is None
    assert alert4.observations[-1].error_msg is None

    # Test str result
    alert5 = create_alert(db_session, "SELECT 'test_string' as string_value")
    observe(alert5.id, db_session)
    assert alert5.observations[-1].value is None
    assert alert5.observations[-1].error_msg is not None

    # Test two row result
    alert6 = create_alert(db_session, "SELECT first FROM test_table")
    observe(alert6.id, db_session)
    assert alert6.observations[-1].value is None
    assert alert6.observations[-1].error_msg is not None

    # Test two column result
    alert7 = create_alert(
        db_session, "SELECT first, second FROM test_table WHERE first = 1"
    )
    observe(alert7.id, db_session)
    assert alert7.observations[-1].value is None
    assert alert7.observations[-1].error_msg is not None

    # Test multiline sql
    alert8 = create_alert(
        db_session,
        """
        -- comment
        SELECT
            1 -- comment
        FROM test_table
            WHERE first = 1
        """,
    )
    observe(alert8.id, db_session)
    assert alert8.observations[-1].value == 1.0
    assert alert8.observations[-1].error_msg is None

    # Test jinja
    alert9 = create_alert(db_session, "SELECT {{ 2 }}")
    observe(alert9.id, db_session)
    assert alert9.observations[-1].value == 2.0
    assert alert9.observations[-1].error_msg is None


@patch("superset.tasks.schedules.deliver_alert")
def test_evaluate_alert(mock_deliver_alert, setup_database):
    db_session = setup_database

    # Test error with Observer SQL statement
    alert1 = create_alert(db_session, "$%^&")
    evaluate_alert(alert1.id, alert1.label, db_session)
    assert alert1.logs[-1].state == AlertState.ERROR

    # Test pass on alert lacking validator config
    alert2 = create_alert(db_session, "SELECT 55")
    # evaluation fails if config is malformed
    with pytest.raises(json.decoder.JSONDecodeError):
        evaluate_alert(alert2.id, alert2.label, db_session)
    assert not alert2.logs

    # Test triggering successful alert
    alert3 = create_alert(db_session, "SELECT 55", "not null", "{}")
    evaluate_alert(alert3.id, alert3.label, db_session)
    assert mock_deliver_alert.call_count == 1
    assert alert3.logs[-1].state == AlertState.TRIGGER


def test_check_validator():
    # Test with invalid operator type
    with pytest.raises(SupersetException):
        check_validator("greater than", "{}")

    # Test with empty config
    with pytest.raises(SupersetException):
        check_validator("operator", "{}")

    # Test with invalid operator
    with pytest.raises(SupersetException):
        check_validator("operator", '{"op": "is", "threshold":50.0}')

    # Test with invalid operator
    with pytest.raises(SupersetException):
        check_validator("operator", '{"op": "is", "threshold":50.0}')

    # Test with invalid threshold
    with pytest.raises(SupersetException):
        check_validator("operator", '{"op": "is", "threshold":"hello"}')

    # Test with float threshold and no errors
    assert check_validator("operator", '{"op": ">=", "threshold": 50.0}') is None

    # Test with int threshold and no errors
    assert check_validator("operator", '{"op": "==", "threshold": 50}') is None


def test_not_null_validator(setup_database):
    db_session = setup_database

    # Test passing with 'null' SQL result
    alert1 = create_alert(db_session, "SELECT 0")
    observe(alert1.id, db_session)
    assert not_null_validator(alert1, "{}") is False

    # Test passing with empty SQL result
    alert2 = create_alert(db_session, "SELECT first FROM test_table WHERE first = -1")
    observe(alert2.id, db_session)
    assert not_null_validator(alert2, "{}") is False

    # Test triggering alert with non-null SQL result
    alert3 = create_alert(db_session, "SELECT 55")
    observe(alert3.id, db_session)
    assert not_null_validator(alert3, "{}") is True


def test_operator_validator(setup_database):
    dbsession = setup_database

    # Test passing with empty SQL result
    alert1 = create_alert(dbsession, "SELECT first FROM test_table WHERE first = -1")
    observe(alert1.id, dbsession)
    assert operator_validator(alert1, '{"op": ">=", "threshold": 60}') is False
    # ensure that 0 threshold works
    assert operator_validator(alert1, '{"op": ">=", "threshold": 0}') is False

    # Test passing with result that doesn't pass a greater than threshold
    alert2 = create_alert(dbsession, "SELECT 55")
    observe(alert2.id, dbsession)
    assert operator_validator(alert2, '{"op": ">=", "threshold": 60}') is False

    # Test passing with result that passes a greater than threshold
    assert operator_validator(alert2, '{"op": ">=", "threshold": 40}') is True

    # Test passing with result that doesn't pass a less than threshold
    assert operator_validator(alert2, '{"op": "<=", "threshold": 40}') is False

    # Test passing with result that passes threshold
    assert operator_validator(alert2, '{"op": "<=", "threshold": 60}') is True

    # Test passing with result that doesn't equal threshold
    assert operator_validator(alert2, '{"op": "==", "threshold": 60}') is False

    # Test passing with result that equals threshold
    assert operator_validator(alert2, '{"op": "==", "threshold": 55}') is True


def test_validate_observations(setup_database):
    db_session = setup_database

    # Test False on alert with no validator
    alert1 = create_alert(db_session, "SELECT 55")
    assert validate_observations(alert1.id, alert1.label, db_session) is False

    # Test False on alert with no observations
    alert2 = create_alert(db_session, "SELECT 55", "not null", "{}")
    assert validate_observations(alert2.id, alert2.label, db_session) is False

    # Test False on alert that shouldnt be triggered
    alert3 = create_alert(db_session, "SELECT 0", "not null", "{}")
    observe(alert3.id, db_session)
    assert validate_observations(alert3.id, alert3.label, db_session) is False

    # Test True on alert that should be triggered
    alert4 = create_alert(
        db_session, "SELECT 55", "operator", '{"op": "<=", "threshold": 60}'
    )
    observe(alert4.id, db_session)
    assert validate_observations(alert4.id, alert4.label, db_session) is True


@patch("superset.tasks.slack_util.WebClient.files_upload")
@patch("superset.tasks.schedules.send_email_smtp")
@patch("superset.tasks.schedules._get_url_path")
@patch("superset.utils.screenshots.ChartScreenshot.compute_and_cache")
def test_deliver_alert_screenshot(
    screenshot_mock, url_mock, email_mock, file_upload_mock, setup_database
):
    dbsession = setup_database
    alert = create_alert(dbsession, "SELECT 55", "not null", "{}")
    observe(alert.id, dbsession)

    screenshot = read_fixture("sample.png")
    screenshot_mock.return_value = screenshot

    # TODO: fix AlertModelView.show url call from test
    url_mock.side_effect = [
        f"http://0.0.0.0:8080/alert/show/{alert.id}",
        f"http://0.0.0.0:8080/superset/slice/{alert.slice_id}/",
    ]

    deliver_alert(alert.id, dbsession)
    assert email_mock.call_args[1]["images"]["screenshot"] == screenshot
    assert file_upload_mock.call_args[1] == {
        "channels": alert.slack_channel,
        "file": screenshot,
        "initial_comment": f"\n*Triggered Alert: {alert.label} :redalert:*\n"
        f"*Query*:```{alert.sql}```\n"
        f"*Result*: {alert.observations[-1].value}\n"
        f"*Reason*: {alert.observations[-1].value} {alert.pretty_config}\n"
        f"<http://0.0.0.0:8080/alert/show/{alert.id}"
        f"|View Alert Details>\n<http://0.0.0.0:8080/superset/slice/{alert.slice_id}/"
        "|*Explore in Superset*>",
        "title": f"[Alert] {alert.label}",
    }
