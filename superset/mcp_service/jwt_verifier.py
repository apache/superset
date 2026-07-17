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
Detailed JWT verification for the MCP service.

Provides step-by-step JWT validation with tiered server-side logging:
- WARNING level: generic failure categories only (e.g. "Issuer mismatch")
- DEBUG level: detailed claim values and config for troubleshooting
- Secrets (e.g. HS256 keys) are NEVER logged at any level

HTTP responses always return generic errors per RFC 6750 Section 3.1.
"""

import asyncio
import base64
import html as html_module
import logging
import math
import time
from collections.abc import Callable
from contextvars import ContextVar
from typing import Any, cast

import httpx
from authlib.jose import JsonWebToken
from authlib.jose.errors import JoseError
from fastmcp.server.auth.auth import AccessToken
from fastmcp.server.auth.providers.jwt import JWTVerifier
from mcp.server.auth.middleware.auth_context import AuthContextMiddleware
from mcp.server.auth.middleware.bearer_auth import BearerAuthBackend
from starlette.authentication import AuthenticationError
from starlette.middleware import Middleware
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import HTTPConnection, Request
from starlette.responses import HTMLResponse, JSONResponse, Response

from superset.mcp_service.utils.error_sanitization import (
    sanitize_for_log as _sanitize_for_log,
)
from superset.utils import json

logger = logging.getLogger(__name__)

# Algorithms that are never acceptable for bearer-token verification.
# "none" (unsigned tokens) must never be honored — accepting it would let any
# caller forge claims. Comparison is case-insensitive to catch "None"/"NONE".
_FORBIDDEN_ALGORITHMS = frozenset({"none"})


def _warn_on_weak_jwt_config(
    audience: Any,
    algorithm: Any,
) -> None:
    """Emit startup warnings when a JWT verifier is configured permissively.

    These are config-gated soft warnings, not hard failures: a verifier is only
    ever constructed when ``MCP_AUTH_ENABLED`` is True and JWT keys are present
    (see ``create_default_mcp_auth_factory``). We warn — rather than refuse to
    start — so existing single-service deployments that intentionally omit an
    audience or rely on JWKS-advertised algorithms keep working. Operators who
    want strict enforcement should set ``MCP_JWT_AUDIENCE`` and
    ``MCP_JWT_ALGORITHM``.
    """
    if not audience:
        logger.warning(
            "MCP JWT verifier configured without an audience "
            "(MCP_JWT_AUDIENCE unset): audience validation is DISABLED. "
            "Tokens minted for other services may be accepted. Set "
            "MCP_JWT_AUDIENCE to bind tokens to this service."
        )
    if not algorithm:
        logger.warning(
            "MCP JWT verifier configured without a pinned signing algorithm "
            "(MCP_JWT_ALGORITHM unset): the algorithm header is not pinned. "
            "Set MCP_JWT_ALGORITHM to the algorithm your IdP uses. Unsigned "
            "('none') tokens are always rejected regardless of this setting."
        )


# Thread-safe storage for the specific JWT failure reason.
# Set by DetailedJWTVerifier.load_access_token() on failure,
# read by DetailedBearerAuthBackend.authenticate() to raise
# an AuthenticationError with the specific reason.
# SECURITY: Must ALWAYS contain generic failure categories only.
# Claim values and secrets must NEVER be stored here.
_jwt_failure_reason: ContextVar[str | None] = ContextVar(
    "_jwt_failure_reason", default=None
)

_HTML_STYLES = """
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f5f5f5;
      color: #1a1a1a;
      margin: 0;
      padding: 40px 16px;
      line-height: 1.6;
    }
    .card {
      max-width: 640px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 1px 4px rgba(0,0,0,.12);
      padding: 40px 40px 32px;
    }
    h1 { font-size: 1.4rem; margin: 0 0 8px; }
    .badge {
      display: inline-block;
      background: #e8f4fd;
      color: #0070c0;
      font-size: .75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      margin-bottom: 20px;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    p { margin: 0 0 20px; color: #444; }
    h2 { font-size: 1rem; margin: 24px 0 8px; color: #1a1a1a; }
    pre {
      background: #f0f0f0;
      border-radius: 6px;
      padding: 16px;
      font-size: .85rem;
      overflow-x: auto;
      margin: 0 0 24px;
    }
    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }
    .note {
      font-size: .85rem;
      color: #666;
      border-left: 3px solid #ddd;
      padding-left: 12px;
      margin-top: 24px;
    }
    .logo {
      max-height: 48px; max-width: 200px; margin-bottom: 20px; display: block;
    }"""

_DEFAULT_CLIENTS = [
    "Claude Desktop",
    "Claude Code (CLI)",
    "Cursor",
]

_DEFAULT_HELLO_PAGE_CONFIG: dict[str, Any] = {
    # Page heading and browser tab title
    "title": "Superset MCP Server",
    # Key name used in the mcpServers config snippet (e.g. "superset", "my-company")
    "server_key": "superset",
    # Include "transport": "streamable-http" in the config snippet.
    # Recommended: Claude Desktop defaults to SSE so the transport must be explicit.
    "show_transport": True,
    # Supported MCP clients listed on the page
    "clients": _DEFAULT_CLIENTS,
}


def _build_config_snippet(
    auth_enabled: bool, server_key: str, show_transport: bool
) -> str:
    # superset.utils.json.dumps() ensures the key is a valid JSON string.
    from superset.utils import json as superset_json

    key_json = superset_json.dumps(server_key)
    inner_parts = ['      "url": "<this-url>"']
    if show_transport:
        inner_parts.append('      "transport": "streamable-http"')
    if auth_enabled:
        inner_parts.append(
            '      "headers": {\n'
            '        "Authorization": "Bearer <your-api-key>"\n'
            "      }"
        )
    inner = ",\n".join(inner_parts)
    return f'{{\n  "mcpServers": {{\n    {key_json}: {{\n{inner}\n    }}\n  }}\n}}'


def _build_browser_hello_html(
    auth_enabled: bool,
    page_config: dict[str, Any] | None = None,
) -> str:
    cfg = {**_DEFAULT_HELLO_PAGE_CONFIG, **(page_config or {})}
    title: str = html_module.escape(str(cfg["title"]))
    server_key: str = cfg["server_key"]
    show_transport: bool = cfg["show_transport"]
    clients: list[str] = [html_module.escape(str(c)) for c in cfg["clients"]]
    app_name: str = html_module.escape(str(cfg.get("app_name", "Apache Superset")))
    logo_url: str | None = None
    if logo_url_raw := cfg.get("logo_url"):
        logo_url_stripped = str(logo_url_raw).strip()
        if logo_url_stripped.startswith(("http://", "https://")):
            logo_url = html_module.escape(logo_url_stripped)

    # html.escape() ensures server_key and all other content in the snippet
    # cannot break out of the <pre><code> block (json.dumps does not escape HTML).
    config_block = html_module.escape(
        _build_config_snippet(auth_enabled, server_key, show_transport)
    )

    if auth_enabled:
        connect_desc = (
            "Add the following to your MCP client configuration, "
            "replacing the URL and API key with your actual values:"
        )
        note = (
            "Replace <code>&lt;this-url&gt;</code> with the full URL of this page "
            "and <code>&lt;your-api-key&gt;</code> with a valid API key or JWT token."
        )
    else:
        connect_desc = (
            "Add the following to your MCP client configuration, "
            "replacing the URL with your actual server URL:"
        )
        note = "Replace <code>&lt;this-url&gt;</code> with the full URL of this page."

    client_items = "\n".join(f"      <li>{c}</li>" for c in clients)
    logo_html = (
        f'<img src="{logo_url}" alt="{title}" class="logo">\n    ' if logo_url else ""
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>{_HTML_STYLES}
  </style>
</head>
<body>
  <div class="card">
    {logo_html}<div class="badge">MCP API Endpoint</div>
    <h1>{title}</h1>
    <p>
      This is the <strong>Model Context Protocol (MCP)</strong> endpoint for
      {app_name}. It is an API designed for AI coding assistants —
      not a web page to browse directly.
    </p>
    <h2>How to connect</h2>
    <p>{connect_desc}</p>
    <pre><code>{config_block}</code></pre>
    <h2>Supported clients</h2>
    <p>This endpoint works with any MCP-compatible client, including:</p>
    <ul style="color:#444;margin:0 0 20px;padding-left:20px;">
{client_items}
      <li>Any client that supports the <code>streamable-http</code> transport</li>
    </ul>
    <div class="note">
      {note}
    </div>
  </div>
</body>
</html>"""


# Pre-built for _auth_error_handler (auth-required context, default config)
_MCP_BROWSER_HELLO_HTML = _build_browser_hello_html(auth_enabled=True)


def _prefers_browser_html(conn: HTTPConnection) -> bool:
    """Return True when the request looks like a browser navigation.

    Checks both the HTTP method (GET/HEAD only) and the Accept header
    (text/html present, application/json and text/event-stream absent).
    Case-insensitive to handle unusual but valid header values.
    """
    if conn.scope.get("method") not in ("GET", "HEAD"):
        return False
    accept = conn.headers.get("accept", "").lower()
    return (
        "text/html" in accept
        and "application/json" not in accept
        and "text/event-stream" not in accept
    )


class BrowserHelloMiddleware(BaseHTTPMiddleware):
    """Starlette middleware that returns a browser-friendly hello page.

    Intercepts GET/HEAD requests with a browser Accept header before they
    reach FastMCP's router (which returns 405 for GET). Works regardless
    of whether MCP_AUTH_ENABLED is True or False.

    When auth_enabled=True the page includes Bearer token setup instructions.
    When auth_enabled=False the page omits the Authorization header from the
    config snippet since no credentials are required.
    """

    def __init__(
        self,
        app: Any,
        auth_enabled: bool = False,
        page_config: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(app)
        self._html = _build_browser_hello_html(
            auth_enabled=auth_enabled, page_config=page_config
        )

    async def dispatch(
        self, request: Request, call_next: Callable[..., Any]
    ) -> Response:
        if request.method in ("GET", "HEAD") and _prefers_browser_html(request):
            return HTMLResponse(content=self._html, status_code=200)
        return await call_next(request)


def _auth_error_handler(conn: HTTPConnection, exc: AuthenticationError) -> Response:
    """Auth error handler for unauthenticated MCP requests.

    Returns a friendly HTML page for browser navigation requests so users
    who open the MCP URL in a browser see setup instructions instead of a
    raw JSON 401.

    For all other clients (API, SSE, non-GET methods) returns a standard
    JSON 401 per RFC 6750 Section 3.1.

    References:
        - RFC 6750 Section 3.1: https://datatracker.ietf.org/doc/html/rfc6750#section-3.1
        - CVE-2022-29266, CVE-2019-7644: verbose JWT errors led to exploits
    """
    if _prefers_browser_html(conn):
        return HTMLResponse(status_code=200, content=_MCP_BROWSER_HELLO_HTML)

    # Log detailed reason server-side only, with request context for
    # auditing/troubleshooting. Guard each lookup since the connection
    # object may be partially populated.
    client_host = "unknown"
    request_path = "unknown"
    user_agent = "unknown"
    try:
        if getattr(conn, "client", None):
            client_host = _sanitize_for_log(conn.client.host)
        request_path = _sanitize_for_log(conn.scope.get("path", "unknown"))
        user_agent = _sanitize_for_log(conn.headers.get("user-agent", "unknown"))
    except (AttributeError, KeyError, TypeError):
        logger.debug("Could not extract full request context for auth failure")

    logger.warning(
        "JWT authentication failed: %s (source_ip=%s, path=%s, user_agent=%s)",
        _sanitize_for_log(exc),
        client_host,
        request_path,
        user_agent,
    )

    return JSONResponse(
        status_code=401,
        content={
            "error": "invalid_token",
            "error_description": "Authentication failed",
        },
        headers={
            "WWW-Authenticate": 'Bearer error="invalid_token"',
        },
    )


class MCPJWTVerifier(JWTVerifier):
    """JWTVerifier with Superset MCP auth error handling.

    Provides browser-friendly HTML responses for unauthenticated browser
    navigation requests (GET/HEAD with Accept: text/html), while maintaining
    RFC 6750-compliant JSON 401 responses for API and SSE clients.

    Use this as the base for all Superset JWT verifiers so the browser hello
    page is active regardless of which verifier variant is configured.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        # Capture the explicit algorithm kwarg before super().__init__() can
        # coerce it (the factory defaults it to "RS256" when MCP_JWT_ALGORITHM
        # is unset, so self.algorithm is always truthy post-construction).
        explicit_algorithm = kwargs.get("algorithm")
        super().__init__(*args, **kwargs)
        # fastmcp >= 3.4.2 removed self.jwt from JWTVerifier (switched to joserfc
        # internally). Restore it here using authlib so that load_access_token()
        # can continue to call self.jwt.decode() with the raw verification key.
        self.jwt = JsonWebToken([self.algorithm])
        # Surface permissive auth configuration at startup. Config-gated:
        # a verifier is only built when auth is enabled (see mcp_config).
        # Prefer the raw MCP_JWT_ALGORITHM config value over the constructor
        # kwarg because the factory always supplies a non-None algorithm
        # default; falling back to the kwarg lets unit tests that construct
        # verifiers directly (without an app context) also get the warning
        # when no algorithm is pinned.
        from flask import current_app

        try:
            config_algorithm = current_app.config.get("MCP_JWT_ALGORITHM")
        except RuntimeError:
            # No Flask application context (e.g. unit tests constructing the
            # verifier directly). Fall back to the explicit constructor arg.
            config_algorithm = None

        _warn_on_weak_jwt_config(
            audience=getattr(self, "audience", None),
            algorithm=config_algorithm or explicit_algorithm,
        )

    def get_middleware(self) -> list[Any]:
        return [
            Middleware(
                AuthenticationMiddleware,
                backend=BearerAuthBackend(self),
                on_error=_auth_error_handler,
            ),
            Middleware(AuthContextMiddleware),
        ]


class DetailedBearerAuthBackend(BearerAuthBackend):
    """
    Bearer auth backend that raises AuthenticationError with specific
    JWT failure reasons instead of silently returning None.
    """

    async def authenticate(self, conn: HTTPConnection) -> tuple[Any, Any] | None:
        result = await super().authenticate(conn)

        if result is not None:
            # Clear any stale failure reason on success
            _jwt_failure_reason.set(None)
            return result

        # Check if there's a Bearer token present - if so, there was a
        # validation failure we can report with a specific reason
        auth_header = next(
            (
                conn.headers.get(key)
                for key in conn.headers
                if key.lower() == "authorization"
            ),
            None,
        )
        if auth_header and auth_header.lower().startswith("bearer "):
            reason = _jwt_failure_reason.get()
            if reason:
                _jwt_failure_reason.set(None)
                raise AuthenticationError(reason)

        return None


class DetailedJWTVerifier(MCPJWTVerifier):
    """
    JWT verifier with tiered server-side logging for each validation step.

    Logging tiers:
    - WARNING: generic failure categories only (via _jwt_failure_reason ContextVar
      and the error handler). No claim values, no server config.
    - DEBUG: detailed values (issuer, audience, client_id, scopes, exceptions)
      for operator troubleshooting.
    - Secrets (e.g. HS256 signing keys) are NEVER logged at any level.

    HTTP responses always return generic errors per RFC 6750 Section 3.1.
    Controlled by MCP_JWT_DEBUG_ERRORS config flag.
    """

    async def load_access_token(self, token: str) -> AccessToken | None:  # noqa: C901
        """
        Validate a JWT bearer token with detailed error reporting.

        Each validation step stores a specific failure reason in the
        _jwt_failure_reason ContextVar before returning None.
        """
        # Reset any previous failure reason
        _jwt_failure_reason.set(None)

        try:
            # Step 1: Decode header and check algorithm
            try:
                header = self._decode_token_header(token)
            except ValueError as e:
                reason = "Malformed token header"
                _jwt_failure_reason.set(reason)
                logger.debug("Malformed token header: %s", e)
                return None

            token_alg = header.get("alg")
            # Always reject unsigned ("none") tokens, even when no algorithm
            # is pinned. An unsigned token has no integrity guarantee, so its
            # claims (sub, scopes, ...) are fully attacker-controlled.
            if isinstance(token_alg, str) and token_alg.lower() in (
                _FORBIDDEN_ALGORITHMS
            ):
                reason = "Algorithm not allowed"
                _jwt_failure_reason.set(reason)
                logger.debug(
                    "Rejected forbidden algorithm: token uses '%s'",
                    _sanitize_for_log(token_alg),
                )
                return None
            # Require a pinned signing algorithm. Without one, the accepted
            # algorithm family would be whatever the verification key or the
            # underlying library permits; refuse rather than validating against
            # an unconstrained algorithm set. The production factory always
            # pins an algorithm, so this guards the directly-constructed case.
            if not self.algorithm:
                reason = "No signing algorithm pinned"
                _jwt_failure_reason.set(reason)
                logger.debug("Rejected token: verifier has no pinned signing algorithm")
                return None
            if token_alg != self.algorithm:
                reason = "Algorithm mismatch"
                _jwt_failure_reason.set(reason)
                logger.debug(
                    "Algorithm mismatch: token uses '%s', expected '%s'",
                    _sanitize_for_log(token_alg),
                    self.algorithm,
                )
                return None

            # Step 2: Get verification key (static or JWKS).
            #
            # For remote JWKS the upstream verifier performs a network fetch and
            # is expected to normalize transport failures (timeouts, connection
            # errors, non-200 responses, SSRF blocks) into ValueError. We do not
            # rely on that normalization alone: any retrieval failure — including
            # a raw httpx error, an asyncio timeout, or an OS-level connection
            # error that escapes the upstream conversion — must fail CLOSED and
            # reject the token, never fall through to "skip verification" or a
            # 500. Catching these here guarantees a fetch failure can never be
            # treated as a successful (or skipped) signature check.
            try:
                verification_key = await self._get_verification_key(token)
            except (
                httpx.HTTPError,
                asyncio.TimeoutError,
                ConnectionError,
                OSError,
            ) as e:
                # Transient failure reaching or reading the JWKS endpoint
                # (timeouts, connection errors, non-200 responses, SSRF blocks).
                # Treat it as an authentication failure (return None) instead of
                # letting the network error propagate as an unexpected exception.
                # ConnectionError is a subclass of OSError and asyncio.TimeoutError
                # aliases TimeoutError; they are listed explicitly to make the
                # fail-closed contract for raw transport errors unambiguous.
                reason = "JWKS verification key unavailable"
                _jwt_failure_reason.set(reason)
                # WARNING carries only the generic category (per the module's
                # logging contract); the sanitized exception detail, which may
                # include the JWKS endpoint host, is reserved for DEBUG.
                logger.warning("Could not fetch JWKS verification key")
                logger.debug("JWKS fetch error detail: %s", _sanitize_for_log(e))
                return None
            except ValueError as e:
                reason = "Failed to get verification key"
                _jwt_failure_reason.set(reason)
                logger.debug(
                    "Failed to get verification key (%s): %s", type(e).__name__, e
                )
                return None

            # Step 3: Decode and verify signature
            try:
                claims = self.jwt.decode(token, verification_key)
            except JoseError as e:
                error_code = getattr(e, "error", None)
                if error_code == "bad_signature":
                    reason = "Signature verification failed"
                elif error_code == "expired_token":
                    reason = "Token has expired (detected during decode)"
                else:
                    reason = "Token decode failed"
                    logger.debug("Token decode failed: %s", e)
                _jwt_failure_reason.set(reason)
                return None

            # Extract client ID for logging
            client_id = (
                claims.get("client_id")
                or claims.get("azp")
                or claims.get("sub")
                or "unknown"
            )

            # Step 4: Check expiration. An ``exp`` claim is required — tokens
            # without one would never expire and are rejected.
            exp = claims.get("exp")
            if exp is None:
                reason = "Token missing expiration"
                _jwt_failure_reason.set(reason)
                logger.debug(
                    "Token missing required exp claim for client '%s'",
                    _sanitize_for_log(client_id),
                )
                return None
            # ``exp`` must be a finite real number. A non-numeric value would
            # raise ``TypeError`` on the comparison below, and a non-finite
            # float (e.g. ``inf`` parsed from a JSON ``1e309``) would overflow
            # the ``int(exp)`` cast later, raising ``OverflowError``. Both are
            # rejected here with a precise reason rather than escaping as a
            # generic failure (or, for the overflow, an uncaught 500).
            if (
                not isinstance(exp, (int, float))
                or isinstance(exp, bool)
                or not math.isfinite(exp)
            ):
                reason = "Token has invalid expiration"
                _jwt_failure_reason.set(reason)
                logger.debug(
                    "Token exp claim is not a finite number for client '%s'",
                    _sanitize_for_log(client_id),
                )
                return None
            if exp < time.time():
                reason = "Token expired"
                _jwt_failure_reason.set(reason)
                logger.debug(
                    "Token expired for client '%s'", _sanitize_for_log(client_id)
                )
                return None

            # Step 4b: Check not-before (RFC 7519 Section 4.1.5). ``decode``
            # alone does not validate temporal claims here (claims are read
            # individually rather than via ``JWTClaims.validate``), so a token
            # whose ``nbf`` is in the future must be rejected explicitly, just
            # like ``exp`` above.
            nbf = claims.get("nbf")
            if nbf is not None and nbf > time.time():
                reason = "Token not yet valid"
                _jwt_failure_reason.set(reason)
                logger.debug(
                    "Token not yet valid for client '%s': nbf is in the future",
                    _sanitize_for_log(client_id),
                )
                return None

            # Step 5: Validate issuer
            if self.issuer:
                iss = claims.get("iss")
                if isinstance(self.issuer, list):
                    issuer_valid = iss in self.issuer
                else:
                    issuer_valid = iss == self.issuer

                if not issuer_valid:
                    reason = "Issuer mismatch"
                    _jwt_failure_reason.set(reason)
                    logger.debug(
                        "Issuer mismatch: token has '%s', expected '%s'",
                        _sanitize_for_log(iss),
                        self.issuer,
                    )
                    return None

            # Step 6: Validate audience
            if self.audience:
                aud = claims.get("aud")
                if isinstance(self.audience, list):
                    if isinstance(aud, list):
                        audience_valid = any(
                            expected in aud
                            for expected in cast(list[str], self.audience)
                        )
                    else:
                        audience_valid = aud in cast(list[str], self.audience)
                else:
                    if isinstance(aud, list):
                        audience_valid = self.audience in aud
                    else:
                        audience_valid = aud == self.audience

                if not audience_valid:
                    reason = "Audience mismatch"
                    _jwt_failure_reason.set(reason)
                    logger.debug(
                        "Audience mismatch: token has '%s', expected '%s'",
                        _sanitize_for_log(aud),
                        self.audience,
                    )
                    return None

            # Step 7: Check required scopes
            scopes = self._extract_scopes(claims)
            if self.required_scopes:
                token_scopes = set(scopes)
                required = set(self.required_scopes)
                if not required.issubset(token_scopes):
                    missing = required - token_scopes
                    reason = "Missing required scopes"
                    _jwt_failure_reason.set(reason)
                    logger.debug(
                        "Missing required scopes: %s. Token has: %s",
                        missing,
                        token_scopes,
                    )
                    return None

            # All validations passed. Log the successful authentication with
            # safe metadata only — never the token contents or any secret.
            # Coerce scope entries to strings before sorting so a malformed
            # (non-orderable) scope claim can never turn this audit log into a
            # TypeError that would mask a successful auth as a failure.
            scopes_for_log = sorted(str(scope) for scope in scopes)
            logger.info(
                "JWT authentication succeeded: client_id='%s', scopes=%s, "
                "auth_method='bearer_jwt'",
                _sanitize_for_log(client_id),
                _sanitize_for_log(" ".join(scopes_for_log) or "(none)"),
            )
            return AccessToken(
                token=token,
                client_id=str(client_id),
                scopes=scopes,
                expires_at=int(exp),
                claims=dict(claims),
            )

        except (
            ValueError,
            JoseError,
            KeyError,
            AttributeError,
            TypeError,
            OverflowError,
        ) as e:
            reason = "Token validation failed"
            _jwt_failure_reason.set(reason)
            logger.debug("Token validation failed: %s", e)
            return None

    def get_middleware(self) -> list[Any]:
        """
        Get middleware with detailed server-side error logging.

        Uses DetailedBearerAuthBackend which raises AuthenticationError
        with specific reasons for server-side logging. The error handler
        always returns generic 401 responses per RFC 6750.
        """
        return [
            Middleware(
                AuthenticationMiddleware,
                backend=DetailedBearerAuthBackend(self),
                on_error=_auth_error_handler,
            ),
            Middleware(AuthContextMiddleware),
        ]

    @staticmethod
    def _decode_token_header(token: str) -> dict[str, Any]:
        """Decode the JWT header without verifying the signature."""
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError(
                f"Token must have 3 parts (header.payload.signature), got {len(parts)}"
            )
        header_b64 = parts[0]
        # Add padding only if needed
        header_b64 += "=" * (-len(header_b64) % 4)
        header_bytes = base64.urlsafe_b64decode(header_b64)
        return json.loads(header_bytes)
