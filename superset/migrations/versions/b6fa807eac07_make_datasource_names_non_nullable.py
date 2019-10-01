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
"""make_datasource_names_non_nullable

Revision ID: b6fa807eac07
Revises: 258b5280a45e
Create Date: 2019-10-02 00:29:16.679272

"""
from alembic import op
from sqlalchemy import String

# revision identifiers, used by Alembic.
revision = "b6fa807eac07"
down_revision = "258b5280a45e"


def upgrade():
    with op.batch_alter_table("clusters") as batch_op:
        batch_op.alter_column("cluster_name", existing_type=String(250), nullable=False)
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.alter_column(
            "database_name", existing_type=String(250), nullable=False
        )
    with op.batch_alter_table("tables") as batch_op:
        batch_op.alter_column("table_name", existing_type=String(250), nullable=False)


def downgrade():
    with op.batch_alter_table("clusters") as batch_op:
        batch_op.alter_column("cluster_name", existing_type=String(250), nullable=True)
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.alter_column("database_name", existing_type=String(250), nullable=True)
    with op.batch_alter_table("tables") as batch_op:
        batch_op.alter_column("table_name", existing_type=String(250), nullable=True)
