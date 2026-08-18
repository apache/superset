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
"""Integration tests for per-theme editors (Subject model)."""

import uuid
from typing import Generator

import pytest

import tests.integration_tests.test_app  # noqa: F401
from superset import db, security_manager
from superset.models.core import Theme
from superset.subjects.models import Subject
from superset.subjects.utils import get_or_create_user_subject
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME

THEME_WRITER_ROLE = "theme_writer_role"
THEME_WRITER_USER = "theme_writer"


def _user_subject(username: str) -> Subject:
    """Get (or lazily create) the USER-type Subject for a username."""
    user = security_manager.find_user(username=username)
    subject = get_or_create_user_subject(user.id)
    assert subject is not None
    db.session.commit()
    return subject


class TestThemeEditors(SupersetTestCase):
    @pytest.fixture
    def theme_writer(self) -> Generator[None, None, None]:
        """A non-admin user granted can_read/can_write on Theme only."""
        with self.create_app().app_context():
            user = self.create_user(
                THEME_WRITER_USER,
                "general",
                "Gamma",
                email=f"{THEME_WRITER_USER}@superset.org",
            )
            security_manager.add_role(THEME_WRITER_ROLE)
            role = security_manager.find_role(THEME_WRITER_ROLE)
            for perm_name in ("can_read", "can_write"):
                perm = security_manager.find_permission_view_menu(perm_name, "Theme")
                security_manager.add_permission_role(role, perm)
            user.roles.append(role)
            db.session.commit()

            yield

            db.session.delete(user)
            db.session.delete(role)
            db.session.commit()

    def _insert_theme(
        self,
        name: str,
        editors: list[Subject],
        is_system: bool = False,
    ) -> Theme:
        theme = Theme(
            theme_name=name,
            json_data=json.dumps({"colors": {"primary": "#1890ff"}}),
            is_system=is_system,
            editors=editors,
        )
        db.session.add(theme)
        db.session.commit()
        return theme

    @pytest.mark.usefixtures("theme_writer")
    def test_create_theme_adds_creator_as_editor(self):
        """POST as a non-admin writer auto-adds the creator as an editor."""
        self.login(THEME_WRITER_USER)
        writer_subject_id = _user_subject(THEME_WRITER_USER).id
        name = f"created_theme_{uuid.uuid4().hex[:8]}"
        rv = self.client.post(
            "/api/v1/theme/",
            json={
                "theme_name": name,
                "json_data": json.dumps({"colors": {"primary": "#111111"}}),
            },
        )
        assert rv.status_code == 201
        theme = db.session.query(Theme).filter_by(theme_name=name).one()
        assert writer_subject_id in [s.id for s in theme.editors]

        db.session.delete(theme)
        db.session.commit()

    @pytest.mark.usefixtures("theme_writer")
    def test_non_editor_cannot_update(self):
        """A writer who is not an editor gets 403 on PUT."""
        admin_subject = _user_subject(ADMIN_USERNAME)
        theme = self._insert_theme(
            f"admin_theme_{uuid.uuid4().hex[:8]}", [admin_subject]
        )

        self.login(THEME_WRITER_USER)
        rv = self.client.put(
            f"/api/v1/theme/{theme.id}",
            json={
                "theme_name": "hacked",
                "json_data": json.dumps({"colors": {"primary": "#000000"}}),
            },
        )
        assert rv.status_code == 403

        db.session.delete(theme)
        db.session.commit()

    @pytest.mark.usefixtures("theme_writer")
    def test_non_editor_cannot_add_self_via_put(self):
        """Editorship is checked before the editors payload is applied."""
        admin_subject = _user_subject(ADMIN_USERNAME)
        writer_subject = _user_subject(THEME_WRITER_USER)
        theme = self._insert_theme(
            f"admin_theme_{uuid.uuid4().hex[:8]}", [admin_subject]
        )

        self.login(THEME_WRITER_USER)
        rv = self.client.put(
            f"/api/v1/theme/{theme.id}",
            json={
                "theme_name": theme.theme_name,
                "json_data": theme.json_data,
                "editors": [writer_subject.id],
            },
        )
        assert rv.status_code == 403
        refreshed = db.session.query(Theme).get(theme.id)
        assert writer_subject.id not in [s.id for s in refreshed.editors]

        db.session.delete(theme)
        db.session.commit()

    @pytest.mark.usefixtures("theme_writer")
    def test_non_editor_cannot_delete(self):
        """A writer who is not an editor gets 403 on DELETE."""
        admin_subject = _user_subject(ADMIN_USERNAME)
        theme = self._insert_theme(
            f"admin_theme_{uuid.uuid4().hex[:8]}", [admin_subject]
        )

        self.login(THEME_WRITER_USER)
        rv = self.client.delete(f"/api/v1/theme/{theme.id}")
        assert rv.status_code == 403
        assert db.session.query(Theme).get(theme.id) is not None

        db.session.delete(theme)
        db.session.commit()

    @pytest.mark.usefixtures("theme_writer")
    def test_admin_can_update_non_owned_theme(self):
        """Admins bypass the editorship check."""
        writer_subject = _user_subject(THEME_WRITER_USER)
        theme = self._insert_theme(
            f"writer_theme_{uuid.uuid4().hex[:8]}", [writer_subject]
        )

        self.login(ADMIN_USERNAME)
        rv = self.client.put(
            f"/api/v1/theme/{theme.id}",
            json={
                "theme_name": "admin_updated",
                "json_data": json.dumps({"colors": {"primary": "#abcdef"}}),
            },
        )
        assert rv.status_code == 200
        assert db.session.query(Theme).get(theme.id).theme_name == "admin_updated"

        db.session.delete(theme)
        db.session.commit()

    @pytest.mark.usefixtures("theme_writer")
    def test_editor_cannot_lock_self_out(self):
        """Clearing editors keeps the acting non-admin editor in place."""
        writer_subject = _user_subject(THEME_WRITER_USER)
        theme = self._insert_theme(
            f"writer_theme_{uuid.uuid4().hex[:8]}", [writer_subject]
        )

        self.login(THEME_WRITER_USER)
        rv = self.client.put(
            f"/api/v1/theme/{theme.id}",
            json={
                "theme_name": theme.theme_name,
                "json_data": theme.json_data,
                "editors": [],
            },
        )
        assert rv.status_code == 200
        refreshed = db.session.query(Theme).get(theme.id)
        assert writer_subject.id in [s.id for s in refreshed.editors]

        db.session.delete(theme)
        db.session.commit()

    @pytest.mark.usefixtures("theme_writer")
    def test_related_editors_endpoint(self):
        """The related/editors endpoint returns selectable subjects."""
        self.login(ADMIN_USERNAME)
        rv = self.client.get("/api/v1/theme/related/editors")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert "result" in data

    @pytest.mark.usefixtures("theme_writer")
    def test_system_theme_update_forbidden(self):
        """System themes remain protected regardless of editorship."""
        writer_subject = _user_subject(THEME_WRITER_USER)
        theme = self._insert_theme(
            f"system_theme_{uuid.uuid4().hex[:8]}",
            [writer_subject],
            is_system=True,
        )

        self.login(THEME_WRITER_USER)
        rv = self.client.put(
            f"/api/v1/theme/{theme.id}",
            json={
                "theme_name": "changed",
                "json_data": theme.json_data,
            },
        )
        assert rv.status_code == 403

        db.session.delete(theme)
        db.session.commit()
