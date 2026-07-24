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
from __future__ import annotations

from unittest.mock import MagicMock, patch

from flask_limiter.errors import RateLimitExceeded

from superset.app import SupersetApp
from superset.views.users.api import _rate_limit_me_password_change, CurrentUserRestApi


def test_rate_limit_me_password_change_returns_429(app: SupersetApp) -> None:
    """RateLimitExceeded must surface as 429, not bubble into @safe as 500."""
    api = CurrentUserRestApi.__new__(CurrentUserRestApi)

    @_rate_limit_me_password_change
    def handler(self: CurrentUserRestApi) -> MagicMock:
        return self.response(200, result="ok")

    mock_limiter = MagicMock()

    def _raising_limit(*_args: object, **_kwargs: object):
        def _decorator(_view):
            def _wrapped(*__args: object, **__kwargs: object):
                limit = MagicMock()
                limit.error_message = None
                limit.limit = "1 per day"
                raise RateLimitExceeded(limit)

            return _wrapped

        return _decorator

    mock_limiter.limit.side_effect = _raising_limit

    with (
        app.test_request_context(),
        patch("superset.views.users.api.app") as mock_app,
        patch("superset.views.users.api.security_manager") as mock_sm,
        patch(
            "superset.views.users.api.get_auth_db_login_rate_limit_string",
            return_value="1 per day",
        ),
    ):
        mock_app.config.get.return_value = True
        mock_sm.limiter = mock_limiter
        response = handler(api)

    assert response.status_code == 429
    assert "Too many password change attempts" in response.get_json()["message"]
