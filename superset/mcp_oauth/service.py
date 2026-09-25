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
"""
Grant logic for the MCP OAuth authorization server: metadata, dynamic client
registration, authorization codes with PKCE, and refresh token rotation.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import time
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import timedelta
from typing import Any
from urllib.parse import unquote_plus, urlencode, urlsplit

from flask import current_app

from superset import db, security_manager
from superset.mcp_oauth.keys import load_signing_key, sign_access_token
from superset.mcp_oauth.models import (
    MCPOAuthAuthorizationCode,
    MCPOAuthClient,
    MCPOAuthRefreshToken,
    utcnow,
)
from superset.utils import json
from superset.utils.decorators import transaction

AUTHORIZATION_CODE = "authorization_code"
REFRESH_TOKEN = "refresh_token"  # noqa: S105
SUPPORTED_GRANT_TYPES = (AUTHORIZATION_CODE, REFRESH_TOKEN)
SUPPORTED_AUTH_METHODS = ("none", "client_secret_post", "client_secret_basic")
LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})
MAX_REDIRECT_URIS = 10
MAX_URI_LENGTH = 2048
# RFC 7636: code verifiers and S256 challenges are 43-128 unreserved characters.
PKCE_VALUE = re.compile(r"^[A-Za-z0-9\-._~]{43,128}$")


class OAuthError(Exception):
    """An RFC 6749 error to return to the client as JSON."""

    def __init__(self, error: str, description: str, status: int = 400) -> None:
        super().__init__(description)
        self.error = error
        self.description = description
        self.status = status

    def to_dict(self) -> dict[str, str]:
        return {"error": self.error, "error_description": self.description}


class AuthorizeFatalError(Exception):
    """
    The client or redirect URI cannot be trusted, so the error is shown to the
    user instead of being sent to a redirect URI (RFC 6749 section 4.1.2.1).
    """


class AuthorizeRedirectError(OAuthError):
    """An authorization error delivered to the client's (validated) redirect URI."""

    def __init__(
        self, error: str, description: str, redirect_uri: str, state: str | None
    ) -> None:
        super().__init__(error, description)
        self.redirect_uri = redirect_uri
        self.state = state

    def location(self) -> str:
        return build_redirect(
            self.redirect_uri,
            {"error": self.error, "error_description": self.description},
            self.state,
        )


@dataclass(frozen=True)
class AuthorizationRequest:
    """A validated authorization request."""

    client: MCPOAuthClient
    redirect_uri: str
    state: str | None
    code_challenge: str
    resource: str
    scope: str

    def as_form_fields(self) -> dict[str, str]:
        """The parameters the consent form posts back for re-validation."""
        fields = {
            "response_type": "code",
            "client_id": str(self.client.client_id),
            "redirect_uri": self.redirect_uri,
            "code_challenge": self.code_challenge,
            "code_challenge_method": "S256",
            "resource": self.resource,
            "scope": self.scope,
        }
        if self.state is not None:
            fields["state"] = self.state
        return fields


@dataclass(frozen=True)
class ClientCredentials:
    """Client credentials from the token request (HTTP Basic or form body)."""

    client_id: str
    client_secret: str | None


def _config(key: str, default: Any = None) -> Any:
    return current_app.config.get(key, default)


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _s256(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def issuer() -> str:
    """The authorization server's issuer: the public Superset base URL."""
    return str(_config("MCP_OAUTH_ISSUER") or "").rstrip("/")


def resources() -> list[str]:
    """Resource indicators (RFC 8707) tokens may be issued for."""
    return [str(resource) for resource in _config("MCP_OAUTH_RESOURCES") or []]


def supported_scopes() -> list[str]:
    return [str(scope) for scope in _config("MCP_OAUTH_SCOPES") or ["mcp"]]


def is_enabled() -> bool:
    """True when OAuth is switched on and minimally configured."""
    return bool(
        _config("MCP_OAUTH_ENABLED", False)
        and issuer()
        and resources()
        and _config("MCP_OAUTH_PRIVATE_KEY")
    )


def build_redirect(
    redirect_uri: str, params: Mapping[str, str], state: str | None
) -> str:
    """Append response parameters (plus ``state`` and ``iss``) to a redirect URI."""
    query = dict(params)
    if state is not None:
        query["state"] = state
    # RFC 9207: lets the client detect a mix-up with another authorization server.
    query["iss"] = issuer()
    separator = "&" if urlsplit(redirect_uri).query else "?"
    return f"{redirect_uri}{separator}{urlencode(query)}"


def authorization_server_metadata() -> dict[str, Any]:
    """RFC 8414 authorization server metadata."""
    base = issuer()
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/oauth/mcp/authorize",
        "token_endpoint": f"{base}/oauth/mcp/token",
        "registration_endpoint": f"{base}/oauth/mcp/register",
        "jwks_uri": f"{base}/oauth/mcp/jwks.json",
        "response_types_supported": ["code"],
        "response_modes_supported": ["query"],
        "grant_types_supported": list(SUPPORTED_GRANT_TYPES),
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": list(SUPPORTED_AUTH_METHODS),
        "scopes_supported": supported_scopes(),
        "authorization_response_iss_parameter_supported": True,
    }


def protected_resource_metadata(resource: str) -> dict[str, Any]:
    """RFC 9728 protected resource metadata for one MCP resource."""
    return {
        "resource": resource,
        "authorization_servers": [issuer()],
        "scopes_supported": supported_scopes(),
        "bearer_methods_supported": ["header"],
        "resource_name": f"{_config('APP_NAME', 'Superset')} MCP",
    }


def jwks() -> dict[str, Any]:
    """The JSON Web Key Set verifiers use to check access tokens."""
    return {"keys": [load_signing_key(current_app.config).public_jwk]}


def validate_redirect_uri(uri: Any) -> str:
    """
    Accept https redirect URIs, and http only on loopback hosts for local
    clients; reject fragments and userinfo. When
    ``MCP_OAUTH_ALLOWED_REDIRECT_URIS`` is set, the URI must also be listed.
    """
    if not isinstance(uri, str) or not uri or len(uri) > MAX_URI_LENGTH:
        raise OAuthError("invalid_redirect_uri", "Redirect URIs must be strings")
    parts = urlsplit(uri)
    if parts.fragment or parts.username or parts.password:
        raise OAuthError(
            "invalid_redirect_uri",
            "Redirect URIs cannot contain a fragment or userinfo",
        )
    is_https = parts.scheme == "https" and bool(parts.hostname)
    is_loopback = parts.scheme == "http" and parts.hostname in LOOPBACK_HOSTS
    if not (is_https or is_loopback):
        raise OAuthError(
            "invalid_redirect_uri",
            "Redirect URIs must use https (http is allowed only for localhost)",
        )
    allowlist = _config("MCP_OAUTH_ALLOWED_REDIRECT_URIS")
    if allowlist is not None and uri not in allowlist:
        raise OAuthError(
            "invalid_redirect_uri", "Redirect URI is not allowed by this server"
        )
    return uri


def _parse_scope(raw: Any) -> list[str]:
    if raw is None:
        return []
    if not isinstance(raw, str):
        raise OAuthError("invalid_client_metadata", "scope must be a string")
    return [scope for scope in raw.split(" ") if scope]


@transaction()
def register_client(metadata: Any) -> dict[str, Any]:  # noqa: C901
    """Dynamic client registration (RFC 7591); returns the registration response."""
    if not isinstance(metadata, dict):
        raise OAuthError("invalid_client_metadata", "Body must be a JSON object")

    redirect_uris = metadata.get("redirect_uris")
    if not isinstance(redirect_uris, list) or not redirect_uris:
        raise OAuthError("invalid_redirect_uri", "redirect_uris is required")
    if len(redirect_uris) > MAX_REDIRECT_URIS:
        raise OAuthError("invalid_redirect_uri", "Too many redirect URIs")
    validated_uris = [validate_redirect_uri(uri) for uri in redirect_uris]

    grant_types = metadata.get("grant_types") or [AUTHORIZATION_CODE]
    if not isinstance(grant_types, list) or not set(grant_types) <= set(
        SUPPORTED_GRANT_TYPES
    ):
        raise OAuthError("invalid_client_metadata", "Unsupported grant_types")
    if AUTHORIZATION_CODE not in grant_types:
        raise OAuthError(
            "invalid_client_metadata", "grant_types must include authorization_code"
        )

    response_types = metadata.get("response_types") or ["code"]
    if response_types != ["code"]:
        raise OAuthError("invalid_client_metadata", "Only response_types [code]")

    # RFC 7591 section 2: the default is client_secret_basic.
    auth_method = metadata.get("token_endpoint_auth_method") or "client_secret_basic"
    if auth_method not in SUPPORTED_AUTH_METHODS:
        raise OAuthError(
            "invalid_client_metadata", "Unsupported token_endpoint_auth_method"
        )

    client_name = metadata.get("client_name")
    if client_name is not None and (
        not isinstance(client_name, str) or len(client_name) > 255
    ):
        raise OAuthError("invalid_client_metadata", "Invalid client_name")

    requested_scopes = _parse_scope(metadata.get("scope"))
    if not set(requested_scopes) <= set(supported_scopes()):
        raise OAuthError("invalid_client_metadata", "Unsupported scope")

    client_id = secrets.token_urlsafe(24)
    client_secret = secrets.token_urlsafe(32) if auth_method != "none" else None
    client = MCPOAuthClient(
        client_id=client_id,
        client_secret_hash=_hash(client_secret) if client_secret else None,
        client_name=client_name,
        redirect_uris=json.dumps(validated_uris),
        grant_types=json.dumps(grant_types),
        token_endpoint_auth_method=auth_method,
        scope=" ".join(requested_scopes) or None,
    )
    db.session.add(client)

    response: dict[str, Any] = {
        "client_id": client_id,
        "client_id_issued_at": int(time.time()),
        "redirect_uris": validated_uris,
        "grant_types": grant_types,
        "response_types": ["code"],
        "token_endpoint_auth_method": auth_method,
    }
    if client_name:
        response["client_name"] = client_name
    if requested_scopes:
        response["scope"] = " ".join(requested_scopes)
    if client_secret:
        response["client_secret"] = client_secret
        response["client_secret_expires_at"] = 0
    return response


def _find_client(client_id: str) -> MCPOAuthClient | None:
    if not client_id:
        return None
    return db.session.query(MCPOAuthClient).filter_by(client_id=client_id).one_or_none()


def _resolve_scope(requested: str | None, allowed: list[str]) -> str | None:
    """The granted scope, or None when the request asks for something not allowed."""
    scopes = [scope for scope in (requested or "").split(" ") if scope]
    if not scopes:
        return " ".join(allowed)
    return " ".join(scopes) if set(scopes) <= set(allowed) else None


def parse_authorization_request(  # noqa: C901
    params: Mapping[str, Any],
) -> AuthorizationRequest:
    """Validate an authorization request from query or consent form parameters."""
    client = _find_client(str(params.get("client_id") or ""))
    if client is None:
        raise AuthorizeFatalError("Unknown client.")

    registered = client.redirect_uri_list
    redirect_uri = params.get("redirect_uri")
    if not redirect_uri:
        if len(registered) != 1:
            raise AuthorizeFatalError("redirect_uri is required.")
        redirect_uri = registered[0]
    elif redirect_uri not in registered:
        raise AuthorizeFatalError("redirect_uri is not registered for this client.")

    state = params.get("state")
    state = str(state) if state is not None else None

    def fail(error: str, description: str) -> AuthorizeRedirectError:
        return AuthorizeRedirectError(error, description, str(redirect_uri), state)

    if params.get("response_type") != "code":
        raise fail("unsupported_response_type", "response_type must be code")
    if AUTHORIZATION_CODE not in client.grant_type_list:
        raise fail("unauthorized_client", "Client may not use authorization_code")
    if state is not None and len(state) > MAX_URI_LENGTH:
        raise fail("invalid_request", "state is too long")

    challenge = str(params.get("code_challenge") or "")
    if params.get("code_challenge_method") != "S256" or not PKCE_VALUE.match(challenge):
        raise fail(
            "invalid_request", "PKCE with code_challenge_method=S256 is required"
        )

    allowed_resources = resources()
    resource = str(params.get("resource") or allowed_resources[0])
    if resource not in allowed_resources:
        raise fail("invalid_target", "Unknown resource")

    client_scopes = _parse_scope(client.scope) or supported_scopes()
    scope = _resolve_scope(params.get("scope"), client_scopes)
    if scope is None:
        raise fail("invalid_scope", "Requested scope is not allowed")

    return AuthorizationRequest(
        client=client,
        redirect_uri=str(redirect_uri),
        state=state,
        code_challenge=challenge,
        resource=resource,
        scope=scope,
    )


@transaction()
def create_authorization_code(auth_request: AuthorizationRequest, user: Any) -> str:
    """Issue a one-time code for an approved request."""
    code = secrets.token_urlsafe(32)
    ttl = int(_config("MCP_OAUTH_AUTHORIZATION_CODE_TTL", 60))
    db.session.add(
        MCPOAuthAuthorizationCode(
            code_hash=_hash(code),
            client_pk=auth_request.client.id,
            user_id=user.id,
            redirect_uri=auth_request.redirect_uri,
            code_challenge=auth_request.code_challenge,
            resource=auth_request.resource,
            scope=auth_request.scope,
            expires_at=utcnow() + timedelta(seconds=ttl),
        )
    )
    return code


def parse_client_credentials(
    form: Mapping[str, Any], authorization: str | None
) -> ClientCredentials:
    """Read client credentials from HTTP Basic auth or the form body."""
    if authorization and authorization.lower().startswith("basic "):
        try:
            decoded = base64.b64decode(authorization[6:].strip()).decode()
            raw_id, _, raw_secret = decoded.partition(":")
        except (ValueError, UnicodeDecodeError) as ex:
            raise OAuthError(
                "invalid_client", "Client authentication failed", 401
            ) from ex
        return ClientCredentials(unquote_plus(raw_id), unquote_plus(raw_secret))
    secret = form.get("client_secret")
    return ClientCredentials(
        str(form.get("client_id") or ""), str(secret) if secret else None
    )


def authenticate_client(credentials: ClientCredentials) -> MCPOAuthClient:
    """The registered client, if its credentials match how it registered."""
    client = _find_client(credentials.client_id)
    if client is None:
        raise OAuthError("invalid_client", "Client authentication failed", 401)
    if client.token_endpoint_auth_method == "none":  # noqa: S105
        return client
    expected = client.client_secret_hash
    if (
        not credentials.client_secret
        or not expected
        or not hmac.compare_digest(_hash(credentials.client_secret), str(expected))
    ):
        raise OAuthError("invalid_client", "Client authentication failed", 401)
    return client


def _active_user(user_id: int) -> Any | None:
    user = (
        db.session.query(security_manager.user_model)
        .filter_by(id=user_id)
        .one_or_none()
    )
    return user if user is not None and user.active else None


@transaction()
def _issue_tokens(
    client: MCPOAuthClient,
    user: Any,
    resource: str,
    scope: str,
    family_id: uuid.UUID | None,
) -> dict[str, Any]:
    now = int(time.time())
    access_ttl = int(_config("MCP_OAUTH_ACCESS_TOKEN_TTL", 3600))
    claims = {
        "iss": issuer(),
        "sub": user.username,
        # The MCP service's default user resolver prefers this claim.
        "preferred_username": user.username,
        "aud": resource,
        "client_id": client.client_id,
        "scope": scope,
        "iat": now,
        "exp": now + access_ttl,
        "jti": uuid.uuid4().hex,
    }
    response: dict[str, Any] = {
        "access_token": sign_access_token(load_signing_key(current_app.config), claims),
        "token_type": "Bearer",
        "expires_in": access_ttl,
        "scope": scope,
    }

    if REFRESH_TOKEN in client.grant_type_list:
        refresh_token = secrets.token_urlsafe(48)
        refresh_ttl = int(_config("MCP_OAUTH_REFRESH_TOKEN_TTL", 30 * 24 * 3600))
        db.session.add(
            MCPOAuthRefreshToken(
                token_hash=_hash(refresh_token),
                family_id=family_id or uuid.uuid4(),
                client_pk=client.id,
                user_id=user.id,
                resource=resource,
                scope=scope,
                expires_at=utcnow() + timedelta(seconds=refresh_ttl),
            )
        )
        response["refresh_token"] = refresh_token

    return response


def exchange_authorization_code(
    form: Mapping[str, Any], credentials: ClientCredentials
) -> dict[str, Any]:
    """The authorization_code grant with PKCE verification."""
    client = authenticate_client(credentials)
    code = str(form.get("code") or "")
    if not code:
        raise OAuthError("invalid_request", "code is required")

    code_hash = _hash(code)
    row = (
        db.session.query(MCPOAuthAuthorizationCode)
        .filter_by(code_hash=code_hash)
        .one_or_none()
    )
    if row is None:
        raise OAuthError("invalid_grant", "Invalid authorization code")
    client_pk, user_id = row.client_pk, row.user_id
    redirect_uri, challenge = row.redirect_uri, row.code_challenge
    resource, scope, expires_at = row.resource, row.scope, row.expires_at

    # Burn the code before any other check: a failed PKCE attempt must not
    # leave it usable, and a concurrent second exchange must lose the delete.
    deleted = (
        db.session.query(MCPOAuthAuthorizationCode)
        .filter_by(code_hash=code_hash)
        .delete(synchronize_session=False)
    )
    # Committed here rather than through @transaction: every check below
    # raises, and a unit of work would roll the burn back with them — leaving
    # a code that failed PKCE usable for another attempt.
    db.session.commit()  # pylint: disable=consider-using-transaction
    if deleted != 1:
        raise OAuthError("invalid_grant", "Invalid authorization code")

    if expires_at < utcnow() or client_pk != client.id:
        raise OAuthError("invalid_grant", "Invalid authorization code")
    if form.get("redirect_uri") != redirect_uri:
        raise OAuthError("invalid_grant", "redirect_uri does not match")

    verifier = str(form.get("code_verifier") or "")
    if not PKCE_VALUE.match(verifier) or not hmac.compare_digest(
        _s256(verifier), str(challenge)
    ):
        raise OAuthError("invalid_grant", "PKCE verification failed")

    if form.get("resource") and form.get("resource") != resource:
        raise OAuthError("invalid_target", "resource does not match the grant")

    user = _active_user(user_id)
    if user is None:
        raise OAuthError("invalid_grant", "User is not active")
    return _issue_tokens(client, user, str(resource), str(scope), family_id=None)


@transaction()
def _revoke_family(family_id: Any) -> None:
    db.session.query(MCPOAuthRefreshToken).filter_by(family_id=family_id).update(
        {"revoked": True}, synchronize_session=False
    )


def refresh_access_token(
    form: Mapping[str, Any], credentials: ClientCredentials
) -> dict[str, Any]:
    """The refresh_token grant with rotation and replay detection."""
    client = authenticate_client(credentials)
    if REFRESH_TOKEN not in client.grant_type_list:
        raise OAuthError("unauthorized_client", "Client may not use refresh_token")
    raw_token = str(form.get("refresh_token") or "")
    if not raw_token:
        raise OAuthError("invalid_request", "refresh_token is required")

    row = (
        db.session.query(MCPOAuthRefreshToken)
        .filter_by(token_hash=_hash(raw_token))
        .one_or_none()
    )
    if row is None:
        raise OAuthError("invalid_grant", "Invalid refresh token")
    if row.revoked:
        # A rotated token came back: treat the grant as compromised.
        _revoke_family(row.family_id)
        raise OAuthError("invalid_grant", "Invalid refresh token")
    if row.client_pk != client.id or row.expires_at < utcnow():
        raise OAuthError("invalid_grant", "Invalid refresh token")
    if form.get("resource") and form.get("resource") != row.resource:
        raise OAuthError("invalid_target", "resource does not match the grant")

    scope = _resolve_scope(form.get("scope"), _parse_scope(row.scope))
    if scope is None:
        raise OAuthError("invalid_scope", "Requested scope exceeds the grant")

    user = _active_user(row.user_id)
    if user is None:
        _revoke_family(row.family_id)
        raise OAuthError("invalid_grant", "User is not active")

    rotated = (
        db.session.query(MCPOAuthRefreshToken)
        .filter_by(id=row.id, revoked=False)
        .update({"revoked": True}, synchronize_session=False)
    )
    if rotated != 1:
        _revoke_family(row.family_id)
        raise OAuthError("invalid_grant", "Invalid refresh token")
    return _issue_tokens(client, user, str(row.resource), scope, row.family_id)


def handle_token_request(
    form: Mapping[str, Any], authorization: str | None
) -> dict[str, Any]:
    """Dispatch a token endpoint request by grant type."""
    credentials = parse_client_credentials(form, authorization)
    grant_type = form.get("grant_type")
    if grant_type == AUTHORIZATION_CODE:
        return exchange_authorization_code(form, credentials)
    if grant_type == REFRESH_TOKEN:
        return refresh_access_token(form, credentials)
    raise OAuthError("unsupported_grant_type", "Unsupported grant_type")
