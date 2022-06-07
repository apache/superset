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
"""remove_coordinator_from_druid_cluster_model.py

Revision ID: 46f444d8b9b7
Revises: 4ce8df208545
Create Date: 2018-11-26 00:01:04.781119

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "46f444d8b9b7"
down_revision = "4ce8df208545"


def upgrade():
    with op.batch_alter_table("clusters") as batch_op:
        batch_op.drop_column("coordinator_host")
        batch_op.drop_column("coordinator_endpoint")
        batch_op.drop_column("coordinator_port")


def downgrade():
    op.add_column(
        "clusters", sa.Column("coordinator_host", sa.String(length=256), nullable=True)
    )
    op.add_column(
        "clusters", sa.Column("coordinator_port", sa.Integer(), nullable=True)
    )
    op.add_column(
        "clusters",
        sa.Column("coordinator_endpoint", sa.String(length=256), nullable=True),
    )
