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
"""Chart lifecycle capture through API commands and dashboard activity reads."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
import sqlalchemy as sa
from sqlalchemy_continuum import versioning_manager

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.reports.models import (
    ReportCreationMethod,
    ReportSchedule,
    ReportScheduleType,
)
from superset.subjects.utils import get_user_subject
from superset.utils import json
from superset.utils.core import override_user
from superset.versioning.changes import version_changes_table
from superset.versioning.lifecycle import CHART_ARCHIVE_KIND
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import ADMIN_USERNAME, GAMMA_USERNAME


class TestChartArchiveActivity(SupersetTestCase):
    """Use isolated assets so permission and lifecycle assertions need no examples."""

    @pytest.fixture(autouse=True)
    def assets(self, app_context: Any) -> Iterator[None]:
        """Create two charts sharing a dashboard and clean up archived rows too."""
        admin = security_manager.find_user(ADMIN_USERNAME)
        editor = get_user_subject(admin.id)
        database = Database(
            database_name=f"archive-{uuid4()}", sqlalchemy_uri="sqlite://"
        )
        dataset = SqlaTable(
            table_name="archive_activity", database=database, editors=[editor]
        )
        db.session.add_all([database, dataset])
        db.session.flush()
        self.charts = [
            Slice(
                slice_name=f"Archive chart {index}",
                uuid=uuid4(),
                datasource_id=dataset.id,
                datasource_type="table",
                viz_type="table",
                params="{}",
                editors=[editor],
            )
            for index in range(2)
        ]
        self.dashboard = Dashboard(
            dashboard_title="Archive dashboard",
            uuid=uuid4(),
            slices=self.charts,
            editors=[editor],
        )
        db.session.add(self.dashboard)
        db.session.commit()
        self.dataset = dataset
        try:
            yield
        finally:
            db.session.rollback()
            cleanup_targets: list[
                tuple[type[Dashboard] | type[Slice] | type[SqlaTable], list[int]]
            ] = [
                (Dashboard, [self.dashboard.id]),
                (Slice, [chart.id for chart in self.charts]),
                (SqlaTable, [dataset.id]),
            ]
            for model, ids in cleanup_targets:
                for entity in (
                    db.session.query(model)
                    .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {model}})
                    .filter(model.id.in_(ids))
                ):
                    db.session.delete(entity)
            db.session.flush()
            db.session.delete(database)
            db.session.commit()

    def activity(self, **params: Any) -> list[dict[str, Any]]:
        """Read the actual dashboard DTO and assert the endpoint succeeds."""
        response = self.client.get(
            f"/api/v1/dashboard/{self.dashboard.uuid}/activity/", query_string=params
        )
        assert response.status_code == 200, response.data
        return json.loads(response.data)["result"]

    def archives(self, **params: Any) -> list[dict[str, Any]]:
        """Select archive announcements from the dashboard stream."""
        return [
            row for row in self.activity(**params) if row["kind"] == CHART_ARCHIVE_KIND
        ]

    @with_feature_flags(SOFT_DELETE=True, VERSION_HISTORY=True)
    def test_single_delete_has_archive_timestamp_and_no_content_version(self) -> None:
        """Single DELETE produces a related announcement with the capturing actor."""
        self.login(ADMIN_USERNAME)
        before = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)
        response = self.client.delete(f"/api/v1/chart/{self.charts[0].id}")
        assert response.status_code == 200, response.data
        rows = self.archives()
        assert len(rows) == 1
        row = rows[0]
        issued_at = datetime.fromisoformat(
            row["issued_at"].replace("Z", "+00:00")
        ).replace(tzinfo=None)
        # MySQL DATETIME can round the capture timestamp to the next second.
        after = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=1)
        assert before <= issued_at <= after
        assert row["summary"] == "Chart archived: Archive chart 0"
        assert row["source"] == "related"
        assert row["version_uuid"] is None
        assert row["first_tracked_save"] is False
        assert row["entity_deletion_state"] == "soft_deleted"
        assert row["changed_by"]["id"] == self.get_user(ADMIN_USERNAME).id
        assert self.archives(include="self") == []
        assert len(self.archives(include="related", q="archived", page_size=1)) == 1
        assert self.archives(q="not-the-chart") == []

    @with_feature_flags(SOFT_DELETE=True, VERSION_HISTORY=True)
    def test_bulk_delete_keeps_one_row_per_chart(self) -> None:
        """Bulk DELETE uses one lifecycle transaction and distinct chart records."""
        self.login(ADMIN_USERNAME)
        response = self.client.delete(
            "/api/v1/chart/",
            query_string={"q": json.dumps([chart.id for chart in self.charts])},
        )
        assert response.status_code == 200, response.data
        rows = self.archives()
        assert len(rows) == 2
        assert len({row["transaction_id"] for row in rows}) == 1
        assert {row["entity_name"] for row in rows} == {
            chart.slice_name for chart in self.charts
        }

    @with_feature_flags(SOFT_DELETE=True, VERSION_HISTORY=True)
    def test_direct_soft_delete_and_recovery_keep_chart_history_content_only(
        self,
    ) -> None:
        """Folder-style ORM deletion and recovery preserve the existing self probe."""
        self.login(ADMIN_USERNAME)
        chart = self.charts[0]
        for name in ["First save", "Second save"]:
            chart.slice_name = name
            db.session.commit()
        for _ in range(2):
            chart.soft_delete()
            db.session.commit()
            chart.restore()
            db.session.commit()
        rows = self.archives()
        assert len(rows) == 2
        assert all(row["entity_deletion_state"] is None for row in rows)
        response = self.client.get(
            f"/api/v1/chart/{chart.uuid}/activity/",
            query_string={"include": "self", "page_size": 1},
        )
        assert response.status_code == 200
        current = json.loads(response.data)["result"][0]
        assert current["kind"] != CHART_ARCHIVE_KIND
        assert current["version_uuid"] is not None
        assert current["to_value"] == "Second save"

    @with_feature_flags(SOFT_DELETE=True, VERSION_HISTORY=True)
    def test_capture_gap_membership_is_taken_at_archive(self) -> None:
        """Capture-disabled detach excludes stale windows; a later attach includes."""
        self.login(ADMIN_USERNAME)
        chart = self.charts[0]
        with patch.dict(versioning_manager.options, versioning=False):
            self.dashboard.slices.remove(chart)
            db.session.commit()
        chart.soft_delete()
        db.session.commit()
        assert self.archives() == []
        chart.restore()
        db.session.commit()
        with patch.dict(versioning_manager.options, versioning=False):
            self.dashboard.slices.append(chart)
            db.session.commit()
        chart.soft_delete()
        db.session.commit()
        assert len(self.archives()) == 1

    @with_feature_flags(SOFT_DELETE=True, VERSION_HISTORY=True)
    def test_dataset_read_grant_shows_archived_chart_without_actor_or_detail(
        self,
    ) -> None:
        """Dashboard editorship and dataset read access grant presence, not detail."""
        gamma = security_manager.find_user(GAMMA_USERNAME)
        self.dashboard.editors.append(get_user_subject(gamma.id))
        role = security_manager.find_role("Gamma")
        permission = security_manager.add_permission_view_menu(
            "datasource_access", self.dataset.perm
        )
        role.permissions.append(permission)
        db.session.commit()
        try:
            with override_user(security_manager.find_user(ADMIN_USERNAME)):
                self.charts[0].soft_delete()
                db.session.commit()
            self.login(GAMMA_USERNAME)
            rows = self.archives()
            assert len(rows) == 1
            assert rows[0]["entity_name"] == "Archive chart 0"
            assert rows[0]["changed_by"] is None
            assert rows[0]["to_value"] is None
            assert rows[0]["path"] is None
            security_manager.del_permission_role(role, permission)
            db.session.commit()
            assert self.archives() == []
        finally:
            security_manager.del_permission_role(role, permission)
            db.session.commit()

    @with_feature_flags(SOFT_DELETE=True, VERSION_HISTORY=True)
    def test_rolled_back_archive_leaves_no_activity(self) -> None:
        """An unsuccessful outer transaction cannot leave a committed announcement."""
        self.login(ADMIN_USERNAME)
        self.charts[0].soft_delete()
        db.session.flush()
        db.session.rollback()
        assert self.archives() == []
        assert (
            db.session.connection()
            .execute(
                sa.select(sa.func.count())
                .select_from(version_changes_table)
                .where(version_changes_table.c.kind == CHART_ARCHIVE_KIND)
            )
            .scalar()
            == 0
        )

    @with_feature_flags(SOFT_DELETE=True, VERSION_HISTORY=True)
    def test_report_blocked_delete_emits_no_archive(self) -> None:
        """A report validation failure never reaches archive capture."""
        report = ReportSchedule(
            type=ReportScheduleType.REPORT,
            name=f"Archive blocker {uuid4()}",
            crontab="0 9 * * *",
            chart=self.charts[0],
            creation_method=ReportCreationMethod.ALERTS_REPORTS,
        )
        db.session.add(report)
        db.session.commit()
        try:
            self.login(ADMIN_USERNAME)
            response = self.client.delete(f"/api/v1/chart/{self.charts[0].id}")
            assert response.status_code == 422
            assert self.archives() == []
        finally:
            db.session.delete(report)
            db.session.commit()

    @with_feature_flags(SOFT_DELETE=True, VERSION_HISTORY=True)
    def test_dashboard_read_without_editorship_cannot_read_archive_activity(
        self,
    ) -> None:
        """Version history retains the path editorship boundary."""
        self.charts[0].soft_delete()
        db.session.commit()
        self.login(GAMMA_USERNAME)
        response = self.client.get(f"/api/v1/dashboard/{self.dashboard.uuid}/activity/")
        assert response.status_code == 403

    @with_feature_flags(SOFT_DELETE=True, VERSION_HISTORY=True)
    def test_archived_dataset_presence_retains_read_and_editor_policy(self) -> None:
        """Archived related datasets remain read-gated with conservative detail."""
        gamma = security_manager.find_user(GAMMA_USERNAME)
        self.dashboard.editors.append(get_user_subject(gamma.id))
        self.dataset.description = "Dataset description before archive"
        db.session.commit()
        self.dataset.soft_delete()
        db.session.commit()
        self.login(GAMMA_USERNAME)
        assert not [row for row in self.activity() if row["entity_kind"] == "dataset"]
        role = security_manager.find_role("Gamma")
        permission = security_manager.add_permission_view_menu(
            "datasource_access", self.dataset.perm
        )
        role.permissions.append(permission)
        db.session.commit()
        try:
            rows = [row for row in self.activity() if row["entity_kind"] == "dataset"]
            assert rows
            assert all(row["entity_deletion_state"] == "soft_deleted" for row in rows)
            assert all(row["entity_name"] == self.dataset.table_name for row in rows)
            assert all(
                row["changed_by"] is None and row["to_value"] is None for row in rows
            )
            security_manager.del_permission_role(role, permission)
            self.dataset.editors.append(get_user_subject(gamma.id))
            db.session.commit()
            rows = [row for row in self.activity() if row["entity_kind"] == "dataset"]
            assert rows
            assert all(
                row["changed_by"] is None and row["to_value"] is None for row in rows
            )
        finally:
            security_manager.del_permission_role(role, permission)
            db.session.commit()

    @with_feature_flags(SOFT_DELETE=True, VERSION_HISTORY=True)
    def test_archived_chart_editor_can_read_presence_without_dataset_grant(
        self,
    ) -> None:
        """Archived chart editors retain presence but no archived raw detail."""
        gamma = security_manager.find_user(GAMMA_USERNAME)
        editor = get_user_subject(gamma.id)
        self.dashboard.editors.append(editor)
        self.charts[0].editors.append(editor)
        db.session.commit()
        self.charts[0].soft_delete()
        db.session.commit()
        self.login(GAMMA_USERNAME)
        rows = self.archives()
        assert len(rows) == 1
        assert rows[0]["entity_name"] == "Archive chart 0"
        assert rows[0]["changed_by"] is None
        assert rows[0]["to_value"] is None

    @with_feature_flags(SOFT_DELETE=True, VERSION_HISTORY=True, EMBEDDED_SUPERSET=True)
    def test_guest_cannot_read_archive_activity_even_with_role_editorship(self) -> None:
        """Guest tokens never gain history through an operator-granted editor role."""
        from flask import current_app

        from superset.security.guest_token import GuestTokenResourceType
        from superset.subjects.utils import subjects_from_roles

        guest_role = security_manager.find_role(current_app.config["GUEST_ROLE_NAME"])
        self.dashboard.editors.extend(subjects_from_roles([guest_role]))
        self.charts[0].soft_delete()
        db.session.commit()
        token = security_manager.create_guest_access_token(
            user={"username": "archive_guest"},
            resources=[
                {
                    "type": GuestTokenResourceType.DASHBOARD,
                    "id": str(self.dashboard.uuid),
                }
            ],
            rls=[],
        )
        response = self.client.get(
            f"/api/v1/dashboard/{self.dashboard.uuid}/activity/",
            headers={current_app.config["GUEST_TOKEN_HEADER_NAME"]: token},
        )
        assert response.status_code == 403

    @with_feature_flags(SOFT_DELETE=True, VERSION_HISTORY=True)
    def test_untracked_dashboard_shows_archive_without_original_version(self) -> None:
        """Archive membership can exist without inventing a dashboard baseline."""
        from sqlalchemy_continuum import version_class

        self.login(ADMIN_USERNAME)
        with patch.dict(versioning_manager.options, versioning=False):
            dashboard = Dashboard(
                dashboard_title="Untracked archive dashboard",
                uuid=uuid4(),
                slices=[self.charts[0]],
                editors=[get_user_subject(self.get_user(ADMIN_USERNAME).id)],
            )
            db.session.add(dashboard)
            db.session.commit()
        try:
            self.charts[0].soft_delete()
            db.session.commit()
            response = self.client.get(f"/api/v1/dashboard/{dashboard.uuid}/activity/")
            assert response.status_code == 200
            records = json.loads(response.data)["result"]
            assert [row["kind"] for row in records] == [CHART_ARCHIVE_KIND]
            assert records[0]["version_uuid"] is None
            shadow = version_class(Dashboard)
            assert (
                db.session.query(shadow).filter(shadow.id == dashboard.id).count() == 0
            )
        finally:
            db.session.delete(dashboard)
            db.session.commit()

    @with_feature_flags(SOFT_DELETE=True, VERSION_HISTORY=True)
    def test_fatal_capture_failure_rolls_back_delete_with_public_error(self) -> None:
        """Fatal capture rejects DELETE without leaking internal error details."""
        from superset.versioning.lifecycle import LifecycleCaptureFatalError

        self.login(ADMIN_USERNAME)
        chart_id = self.charts[0].id
        private_error = "private driver failure during archive capture"
        with patch(
            "superset.versioning.lifecycle._write_archive",
            side_effect=LifecycleCaptureFatalError(private_error),
        ):
            response = self.client.delete(f"/api/v1/chart/{chart_id}")
        assert response.status_code == 422
        assert private_error not in response.get_data(as_text=True)
        assert self.archives() == []
        db.session.expire_all()
        persisted = db.session.get(Slice, chart_id)
        assert persisted is not None
        assert persisted.deleted_at is None
