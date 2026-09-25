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
"""Persistence for MCP OAuth clients, authorization codes and refresh tokens."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from flask_appbuilder import Model
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy_utils import UUIDType

from superset.utils import json


def utcnow() -> datetime:
    """Naive UTC now, matching how Superset stores timestamps."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _json_list(value: Any) -> list[str]:
    try:
        parsed = json.loads(str(value or "[]"))
    except json.JSONDecodeError:
        return []
    return [str(item) for item in parsed] if isinstance(parsed, list) else []


class MCPOAuthClient(Model):
    """A client registered through dynamic client registration (RFC 7591)."""

    __tablename__ = "mcp_oauth_clients"

    id = Column(UUIDType(binary=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(String(64), nullable=False, unique=True)
    # Only confidential clients have a secret; it is stored as a SHA-256 hash.
    client_secret_hash = Column(String(64), nullable=True)
    client_name = Column(String(255), nullable=True)
    redirect_uris = Column(Text, nullable=False)
    grant_types = Column(Text, nullable=False)
    token_endpoint_auth_method = Column(String(32), nullable=False)
    scope = Column(Text, nullable=True)
    created_on = Column(DateTime, nullable=False, default=utcnow)

    @property
    def redirect_uri_list(self) -> list[str]:
        return _json_list(self.redirect_uris)

    @property
    def grant_type_list(self) -> list[str]:
        return _json_list(self.grant_types)


class MCPOAuthAuthorizationCode(Model):
    """A one-time authorization code, bound to its client, user and PKCE challenge."""

    __tablename__ = "mcp_oauth_authorization_codes"

    id = Column(UUIDType(binary=True), primary_key=True, default=uuid.uuid4)
    code_hash = Column(String(64), nullable=False, unique=True)
    client_pk = Column(
        UUIDType(binary=True),
        ForeignKey("mcp_oauth_clients.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        Integer, ForeignKey("ab_user.id", ondelete="CASCADE"), nullable=False
    )
    redirect_uri = Column(Text, nullable=False)
    code_challenge = Column(String(128), nullable=False)
    resource = Column(Text, nullable=False)
    scope = Column(Text, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_on = Column(DateTime, nullable=False, default=utcnow)

    client = relationship(MCPOAuthClient)


class MCPOAuthRefreshToken(Model):
    """
    A refresh token, stored hashed. Rotated on every use; replaying a rotated
    token revokes its whole family (every token descended from one grant).
    """

    __tablename__ = "mcp_oauth_refresh_tokens"

    id = Column(UUIDType(binary=True), primary_key=True, default=uuid.uuid4)
    token_hash = Column(String(64), nullable=False, unique=True)
    family_id = Column(UUIDType(binary=True), nullable=False, index=True)
    client_pk = Column(
        UUIDType(binary=True),
        ForeignKey("mcp_oauth_clients.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        Integer, ForeignKey("ab_user.id", ondelete="CASCADE"), nullable=False
    )
    resource = Column(Text, nullable=False)
    scope = Column(Text, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, nullable=False, default=False)
    created_on = Column(DateTime, nullable=False, default=utcnow)

    client = relationship(MCPOAuthClient)
