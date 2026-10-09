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
"""Admission to the Recently Archived shell.

The page fronts three independently-gated types, so admission is "can_read on
any of them" -- not chart-only, which stranded dashboard-only and dataset-only
roles outside a page whose APIs would happily serve them.
"""

from superset import db, security_manager
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.test_app import app  # noqa: F401


class TestArchivedShellAdmission(SupersetTestCase):
    def _user_with_read_on(self, suffix: str, resources: list[str]) -> str:
        """Create a user whose role reads exactly *resources*. Returns the
        username; the caller cleans up via _drop_user."""
        role_name = f"archived_probe_{suffix}"
        username = f"archived_probe_user_{suffix}"
        role = security_manager.add_role(role_name)
        for resource in resources:
            pvm = security_manager.find_permission_view_menu("can_read", resource)
            assert pvm is not None, f"missing pvm can_read {resource}"
            role.permissions.append(pvm)
        security_manager.add_user(
            username,
            "Probe",
            suffix,
            f"{username}@example.com",
            role,
            password="general",  # noqa: S106 -- test fixture credential
        )
        db.session.commit()
        return username

    def _drop_user(self, suffix: str) -> None:
        username = f"archived_probe_user_{suffix}"
        if user := security_manager.find_user(username):
            db.session.delete(user)
        if role := security_manager.find_role(f"archived_probe_{suffix}"):
            db.session.delete(role)
        db.session.commit()

    @with_feature_flags(SOFT_DELETE=True)
    def test_dashboard_only_reader_can_open_the_shell(self) -> None:
        """The widening this test pins: a role with only Dashboard read used
        to be refused by the chart-bound ``@has_access`` even though the
        dashboard archive APIs answered it directly."""
        username = self._user_with_read_on("dash", ["Dashboard"])
        try:
            self.login(username)
            rv = self.client.get("/archived/")
            assert rv.status_code == 200, rv.status_code
        finally:
            self.logout()
            self._drop_user("dash")

    @with_feature_flags(SOFT_DELETE=True)
    def test_reader_of_none_of_the_types_is_refused(self) -> None:
        username = self._user_with_read_on("none", [])
        try:
            self.login(username)
            rv = self.client.get("/archived/")
            assert rv.status_code == 403
        finally:
            self.logout()
            self._drop_user("none")

    @with_feature_flags(SOFT_DELETE=True)
    def test_unauthenticated_is_redirected_to_login(self) -> None:
        self.logout()
        rv = self.client.get("/archived/")
        assert rv.status_code == 302
        assert "login" in rv.headers["Location"]

    @with_feature_flags(SOFT_DELETE=True)
    def test_admin_can_open_the_shell(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self.client.get("/archived/")
        assert rv.status_code == 200

    @with_feature_flags(SOFT_DELETE=False)
    def test_flag_off_is_a_404_before_any_auth_question(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self.client.get("/archived/")
        assert rv.status_code == 404
