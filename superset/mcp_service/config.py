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

"""MCP Service Configuration."""

import logging
from typing import Any, Optional

from flask import Flask

logger = logging.getLogger(__name__)


def create_default_mcp_auth_factory(app: Flask) -> Optional[Any]:
    """Default MCP auth factory using app.config values."""
    if not app.config.get("MCP_AUTH_ENABLED", False):
        return None

    jwks_uri = app.config.get("MCP_JWKS_URI")
    public_key = app.config.get("MCP_JWT_PUBLIC_KEY")

    if not (jwks_uri or public_key):
        logger.warning("MCP_AUTH_ENABLED is True but no JWT keys configured")
        return None

    try:
        from fastmcp.server.auth.providers.bearer import BearerAuthProvider

        return BearerAuthProvider(
            jwks_uri=jwks_uri,
            public_key=public_key,
            issuer=app.config.get("MCP_JWT_ISSUER"),
            audience=app.config.get("MCP_JWT_AUDIENCE"),
            algorithm=app.config.get("MCP_JWT_ALGORITHM", "RS256"),
            required_scopes=app.config.get("MCP_REQUIRED_SCOPES", []),
        )
    except Exception as e:
        logger.error("Failed to create MCP auth provider: %s", e)
        return None


def default_user_resolver(access_token: Any) -> Optional[str]:
    """Extract username from JWT token claims."""
    if hasattr(access_token, "subject"):
        return access_token.subject
    if hasattr(access_token, "client_id"):
        return access_token.client_id
    if hasattr(access_token, "payload") and isinstance(access_token.payload, dict):
        return (
            access_token.payload.get("sub")
            or access_token.payload.get("email")
            or access_token.payload.get("username")
        )
    return None


DEFAULT_CONFIG = {
    "MCP_AUTH_ENABLED": False,
    "MCP_AUTH_FACTORY": create_default_mcp_auth_factory,
    "MCP_USER_RESOLVER": default_user_resolver,
    "MCP_JWKS_URI": None,
    "MCP_JWT_PUBLIC_KEY": None,
    "MCP_JWT_ISSUER": None,
    "MCP_JWT_AUDIENCE": None,
    "MCP_JWT_ALGORITHM": "RS256",
    "MCP_REQUIRED_SCOPES": [],
    "MCP_ADMIN_USERNAME": "admin",
}

# Example MCP Authentication Configuration for superset_config.py
# Add these settings to your superset_config.py to enable MCP authentication.

# Example 1: Simple Configuration (Recommended)
# MCP_AUTH_ENABLED = True
# MCP_ADMIN_USERNAME = "your_admin_username"  # Must exist in Superset users

# Example 2: JWT-based Authentication
# def custom_user_resolver(access_token):
#     """Extract username from JWT token."""
#     return access_token.get("username") or access_token.get("sub")
#
# MCP_AUTH_ENABLED = True
# MCP_USER_RESOLVER = custom_user_resolver
# MCP_JWT_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
# YOUR_RSA_PUBLIC_KEY_HERE
# -----END PUBLIC KEY-----"""
# MCP_JWT_ISSUER = "your-auth-provider"
# MCP_JWT_AUDIENCE = "superset-mcp"

# Example 3: JWKS URI Configuration
# MCP_AUTH_ENABLED = True
# MCP_JWKS_URI = "https://your-auth-provider.com/.well-known/jwks.json"
# MCP_JWT_ISSUER = "your-auth-provider"
# MCP_JWT_AUDIENCE = "superset-mcp"
