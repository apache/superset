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
"""add_pending_review_status

Revision ID: c9f3a2b4d5e6
Revises: b8f2a1c3d4e5
Create Date: 2025-12-18 11:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "c9f3a2b4d5e6"
down_revision = "b8f2a1c3d4e5"


def upgrade():
    """Add pending_review to GeneratorStatus enum."""
    # Update the check constraint to include new status value
    # PostgreSQL version - drop and recreate constraint
    with op.batch_alter_table("dashboard_generator_run") as batch_op:
        batch_op.drop_constraint("ck_dashboard_generator_run_status", type_="check")
        batch_op.create_check_constraint(
            "ck_dashboard_generator_run_status",
            "status IN ('reserved', 'running', 'completed', 'failed', 'pending_review')",
        )


def downgrade():
    """Remove pending_review from GeneratorStatus enum."""
    with op.batch_alter_table("dashboard_generator_run") as batch_op:
        batch_op.drop_constraint("ck_dashboard_generator_run_status", type_="check")
        batch_op.create_check_constraint(
            "ck_dashboard_generator_run_status",
            "status IN ('reserved', 'running', 'completed', 'failed')",
        )
