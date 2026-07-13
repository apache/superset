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
"""Integration tests for the CSP allowlist REST API."""

import pytest

import tests.integration_tests.test_app  # noqa: F401
from superset import db
from superset.models.csp import CSPAllowlistEntry
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME, GAMMA_USERNAME


class TestCSPAllowlistApi(SupersetTestCase):
    def insert_entry(
        self,
        domain: str,
        directive: str = "frame-src",
    ) -> CSPAllowlistEntry:
        admin = self.get_user("admin")
        entry = CSPAllowlistEntry(
            domain=domain,
            directive=directive,
            created_by=admin,
            changed_by=admin,
        )
        db.session.add(entry)
        db.session.commit()
        return entry

    @pytest.fixture
    def create_entries(self):
        with self.create_app().app_context():
            entries = [
                self.insert_entry("https://a.example.com"),
                self.insert_entry("https://b.example.com"),
            ]
            yield entries
            for entry in entries:
                db.session.delete(entry)
            db.session.commit()

    @pytest.mark.usefixtures("create_entries")
    def test_get_list_as_admin(self):
        self.login(ADMIN_USERNAME)
        rv = self.client.get("/api/v1/csp_allowlist/")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] >= 2

    def test_gamma_cannot_list(self):
        """The CSPAllowlist view-menu is admin-only."""
        self.login(GAMMA_USERNAME)
        rv = self.client.get("/api/v1/csp_allowlist/")
        assert rv.status_code in (401, 403, 404)

    def test_admin_can_create_valid_entry(self):
        self.login(ADMIN_USERNAME)
        rv = self.client.post(
            "/api/v1/csp_allowlist/",
            json={"domain": "https://new.example.com", "directive": "frame-src"},
        )
        assert rv.status_code == 201
        data = json.loads(rv.data.decode("utf-8"))
        created = db.session.query(CSPAllowlistEntry).get(data["id"])
        assert created.domain == "https://new.example.com"
        db.session.delete(created)
        db.session.commit()

    def test_create_rejects_invalid_origin(self):
        self.login(ADMIN_USERNAME)
        rv = self.client.post(
            "/api/v1/csp_allowlist/",
            json={"domain": "https://*.evil.com/path"},
        )
        assert rv.status_code == 400
        assert (
            db.session.query(CSPAllowlistEntry)
            .filter_by(domain="https://*.evil.com/path")
            .first()
            is None
        )

    def test_create_rejects_disallowed_directive(self):
        self.login(ADMIN_USERNAME)
        rv = self.client.post(
            "/api/v1/csp_allowlist/",
            json={"domain": "https://ok.example.com", "directive": "script-src"},
        )
        assert rv.status_code == 400

    def test_gamma_cannot_create(self):
        self.login(GAMMA_USERNAME)
        rv = self.client.post(
            "/api/v1/csp_allowlist/",
            json={"domain": "https://nope.example.com"},
        )
        assert rv.status_code in (401, 403, 404)

    @pytest.mark.usefixtures("create_entries")
    def test_admin_can_delete(self):
        self.login(ADMIN_USERNAME)
        entry = (
            db.session.query(CSPAllowlistEntry)
            .filter_by(domain="https://a.example.com")
            .one()
        )
        rv = self.client.delete(f"/api/v1/csp_allowlist/{entry.id}")
        assert rv.status_code == 200
