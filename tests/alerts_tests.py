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
from typing import Optional
from unittest.mock import patch

import pytest

from superset import db
from superset.exceptions import SupersetException
from superset.models.alerts import (
    Alert,
    AlertLog,
    SQLObservation,
    SQLObserver,
    Validator,
)
from superset.models.slice import Slice
from superset.tasks.alerts.observer import observe
from superset.tasks.alerts.validator import (
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

        no_observer_alert = Alert(crontab="* * * * *", label="No Observer")
        db.session.add(no_observer_alert)
        db.session.commit()
        yield db.session

        db.session.query(SQLObservation).delete()
        db.session.query(SQLObserver).delete()
        db.session.query(Validator).delete()
        db.session.query(AlertLog).delete()
        db.session.query(Alert).delete()


def create_alert(
    dbsession,
    sql: str,
    validator_type: Optional[str] = None,
    validator_config: Optional[str] = None,
) -> Alert:
    alert = Alert(
        label="test_alert",
        active=True,
        crontab="* * * * *",
        slice_id=dbsession.query(Slice).all()[0].id,
        recipients="recipient1@superset.com",
        slack_channel="#test_channel",
    )
    dbsession.add(alert)
    dbsession.commit()

    sql_observer = SQLObserver(
        sql=sql, alert_id=alert.id, database_id=utils.get_example_database().id,
    )

    if validator_type and validator_config:
        validator = Validator(
            validator_type=validator_type, config=validator_config, alert_id=alert.id,
        )

        dbsession.add(validator)

    dbsession.add(sql_observer)
    dbsession.commit()
    return alert


def test_alert_observer(setup_database):
    dbsession = setup_database

    # Test SQLObserver with int SQL return
    alert1 = create_alert(dbsession, "SELECT 55")
    observe(alert1.id)
    assert alert1.sql_observer[0].observations[-1].value == 55.0
    assert alert1.sql_observer[0].observations[-1].error_msg is None

    # Test SQLObserver with double SQL return
    alert2 = create_alert(dbsession, "SELECT 30.0 as wage")
    observe(alert2.id)
    assert alert2.sql_observer[0].observations[-1].value == 30.0
    assert alert2.sql_observer[0].observations[-1].error_msg is None

    # Test SQLObserver with NULL result
    alert3 = create_alert(dbsession, "SELECT null as null_result")
    observe(alert3.id)
    assert alert3.sql_observer[0].observations[-1].value is None
    assert alert3.sql_observer[0].observations[-1].error_msg is None

    # Test SQLObserver with empty SQL return
    alert4 = create_alert(dbsession, "SELECT first FROM test_table WHERE first = -1")
    observe(alert4.id)
    assert alert4.sql_observer[0].observations[-1].value is None
    assert alert4.sql_observer[0].observations[-1].error_msg is not None

    # Test SQLObserver with str result
    alert5 = create_alert(dbsession, "SELECT 'test_string' as string_value")
    observe(alert5.id)
    assert alert5.sql_observer[0].observations[-1].value is None
    assert alert5.sql_observer[0].observations[-1].error_msg is not None

    # Test SQLObserver with two row result
    alert6 = create_alert(dbsession, "SELECT first FROM test_table")
    observe(alert6.id)
    assert alert6.sql_observer[0].observations[-1].value is None
    assert alert6.sql_observer[0].observations[-1].error_msg is not None

    # Test SQLObserver with two column result
    alert7 = create_alert(
        dbsession, "SELECT first, second FROM test_table WHERE first = 1"
    )
    observe(alert7.id)
    assert alert7.sql_observer[0].observations[-1].value is None
    assert alert7.sql_observer[0].observations[-1].error_msg is not None


@patch("superset.tasks.schedules.deliver_alert")
def test_evaluate_alert(mock_deliver_alert, setup_database):
    dbsession = setup_database

    # Test error with Observer SQL statement
    alert1 = create_alert(dbsession, "$%^&")
    evaluate_alert(alert1.id, alert1.label)
    assert alert1.logs[-1].state == AlertState.ERROR

    # Test error with alert lacking observer
    alert2 = dbsession.query(Alert).filter_by(label="No Observer").one()
    evaluate_alert(alert2.id, alert2.label)
    assert alert2.logs[-1].state == AlertState.ERROR

    # Test pass on alert lacking validator
    alert3 = create_alert(dbsession, "SELECT 55")
    evaluate_alert(alert3.id, alert3.label)
    assert alert3.logs[-1].state == AlertState.PASS

    # Test triggering successful alert
    alert4 = create_alert(dbsession, "SELECT 55", "not null", "{}")
    evaluate_alert(alert4.id, alert4.label)
    assert mock_deliver_alert.call_count == 1
    assert alert4.logs[-1].state == AlertState.TRIGGER


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
    dbsession = setup_database

    # Test passing SQLObserver with 'null' SQL result
    alert1 = create_alert(dbsession, "SELECT 0")
    observe(alert1.id)
    assert not_null_validator(alert1.sql_observer[0], "{}") is False

    # Test passing SQLObserver with empty SQL result
    alert2 = create_alert(dbsession, "SELECT first FROM test_table WHERE first = -1")
    observe(alert2.id)
    assert not_null_validator(alert2.sql_observer[0], "{}") is False

    # Test triggering alert with non-null SQL result
    alert3 = create_alert(dbsession, "SELECT 55")
    observe(alert3.id)
    assert not_null_validator(alert3.sql_observer[0], "{}") is True


def test_operator_validator(setup_database):
    dbsession = setup_database

    # Test passing SQLObserver with empty SQL result
    alert1 = create_alert(dbsession, "SELECT first FROM test_table WHERE first = -1")
    observe(alert1.id)
    assert (
        operator_validator(alert1.sql_observer[0], '{"op": ">=", "threshold": 60}')
        is False
    )

    # Test passing SQLObserver with result that doesn't pass a greater than threshold
    alert2 = create_alert(dbsession, "SELECT 55")
    observe(alert2.id)
    assert (
        operator_validator(alert2.sql_observer[0], '{"op": ">=", "threshold": 60}')
        is False
    )

    # Test passing SQLObserver with result that passes a greater than threshold
    assert (
        operator_validator(alert2.sql_observer[0], '{"op": ">=", "threshold": 40}')
        is True
    )

    # Test passing SQLObserver with result that doesn't pass a less than threshold
    assert (
        operator_validator(alert2.sql_observer[0], '{"op": "<=", "threshold": 40}')
        is False
    )

    # Test passing SQLObserver with result that passes threshold
    assert (
        operator_validator(alert2.sql_observer[0], '{"op": "<=", "threshold": 60}')
        is True
    )

    # Test passing SQLObserver with result that doesn't equal threshold
    assert (
        operator_validator(alert2.sql_observer[0], '{"op": "==", "threshold": 60}')
        is False
    )

    # Test passing SQLObserver with result that equals threshold
    assert (
        operator_validator(alert2.sql_observer[0], '{"op": "==", "threshold": 55}')
        is True
    )


def test_validate_observations(setup_database):
    dbsession = setup_database

    # Test False on alert with no validator
    alert1 = create_alert(dbsession, "SELECT 55")
    assert validate_observations(alert1.id, alert1.label) is False

    # Test False on alert with no observations
    alert2 = create_alert(dbsession, "SELECT 55", "not null", "{}")
    assert validate_observations(alert2.id, alert2.label) is False

    # Test False on alert that shouldnt be triggered
    alert3 = create_alert(dbsession, "SELECT 0", "not null", "{}")
    observe(alert3.id)
    assert validate_observations(alert3.id, alert3.label) is False

    # Test True on alert that should be triggered
    alert4 = create_alert(
        dbsession, "SELECT 55", "operator", '{"op": "<=", "threshold": 60}'
    )
    observe(alert4.id)
    assert validate_observations(alert4.id, alert4.label) is True


@patch("superset.tasks.slack_util.WebClient.files_upload")
@patch("superset.tasks.schedules.send_email_smtp")
@patch("superset.tasks.schedules._get_url_path")
@patch("superset.utils.screenshots.ChartScreenshot.compute_and_cache")
def test_deliver_alert_screenshot(
    screenshot_mock, url_mock, email_mock, file_upload_mock, setup_database
):
    dbsession = setup_database
    alert = create_alert(dbsession, "SELECT 55")
    observe(alert.id)

    screenshot = read_fixture("sample.png")
    screenshot_mock.return_value = screenshot

    # TODO: fix AlertModelView.show url call from test
    url_mock.side_effect = [
        f"http://0.0.0.0:8080/alert/show/{alert.id}",
        f"http://0.0.0.0:8080/superset/slice/{alert.slice_id}/",
    ]

    deliver_alert(alert_id=alert.id)
    assert email_mock.call_args[1]["images"]["screenshot"] == screenshot
    assert file_upload_mock.call_args[1] == {
        "channels": alert.slack_channel,
        "file": screenshot,
        "initial_comment": f"\n*Triggered Alert: {alert.label} :redalert:*\n"
        f"*SQL* *Statement*:```{alert.sql_observer[0].sql}```\n"
        f"*SQL* *Result*: {alert.observations[-1].value}"
        f"\n<http://0.0.0.0:8080/alert/show/{alert.id}"
        f"|View Alert Details>\n<http://0.0.0.0:8080/superset/slice/{alert.slice_id}/"
        "|*Explore in Superset*>",
        "title": f"[Alert] {alert.label}",
    }
