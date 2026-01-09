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
"""add_confidence_fields_to_database_schema_report

Revision ID: 45be4e65062d
Revises: 4a032c8dbc11
Create Date: 2025-12-18 14:27:18.506951

"""

# revision identifiers, used by Alembic.
revision = "45be4e65062d"
down_revision = "4a032c8dbc11"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column(
        "database_schema_report",
        sa.Column("confidence_score", sa.Float(), nullable=True),
    )
    op.add_column(
        "database_schema_report",
        sa.Column("confidence_breakdown", sa.Text(), nullable=True),
    )
    op.add_column(
        "database_schema_report",
        sa.Column("confidence_recommendations", sa.Text(), nullable=True),
    )
    op.add_column(
        "database_schema_report",
        sa.Column("confidence_validation_notes", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("database_schema_report", "confidence_validation_notes")
    op.drop_column("database_schema_report", "confidence_recommendations")
    op.drop_column("database_schema_report", "confidence_breakdown")
    op.drop_column("database_schema_report", "confidence_score")
