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
from superset.models.slice import Slice
from superset.tasks.schedules import run_alert_query
from superset.utils import core as utils
from tests.test_app import app

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@pytest.yield_fixture(scope="module")
def setup_database():
    with app.app_context():
        slice_id = db.session.query(Slice).all()[0].id
        database_id = utils.get_example_database().id

        alert1 = Alert(
            id=1,
            label="alert_1",
            active=True,
            crontab="*/1 * * * *",
            sql="SELECT 0",
            alert_type="email",
            slice_id=slice_id,
            database_id=database_id,
        )
        alert2 = Alert(
            id=2,
            label="alert_2",
            active=True,
            crontab="*/1 * * * *",
            sql="SELECT 55",
            alert_type="email",
            slice_id=slice_id,
            database_id=database_id,
        )
        alert3 = Alert(
            id=3,
            label="alert_3",
            active=False,
            crontab="*/1 * * * *",
            sql="UPDATE 55",
            alert_type="email",
            slice_id=slice_id,
            database_id=database_id,
        )
        alert4 = Alert(id=4, active=False, label="alert_4", database_id=-1)
        alert5 = Alert(id=5, active=False, label="alert_5", database_id=database_id)

        for num in range(1, 6):
            eval(f"db.session.add(alert{num})")
        db.session.commit()
        yield db.session

        db.session.query(AlertLog).delete()
        db.session.query(Alert).delete()


@patch("superset.tasks.schedules.deliver_alert")
@patch("superset.tasks.schedules.logging.Logger.error")
def test_run_alert_query(mock_error, mock_deliver, setup_database):
    database = setup_database
    run_alert_query(database.query(Alert).filter_by(id=1).one(), database)
    alert1 = database.query(Alert).filter_by(id=1).one()
    assert mock_deliver.call_count == 0
    assert len(alert1.logs) == 1
    assert alert1.logs[0].alert_id == 1
    assert alert1.logs[0].state == "pass"

    run_alert_query(database.query(Alert).filter_by(id=2).one(), database)
    alert2 = database.query(Alert).filter_by(id=2).one()
    assert mock_deliver.call_count == 1
    assert len(alert2.logs) == 1
    assert alert2.logs[0].alert_id == 2
    assert alert2.logs[0].state == "trigger"

    run_alert_query(database.query(Alert).filter_by(id=3).one(), database)
    alert3 = database.query(Alert).filter_by(id=3).one()
    assert mock_deliver.call_count == 1
    assert mock_error.call_count == 2
    assert len(alert3.logs) == 1
    assert alert3.logs[0].alert_id == 3
    assert alert3.logs[0].state == "error"

    run_alert_query(database.query(Alert).filter_by(id=4).one(), database)
    assert mock_deliver.call_count == 1
    assert mock_error.call_count == 3

    run_alert_query(database.query(Alert).filter_by(id=5).one(), database)
    assert mock_deliver.call_count == 1
    assert mock_error.call_count == 4
