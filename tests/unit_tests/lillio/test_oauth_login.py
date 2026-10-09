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
import sys
from pathlib import Path
from unittest.mock import MagicMock

import jwt
from flask import Flask, g


def test_okta_issuer_is_removed_from_internal_oauth_state(monkeypatch) -> None:
    lillio_path = Path(__file__).parents[3] / "docker/lillio"
    monkeypatch.syspath_prepend(str(lillio_path))
    sys.modules.pop("custom_sso_security_manager", None)

    from custom_sso_security_manager import LillioAuthOAuthView

    app = Flask(__name__)
    app.secret_key = "test-secret"  # noqa: S105
    app.add_url_rule(
        "/oauth-authorized/<provider>",
        endpoint="oauth_authorized",
        view_func=lambda provider: provider,
    )
    remote = MagicMock()
    remote.authorize_redirect.return_value = "redirected"
    appbuilder = MagicMock()
    appbuilder.sm.oauth_remotes = {"okta": remote}

    view = LillioAuthOAuthView()
    view.appbuilder = appbuilder

    with app.test_request_context(
        "/login/okta?iss=https%3A%2F%2Flillio.okta.com&next=%2Fwelcome%2F"
    ):
        g.user = MagicMock(is_authenticated=False)
        assert view.login("okta") == "redirected"

    state = remote.authorize_redirect.call_args.kwargs["state"]
    payload = jwt.decode(state, options={"verify_signature": False})
    assert "iss" not in payload
    assert payload["next"] == ["/welcome/"]
