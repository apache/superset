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

"""Model for storing Dynamic (Handlebars) dashboard configuration."""

from __future__ import annotations

from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from superset import db
from superset.models.helpers import AuditMixinNullable


class DynamicDashboardConfig(db.Model, AuditMixinNullable):  # type: ignore[name-defined]
    """Stores the Handlebars template and slot configuration for a Dynamic dashboard.

    Separates the rendering config from the dashboard's ``position_json`` layout
    blob, making it safe from accidental overwrites by the layout editor and
    enabling future version-history support.
    """

    __tablename__ = "dynamic_dashboard_configs"

    id = Column(Integer, primary_key=True)
    dashboard_id = Column(
        Integer, ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    # The root Handlebars HTML template.
    template = Column(Text, nullable=False)

    # JSON array of slot definitions:
    # [{"name": "...", "formData": {...}, "template": "..."}]
    slots = Column(Text, nullable=False, default="[]")

    # Optional JSON object for drill-down configuration.
    drill_down_config = Column(Text, nullable=True)

    # Monotonically increasing version, for future version-history support.
    version = Column(Integer, nullable=False, default=1)

    dashboard = relationship(
        "Dashboard",
        foreign_keys=[dashboard_id],
        backref="dynamic_config",
    )
