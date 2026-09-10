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
from click.testing import CliRunner
from flask import current_app
from pytest_mock import MockerFixture

from superset.cli.guest_token import revoke_guest_tokens


def test_revoke_guest_tokens_reports_new_version(
    mocker: MockerFixture, app_context: None
) -> None:
    """The command bumps the version and reports it on success (exit 0)."""
    current_app.config["GUEST_TOKEN_REVOCATION_ENABLED"] = True
    bump = mocker.patch(
        "superset.security.guest_token.bump_guest_token_revocation_version",
        return_value=7,
    )

    result = CliRunner().invoke(revoke_guest_tokens)

    assert result.exit_code == 0
    bump.assert_called_once_with()
    assert "Revoked outstanding guest tokens" in result.output
    assert "7" in result.output


def test_revoke_guest_tokens_warns_when_feature_disabled(
    mocker: MockerFixture, app_context: None
) -> None:
    """With the feature off, the command still bumps but emits a warning."""
    current_app.config["GUEST_TOKEN_REVOCATION_ENABLED"] = False
    bump = mocker.patch(
        "superset.security.guest_token.bump_guest_token_revocation_version",
        return_value=1,
    )

    result = CliRunner().invoke(revoke_guest_tokens)

    assert result.exit_code == 0
    bump.assert_called_once_with()
    assert "GUEST_TOKEN_REVOCATION_ENABLED is False" in result.output
    # The version is still bumped and reported even when not enforced.
    assert "Revocation version is now 1" in result.output
