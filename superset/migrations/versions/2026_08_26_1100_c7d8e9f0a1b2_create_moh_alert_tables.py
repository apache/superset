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
"""Create MoH Hierarchical Alert Service tables

Creates the three core tables for the MoH alert engine:
  1. moh_alert                  — alert definition (Section 6.1)
  2. moh_alert_delivery         — per-run audit (Section 6.2)
  3. moh_alert_delivery_recipient — per-recipient audit (Section 6.3)

Revision ID: c7d8e9f0a1b2
Revises: a1b2c3d4e5f6
Create Date: 2026-08-26 11:00:00.000000

"""

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_index,
    create_table,
    drop_fks_for_table,
    drop_index,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "c7d8e9f0a1b2"
down_revision = "33d7e0e21daa"

ALERT_TABLE = "moh_alert"
DELIVERY_TABLE = "moh_alert_delivery"
RECIPIENT_TABLE = "moh_alert_delivery_recipient"


def upgrade():
    # ── 1. moh_alert ─────────────────────────────────────────────
    create_table(
        ALERT_TABLE,
        Column("id", Integer, primary_key=True),
        Column("name", String(150), nullable=False, unique=True),
        Column("description", Text, nullable=True),
        Column("enabled", Boolean, nullable=False, server_default="1"),
        # FK → dbs.id (ClickHouse connection)
        Column("database_id", Integer, nullable=False),
        Column("sql_query", Text, nullable=False),
        Column("crontab", String(1000), nullable=False),
        Column(
            "timezone",
            String(100),
            nullable=False,
            server_default="Africa/Addis_Ababa",
        ),
        Column("grace_period", Integer, nullable=False, server_default="14400"),
        Column("working_timeout", Integer, nullable=False, server_default="120"),
        # FK → dashboards.id
        Column("dashboard_id", Integer, nullable=True),
        Column("subject_template", String(255), nullable=True),
        Column("html_extra", Text, nullable=True),
        # Last-run status
        Column("last_run_at", DateTime, nullable=True),
        Column("last_run_status", String(32), nullable=True),
        Column("last_error", Text, nullable=True),
        # FK → ab_user.id (alert owner)
        Column("owner_id", Integer, nullable=True),
        # AuditMixinNullable columns
        Column("created_on", DateTime, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),
        Column("changed_by_fk", Integer, nullable=True),
    )

    create_index(ALERT_TABLE, "ix_moh_alert_enabled", ["enabled"])
    create_index(ALERT_TABLE, "ix_moh_alert_database_id", ["database_id"])

    # FKs for moh_alert
    create_fks_for_table(
        foreign_key_name="fk_moh_alert_database_id_dbs",
        table_name=ALERT_TABLE,
        referenced_table="dbs",
        local_cols=["database_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_moh_alert_dashboard_id_dashboards",
        table_name=ALERT_TABLE,
        referenced_table="dashboards",
        local_cols=["dashboard_id"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )
    create_fks_for_table(
        foreign_key_name="fk_moh_alert_owner_id_ab_user",
        table_name=ALERT_TABLE,
        referenced_table="ab_user",
        local_cols=["owner_id"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )
    create_fks_for_table(
        foreign_key_name="fk_moh_alert_created_by_fk_ab_user",
        table_name=ALERT_TABLE,
        referenced_table="ab_user",
        local_cols=["created_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )
    create_fks_for_table(
        foreign_key_name="fk_moh_alert_changed_by_fk_ab_user",
        table_name=ALERT_TABLE,
        referenced_table="ab_user",
        local_cols=["changed_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    # ── 2. moh_alert_delivery ────────────────────────────────────
    create_table(
        DELIVERY_TABLE,
        Column("id", Integer, primary_key=True),
        # FK → moh_alert.id
        Column("alert_id", Integer, nullable=False),
        Column("task_id", String(64), nullable=True),
        Column("scheduled_at", DateTime, nullable=True),
        Column("started_at", DateTime, nullable=True),
        Column("finished_at", DateTime, nullable=True),
        Column("status", String(32), nullable=False, server_default="started"),
        Column("error_message", Text, nullable=True),
        Column("failing_facilities", Integer, nullable=False, server_default="0"),
        Column("ignored_rows", Integer, nullable=False, server_default="0"),
        Column("recipients", Integer, nullable=False, server_default="0"),
        # AuditMixinNullable columns
        Column("created_on", DateTime, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),
        Column("changed_by_fk", Integer, nullable=True),
    )

    create_index(DELIVERY_TABLE, "ix_moh_alert_delivery_alert_id", ["alert_id"])
    create_index(DELIVERY_TABLE, "ix_moh_alert_delivery_status", ["status"])
    create_index(DELIVERY_TABLE, "ix_moh_alert_delivery_started_at", ["started_at"])

    # FKs for moh_alert_delivery
    create_fks_for_table(
        foreign_key_name="fk_moh_alert_delivery_alert_id_moh_alert",
        table_name=DELIVERY_TABLE,
        referenced_table=ALERT_TABLE,
        local_cols=["alert_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_moh_alert_delivery_created_by_fk_ab_user",
        table_name=DELIVERY_TABLE,
        referenced_table="ab_user",
        local_cols=["created_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )
    create_fks_for_table(
        foreign_key_name="fk_moh_alert_delivery_changed_by_fk_ab_user",
        table_name=DELIVERY_TABLE,
        referenced_table="ab_user",
        local_cols=["changed_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    # ── 3. moh_alert_delivery_recipient ──────────────────────────
    create_table(
        RECIPIENT_TABLE,
        Column("id", Integer, primary_key=True),
        # FK → moh_alert_delivery.id
        Column("delivery_id", Integer, nullable=False),
        Column("username", String(150), nullable=True),
        Column("email", String(254), nullable=True),
        Column("org_unit_id", String(32), nullable=True),
        Column("org_unit_level", Integer, nullable=True),
        Column("facilities", Integer, nullable=False, server_default="0"),
        Column("sent", Boolean, nullable=False, server_default="0"),
    )

    create_index(
        RECIPIENT_TABLE,
        "ix_moh_alert_delivery_recipient_delivery_id",
        ["delivery_id"],
    )
    create_index(
        RECIPIENT_TABLE,
        "ix_moh_alert_delivery_recipient_username",
        ["username"],
    )

    # FKs for moh_alert_delivery_recipient
    create_fks_for_table(
        foreign_key_name="fk_moh_alert_delivery_recipient_delivery_id",
        table_name=RECIPIENT_TABLE,
        referenced_table=DELIVERY_TABLE,
        local_cols=["delivery_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )


def downgrade():
    # Drop in reverse order: recipient → delivery → alert

    # moh_alert_delivery_recipient
    drop_fks_for_table(
        RECIPIENT_TABLE,
        ["fk_moh_alert_delivery_recipient_delivery_id"],
    )
    drop_index(RECIPIENT_TABLE, "ix_moh_alert_delivery_recipient_delivery_id")
    drop_index(RECIPIENT_TABLE, "ix_moh_alert_delivery_recipient_username")
    drop_table(RECIPIENT_TABLE)

    # moh_alert_delivery
    drop_fks_for_table(
        DELIVERY_TABLE,
        [
            "fk_moh_alert_delivery_alert_id_moh_alert",
            "fk_moh_alert_delivery_created_by_fk_ab_user",
            "fk_moh_alert_delivery_changed_by_fk_ab_user",
        ],
    )
    drop_index(DELIVERY_TABLE, "ix_moh_alert_delivery_alert_id")
    drop_index(DELIVERY_TABLE, "ix_moh_alert_delivery_status")
    drop_index(DELIVERY_TABLE, "ix_moh_alert_delivery_started_at")
    drop_table(DELIVERY_TABLE)

    # moh_alert
    drop_fks_for_table(
        ALERT_TABLE,
        [
            "fk_moh_alert_database_id_dbs",
            "fk_moh_alert_dashboard_id_dashboards",
            "fk_moh_alert_owner_id_ab_user",
            "fk_moh_alert_created_by_fk_ab_user",
            "fk_moh_alert_changed_by_fk_ab_user",
        ],
    )
    drop_index(ALERT_TABLE, "ix_moh_alert_enabled")
    drop_index(ALERT_TABLE, "ix_moh_alert_database_id")
    drop_table(ALERT_TABLE)
