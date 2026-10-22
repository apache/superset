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

"""Identity resolution for tokens wrapped by FastMCP's ``MultiAuth``.

FastMCP 4's ``MultiAuth`` rewrites ``AccessToken.client_id`` into a
source-qualified JSON string and keeps the verifier's own value in
``original_client_id``. These tests drive real verifier chains
(``GuestTokenVerifier`` / ``CompositeTokenVerifier`` inside ``MultiAuth``) and
check that guest and API-key tokens still resolve to the right principal, and
that a forged guest-marked token still cannot pose as a guest.
"""

import time
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastmcp.server.auth import AccessToken, MultiAuth
from fastmcp.server.auth.providers.jwt import TokenVerifier

from superset import security_manager
from superset.app import SupersetApp
from superset.mcp_service.auth import (
    _resolve_user_from_api_key,
    _resolve_user_from_jwt_context,
)
from superset.mcp_service.composite_token_verifier import (
    API_KEY_PASSTHROUGH_CLAIM,
    API_KEY_VALIDATED_USERNAME_CLAIM,
    CompositeTokenVerifier,
    get_verifier_client_id,
)
from superset.mcp_service.guest_token_verifier import (
    GUEST_TOKEN_CLAIM,
    GuestTokenVerifier,
)
from superset.mcp_service.mcp_config import default_user_resolver

GUEST_SECRET = "a-strong-guest-token-secret-for-tests"  # noqa: S105

# FastMCP 4's MultiAuth qualifies client_id; FastMCP 3's passes it through.
MULTI_AUTH_QUALIFIES_CLIENT_ID = "original_client_id" in AccessToken.model_fields


class _StubVerifier(TokenVerifier):
    """A token source that returns a fixed AccessToken for any bearer."""

    def __init__(self, result: AccessToken | None) -> None:
        super().__init__(base_url=None, required_scopes=[])
        self._result = result

    async def verify_token(self, token: str) -> AccessToken | None:
        return self._result


def _guest_claims() -> dict[str, Any]:
    return {
        "user": {"username": "embed-guest"},
        "resources": [{"type": "dashboard", "id": "abc-uuid"}],
        "rls_rules": [],
        "iat": int(time.time()),
        "exp": int(time.time()) + 300,
        "aud": "superset-test",
        "type": "guest",
    }


def _mint_guest_token(claims: dict[str, Any], secret: str = GUEST_SECRET) -> str:
    return jwt.encode(claims, secret, algorithm="HS256")


@pytest.fixture
def guest_app(app: SupersetApp) -> SupersetApp:
    """Enable embedded guest auth over MCP with a known guest-token secret."""
    app.config.update(
        {
            "MCP_EMBEDDED_GUEST_AUTH_ENABLED": True,
            "GUEST_TOKEN_JWT_SECRET": GUEST_SECRET,
            "GUEST_TOKEN_JWT_ALGO": "HS256",
            "GUEST_TOKEN_JWT_AUDIENCE": "superset-test",
        }
    )
    return app


async def _verify_through_chain(
    app: SupersetApp, raw_token: str, *, multi_auth: bool
) -> AccessToken | None:
    """Run ``raw_token`` through the default guest chain, optionally in MultiAuth."""
    composite = CompositeTokenVerifier(
        jwt_verifier=None,
        api_key_prefixes=[],
        app=app,
        guest_verifier=GuestTokenVerifier(app=app),
    )
    verifier: Any = MultiAuth(verifiers=[composite]) if multi_auth else composite
    sm = app.appbuilder.sm
    with (
        patch("superset.is_feature_enabled", return_value=True),
        patch.object(sm, "_is_guest_token_revoked", return_value=False),
        patch.object(sm, "find_role", return_value=object()),
    ):
        return await verifier.verify_token(raw_token)


def _resolve_guest(app: SupersetApp, access_token: Any) -> tuple[Any, MagicMock]:
    """Resolve ``access_token`` via the JWT-context path, guest flags on."""
    fake_guest = MagicMock(name="GuestUser")
    with (
        patch(
            "fastmcp.server.dependencies.get_access_token", return_value=access_token
        ),
        patch("superset.mcp_service.auth.is_feature_enabled", return_value=True),
        patch.object(
            security_manager, "get_guest_user_from_token", return_value=fake_guest
        ) as get_guest_user,
        patch(
            "superset.mcp_service.auth.load_user_with_relationships",
            return_value=None,
        ),
    ):
        return _resolve_user_from_jwt_context(app), get_guest_user


# -- guest tokens --


@pytest.mark.parametrize("multi_auth", [False, True], ids=["plain", "multi_auth"])
@pytest.mark.asyncio
async def test_guest_token_resolves_as_guest(
    guest_app: SupersetApp, multi_auth: bool
) -> None:
    """A real guest token resolves to a GuestUser whether or not the verifier
    chain is wrapped in ``MultiAuth`` (which qualifies ``client_id``)."""
    claims = _guest_claims()
    access_token = await _verify_through_chain(
        guest_app, _mint_guest_token(claims), multi_auth=multi_auth
    )
    assert access_token is not None
    if multi_auth and MULTI_AUTH_QUALIFIES_CLIENT_ID:
        # The precondition for the bug: MultiAuth rewrote client_id.
        assert access_token.client_id != "guest"
        assert access_token.original_client_id == "guest"

    result, get_guest_user = _resolve_guest(guest_app, access_token)

    assert result is get_guest_user.return_value
    passed_claims = get_guest_user.call_args.args[0]
    assert GUEST_TOKEN_CLAIM not in passed_claims
    assert passed_claims == claims


@pytest.mark.parametrize("multi_auth", [False, True], ids=["plain", "multi_auth"])
@pytest.mark.asyncio
async def test_forged_guest_marker_cannot_pose_as_guest(
    guest_app: SupersetApp, multi_auth: bool
) -> None:
    """A token that carries the guest marker and ``client_id="guest"`` but whose
    bearer is not a guest token signed with ``GUEST_TOKEN_JWT_SECRET`` (e.g. an
    external IdP JWT returned by a source that does not strip the marker) must
    be rejected, not resolved as a guest."""
    forged_claims = _guest_claims()
    forged_raw = _mint_guest_token(forged_claims, secret="idp-signing-key")  # noqa: S106
    forged = AccessToken(
        token=forged_raw,
        client_id="guest",
        scopes=[],
        claims={GUEST_TOKEN_CLAIM: True, **forged_claims},
    )
    access_token: Any = forged
    if multi_auth:
        access_token = await MultiAuth(verifiers=[_StubVerifier(forged)]).verify_token(
            forged_raw
        )
        assert access_token is not None
        assert get_verifier_client_id(access_token) == "guest"

    with (
        patch(
            "fastmcp.server.dependencies.get_access_token", return_value=access_token
        ),
        patch("superset.mcp_service.auth.is_feature_enabled", return_value=True),
        patch.object(security_manager, "get_guest_user_from_token") as get_guest_user,
        pytest.raises(ValueError, match="not a valid guest token"),
    ):
        _resolve_user_from_jwt_context(guest_app)
    get_guest_user.assert_not_called()


def test_guest_resolution_uses_verified_claims(guest_app: SupersetApp) -> None:
    """The GuestUser is built from the re-verified bearer, so claims edited on
    the AccessToken after verification cannot widen the guest's resources."""
    claims = _guest_claims()
    tampered = AccessToken(
        token=_mint_guest_token(claims),
        client_id="guest",
        scopes=[],
        claims={
            GUEST_TOKEN_CLAIM: True,
            **claims,
            "resources": [{"type": "dashboard", "id": "someone-elses"}],
        },
    )

    _, get_guest_user = _resolve_guest(guest_app, tampered)

    assert get_guest_user.call_args.args[0]["resources"] == claims["resources"]


# -- API-key tokens --


@pytest.mark.asyncio
async def test_api_key_fast_path_through_multi_auth(app: SupersetApp) -> None:
    """A transport-validated API key wrapped by ``MultiAuth`` defers from the
    JWT path and loads the validated user on the API-key path."""
    validated = AccessToken(
        token="sst_abc123",  # noqa: S106
        client_id="api_key",
        scopes=[],
        claims={
            API_KEY_PASSTHROUGH_CLAIM: True,
            API_KEY_VALIDATED_USERNAME_CLAIM: "alice",
        },
    )
    access_token = await MultiAuth(verifiers=[_StubVerifier(validated)]).verify_token(
        "sst_abc123"
    )
    assert access_token is not None
    if MULTI_AUTH_QUALIFIES_CLIENT_ID:
        assert access_token.client_id != "api_key"

    alice = MagicMock(username="alice")
    app.config["FAB_API_KEY_ENABLED"] = True
    with (
        patch(
            "fastmcp.server.dependencies.get_access_token", return_value=access_token
        ),
        patch(
            "superset.mcp_service.auth.load_user_with_relationships",
            return_value=alice,
        ) as load_user,
    ):
        assert _resolve_user_from_jwt_context(app) is None
        assert _resolve_user_from_api_key(app) is alice
    load_user.assert_called_once_with(username="alice")


@pytest.mark.asyncio
async def test_api_key_fallback_through_multi_auth(app: SupersetApp) -> None:
    """A prefix-only API-key pass-through (no transport validation) wrapped by
    ``MultiAuth`` is still validated against FAB on the API-key path."""
    composite = CompositeTokenVerifier(
        jwt_verifier=None, api_key_prefixes=["sst_"], app=None
    )
    access_token = await MultiAuth(verifiers=[composite]).verify_token("sst_abc123")
    assert access_token is not None

    alice = MagicMock(username="alice")
    app.config["FAB_API_KEY_ENABLED"] = True
    with (
        patch(
            "fastmcp.server.dependencies.get_access_token", return_value=access_token
        ),
        patch.object(
            app.appbuilder.sm, "validate_api_key", return_value=alice, create=True
        ) as validate,
        patch(
            "superset.mcp_service.auth.load_user_with_relationships",
            return_value=alice,
        ),
    ):
        assert _resolve_user_from_jwt_context(app) is None
        assert _resolve_user_from_api_key(app) is alice
    validate.assert_called_once_with("sst_abc123")


# -- default user resolver and helper --


@pytest.mark.asyncio
async def test_default_user_resolver_uses_unqualified_client_id(
    app: SupersetApp,
) -> None:
    """The last-resort ``client_id`` username fallback sees the verifier's own
    client id, not ``MultiAuth``'s qualified JSON form."""
    token = AccessToken(token="t", client_id="svc-bot", scopes=[], claims={})  # noqa: S106
    wrapped = await MultiAuth(verifiers=[_StubVerifier(token)]).verify_token("t")
    assert wrapped is not None

    assert default_user_resolver(app, wrapped) == "svc-bot"


def test_get_verifier_client_id_without_original_attribute() -> None:
    """Tokens without ``original_client_id`` (FastMCP 3) use ``client_id``."""
    assert get_verifier_client_id(SimpleNamespace(client_id="guest")) == "guest"
    assert get_verifier_client_id(MagicMock(client_id="guest")) == "guest"
    assert (
        get_verifier_client_id(
            SimpleNamespace(
                client_id='["src","guest",null,null]', original_client_id="guest"
            )
        )
        == "guest"
    )
    assert get_verifier_client_id(SimpleNamespace()) is None
