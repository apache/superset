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
Resource-server side of Superset's MCP OAuth: advertises the Superset
authorization server (RFC 9728) and verifies the access tokens it issues.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlsplit

from fastmcp.server.auth import RemoteAuthProvider, TokenVerifier
from pydantic import AnyHttpUrl


class MCPOAuthConfigError(ValueError):
    """MCP OAuth is enabled without the settings it needs."""


def validate_oauth_config(config: Any) -> tuple[str, list[str]]:
    """Return the issuer and resources, raising when either is missing or unsafe."""
    issuer = str(config.get("MCP_OAUTH_ISSUER") or "").rstrip("/")
    resources = [str(resource) for resource in config.get("MCP_OAUTH_RESOURCES") or []]
    if not issuer or not resources:
        raise MCPOAuthConfigError(
            "MCP_OAUTH_ENABLED requires MCP_OAUTH_ISSUER and MCP_OAUTH_RESOURCES."
        )
    for url in (issuer, *resources):
        parts = urlsplit(url)
        local = parts.hostname in {"localhost", "127.0.0.1", "::1"}
        if parts.scheme != "https" and not (parts.scheme == "http" and local):
            raise MCPOAuthConfigError(
                "MCP_OAUTH_ISSUER and MCP_OAUTH_RESOURCES must be https URLs."
            )
    return issuer, resources


class OAuthResourceServerProvider(RemoteAuthProvider):
    """
    A ``RemoteAuthProvider`` that advertises the configured resource URL as-is,
    so a public path behind a proxy need not match the local MCP mount path,
    and keeps the wrapped verifier's middleware (browser page, error handling).
    """

    def __init__(self, token_verifier: TokenVerifier, resource: str, **kwargs: Any):
        super().__init__(token_verifier=token_verifier, **kwargs)
        self._resource = resource

    def _get_resource_url(self, path: str | None = None) -> AnyHttpUrl | None:
        return AnyHttpUrl(self._resource)

    def get_middleware(self) -> list[Any]:
        return self.token_verifier.get_middleware()


def build_oauth_resource_provider(
    config: Any, token_verifier: TokenVerifier
) -> OAuthResourceServerProvider:
    """Wrap a verifier so unauthenticated MCP clients can discover the AS."""
    issuer, resources = validate_oauth_config(config)
    resource = resources[0]
    parts = urlsplit(resource)
    return OAuthResourceServerProvider(
        token_verifier=token_verifier,
        resource=resource,
        authorization_servers=[AnyHttpUrl(issuer)],
        base_url=f"{parts.scheme}://{parts.netloc}",
        scopes_supported=list(config.get("MCP_OAUTH_SCOPES") or ["mcp"]),
        resource_name=f"{config.get('APP_NAME') or 'Superset'} MCP",
    )
