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
"""Add oboarding workflow for creating a dashboard with none existing chart

Revision ID: a55bbb4da9a6
Revises: 91b151e8dac1
Create Date: 2026-02-04 17:02:54.527420

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a55bbb4da9a6"
down_revision = "91b151e8dac1"

onboarding_workflow_table = sa.Table(
    "onboarding_workflow",
    sa.MetaData(),
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("name", sa.String(100), unique=True),
    sa.Column("description", sa.String(255)),
)


def upgrade():
    bind = op.get_bind()

    # Insert the new onboarding workflow
    insert_stmt = onboarding_workflow_table.insert().values(
        name="CREATE_DASHBOARD_WITH_NO_EXISTING_CHART",
        description="Onboarding workflow for creating a "
        "dashboard with none existing chart",
    )

    result = bind.execute(insert_stmt)
    onboarding_workflow_id = result.inserted_primary_key[0]

    # Insert a user_onboarding_workflow row for each existing user
    # All active users should have this workflow in their onboarding list,
    # but Gamma and Public users will not mark this workflow as visited since
    # they won't have write permissions to the API.
    insert_user_workflows = sa.text(
        """
        INSERT INTO user_onboarding_workflow
        (user_id, onboarding_workflow_id, visited_times, should_visit)
        SELECT u.id, :onboarding_workflow_id, 0, true
        FROM ab_user u
        WHERE u.active = true
        """
    )

    bind.execute(
        insert_user_workflows, {"onboarding_workflow_id": onboarding_workflow_id}
    )


def downgrade():
    bind = op.get_bind()
    delete_user_workflows = sa.text(
        """
        DELETE FROM user_onboarding_workflow
        WHERE onboarding_workflow_id IN (
            SELECT id
            FROM onboarding_workflow
            WHERE name = 'CREATE_DASHBOARD_WITH_NO_EXISTING_CHART'
        )
        """
    )

    bind.execute(delete_user_workflows)

    delete_stmt = onboarding_workflow_table.delete().where(
        onboarding_workflow_table.c.name == "CREATE_DASHBOARD_WITH_NO_EXISTING_CHART"
    )
    bind.execute(delete_stmt)
