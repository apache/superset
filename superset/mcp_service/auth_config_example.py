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
Example MCP Authentication Configuration for superset_config.py

Add these settings to your superset_config.py to enable MCP authentication.
"""

from typing import Any, Optional

from flask import Flask

# ---------------------------------------------------
# Example 1: Simple Configuration (Recommended)
# ---------------------------------------------------

# Enable MCP authentication
MCP_AUTH_ENABLED = True

# JWT configuration
MCP_JWKS_URI = "https://your-auth-provider.com/.well-known/jwks.json"
MCP_JWT_ISSUER = "https://your-auth-provider.com/"
MCP_JWT_AUDIENCE = "superset-mcp-server"
MCP_JWT_ALGORITHM = "RS256"
MCP_REQUIRED_SCOPES = ["superset:read", "superset:query"]

# The default factory will use these values automatically


# ---------------------------------------------------
# Example 2: Custom Factory (Following @dpgaspar's pattern)
# ---------------------------------------------------


def create_custom_mcp_auth(app: Flask) -> Optional[Any]:
    """Custom MCP auth factory following Superset patterns."""
    # Access config values from app.config
    jwks_uri = app.config["MCP_JWKS_URI"]
    issuer = app.config["MCP_JWT_ISSUER"]
    audience = app.config["MCP_JWT_AUDIENCE"]

    # Add custom logic here
    if app.debug:
        app.logger.info("MCP auth in debug mode")

    from fastmcp.server.auth.providers.bearer import BearerAuthProvider

    return BearerAuthProvider(
        jwks_uri=jwks_uri,
        issuer=issuer,
        audience=audience,
        algorithm=app.config.get("MCP_JWT_ALGORITHM", "RS256"),
        required_scopes=app.config.get("MCP_REQUIRED_SCOPES", []),
    )


# Override the default factory
# MCP_AUTH_FACTORY = create_custom_mcp_auth


# ---------------------------------------------------
# Example 3: Environment-based Factory
# ---------------------------------------------------


def create_env_based_mcp_auth(app: Flask) -> Optional[Any]:
    """Factory that uses environment variables with app.config fallback."""
    import os

    # Check environment first, then app.config
    if os.getenv("DISABLE_MCP_AUTH", "").lower() == "true":
        return None

    jwks_uri = os.getenv("MCP_JWKS_URI") or app.config.get("MCP_JWKS_URI")
    if not jwks_uri:
        app.logger.warning("No JWKS URI configured for MCP auth")
        return None

    from fastmcp.server.auth.providers.bearer import BearerAuthProvider

    return BearerAuthProvider(
        jwks_uri=jwks_uri,
        issuer=os.getenv("MCP_JWT_ISSUER") or app.config.get("MCP_JWT_ISSUER"),
        audience=os.getenv("MCP_JWT_AUDIENCE") or app.config.get("MCP_JWT_AUDIENCE"),
    )


# MCP_AUTH_FACTORY = create_env_based_mcp_auth


# ---------------------------------------------------
# Example 4: Custom JWT User Resolution
# ---------------------------------------------------


def custom_user_resolver(access_token: Any) -> Optional[str]:
    """
    Custom resolver to extract username from JWT token.
    Useful when your JWT has non-standard claim names.
    """
    # Example: Extract from nested claims
    if hasattr(access_token, "payload"):
        user_info = access_token.payload.get("user_info", {})
        return user_info.get("preferred_username") or user_info.get("email")

    # Fallback to standard claims
    return access_token.subject or access_token.client_id


# MCP_USER_RESOLVER = custom_user_resolver
