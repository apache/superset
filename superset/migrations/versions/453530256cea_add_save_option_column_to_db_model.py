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
"""add_save_form_column_to_db_model

Revision ID: 453530256cea
<<<<<<< HEAD
Revises: f1410ed7ec95
=======
Revises: d416d0d715cc
>>>>>>> db migration for dbs
Create Date: 2021-04-30 10:55:07.009994

"""

# revision identifiers, used by Alembic.
revision = "453530256cea"
<<<<<<< HEAD
down_revision = "f1410ed7ec95"
=======
down_revision = "d416d0d715cc"
>>>>>>> db migration for dbs

import sqlalchemy as sa
from alembic import op


def upgrade():
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.add_column(
<<<<<<< HEAD
            sa.Column(
                "configuration_method",
                sa.VARCHAR(255),
                server_default="sqlalchemy_form",
            )
=======
            sa.Column("save_option", sa.VARCHAR(255), server_default="SQL_ALCHEMY")
>>>>>>> db migration for dbs
        )


def downgrade():
    with op.batch_alter_table("dbs") as batch_op:
<<<<<<< HEAD
        batch_op.drop_column("configuration_method")
=======
        batch_op.drop_column("save_option")
>>>>>>> db migration for dbs
