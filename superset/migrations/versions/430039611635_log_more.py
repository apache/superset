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
"""log more

Revision ID: 430039611635
Revises: d827694c7555
Create Date: 2016-02-10 08:47:28.950891

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "430039611635"
down_revision = "d827694c7555"


def upgrade():
    op.add_column("logs", sa.Column("dashboard_id", sa.Integer(), nullable=True))
    op.add_column("logs", sa.Column("slice_id", sa.Integer(), nullable=True))


def downgrade():
    op.drop_column("logs", "slice_id")
    op.drop_column("logs", "dashboard_id")
