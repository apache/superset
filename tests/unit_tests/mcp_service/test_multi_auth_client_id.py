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
from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastmcp.server.auth import AccessToken, MultiAuth
from fastmcp.server.auth.providers.jwt import TokenVerifier
from sqlalchemy.exc import SQLAlchemyError

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
)
from superset.mcp_service.guest_token_verifier import (
    GUEST_TOKEN_CLAIM,
    GuestTokenVerifier,
)
from superset.mcp_service.mcp_config import default_user_resolver
from superset.mcp_service.middleware import RBACToolVisibilityMiddleware

GUEST_SECRET = "a-strong-guest-token-secret-for-tests"  # noqa: S105

# FastMCP 4's MultiAuth qualifies client_id; FastMCP 3's passes it through.
MULTI_AUTH_QUALIFIES_CLIENT_ID = "original_client_id" in AccessToken.model_fields


@pytest.fixture(autouse=True)
def isolate_identity_config(app: SupersetApp) -> Iterator[None]:
    """Restore the module-scoped app's auth configuration after each test."""
    with patch.dict(app.config):
        yield


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
        patch.object(security_manager, "_is_guest_token_revoked", return_value=False),
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


@pytest.mark.parametrize("multi_auth", [False, True])
@pytest.mark.asyncio
async def test_api_key_fast_path_through_multi_auth(
    app: SupersetApp, multi_auth: bool
) -> None:
    """A transport-validated API key wrapped by ``MultiAuth`` defers from the
    JWT path and loads the validated user on the API-key path."""
    composite = CompositeTokenVerifier(
        jwt_verifier=None, api_key_prefixes=["sst_"], app=app
    )
    with patch.object(composite, "_validate_api_key_sync", return_value=("alice", [])):
        verifier: Any = MultiAuth(verifiers=[composite]) if multi_auth else composite
        access_token = await verifier.verify_token("sst_abc123")
    assert access_token is not None
    # Editing the JWT-style claims must not alter the FAB-validated identity.
    access_token.claims[API_KEY_VALIDATED_USERNAME_CLAIM] = "admin"
    if multi_auth and MULTI_AUTH_QUALIFIES_CLIENT_ID:
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
        patch.object(app.appbuilder.sm, "validate_api_key") as validate,
    ):
        assert _resolve_user_from_jwt_context(app) is None
        assert _resolve_user_from_api_key(app) is alice
    load_user.assert_called_once_with(username="alice")
    validate.assert_not_called()


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
    from superset.mcp_service.composite_token_verifier import get_verifier_client_id

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


@pytest.mark.parametrize(
    "chain", ["plain", "composite", "external_first", "composite_first"]
)
@pytest.mark.asyncio
async def test_idp_api_key_claims_cannot_select_another_user(
    app: SupersetApp, chain: str
) -> None:
    """Internal API-key claims in a signed IdP JWT are not validation evidence."""
    from fastmcp.server.auth.providers.jwt import JWTVerifier

    secret = "independent-idp-signing-secret-for-tests"  # noqa: S105
    raw = jwt.encode(
        {
            "sub": "alice",
            "client_id": "api_key",
            "original_client_id": "api_key",
            "exp": int(time.time()) + 300,
            API_KEY_PASSTHROUGH_CLAIM: True,
            API_KEY_VALIDATED_USERNAME_CLAIM: "admin",
        },
        secret,
        algorithm="HS256",
    )
    external = JWTVerifier(public_key=secret, algorithm="HS256")
    composite = CompositeTokenVerifier(external, ["sst_"], app=app)
    verifier: Any = external
    if chain == "composite":
        verifier = composite
    elif chain == "external_first":
        verifier = MultiAuth(verifiers=[external, composite])
    elif chain == "composite_first":
        verifier = MultiAuth(verifiers=[composite, external])
    access_token = await verifier.verify_token(raw)
    assert access_token is not None
    app.config["FAB_API_KEY_ENABLED"] = True
    alice = MagicMock(username="alice")
    with (
        patch(
            "fastmcp.server.dependencies.get_access_token", return_value=access_token
        ),
        patch.object(
            app.appbuilder.sm, "validate_api_key", return_value=None
        ) as validate,
        patch(
            "superset.mcp_service.auth.load_user_with_relationships", return_value=alice
        ) as load,
    ):
        # A stripped token retains its JWT identity; an unwrapped external
        # source's forged API-key assertion must fail closed at FAB validation.
        user = _resolve_user_from_jwt_context(app)
        if user is None:
            with pytest.raises(PermissionError, match="Invalid or expired API key"):
                _resolve_user_from_api_key(app)
            validate.assert_called_once_with(raw)
            load.assert_not_called()
        else:
            assert user is alice
            load.assert_called_once_with("alice")
            validate.assert_not_called()


@pytest.mark.parametrize("revocation", ["version", "dashboard"])
@pytest.mark.parametrize("chain", ["plain", "guest_first", "external_first"])
@pytest.mark.asyncio
async def test_revoked_guest_cannot_bypass_guest_verifier(
    guest_app: SupersetApp, chain: str, revocation: str
) -> None:
    """A different token source cannot bypass core guest-token revocation."""
    claims = _guest_claims()
    raw = _mint_guest_token(claims)
    marked = AccessToken(
        token=raw,
        client_id="guest",
        scopes=[],
        claims={GUEST_TOKEN_CLAIM: True, **claims},
    )
    verifier: Any = _StubVerifier(marked)
    if chain != "plain":
        sources = [GuestTokenVerifier(guest_app), verifier]
        verifier = MultiAuth(
            verifiers=sources if chain == "guest_first" else sources[::-1]
        )
    guest_app.config["GUEST_TOKEN_REVOCATION_ENABLED"] = revocation == "version"
    cutoff = SimpleNamespace(guest_token_revoked_before=int(time.time()) + 1)
    with (
        patch("superset.is_feature_enabled", return_value=True),
        patch(
            "superset.security.manager.get_current_guest_token_revocation_version",
            return_value=1,
        ),
        patch(
            "superset.daos.dashboard.EmbeddedDashboardDAO.find_by_id",
            return_value=cutoff,
        ),
        patch.object(guest_app.appbuilder.sm, "find_role", return_value=object()),
    ):
        access_token = await verifier.verify_token(raw)
        assert access_token is not None
        with (
            patch(
                "fastmcp.server.dependencies.get_access_token",
                return_value=access_token,
            ),
            patch("superset.mcp_service.auth.is_feature_enabled", return_value=True),
            patch.object(security_manager, "get_guest_user_from_token") as build,
            pytest.raises(ValueError, match="not a valid guest token"),
        ):
            _resolve_user_from_jwt_context(guest_app)
        build.assert_not_called()


@pytest.mark.parametrize("client_id", ["guest", "api_key"])
def test_crafted_original_client_id_is_not_validation_evidence(
    guest_app: SupersetApp, client_id: str
) -> None:
    """An original_client_id field cannot authorize either internal identity."""
    raw = _mint_guest_token(_guest_claims(), secret="independent-idp-secret")  # noqa: S106
    token = SimpleNamespace(
        token=raw,
        client_id="external",
        original_client_id=client_id,
        claims={
            GUEST_TOKEN_CLAIM: True,
            API_KEY_PASSTHROUGH_CLAIM: True,
            API_KEY_VALIDATED_USERNAME_CLAIM: "admin",
        },
    )
    guest_app.config["FAB_API_KEY_ENABLED"] = True
    with (
        patch("fastmcp.server.dependencies.get_access_token", return_value=token),
        patch("superset.mcp_service.auth.is_feature_enabled", return_value=True),
        patch.object(guest_app.appbuilder.sm, "validate_api_key", return_value=None),
        patch("superset.mcp_service.auth.load_user_with_relationships") as load,
        patch.object(security_manager, "get_guest_user_from_token") as build,
    ):
        if client_id == "guest":
            with pytest.raises(ValueError, match="not a valid guest token"):
                _resolve_user_from_jwt_context(guest_app)
        else:
            assert _resolve_user_from_jwt_context(guest_app) is None
            with pytest.raises(PermissionError, match="Invalid or expired API key"):
                _resolve_user_from_api_key(guest_app)
        load.assert_not_called()
        build.assert_not_called()


@pytest.mark.parametrize("missing", ["user", "resources", "rls_rules", "exp"])
def test_guest_reverification_requires_core_structure(
    guest_app: SupersetApp, missing: str
) -> None:
    """Other token sources cannot bypass the embedded flow's structural checks."""
    claims = _guest_claims()
    del claims[missing]
    token = AccessToken(
        token=_mint_guest_token(claims),
        client_id="guest",
        scopes=[],
        claims={GUEST_TOKEN_CLAIM: True, **claims},
    )
    with pytest.raises(ValueError, match="not a valid guest token"):
        _resolve_guest(guest_app, token)


@pytest.mark.parametrize("token_type", [None, "access"])
def test_guest_reverification_rejects_non_guest_type(
    guest_app: SupersetApp, token_type: str | None
) -> None:
    """A correctly signed non-guest JWT must not enter the guest identity path."""
    claims = _guest_claims()
    claims["type"] = token_type
    token = AccessToken(
        token=_mint_guest_token(claims),
        client_id="guest",
        scopes=[],
        claims={GUEST_TOKEN_CLAIM: True, **claims},
    )
    with pytest.raises(ValueError, match="not a valid guest token"):
        _resolve_guest(guest_app, token)


@pytest.mark.parametrize("entrypoint", ["resolve", "tool_list", "tool_search"])
def test_guest_reverification_observes_later_dashboard_revocation(
    guest_app: SupersetApp, entrypoint: str
) -> None:
    """A prior successful resolution must not mask a later dashboard cutoff."""
    from superset.mcp_service.server import _tool_allowed_for_current_user

    claims = _guest_claims()
    token = AccessToken(
        token=_mint_guest_token(claims),
        client_id="guest",
        scopes=[],
        claims={GUEST_TOKEN_CLAIM: True, **claims},
    )
    embedded = SimpleNamespace(guest_token_revoked_before=None)
    guest_app.config["GUEST_TOKEN_REVOCATION_ENABLED"] = False
    with (
        patch("fastmcp.server.dependencies.get_access_token", return_value=token),
        patch("superset.mcp_service.auth.is_feature_enabled", return_value=True),
        patch(
            "superset.daos.dashboard.EmbeddedDashboardDAO.find_by_id",
            return_value=embedded,
        ) as lookup,
        patch.object(security_manager, "get_guest_user_from_token") as build,
    ):
        assert _resolve_user_from_jwt_context(guest_app) is build.return_value
        embedded.guest_token_revoked_before = claims["iat"] + 1
        public_tool = SimpleNamespace(fn=lambda: None)
        if entrypoint == "resolve":
            with pytest.raises(ValueError, match="not a valid guest token"):
                _resolve_user_from_jwt_context(guest_app)
        elif entrypoint == "tool_list":
            assert RBACToolVisibilityMiddleware._visible_tools([public_tool]) == []
        else:
            assert not _tool_allowed_for_current_user(public_tool)
        assert lookup.call_count == 2
        build.assert_called_once()


@pytest.mark.parametrize("entrypoint", ["resolve", "tool_list", "tool_search"])
def test_guest_reverification_backend_failure_is_credential_failure(
    guest_app: SupersetApp, entrypoint: str
) -> None:
    """Revocation backend errors reject guest credentials at every entry point."""
    from superset.mcp_service.server import _tool_allowed_for_current_user

    token = AccessToken(
        token=_mint_guest_token(_guest_claims()),
        client_id="guest",
        scopes=[],
        claims={GUEST_TOKEN_CLAIM: True},
    )
    with (
        patch("fastmcp.server.dependencies.get_access_token", return_value=token),
        patch("superset.mcp_service.auth.is_feature_enabled", return_value=True),
        patch.object(
            security_manager, "_is_guest_token_revoked", side_effect=SQLAlchemyError
        ),
        patch.object(security_manager, "get_guest_user_from_token") as build,
    ):
        public_tool = SimpleNamespace(fn=lambda: None)
        if entrypoint == "resolve":
            with pytest.raises(ValueError, match="not a valid guest token"):
                _resolve_user_from_jwt_context(guest_app)
        elif entrypoint == "tool_list":
            assert RBACToolVisibilityMiddleware._visible_tools([public_tool]) == []
        else:
            assert not _tool_allowed_for_current_user(public_tool)
        build.assert_not_called()


@pytest.mark.parametrize("fallback", ["dev", "middleware"])
@pytest.mark.parametrize("multi_auth", [False, True])
@pytest.mark.parametrize(
    "disabled_setting", ["FAB_API_KEY_ENABLED", "MCP_API_KEY_ENABLED"]
)
@pytest.mark.asyncio
async def test_disabled_api_key_assertion_cannot_fall_through_to_dev_user(
    app: SupersetApp, multi_auth: bool, disabled_setting: str, fallback: str
) -> None:
    """An explicit API-key assertion must not degrade to a development identity."""
    from superset.mcp_service.auth import get_user_from_request

    token = AccessToken(
        token="external-bearer",  # noqa: S106
        client_id="api_key",
        scopes=[],
        claims={
            API_KEY_PASSTHROUGH_CLAIM: True,
            API_KEY_VALIDATED_USERNAME_CLAIM: "admin",
        },
    )
    if multi_auth:
        token = await MultiAuth(verifiers=[_StubVerifier(token)]).verify_token(
            token.token
        )
    app.config.update(
        FAB_API_KEY_ENABLED=True,
        MCP_API_KEY_ENABLED=None,
        MCP_DEV_USERNAME="admin" if fallback == "dev" else None,
    )
    app.config[disabled_setting] = False
    with (
        patch("superset.mcp_service.auth.g", SimpleNamespace(user=MagicMock())),
        patch("fastmcp.server.dependencies.get_access_token", return_value=token),
        patch("superset.mcp_service.auth.load_user_with_relationships") as load,
        pytest.raises(PermissionError, match="Authentication required"),
    ):
        get_user_from_request()
    load.assert_not_called()


@pytest.mark.asyncio
async def test_serialized_api_key_token_revalidates_bearer(app: SupersetApp) -> None:
    """Losing the internal token type requires FAB validation, not claim trust."""
    composite = CompositeTokenVerifier(None, ["sst_"], app=app)
    with patch.object(composite, "_validate_api_key_sync", return_value=("alice", [])):
        verified = await composite.verify_token("sst_abc123")
    assert verified is not None
    serialized = AccessToken.model_validate(verified.model_dump())
    serialized.claims[API_KEY_VALIDATED_USERNAME_CLAIM] = "admin"
    app.config["FAB_API_KEY_ENABLED"] = True
    alice = MagicMock(username="alice")
    with (
        patch("fastmcp.server.dependencies.get_access_token", return_value=serialized),
        patch.object(
            app.appbuilder.sm, "validate_api_key", return_value=alice
        ) as validate,
        patch(
            "superset.mcp_service.auth.load_user_with_relationships", return_value=alice
        ) as load,
    ):
        assert _resolve_user_from_jwt_context(app) is None
        assert _resolve_user_from_api_key(app) is alice
    validate.assert_called_once_with("sst_abc123")
    load.assert_called_once_with(username="alice")


@pytest.mark.parametrize("entrypoint", ["tool_list", "tool_search"])
def test_disabled_api_key_assertion_hides_tools(
    app: SupersetApp, entrypoint: str
) -> None:
    """Discovery distinguishes rejected credentials from absent authentication."""
    from superset.mcp_service.server import _tool_allowed_for_current_user

    token = AccessToken(
        token="external-bearer",  # noqa: S106
        client_id="api_key",
        scopes=[],
        claims={API_KEY_PASSTHROUGH_CLAIM: True},
    )
    app.config["MCP_API_KEY_ENABLED"] = False
    public_tool = SimpleNamespace(fn=lambda: None)
    with (
        patch("fastmcp.server.dependencies.get_access_token", return_value=token),
        patch("flask.g", SimpleNamespace(user=None)),
    ):
        if entrypoint == "tool_list":
            assert RBACToolVisibilityMiddleware._visible_tools([public_tool]) == []
        else:
            assert not _tool_allowed_for_current_user(public_tool)
