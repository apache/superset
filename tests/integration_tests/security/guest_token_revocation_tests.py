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
import time
from datetime import datetime, timezone
from typing import Optional
from unittest.mock import patch

import pytest
from flask import request

from superset import db, security_manager
from superset.daos.dashboard import EmbeddedDashboardDAO
from superset.models.dashboard import Dashboard
from superset.security.guest_token import (
    GuestTokenResources,
    GuestTokenResourceType,
)
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices_class_scope,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.test_app import app


@patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    EMBEDDED_SUPERSET=True,
)
@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices_class_scope")
class TestGuestTokenRevocation(SupersetTestCase):
    def setUp(self) -> None:
        self.dash = self.get_dash_by_slug("births")
        self.embedded = EmbeddedDashboardDAO.upsert(self.dash, [])
        db.session.commit()

    def tearDown(self) -> None:
        self.embedded.guest_token_revoked_before = None
        db.session.commit()

    def _mint(self, iat: int) -> str:
        resources: GuestTokenResources = [
            {
                "type": GuestTokenResourceType.DASHBOARD,
                "id": str(self.embedded.uuid),
            }
        ]
        with patch.object(
            security_manager, "_get_current_epoch_time", return_value=iat
        ):
            token = security_manager.create_guest_access_token({}, resources, [])
        return token if isinstance(token, str) else token.decode()

    def _mint_with_dashboard_id(self, iat: int) -> str:
        # A legacy token whose resource id is the numeric dashboard id rather
        # than the embedded uuid.
        resources: GuestTokenResources = [
            {
                "type": GuestTokenResourceType.DASHBOARD,
                "id": str(self.dash.id),
            }
        ]
        with patch.object(
            security_manager, "_get_current_epoch_time", return_value=iat
        ):
            token = security_manager.create_guest_access_token({}, resources, [])
        return token if isinstance(token, str) else token.decode()

    def _validate(self, token: str) -> Optional[object]:
        header = app.config["GUEST_TOKEN_HEADER_NAME"]
        with app.test_request_context(headers={header: token}):
            return security_manager.get_guest_user_from_request(request)

    def test_token_issued_before_revocation_is_rejected(self) -> None:
        # Anchor all ``iat`` values at or before the real current time so PyJWT
        # does not reject a token as not-yet-valid (ImmatureSignatureError).
        base = int(time.time())
        token = self._mint(iat=base - 20)

        # Valid before any revocation.
        assert self._validate(token) is not None

        # Revoke at base - 10: tokens issued before that instant are rejected.
        self.embedded.guest_token_revoked_before = datetime.fromtimestamp(
            base - 10, timezone.utc
        ).replace(tzinfo=None)
        db.session.commit()
        assert self._validate(token) is None

        # A token issued after the revocation instant is still accepted.
        newer_token = self._mint(iat=base)
        assert self._validate(newer_token) is not None

    def test_revoke_endpoint_revokes_outstanding_tokens(self) -> None:
        base = int(time.time())
        token = self._mint(iat=base)
        assert self._validate(token) is not None

        self.login(username="admin")
        response = self.client.post(f"/api/v1/dashboard/{self.dash.id}/embedded/revoke")
        assert response.status_code == 200

        db.session.expire_all()
        assert self.embedded.guest_token_revoked_before is not None
        # The token issued before the revoke call is now rejected.
        assert self._validate(token) is None

    def test_revoking_one_dashboard_does_not_affect_others(self) -> None:
        base = int(time.time())
        token = self._mint(iat=base)
        self.embedded.guest_token_revoked_before = datetime.fromtimestamp(
            base + 10, timezone.utc
        ).replace(tzinfo=None)
        db.session.commit()
        # Token is revoked for this dashboard...
        assert self._validate(token) is None
        # ...but a token for a *different* (unrevoked) resource is unaffected.
        other_resources: GuestTokenResources = [
            {
                "type": GuestTokenResourceType.DASHBOARD,
                "id": "06383667-3e02-4e5e-843f-44e9c5896b6c",
            }
        ]
        with patch.object(
            security_manager, "_get_current_epoch_time", return_value=base
        ):
            raw_other_token = security_manager.create_guest_access_token(
                {}, other_resources, []
            )
        other_token = (
            raw_other_token
            if isinstance(raw_other_token, str)
            else raw_other_token.decode()
        )
        # Not revoked (no embedded config / no revoked_before for that id).
        assert self._validate(other_token) is not None

    def test_legacy_dashboard_id_token_is_revoked(self) -> None:
        # Tokens carrying a dashboard id (rather than the embedded uuid) must
        # also be subject to per-dashboard revocation. Anchor all ``iat`` values
        # at or before the real current time so PyJWT does not reject a token as
        # not-yet-valid (ImmatureSignatureError).
        base = int(time.time())
        token = self._mint_with_dashboard_id(iat=base - 20)
        assert self._validate(token) is not None

        self.embedded.guest_token_revoked_before = datetime.fromtimestamp(
            base - 10, timezone.utc
        ).replace(tzinfo=None)
        db.session.commit()
        assert self._validate(token) is None

        # A dashboard-id token issued after the revocation instant is accepted.
        assert self._validate(self._mint_with_dashboard_id(iat=base)) is not None

    def test_token_without_iat_is_treated_as_revoked(self) -> None:
        # A signed token that omits ``iat`` cannot be positioned against a
        # revocation instant, so it must fail closed.
        resources: GuestTokenResources = [
            {
                "type": GuestTokenResourceType.DASHBOARD,
                "id": str(self.embedded.uuid),
            }
        ]
        raw_token = security_manager.create_guest_access_token({}, resources, [])
        token = raw_token if isinstance(raw_token, str) else raw_token.decode()
        decoded = security_manager.parse_jwt_guest_token(token)
        assert security_manager._guest_token_is_revoked(  # noqa: SLF001
            {k: v for k, v in decoded.items() if k != "iat"}
        )

    def test_revoke_endpoint_no_embedded_config_is_noop_200(self) -> None:
        # Revoking a dashboard that has no embedded config is an idempotent
        # no-op, mirroring delete_embedded, rather than a 404.
        dash = Dashboard(dashboard_title="no-embed", slug="no-embed-revoke")
        db.session.add(dash)
        db.session.commit()
        try:
            self.login(username="admin")
            response = self.client.post(f"/api/v1/dashboard/{dash.id}/embedded/revoke")
            assert response.status_code == 200
        finally:
            db.session.delete(dash)
            db.session.commit()
