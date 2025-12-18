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
from __future__ import annotations

import enum

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy.orm import relationship

from superset.models.helpers import AuditMixinNullable, UUIDMixin


class GeneratorStatus(str, enum.Enum):
    """Status of the dashboard generation run"""

    RESERVED = "reserved"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PENDING_REVIEW = "pending_review"  # Quality < threshold, needs user fixes


class GeneratorPhase(str, enum.Enum):
    """Current phase of the dashboard generation pipeline"""

    COPY_DASHBOARD = "copy_dashboard"
    BUILD_DATASET_CHARTS = "build_dataset_charts"
    BUILD_DATASET_FILTERS = "build_dataset_filters"
    UPDATE_CHARTS = "update_charts"
    UPDATE_FILTERS = "update_filters"
    FINALIZE = "finalize"


class DashboardGeneratorRun(Model, AuditMixinNullable, UUIDMixin):
    """
    Tracks dashboard generation runs from templates.
    Stores status, progress, and mappings for the generation pipeline.
    """

    __tablename__ = "dashboard_generator_run"

    id = sa.Column(sa.Integer, primary_key=True)
    celery_task_id = sa.Column(sa.String(256), unique=True, nullable=True)

    # Input references
    database_report_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("database_schema_report.id", ondelete="SET NULL"),
        nullable=True,
    )
    template_dashboard_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("dashboards.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Output references (populated as phases complete)
    generated_dashboard_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("dashboards.id", ondelete="SET NULL"),
        nullable=True,
    )
    generated_dataset_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("tables.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Status tracking
    status = sa.Column(
        sa.Enum(GeneratorStatus, values_callable=lambda x: [e.value for e in x]),
        default=GeneratorStatus.RESERVED,
        nullable=False,
    )
    current_phase = sa.Column(
        sa.Enum(GeneratorPhase, values_callable=lambda x: [e.value for e in x]),
        nullable=True,
    )

    # Progress tracking (JSON: {charts_total, charts_done, filters_total, filters_done})
    progress_json = sa.Column(sa.Text, nullable=True)

    # Mapping data (populated during phases)
    column_mappings_json = sa.Column(sa.Text, nullable=True)  # {template_col: new_col}
    metric_mappings_json = sa.Column(
        sa.Text, nullable=True
    )  # {template_metric: new_metric_sql}

    # Timing
    reserved_dttm = sa.Column(sa.DateTime, nullable=True)
    start_dttm = sa.Column(sa.DateTime, nullable=True)
    end_dttm = sa.Column(sa.DateTime, nullable=True)

    # Error tracking
    error_message = sa.Column(sa.Text, nullable=True)
    failed_items_json = sa.Column(
        sa.Text, nullable=True
    )  # Track individual chart/filter failures

    # Relationships
    database_report = relationship(
        "DatabaseSchemaReport",
        foreign_keys=[database_report_id],
        backref="generator_runs",
    )
    template_dashboard = relationship(
        "Dashboard",
        foreign_keys=[template_dashboard_id],
        backref="template_generator_runs",
    )
    generated_dashboard = relationship(
        "Dashboard",
        foreign_keys=[generated_dashboard_id],
        backref="generated_from_runs",
    )
    generated_dataset = relationship(
        "SqlaTable",
        foreign_keys=[generated_dataset_id],
        backref="generated_from_runs",
    )
