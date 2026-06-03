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

from superset import db
from superset.models.user_attributes import UserAttribute
from tests.integration_tests.base_tests import SupersetTestCase

USERNAME = "session_invalidation_user"
PASSWORD = "general"  # noqa: S105


class TestSessionInvalidation(SupersetTestCase):
    def setUp(self) -> None:
        self.create_user(
            USERNAME,
            PASSWORD,
            "Admin",
            email="session_invalidation_user@fab.org",
        )
        db.session.commit()

    def tearDown(self) -> None:
        if user := self.get_user(USERNAME):
            db.session.query(UserAttribute).filter_by(user_id=user.id).delete()
            db.session.delete(user)
            db.session.commit()

    def _set_active(self, active: bool) -> None:
        # Update via the ORM so the after_update event fires (mirrors the
        # FAB admin UI / REST API path that flips ``active``).
        user = self.get_user(USERNAME)
        user.active = active
        db.session.commit()

    def test_disabling_user_forces_logout_of_active_session(self) -> None:
        self.login(USERNAME, PASSWORD)

        # Authenticated request works before the account is disabled.
        assert self.client.get("/api/v1/me/").status_code == 200

        # Disabling the account stamps the per-user invalidation epoch...
        self._set_active(False)
        user = self.get_user(USERNAME)
        attribute = (
            db.session.query(UserAttribute).filter_by(user_id=user.id).one_or_none()
        )
        assert attribute is not None
        assert attribute.sessions_invalidated_at is not None

        # ...so the previously-authenticated session is now forced out.
        assert self.client.get("/api/v1/me/").status_code != 200

    def test_active_user_session_is_unaffected(self) -> None:
        """A user who was never disabled (NULL epoch) is never logged out."""
        self.login(USERNAME, PASSWORD)
        assert self.client.get("/api/v1/me/").status_code == 200
        # No epoch was ever stamped.
        user = self.get_user(USERNAME)
        attribute = (
            db.session.query(UserAttribute).filter_by(user_id=user.id).one_or_none()
        )
        assert attribute is None or attribute.sessions_invalidated_at is None
        # Repeated requests stay authenticated.
        assert self.client.get("/api/v1/me/").status_code == 200
