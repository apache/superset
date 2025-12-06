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
"""Version History Models

This module contains database models for storing version history of charts,
dashboards, and datasets.
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from flask_appbuilder import Model
from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from superset import security_manager
from superset.utils import core as utils


class AssetType(str, enum.Enum):
    """Enum for asset types that can have version history"""

    CHART = "chart"
    DASHBOARD = "dashboard"
    DATASET = "dataset"


class VersionHistory(Model):
    """
    Model for storing version history of charts, dashboards, and datasets.

    Each row represents a single version of an asset. The version data is stored
    as a JSON blob containing the complete YAML export of the asset at that point
    in time.
    """

    __tablename__ = "version_history"
    __table_args__ = (
        UniqueConstraint(
            "asset_type",
            "asset_id",
            "version_number",
            name="uq_version_history_asset_version",
        ),
    )

    id = Column(Integer, primary_key=True)

    # Asset identification
    asset_type = Column(
        Enum(AssetType),
        nullable=False,
        comment="Type of asset: chart, dashboard, or dataset",
    )
    asset_id = Column(
        Integer,
        nullable=False,
        comment="ID of the asset (slice_id, dashboard_id, or dataset_id)",
    )

    # Version information
    version_number = Column(
        Integer, nullable=False, comment="Sequential version number starting from 1"
    )

    # Version data - stored as JSON containing the YAML export
    version_data = Column(
        utils.MediumText(),
        nullable=False,
        comment="JSON blob containing the complete YAML export of the asset",
    )

    # Metadata
    description = Column(
        Text,
        nullable=True,
        comment="User-provided description of changes in this version",
    )

    # Audit fields
    created_on = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="Timestamp when this version was created",
    )
    created_by_fk = Column(
        Integer,
        ForeignKey("ab_user.id"),
        nullable=False,
        comment="User who created this version",
    )

    # Relationships
    created_by = relationship(security_manager.user_model, foreign_keys=[created_by_fk])

    def __repr__(self) -> str:
        return (
            f"<VersionHistory("
            f"asset_type={self.asset_type.value}, "
            f"asset_id={self.asset_id}, "
            f"version={self.version_number}"
            f")>"
        )

    @property
    def created_by_name(self) -> str:
        """Get the username of the creator"""
        if self.created_by:
            return self.created_by.username or ""
        return ""
