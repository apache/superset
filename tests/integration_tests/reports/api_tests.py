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
# isort:skip_file
"""Unit tests for Superset"""
from datetime import datetime
import json

import pytest
import prison
from sqlalchemy.sql import func

from superset import db
from superset.models.core import Database
from superset.models.slice import Slice
from superset.models.dashboard import Dashboard
from superset.models.reports import (
    ReportSchedule,
    ReportCreationMethodType,
    ReportRecipients,
    ReportExecutionLog,
    ReportScheduleType,
    ReportRecipientType,
    ReportState,
)
from superset.utils.core import get_example_database
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
)
from tests.integration_tests.reports.utils import insert_report_schedule


REPORTS_COUNT = 10


class TestReportSchedulesApi(SupersetTestCase):
    @pytest.fixture()
    def create_working_report_schedule(self):
        with self.create_app().app_context():

            admin_user = self.get_user("admin")
            alpha_user = self.get_user("alpha")
            chart = db.session.query(Slice).first()
            example_db = get_example_database()

            report_schedule = insert_report_schedule(
                type=ReportScheduleType.ALERT,
                name="name_working",
                crontab="* * * * *",
                sql="SELECT value from table",
                description="Report working",
                chart=chart,
                database=example_db,
                owners=[admin_user, alpha_user],
                last_state=ReportState.WORKING,
            )

            yield

            db.session.delete(report_schedule)
            db.session.commit()

    @pytest.fixture()
    def create_report_schedules(self):
        with self.create_app().app_context():
            report_schedules = []
            admin_user = self.get_user("admin")
            alpha_user = self.get_user("alpha")
            chart = db.session.query(Slice).first()
            example_db = get_example_database()
            for cx in range(REPORTS_COUNT):
                recipients = []
                logs = []
                for cy in range(cx):
                    config_json = {"target": f"target{cy}@email.com"}
                    recipients.append(
                        ReportRecipients(
                            type=ReportRecipientType.EMAIL,
                            recipient_config_json=json.dumps(config_json),
                        )
                    )
                    logs.append(
                        ReportExecutionLog(
                            scheduled_dttm=datetime(2020, 1, 1),
                            state=ReportState.ERROR,
                            error_message=f"Error {cy}",
                        )
                    )
                report_schedules.append(
                    insert_report_schedule(
                        type=ReportScheduleType.ALERT,
                        name=f"name{cx}",
                        crontab=f"*/{cx} * * * *",
                        sql=f"SELECT value from table{cx}",
                        description=f"Some description {cx}",
                        chart=chart,
                        database=example_db,
                        owners=[admin_user, alpha_user],
                        recipients=recipients,
                        logs=logs,
                    )
                )
            yield report_schedules

            report_schedules = db.session.query(ReportSchedule).all()
            # rollback changes (assuming cascade delete)
            for report_schedule in report_schedules:
                db.session.delete(report_schedule)
            db.session.commit()

    @pytest.fixture()
    def create_alpha_users(self):
        with self.create_app().app_context():

            users = [
                self.create_user(
                    "alpha1", "password", "Alpha", email="alpha1@superset.org"
                ),
                self.create_user(
                    "alpha2", "password", "Alpha", email="alpha2@superset.org"
                ),
            ]

            yield users

            # rollback changes (assuming cascade delete)
            for user in users:
                db.session.delete(user)
            db.session.commit()

    @with_feature_flags(ALERT_REPORTS=False)
    @pytest.mark.usefixtures("create_report_schedules")
    def test_get_report_schedule_disabled(self):
        """
        ReportSchedule Api: Test get report schedule 404s when feature is disabled
        """
        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name1")
            .first()
        )

        self.login(username="admin")
        uri = f"api/v1/report/{report_schedule.id}"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_report_schedules")
    def test_get_report_schedule(self):
        """
        ReportSchedule Api: Test get report schedule
        """
        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name1")
            .first()
        )

        self.login(username="admin")
        uri = f"api/v1/report/{report_schedule.id}"
        rv = self.get_assert_metric(uri, "get")
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        expected_result = {
            "active": report_schedule.active,
            "chart": {
                "id": report_schedule.chart.id,
                "slice_name": report_schedule.chart.slice_name,
                "viz_type": report_schedule.chart.viz_type,
            },
            "context_markdown": report_schedule.context_markdown,
            "crontab": report_schedule.crontab,
            "dashboard": None,
            "database": {
                "id": report_schedule.database.id,
                "database_name": report_schedule.database.database_name,
            },
            "description": report_schedule.description,
            "grace_period": report_schedule.grace_period,
            "id": report_schedule.id,
            "last_eval_dttm": report_schedule.last_eval_dttm,
            "last_state": report_schedule.last_state,
            "last_value": report_schedule.last_value,
            "last_value_row_json": report_schedule.last_value_row_json,
            "log_retention": report_schedule.log_retention,
            "name": report_schedule.name,
            "recipients": [
                {
                    "id": report_schedule.recipients[0].id,
                    "recipient_config_json": '{"target": "target0@email.com"}',
                    "type": "Email",
                }
            ],
            "timezone": report_schedule.timezone,
            "type": report_schedule.type,
            "validator_config_json": report_schedule.validator_config_json,
            "validator_type": report_schedule.validator_type,
        }
        for key in expected_result:
            assert data["result"][key] == expected_result[key]
        # needed because order may vary
        assert {"first_name": "admin", "id": 1, "last_name": "user"} in data["result"][
            "owners"
        ]
        assert {"first_name": "alpha", "id": 5, "last_name": "user"} in data["result"][
            "owners"
        ]
        assert len(data["result"]["owners"]) == 2

    def test_info_report_schedule(self):
        """
        ReportSchedule API: Test info
        """
        self.login(username="admin")
        uri = f"api/v1/report/_info"
        rv = self.get_assert_metric(uri, "info")
        assert rv.status_code == 200

    def test_info_security_report(self):
        """
        ReportSchedule API: Test info security
        """
        self.login(username="admin")
        params = {"keys": ["permissions"]}
        uri = f"api/v1/report/_info?q={prison.dumps(params)}"
        rv = self.get_assert_metric(uri, "info")
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert "can_read" in data["permissions"]
        assert "can_write" in data["permissions"]
        assert len(data["permissions"]) == 2

    @pytest.mark.usefixtures("create_report_schedules")
    def test_get_report_schedule_not_found(self):
        """
        ReportSchedule Api: Test get report schedule not found
        """
        max_id = db.session.query(func.max(ReportSchedule.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/report/{max_id + 1}"
        rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_report_schedules")
    def test_get_list_report_schedule(self):
        """
        ReportSchedule Api: Test get list report schedules
        """
        self.login(username="admin")
        uri = f"api/v1/report/"
        rv = self.get_assert_metric(uri, "get_list")

        expected_fields = [
            "active",
            "changed_by",
            "changed_on",
            "changed_on_delta_humanized",
            "created_by",
            "created_on",
            "creation_method",
            "crontab",
            "crontab_humanized",
            "description",
            "id",
            "last_eval_dttm",
            "last_state",
            "name",
            "owners",
            "recipients",
            "timezone",
            "type",
        ]
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == REPORTS_COUNT
        data_keys = sorted(list(data["result"][0].keys()))
        assert expected_fields == data_keys

        # Assert nested fields
        expected_owners_fields = ["first_name", "id", "last_name"]
        data_keys = sorted(list(data["result"][0]["owners"][0].keys()))
        assert expected_owners_fields == data_keys

        expected_recipients_fields = ["id", "type"]
        data_keys = sorted(list(data["result"][1]["recipients"][0].keys()))
        assert expected_recipients_fields == data_keys

    @pytest.mark.usefixtures("create_report_schedules")
    def test_get_list_report_schedule_sorting(self):
        """
        ReportSchedule Api: Test sorting on get list report schedules
        """
        self.login(username="admin")
        uri = "api/v1/report/"

        order_columns = [
            "active",
            "created_by.first_name",
            "changed_by.first_name",
            "changed_on",
            "changed_on_delta_humanized",
            "created_on",
            "crontab",
            "description",
            "last_eval_dttm",
            "name",
            "type",
            "crontab_humanized",
        ]

        for order_column in order_columns:
            arguments = {"order_column": order_column, "order_direction": "asc"}
            uri = f"api/v1/report/?q={prison.dumps(arguments)}"
            rv = self.get_assert_metric(uri, "get_list")
            assert rv.status_code == 200

    @pytest.mark.usefixtures("create_report_schedules")
    def test_get_list_report_schedule_filter_name(self):
        """
        ReportSchedule Api: Test filter name on get list report schedules
        """
        self.login(username="admin")
        # Test normal contains filter
        arguments = {
            "columns": ["name"],
            "filters": [{"col": "name", "opr": "ct", "value": "2"}],
        }
        uri = f"api/v1/report/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")

        expected_result = {
            "name": "name2",
        }
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 1
        assert data["result"][0] == expected_result

    @pytest.mark.usefixtures("create_report_schedules")
    def test_get_list_report_schedule_filter_custom(self):
        """
        ReportSchedule Api: Test custom filter on get list report schedules
        """
        self.login(username="admin")
        # Test custom all text filter
        arguments = {
            "columns": ["name"],
            "filters": [{"col": "name", "opr": "report_all_text", "value": "table3"}],
        }
        uri = f"api/v1/report/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")

        expected_result = {
            "name": "name3",
        }
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 1
        assert data["result"][0] == expected_result

    @pytest.mark.usefixtures("create_report_schedules")
    def test_get_list_report_schedule_filter_active(self):
        """
        ReportSchedule Api: Test active filter on get list report schedules
        """
        self.login(username="admin")
        arguments = {
            "columns": ["name"],
            "filters": [{"col": "active", "opr": "eq", "value": True}],
        }
        uri = f"api/v1/report/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")

        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == REPORTS_COUNT

    @pytest.mark.usefixtures("create_report_schedules")
    def test_get_list_report_schedule_filter_type(self):
        """
        ReportSchedule Api: Test type filter on get list report schedules
        """
        self.login(username="admin")
        arguments = {
            "columns": ["name"],
            "filters": [
                {"col": "type", "opr": "eq", "value": ReportScheduleType.ALERT}
            ],
        }
        uri = f"api/v1/report/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")

        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == REPORTS_COUNT

        # Test type filter
        arguments = {
            "columns": ["name"],
            "filters": [
                {"col": "type", "opr": "eq", "value": ReportScheduleType.REPORT}
            ],
        }
        uri = f"api/v1/report/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")

        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 0

    @pytest.mark.usefixtures("create_report_schedules")
    def test_get_related_report_schedule(self):
        """
        ReportSchedule Api: Test get releated report schedule
        """
        self.login(username="admin")
        related_columns = ["owners", "chart", "dashboard", "database"]
        for related_column in related_columns:
            uri = f"api/v1/report/related/{related_column}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_create_report_schedule(self):
        """
        ReportSchedule Api: Test create report schedule
        """
        self.login(username="admin")

        chart = db.session.query(Slice).first()
        example_db = get_example_database()
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new3",
            "description": "description",
            "crontab": "0 9 * * *",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "recipients": [
                {
                    "type": ReportRecipientType.EMAIL,
                    "recipient_config_json": {"target": "target@superset.org"},
                },
                {
                    "type": ReportRecipientType.SLACK,
                    "recipient_config_json": {"target": "channel"},
                },
            ],
            "grace_period": 14400,
            "working_timeout": 3600,
            "chart": chart.id,
            "database": example_db.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 201
        created_model = db.session.query(ReportSchedule).get(data.get("id"))
        assert created_model is not None
        assert created_model.name == report_schedule_data["name"]
        assert created_model.grace_period == report_schedule_data["grace_period"]
        assert created_model.working_timeout == report_schedule_data["working_timeout"]
        assert created_model.description == report_schedule_data["description"]
        assert created_model.crontab == report_schedule_data["crontab"]
        assert created_model.chart.id == report_schedule_data["chart"]
        assert created_model.database.id == report_schedule_data["database"]
        assert created_model.creation_method == report_schedule_data["creation_method"]
        # Rollback changes
        db.session.delete(created_model)
        db.session.commit()

    @pytest.mark.usefixtures("create_report_schedules")
    def test_create_report_schedule_uniqueness(self):
        """
        ReportSchedule Api: Test create report schedule uniqueness
        """
        self.login(username="admin")

        chart = db.session.query(Slice).first()
        example_db = get_example_database()
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "name3",
            "description": "description",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "crontab": "0 9 * * *",
            "chart": chart.id,
            "database": example_db.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {"message": {"name": ["Name must be unique"]}}

        # Check that uniqueness is composed by name and type
        report_schedule_data = {
            "type": ReportScheduleType.REPORT,
            "name": "name3",
            "description": "description",
            "crontab": "0 9 * * *",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "chart": chart.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 201
        data = json.loads(rv.data.decode("utf-8"))

        # Rollback changes
        created_model = db.session.query(ReportSchedule).get(data.get("id"))
        db.session.delete(created_model)
        db.session.commit()

    @pytest.mark.usefixtures(
        "load_birth_names_dashboard_with_slices", "create_report_schedules"
    )
    def test_create_report_schedule_schema(self):
        """
        ReportSchedule Api: Test create report schedule schema check
        """
        self.login(username="admin")
        chart = db.session.query(Slice).first()
        dashboard = db.session.query(Dashboard).first()
        example_db = get_example_database()

        # Check that a report does not have a database reference
        report_schedule_data = {
            "type": ReportScheduleType.REPORT,
            "name": "name3",
            "description": "description",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "crontab": "0 9 * * *",
            "chart": chart.id,
            "database": example_db.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 400

        # Test that report can be created with null grace period
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new3",
            "description": "description",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "crontab": "0 9 * * *",
            "recipients": [
                {
                    "type": ReportRecipientType.EMAIL,
                    "recipient_config_json": {"target": "target@superset.org"},
                },
                {
                    "type": ReportRecipientType.SLACK,
                    "recipient_config_json": {"target": "channel"},
                },
            ],
            "working_timeout": 3600,
            "chart": chart.id,
            "database": example_db.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 201

        # Test that grace period and working timeout cannot be < 1
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new3",
            "description": "description",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "crontab": "0 9 * * *",
            "recipients": [
                {
                    "type": ReportRecipientType.EMAIL,
                    "recipient_config_json": {"target": "target@superset.org"},
                },
                {
                    "type": ReportRecipientType.SLACK,
                    "recipient_config_json": {"target": "channel"},
                },
            ],
            "working_timeout": -10,
            "chart": chart.id,
            "database": example_db.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 400

        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new3",
            "description": "description",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "crontab": "0 9 * * *",
            "recipients": [
                {
                    "type": ReportRecipientType.EMAIL,
                    "recipient_config_json": {"target": "target@superset.org"},
                },
                {
                    "type": ReportRecipientType.SLACK,
                    "recipient_config_json": {"target": "channel"},
                },
            ],
            "grace_period": -10,
            "working_timeout": 3600,
            "chart": chart.id,
            "database": example_db.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 400

        # Test that report can be created with null dashboard
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new4",
            "description": "description",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "crontab": "0 9 * * *",
            "recipients": [
                {
                    "type": ReportRecipientType.EMAIL,
                    "recipient_config_json": {"target": "target@superset.org"},
                },
                {
                    "type": ReportRecipientType.SLACK,
                    "recipient_config_json": {"target": "channel"},
                },
            ],
            "working_timeout": 3600,
            "chart": chart.id,
            "dashboard": None,
            "database": example_db.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 201

        # Test that report can be created with null chart
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new5",
            "description": "description",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "crontab": "0 9 * * *",
            "recipients": [
                {
                    "type": ReportRecipientType.EMAIL,
                    "recipient_config_json": {"target": "target@superset.org"},
                },
                {
                    "type": ReportRecipientType.SLACK,
                    "recipient_config_json": {"target": "channel"},
                },
            ],
            "working_timeout": 3600,
            "chart": None,
            "dashboard": dashboard.id,
            "database": example_db.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 201

        # Test that report cannot be created with null timezone
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new5",
            "description": "description",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "crontab": "0 9 * * *",
            "recipients": [
                {
                    "type": ReportRecipientType.EMAIL,
                    "recipient_config_json": {"target": "target@superset.org"},
                },
                {
                    "type": ReportRecipientType.SLACK,
                    "recipient_config_json": {"target": "channel"},
                },
            ],
            "working_timeout": 3600,
            "timezone": None,
            "dashboard": dashboard.id,
            "database": example_db.id,
        }
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 400
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {"message": {"timezone": ["Field may not be null."]}}

        # Test that report should reflect the timezone value passed in
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new6",
            "description": "description",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "crontab": "0 9 * * *",
            "recipients": [
                {
                    "type": ReportRecipientType.EMAIL,
                    "recipient_config_json": {"target": "target@superset.org"},
                },
                {
                    "type": ReportRecipientType.SLACK,
                    "recipient_config_json": {"target": "channel"},
                },
            ],
            "working_timeout": 3600,
            "timezone": "America/Los_Angeles",
            "dashboard": dashboard.id,
            "database": example_db.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        data = json.loads(rv.data.decode("utf-8"))
        assert data["result"]["timezone"] == "America/Los_Angeles"
        assert rv.status_code == 201

    @pytest.mark.usefixtures(
        "load_birth_names_dashboard_with_slices", "create_report_schedules"
    )
    def test_unsaved_report_schedule_schema(self):
        """
        ReportSchedule Api: Test create report schedule with unsaved chart
        """
        self.login(username="admin")
        chart = db.session.query(Slice).first()
        dashboard = db.session.query(Dashboard).first()
        example_db = get_example_database()

        report_schedule_data = {
            "type": ReportScheduleType.REPORT,
            "name": "name3",
            "description": "description",
            "creation_method": ReportCreationMethodType.CHARTS,
            "crontab": "0 9 * * *",
            "chart": 0,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 422
        assert (
            data["message"]["chart"]
            == "Please save your chart first, then try creating a new email report."
        )

    @pytest.mark.usefixtures(
        "load_birth_names_dashboard_with_slices", "create_report_schedules"
    )
    def test_no_dashboard_report_schedule_schema(self):
        """
        ReportSchedule Api: Test create report schedule with not dashboard id
        """
        self.login(username="admin")
        chart = db.session.query(Slice).first()
        dashboard = db.session.query(Dashboard).first()
        example_db = get_example_database()
        report_schedule_data = {
            "type": ReportScheduleType.REPORT,
            "name": "name3",
            "description": "description",
            "creation_method": ReportCreationMethodType.DASHBOARDS,
            "crontab": "0 9 * * *",
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 422
        assert (
            data["message"]["dashboard"]
            == "Please save your dashboard first, then try creating a new email report."
        )

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_create_report_schedule_chart_dash_validation(self):
        """
        ReportSchedule Api: Test create report schedule chart and dashboard validation
        """
        self.login(username="admin")

        # Test we can submit a chart or a dashboard not both
        chart = db.session.query(Slice).first()
        dashboard = db.session.query(Dashboard).first()
        example_db = get_example_database()
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new3",
            "description": "description",
            "crontab": "0 9 * * *",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "chart": chart.id,
            "dashboard": dashboard.id,
            "database": example_db.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {"message": {"chart": "Choose a chart or dashboard not both"}}

    @pytest.mark.usefixtures("create_report_schedules")
    def test_create_report_schedule_chart_db_validation(self):
        """
        ReportSchedule Api: Test create report schedule chart and database validation
        """
        self.login(username="admin")

        # Test database required for alerts
        chart = db.session.query(Slice).first()
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new3",
            "description": "description",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "crontab": "0 9 * * *",
            "chart": chart.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {"message": {"database": "Database is required for alerts"}}

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_create_report_schedule_relations_exist(self):
        """
        ReportSchedule Api: Test create report schedule
        relations (chart, dash, db) exist
        """
        self.login(username="admin")

        # Test chart and database do not exist
        chart_max_id = db.session.query(func.max(Slice.id)).scalar()
        database_max_id = db.session.query(func.max(Database.id)).scalar()
        examples_db = get_example_database()
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new3",
            "description": "description",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "crontab": "0 9 * * *",
            "chart": chart_max_id + 1,
            "database": database_max_id + 1,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {
            "message": {
                "chart": "Chart does not exist",
                "database": "Database does not exist",
            }
        }

        # Test dashboard does not exist
        dashboard_max_id = db.session.query(func.max(Dashboard.id)).scalar()
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new3",
            "description": "description",
            "crontab": "0 9 * * *",
            "creation_method": ReportCreationMethodType.ALERTS_REPORTS,
            "dashboard": dashboard_max_id + 1,
            "database": examples_db.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {"message": {"dashboard": "Dashboard does not exist"}}

    # @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    # TODO (AAfghahi): I am going to enable this when the report schedule feature is fully finished
    # def test_create_report_schedule_no_creation_method(self):
    #     """
    #     ReportSchedule Api: Test create report schedule
    #     """
    #     self.login(username="admin")

    #     chart = db.session.query(Slice).first()
    #     example_db = get_example_database()
    #     report_schedule_data = {
    #         "type": ReportScheduleType.ALERT,
    #         "name": "new3",
    #         "description": "description",
    #         "crontab": "0 9 * * *",
    #         "recipients": [
    #             {
    #                 "type": ReportRecipientType.EMAIL,
    #                 "recipient_config_json": {"target": "target@superset.org"},
    #             },
    #             {
    #                 "type": ReportRecipientType.SLACK,
    #                 "recipient_config_json": {"target": "channel"},
    #             },
    #         ],
    #         "grace_period": 14400,
    #         "working_timeout": 3600,
    #         "chart": chart.id,
    #         "database": example_db.id,
    #     }
    #     uri = "api/v1/report/"
    #     rv = self.client.post(uri, json=report_schedule_data)
    #     response = json.loads(rv.data.decode("utf-8"))
    #     assert response == {
    #         "message": {"creation_method": ["Missing data for required field."]}
    #     }
    #     assert rv.status_code == 400

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_create_report_schedule_invalid_creation_method(self):
        """
        ReportSchedule API: Test create report schedule
        """
        self.login(username="admin")

        chart = db.session.query(Slice).first()
        example_db = get_example_database()
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new3",
            "description": "description",
            "creation_method": "BAD_CREATION_METHOD",
            "crontab": "0 9 * * *",
            "recipients": [
                {
                    "type": ReportRecipientType.EMAIL,
                    "recipient_config_json": {"target": "target@superset.org"},
                },
                {
                    "type": ReportRecipientType.SLACK,
                    "recipient_config_json": {"target": "channel"},
                },
            ],
            "grace_period": 14400,
            "working_timeout": 3600,
            "chart": chart.id,
            "database": example_db.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        response = json.loads(rv.data.decode("utf-8"))
        assert response == {
            "message": {"creation_method": ["Invalid enum value BAD_CREATION_METHOD"]}
        }
        assert rv.status_code == 400

    @pytest.mark.usefixtures("create_report_schedules")
    def test_update_report_schedule(self):
        """
        ReportSchedule Api: Test update report schedule
        """
        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name2")
            .one_or_none()
        )

        self.login(username="admin")
        chart = db.session.query(Slice).first()
        example_db = get_example_database()
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "changed",
            "description": "description",
            "crontab": "0 10 * * *",
            "recipients": [
                {
                    "type": ReportRecipientType.EMAIL,
                    "recipient_config_json": {"target": "target@superset.org"},
                }
            ],
            "chart": chart.id,
            "database": example_db.id,
        }

        uri = f"api/v1/report/{report_schedule.id}"

        rv = self.client.put(uri, json=report_schedule_data)
        assert rv.status_code == 200
        updated_model = db.session.query(ReportSchedule).get(report_schedule.id)
        assert updated_model is not None
        assert updated_model.name == report_schedule_data["name"]
        assert updated_model.description == report_schedule_data["description"]
        assert len(updated_model.recipients) == 1
        assert updated_model.crontab == report_schedule_data["crontab"]
        assert updated_model.chart_id == report_schedule_data["chart"]
        assert updated_model.database_id == report_schedule_data["database"]

    @pytest.mark.usefixtures("create_working_report_schedule")
    def test_update_report_schedule_state_working(self):
        """
        ReportSchedule Api: Test update state in a working report
        """
        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name_working")
            .one_or_none()
        )

        self.login(username="admin")
        report_schedule_data = {"active": False}
        uri = f"api/v1/report/{report_schedule.id}"
        rv = self.client.put(uri, json=report_schedule_data)
        assert rv.status_code == 200
        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name_working")
            .one_or_none()
        )
        assert report_schedule.last_state == ReportState.NOOP

    @pytest.mark.usefixtures("create_report_schedules")
    def test_update_report_schedule_uniqueness(self):
        """
        ReportSchedule Api: Test update report schedule uniqueness
        """
        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name2")
            .one_or_none()
        )

        self.login(username="admin")
        report_schedule_data = {"name": "name3", "description": "changed_description"}
        uri = f"api/v1/report/{report_schedule.id}"
        rv = self.client.put(uri, json=report_schedule_data)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 422
        assert data == {"message": {"name": ["Name must be unique"]}}

    @pytest.mark.usefixtures("create_report_schedules")
    def test_update_report_schedule_not_found(self):
        """
        ReportSchedule Api: Test update report schedule not found
        """
        max_id = db.session.query(func.max(ReportSchedule.id)).scalar()

        self.login(username="admin")
        report_schedule_data = {"name": "changed"}
        uri = f"api/v1/report/{max_id + 1}"
        rv = self.client.put(uri, json=report_schedule_data)
        assert rv.status_code == 404

    @pytest.mark.usefixtures(
        "load_birth_names_dashboard_with_slices", "create_report_schedules"
    )
    def test_update_report_schedule_chart_dash_validation(self):
        """
        ReportSchedule Api: Test update report schedule chart and dashboard validation
        """
        self.login(username="admin")

        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name2")
            .one_or_none()
        )
        # Test we can submit a chart or a dashboard not both
        chart = db.session.query(Slice).first()
        dashboard = db.session.query(Dashboard).first()
        example_db = get_example_database()
        report_schedule_data = {
            "chart": chart.id,
            "dashboard": dashboard.id,
            "database": example_db.id,
        }
        uri = f"api/v1/report/{report_schedule.id}"
        rv = self.client.put(uri, json=report_schedule_data)
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {"message": {"chart": "Choose a chart or dashboard not both"}}

    @pytest.mark.usefixtures(
        "load_birth_names_dashboard_with_slices", "create_report_schedules"
    )
    def test_update_report_schedule_relations_exist(self):
        """
        ReportSchedule Api: Test update report schedule relations exist
        relations (chart, dash, db) exist
        """
        self.login(username="admin")

        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name2")
            .one_or_none()
        )

        # Test chart and database do not exist
        chart_max_id = db.session.query(func.max(Slice.id)).scalar()
        database_max_id = db.session.query(func.max(Database.id)).scalar()
        examples_db = get_example_database()
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new3",
            "description": "description",
            "crontab": "0 9 * * *",
            "chart": chart_max_id + 1,
            "database": database_max_id + 1,
        }
        uri = f"api/v1/report/{report_schedule.id}"
        rv = self.client.put(uri, json=report_schedule_data)
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {
            "message": {
                "chart": "Chart does not exist",
                "database": "Database does not exist",
            }
        }

        # Test dashboard does not exist
        dashboard_max_id = db.session.query(func.max(Dashboard.id)).scalar()
        report_schedule_data = {
            "type": ReportScheduleType.ALERT,
            "name": "new3",
            "description": "description",
            "crontab": "0 9 * * *",
            "dashboard": dashboard_max_id + 1,
            "database": examples_db.id,
        }
        uri = f"api/v1/report/{report_schedule.id}"
        rv = self.client.put(uri, json=report_schedule_data)
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {"message": {"dashboard": "Dashboard does not exist"}}

    @pytest.mark.usefixtures("create_report_schedules")
    @pytest.mark.usefixtures("create_alpha_users")
    def test_update_report_not_owned(self):
        """
        ReportSchedule API: Test update report not owned
        """
        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name2")
            .one_or_none()
        )

        self.login(username="alpha2", password="password")
        report_schedule_data = {
            "active": False,
        }
        uri = f"api/v1/report/{report_schedule.id}"
        rv = self.put_assert_metric(uri, report_schedule_data, "put")
        self.assertEqual(rv.status_code, 403)

    @pytest.mark.usefixtures("create_report_schedules")
    def test_delete_report_schedule(self):
        """
        ReportSchedule Api: Test update report schedule
        """
        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name1")
            .one_or_none()
        )
        self.login(username="admin")
        uri = f"api/v1/report/{report_schedule.id}"
        rv = self.client.delete(uri)
        assert rv.status_code == 200
        deleted_report_schedule = db.session.query(ReportSchedule).get(
            report_schedule.id
        )
        assert deleted_report_schedule is None
        deleted_recipients = (
            db.session.query(ReportRecipients)
            .filter(ReportRecipients.report_schedule_id == report_schedule.id)
            .all()
        )
        assert deleted_recipients == []
        deleted_logs = (
            db.session.query(ReportExecutionLog)
            .filter(ReportExecutionLog.report_schedule_id == report_schedule.id)
            .all()
        )
        assert deleted_logs == []

    @pytest.mark.usefixtures("create_report_schedules")
    def test_delete_report_schedule_not_found(self):
        """
        ReportSchedule Api: Test delete report schedule not found
        """
        max_id = db.session.query(func.max(ReportSchedule.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/report/{max_id + 1}"
        rv = self.client.delete(uri)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_report_schedules")
    @pytest.mark.usefixtures("create_alpha_users")
    def test_delete_report_not_owned(self):
        """
        ReportSchedule API: Test delete try not owned
        """
        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name2")
            .one_or_none()
        )

        self.login(username="alpha2", password="password")
        uri = f"api/v1/report/{report_schedule.id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 403)

    @pytest.mark.usefixtures("create_report_schedules")
    def test_bulk_delete_report_schedule(self):
        """
        ReportSchedule Api: Test bulk delete report schedules
        """
        query_report_schedules = db.session.query(ReportSchedule)
        report_schedules = query_report_schedules.all()

        report_schedules_ids = [
            report_schedule.id for report_schedule in report_schedules
        ]
        self.login(username="admin")
        uri = f"api/v1/report/?q={prison.dumps(report_schedules_ids)}"
        rv = self.client.delete(uri)
        assert rv.status_code == 200
        deleted_report_schedules = query_report_schedules.all()
        assert deleted_report_schedules == []
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "message": f"Deleted {len(report_schedules_ids)} report schedules"
        }
        assert response == expected_response

    @pytest.mark.usefixtures("create_report_schedules")
    def test_bulk_delete_report_schedule_not_found(self):
        """
        ReportSchedule Api: Test bulk delete report schedule not found
        """
        report_schedules = db.session.query(ReportSchedule).all()
        report_schedules_ids = [
            report_schedule.id for report_schedule in report_schedules
        ]
        max_id = db.session.query(func.max(ReportSchedule.id)).scalar()
        report_schedules_ids.append(max_id + 1)
        self.login(username="admin")
        uri = f"api/v1/report/?q={prison.dumps(report_schedules_ids)}"
        rv = self.client.delete(uri)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_report_schedules")
    @pytest.mark.usefixtures("create_alpha_users")
    def test_bulk_delete_report_not_owned(self):
        """
        ReportSchedule API: Test bulk delete try not owned
        """
        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name2")
            .one_or_none()
        )
        report_schedules_ids = [report_schedule.id]

        self.login(username="alpha2", password="password")
        uri = f"api/v1/report/?q={prison.dumps(report_schedules_ids)}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 403)

    @pytest.mark.usefixtures("create_report_schedules")
    def test_get_list_report_schedule_logs(self):
        """
        ReportSchedule Api: Test get list report schedules logs
        """
        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name3")
            .one_or_none()
        )

        self.login(username="admin")
        uri = f"api/v1/report/{report_schedule.id}/log/"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 3

    @pytest.mark.usefixtures("create_report_schedules")
    def test_get_list_report_schedule_logs_sorting(self):
        """
        ReportSchedule Api: Test get list report schedules logs
        """
        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name3")
            .one_or_none()
        )

        self.login(username="admin")
        uri = f"api/v1/report/{report_schedule.id}/log/"

        order_columns = [
            "state",
            "value",
            "error_message",
            "end_dttm",
            "start_dttm",
            "scheduled_dttm",
        ]

        for order_column in order_columns:
            arguments = {"order_column": order_column, "order_direction": "asc"}
            uri = f"api/v1/report/{report_schedule.id}/log/?q={prison.dumps(arguments)}"
            rv = self.get_assert_metric(uri, "get_list")
            if rv.status_code == 400:
                raise Exception(json.loads(rv.data.decode("utf-8")))
            assert rv.status_code == 200

    @pytest.mark.usefixtures("create_report_schedules")
    def test_get_list_report_schedule_logs_filters(self):
        """
        ReportSchedule Api: Test get list report schedules log filters
        """
        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name3")
            .one_or_none()
        )

        self.login(username="admin")
        arguments = {
            "columns": ["name"],
            "filters": [{"col": "state", "opr": "eq", "value": ReportState.SUCCESS}],
        }
        uri = f"api/v1/report/{report_schedule.id}/log/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")

        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 0

    @pytest.mark.usefixtures("create_report_schedules")
    def test_report_schedule_logs_no_mutations(self):
        """
        ReportSchedule Api: Test assert there's no way to alter logs
        """
        report_schedule = (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.name == "name3")
            .one_or_none()
        )

        data = {"state": ReportState.ERROR, "error_message": "New error changed"}

        self.login(username="admin")
        uri = f"api/v1/report/{report_schedule.id}/log/"
        rv = self.client.post(uri, json=data)
        assert rv.status_code == 405
        uri = f"api/v1/report/{report_schedule.id}/log/{report_schedule.logs[0].id}"
        rv = self.client.put(uri, json=data)
        assert rv.status_code == 405
        rv = self.client.delete(uri)
        assert rv.status_code == 405
