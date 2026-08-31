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
"""Tests for the public ``/version`` endpoint redaction gate."""

from unittest.mock import MagicMock, patch

_FULL_METADATA = {
    "version_string": "4.0.0",
    "version_sha": "abcdef12",
    "build_number": "build-42",
    "full_sha": "abcdef1234567890",
}


def _version_payload(*, is_admin: bool, config_opt_in: bool) -> dict[str, object]:
    """Call the /version view and return the decoded JSON body."""
    from superset.views import health as health_module

    with (
        patch(
            "superset.utils.version.get_version_metadata",
            return_value=dict(_FULL_METADATA),
        ),
        patch("superset.security_manager") as mock_sm,
        patch.dict(
            health_module.app.config,
            {"EXPOSE_BUILD_DETAILS_TO_USERS": config_opt_in},
        ),
    ):
        mock_sm.is_admin = MagicMock(return_value=is_admin)
        with health_module.app.test_request_context():
            return health_module.version().get_json()


def test_version_endpoint_redacts_build_details_for_anonymous() -> None:
    """The unauthenticated /version endpoint must not leak build details."""
    payload = _version_payload(is_admin=False, config_opt_in=False)
    assert payload["version_string"] == "4.0.0"
    assert payload["version_sha"] == ""
    assert payload["build_number"] is None
    assert "full_sha" not in payload


def test_version_endpoint_exposes_build_details_to_admin() -> None:
    """Admins see the precise build details on /version."""
    payload = _version_payload(is_admin=True, config_opt_in=False)
    assert payload["version_sha"] == "abcdef12"
    assert payload["build_number"] == "build-42"


def test_version_endpoint_exposes_build_details_when_config_opts_in() -> None:
    """The config opt-in exposes build details on /version for everyone."""
    payload = _version_payload(is_admin=False, config_opt_in=True)
    assert payload["version_sha"] == "abcdef12"
    assert payload["build_number"] == "build-42"
