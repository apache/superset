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
"""add indexes to report models

Revision ID: 65a167d4c62e
Revises: 06dd9ff00fe8
Create Date: 2024-01-05 16:20:31.598995

"""

# revision identifiers, used by Alembic.
revision = "65a167d4c62e"
down_revision = "06dd9ff00fe8"


from superset.migrations.shared.utils import create_index, drop_index  # noqa: E402


def upgrade():
    create_index(
        "report_execution_log",
        "ix_report_execution_log_report_schedule_id",
        ["report_schedule_id"],
        unique=False,
    )
    create_index(
        "report_execution_log",
        "ix_report_execution_log_start_dttm",
        ["start_dttm"],
        unique=False,
    )
    create_index(
        "report_recipient",
        "ix_report_recipient_report_schedule_id",
        ["report_schedule_id"],
        unique=False,
    )


def downgrade():
    drop_index(
        index_name="ix_report_recipient_report_schedule_id",
        table_name="report_recipient",
    )
    drop_index(
        index_name="ix_report_execution_log_start_dttm",
        table_name="report_execution_log",
    )
    drop_index(
        index_name="ix_report_execution_log_report_schedule_id",
        table_name="report_execution_log",
    )
