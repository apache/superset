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
"""add subject column to report schedule

Revision ID: 100e3853bb0c
Revises: 5f57af97bc3f
Create Date: 2024-05-05 17:19:37.789891

"""

# revision identifiers, used by Alembic.
revision = '100e3853bb0c'
down_revision = '5f57af97bc3f'

import sqlalchemy as sa
from alembic import op
def upgrade():
    op.add_column(
        "report_schedule",
        sa.Column("email_subject", sa.String(length=255), nullable=True),
    )
def downgrade():
    op.drop_column("report_schedule", "email_subject")
