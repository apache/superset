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
Models for MCP (Model Context Protocol) service.

This module contains database models specific to the MCP service,
including API key authentication.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from superset.models.core import Model


class ApiKey(Model):
    """
    API key for MCP service authentication.

    API keys provide an alternative authentication method to JWT tokens,
    useful for programmatic access, CI/CD pipelines, and service-to-service
    communication.

    Security considerations:
    - Keys are never stored in plaintext (only bcrypt hashes)
    - Keys are shown only once at creation
    - Keys can be revoked immediately
    - Keys are workspace-scoped for multi-tenant isolation
    - Keys inherit the user's role permissions (RBAC)
    """

    __tablename__ = "ab_api_key"

    # Primary key
    id = Column(Integer, primary_key=True)

    # API key identification
    name = Column(String(256), nullable=False)
    """User-friendly name/label for the API key (e.g., 'CI/CD Pipeline')"""

    key_hash = Column(String(128), nullable=False, unique=True, index=True)
    """bcrypt hash of the API key (never store plaintext)"""

    key_prefix = Column(String(8), nullable=False)
    """First 8 characters of key for identification (e.g., 'pst_a1b2')"""

    # Ownership and scoping
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=False, index=True)
    """User who owns this API key (inherits their permissions)"""

    workspace_name = Column(String(256), nullable=False, index=True)
    """Workspace this key is scoped to (denormalized for performance)"""

    # Lifecycle
    created_on = Column(DateTime, nullable=False, default=datetime.utcnow)
    """When the API key was created"""

    created_by_fk = Column(Integer, ForeignKey("ab_user.id"))
    """User who created this API key (may differ from user_id)"""

    expires_on = Column(DateTime, nullable=True)
    """When the API key expires (NULL = no expiration)"""

    revoked_on = Column(DateTime, nullable=True)
    """When the API key was revoked (NULL = active)"""

    revoked_by_fk = Column(Integer, ForeignKey("ab_user.id"))
    """User who revoked this API key"""

    last_used_on = Column(DateTime, nullable=True)
    """When the API key was last successfully used"""

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="api_keys")
    created_by = relationship("User", foreign_keys=[created_by_fk])
    revoked_by = relationship("User", foreign_keys=[revoked_by_fk])

    # Indexes for performance
    __table_args__ = (
        # Composite index for workspace + user queries
        Index("idx_api_key_workspace_user", "workspace_name", "user_id"),
        # Index for filtering active keys
        Index("idx_api_key_active", "revoked_on", "expires_on"),
    )

    def is_active(self) -> bool:
        """
        Check if the API key is currently active.

        Returns:
            True if key is not revoked and not expired, False otherwise
        """
        if self.revoked_on is not None:
            return False

        if self.expires_on is not None and self.expires_on < datetime.utcnow():
            return False

        return True

    def __repr__(self) -> str:
        """String representation of ApiKey."""
        status = "active" if self.is_active() else "inactive"
        return (
            f"<ApiKey(id={self.id}, name='{self.name}', "
            f"prefix='{self.key_prefix}', workspace='{self.workspace_name}', "
            f"status={status})>"
        )
