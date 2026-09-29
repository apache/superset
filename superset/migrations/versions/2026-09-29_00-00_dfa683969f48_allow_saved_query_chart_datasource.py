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
"""allow saved_query chart datasource

Revision ID: dfa683969f48
Revises: 95d8a99c822e
Create Date: 2026-09-29 00:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "dfa683969f48"
down_revision = "95d8a99c822e"


def upgrade() -> None:
    # Update chart datasource constraint to allow saved_query, matching
    # CreateChartCommand/UpdateChartCommand.validate_chart_datasource_type
    # (apache/superset#29697), which now accepts a saved_query as a valid,
    # persistent chart datasource alongside table and semantic_view.
    with op.batch_alter_table("slices") as batch_op:
        batch_op.drop_constraint("ck_chart_datasource", type_="check")
        batch_op.create_check_constraint(
            "ck_chart_datasource",
            "datasource_type in ('table', 'semantic_view', 'saved_query')",
        )


def downgrade() -> None:
    with op.batch_alter_table("slices") as batch_op:
        batch_op.drop_constraint("ck_chart_datasource", type_="check")
        batch_op.create_check_constraint(
            "ck_chart_datasource",
            "datasource_type in ('table', 'semantic_view')",
        )
