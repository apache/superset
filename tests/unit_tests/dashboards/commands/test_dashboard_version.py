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
"""Unit tests for dashboard version snapshot and restore."""

import pytest

from superset import db, security_manager
from superset.commands.dashboard.restore_version import RestoreDashboardVersionCommand
from superset.commands.dashboard.update import UpdateDashboardCommand
from superset.daos.dashboard_version import DashboardVersionDAO
from superset.models.dashboard import Dashboard
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


def test_dao_update_comment_updates_and_returns_version():
    """DashboardVersionDAO.update_comment updates the version comment and returns it."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_update_comment_dashboard",
            slug="test-version-dashboard-update-comment",
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
                comment="Original description",
            )
            db.session.commit()
            version_id = version.id

            updated = DashboardVersionDAO.update_comment(
                version_id=version_id,
                dashboard_id=dashboard_id,
                comment="Updated description",
            )
            assert updated is not None
            assert updated.id == version_id
            assert updated.comment == "Updated description"
            db.session.refresh(version)
            assert version.comment == "Updated description"
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_dao_update_comment_returns_none_when_version_not_for_dashboard():
    """update_comment returns None when version does not belong to the dashboard."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_update_comment_not_found",
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
                comment="Keep",
            )
            db.session.commit()
            version_id = version.id
            wrong_dashboard_id = dashboard_id + 9999

            updated = DashboardVersionDAO.update_comment(
                version_id=version_id,
                dashboard_id=wrong_dashboard_id,
                comment="Should not apply",
            )
            assert updated is None
            db.session.refresh(version)
            assert version.comment == "Keep"
        finally:
            db.session.delete(dashboard)
            db.session.commit()


def test_dao_update_comment_empty_or_whitespace_becomes_none():
    """update_comment stores None when comment is empty or whitespace."""
    with app.app_context():
        user = security_manager.get_user_by_username("admin")
        if not user:
            pytest.skip("No admin user")
        dashboard = Dashboard(
            dashboard_title="test_update_comment_empty",
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
                comment="Something",
            )
            db.session.commit()
            version_id = version.id

            updated = DashboardVersionDAO.update_comment(
                version_id=version_id,
                dashboard_id=dashboard_id,
                comment="   ",
            )
            assert updated is not None
            assert updated.comment is None
            db.session.refresh(version)
            assert version.comment is None
        finally:
            db.session.delete(dashboard)
            db.session.commit()
