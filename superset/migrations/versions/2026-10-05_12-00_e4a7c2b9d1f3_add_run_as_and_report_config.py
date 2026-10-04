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
"""Add Run As columns to report_schedule and create the report_config table

Part of SIP-209 (Improved Alerts & Reports).

``report_schedule.run_as_fk`` and ``report_schedule.run_alert_query_as_fk`` are
nullable foreign keys to ``ab_user``. They are intentionally left NULL so the
existing ``ALERT_REPORTS_EXECUTORS`` resolution keeps being used until a value
is set.

``report_config`` is a key-value table holding the global Alerts & Reports
configuration (attachments for alerts, minimum intervals and recipient
restrictions). It starts empty: every setting falls back to the corresponding
application config or feature flag until an admin saves a value.

Revision ID: e4a7c2b9d1f3
Revises: 884a2115ebd3
Create Date: 2026-10-05 12:00:00.000000

"""

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    add_columns,
    create_fks_for_table,
    create_table,
    drop_columns,
    drop_fks_for_table,
    drop_table,
    table_has_column,
)

# revision identifiers, used by Alembic.
revision = "e4a7c2b9d1f3"
down_revision = "884a2115ebd3"

REPORT_SCHEDULE_TABLE = "report_schedule"
REPORT_CONFIG_TABLE = "report_config"

RUN_AS_FK_NAME = "fk_report_schedule_run_as_fk_ab_user"
RUN_ALERT_QUERY_AS_FK_NAME = "fk_report_schedule_run_alert_query_as_fk_ab_user"


def upgrade() -> None:
    add_columns(
        REPORT_SCHEDULE_TABLE,
        Column("run_as_type", String(50), nullable=True),
        Column("run_alert_query_as_type", String(50), nullable=True),
        Column("run_as_fk", Integer, nullable=True),
        Column("run_alert_query_as_fk", Integer, nullable=True),
    )
    create_fks_for_table(
        foreign_key_name=RUN_AS_FK_NAME,
        table_name=REPORT_SCHEDULE_TABLE,
        referenced_table="ab_user",
        local_cols=["run_as_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )
    create_fks_for_table(
        foreign_key_name=RUN_ALERT_QUERY_AS_FK_NAME,
        table_name=REPORT_SCHEDULE_TABLE,
        referenced_table="ab_user",
        local_cols=["run_alert_query_as_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    create_table(
        REPORT_CONFIG_TABLE,
        Column("id", UUIDType(binary=True), primary_key=True),
        Column("key", String(255), nullable=False, unique=True),
        Column("value", Text, nullable=True),
        # AuditMixinNullable columns
        Column("created_on", DateTime, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),
        Column("changed_by_fk", Integer, nullable=True),
    )
    create_fks_for_table(
        foreign_key_name="fk_report_config_created_by_fk_ab_user",
        table_name=REPORT_CONFIG_TABLE,
        referenced_table="ab_user",
        local_cols=["created_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )
    create_fks_for_table(
        foreign_key_name="fk_report_config_changed_by_fk_ab_user",
        table_name=REPORT_CONFIG_TABLE,
        referenced_table="ab_user",
        local_cols=["changed_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    drop_table(REPORT_CONFIG_TABLE)

    if table_has_column(REPORT_SCHEDULE_TABLE, "run_as_fk") or table_has_column(
        REPORT_SCHEDULE_TABLE, "run_alert_query_as_fk"
    ):
        drop_fks_for_table(
            REPORT_SCHEDULE_TABLE,
            [RUN_AS_FK_NAME, RUN_ALERT_QUERY_AS_FK_NAME],
        )
        drop_columns(
            REPORT_SCHEDULE_TABLE,
            "run_as_fk",
            "run_alert_query_as_fk",
            "run_as_type",
            "run_alert_query_as_type",
        )
