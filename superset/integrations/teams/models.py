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
"""Teams bot installation metadata, separate from destination configuration."""

from datetime import datetime
from uuid import UUID, uuid4

from flask_appbuilder import Model
from sqlalchemy import Boolean, DateTime, String, UniqueConstraint
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy_utils import UUIDType


class TeamsInstallation(Model):
    """One bot installation per tenant, application, and team, retained on removal."""

    __tablename__ = "teams_installations"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "application_id",
            "team_id",
            name="uq_teams_installation_identity",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        UUIDType(binary=True), primary_key=True, default=uuid4
    )
    tenant_id: Mapped[UUID] = mapped_column(UUIDType(binary=True), nullable=False)
    application_id: Mapped[UUID] = mapped_column(UUIDType(binary=True), nullable=False)
    team_id: Mapped[str] = mapped_column(String(255), nullable=False)
    # Set only from an authenticated installation event after service URL verification.
    service_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Naive UTC, matching Superset metadata timestamps.
    # changed_on records the last event processing time.
    event_at: Mapped[datetime] = mapped_column(
        DateTime()
        .with_variant(mysql.DATETIME(fsp=6), "mysql")
        .with_variant(mysql.DATETIME(fsp=6), "mariadb"),
        nullable=False,
    )
    created_on: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    changed_on: Mapped[datetime] = mapped_column(DateTime, nullable=False)
