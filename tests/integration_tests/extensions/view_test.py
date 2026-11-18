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
"""Tests for the extension page shell route on ``ExtensionsView``."""

from superset import db, security_manager
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME, GAMMA_USERNAME


class TestExtensionPagesView(SupersetTestCase):
    def test_anonymous_redirects_to_login(self):
        resp = self.client.get("/extensions/pages/acme.catalog.main")

        assert resp.status_code == 302
        assert resp.headers["Location"] == (
            "/login/?next=%2Fextensions%2Fpages%2Facme.catalog.main"
        )

    def test_signed_in_user_gets_spa_shell_for_page_and_sub_paths(self):
        self.login(ADMIN_USERNAME)

        for url in (
            "/extensions/pages/acme.catalog.main",
            "/extensions/pages/acme.catalog.main/",
            "/extensions/pages/acme.catalog.main/42/edit",
            # Unknown ids still get the shell; the client shows not-found.
            "/extensions/pages/nobody.registered.this",
        ):
            resp = self.client.get(url)

            assert resp.status_code == 200, url
            assert b'id="app"' in resp.data, url

    def test_gamma_user_gets_spa_shell(self):
        # Not gated on the admin-only `Extensions` view menu.
        self.login(GAMMA_USERNAME)

        resp = self.client.get("/extensions/pages/acme.catalog.main")

        assert resp.status_code == 200
        assert b'id="app"' in resp.data

    def test_custom_role_without_extension_permissions_gets_spa_shell(self):
        role_name = "ExtensionPagesCustomRole"
        username = "extension_pages_custom_user"
        security_manager.add_role(role_name)
        try:
            self.create_user_with_roles(username, [role_name])
            self.login(username)

            resp = self.client.get("/extensions/pages/acme.catalog.main/42")

            assert resp.status_code == 200
            assert b'id="app"' in resp.data
        finally:
            if user := security_manager.find_user(username):
                db.session.delete(user)
            db.session.delete(security_manager.find_role(role_name))
            db.session.commit()

    def test_extensions_list_stays_admin_only(self):
        self.login(GAMMA_USERNAME)

        resp = self.client.get("/extensions/list/")

        assert resp.status_code != 200
