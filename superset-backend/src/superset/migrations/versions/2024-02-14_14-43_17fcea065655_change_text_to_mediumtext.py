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
"""change_text_to_mediumtext

Revision ID: 17fcea065655
Revises: 87d38ad83218
Create Date: 2024-02-14 14:43:39.898093

"""

# revision identifiers, used by Alembic.
revision = "17fcea065655"
down_revision = "87d38ad83218"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402
from sqlalchemy.dialects.mysql import MEDIUMTEXT, TEXT  # noqa: E402
from sqlalchemy.dialects.mysql.base import MySQLDialect  # noqa: E402

from superset.migrations.shared.utils import get_table_column  # noqa: E402
from superset.utils.core import MediumText  # noqa: E402

TABLE_COLUMNS = [
    "annotation.json_metadata",
    "css_templates.css",
    "dashboards.css",
    "keyvalue.value",
    "query.extra_json",
    "report_execution_log.value_row_json",
    "report_recipient.recipient_config_json",
    "report_schedule.sql",
    "report_schedule.last_value_row_json",
    "report_schedule.validator_config_json",
    "report_schedule.extra_json",
    "row_level_security_filters.clause",
    "saved_query.sql",
    "saved_query.extra_json",
    "sl_columns.extra_json",
    "sl_datasets.extra_json",
    "sl_tables.extra_json",
    "slices.params",
    "slices.query_context",
    "ssh_tunnels.extra_json",
    "tab_state.extra_json",
    "tab_state.sql",
    "table_schema.extra_json",
]

NOT_NULL_COLUMNS = ["keyvalue.value", "row_level_security_filters.clause"]


def upgrade():
    if isinstance(op.get_bind().dialect, MySQLDialect):
        for item in TABLE_COLUMNS:
            table_name, column_name = item.split(".")

            if (column := get_table_column(table_name, column_name)) and isinstance(
                column["type"],
                TEXT,
            ):
                with op.batch_alter_table(table_name) as batch_op:
                    batch_op.alter_column(
                        column_name,
                        existing_type=sa.Text(),
                        type_=MediumText(),
                        existing_nullable=item not in NOT_NULL_COLUMNS,
                    )


def downgrade():
    if isinstance(op.get_bind().dialect, MySQLDialect):
        for item in TABLE_COLUMNS:
            table_name, column_name = item.split(".")

            if (column := get_table_column(table_name, column_name)) and isinstance(
                column["type"],
                MEDIUMTEXT,
            ):
                with op.batch_alter_table(table_name) as batch_op:
                    batch_op.alter_column(
                        column_name,
                        existing_type=MediumText(),
                        type_=sa.Text(),
                        existing_nullable=item not in NOT_NULL_COLUMNS,
                    )
