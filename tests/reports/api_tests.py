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
from typing import List, Optional
import json

from flask_appbuilder.security.sqla.models import User
import pytest
import prison
from sqlalchemy.sql import func

import tests.test_app
from superset import db
from superset.models.core import Database
from superset.models.slice import Slice
from superset.models.dashboard import Dashboard
from superset.models.reports import (
    ReportSchedule,
    ReportRecipients,
    ReportExecutionLog,
    ReportScheduleType,
    ReportRecipientType,
    ReportLogState,
)

from tests.base_tests import SupersetTestCase
from superset.utils.core import get_example_database


REPORTS_COUNT = 10


class TestReportSchedulesApi(SupersetTestCase):
    def insert_report_schedule(
        self,
        type: str,
        name: str,
        crontab: str,
        sql: Optional[str] = None,
        description: Optional[str] = None,
        chart: Optional[Slice] = None,
        dashboard: Optional[Dashboard] = None,
        database: Optional[Database] = None,
        owners: Optional[List[User]] = None,
        validator_type: Optional[str] = None,
        validator_config_json: Optional[str] = None,
        log_retention: Optional[int] = None,
        grace_period: Optional[int] = None,
        recipients: Optional[List[ReportRecipients]] = None,
        logs: Optional[List[ReportExecutionLog]] = None,
    ) -> ReportSchedule:
        owners = owners or []
        recipients = recipients or []
        logs = logs or []
        report_schedule = ReportSchedule(
            type=type,
            name=name,
            crontab=crontab,
            sql=sql,
            description=description,
            chart=chart,
            dashboard=dashboard,
            database=database,
            owners=owners,
            validator_type=validator_type,
            validator_config_json=validator_config_json,
            log_retention=log_retention,
            grace_period=grace_period,
            recipients=recipients,
            logs=logs,
        )
        db.session.add(report_schedule)
        db.session.commit()
        return report_schedule

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
                            state=ReportLogState.ERROR,
                            error_message=f"Error {cy}",
                        )
                    )
                report_schedules.append(
                    self.insert_report_schedule(
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
            "chart": {"id": report_schedule.chart.id},
            "context_markdown": report_schedule.context_markdown,
            "crontab": report_schedule.crontab,
            "dashboard": None,
            "database": {"id": report_schedule.database.id},
            "description": report_schedule.description,
            "grace_period": report_schedule.grace_period,
            "id": report_schedule.id,
            "last_eval_dttm": report_schedule.last_eval_dttm,
            "last_state": report_schedule.last_state,
            "last_value": report_schedule.last_value,
            "last_value_row_json": report_schedule.last_value_row_json,
            "log_retention": report_schedule.log_retention,
            "name": report_schedule.name,
            "owners": [
                {"first_name": "admin", "id": 1, "last_name": "user"},
                {"first_name": "alpha", "id": 5, "last_name": "user"},
            ],
            "recipients": [
                {
                    "id": report_schedule.recipients[0].id,
                    "recipient_config_json": '{"target": "target0@email.com"}',
                    "type": "Email",
                }
            ],
            "type": report_schedule.type,
            "validator_config_json": report_schedule.validator_config_json,
            "validator_type": report_schedule.validator_type,
        }
        assert data["result"] == expected_result

    def test_info_report_schedule(self):
        """
        ReportSchedule API: Test info
        """
        self.login(username="admin")
        uri = f"api/v1/report/_info"
        rv = self.get_assert_metric(uri, "info")
        assert rv.status_code == 200

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
            "id",
            "last_eval_dttm",
            "last_state",
            "name",
            "owners",
            "recipients",
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
        uri = f"api/v1/report/"

        order_columns = [
            "active",
            "created_by.first_name",
            "changed_by.first_name",
            "changed_on",
            "changed_on_delta_humanized",
            "created_on",
            "name",
            "type",
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
        related_columns = ["created_by", "chart", "dashboard"]
        for related_column in related_columns:
            uri = f"api/v1/report/related/{related_column}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

    @pytest.mark.usefixtures("create_report_schedules")
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
        assert created_model.description == report_schedule_data["description"]
        assert created_model.crontab == report_schedule_data["crontab"]
        assert created_model.chart.id == report_schedule_data["chart"]
        assert created_model.database.id == report_schedule_data["database"]
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
            "crontab": "0 9 * * *",
            "chart": chart.id,
            "database": example_db.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {"message": {"name": ["Name must be unique"]}}

    @pytest.mark.usefixtures("create_report_schedules")
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
            "crontab": "0 9 * * *",
            "chart": chart.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {"message": {"database": "Database is required for alerts"}}

    @pytest.mark.usefixtures("create_report_schedules")
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
            "dashboard": dashboard_max_id + 1,
            "database": examples_db.id,
        }
        uri = "api/v1/report/"
        rv = self.client.post(uri, json=report_schedule_data)
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {"message": {"dashboard": "Dashboard does not exist"}}

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

    @pytest.mark.usefixtures("create_report_schedules")
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

    @pytest.mark.usefixtures("create_report_schedules")
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
        ]

        for order_column in order_columns:
            arguments = {"order_column": order_column, "order_direction": "asc"}
            uri = f"api/v1/report/{report_schedule.id}/log/?q={prison.dumps(arguments)}"
            rv = self.get_assert_metric(uri, "get_list")
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
            "filters": [{"col": "state", "opr": "eq", "value": ReportLogState.SUCCESS}],
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

        data = {"state": ReportLogState.ERROR, "error_message": "New error changed"}

        self.login(username="admin")
        uri = f"api/v1/report/{report_schedule.id}/log/"
        rv = self.client.post(uri, json=data)
        assert rv.status_code == 405
        uri = f"api/v1/report/{report_schedule.id}/log/{report_schedule.logs[0].id}"
        rv = self.client.put(uri, json=data)
        assert rv.status_code == 405
        rv = self.client.delete(uri)
        assert rv.status_code == 405
