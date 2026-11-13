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
"""The time range limits on the guarded request paths, against a real
database."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from unittest.mock import patch

import pytest
from flask_appbuilder.security.sqla.models import PermissionView, Role
from sqlalchemy import event

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dashboard import EmbeddedDashboardDAO
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.tasks import Task
from superset.security.guest_token import GuestTokenResourceType
from superset.tasks.async_queries import TIME_RANGE_LIMIT_PAYLOAD_KEY
from superset.tasks.scheduler import execute_task
from superset.time_range_limits import enforcement as time_range_enforcement
from superset.time_range_limits.policy import FEATURE_FLAG
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.fixtures.public_role import (  # noqa: F401
    public_role_like_gamma_scoped,
)
from tests.integration_tests.test_app import app
from tests.integration_tests.time_range_limits_utils import (
    GLOBAL_90_DAYS,
    query_context,
    span_policy,
    TABLE_NAME,
)

FLAG_ON = {FEATURE_FLAG: True}


GLOBAL_45_DAYS = {"TIME_RANGE_LIMITS_GLOBAL": span_policy(45)}
GUEST_LIMIT_EXTRA_KEYS = {
    "reason_code",
    "rule",
    "source",
    "limit",
    "actual",
    "timezone",
    "dashboard_id",
    "filter_id",
    "time_offset",
    "issue_codes",
}


@contextmanager
def guarded_table_queries() -> Iterator[list[str]]:
    """Records every query run against a dataset, by table name."""
    queried: list[str] = []
    run_query = SqlaTable.query

    def record(table: SqlaTable, query_obj: Any) -> Any:
        queried.append(table.table_name)
        return run_query(table, query_obj)

    with patch.object(SqlaTable, "query", record):
        yield queried


@contextmanager
def captured_task_dispatch() -> Iterator[list[dict[str, Any]]]:
    """Keeps scheduled tasks off the broker so the test runs them in-process."""
    dispatched: list[dict[str, Any]] = []
    with patch.object(
        execute_task, "delay", side_effect=lambda **kwargs: dispatched.append(kwargs)
    ):
        yield dispatched


def run_task(dispatch: dict[str, Any]) -> Task:
    # in-process run: keep the celery_app task_postrun teardown from removing
    # the test's session (it runs once superset.tasks.celery_app is imported)
    with patch.dict(app.config, {"CELERY_ALWAYS_EAGER": True}):
        execute_task.apply(kwargs=dispatch)
    db.session.expire_all()
    return db.session.query(Task).filter_by(uuid=dispatch["task_uuid"]).one()


def delete_task(task_uuid: str) -> None:
    db.session.delete(db.session.query(Task).filter_by(uuid=task_uuid).one())
    db.session.commit()


def set_dashboard_policy(dashboard_id: int, days: int) -> None:
    dashboard = db.session.get(Dashboard, dashboard_id)
    dashboard.json_metadata = json.dumps({"time_range_limits": span_policy(days)})
    db.session.commit()


@pytest.mark.usefixtures("limits_data")
class TestTimeRangeLimitsRequestPaths(SupersetTestCase):
    @pytest.fixture(autouse=True)
    def _ids(self, limits_data: dict[str, int]) -> None:
        self.ids = limits_data

    def assert_limit_error(
        self, response: Any, reason: str, source: str = "global"
    ) -> dict[str, Any]:
        assert response.status_code == 400, response.json
        (error,) = response.json["errors"]
        assert error["error_type"] == "TIME_RANGE_LIMIT_ERROR"
        assert error["extra"]["reason_code"] == reason
        if reason != "UNBOUNDED_RANGE":
            assert error["extra"]["source"] == source
        assert error["extra"]["issue_codes"][0]["code"] == 1042
        return error["extra"]

    def post_chart_data(self, time_range: str, **form_data: Any) -> Any:
        return self.client.post(
            "/api/v1/chart/data",
            json=query_context(self.ids["table"], time_range, **form_data),
        )

    @with_feature_flags(**FLAG_ON)
    def test_chart_data_rejects_a_range_over_the_global_limit(self) -> None:
        self.login(ADMIN_USERNAME)
        with patch.dict(app.config, GLOBAL_45_DAYS):
            rejected = self.post_chart_data("Last 60 days")
            allowed = self.post_chart_data("Last 30 days")

        self.assert_limit_error(rejected, "MAX_SPAN_EXCEEDED")
        assert allowed.status_code == 200

    def test_flag_off_runs_the_query_as_before(self) -> None:
        self.login(ADMIN_USERNAME)
        with patch.dict(app.config, GLOBAL_45_DAYS):
            response = self.post_chart_data("Last 60 days")

        assert response.status_code == 200

    @with_feature_flags(**FLAG_ON)
    def test_chart_data_on_a_dashboard_gets_the_dashboard_limit(self) -> None:
        self.login(ADMIN_USERNAME)
        with patch.dict(app.config, GLOBAL_90_DAYS):
            response = self.post_chart_data(
                "Last 60 days",
                dashboardId=self.ids["dashboard"],
                slice_id=self.ids["chart"],
            )

        extra = self.assert_limit_error(response, "MAX_SPAN_EXCEEDED", "dashboard")
        assert extra["dashboard_id"] == self.ids["dashboard"]

    @with_feature_flags(**FLAG_ON)
    def test_chart_data_with_an_unparsable_extra_time_filter_is_a_400(self) -> None:
        self.login(ADMIN_USERNAME)
        body = query_context(self.ids["table"], "Last 7 days")
        body["queries"][0]["filters"].append(
            {"col": "ds", "op": "TEMPORAL_RANGE", "val": "2025-01-01 : 2024-01-01"}
        )
        with patch.dict(app.config, GLOBAL_90_DAYS):
            response = self.client.post("/api/v1/chart/data", json=body)

        assert response.status_code == 400, response.json
        assert response.json["message"] == "From date cannot be larger than to date"

    @with_feature_flags(**FLAG_ON)
    def test_drill_to_detail_samples_get_the_dashboard_limit(self) -> None:
        self.login(ADMIN_USERNAME)
        with patch.dict(app.config, GLOBAL_90_DAYS):
            response = self.client.post(
                "/datasource/samples?datasource_type=table"
                f"&datasource_id={self.ids['table']}"
                f"&dashboard_id={self.ids['dashboard']}",
                json={
                    "filters": [
                        {"col": "ds", "op": "TEMPORAL_RANGE", "val": "Last 60 days"}
                    ]
                },
            )

        self.assert_limit_error(response, "MAX_SPAN_EXCEEDED", "dashboard")

    @with_feature_flags(**FLAG_ON)
    def test_a_new_filter_preview_gets_the_editor_message(self) -> None:
        self.login(ADMIN_USERNAME)
        dashboard = self.ids["dashboard"]
        with patch.dict(app.config, GLOBAL_90_DAYS):
            new_filter = self.post_chart_data(
                "No filter", type="NATIVE_FILTER", dashboardId=dashboard
            )
            saved_filter = self.post_chart_data(
                "No filter",
                type="NATIVE_FILTER",
                native_filter_id="NATIVE_FILTER-missing",
                dashboardId=dashboard,
            )
            no_type = self.post_chart_data("No filter", dashboardId=dashboard)

        chart_message = (
            "This chart requires a bounded time range. Ask a dashboard editor to "
            "add or scope a time range filter."
        )
        for response, message in (
            (
                new_filter,
                "Choose a start and an end date. Time range limits are on.",
            ),
            (saved_filter, chart_message),
            (no_type, chart_message),
        ):
            extra = self.assert_limit_error(response, "UNBOUNDED_RANGE")
            assert response.json["errors"][0]["message"] == message
            assert extra["dashboard_id"] == dashboard

    @with_feature_flags(**FLAG_ON)
    def test_warm_up_reports_the_limit_error(self) -> None:
        self.login(ADMIN_USERNAME)
        with patch.dict(app.config, GLOBAL_90_DAYS):
            response = self.client.put(
                "/api/v1/chart/warm_up_cache",
                json={
                    "chart_id": self.ids["chart"],
                    "dashboard_id": self.ids["dashboard"],
                },
            )

        assert response.status_code == 200
        (result,) = response.json["result"]
        (error,) = result["errors"]
        assert error["error_type"] == "TIME_RANGE_LIMIT_ERROR"
        assert error["extra"]["source"] == "dashboard"
        assert result["viz_error"] == error["message"]

    @with_feature_flags(**FLAG_ON)
    def test_explore_payload_carries_the_limits(self) -> None:
        self.login(ADMIN_USERNAME)
        with patch.dict(app.config, GLOBAL_90_DAYS):
            response = self.client.get(f"/api/v1/explore/?slice_id={self.ids['chart']}")

        assert response.status_code == 200
        limits = response.json["result"]["time_range_limits"]
        assert limits["global"]["max_span"] == {
            "quantity": 90,
            "time_grain": "P1D",
        }
        assert limits["dataset"]["max_span"] is None
        assert limits["timezone"]

    def test_explore_payload_has_no_limits_while_the_flag_is_off(self) -> None:
        self.login(ADMIN_USERNAME)
        response = self.client.get(f"/api/v1/explore/?slice_id={self.ids['chart']}")

        assert response.status_code == 200
        assert "time_range_limits" not in response.json["result"]

    def guest_headers(self) -> dict[str, str]:
        dashboard = db.session.get(Dashboard, self.ids["dashboard"])
        embedded = EmbeddedDashboardDAO.upsert(dashboard, [])
        db.session.commit()
        token = security_manager.create_guest_access_token(
            {"username": "time_range_limits_guest"},
            [{"type": GuestTokenResourceType.DASHBOARD, "id": str(embedded.uuid)}],
            [],
        )
        return {
            app.config["GUEST_TOKEN_HEADER_NAME"]: token.decode("utf-8")
            if isinstance(token, bytes)
            else token
        }

    def post_dashboard_chart_data(
        self, time_range: str, headers: dict[str, str] | None = None, **extra: Any
    ) -> Any:
        payload = query_context(
            self.ids["table"],
            time_range,
            dashboardId=self.ids["dashboard"],
            slice_id=self.ids["chart"],
        )
        return self.client.post(
            "/api/v1/chart/data", json={**payload, **extra}, headers=headers or {}
        )

    @contextmanager
    def guest_can_read_tasks(self) -> Iterator[None]:
        guest_role: Role | None = security_manager.find_role(
            app.config["GUEST_ROLE_NAME"]
        )
        read_task: PermissionView | None = security_manager.find_permission_view_menu(
            "can_read", "Task"
        )
        assert guest_role is not None
        assert read_task is not None
        added = read_task not in guest_role.permissions
        if added:
            security_manager.add_permission_role(guest_role, read_task)
        try:
            yield
        finally:
            if added:
                security_manager.del_permission_role(guest_role, read_task)

    @pytest.mark.usefixtures("public_role_like_gamma_scoped")
    @with_feature_flags(EMBEDDED_SUPERSET=True, **FLAG_ON)
    def test_embedded_guest_gets_the_limit_error_with_its_details(self) -> None:
        headers = self.guest_headers()
        with patch.dict(app.config, GLOBAL_90_DAYS):
            rejected = self.post_dashboard_chart_data("Last 60 days", headers)
            allowed = self.post_dashboard_chart_data("Last 20 days", headers)
            engine_error = SupersetErrorException(
                SupersetError(
                    message="relation warehouse_schema.secret_table does not exist",
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    level=ErrorLevel.ERROR,
                    extra={"sql": "SELECT * FROM warehouse_schema.secret_table"},
                )
            )
            with patch.object(SqlaTable, "query", side_effect=engine_error):
                other_error = self.post_dashboard_chart_data(
                    "Last 15 days", headers, force=True
                )

        extra = self.assert_limit_error(rejected, "MAX_SPAN_EXCEEDED", "dashboard")
        assert set(extra) == GUEST_LIMIT_EXTRA_KEYS
        assert extra["dashboard_id"] == self.ids["dashboard"]
        assert extra["limit"] == {"quantity": 30, "time_grain": "P1D"}
        assert b"SELECT" not in rejected.data.upper()
        assert allowed.status_code == 200
        (error,) = other_error.json["errors"]
        assert error["error_type"] == "GENERIC_BACKEND_ERROR"
        assert "secret_table" not in other_error.data.decode()

    @pytest.mark.usefixtures("public_role_like_gamma_scoped")
    @with_feature_flags(EMBEDDED_SUPERSET=True, **FLAG_ON)
    def test_embedded_guest_chart_ranges_error_hides_the_raw_message(self) -> None:
        headers = self.guest_headers()
        body = query_context(
            self.ids["table"],
            "Last 60 days",
            dashboardId=self.ids["dashboard"],
            slice_id=self.ids["chart"],
        )
        with (
            patch.dict(app.config, GLOBAL_90_DAYS),
            patch(
                "superset.time_range_limits.api.request_date_ranges",
                side_effect=Exception(
                    "relation warehouse_schema.secret_table does not exist"
                ),
            ),
        ):
            response = self.client.post(
                "/api/v1/time_range_limits/chart_ranges/",
                json={"charts": [{"key": "chart", "query_context": body}]},
                headers=headers,
            )

        assert response.status_code == 200, response.json
        (answer,) = response.json["result"]["charts"]
        assert answer["status"] == "error", answer
        (error,) = answer["error"]["body"]["errors"]
        assert error["error_type"] == "GENERIC_BACKEND_ERROR"
        assert error["message"] == "An error occurred while fetching the data."
        assert "secret_table" not in response.data.decode()

    @pytest.mark.usefixtures("public_role_like_gamma_scoped")
    @with_feature_flags(EMBEDDED_SUPERSET=True, GLOBAL_ASYNC_QUERIES=True, **FLAG_ON)
    def test_embedded_guest_resend_after_an_async_rejection_gets_the_details(
        self,
    ) -> None:
        headers = self.guest_headers()
        try:
            set_dashboard_policy(self.ids["dashboard"], 90)
            with (
                self.guest_can_read_tasks(),
                patch.dict(app.config, GLOBAL_90_DAYS),
                captured_task_dispatch() as dispatched,
            ):
                submitted = self.post_dashboard_chart_data(
                    "Last 50 days", headers, async_mode=True, force=True
                )
                assert submitted.status_code == 202, submitted.json
                set_dashboard_policy(self.ids["dashboard"], 30)
                (dispatch,) = dispatched
                self.addCleanup(delete_task, dispatch["task_uuid"])
                task = run_task(dispatch)
                resent = self.post_dashboard_chart_data("Last 50 days", headers)
        finally:
            set_dashboard_policy(self.ids["dashboard"], 30)

        assert task.status == "failure"
        assert task.payload_dict[TIME_RANGE_LIMIT_PAYLOAD_KEY] == ("MAX_SPAN_EXCEEDED")
        extra = self.assert_limit_error(resent, "MAX_SPAN_EXCEEDED", "dashboard")
        assert set(extra) == GUEST_LIMIT_EXTRA_KEYS

    @with_feature_flags(GLOBAL_ASYNC_QUERIES=True, **FLAG_ON)
    def test_async_task_fails_without_sql_when_the_policy_tightened_while_queued(
        self,
    ) -> None:
        self.login(ADMIN_USERNAME)
        try:
            set_dashboard_policy(self.ids["dashboard"], 90)
            with (
                patch.dict(app.config, GLOBAL_90_DAYS),
                captured_task_dispatch() as dispatched,
            ):
                submitted = self.post_dashboard_chart_data(
                    "Last 55 days", async_mode=True, force=True
                )
                assert submitted.status_code == 202, submitted.json
                set_dashboard_policy(self.ids["dashboard"], 30)
                (dispatch,) = dispatched
                self.addCleanup(delete_task, dispatch["task_uuid"])
                with guarded_table_queries() as rejected_statements:
                    task = run_task(dispatch)
                with guarded_table_queries() as allowed_statements:
                    allowed = self.post_dashboard_chart_data("Last 25 days", force=True)
        finally:
            set_dashboard_policy(self.ids["dashboard"], 30)

        assert task.status == "failure"
        assert task.payload_dict[TIME_RANGE_LIMIT_PAYLOAD_KEY] == ("MAX_SPAN_EXCEEDED")
        assert rejected_statements == []
        assert allowed.status_code == 200
        assert allowed_statements == [TABLE_NAME]

    @with_feature_flags(**FLAG_ON)
    def test_dashboard_the_chart_is_not_on_is_ignored(self) -> None:
        self.login(ADMIN_USERNAME)
        foreign = {
            "dashboardId": self.ids["other_dashboard"],
            "slice_id": self.ids["chart"],
        }
        own = {
            "dashboardId": self.ids["other_dashboard"],
            "slice_id": self.ids["other_chart"],
        }
        with patch.dict(app.config, GLOBAL_90_DAYS):
            ignored = self.post_chart_data("Last 60 days", **foreign)
            on_its_dashboard = self.post_chart_data("Last 60 days", **own)
        with patch.dict(app.config, GLOBAL_45_DAYS):
            global_limit = self.post_chart_data("Last 60 days", **foreign)

        assert ignored.status_code == 200, ignored.json
        self.assert_limit_error(on_its_dashboard, "MAX_SPAN_EXCEEDED", "dashboard")
        self.assert_limit_error(global_limit, "MAX_SPAN_EXCEEDED")

    @with_feature_flags(**FLAG_ON)
    def test_dashboard_chart_check_reads_no_slice_rows(self) -> None:
        self.login(ADMIN_USERNAME)
        charts = [
            Slice(
                slice_name=f"Time range limits member {index}",
                viz_type="table",
                datasource_type="table",
                datasource_id=self.ids["table"],
                params=json.dumps({"datasource": f"{self.ids['table']}__table"}),
            )
            for index in range(20)
        ]
        dashboard = Dashboard(
            dashboard_title="Time range limits twenty charts",
            slug="time-range-limits-twenty",
            slices=charts,
            json_metadata=json.dumps({}),
            published=True,
        )
        db.session.add(dashboard)
        db.session.commit()
        dashboard_id, chart_id = dashboard.id, charts[0].id

        def cleanup() -> None:
            stored = db.session.get(Dashboard, dashboard_id)
            stored.slices = []
            db.session.delete(stored)
            for chart in db.session.query(Slice).filter(
                Slice.slice_name.like("Time range limits member %")
            ):
                db.session.delete(chart)
            db.session.commit()

        self.addCleanup(cleanup)

        def check_statements() -> list[str]:
            statements: list[str] = []
            check = time_range_enforcement.check_query_context_date_ranges

            def record(*args: Any) -> None:
                statements.append(args[2])

            def recorded_check(query_context: Any) -> None:
                event.listen(db.engine, "before_cursor_execute", record)
                try:
                    check(query_context)
                finally:
                    event.remove(db.engine, "before_cursor_execute", record)

            db.session.expire_all()
            with (
                patch.dict(app.config, GLOBAL_90_DAYS),
                patch(
                    "superset.common.query_context_processor."
                    "check_query_context_date_ranges",
                    recorded_check,
                ),
            ):
                response = self.post_chart_data(
                    "Last 30 days", dashboardId=dashboard_id, slice_id=chart_id
                )
            assert response.status_code == 200, response.json
            return statements

        without_policy = check_statements()
        with patch.dict(app.config, GLOBAL_45_DAYS):
            refused = self.post_chart_data(
                "Last 60 days", dashboardId=dashboard_id, slice_id=chart_id
            )
        set_dashboard_policy(dashboard_id, 60)
        with_policy = check_statements()

        for statements in (without_policy, with_policy):
            assert not [sql for sql in statements if "slices.params" in sql]
        assert len(without_policy) == 2, without_policy
        assert len(with_policy) == 4, with_policy
        extra = self.assert_limit_error(refused, "MAX_SPAN_EXCEEDED")
        assert extra["dashboard_id"] == dashboard_id

    @with_feature_flags(**FLAG_ON)
    def test_escaped_dashboard_policy_key_is_applied(self) -> None:
        self.login(ADMIN_USERNAME)
        dashboard = db.session.get(Dashboard, self.ids["dashboard"])
        dashboard.json_metadata = (
            '{"time_range\\u005flimits": ' + json.dumps(span_policy(30)) + "}"
        )
        db.session.commit()

        with patch.dict(app.config, GLOBAL_90_DAYS):
            response = self.post_chart_data(
                "Last 60 days",
                dashboardId=self.ids["dashboard"],
                slice_id=self.ids["chart"],
            )

        self.assert_limit_error(response, "MAX_SPAN_EXCEEDED", "dashboard")

    @with_feature_flags(**FLAG_ON)
    def test_annotation_layer_gets_the_dashboard_limit(self) -> None:
        self.login(ADMIN_USERNAME)
        source = Slice(
            slice_name="Time range limits annotation source",
            viz_type="table",
            datasource_type="table",
            datasource_id=self.ids["table"],
            params=json.dumps({"datasource": f"{self.ids['table']}__table"}),
        )
        db.session.add(source)
        db.session.commit()
        source.query_context = json.dumps(
            query_context(self.ids["table"], "Last 5 years", slice_id=source.id)
        )
        db.session.commit()
        source_id = source.id

        def cleanup() -> None:
            db.session.delete(db.session.get(Slice, source_id))
            db.session.commit()

        self.addCleanup(cleanup)

        def post(**form_data: Any) -> Any:
            body = query_context(self.ids["table"], "Last 7 days", **form_data)
            body["queries"][0]["annotation_layers"] = [
                {
                    "name": "five years",
                    "annotationType": "TIME_SERIES",
                    "sourceType": "line",
                    "value": source_id,
                    "overrides": {},
                    "show": True,
                    "showLabel": False,
                    "showMarkers": False,
                }
            ]
            return self.client.post("/api/v1/chart/data", json=body)

        with patch.dict(app.config, {"TIME_RANGE_LIMITS_GLOBAL": None}):
            on_dashboard = post(
                dashboardId=self.ids["dashboard"], slice_id=self.ids["chart"]
            )
            alone = post(slice_id=self.ids["chart"])

        extra = self.assert_limit_error(on_dashboard, "MAX_SPAN_EXCEEDED", "dashboard")
        assert extra["dashboard_id"] == self.ids["dashboard"]
        assert alone.status_code == 200, alone.json
