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
"""Unit tests for auth-outcome error handling in ``CurrentUserRestApi``.

The three ``/api/v1/me/`` endpoints resolve ``g.user`` (a flask-login lazy
proxy) inside their bodies. For a validly-authenticated JWT whose bearer has
no assigned role, that resolution raises ``UserLookupError``; a missing/invalid
authorization context raises ``NoAuthorizationError``. Neither is an
"unexpected" server failure -- both are auth outcomes and must surface as a
clean ``401``, not fall through to ``@safe``'s generic ``500`` handler.
"""

from __future__ import annotations

from typing import Any, Callable

import pytest
from flask_jwt_extended.exceptions import NoAuthorizationError, UserLookupError
from pytest_mock import MockerFixture


class _RaisingG:
    """Stand-in for the request-global whose ``user`` attribute raises.

    Mirrors flask-login's lazy proxy: nothing fails until ``g.user`` is
    actually dereferenced inside the endpoint body.
    """

    def __init__(self, exc: Exception) -> None:
        self._exc = exc

    @property
    def user(self) -> Any:
        raise self._exc


# ``UserLookupError`` requires ``(message, jwt_header, jwt_data)``; the values
# of the latter two are irrelevant to the handler under test, which keys only
# off the exception type.
_USER_LOOKUP_ERROR = UserLookupError("No access", {}, {})
_NO_AUTH_ERROR = NoAuthorizationError("Missing Authorization Header")


@pytest.fixture
def raise_on_g_user(
    mocker: MockerFixture,
) -> Callable[[Exception], None]:
    """Patch the module-level ``g`` in the users API so ``g.user`` raises.

    Returns a setter the test calls with the exception it wants raised, so a
    single fixture covers both the ``UserLookupError`` and
    ``NoAuthorizationError`` cases.
    """

    def _set(exc: Exception) -> None:
        mocker.patch("superset.views.users.api.g", _RaisingG(exc))

    return _set


@pytest.mark.parametrize(
    "exc",
    [_USER_LOOKUP_ERROR, _NO_AUTH_ERROR],
    ids=["user_lookup_error", "no_authorization_error"],
)
@pytest.mark.parametrize(
    "path",
    ["/api/v1/me/", "/api/v1/me/roles/"],
    ids=["get_me", "get_my_roles"],
)
def test_get_endpoints_return_401_not_500_on_auth_error(
    client: Any,
    full_api_access: None,
    raise_on_g_user: Any,
    path: str,
    exc: Exception,
) -> None:
    """``GET /api/v1/me/`` and ``/api/v1/me/roles/`` translate an auth-outcome
    exception raised while resolving ``g.user`` into a ``401`` -- not the
    generic ``500`` that ``@safe`` would produce for an uncaught exception.
    """
    raise_on_g_user(exc)

    response = client.get(path)

    assert response.status_code == 401


@pytest.mark.parametrize(
    "exc",
    [_USER_LOOKUP_ERROR, _NO_AUTH_ERROR],
    ids=["user_lookup_error", "no_authorization_error"],
)
def test_update_me_returns_401_not_500_on_auth_error(
    client: Any,
    full_api_access: None,
    raise_on_g_user: Any,
    exc: Exception,
) -> None:
    """``PUT /api/v1/me/`` translates an auth-outcome exception raised while
    resolving ``g.user`` into a ``401``. The existing ``ValidationError``
    branch is unaffected: the new except clause lives alongside it.
    """
    raise_on_g_user(exc)

    response = client.put("/api/v1/me/", json={"first_name": "Foo"})

    assert response.status_code == 401
