#!/usr/bin/env python3
"""
Development JWT token generator for Superset MCP service.

Usage:
    python generate_dev_token.py
    python generate_dev_token.py --user alice --scopes "chart:read dashboard:read"
"""

import argparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import jwt
from mcp_config import MCP_AUTH_CONFIG


def generate_dev_token(
    username: str = "admin",
    scopes: list[str] | None = None,
    expires_hours: int = 24,
    config_override: dict[str, Any] | None = None,
) -> str:
    """Generate a development JWT token using MCP config."""

    if scopes is None:
        # Default scopes for development
        scopes = [
            "dashboard:read",
            "dashboard:write",
            "chart:read",
            "chart:write",
            "dataset:read",
            "instance:read",
        ]

    # Use config override or default MCP auth config
    config = config_override or MCP_AUTH_CONFIG

    # Get values from MCP config
    dev_secret = config.get(
        "MCP_JWT_SECRET", "dev_secret_for_mcp_tokens_change_in_production"
    )
    issuer = config.get("MCP_JWT_ISSUER", "superset-mcp-dev")
    audience = config.get("MCP_JWT_AUDIENCE", "superset-mcp-api")
    algorithm = config.get("MCP_JWT_ALGORITHM", "HS256")

    # Token payload
    now = datetime.utcnow()
    payload = {
        "iss": issuer,
        "aud": audience,
        "sub": username,  # Subject (username)
        "iat": int(now.timestamp()),  # Issued at
        "exp": int((now + timedelta(hours=expires_hours)).timestamp()),  # Expires
        "scope": " ".join(scopes),  # Space-separated scopes
        "client_id": username,  # Client ID (used by user resolver)
    }

    # Generate JWT token
    token = jwt.encode(payload, dev_secret, algorithm=algorithm)

    return token


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate development JWT tokens for Superset MCP"
    )
    parser.add_argument("--user", "-u", default="admin", help="Username for the token")
    parser.add_argument(
        "--scopes", "-s", help="Space-separated scopes (default: all dev scopes)"
    )
    parser.add_argument(
        "--expires", "-e", type=int, default=24, help="Token expiry in hours"
    )
    parser.add_argument(
        "--save", action="store_true", help="Save token to ~/.superset_mcp_token"
    )

    args = parser.parse_args()

    # Parse scopes
    scopes = args.scopes.split() if args.scopes else None

    # Generate token
    token = generate_dev_token(
        username=args.user, scopes=scopes, expires_hours=args.expires
    )

    print(f"Generated token for user: {args.user}")
    print(f"Expires in: {args.expires} hours")
    print(f"Token: {token}")
    print()

    # Save to file if requested
    if args.save:
        token_file = Path.home() / ".superset_mcp_token"
        token_file.write_text(token)
        print(f"Token saved to: {token_file}")
        print()

    # Show usage examples
    print("Usage examples:")
    print()
    print("1. Environment variable:")
    print(f'   export SUPERSET_MCP_TOKEN="{token}"')
    print()
    print("2. Authorization header:")
    print(f"   Authorization: Bearer {token}")
    print()
    print("3. Claude Desktop config:")
    print("   {")
    print('     "mcpServers": {')
    print('       "Superset MCP": {')
    print('         "command": "/path/to/superset/superset/mcp_service/run_proxy.sh",')
    print('         "env": {')
    print(f'           "SUPERSET_MCP_TOKEN": "{token}"')
    print("         }")
    print("       }")
    print("     }")
    print("   }")


if __name__ == "__main__":
    main()
