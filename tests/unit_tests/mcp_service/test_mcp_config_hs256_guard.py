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
"""HS256 key-confusion guard: never key an HMAC verifier on public material."""

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

PEM_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\nMFkw...\n-----END PUBLIC KEY-----"


def _mock_app(config: dict[str, Any]) -> MagicMock:
    mock_app = MagicMock()
    mock_app.config.get.side_effect = lambda key, default=None: config.get(key, default)
    return mock_app


def test_build_jwt_verifier_refuses_hs256_without_secret():
    """HS256 pinned but only public-key material configured must hard-error.

    Before the fix this silently built an HS256 verifier keyed on the PEM
    public key, letting anyone holding the (public) key forge admin tokens.
    """
    from superset.mcp_service.mcp_config import (
        _build_jwt_verifier,
        MCPAuthConfigError,
    )

    app = _mock_app(
        {
            "MCP_JWT_ALGORITHM": "HS256",
            "MCP_JWT_AUDIENCE": "superset-mcp",
        }
    )
    with pytest.raises(MCPAuthConfigError, match="MCP_JWT_SECRET"):
        _build_jwt_verifier(
            app=app,
            jwks_uri=None,
            public_key=PEM_PUBLIC_KEY,
            secret=None,
        )


@pytest.mark.parametrize("algorithm", ["HS256", "HS384", "HS512"])
def test_build_jwt_verifier_refuses_hmac_alongside_public_key_material(
    algorithm: str,
):
    """HMAC algorithm plus leftover public key / JWKS config is refused."""
    from superset.mcp_service.mcp_config import (
        _build_jwt_verifier,
        MCPAuthConfigError,
    )

    app = _mock_app(
        {
            "MCP_JWT_ALGORITHM": algorithm,
            "MCP_JWT_AUDIENCE": "superset-mcp",
        }
    )
    with pytest.raises(MCPAuthConfigError, match="MCP_JWT_PUBLIC_KEY"):
        _build_jwt_verifier(
            app=app,
            jwks_uri=None,
            public_key=PEM_PUBLIC_KEY,
            secret="shhh",  # noqa: S106
        )


def test_build_jwt_verifier_hs256_with_explicit_secret_still_works():
    """A correct HS256 config (secret only) builds an HS256 verifier."""
    from superset.mcp_service import mcp_config

    app = _mock_app(
        {
            "MCP_JWT_ALGORITHM": "HS256",
            "MCP_JWT_AUDIENCE": "superset-mcp",
        }
    )
    with patch.object(mcp_config, "MCPJWTVerifier") as mock_verifier:
        mcp_config._build_jwt_verifier(
            app=app,
            jwks_uri=None,
            public_key=None,
            secret="shhh",  # noqa: S106
        )
    kwargs = mock_verifier.call_args.kwargs
    assert kwargs["algorithm"] == "HS256"
    assert kwargs["public_key"] == "shhh"


def test_build_jwt_verifier_refuses_rs256_secret_only():
    """RS256 (asymmetric) pinned but only a secret configured must hard-error.

    A keyless RS256 verifier cannot validate anything -- name the fix rather
    than letting the underlying verifier constructor raise opaquely.
    """
    from superset.mcp_service.mcp_config import (
        _build_jwt_verifier,
        MCPAuthConfigError,
    )

    app = _mock_app(
        {
            "MCP_JWT_ALGORITHM": "RS256",
            "MCP_JWT_AUDIENCE": "superset-mcp",
        }
    )
    with pytest.raises(MCPAuthConfigError, match="MCP_JWT_ALGORITHM"):
        _build_jwt_verifier(
            app=app,
            jwks_uri=None,
            public_key=None,
            secret="shhh",  # noqa: S106
        )


def test_auth_factory_propagates_hs256_config_error():
    """The factory must not swallow the misconfiguration into a None provider."""
    from superset.mcp_service.mcp_config import (
        create_default_mcp_auth_factory,
        MCPAuthConfigError,
    )

    app = _mock_app(
        {
            "MCP_AUTH_ENABLED": True,
            "MCP_API_KEY_ENABLED": False,
            "FAB_API_KEY_ENABLED": False,
            "MCP_JWT_AUDIENCE": "superset-mcp",
            "MCP_JWT_ALGORITHM": "HS256",
            "MCP_JWT_PUBLIC_KEY": PEM_PUBLIC_KEY,
        }
    )
    with pytest.raises(MCPAuthConfigError):
        create_default_mcp_auth_factory(app)
