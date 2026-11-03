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
"""Add Run As columns to report_schedule

Part of SIP-209 (Improved Alerts & Reports).

``report_schedule.run_as_fk`` and ``report_schedule.run_alert_query_as_fk`` are
nullable foreign keys to ``ab_user``. They are intentionally left NULL so the
existing ``ALERT_REPORTS_EXECUTORS`` resolution keeps being used until a value
is set.

The global Alerts & Reports configuration is stored in the existing key-value
table. An empty document leaves every setting on its application config or
feature-flag fallback until an admin saves a value.

Revision ID: e4a7c2b9d1f3
Revises: 00fab727cd0a
Create Date: 2026-10-05 12:00:00.000000

"""

from uuid import UUID

from alembic import op
from sqlalchemy import (
    Column,
    column,
    delete,
    insert,
    Integer,
    LargeBinary,
    select,
    String,
    table,
    update,
)
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    add_columns,
    create_fks_for_table,
    drop_columns,
    drop_fks_for_table,
    table_has_column,
)

# revision identifiers, used by Alembic.
revision = "e4a7c2b9d1f3"
down_revision = "00fab727cd0a"

REPORT_SCHEDULE_TABLE = "report_schedule"

RUN_AS_FK_NAME = "fk_report_schedule_run_as_fk_ab_user"
RUN_ALERT_QUERY_AS_FK_NAME = "fk_report_schedule_run_alert_query_as_fk_ab_user"
CONFIG_UUID = UUID("d4f7d2f0-bbd7-4d03-b1da-09c70f5705ec")
CONFIG_RESOURCE = "alert_report_config"
KEY_VALUE_TABLE = table(
    "key_value",
    column("resource", String),
    column("uuid", UUIDType(binary=True)),
    column("value", LargeBinary),
)


def upgrade() -> None:
    add_columns(
        REPORT_SCHEDULE_TABLE,
        Column("run_as_fk", Integer, nullable=True),
        Column("run_alert_query_as_fk", Integer, nullable=True),
        # When an account is deleted, ``run_as_fk`` gets cleared. Without
        # ``run_alert_query_as_fk``, this would automatically change the
        # schedule to fallback to ``ALERT_REPORTS_EXECUTORS``.
        Column("run_as_type", String(50), nullable=True),
        # Similarly, ``run_alert_query_as_type`` is used to replicate
        # ``run_as_fk`` into ``run_alert_query_as_fk``.
        Column("run_alert_query_as_type", String(50), nullable=True),
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
    bind = op.get_bind()
    if (
        bind.execute(
            select(KEY_VALUE_TABLE.c.uuid).where(KEY_VALUE_TABLE.c.uuid == CONFIG_UUID)
        ).first()
        is None
    ):
        bind.execute(
            insert(KEY_VALUE_TABLE).values(
                resource=CONFIG_RESOURCE,
                uuid=CONFIG_UUID,
                value=b'{"version": 1, "settings": {}}',
            )
        )


def downgrade() -> None:
    op.get_bind().execute(
        delete(KEY_VALUE_TABLE).where(KEY_VALUE_TABLE.c.uuid == CONFIG_UUID)
    )

    # This feature allow users to create alerts with report_format == "NONE"
    # and optionally no ``chart_id`` / ``dashboard_id``. For the downgrade,
    # we'll revert the format to ``PNG`` to the ones that have an ID, and
    # delete the ones with no ID.
    schedules = table(
        REPORT_SCHEDULE_TABLE,
        column("id", Integer),
        column("type", String),
        column("report_format", String),
        column("chart_id", Integer),
        column("dashboard_id", Integer),
    )
    attachment_free_alert = (schedules.c.type == "Alert") & (
        schedules.c.report_format == "NONE"
    )
    without_asset = (
        attachment_free_alert
        & schedules.c.chart_id.is_(None)
        & (schedules.c.dashboard_id.is_(None))
    )
    deleted_ids = select(schedules.c.id).where(without_asset)
    bind = op.get_bind()
    for name in (
        "report_recipient",
        "report_execution_log",
        "report_schedule_editors",
    ):
        dependent = table(name, column("report_schedule_id", Integer))
        bind.execute(
            delete(dependent).where(dependent.c.report_schedule_id.in_(deleted_ids))
        )
    bind.execute(delete(schedules).where(without_asset))
    bind.execute(
        update(schedules).where(attachment_free_alert).values(report_format="PNG")
    )

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
