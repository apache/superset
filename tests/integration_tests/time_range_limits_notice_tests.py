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
"""The time range limits editor notice in the dashboard GET and its
acknowledgement, against a real database."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from itsdangerous import URLSafeTimedSerializer
from parameterized import parameterized

from superset import db, security_manager
from superset.daos.dashboard import EmbeddedDashboardDAO
from superset.key_value.models import KeyValueEntry
from superset.models.dashboard import Dashboard
from superset.security.guest_token import GuestTokenResourceType
from superset.subjects.utils import (
    get_or_create_group_subject,
    get_or_create_role_subject,
)
from superset.time_range_limits.notice import _notice_key
from superset.time_range_limits.policy import FEATURE_FLAG
from superset.utils import json
from tests.integration_tests.base_tests import subjects_from_users
from tests.integration_tests.conftest import LimitsTestCase, with_feature_flags
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    ALPHA_USERNAME,
    GAMMA_USERNAME,
)
from tests.integration_tests.fixtures.public_role import (  # noqa: F401
    public_role_like_gamma_scoped,
)
from tests.integration_tests.test_app import app

FLAG_ON = {FEATURE_FLAG: True}
FLAG_OFF = {FEATURE_FLAG: False}
NOTICE_URL = "/api/v1/time_range_limits/notice/"
PASSWORD = "general"  # noqa: S105


def global_config(**rules: Any) -> dict[str, Any]:
    return {
        "TIME_RANGE_LIMITS_GLOBAL": {
            "schema_version": 1,
            "max_span": None,
            "max_look_back": None,
            "max_look_forward": None,
            **rules,
        }
    }


def grain(quantity: int, time_grain: str) -> dict[str, Any]:
    return {"quantity": quantity, "time_grain": time_grain}


def without_version(policy: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in policy.items() if key != "schema_version"}


NO_LIMITS = {"TIME_RANGE_LIMITS_GLOBAL": None}
NOTICE_GLOBAL = global_config(max_span=grain(1, "P1Y"), max_look_back=grain(2, "P1Y"))
NOTICE_POLICY = without_version(NOTICE_GLOBAL["TIME_RANGE_LIMITS_GLOBAL"])


class TestEditorNotice(LimitsTestCase):
    """The notice reaches the dashboard's editors (user, role, group and extra
    editor subjects) and nobody else; "Got it" stores one marker per user."""

    @pytest.fixture(autouse=True)
    def _notice(self, _cleanup: None) -> Iterator[None]:
        self.user_ids: list[int] = []
        self.group_ids: list[int] = []
        self.role_ids: list[int] = []
        self.gone_user_ids: list[int] = []
        with app.app_context():
            self.delete_markers()
            dashboard = self.dashboard(title="Editor notice")
            dashboard.editors = subjects_from_users(
                [security_manager.find_user(ALPHA_USERNAME)]
            )
            db.session.commit()
            self.dashboard_id = dashboard.id
            self.dashboard_uuid = dashboard.uuid
        yield
        with app.app_context():
            db.session.rollback()
            self.delete_markers()
            item = db.session.get(Dashboard, self.dashboard_id)
            if item is not None:
                item.editors = []
                item.viewers = []
                item.embedded = []
                db.session.commit()
            for user_id in self.user_ids:
                if user := db.session.get(security_manager.user_model, user_id):
                    db.session.delete(user)
            for group_id in self.group_ids:
                if group := db.session.get(security_manager.group_model, group_id):
                    db.session.delete(group)
            for role_id in self.role_ids:
                if role := db.session.get(security_manager.role_model, role_id):
                    db.session.delete(role)
            db.session.commit()

    @property
    def url(self) -> str:
        return f"/api/v1/dashboard/{self.dashboard_id}/time_range_limits/"

    def set_editors(self, subjects: list[Any]) -> None:
        dashboard = db.session.get(Dashboard, self.dashboard_id)
        dashboard.editors = subjects
        db.session.commit()

    def make_user(
        self, username: str, roles: tuple[str, ...] = ("Gamma",), **kwargs: Any
    ) -> Any:
        user = security_manager.add_user(
            username,
            "notice",
            "user",
            f"{username}@fab.org",
            [security_manager.find_role(name) for name in roles],
            password=PASSWORD,
            **kwargs,
        )
        db.session.commit()
        self.user_ids.append(user.id)
        return user

    def notice_keys(self) -> list[Any]:
        user_ids = [user.id for user in security_manager.get_all_users()]
        return [_notice_key(user_id) for user_id in user_ids + self.gone_user_ids]

    def markers(self) -> list[KeyValueEntry]:
        """Every notice marker: the rows under ``APP`` keyed by a user's notice
        key, or by the id of a user deleted in the test."""
        db.session.expire_all()
        return (
            db.session.query(KeyValueEntry)
            .filter(
                KeyValueEntry.resource == "app",
                KeyValueEntry.uuid.in_(self.notice_keys()),
            )
            .all()
        )

    def marker_of(self, username: str) -> KeyValueEntry | None:
        db.session.expire_all()
        user = security_manager.find_user(username)
        return (
            db.session.query(KeyValueEntry)
            .filter_by(resource="app", uuid=_notice_key(user.id))
            .one_or_none()
        )

    def stored_marker(self, username: str) -> KeyValueEntry:
        row = self.marker_of(username)
        assert row is not None, username
        return row

    def delete_markers(self) -> None:
        for row in self.markers():
            db.session.delete(row)
        db.session.commit()

    def notice(self, **kwargs: Any) -> Any:
        response = self.client.get(self.url, **kwargs)
        assert response.status_code == 200, response.data
        return response.json["result"]["editor_notice"]

    def notice_of(self, username: str, password: str = PASSWORD) -> Any:
        self.login(username, password)
        try:
            return self.notice()
        finally:
            self.logout()

    def acknowledge(self, **kwargs: Any) -> Any:
        return self.client.put(NOTICE_URL, **kwargs)

    def csrf_token(self) -> str:
        """A valid CSRF token for this client's session, as Flask-WTF signs it."""
        raw = "editor-notice-csrf"
        with self.client.session_transaction() as session:
            session["csrf_token"] = raw
        secret = app.config.get("WTF_CSRF_SECRET_KEY") or app.secret_key
        return URLSafeTimedSerializer(secret, salt="wtf-csrf-token").dumps(raw)

    def guest_headers(self) -> dict[str, Any]:
        dashboard = db.session.get(Dashboard, self.dashboard_id)
        embedded = EmbeddedDashboardDAO.upsert(dashboard, [])
        db.session.commit()
        token = security_manager.create_guest_access_token(
            {"username": "notice_guest"},
            [{"type": GuestTokenResourceType.DASHBOARD, "id": str(embedded.uuid)}],
            [],
        )
        return {
            app.config["GUEST_TOKEN_HEADER_NAME"]: token.decode("utf-8")
            if isinstance(token, bytes)
            else token
        }

    @with_feature_flags(**FLAG_ON)
    def test_editor_sees_turned_on_once(self) -> None:
        self.login(ALPHA_USERNAME)
        with patch.dict(app.config, NOTICE_GLOBAL):
            before = self.notice()
            put = self.acknowledge(json={"max_span": None, "anything": 1})
            after = self.notice()
            again = self.acknowledge()
            after_again = self.notice()

        assert before == {"kind": "turned_on"}
        assert (put.status_code, put.json) == (200, {})
        assert after is None
        assert (again.status_code, again.json) == (200, {})
        assert after_again is None
        row = self.stored_marker(ALPHA_USERNAME)
        assert json.loads(row.value) == NOTICE_POLICY
        assert row.resource == "app"
        assert row.expires_on is None
        assert (row.created_by_fk, row.changed_by_fk) == (None, None)
        assert len(self.markers()) == 1

    @parameterized.expand(
        [
            ("new_rule", {"max_look_forward": grain(1, "P1M")}, "tightened"),
            ("shorter_value", {"max_span": grain(6, "P1M")}, "tightened"),
            ("shorter_other_unit", {"max_span": grain(90, "P1D")}, "tightened"),
            ("loosened", {"max_span": grain(2, "P1Y")}, None),
            ("rule_removed", {"max_look_back": None}, None),
            ("unchanged", {}, None),
        ]
    )
    @with_feature_flags(**FLAG_ON)
    def test_after_a_global_change(
        self, name: str, change: dict[str, Any], expected: str | None
    ) -> None:
        self.login(ALPHA_USERNAME)
        changed = global_config(**{**NOTICE_POLICY, **change})
        with patch.dict(app.config, NOTICE_GLOBAL):
            assert self.acknowledge().status_code == 200
        with patch.dict(app.config, changed):
            assert self.notice() == ({"kind": expected} if expected else None), name

    @parameterized.expand(
        [
            ("7_days_to_1_week", grain(7, "P1D"), grain(1, "P1W"), None),
            ("30_days_to_1_month", grain(30, "P1D"), grain(1, "P1M"), "tightened"),
            ("1_month_to_30_days", grain(1, "P1M"), grain(30, "P1D"), "tightened"),
            ("12_hours_to_2_days", grain(12, "PT1H"), grain(2, "P1D"), None),
            ("2_days_to_12_hours", grain(2, "P1D"), grain(12, "PT1H"), "tightened"),
        ]
    )
    @with_feature_flags(**FLAG_ON)
    def test_units_compared_by_their_longest_length(
        self,
        name: str,
        before: dict[str, Any],
        after: dict[str, Any],
        expected: str | None,
    ) -> None:
        self.login(ALPHA_USERNAME)
        with patch.dict(app.config, global_config(max_span=before)):
            assert self.acknowledge().status_code == 200
        with patch.dict(app.config, global_config(max_span=after)):
            assert self.notice() == ({"kind": expected} if expected else None), name

    @with_feature_flags(**FLAG_ON)
    def test_role_editor(self) -> None:
        role = security_manager.add_role("notice_editor_role")
        self.role_ids.append(role.id)
        self.make_user("notice_role_editor", roles=("Gamma", "notice_editor_role"))
        self.make_user("notice_role_other")
        self.set_editors([get_or_create_role_subject(role.id)])

        with patch.dict(app.config, NOTICE_GLOBAL):
            editor = self.notice_of("notice_role_editor")
            other = self.notice_of("notice_role_other")

        assert editor == {"kind": "turned_on"}
        assert other is None

    @with_feature_flags(**FLAG_ON)
    def test_group_editor(self) -> None:
        group = security_manager.add_group("notice_editor_group", "", "")
        self.group_ids.append(group.id)
        self.make_user("notice_group_editor", groups=[group])
        self.make_user("notice_group_other")
        self.set_editors([get_or_create_group_subject(group.id)])

        with patch.dict(app.config, NOTICE_GLOBAL):
            editor = self.notice_of("notice_group_editor")
            other = self.notice_of("notice_group_other")

        assert editor == {"kind": "turned_on"}
        assert other is None

    @with_feature_flags(**FLAG_ON)
    def test_admin_through_the_admin_role_subject(self) -> None:
        admin_role = security_manager.find_role("Admin")
        self.set_editors([get_or_create_role_subject(admin_role.id)])

        with patch.dict(app.config, NOTICE_GLOBAL):
            assert self.notice_of(ADMIN_USERNAME) == {"kind": "turned_on"}

    @with_feature_flags(**FLAG_ON)
    def test_a_failing_resolver_never_fails_the_get(self) -> None:
        resolver = MagicMock(side_effect=RuntimeError("resolver down"))
        with patch.dict(
            app.config, {**NOTICE_GLOBAL, "EXTRA_EDITORS_RESOLVER": resolver}
        ):
            editor = self.notice_of(ALPHA_USERNAME)
            other = self.notice_of(GAMMA_USERNAME)

        assert editor == {"kind": "turned_on"}
        assert other is None

    @with_feature_flags(**FLAG_ON)
    def test_viewer(self) -> None:
        dashboard = db.session.get(Dashboard, self.dashboard_id)
        dashboard.viewers = subjects_from_users(
            [security_manager.find_user(GAMMA_USERNAME)]
        )
        db.session.commit()

        with patch.dict(app.config, NOTICE_GLOBAL):
            assert self.notice_of(GAMMA_USERNAME) is None
            assert self.notice_of(ALPHA_USERNAME) == {"kind": "turned_on"}

    # each request carries a valid CSRF token, so with CSRF on
    # (WTF_CSRF_ENABLED at app start) only the route's own check refuses.

    @pytest.mark.usefixtures("public_role_like_gamma_scoped")
    @with_feature_flags(**FLAG_ON)
    def test_anonymous_put_is_403(self) -> None:
        with patch.dict(app.config, {**NOTICE_GLOBAL, "WTF_CSRF_ENABLED": True}):
            response = self.acknowledge(headers={"X-CSRFToken": self.csrf_token()})

        assert (response.status_code, response.json) == (403, {"message": "Forbidden"})
        assert self.markers() == []

    @pytest.mark.usefixtures("public_role_like_gamma_scoped")
    @with_feature_flags(**FLAG_ON, EMBEDDED_SUPERSET=True)
    def test_guest_put_is_403(self) -> None:
        with patch.dict(app.config, {**NOTICE_GLOBAL, "WTF_CSRF_ENABLED": True}):
            headers = {**self.guest_headers(), "X-CSRFToken": self.csrf_token()}
            response = self.acknowledge(headers=headers)

        assert (response.status_code, response.json) == (403, {"message": "Forbidden"})
        assert self.markers() == []

    @with_feature_flags(**FLAG_ON)
    def test_editor_put_with_csrf(self) -> None:
        self.login(ALPHA_USERNAME)
        with patch.dict(app.config, {**NOTICE_GLOBAL, "WTF_CSRF_ENABLED": True}):
            token = self.client.get("/api/v1/security/csrf_token/").json["result"]
            response = self.acknowledge(headers={"X-CSRFToken": token})

        assert (response.status_code, response.json) == (200, {})
        assert self.marker_of(ALPHA_USERNAME) is not None

    @with_feature_flags(**FLAG_ON)
    def test_deleting_a_user_with_a_marker(self) -> None:
        user = self.make_user("notice_deleted_editor", roles=("Alpha",))
        user_id = user.id
        self.gone_user_ids.append(user_id)
        self.login("notice_deleted_editor", PASSWORD)
        with patch.dict(app.config, NOTICE_GLOBAL):
            assert self.acknowledge().status_code == 200
        self.logout()
        row = self.stored_marker("notice_deleted_editor")
        assert (row.created_by_fk, row.changed_by_fk) == (None, None)

        db.session.delete(db.session.get(security_manager.user_model, user_id))
        db.session.commit()

        assert db.session.get(security_manager.user_model, user_id) is None
        assert len(self.markers()) == 1

    @with_feature_flags(**FLAG_OFF)
    def test_flag_off(self) -> None:
        self.login(ALPHA_USERNAME)
        with patch.dict(app.config, NOTICE_GLOBAL):
            put = self.acknowledge()
            get = self.client.get(self.url)

        assert put.status_code == 404
        assert get.status_code == 404
        assert self.markers() == []

    def every_endpoint(self) -> list[Any]:
        dashboard = f"/api/v1/dashboard/{self.dashboard_id}/time_range_limits/"
        dataset = "/api/v1/dataset/1/time_range_limits/"
        return [
            self.client.get("/api/v1/time_range_limits/"),
            self.client.post(
                "/api/v1/time_range_limits/chart_ranges/", json={"charts": []}
            ),
            self.acknowledge(),
            self.client.get(dashboard),
            self.client.put(dashboard, json={"policy": None}),
            self.client.get(f"{dashboard}charts/"),
            self.client.get(dataset),
            self.client.get(f"{dataset}charts/"),
        ]

    @with_feature_flags(**FLAG_OFF)
    def test_flag_off_anonymous_gets_404_on_every_endpoint(self) -> None:
        public = security_manager.get_public_role()
        original = list(public.permissions)
        public.permissions = []
        db.session.commit()
        try:
            with patch.dict(app.config, NOTICE_GLOBAL):
                responses = self.every_endpoint()
        finally:
            security_manager.get_public_role().permissions = original
            db.session.commit()

        assert [response.status_code for response in responses] == [404] * 8
        assert self.markers() == []

    @with_feature_flags(**FLAG_OFF)
    def test_flag_off_user_without_permissions_gets_404_on_every_endpoint(
        self,
    ) -> None:
        role = security_manager.add_role("notice_no_permissions")
        self.role_ids.append(role.id)
        self.make_user("notice_no_permissions", roles=("notice_no_permissions",))
        self.login("notice_no_permissions", PASSWORD)

        responses = self.every_endpoint()

        assert [response.status_code for response in responses] == [404] * 8

    @with_feature_flags(**FLAG_ON)
    def test_flag_on_answers_401_and_403_as_before(self) -> None:
        public = security_manager.get_public_role()
        original = list(public.permissions)
        public.permissions = []
        db.session.commit()
        try:
            anonymous = [r.status_code for r in self.every_endpoint()]
        finally:
            security_manager.get_public_role().permissions = original
            db.session.commit()
        role = security_manager.add_role("notice_no_permissions")
        self.role_ids.append(role.id)
        self.make_user("notice_no_permissions", roles=("notice_no_permissions",))
        self.login("notice_no_permissions", PASSWORD)
        without = [r.status_code for r in self.every_endpoint()]

        assert anonymous == [401] * 8
        assert without[0] == 403

    @with_feature_flags(**FLAG_ON)
    def test_notice_route_permission(self) -> None:
        """The route uses Dashboard ``can_read``: no new permission."""
        assert (
            security_manager.find_permission_view_menu("can_put_notice", "Dashboard")
            is None
        )
        self.login(GAMMA_USERNAME)
        with patch.dict(app.config, NOTICE_GLOBAL):
            response = self.acknowledge()
        assert response.status_code == 200
        self.logout()
        self.login(ADMIN_USERNAME)
        spec = self.client.get("/api/v1/_openapi").json
        assert "put" in spec["paths"][NOTICE_URL]
        dashboard_schema = spec["components"]["schemas"][
            "TimeRangeLimitsDashboardSchema"
        ]
        assert "editor_notice" in dashboard_schema["properties"]
        assert "time_grain_labels" in dashboard_schema["properties"]
        dataset_schema = spec["components"]["schemas"][
            "TimeRangeLimitsDatasetLimitsSchema"
        ]
        assert "time_grain_labels" in dataset_schema["properties"]
