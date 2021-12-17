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
from superset.views.alerts import (
    AlertLogModelView,
    AlertModelView,
    AlertObservationModelView,
)
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.test_app import app
from tests.integration_tests.utils import read_fixture

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
    validator_type: AlertValidatorType = AlertValidatorType.OPERATOR,
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


@pytest.mark.parametrize(
    "description, query, value",
    [
        ("Test int SQL return", "SELECT 55", 55.0),
        ("Test double SQL return", "SELECT 30.0 as wage", 30.0),
        ("Test NULL result", "SELECT null as null_result", None),
        (
            "Test empty SQL return",
            "SELECT first FROM test_table WHERE first = -1",
            None,
        ),
        (
            "Test multi line query",
            """
        -- comment
        SELECT
            1 -- comment
        FROM test_table
            WHERE first = 1
        """,
            1.0,
        ),
        ("Test jinja", "SELECT {{ 2 }}", 2.0),
    ],
)
def test_alert_observer_no_error_msg(setup_database, description, query, value):
    logger.info(description)
    db_session = setup_database
    alert = create_alert(db_session, query)
    observe(alert.id, db_session)
    if value is None:
        assert alert.observations[-1].value is None
    else:
        assert alert.observations[-1].value == value
    assert alert.observations[-1].error_msg is None


@pytest.mark.parametrize(
    "description, query",
    [
        ("Test str result", "SELECT 'test_string' as string_value"),
        ("Test two row result", "SELECT first FROM test_table"),
        (
            "Test two column result",
            "SELECT first, second FROM test_table WHERE first = 1",
        ),
    ],
)
def test_alert_observer_error_msg(setup_database, description, query):
    logger.info(description)
    db_session = setup_database
    alert = create_alert(db_session, query)
    observe(alert.id, db_session)
    assert alert.observations[-1].value is None
    assert alert.observations[-1].error_msg is not None


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


@pytest.mark.parametrize(
    "description, validator_type, config",
    [
        ("Test with invalid operator type", "greater than", "{}"),
        ("Test with empty config", "operator", "{}"),
        ("Test with invalid operator", "operator", '{"op": "is", "threshold":50.0}'),
        (
            "Test with invalid threshold",
            "operator",
            '{"op": "is", "threshold":"hello"}',
        ),
    ],
)
def test_check_validator_error(description, validator_type, config):
    logger.info(description)
    with pytest.raises(SupersetException):
        check_validator(validator_type, config)


@pytest.mark.parametrize(
    "description, validator_type, config",
    [
        (
            "Test with float threshold and no errors",
            "operator",
            '{"op": ">=", "threshold": 50.0}',
        ),
        (
            "Test with int threshold and no errors",
            "operator",
            '{"op": ">=", "threshold": 50}',
        ),
    ],
)
def test_check_validator_no_error(description, validator_type, config):
    logger.info(description)
    assert check_validator(validator_type, config) is None


@pytest.mark.parametrize(
    "description, query, value",
    [
        ("Test passing with 'null' SQL result", "SELECT 0", False),
        (
            "Test passing with empty SQL result",
            "SELECT first FROM test_table WHERE first = -1",
            False,
        ),
        ("Test triggering alert with non-null SQL result", "SELECT 55", True),
    ],
)
def test_not_null_validator(setup_database, description, query, value):
    logger.info(description)
    db_session = setup_database
    alert = create_alert(db_session, query)
    observe(alert.id, db_session)
    assert not_null_validator(alert, "{}") is value


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

    # Test passing with result that equals decimal threshold
    assert operator_validator(alert2, '{"op": ">", "threshold": 54.999}') is True


@pytest.mark.parametrize(
    "description, query, validator_type, config",
    [
        ("Test False on alert with no validator", "SELECT 55", "operator", ""),
        ("Test False on alert with no observations", "SELECT 0", "not null", "{}"),
    ],
)
def test_validate_observations_no_observe(
    setup_database, description, query, validator_type, config
):
    db_session = setup_database
    logger.info(description)

    alert = create_alert(db_session, query, validator_type, config)
    assert validate_observations(alert.id, alert.label, db_session) is False


@pytest.mark.parametrize(
    "description, query, validator_type, config, expected",
    [
        (
            "Test False on alert that should not be triggered",
            "SELECT 0",
            "not null",
            "{}",
            False,
        ),
        (
            "Test True on alert that should be triggered",
            "SELECT 55",
            "operator",
            '{"op": "<=", "threshold": 60}',
            True,
        ),
    ],
)
def test_validate_observations_with_observe(
    setup_database, description, query, validator_type, config, expected
):
    db_session = setup_database
    logger.info(description)

    alert = create_alert(db_session, query, validator_type, config)
    observe(alert.id, db_session)
    assert validate_observations(alert.id, alert.label, db_session) is expected


def test_validate_observations(setup_database):
    db_session = setup_database

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
        f"http://0.0.0.0:8080/alerts/show/{alert.id}",
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
        f"<http://0.0.0.0:8080/alerts/show/{alert.id}"
        f"|View Alert Details>\n<http://0.0.0.0:8080/superset/slice/{alert.slice_id}/"
        "|*Explore in Superset*>",
        "title": f"[Alert] {alert.label}",
    }


class TestAlertsEndpoints(SupersetTestCase):
    def test_log_model_view_disabled(self):
        with patch.object(AlertLogModelView, "is_enabled", return_value=False):
            self.login("admin")
            uri = "/alertlogmodelview/list/"
            rv = self.client.get(uri)
            self.assertEqual(rv.status_code, 404)

    def test_log_model_view_enabled(self):
        with patch.object(AlertLogModelView, "is_enabled", return_value=True):
            self.login("admin")
            uri = "/alertlogmodelview/list/"
            rv = self.client.get(uri)
            self.assertLess(rv.status_code, 400)

    def test_model_view_disabled(self):
        with patch.object(AlertModelView, "is_enabled", return_value=False):
            self.login("admin")
            uri = "/alerts/list/"
            rv = self.client.get(uri)
            self.assertEqual(rv.status_code, 404)

    def test_model_view_enabled(self):
        with patch.object(AlertModelView, "is_enabled", return_value=True):
            self.login("admin")
            uri = "/alerts/list/"
            rv = self.client.get(uri)
            self.assertNotEqual(rv.status_code, 404)

    def test_observation_view_disabled(self):
        with patch.object(AlertObservationModelView, "is_enabled", return_value=False):
            self.login("admin")
            uri = "/alertobservationmodelview/list/"
            rv = self.client.get(uri)
            self.assertEqual(rv.status_code, 404)

    def test_observation_view_enabled(self):
        with patch.object(AlertObservationModelView, "is_enabled", return_value=True):
            self.login("admin")
            uri = "/alertobservationmodelview/list/"
            rv = self.client.get(uri)
            self.assertLess(rv.status_code, 400)
