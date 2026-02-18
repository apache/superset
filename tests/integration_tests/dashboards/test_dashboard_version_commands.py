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
"""Integration tests for dashboard version commands and DAO.

These tests require a database with dashboard_versions table (run superset db upgrade).
"""

from unittest.mock import patch

import pytest

from superset import db, security_manager
from superset.commands.dashboard.exceptions import (
    DashboardForbiddenError,
    DashboardNotFoundError,
    DashboardVersionNotFoundError,
)
from superset.commands.dashboard.restore_version import RestoreDashboardVersionCommand
from superset.commands.dashboard.update import (
    UpdateDashboardColorsConfigCommand,
    UpdateDashboardCommand,
)
from superset.daos.dashboard_version import DashboardVersionDAO
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json as json_utils
from tests.integration_tests.test_app import app


def test_update_dashboard_creates_snapshot():
    """UpdateDashboardCommand creates a version snapshot on save."""
    # Minimal valid layout (must include ROOT_ID for process_tab_diff / tabs property)
    layout_v1 = (
        '{"ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]}, '
        '"GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": []}}'
    )
    layout_v2 = (
        '{"ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]}, '
        '"GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["ROW1"]}, '
        '"ROW1": {"id": "ROW1", "type": "ROW", "children": []}}'
    )
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_version_dashboard",
            slug="test-version-dashboard-snapshot",
            position_json=layout_v1,
            json_metadata='{"key": "value1"}',
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        dashboard_id = dashboard.id
        try:
            initial_versions = DashboardVersionDAO.get_versions_for_dashboard(
                dashboard_id
            )
            assert len(initial_versions) == 0

            with app.test_request_context():
                from flask import g

                g.user = user
                UpdateDashboardCommand(
                    dashboard_id,
                    {
                        "position_json": layout_v2,
                        "json_metadata": '{"key": "value2"}',
                        "owners": [user.id],
                        "roles": [],
                    },
                ).run()

            versions = DashboardVersionDAO.get_versions_for_dashboard(dashboard_id)
            assert len(versions) == 1
            assert versions[0].version_number == 1
            # Snapshot is post-update (saved state after this run)
            assert "ROW1" in (versions[0].position_json or "")
            assert "value2" in (versions[0].json_metadata or "")
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_restore_dashboard_version():
    """RestoreDashboardVersionCommand restores dashboard from a saved version."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_restore_dashboard",
            slug="test-version-dashboard-restore",
            position_json='{"new": "layout"}',
            json_metadata='{"new": "metadata"}',
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        dashboard_id = dashboard.id
        try:
            version = DashboardVersionDAO.create(
                dashboard_id=dashboard_id,
                version_number=1,
                position_json='{"old": "layout"}',
                json_metadata='{"old": "metadata"}',
                created_by_fk=user.id,
            )
            db.session.commit()
            version_id = version.id

            with app.test_request_context():
                from flask import g

                g.user = user
                RestoreDashboardVersionCommand(dashboard_id, version_id).run()

            db.session.refresh(dashboard)
            assert dashboard.position_json == '{"old": "layout"}'
            assert dashboard.json_metadata == '{"old": "metadata"}'
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_dao_update_description_updates_and_returns_version():
    """update_description updates the version description and returns it."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_update_description_dashboard",
            slug="test-version-dashboard-update-description",
            position_json="{}",
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        dashboard_id = dashboard.id
        try:
            version = DashboardVersionDAO.create(
                dashboard_id=dashboard_id,
                version_number=1,
                position_json="{}",
                json_metadata="{}",
                created_by_fk=user.id,
                description="Original description",
            )
            db.session.commit()
            version_id = version.id

            updated = DashboardVersionDAO.update_description(
                version_id=version_id,
                dashboard_id=dashboard_id,
                description="Updated description",
            )
            assert updated is not None
            assert updated.id == version_id
            assert updated.description == "Updated description"
            db.session.refresh(version)
            assert version.description == "Updated description"
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_dao_update_description_returns_none_when_version_not_for_dashboard():
    """update_description returns None when version does not belong to the dashboard."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_update_description_not_found",
            slug="test-version-dashboard-update-not-found",
            position_json="{}",
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        dashboard_id = dashboard.id
        try:
            version = DashboardVersionDAO.create(
                dashboard_id=dashboard_id,
                version_number=1,
                position_json="{}",
                json_metadata="{}",
                created_by_fk=user.id,
                description="Keep",
            )
            db.session.commit()
            version_id = version.id
            wrong_dashboard_id = dashboard_id + 9999

            updated = DashboardVersionDAO.update_description(
                version_id=version_id,
                dashboard_id=wrong_dashboard_id,
                description="Should not apply",
            )
            assert updated is None
            db.session.refresh(version)
            assert version.description == "Keep"
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_dao_update_description_empty_or_whitespace_becomes_none():
    """update_description stores None when description is empty or whitespace."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_update_description_empty",
            slug="test-version-dashboard-update-empty",
            position_json="{}",
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        dashboard_id = dashboard.id
        try:
            version = DashboardVersionDAO.create(
                dashboard_id=dashboard_id,
                version_number=1,
                position_json="{}",
                json_metadata="{}",
                created_by_fk=user.id,
                description="Something",
            )
            db.session.commit()
            version_id = version.id

            updated = DashboardVersionDAO.update_description(
                version_id=version_id,
                dashboard_id=dashboard_id,
                description="   ",
            )
            assert updated is not None
            assert updated.description is None
            db.session.refresh(version)
            assert version.description is None
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_restore_validate_dashboard_not_found():
    """RestoreDashboardVersionCommand.validate raises when dashboard does not exist."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        with app.test_request_context():
            from flask import g

            g.user = user
            bad_id = 999999
            cmd = RestoreDashboardVersionCommand(bad_id, 1)
            with pytest.raises(DashboardNotFoundError):
                cmd.validate()


def test_restore_validate_version_not_found():
    """RestoreDashboardVersionCommand.validate raises when version does not exist."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_restore_validate",
            slug="test-version-restore-validate",
            position_json="{}",
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            with app.test_request_context():
                from flask import g

                g.user = user
                cmd = RestoreDashboardVersionCommand(dashboard.id, 999999)
                with patch.object(
                    security_manager, "raise_for_ownership", return_value=None
                ):
                    with pytest.raises(DashboardVersionNotFoundError):
                        cmd.validate()
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_restore_validate_version_wrong_dashboard():
    """validate raises when version belongs to another dashboard."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dash1 = Dashboard(
            dashboard_title="test_restore_dash1",
            slug="test-version-restore-dash1",
            position_json="{}",
            json_metadata="{}",
            owners=[user],
        )
        dash2 = Dashboard(
            dashboard_title="test_restore_dash2",
            slug="test-version-restore-dash2",
            position_json="{}",
            json_metadata="{}",
            owners=[user],
        )
        db.session.add_all([dash1, dash2])
        db.session.commit()
        try:
            version = DashboardVersionDAO.create(
                dashboard_id=dash2.id,
                version_number=1,
                position_json="{}",
                json_metadata="{}",
                created_by_fk=user.id,
            )
            db.session.commit()
            with app.test_request_context():
                from flask import g

                g.user = user
                cmd = RestoreDashboardVersionCommand(dash1.id, version.id)
                with patch.object(
                    security_manager, "raise_for_ownership", return_value=None
                ):
                    with pytest.raises(DashboardVersionNotFoundError):
                        cmd.validate()
        finally:
            db.session.delete(dash1)
            db.session.delete(dash2)
            db.session.commit()


def test_restore_validate_forbidden():
    """validate raises DashboardForbiddenError when not owner."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_restore_forbidden",
            slug="test-version-restore-forbidden",
            position_json="{}",
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            version = DashboardVersionDAO.create(
                dashboard_id=dashboard.id,
                version_number=1,
                position_json="{}",
                json_metadata="{}",
                created_by_fk=user.id,
            )
            db.session.commit()
            with app.test_request_context():
                from flask import g

                g.user = user
                cmd = RestoreDashboardVersionCommand(dashboard.id, version.id)
                forbidden_error = SupersetError(
                    message="forbidden",
                    error_type=SupersetErrorType.DASHBOARD_SECURITY_ACCESS_ERROR,
                    level=ErrorLevel.ERROR,
                )
                with patch.object(
                    security_manager,
                    "raise_for_ownership",
                    side_effect=SupersetSecurityException(forbidden_error),
                ):
                    with pytest.raises(DashboardForbiddenError):
                        cmd.validate()
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_sync_slices_from_layout_empty_position():
    """_sync_slices_from_layout clears slices when position_json is empty."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_sync_empty",
            slug="test-version-sync-empty",
            position_json=None,
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            RestoreDashboardVersionCommand._sync_slices_from_layout(dashboard)
            db.session.expire(dashboard, ["slices"])
            assert dashboard.slices == []
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_sync_slices_from_layout_invalid_json():
    """_sync_slices_from_layout returns early when position_json is invalid."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_sync_invalid",
            slug="test-version-sync-invalid",
            position_json="not valid json",
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            RestoreDashboardVersionCommand._sync_slices_from_layout(dashboard)
            # No exception; invalid JSON path returns without persisting
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_sync_slices_from_layout_no_chart_components():
    """_sync_slices_from_layout persists empty slices when layout has no CHARTs."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        layout = (
            '{"ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]}, '
            '"GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": []}}'
        )
        dashboard = Dashboard(
            dashboard_title="test_sync_no_charts",
            slug="test-version-sync-no-charts",
            position_json=layout,
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            RestoreDashboardVersionCommand._sync_slices_from_layout(dashboard)
            db.session.expire(dashboard, ["slices"])
            assert dashboard.slices == []
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_sync_slices_from_layout_with_charts():
    """_sync_slices_from_layout persists slices matching CHART components in layout."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        slice_obj = Slice(
            slice_name="test_sync_chart",
            datasource_id=1,
            datasource_type="table",
            params="{}",
            owners=[user],
        )
        db.session.add(slice_obj)
        db.session.flush()
        layout = (
            '{"ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["CHART1"]}, '
            '"CHART1": {"id": "CHART1", "type": "CHART", "meta": {"chartId": '
            + str(slice_obj.id)
            + '}, "children": []}}'
        )
        dashboard = Dashboard(
            dashboard_title="test_sync_with_charts",
            slug="test-version-sync-with-charts",
            position_json=layout,
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            RestoreDashboardVersionCommand._sync_slices_from_layout(dashboard)
            db.session.expire(dashboard, ["slices"])
            assert len(dashboard.slices) == 1
            assert dashboard.slices[0].id == slice_obj.id
        finally:
            db.session.delete(dashboard)
            db.session.delete(slice_obj)
            db.session.commit()


def test_remove_orphaned_chart_components_no_position_or_slices():
    """_remove_orphaned_chart_components returns early when no position_json/slices."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_orphan_early",
            slug="test-version-orphan-early",
            position_json=None,
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            RestoreDashboardVersionCommand._remove_orphaned_chart_components(dashboard)
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_remove_orphaned_chart_components_invalid_json():
    """_remove_orphaned_chart_components returns early when position_json is invalid."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        slice_obj = Slice(
            slice_name="test_orphan_invalid",
            datasource_id=1,
            datasource_type="table",
            params="{}",
            owners=[user],
        )
        db.session.add(slice_obj)
        db.session.flush()
        dashboard = Dashboard(
            dashboard_title="test_orphan_invalid",
            slug="test-version-orphan-invalid",
            position_json="not json",
            json_metadata="{}",
            owners=[user],
            slices=[slice_obj],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            RestoreDashboardVersionCommand._remove_orphaned_chart_components(dashboard)
        finally:
            db.session.delete(dashboard)
            db.session.delete(slice_obj)
            db.session.commit()


def test_remove_orphaned_chart_components_removes_orphan_and_updates_parent():
    """_remove_orphaned_chart_components removes CHART not in slices; updates parent."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        slice_valid = Slice(
            slice_name="valid_slice",
            datasource_id=1,
            datasource_type="table",
            params="{}",
            owners=[user],
        )
        db.session.add(slice_valid)
        db.session.flush()
        # ROOT -> GRID -> [CHART_VALID, CHART_ORPHAN]; orphan chartId not in slices.
        grid_children = '["CHART_VALID", "CHART_ORPHAN"]'
        chart_orphan = '"CHART_ORPHAN": {"id": "CHART_ORPHAN", "type": "CHART", '
        chart_orphan += '"meta": {"chartId": 99999}, "parents": ["GRID_ID"]}'
        layout = (
            '{"ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]}, '
            '"GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": '
            + grid_children
            + "}, "
            '"CHART_VALID": {"id": "CHART_VALID", "type": "CHART", "meta": {"chartId": '
            + str(slice_valid.id)
            + '}, "parents": ["GRID_ID"]}, '
            + chart_orphan
            + "}"
        )
        dashboard = Dashboard(
            dashboard_title="test_orphan_removal",
            slug="test-version-orphan-removal",
            position_json=layout,
            json_metadata="{}",
            owners=[user],
            slices=[slice_valid],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            RestoreDashboardVersionCommand._remove_orphaned_chart_components(dashboard)
            # Orphan removed; parent children no longer contain CHART_ORPHAN.
            positions = json_utils.loads(dashboard.position_json or "{}")
            assert "CHART_ORPHAN" not in positions
            assert "CHART_VALID" in positions
            assert positions["GRID_ID"]["children"] == ["CHART_VALID"]
        finally:
            db.session.delete(dashboard)
            db.session.delete(slice_valid)
            db.session.commit()


def test_dao_get_next_version_number_when_no_versions():
    """get_next_version_number returns 1 when dashboard has no versions."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_dao_next",
            slug="test-version-dao-next",
            position_json="{}",
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            assert DashboardVersionDAO.get_next_version_number(dashboard.id) == 1
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_dao_get_by_id_returns_none():
    """get_by_id returns None for non-existent version."""
    with app.app_context():
        result = DashboardVersionDAO.get_by_id(999999)
        assert result is None


def test_dao_delete_older_than_keeps_n():
    """delete_older_than keeps the latest keep_n versions."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_dao_delete",
            slug="test-version-dao-delete",
            position_json="{}",
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            for i in range(5):
                DashboardVersionDAO.create(
                    dashboard_id=dashboard.id,
                    version_number=i + 1,
                    position_json="{}",
                    json_metadata="{}",
                    created_by_fk=user.id,
                )
            db.session.commit()
            versions_before = DashboardVersionDAO.get_versions_for_dashboard(
                dashboard.id
            )
            assert len(versions_before) == 5
            DashboardVersionDAO.delete_older_than(dashboard.id, keep_n=2)
            db.session.commit()
            versions_after = DashboardVersionDAO.get_versions_for_dashboard(
                dashboard.id
            )
            assert len(versions_after) == 2
            assert {v.version_number for v in versions_after} == {4, 5}
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_dao_delete_older_than_empty():
    """delete_older_than deletes all when there are no versions (keep_ids empty)."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_dao_delete_empty",
            slug="test-version-dao-delete-empty",
            position_json="{}",
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            DashboardVersionDAO.delete_older_than(dashboard.id, keep_n=2)
            db.session.commit()
            versions = DashboardVersionDAO.get_versions_for_dashboard(dashboard.id)
            assert len(versions) == 0
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_dao_create_with_description():
    """create stores description when provided."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_dao_create_desc",
            slug="test-version-dao-create-desc",
            position_json="{}",
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            v = DashboardVersionDAO.create(
                dashboard_id=dashboard.id,
                version_number=1,
                position_json="{}",
                json_metadata="{}",
                created_by_fk=user.id,
                description="First save",
            )
            db.session.commit()
            assert v.description == "First save"
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_update_snapshot_after_update_skipped_when_no_layout_or_metadata():
    """_snapshot_after_update skips version when no position_json/json_metadata."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_snapshot_skip",
            slug="test-version-snapshot-skip",
            position_json="{}",
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            initial_count = len(
                DashboardVersionDAO.get_versions_for_dashboard(dashboard.id)
            )
            with app.test_request_context():
                from flask import g

                g.user = user
                cmd = UpdateDashboardCommand(
                    dashboard.id,
                    {
                        "dashboard_title": "Updated",
                        "owners": [user.id],
                        "roles": [],
                    },
                )
                cmd.validate()
                assert cmd._model is not None
                cmd._snapshot_after_update(dashboard)
            after_count = len(
                DashboardVersionDAO.get_versions_for_dashboard(dashboard.id)
            )
            assert after_count == initial_count
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_update_colors_config_mark_updated_false_preserves_changed_on():
    """ColorsConfig(mark_updated=False) restores changed_on."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_colors_no_mark",
            slug="test-version-colors-no-mark",
            position_json="{}",
            json_metadata="{}",
            owners=[user],
        )
        db.session.add(dashboard)
        db.session.commit()
        try:
            original_changed_on = dashboard.changed_on
            with app.test_request_context():
                from flask import g

                g.user = user
                UpdateDashboardColorsConfigCommand(
                    dashboard.id,
                    {"color_scheme": "superset"},
                    mark_updated=False,
                ).run()
            db.session.refresh(dashboard)
            assert dashboard.changed_on == original_changed_on
        finally:
            db.session.delete(dashboard)
            db.session.commit()
