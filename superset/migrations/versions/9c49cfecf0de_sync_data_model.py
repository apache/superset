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
"""sync_data_model

Revision ID: 9c49cfecf0de
Revises: db4b49eb0782
Create Date: 2019-12-03 13:26:12.237543

"""

# revision identifiers, used by Alembic.
revision = "9c49cfecf0de"
down_revision = "817e1c9b09d0"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


def upgrade():
    with op.batch_alter_table("annotation") as batch_op:
        batch_op.alter_column("layer_id", existing_type=sa.INTEGER(), nullable=False)

    try:
        op.drop_constraint("_customer_location_uc", "tables")
    except Exception:
        # either we're on SQLite which doesn't support changing constraints
        # or we're on MySQL and this constraint wasn't ever created in the first
        # place due to index length issues.
        pass

    try:
        op.create_foreign_key(
            "datasources_changed_by_fk",
            "datasources",
            "ab_user",
            ["changed_by_fk"],
            ["id"],
        )
    except Exception:
        # We're on SQLite which doesn't support constraint changes on existing tables
        pass


def downgrade():
    with op.batch_alter_table("annotation") as batch_op:
        op.alter_column("layer_id", existing_type=sa.INTEGER(), nullable=True)

    try:
        op.create_unique_constraint(
            "_customer_location_uc", "tables", ["database_id", "schema", "table_name"]
        )
    except Exception:
        # We're on SQLite which doesn't support altering constraints,
        # or we're on MySQL and the constraint is too large to create.
        pass

    try:
        op.drop_constraint(
            "datasources_changed_by_fk", "datasources", type_="foreignkey"
        )
    except Exception:
        # We're on SQLite which doesn't support constraint changes on existing tables
        pass
